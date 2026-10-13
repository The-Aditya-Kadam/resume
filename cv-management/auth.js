(function(){
  const LOGIN_PAUSED=true;
  const API='https://aditya-cv-api.onrender.com/api/auth';
  const gate=document.getElementById('authGate'),form=document.getElementById('loginForm'),message=document.getElementById('authMessage');
  const tokenKey='cv-admin-session';let start=null,token='';
  try{token=sessionStorage.getItem(tokenKey)||'';}catch{}
  const busy=document.getElementById('loadGate');
  function loading(show,text='Loading your workspace…'){busy.hidden=!show;document.getElementById('loadMessage').textContent=text;}
  function signedOut(){token='';try{sessionStorage.removeItem(tokenKey);}catch{}document.body.classList.remove('admin-authenticated');gate.hidden=false;loading(false);document.getElementById('logoutButton').hidden=true;}
  async function request(path,body){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);try{
    const r=await fetch(API+path,{method:body?'POST':'GET',cache:'no-store',signal:controller.signal,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await r.json();if(!r.ok)throw new Error(data.error||'Sign-in unavailable.');return data;
  }catch(e){if(e.name==='AbortError')throw new Error('The server is still waking up. Try again.');throw e;}finally{clearTimeout(timer);}}
  async function check(){loading(true,'Connecting securely…');try{const s=await request('/status');
    const setupView=!s.configured&&(new URLSearchParams(location.search).get('setup')==='1'||form.dataset.ownerSetup==='true');
    document.getElementById('setupFields').hidden=!setupView;document.getElementById('ownerSetupToken').required=setupView;document.getElementById('adminPassword').autocomplete=setupView?'new-password':'current-password';document.getElementById('adminPassword').minLength=setupView?6:0;form.dataset.setup=String(setupView);document.getElementById('loginTitle').textContent=setupView?'Set up your private workspace.':'Welcome back.';
    document.getElementById('signInButton').textContent=setupView?'Create owner account':'Sign in';
    document.getElementById('ownerSetupLink').hidden=s.configured||setupView;
    if(s.authenticated){gate.hidden=true;document.body.classList.add('admin-authenticated');document.getElementById('logoutButton').hidden=false;await start();}else signedOut();
  }catch(e){signedOut();message.textContent=e.message;}finally{loading(false);}}
  form.addEventListener('submit',async e=>{e.preventDefault();const button=document.getElementById('signInButton');button.disabled=true;message.textContent='';loading(true,'Signing in securely…');try{
    const data=await request(form.dataset.setup==='true'?'/setup':'/login',{username:document.getElementById('adminUsername').value,password:document.getElementById('adminPassword').value,setupToken:document.getElementById('ownerSetupToken').value});
    token=data.token;try{sessionStorage.setItem(tokenKey,token);}catch{}document.getElementById('adminPassword').value='';document.getElementById('ownerSetupToken').value='';await check();
  }catch(e){message.textContent=e.message;loading(false);}finally{button.disabled=false;}});
  document.getElementById('retryAuth').addEventListener('click',check);
  document.getElementById('logoutButton').addEventListener('click',async()=>{try{await request('/logout',{});}catch(e){message.textContent='Signed out on this device. The server could not be reached.';}finally{signedOut();}});
  window.CVAdminAuth={headers:()=>{const key=document.getElementById('publishAccessKey')?.value||'';return {...(token?{Authorization:'Bearer '+token}:{}),...(key?{'X-CV-Publish-Key':key}:{})};},canPublish:()=>window.CV_TEST_TRANSPORT===true||!!token||!!document.getElementById('publishAccessKey')?.value,expired:()=>{if(LOGIN_PAUSED){token='';try{sessionStorage.removeItem(tokenKey);}catch{}gate.hidden=true;document.body.classList.add('admin-authenticated');loading(false);}else{signedOut();message.textContent='Your session expired. Sign in again.';}},
    ready:callback=>{start=callback;if(LOGIN_PAUSED){gate.hidden=true;loading(false);document.body.classList.add('admin-authenticated');document.getElementById('logoutButton').hidden=true;return callback();}if(window.CV_TEST_TRANSPORT===true){gate.hidden=true;loading(false);document.body.classList.add('admin-authenticated');return callback();}return check();},loading};
})();
