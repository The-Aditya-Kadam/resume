const {normalizeProjects}=require('./project-cards');
const seed=normalizeProjects([
 {id:'ar-form-extension',title:'AR Form Submitting Extension',description:'Chrome extension that maps CSV columns to web form fields and processes rows after confirmed submissions.',githubUrl:'https://github.com/The-Aditya-Kadam/AR-Form-submitting-extension',setupUrl:'https://github.com/The-Aditya-Kadam/AR-Form-submitting-extension/blob/main/README.md',demoUrl:'',private:true,tags:['Chrome extension','CSV automation','Form workflows']},
 {id:'audit-wizard',title:'Audit Wizard',description:'Website auditing application with SEO, HTML, performance and content checks, plus downloadable HTML, Excel and CSV reports.',githubUrl:'https://github.com/The-Aditya-Kadam/audit-wizard',setupUrl:'https://github.com/The-Aditya-Kadam/audit-wizard/blob/main/README.md',demoUrl:'https://audit-wizard-d0ha.onrender.com/step1',private:false,tags:['Python','Flask','Technical SEO','Reporting']},
 {id:'optimizer-wizard',title:'Optimizer Wizard',description:'Guided web page optimization tool with HTML improvements, live PageSpeed checks and a checklist of manual server fixes.',githubUrl:'https://github.com/The-Aditya-Kadam/Optimizer-Wizard',setupUrl:'https://github.com/The-Aditya-Kadam/Optimizer-Wizard/blob/main/README.md',demoUrl:'https://optimizer-wizard-2a7h.onrender.com/step1',private:false,tags:['Python','Flask','PageSpeed','Web performance']},
 {id:'optimizer-app',title:'Optimizer App',description:'Project repository. A detailed project overview and hosted demo have not yet been provided.',githubUrl:'https://github.com/The-Aditya-Kadam/optimizer-app',setupUrl:'',demoUrl:'',private:false,tags:['Repository preview']}
]);
async function ensureProjects(pool){
 await pool.query('CREATE TABLE IF NOT EXISTS cv_project_defaults(id INTEGER PRIMARY KEY,data JSONB NOT NULL)');
 await pool.query('INSERT INTO cv_project_defaults(id,data) VALUES(1,$1::jsonb) ON CONFLICT(id) DO NOTHING',[JSON.stringify(seed)]);
}
function resolveProjects(data,defaults){return Object.prototype.hasOwnProperty.call(data,'projects')?data:{...data,projects:normalizeProjects(defaults||[])};}
module.exports={seed,ensureProjects,resolveProjects};
