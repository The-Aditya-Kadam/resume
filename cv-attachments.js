/* Shared attachment schema for the CV editor, portfolio and API. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CVAttachments=factory();})(typeof window==='object'?window:globalThis,function(){
  const MAX_PDF_BYTES=512000;
  const defaults={resume:{name:'Aditya-Kadam-Resume.pdf',url:'/assets/logos/Aditya-Kadam-Resume.pdf'},coverLetter:{name:'Aditya-Kadam-Cover-Letter.pdf',url:'/assets/logos/Aditya-Kadam-Cover-Letter.pdf'}};
  function filename(value,fallback){let name=String(value||fallback).replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,120);return /\.pdf$/i.test(name)?name:name+'.pdf';}
  function normalize(input){
    if(input!=null&&(typeof input!=='object'||Array.isArray(input)))throw new Error('Invalid attachments object.');
    const output={};
    for(const key of Object.keys(defaults)){
      const item=input&&Object.prototype.hasOwnProperty.call(input,key)?input[key]:defaults[key];
      if(item==null){output[key]=null;continue;}
      if(typeof item!=='object'||Array.isArray(item))throw new Error('Invalid '+key+' attachment.');
      const name=filename(item.name,defaults[key].name);
      if(item.dataUrl){
        const match=/^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/.exec(item.dataUrl);
        if(!match||!match[1].startsWith('JVBERi0')||match[1].length%4!==0)throw new Error('Attachment must contain a valid PDF.');
        const size=match[1].length*3/4-(match[1].endsWith('==')?2:match[1].endsWith('=')?1:0);
        if(size>MAX_PDF_BYTES)throw new Error('PDF exceeds 500 KB. Use a hosted PDF link for larger files.');
        output[key]={name,dataUrl:item.dataUrl};
      }else{
        const url=String(item.url||'').trim();
        if(!url){output[key]=null;continue;}
        if(!(/^\/(?!\/)/.test(url)||/^https:\/\//i.test(url))||/[\s\\\u0000-\u001f]/.test(url))throw new Error('Attachment link must be HTTPS or a site path.');
        if(/^https:/i.test(url)){const parsed=new URL(url);if(parsed.username||parsed.password)throw new Error('Attachment link cannot contain credentials.');}
        output[key]={name,url};
      }
    }
    return output;
  }
  function blobUrl(item){
    if(item.url)return item.url;
    const binary=atob(item.dataUrl.split(',')[1]);
    const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  }
  return {defaults,MAX_PDF_BYTES,normalize,blobUrl};
});
