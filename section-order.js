(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CVSectionOrder=api;})(typeof window!=='undefined'?window:globalThis,function(){
  const ids=['summary','education','skills','experience','knowledge','projects','customCVSections','contact'];
  const labels={summary:'Summary',education:'Education, certifications & achievements',skills:'Skills',experience:'Experience',knowledge:'Knowledge',projects:'Projects & Tools',customCVSections:'Custom sections',contact:'Contact'};
  function normalize(value){const result=[];for(const id of Array.isArray(value)?value:[])if(ids.includes(id)&&!result.includes(id))result.push(id);return result.concat(ids.filter(id=>!result.includes(id)));}
  function apply(doc,value){const order=normalize(value),nodes=order.map(id=>doc.getElementById(id)).filter(Boolean);if(!nodes.length)return;const parent=nodes[0].parentNode;if(nodes.some(n=>n.parentNode!==parent))return;const marker=doc.createComment('portfolio section order');parent.insertBefore(marker,nodes.reduce((first,n)=>first.compareDocumentPosition(n)&2?n:first));for(const n of nodes)parent.insertBefore(n,marker);marker.remove();return order;}
  return {ids,labels,normalize,apply};
});
