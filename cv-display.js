const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const CVContent=require('./cv-content');
const CVAttachments=require('./cv-attachments');
const clone=value=>JSON.parse(JSON.stringify(value));
function seed(){
  const legacy=CVContent.resolve({ui:{},experience:[],repositories:[]});
  legacy.repositories.at(-1).private=true;
  legacy.repositories.at(-1).url='';
  return {repositories:legacy.repositories,attachments:CVAttachments.defaults,
    proofs:{rath:'https://github.com/The-Aditya-Kadam/rath-infotech',velocity:'https://github.com/The-Aditya-Kadam/velocity-media-lab/blob/main/Website%20list',epicenter:'https://github.com/The-Aditya-Kadam/epicenter-technology',futran:'https://github.com/The-Aditya-Kadam/fts-projects',aconnect:'https://github.com/The-Aditya-Kadam/Aconnect-mumbai',mob:'https://github.com/The-Aditya-Kadam/Formless-technology'},
    knowledgeHTML:fs.readFileSync(path.join(__dirname,'scripts/display-knowledge.html'),'utf8'),
    experienceHeadingHTML:'TEN YEARS, <span>STACKED.</span>',knowledgeHeadingHTML:'DATA SCIENCE <span>LAB.</span>',
    experienceHTML:fs.readFileSync(path.join(__dirname,'scripts/display-experience.html'),'utf8').replaceAll('https://github.com/The-Aditya-Kadam/velocity-media-lab/tree/main/website-list','https://github.com/The-Aditya-Kadam/velocity-media-lab')};
}
async function ensureDisplay(pool){
  const before=await pool.query('SELECT id,data,version FROM cv_documents ORDER BY id');
  const history=await pool.query('SELECT id,document_id,version,data FROM cv_versions ORDER BY id');
  const fingerprint=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
  const original=fingerprint({documents:before.rows,history:history.rows});
  await pool.query('CREATE TABLE IF NOT EXISTS cv_display_defaults (id INTEGER PRIMARY KEY,data JSONB NOT NULL)');
  await pool.query('INSERT INTO cv_display_defaults(id,data) VALUES(1,$1::jsonb) ON CONFLICT (id) DO NOTHING',[JSON.stringify(seed())]);
  const after=await pool.query('SELECT id,data,version FROM cv_documents ORDER BY id');
  const historyAfter=await pool.query('SELECT id,document_id,version,data FROM cv_versions ORDER BY id');
  if(fingerprint({documents:after.rows,history:historyAfter.rows})!==original)throw new Error('CV records changed during display initialization');
  console.log('CV_DISPLAY_READY existing_documents_and_history_unchanged');
}
function resolveDisplay(raw,defaults){
  const data=clone(raw),config=clone(defaults);
  const legacy=!data.ui?.contentSchemaVersion;
  data.ui=data.ui||{};
  if(legacy&&(!Array.isArray(data.repositories)||!data.repositories.length))data.repositories=config.repositories;
  if(data.attachments===undefined)data.attachments=config.attachments;
  if(legacy)(data.experience||[]).forEach(e=>{if(!e.proof){const key=Object.keys(config.proofs).find(k=>String(e.company||'').toLowerCase().includes(k));if(key)e.proof=config.proofs[key];}});
  data.ui.contentSchemaVersion=1;
  delete data.presentation;
  return {data,presentation:{experienceHTML:config.experienceHTML,knowledgeHTML:config.knowledgeHTML,experienceHeadingHTML:config.experienceHeadingHTML,knowledgeHeadingHTML:config.knowledgeHeadingHTML},attachmentDefaults:config.attachments};
}
module.exports={seed,ensureDisplay,resolveDisplay};
