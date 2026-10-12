(function(){
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
    document.getElementById('setupFields').hidden=s.configured;document.getElementById('ownerSetupToken').required=!s.configured;document.getElementById('adminPassword').autocomplete=s.configured?'current-password':'new-password';form.dataset.setup=String(!s.configured);document.getElementById('loginTitle').textContent=s.configured?'Welcome back.':'Set up your private workspace.';
    document.getElementById('signInButton').textContent=s.configured?'Sign in':'Create owner account';
    if(s.authenticated){gate.hidden=true;document.body.classList.add('admin-authenticated');document.getElementById('logoutButton').hidden=false;await start();}else signedOut();
  }catch(e){signedOut();message.textContent=e.message;}finally{loading(false);}}
  form.addEventListener('submit',async e=>{e.preventDefault();const button=document.getElementById('signInButton');button.disabled=true;message.textContent='';loading(true,'Signing in securely…');try{
    const data=await request(form.dataset.setup==='true'?'/setup':'/login',{username:document.getElementById('adminUsername').value,password:document.getElementById('adminPassword').value,setupToken:document.getElementById('ownerSetupToken').value});
    token=data.token;try{sessionStorage.setItem(tokenKey,token);}catch{}document.getElementById('adminPassword').value='';document.getElementById('ownerSetupToken').value='';await check();
  }catch(e){message.textContent=e.message;loading(false);}finally{button.disabled=false;}});
  document.getElementById('retryAuth').addEventListener('click',check);
  document.getElementById('logoutButton').addEventListener('click',async()=>{try{await request('/logout',{});}finally{signedOut();}});
  window.CVAdminAuth={headers:()=>token?{Authorization:'Bearer '+token}:{},expired:()=>{signedOut();message.textContent='Your session expired. Sign in again.';},
    ready:callback=>{start=callback;if(window.CV_TEST_TRANSPORT===true){gate.hidden=true;loading(false);document.body.classList.add('admin-authenticated');return callback();}return check();},loading};
})();
