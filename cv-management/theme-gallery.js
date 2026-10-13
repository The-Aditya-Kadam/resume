(function(){
 const gallery=document.getElementById('themeGallery'),select=document.getElementById('themeId');
 window.renderThemeGallery=function(){const chosen=CVThemes.resolve(select.value);gallery.querySelectorAll('[data-theme-choice]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.themeChoice===chosen));button.querySelector('.theme-choice-state').textContent=button.dataset.themeChoice===chosen?'Selected':'Select theme';});};
 gallery.addEventListener('click',e=>{const button=e.target.closest('[data-theme-choice]');if(!button||button.disabled)return;sync();select.value=button.dataset.themeChoice;cv.ui.themeId=select.value;renderThemeGallery();document.getElementById('status').textContent=button.dataset.themeChoice+' selected in draft. Preview before publishing.';});
 select.addEventListener('change',()=>{sync();renderThemeGallery();});
})();
