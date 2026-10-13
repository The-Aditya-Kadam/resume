const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {seed,ensureProjects,resolveProjects}=require('../cv-project-defaults');
const {normalizeProjects,render}=require('../project-cards');
const {normalizeData}=require('../server');
test('project defaults live in SQL without changing saved CV or history and respect intentional clearing',async t=>{
 const db=new PGlite();await db.waitReady;t.after(()=>db.close());const query=(sql,args)=>db.query(sql,args),pool={query,connect:async()=>({query,release(){}})};
 await pool.query('CREATE TABLE cv_documents(id INTEGER PRIMARY KEY,data JSONB,version INTEGER)');await pool.query('CREATE TABLE cv_versions(id INTEGER PRIMARY KEY,data JSONB)');
 const original={summary:'Preserved',customSections:[],experience:[{company:'Original'}],repositories:[]};await pool.query('INSERT INTO cv_documents VALUES(1,$1,8)',[original]);await pool.query('INSERT INTO cv_versions VALUES(1,$1)',[original]);
 await ensureProjects(pool);await ensureProjects(pool);const stored=(await pool.query('SELECT data FROM cv_project_defaults WHERE id=1')).rows[0].data;
 assert.equal(stored.length,4);assert.ok(stored.every(x=>x.thumbnailUrl==='/assets/projects/gitprofile-thumbnail.png'));assert.equal((await pool.query('SELECT COUNT(*) AS n FROM cv_project_defaults')).rows[0].n,1);
 assert.deepEqual((await pool.query('SELECT data FROM cv_documents')).rows[0].data,original);assert.deepEqual((await pool.query('SELECT data FROM cv_versions')).rows[0].data,original);
 assert.deepEqual(resolveProjects({...original,projects:[]},stored).projects,[]);assert.equal(resolveProjects(original,stored).projects.length,4);
});
test('cards render verified demo/setup links, protect private source and escape unsafe input',()=>{
 const html=render(seed);assert.equal((html.match(/class="panel repo project-card"/g)||[]).length,4);assert.equal((html.match(/class="project-thumbnail"/g)||[]).length,4);assert.equal((html.match(/>Live demo /g)||[]).length,2);
 assert.ok(html.includes('https://audit-wizard-d0ha.onrender.com/step1'));assert.ok(html.includes('https://optimizer-wizard-2a7h.onrender.com/step1'));assert.ok(html.includes('Request code access'));
 assert.ok(!html.includes('href="https://github.com/The-Aditya-Kadam/AR-Form-submitting-extension'));
 const hostile=render([{title:'<script>alert(1)</script>',githubUrl:'javascript:alert(1)',setupUrl:'http://insecure.example',demoUrl:'',tags:[]}]);assert.ok(!hostile.includes('<script>'));assert.ok(!hostile.includes('javascript:'));assert.ok(!hostile.includes('http://insecure'));
});
test('backend retains editable projects and optional blank links through normalization',()=>{
 const input={...seed[1],demoUrl:'',setupUrl:''};assert.deepEqual(normalizeData({projects:[input]}).projects,normalizeProjects([input]));assert.deepEqual(normalizeData({projects:[]}).projects,[]);
});

test('thumbnail update preserves existing URLs and does not replay over later edits',async t=>{
 const db=new PGlite();await db.waitReady;t.after(()=>db.close());const query=(sql,args)=>db.query(sql,args),pool={query,connect:async()=>({query,release(){}})};
 await query('CREATE TABLE cv_project_defaults(id INTEGER PRIMARY KEY,data JSONB NOT NULL)');
 const old=seed.map(x=>({...x,description:'Long old description',thumbnailUrl:'',custom:'preserve'}));old[1].demoUrl='https://example.com/owner-demo';
 await query('INSERT INTO cv_project_defaults VALUES(1,$1)',[old]);await ensureProjects(pool);
 let data=(await query('SELECT data FROM cv_project_defaults')).rows[0].data;assert.equal(data[1].demoUrl,old[1].demoUrl);assert.equal(data[1].custom,'preserve');assert.equal(data[1].description,seed[1].description);assert.equal(data[1].thumbnailUrl,seed[1].thumbnailUrl);
 data[1].description='Later owner edit';await query('UPDATE cv_project_defaults SET data=$1',[data]);await ensureProjects(pool);assert.deepEqual((await query('SELECT data FROM cv_project_defaults')).rows[0].data,data);
});

test('all section positions move only projects and survive backend normalization',()=>{
 const {JSDOM}=require('jsdom'),cards=require('../project-cards');
 const dom=new JSDOM('<main><section id="summary"></section><section id="education"></section><section id="skills"></section><section id="experience">Protected experience</section><section id="knowledge">Protected knowledge</section><div id="customCVSections"></div><section id="projects"></section><section id="contact"></section></main>');const doc=dom.window.document,section=doc.getElementById('projects');
 const targets={'after-summary':'summary','after-education':'education','after-skills':'skills','before-knowledge':'knowledge','after-knowledge':'knowledge','before-contact':'contact'};
 for(const p of cards.positions){cards.place(doc,section,p);assert.equal((p.startsWith('before-')?section.nextElementSibling:section.previousElementSibling).id,targets[p]);assert.equal(normalizeData({ui:{projectPosition:p}}).ui.projectPosition,p);}
 assert.equal(doc.getElementById('experience').innerHTML,'Protected experience');assert.equal(doc.getElementById('knowledge').innerHTML,'Protected knowledge');assert.equal(cards.place(doc,section,'#malicious'),'after-knowledge');assert.equal(normalizeData({ui:{projectPosition:'unknown'}}).ui.projectPosition,'after-knowledge');
 dom.window.close();
});
