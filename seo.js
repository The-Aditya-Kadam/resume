(function(){
  "use strict";
  var preview=new URLSearchParams(location.search).has("preview");
  var published=location.hostname==="aditya-kadam-resume.onrender.com";
  if(preview||!published){document.querySelector('meta[name="robots"]').content="noindex,follow";}
  var initialDescription=document.querySelector('meta[name="description"]').content;
  function update(){
    var description=document.querySelector('meta[name="description"]');
    // A cleared optional SEO field uses visible page content without changing its saved value.
    if(!description.content.trim())description.content=(document.querySelector('.hero .lead')?.textContent||initialDescription).trim().slice(0,300);
    if(!document.title.trim())document.title=(document.querySelector('.hero h1')?.textContent||'Aditya Kadam')+' | Portfolio';
    ['og:title','twitter:title'].forEach(function(key){document.querySelector('meta[property="'+key+'"],meta[name="'+key+'"]').content=document.title;});
    ['og:description','twitter:description'].forEach(function(key){document.querySelector('meta[property="'+key+'"],meta[name="'+key+'"]').content=description.content;});
    var schema=document.getElementById('profileSchema');
    var data=JSON.parse(schema.textContent);
    data.mainEntity.name=(document.querySelector('.hero h1')?.innerText||'Aditya Kadam').replace(/\s+/g,' ').trim();
    data.mainEntity.jobTitle=(document.querySelector('.hero .now b')?.textContent||'').trim();
    data.mainEntity.sameAs=Array.from(document.querySelectorAll('#contact .ctile')).map(function(a){return a.href;}).filter(function(url){return /^https:\/\/(www\.)?(github\.com|linkedin\.com)\//.test(url);});
    schema.textContent=JSON.stringify(data);
  }
  document.addEventListener('cv:ready',update);
  update();
})();
