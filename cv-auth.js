const crypto=require('node:crypto');
const {promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt);
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const safe=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);};
async function passwordHash(password){const salt=crypto.randomBytes(16).toString('hex');const key=await scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024});return 'scrypt$32768$8$3$'+salt+'$'+key.toString('hex');}
async function passwordMatches(password,encoded){try{const [method,n,r,p,salt,key]=encoded.split('$');if(method!=='scrypt'||n!=='32768'||r!=='8'||p!=='3')return false;const result=await scrypt(password,salt,64,{N:+n,r:+r,p:+p,maxmem:64*1024*1024});return safe(result.toString('hex'),key);}catch{return false;}}
async function ensureAuth(pool){
  await pool.query('CREATE TABLE IF NOT EXISTS cv_admin (id INTEGER PRIMARY KEY,username TEXT NOT NULL,password_hash TEXT NOT NULL)');
  await pool.query('CREATE TABLE IF NOT EXISTS cv_admin_sessions (token_hash TEXT PRIMARY KEY,expires_at TIMESTAMPTZ NOT NULL)');
  await pool.query('CREATE TABLE IF NOT EXISTS cv_login_attempts (key_hash TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires_at TIMESTAMPTZ NOT NULL)');
}
function createAuth(pool,{setupToken=process.env.CV_ADMIN_SETUP_TOKEN||'',origins=['https://aditya-kadam-resume.onrender.com','https://aditya-cv-dashboard-checks.onrender.com']}={}){
  const dummyHash=passwordHash(crypto.randomBytes(24).toString('hex'));
  async function authorized(req){const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization||'');if(!match)return false;const row=await pool.query('SELECT token_hash FROM cv_admin_sessions WHERE token_hash=$1 AND expires_at>NOW()',[hash(match[1])]);return row.rows.length===1;}
  async function handle(req,res,pathname,readBody,send){
    if(!pathname.startsWith('/api/auth/'))return false;
    res.setHeader('Cache-Control','no-store');
    if(req.method==='GET'&&pathname==='/api/auth/status'){const row=await pool.query('SELECT id FROM cv_admin WHERE id=1');send(res,200,{configured:!!row.rows.length,authenticated:await authorized(req)});return true;}
    if(req.method!=='POST'){send(res,405,{error:'Method not allowed.'});return true;}
    if(req.headers.origin&&!origins.includes(req.headers.origin)){send(res,403,{error:'Origin not allowed.'});return true;}
    if(pathname==='/api/auth/logout'){const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization||'');if(match)await pool.query('DELETE FROM cv_admin_sessions WHERE token_hash=$1',[hash(match[1])]);send(res,200,{ok:true});return true;}
    const body=await readBody(req);
    const username=String(body.username||'').trim().toLowerCase(),password=String(body.password||'');
    const address=req.socket.remoteAddress||'unknown';
    const key=hash(address);
    const attempts=await pool.query('SELECT attempts,expires_at FROM cv_login_attempts WHERE key_hash=$1',[key]);
    if(attempts.rows[0]&&new Date(attempts.rows[0].expires_at)>new Date()&&attempts.rows[0].attempts>=5){send(res,429,{error:'Too many attempts. Try again in 15 minutes.'});return true;}
    await pool.query("INSERT INTO cv_login_attempts(key_hash,attempts,expires_at) VALUES($1,1,NOW()+INTERVAL '15 minutes') ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN cv_login_attempts.expires_at<NOW() THEN 1 ELSE cv_login_attempts.attempts+1 END,expires_at=CASE WHEN cv_login_attempts.expires_at<NOW() THEN NOW()+INTERVAL '15 minutes' ELSE cv_login_attempts.expires_at END",[key]);
    if(password.length>256||!username||username.length>100){send(res,400,{error:'Invalid sign-in details.'});return true;}
    if(pathname==='/api/auth/setup'){
      if(!setupToken||!safe(String(body.setupToken||''),setupToken)){send(res,403,{error:'Invalid owner setup key.'});return true;}
      if(password.length<15){send(res,400,{error:'Use a password of at least 15 characters.'});return true;}
      const encoded=await passwordHash(password);
      const inserted=await pool.query('INSERT INTO cv_admin(id,username,password_hash) VALUES(1,$1,$2) ON CONFLICT(id) DO NOTHING RETURNING id',[username,encoded]);
      if(!inserted.rows.length){send(res,409,{error:'Owner already configured. Sign in instead.'});return true;}
    }else if(pathname==='/api/auth/login'){
      const row=await pool.query('SELECT password_hash FROM cv_admin WHERE id=1 AND username=$1',[username]);
      const matches=await passwordMatches(password,row.rows[0]?.password_hash||await dummyHash);
      if(!row.rows.length||!matches){send(res,401,{error:'Incorrect username or password.'});return true;}
    }else{send(res,404,{error:'Not found.'});return true;}
    const token=crypto.randomBytes(32).toString('base64url');
    await pool.query("INSERT INTO cv_admin_sessions(token_hash,expires_at) VALUES($1,NOW()+INTERVAL '8 hours')",[hash(token)]);
    await pool.query('DELETE FROM cv_login_attempts WHERE key_hash=$1',[key]);
    send(res,200,{token,expiresIn:28800});return true;
  }
  return {authorized,handle};
}
module.exports={ensureAuth,createAuth,passwordHash,passwordMatches};
