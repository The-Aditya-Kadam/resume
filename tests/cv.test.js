const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,ResourceLoader}=require('jsdom');
const {newDb}=require('pg-mem');
const {createServer,normalizeData}=require('../server');
const root=path.resolve(__dirname,'..');
const {resolve}=require('../cv-content');
const raw={site:{title:'Saved title',description:'Saved description'},name:'Saved Person',summary:'Saved summary',ui:{},education:[],certifications:[],awards:[],competencies:[],customSections:[],repositories:[],experience:[{company:'Rath Infotech',role:'Team Lead',dates:'2026',bullets:['One'],proof:''}]};

test('empty optional strings survive backend normalization and legacy content resolves without mutation',()=>{
 const before=JSON.stringify(raw),d=resolve(raw);
 assert.equal(d.repositories.length,6);assert.match(d.experience[0].proof,/rath-infotech/);assert.equal(JSON.stringify(raw),before);
 const empty={...d,site:{title:'',description:''},name:'',summary:'',ui:{...d.ui,knowledgeIntro:'',knowledgeGithubLabel:''},repositories:[]};
 const normalized=normalizeData(empty);assert.equal(normalized.site.title,'');assert.equal(normalized.ui.knowledgeIntro,'');assert.equal(normalized.summary,'');assert.deepEqual(resolve(normalized).repositories,[]);
});

test('API save, read, conflict and rollback use an isolated SQL database',async t=>{
 const db=newDb(),adapter=db.adapters.createPg(),pool=new adapter.Pool();
 await pool.query('CREATE TABLE cv_documents (id INTEGER PRIMARY KEY,data JSONB NOT NULL,version INTEGER NOT NULL,updated_at TIMESTAMPTZ DEFAULT NOW()); CREATE TABLE cv_versions (id SERIAL PRIMARY KEY,document_id INTEGER REFERENCES cv_documents(id),version INTEGER,data JSONB)');
 const server=createServer(pool);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));await pool.end();});
 const url='http://127.0.0.1:'+server.address().port+'/api/cv';
 const post=(data,version)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,expectedVersion:version})});
 let response=await post(resolve(raw),0);assert.equal(response.status,200);assert.equal((await response.json()).version,1);
 let data=resolve(raw);data.name='Changed';data.site.title='';data.ui.knowledgeIntro='';data.repositories=[];
 response=await post(data,1);assert.equal(response.status,200);assert.equal((await response.json()).version,2);
 const published=await (await fetch(url)).json();assert.equal(published.data.name,'Changed');assert.equal(published.data.site.title,'');assert.deepEqual(published.data.repositories,[]);
 const pdf='data:application/pdf;base64,'+Buffer.from('%PDF-1.4\nAttachment test\n%%EOF').toString('base64');
 data.attachments={resume:{name:'new-resume.pdf',dataUrl:pdf},coverLetter:{name:'cover.pdf',dataUrl:pdf}};
 response=await post(data,2);assert.equal(response.status,200);
 const attachments=(await (await fetch(url)).json()).data.attachments;
 assert.equal(attachments.resume.dataUrl,pdf);assert.equal(attachments.coverLetter.dataUrl,pdf);
 response=await post({...data,attachments:{resume:{url:'javascript:alert(1)'}}},3);assert.equal(response.status,400);
 response=await post({...data,name:'Stale'},1);assert.equal(response.status,409);assert.equal((await (await fetch(url)).json()).data.name,'Changed');
 response=await post({experience:[null]},2);assert.equal(response.status,400);
 response=await fetch(url+'/rollback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedVersion:3})});assert.equal(response.status,200);assert.equal((await response.json()).data.name,'Changed');
});

class LocalResources extends ResourceLoader{fetch(url){const pathname=new URL(url).pathname;const file=path.join(root,pathname);return fs.existsSync(file)?Promise.resolve(fs.readFileSync(file)):null;}}
test('dashboard lifecycle, all item controls, clearing and preview snapshot',async()=>{
 const errors=[];let writes=0,opened=null;
 const dom=new JSDOM(fs.readFileSync(path.join(root,'cv-management/index.html'),'utf8'),{url:'https://portfolio.test/cv-management/',runScripts:'dangerously',resources:new LocalResources(),pretendToBeVisual:true,beforeParse(w){
   w.URL.createObjectURL=()=> 'blob:attachment-test';w.URL.revokeObjectURL=()=>{};
   w.crypto.randomUUID=()=> 'test-preview';
   w.fetch=async(url,options={})=>{await new Promise(r=>setTimeout(r,10));if(options.method==='POST')writes++;return {ok:true,json:async()=>options.method==='POST'?{data:JSON.parse(options.body).data,version:8}:{data:raw,version:7}};};
   w.open=url=>{opened=url;return {};};w.addEventListener('error',e=>errors.push(e.message));
 }});
 const w=dom.window,doc=w.document;await new Promise(r=>setTimeout(r,80));
 assert.equal(doc.querySelectorAll('section.panel').length,13);
 assert.equal(doc.querySelector('#name').value,'Saved Person');assert.equal(doc.querySelectorAll('#repositories > .item').length,6);
 assert.equal(doc.querySelector('#siteTitle').disabled,false);
 for(const [add,group] of [['addHeroMetric','heroMetrics'],['addEducation','education'],['addCertification','certifications'],['addAward','awards'],['addCompetency','competencies'],['addExperience','experience'],['addRepository','repositories'],['addCustomSection','customSections']]){
   let n=doc.querySelectorAll('#'+group+' > .item').length;w[add]();w[add]();
   let items=doc.querySelectorAll('#'+group+' > .item');items[items.length-1].querySelector('input').value='Temporary marker';items[items.length-1].querySelector('[aria-label="Move Up"]').click();
   items=doc.querySelectorAll('#'+group+' > .item');assert.equal(items[items.length-2].querySelector('input').value,'Temporary marker');items[items.length-2].querySelector('[aria-label="Move Down"]').click();
   items=doc.querySelectorAll('#'+group+' > .item');assert.equal(items[items.length-1].querySelector('input').value,'Temporary marker');items[items.length-1].querySelector('.danger').click();
   doc.querySelectorAll('#'+group+' > .item')[n].querySelector('.danger').click();assert.equal(doc.querySelectorAll('#'+group+' > .item').length,n);
 }
 const count=doc.querySelectorAll('#orbitChips input').length;w.addOrbitChip();w.addOrbitChip();assert.equal(doc.querySelectorAll('#orbitChips input').length,count+2);w.removeOrbitChip(count+1);w.removeOrbitChip(count);assert.equal(doc.querySelectorAll('#orbitChips input').length,count);
 w.addBullet(0);w.removeBullet(0,1);assert.equal(doc.querySelectorAll('#bullets-0 input').length,1);
 for(const id of ['siteTitle','metaDescription','name','summary','knowledgeIntro','knowledgeGithubLabel','navSummary','availability'])doc.getElementById(id).value='';
 w.addEducation();for(const id of ['siteTitle','metaDescription','name','summary','knowledgeIntro','knowledgeGithubLabel','navSummary','availability'])assert.equal(doc.getElementById(id).value,'');
 const pdfBytes=Buffer.from('%PDF-1.4\nAttachment test\n%%EOF');
 const event={target:{files:[{name:'updated-resume.pdf',size:pdfBytes.length,arrayBuffer:async()=>Uint8Array.from(pdfBytes).buffer}],value:''}};
 await w.uploadAttachment('resume',event);
 assert.match(doc.getElementById('resumeAttachmentName').textContent,/updated-resume.pdf/);
 w.previewCV();assert.equal(JSON.parse(w.localStorage.getItem('aditya-kadam-cv-draft:preview:test-preview')).attachments.resume.name,'updated-resume.pdf');
 await w.uploadAttachment('resume',{target:{files:[{name:'wrong.txt',size:3,arrayBuffer:async()=>Uint8Array.from([1,2,3]).buffer}],value:''}});
 assert.match(doc.getElementById('status').textContent,/Please select a PDF/);assert.match(doc.getElementById('resumeAttachmentName').textContent,/updated-resume.pdf/);
 w.removeAttachment('coverLetter');w.previewCV();assert.equal(JSON.parse(w.localStorage.getItem('aditya-kadam-cv-draft:preview:test-preview')).attachments.coverLetter,null);
 w.restoreAttachment('coverLetter');assert.match(doc.getElementById('coverLetterAttachmentUrl').value,/Cover-Letter.pdf/);
 doc.getElementById('name').value='Preview Only';w.previewCV();assert.equal(opened,'/?preview=test-preview');assert.equal(JSON.parse(w.localStorage.getItem('aditya-kadam-cv-draft:preview:test-preview')).name,'Preview Only');assert.equal(writes,0);
 await w.saveDraft();assert.equal(writes,1);assert.match(doc.getElementById('status').textContent,/saved to database/);assert.equal(doc.getElementById('saveOverlay').classList.contains('show'),false);
 w.resetDraft();assert.equal(doc.getElementById('name').value,'Preview Only');assert.deepEqual(errors,[]);
 dom.window.close();
});

test('public Experience and Knowledge source markup is preserved',()=>{
 const {execFileSync}=require('node:child_process');
 const previous=execFileSync('git',['show','HEAD:index.html'],{cwd:root,encoding:'utf8'});
 const current=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const id of ['experience','knowledge']){
   const extract=s=>s.slice(s.indexOf('<section id="'+id+'"'),s.indexOf('</section>',s.indexOf('<section id="'+id+'"'))+10);
   assert.equal(extract(current),extract(previous));
 }
});
