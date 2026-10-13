(function(){
 const dialog=document.getElementById('publishConfirm'),form=document.getElementById('publishConfirmForm'),key=document.getElementById('publishAccessKey'),error=document.getElementById('publishConfirmError');let pending=null;
 window.confirmCVPublish=function(action){if(pending)return Promise.resolve(false);document.getElementById('publishConfirmTitle').textContent=action==='rollback'?'Restore the previous CV?':'Publish your changes?';document.getElementById('publishConfirmDescription').textContent=action==='rollback'?'This restores the previous saved database version. Your public portfolio will change.':'This updates your public portfolio with the current draft, including section order. Review Preview before publishing.';document.getElementById('confirmPublish').textContent=action==='rollback'?'Confirm rollback':'Confirm & Save';error.textContent='';dialog.showModal();return new Promise(resolve=>pending=resolve);};
 function finish(value){const resolve=pending;pending=null;dialog.close();if(!value)key.value='';if(resolve)resolve(value);}
 form.addEventListener('submit',e=>{e.preventDefault();if(!CVAdminAuth.canPublish()){error.textContent='Enter your publish authorization key to continue.';key.focus();return;}finish(true);});
 document.getElementById('cancelPublish').onclick=()=>finish(false);
 dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false);});
})();
