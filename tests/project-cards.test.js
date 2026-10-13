const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {seed,ensureProjects,resolveProjects}=require('../cv-project-defaults');
const {normalizeProjects,render}=require('../project-cards');
const {normalizeData}=require('../server');
test('project defaults live in SQL without changing saved CV or history and respect intentional clearing',async t=>{
 const db=new PGlite();await db.waitReady;t.after(()=>db.close());const pool={query:(sql,args)=>db.query(sql,args)};
 await pool.query('CREATE TABLE cv_documents(id INTEGER PRIMARY KEY,data JSONB,version INTEGER)');await pool.query('CREATE TABLE cv_versions(id INTEGER PRIMARY KEY,data JSONB)');
 const original={summary:'Preserved',customSections:[],experience:[{company:'Original'}],repositories:[]};await pool.query('INSERT INTO cv_documents VALUES(1,$1,8)',[original]);await pool.query('INSERT INTO cv_versions VALUES(1,$1)',[original]);
 await ensureProjects(pool);await ensureProjects(pool);const stored=(await pool.query('SELECT data FROM cv_project_defaults WHERE id=1')).rows[0].data;
 assert.equal(stored.length,4);assert.equal((await pool.query('SELECT COUNT(*) AS n FROM cv_project_defaults')).rows[0].n,1);
 assert.deepEqual((await pool.query('SELECT data FROM cv_documents')).rows[0].data,original);assert.deepEqual((await pool.query('SELECT data FROM cv_versions')).rows[0].data,original);
 assert.deepEqual(resolveProjects({...original,projects:[]},stored).projects,[]);assert.equal(resolveProjects(original,stored).projects.length,4);
});
test('cards render verified demo/setup links, protect private source and escape unsafe input',()=>{
 const html=render(seed);assert.equal((html.match(/class="panel repo project-card"/g)||[]).length,4);assert.equal((html.match(/>Live demo /g)||[]).length,2);
 assert.ok(html.includes('https://audit-wizard-d0ha.onrender.com/step1'));assert.ok(html.includes('https://optimizer-wizard-2a7h.onrender.com/step1'));assert.ok(html.includes('Request code access'));
 assert.ok(!html.includes('href="https://github.com/The-Aditya-Kadam/AR-Form-submitting-extension'));
 const hostile=render([{title:'<script>alert(1)</script>',githubUrl:'javascript:alert(1)',setupUrl:'http://insecure.example',demoUrl:'',tags:[]}]);assert.ok(!hostile.includes('<script>'));assert.ok(!hostile.includes('javascript:'));assert.ok(!hostile.includes('http://insecure'));
});
test('backend retains editable projects and optional blank links through normalization',()=>{
 const input={...seed[1],demoUrl:'',setupUrl:''};assert.deepEqual(normalizeData({projects:[input]}).projects,normalizeProjects([input]));assert.deepEqual(normalizeData({projects:[]}).projects,[]);
});
