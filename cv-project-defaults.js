const {normalizeProjects}=require('./project-cards');
const seed=normalizeProjects([
 {id:'ar-form-extension',title:'AR Form Submitting Extension',thumbnailUrl:'/assets/projects/gitprofile-thumbnail.png',description:'CSV-based form filling for Chrome.',githubUrl:'https://github.com/The-Aditya-Kadam/AR-Form-submitting-extension',setupUrl:'https://github.com/The-Aditya-Kadam/AR-Form-submitting-extension/blob/main/README.md',demoUrl:'',private:true,tags:['Chrome extension','CSV automation','Form workflows']},
 {id:'audit-wizard',title:'Audit Wizard',thumbnailUrl:'/assets/projects/gitprofile-thumbnail.png',description:'Website SEO audits with downloadable reports.',githubUrl:'https://github.com/The-Aditya-Kadam/audit-wizard',setupUrl:'https://github.com/The-Aditya-Kadam/audit-wizard/blob/main/README.md',demoUrl:'https://audit-wizard-d0ha.onrender.com/step1',private:false,tags:['Python','Flask','Technical SEO','Reporting']},
 {id:'optimizer-wizard',title:'Optimizer Wizard',thumbnailUrl:'/assets/projects/gitprofile-thumbnail.png',description:'HTML optimization and PageSpeed checks.',githubUrl:'https://github.com/The-Aditya-Kadam/Optimizer-Wizard',setupUrl:'https://github.com/The-Aditya-Kadam/Optimizer-Wizard/blob/main/README.md',demoUrl:'https://optimizer-wizard-2a7h.onrender.com/step1',private:false,tags:['Python','Flask','PageSpeed','Web performance']},
 {id:'optimizer-app',title:'Optimizer App',thumbnailUrl:'/assets/projects/gitprofile-thumbnail.png',description:'Optimizer app repository.',githubUrl:'https://github.com/The-Aditya-Kadam/optimizer-app',setupUrl:'',demoUrl:'',private:false,tags:['Repository preview']}
]);
async function ensureProjects(pool){
 const client=await pool.connect();try{
  await client.query('BEGIN');
  await client.query('CREATE TABLE IF NOT EXISTS cv_project_defaults(id INTEGER PRIMARY KEY,data JSONB NOT NULL)');
  await client.query('CREATE TABLE IF NOT EXISTS cv_project_default_updates(id TEXT PRIMARY KEY)');
  await client.query('INSERT INTO cv_project_defaults(id,data) VALUES(1,$1::jsonb) ON CONFLICT(id) DO NOTHING',[JSON.stringify(seed)]);
  const stored=(await client.query('SELECT data FROM cv_project_defaults WHERE id=1 FOR UPDATE')).rows[0].data;
  if(!(await client.query('SELECT id FROM cv_project_default_updates WHERE id=$1',['20261013-short-thumbnails'])).rows.length){
   const updated=stored.map(x=>{const approved=seed.find(s=>s.id===x.id);return approved?{...x,description:approved.description,thumbnailUrl:approved.thumbnailUrl}:x;});
   await client.query('UPDATE cv_project_defaults SET data=$1::jsonb WHERE id=1',[JSON.stringify(updated)]);
   await client.query('INSERT INTO cv_project_default_updates(id) VALUES($1)',['20261013-short-thumbnails']);
  }
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
function resolveProjects(data,defaults){return Object.prototype.hasOwnProperty.call(data,'projects')?data:{...data,projects:normalizeProjects(defaults||[])};}
module.exports={seed,ensureProjects,resolveProjects};
