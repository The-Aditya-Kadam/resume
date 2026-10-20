const {createHash,createHmac}=require('node:crypto');
const ORIGIN='https://aditya-kadam-resume.onrender.com';

function createVisitAlerts(pool,{env=process.env,fetchImpl=fetch,now=()=>new Date()}={}) {
  const scriptUrl=env.VISIT_ALERT_SCRIPT_URL||'';
  const validUrl=/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(scriptUrl);
  const enabled=env.VISIT_ALERTS_ENABLED==='true' && validUrl && (env.VISIT_ALERT_SECRET||'').length>=32;
  let schema;
  async function ensureSchema() {
    if(!schema) schema=pool.query(`
      CREATE TABLE IF NOT EXISTS resume_visit_alerts (
        session_hash TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS resume_visit_alert_limits (
        bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0
      );
    `).catch(error=>{schema=null;throw error;});
    await schema;
  }
  async function reserve(session,date) {
    await ensureSchema();
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const day=date.toISOString().slice(0,10),hour=date.toISOString().slice(0,13);
      // Lock the daily row first: serializes reservations across processes/restarts.
      await client.query('INSERT INTO resume_visit_alert_limits(bucket) VALUES($1) ON CONFLICT DO NOTHING',[day]);
      await client.query('SELECT bucket FROM resume_visit_alert_limits WHERE bucket=$1 FOR UPDATE',[day]);
      const hash=createHash('sha256').update(session).digest('hex');
      const seen=await client.query('INSERT INTO resume_visit_alerts(session_hash) VALUES($1) ON CONFLICT DO NOTHING RETURNING session_hash',[hash]);
      if(!seen.rowCount){await client.query('ROLLBACK');return false;}
      await client.query('INSERT INTO resume_visit_alert_limits(bucket) VALUES($1) ON CONFLICT DO NOTHING',[hour]);
      for(const [bucket,limit] of [[day,90],[hour,20]]) {
        const result=await client.query('UPDATE resume_visit_alert_limits SET attempts=attempts+1 WHERE bucket=$1 AND attempts<$2 RETURNING attempts',[bucket,limit]);
        if(!result.rowCount){await client.query('ROLLBACK');return false;}
      }
      await client.query("DELETE FROM resume_visit_alerts WHERE created_at < NOW() - INTERVAL '2 days'");
      await client.query('DELETE FROM resume_visit_alert_limits WHERE bucket<$1',[new Date(date.getTime()-2*86400000).toISOString().slice(0,10)]);
      await client.query('COMMIT');
      return true;
    }catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  }
  async function handle(req,res) {
    const reply=(status)=>{res.writeHead(status,{'Access-Control-Allow-Origin':ORIGIN,'Cache-Control':'no-store'});res.end();};
    if(req.headers.origin!==ORIGIN){reply(403);return;}
    if(req.method==='OPTIONS'){
      res.writeHead(204,{'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'});res.end();return;
    }
    if(req.method!=='POST'){reply(405);return;}
    if(!enabled || /bot|crawler|spider|headless|preview/i.test(req.headers['user-agent']||'')){reply(204);return;}
    let size=0,chunks=[];
    try {
      for await(const chunk of req){size+=chunk.length;if(size>1024){reply(413);return;}chunks.push(chunk);}
      const body=JSON.parse(Buffer.concat(chunks).toString());
      if(!/^[a-f0-9-]{36}$/i.test(body.sessionId||'')){reply(400);return;}
      const date=now();
      if(!await reserve(body.sessionId,date)){reply(204);return;}
      const payload=JSON.stringify({eventId:createHash('sha256').update(body.sessionId).digest('hex'),timestamp:date.toISOString()});
      const signature=createHmac('sha256',env.VISIT_ALERT_SECRET).update(payload).digest('hex');
      // The browser never sees the shared secret or the Apps Script URL.
      const response=await fetchImpl(scriptUrl,{
        method:'POST',signal:AbortSignal.timeout(25000),redirect:'follow',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({payload,signature})
      });
      if(!response.ok || (await response.json()).ok!==true)throw new Error('EMAIL_PROVIDER_REJECTED');
      reply(204);
    }catch(error){
      // Do not expose provider responses, API keys, or request contents in logs.
      console.error('VISIT_ALERT_FAILED');reply(503);
    }
  }
  return {handle};
}
module.exports={createVisitAlerts};
