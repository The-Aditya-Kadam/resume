(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CVThemes=api;})(typeof window!=='undefined'?window:globalThis,function(){
 const catalog=[{id:'orbit',name:'Orbit',description:'Your original 3D portfolio.'},{id:'professional',name:'Professional',description:'Editorial typography and a clean career layout.'},{id:'studio',name:'Studio',description:'Soft gradients, bold spacing and modern cards.'}];
 function resolve(id){return catalog.some(t=>t.id===id)?id:'orbit';}
 function apply(doc,id){const chosen=resolve(id);doc.documentElement.setAttribute('data-theme',chosen);return chosen;}
 return {catalog,resolve,apply};
});
