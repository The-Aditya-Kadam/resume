/* Single lifecycle for the published document and temporary browser draft. */
(function(){
  // A cached directory page may predate the attachment scripts.
  if(!document.getElementById('resumeAttachmentUrl') && !new URLSearchParams(location.search).has('cvRelease')){
    location.replace('/cv-management/index.html?cvRelease=attachments-20261008');
    return;
  }
  const API='https://aditya-cv-api.onrender.com/api/cv';
  let version=null, published=null, busy=false;
  const originalRender=render;
  const status=message=>{document.getElementById('status').textContent=message;};
  function rememberDraft(){
    try{localStorage.setItem(KEY,JSON.stringify(cv));}
    catch(error){console.warn('Browser draft cache unavailable; the current form remains usable.',error);}
  }
  const fields=['name','role','location','phone','email','linkedin','github','portfolio','targetLocations','summary'];
  function normalize(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('A CV JSON object is required.');
    const d=clone(input);
    for(const key of ['site','ui'])if(d[key]!=null&&(typeof d[key]!=='object'||Array.isArray(d[key])))throw new Error('Invalid '+key+' object.');
    for(const key of ['education','certifications','awards','competencies','experience','repositories','customSections']){
      if(d[key]!=null&&(!Array.isArray(d[key])||d[key].some(x=>!x||typeof x!=='object'||Array.isArray(x))))throw new Error('Invalid '+key+' list.');
      d[key]=d[key]??clone(base[key]||[]);
    }
    if(window.CVAttachments)d.attachments=CVAttachments.normalize(d.attachments);
    d.site={...base.site,...d.site};
    d.ui={...base.ui,...d.ui,nav:{...base.ui.nav,...d.ui?.nav}};
    for(const key of fields)d[key]=d[key]??base[key]??'';
    for(const key of ['heroMetrics','orbitChips'])if(!Array.isArray(d.ui[key]))throw new Error('Invalid '+key+' list.');
    d.ui.heroMetrics.forEach(x=>{if(!x||typeof x!=='object'||Array.isArray(x))throw new Error('Invalid hero metric.');});
    d.experience.forEach(x=>{if(x.bullets!=null&&!Array.isArray(x.bullets))throw new Error('Invalid responsibilities list.');x.bullets=x.bullets||[];});
    d.repositories.forEach(x=>{if(x.tags!=null&&!Array.isArray(x.tags))throw new Error('Invalid repository tags.');x.tags=x.tags||[];});
    return CVContent.resolve(d);
  }
  function controls(disabled){
    busy=disabled;
    document.querySelectorAll('button,input,textarea,select').forEach(el=>{el.disabled=disabled;});
    document.querySelector('.wrap').setAttribute('aria-busy',String(disabled));
  }
  window.setAttachmentBusy=controls;
  render=function(){
    originalRender();
    document.querySelectorAll('label').forEach((label,i)=>{
      const input=label.parentElement.querySelector('input,textarea,select');
      if(input){if(!input.id)input.id='cv-field-'+i;label.htmlFor=input.id;}
    });
    document.querySelectorAll('.row-actions button').forEach(button=>{
      if(button.textContent==='↑')button.setAttribute('aria-label','Move Up');
      if(button.textContent==='↓')button.setAttribute('aria-label','Move Down');
    });
    controls(busy);
  };
  function updateFlags(){
    if(!published)return;
    if(JSON.stringify(cv.experience)!==JSON.stringify(published.experience)||['experienceKicker','experienceTitle'].some(k=>cv.ui[k]!==published.ui[k]))cv.ui.experienceEdited=true;
    const knowledgeKeys=['knowledgeIntro','knowledgeGithubLabel','knowledgeTitle','knowledgeKicker'];
    if(JSON.stringify(cv.repositories)!==JSON.stringify(published.repositories)||knowledgeKeys.some(k=>cv.ui[k]!==published.ui[k]))cv.ui.knowledgeEdited=true;
  }
  async function request(method='GET',body,pathname=''){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),90000);
    try{
      const response=await fetch(API+pathname,{method,cache:'no-store',signal:controller.signal,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'CV request failed ('+response.status+').');
      return result;
    }catch(error){if(error.name==='AbortError')throw new Error('CV request timed out. Try Load Published again.');throw error;}
    finally{clearTimeout(timeout);}
  }
  window.loadPublished=async function(){
    if(busy)return;
    controls(true);status('Loading published CV data…');
    try{
      const result=await request();
      cv=normalize(result.data);published=clone(cv);version=result.version;
      rememberDraft();
      render();status('✓ Database CV loaded. Version '+version+'.');
    }catch(error){status('Load failed: '+error.message);}
    finally{controls(false);if(!cv)document.querySelectorAll('button').forEach(b=>{if(b.textContent!=='Load Published')b.disabled=true;});}
  };
  window.saveDraft=async function(){
    if(busy||!cv)return;
    sync();updateFlags();
    let submitted;
    try{submitted=normalize(cv);}catch(error){status("Save failed: "+error.message);return;}
    controls(true);
    const overlay=document.getElementById('saveOverlay');
    overlay.classList.add('show');document.body.style.overflow='hidden';
    document.getElementById('saveMessage').textContent='Saving your CV to PostgreSQL…';
    status('Saving changes to database…');
    try{
      const saved=await request('POST',{data:submitted,expectedVersion:version});
      version=saved.version;
      cv=normalize(saved.data||submitted);published=clone(cv);
      rememberDraft();
      render();status('✓ CV saved to database. Version '+version+'.');
    }catch(error){status('Save failed: '+error.message);}
    finally{overlay.classList.remove('show');document.body.style.overflow='';controls(false);}
  };
  window.rollbackDraft=async function(){
    if(busy||!cv||!confirm('Rollback the CV to the previous saved database version?'))return;
    controls(true);
    try{const result=await request('POST',{expectedVersion:version},'/rollback');cv=normalize(result.data);published=clone(cv);version=result.version;render();status('✓ Rolled back to database version '+version+'.');}
    catch(error){status('Rollback failed: '+error.message);}
    finally{controls(false);}
  };
  window.resetDraft=function(){
    if(busy||!published)return;
    cv=clone(published);rememberDraft();render();status('Draft reset to the loaded published CV.');
  };
  window.previewCV=function(){
    if(busy||!cv)return;
    sync();updateFlags();
    const token=crypto.randomUUID();
    try{
      const snapshot=JSON.stringify(normalize(cv));
      try{localStorage.setItem(KEY+':preview:'+token,snapshot);}
      catch(error){
        if(error.name!=='QuotaExceededError')throw error;
        Object.keys(localStorage).filter(k=>k.startsWith(KEY+':preview:')).forEach(k=>localStorage.removeItem(k));
        localStorage.setItem(KEY+':preview:'+token,snapshot);
      }
    }catch(error){status('Preview failed: '+error.message);return;}
    const popup=window.open('/?preview='+encodeURIComponent(token),'_blank');
    if(!popup)status('Preview was blocked by the browser. Allow popups to preview your CV.');
  };
  window.exportJSON=function(){
    if(busy||!cv)return;
    sync();updateFlags();
    const href=URL.createObjectURL(new Blob([JSON.stringify(cv,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=href;a.download='aditya-kadam-cv.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
  };
  window.importJSON=async function(event){
    const file=event.target.files[0];event.target.value='';
    if(busy||!file)return;
    try{
      if(file.size>2000000)throw new Error('JSON file is too large (maximum 2 MB).');
      const imported=normalize(JSON.parse(await file.text()));
      cv=imported;updateFlags();rememberDraft();render();status('Imported CV draft. Preview or Save CV to Database when ready.');
    }catch(error){status('Import failed: '+error.message);}
  };
  // Initialization does not run twice and editing stays disabled until data exists.
  loadPublished();
})();
