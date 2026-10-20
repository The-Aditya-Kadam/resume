(function(){
  "use strict";
  var preview=new URLSearchParams(location.search).has("preview");
  var published=location.hostname==="aditya-kadam-resume.onrender.com";
  if(preview||!published){document.querySelector('meta[name="robots"]').content="noindex,follow";}
  var initialDescription=document.querySelector('meta[name="description"]').content;
  function update(event){
    var cv=event?.detail?.data;
    var h1=document.querySelector('.hero h1');
    var name=cv?.name || (h1?Array.from(h1.querySelectorAll('span')).map(function(span){return span.textContent;}).join(' '):'Aditya Kadam');
    name=String(name).replace(/\s+/g,' ').replace(/[.]+$/,'').trim()||'Aditya Kadam';
    var description=document.querySelector('meta[name="description"]');
    // Read CV copy, never disclosure buttons or presentation labels. Saved fields stay untouched.
    if(!description.content.trim()){
      var summary=String(cv?.summary||document.querySelector('.hero [data-hero-copy]')?.textContent||'').replace(/\s+/g,' ').trim();
      var sentence=summary.match(/^.*?[.!?](?=\s|$)/)?.[0]||summary;
      var fallback=sentence?name+' résumé. '+sentence:initialDescription;
      description.content=fallback.length>190?fallback.slice(0,187).replace(/\s+\S*$/,'')+'…':fallback;
    }
    if(document.title==='Aditya Kadam | Assistant Technical Project Manager')document.title='Aditya Kadam Resume | Assistant Technical Project Manager';
    if(!document.title.trim())document.title=name+' | Resume';
    ['og:title','twitter:title'].forEach(function(key){document.querySelector('meta[property="'+key+'"],meta[name="'+key+'"]').content=document.title;});
    ['og:description','twitter:description'].forEach(function(key){document.querySelector('meta[property="'+key+'"],meta[name="'+key+'"]').content=description.content;});
    var schema=document.getElementById('profileSchema');
    var data=JSON.parse(schema.textContent);
    data.name=document.title;
    data.description=description.content;
    data.mainEntity.name=name;
    data.mainEntity.jobTitle=String(cv?.role||document.querySelector('.hero .now b')?.textContent||'').trim();
    data.mainEntity.description=description.content;
    data.mainEntity.sameAs=Array.from(document.querySelectorAll('#contact .ctile')).map(function(a){return a.href;}).filter(function(url){return /^https:\/\/(www\.)?(github\.com|linkedin\.com)\//.test(url);});
    schema.textContent=JSON.stringify(data);
  }
  document.addEventListener('cv:ready',update);
  update();
})();
