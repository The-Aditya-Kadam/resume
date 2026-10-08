/* Resolve legacy display-only content without changing stored CV records. */
(function(root){
  const repositories = [
    ['Natural-Language-Processing','Natural Language Processing','NLP coursework and projects.',['NLP','Text analytics']],
    ['Data-Science-with-R','Data Science with R','Analysis and modeling in R.',['R','Modeling']],
    ['Data-Science-Capstone','Data Science Capstone','End-to-end data analysis and visualization.',['Capstone','Visualization']],
    ['Machine-Learning','Machine Learning','Machine-learning coursework and models.',['ML','Models']],
    ['Tableau-Training','Tableau Training','Dashboards and visual analytics in Tableau.',['Tableau','Dashboards']],
    ['Applied-Data-Science-with-Python','Applied Data Science with Python','Python for data analysis and machine learning.',['Python','ML']]
  ].map((r,i)=>({label:'REPO '+String(i+1).padStart(2,'0'),source:'Simplilearn',path:'The-Aditya-Kadam / '+r[0],title:r[1],description:r[2],tags:r[3],url:'https://github.com/The-Aditya-Kadam/'+r[0]}));
  const proofs={rath:'rath-infotech',velocity:'velocity-media-lab/tree/main/website-list',epicenter:'epicenter-technology',futran:'fts-projects',aconnect:'Aconnect-mumbai',mob:'Formless-technology'};
  function resolve(input){
    const data=JSON.parse(JSON.stringify(input));
    data.ui=data.ui||{};
    if(!data.ui.contentSchemaVersion){
      if(!Array.isArray(data.repositories)||!data.repositories.length)data.repositories=JSON.parse(JSON.stringify(repositories));
      if(Array.isArray(data.experience))data.experience.forEach(x=>{
        const key=Object.keys(proofs).find(k=>String(x.company||'').toLowerCase().includes(k));
        if(!x.proof&&key)x.proof='https://github.com/The-Aditya-Kadam/'+proofs[key];
      });
      data.ui.knowledgeKicker='07 / Additional knowledge';
      data.ui.knowledgeTitle='DATA SCIENCE LAB.';
      data.ui.contentSchemaVersion=1;
    }
    return data;
  }
  root.CVContent={resolve};
  if(typeof module!=='undefined')module.exports=root.CVContent;
})(typeof window!=='undefined'?window:globalThis);
