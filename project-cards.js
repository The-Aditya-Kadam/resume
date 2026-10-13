(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CVProjectCards=api;})(typeof window!=='undefined'?window:globalThis,function(){
  function url(value){try{const u=new URL(String(value||''));return u.protocol==='https:'?u.href:'';}catch{return '';}}
  function normalizeProjects(value){if(!Array.isArray(value))throw new Error('Invalid projects list.');return value.map(x=>{if(!x||typeof x!=='object'||Array.isArray(x))throw new Error('Invalid project card.');return {...x,id:String(x.id||''),title:String(x.title||''),description:String(x.description||''),githubUrl:url(x.githubUrl),setupUrl:url(x.setupUrl),demoUrl:url(x.demoUrl),private:Boolean(x.private),tags:Array.isArray(x.tags)?x.tags.map(String):[]};});}
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  function render(value){return normalizeProjects(value||[]).map((x,i)=>{
    const link=(href,label)=>'<a class="repo-link" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(label+' — '+x.title)+'">'+esc(label)+' <span aria-hidden="true">↗</span></a>';
    const links=x.private?'<a class="repo-link" href="#contact" aria-label="Request code access — '+esc(x.title)+'">Request code access ↗</a>':(x.githubUrl?link(x.githubUrl,'View code'):'')+(x.setupUrl?link(x.setupUrl,'Setup on GitHub'):'');
    return '<article class="panel repo project-card" data-project-id="'+esc(x.id)+'"><div class="panel-head"><span class="panel-icon">•</span><span class="panel-label">PROJECT '+String(i+1).padStart(2,'0')+'</span><span class="panel-meta">'+(x.private?'Private source':'Public source')+'</span></div><div class="repo-body"><h3>'+esc(x.title)+'</h3><p>'+esc(x.description)+'</p><div class="repo-tags">'+x.tags.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div>'+(!x.demoUrl?'<p class="project-note">'+(x.private?'Browser extension · no hosted demo':'No live demo provided')+'</p>':'')+'</div><div class="project-links">'+links+(x.demoUrl?link(x.demoUrl,'Live demo'):'')+'</div></article>';
  }).join('');}
  return {url,normalizeProjects,render};
});
