const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 10000;
const ROOT = __dirname;
const DATA_PATH = path.join(ROOT, "cv-page", "data.json");
const REPO = process.env.GITHUB_REPO || "The-Aditya-Kadam/resume";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ADMIN_PASSWORD = process.env.CV_ADMIN_PASSWORD || "123456";

const MIME = {
  ".html":"text/html; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".js":"application/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".svg":"image/svg+xml",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",
  ".webp":"image/webp",
  ".pdf":"application/pdf"
};

function send(res,status,body,type="application/json"){
  res.writeHead(status,{"Content-Type":type,"Cache-Control":"no-store"});
  res.end(typeof body==="string"?body:JSON.stringify(body));
}

function readBody(req){
  return new Promise((resolve,reject)=>{
    let body="";
    req.on("data",chunk=>{
      body+=chunk;
      if(body.length>1024*1024){req.destroy();reject(new Error("Payload too large"));}
    });
    req.on("end",()=>resolve(body));
    req.on("error",reject);
  });
}

function auth(req){
  return ADMIN_PASSWORD && req.headers["x-cv-admin-password"] === ADMIN_PASSWORD;
}

async function githubRequest(url, options={}){
  const response=await fetch(url,{
    ...options,
    headers:{
      "Accept":"application/vnd.github+json",
      "Authorization":`Bearer ${GITHUB_TOKEN}`,
      "X-GitHub-Api-Version":"2022-11-28",
      ...(options.headers||{})
    }
  });
  const text=await response.text();
  let data={};
  try{data=JSON.parse(text)}catch{data={message:text}};
  if(!response.ok) throw new Error(data.message || `GitHub request failed (${response.status})`);
  return data;
}

async function publishData(data){
  if(!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not configured on Render.");
  const apiBase=`https://api.github.com/repos/${REPO}/contents/cv-page/data.json`;
  const current=await githubRequest(`${apiBase}?ref=${encodeURIComponent(BRANCH)}`);
  const content=Buffer.from(JSON.stringify(data,null,2)+"\n","utf8").toString("base64");
  return githubRequest(apiBase,{
    method:"PUT",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      message:"Update CV page content",
      content,
      sha:current.sha,
      branch:BRANCH
    })
  });
}

function serveStatic(req,res){
  let pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
  if(pathname==="/") pathname="/index.html";
  if(pathname==="/cv-page") pathname="/cv-page/";
  if(pathname==="/cv-page/") pathname="/cv-page/index.html";
  if(pathname==="/cv-page/admin") pathname="/cv-page/admin/";
  if(pathname==="/cv-page/admin/") pathname="/cv-page/admin/index.html";
  const file=path.normalize(path.join(ROOT,pathname));
  if(!file.startsWith(ROOT)) return send(res,403,{error:"Forbidden"});
  fs.stat(file,(err,stat)=>{
    if(!err && stat.isFile()){
      const ext=path.extname(file).toLowerCase();
      res.writeHead(200,{"Content-Type":MIME[ext]||"application/octet-stream"});
      fs.createReadStream(file).pipe(res);
    }else{
      send(res,404,"Not found","text/plain; charset=utf-8");
    }
  });
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,"http://localhost");
    if(req.method==="GET" && url.pathname==="/api/cv"){
      if(!auth(req)) return send(res,401,{error:"Invalid admin password"});
      const data=JSON.parse(fs.readFileSync(DATA_PATH,"utf8"));
      return send(res,200,data);
    }
    if(req.method==="POST" && url.pathname==="/api/cv"){
      if(!auth(req)) return send(res,401,{error:"Unauthorized"});
      let data;
      try{data=JSON.parse(await readBody(req));}catch{return send(res,400,{error:"Invalid JSON"});}
      if(!data || typeof data!=="object" || !Array.isArray(data.cards)) return send(res,400,{error:"Invalid CV data"});
      const result=await publishData(data);
      return send(res,200,{ok:true,message:"Saved to GitHub. Render will auto-deploy this commit.",commit:result.commit});
    }
    if(req.method==="GET" && url.pathname==="/api/health") return send(res,200,{ok:true});
    return serveStatic(req,res);
  }catch(error){
    console.error(error);
    send(res,500,{error:error.message||"Server error"});
  }
});

server.listen(PORT,"0.0.0.0",()=>console.log(`CV server listening on ${PORT}`));
