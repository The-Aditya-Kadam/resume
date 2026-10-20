const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
const script=fs.readFileSync(require.resolve('../seo.js'),'utf8');
test('metadata follows CV copy without disclosure labels, preserves custom SEO and separates name words',()=>{
 const dom=new JSDOM(html,{url:'https://aditya-kadam-resume.onrender.com/',runScripts:'outside-only'});
 const {window:w}=dom,d=w.document;
 w.eval(script);
 const cv={name:'ADITYA KADAM',role:'Assistant Technical Project Manager',summary:'Assistant Technical Project Manager with 10+ years in web engineering. Skilled in WordPress.'};
 const original=JSON.stringify(cv);
 d.querySelector('.hero h1').innerHTML='<span>ADITYA</span><span>KADAM</span>';
 d.querySelector('.hero .lead').textContent='Explore my approach Project delivery';
 d.title='Aditya Kadam | Assistant Technical Project Manager';
 d.querySelector('meta[name=description]').content='';
 d.dispatchEvent(new w.CustomEvent('cv:ready',{detail:{data:cv}}));
 const description=d.querySelector('meta[name=description]').content;
 assert.match(description,/ADITYA KADAM résumé/);assert.match(description,/10\+ years/);
 assert.doesNotMatch(description,/Explore|Project delivery/);
 assert.equal(d.title,'Aditya Kadam Resume | Assistant Technical Project Manager');
 assert.equal(d.querySelector('meta[property="og:title"]').content,d.title);
 assert.equal(d.querySelector('meta[name="twitter:description"]').content,description);
 const schema=JSON.parse(d.getElementById('profileSchema').textContent);
 assert.equal(schema.mainEntity.name,'ADITYA KADAM');assert.equal(schema.mainEntity.jobTitle,cv.role);
 assert.equal(schema.description,description);assert.equal(JSON.stringify(cv),original);
 d.title='My custom CV title';d.querySelector('meta[name=description]').content='My custom description';
 d.dispatchEvent(new w.CustomEvent('cv:ready',{detail:{data:cv}}));
 assert.equal(d.title,'My custom CV title');assert.equal(d.querySelector('meta[name=description]').content,'My custom description');
 dom.window.close();
});
test('preview and alternate hosts stay noindex; homepage retains one canonical and crawlable HTML',()=>{
 for(const url of ['https://aditya-kadam-resume.onrender.com/?preview=token','https://preview.example/']){
   const dom=new JSDOM(html,{url,runScripts:'outside-only'});dom.window.eval(script);
   assert.match(dom.window.document.querySelector('meta[name=robots]').content,/noindex/);dom.window.close();
 }
 const dom=new JSDOM(html),d=dom.window.document;
 assert.equal(d.querySelectorAll('link[rel=canonical]').length,1);
 assert.equal(d.querySelector('link[rel=canonical]').href,'https://aditya-kadam-resume.onrender.com/');
 assert.equal(d.querySelectorAll('h1').length,1);assert.ok(d.querySelector('#experience').textContent.includes('Rath Infotech'));
 assert.match(d.title,/Aditya Kadam Resume/);dom.window.close();
});
