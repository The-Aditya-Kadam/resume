(function(){
  'use strict';
  if(location.origin!=='https://aditya-kadam-resume.onrender.com')return;
  var key='resume-visit-alert-session',ttl=30*60*1000;
  async function notify(){
    if(document.visibilityState!=='visible')return;
    document.removeEventListener('visibilitychange',notify);
    try{
      var record=JSON.parse(localStorage.getItem(key)||'null'),time=Date.now();
      if(record&&time-record.created<ttl)return;
      var sessionId=crypto.randomUUID();
      // Save before sending to suppress refresh duplicates. Tracking never blocks rendering.
      localStorage.setItem(key,JSON.stringify({created:time,sessionId:sessionId}));
      await fetch('https://aditya-cv-api.onrender.com/api/visit-alert',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({sessionId:sessionId}),credentials:'omit',keepalive:true
      });
    }catch(e){/* Storage/network restrictions must not affect the resume. */}
  }
  if(document.visibilityState==='visible')notify();
  else document.addEventListener('visibilitychange',notify);
})();
