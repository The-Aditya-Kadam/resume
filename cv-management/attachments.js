/* Uploads stay in the draft until the user saves the CV. */
(function(){
  const originalRender=render,originalSync=sync;
  let urls=[];
  function attachmentStatus(message){document.getElementById('status').textContent=message;}
  sync=function(){
    originalSync();
    for(const key of ['resume','coverLetter']){
      const value=document.getElementById(key+'AttachmentUrl').value.trim();
      const existing=cv.attachments[key];
      if(value!==(existing?.url||''))cv.attachments[key]=value?{name:CVAttachments.defaults[key].name,url:value}:null;
    }
  };
  render=function(){
    originalRender();
    urls.forEach(url=>URL.revokeObjectURL(url));urls=[];
    cv.attachments=CVAttachments.normalize(cv.attachments);
    for(const key of ['resume','coverLetter']){
      const item=cv.attachments[key];
      document.getElementById(key+'AttachmentUrl').value=item?.url||'';
      document.getElementById(key+'AttachmentName').textContent=item?item.name+(item.dataUrl?' (uploaded PDF)':''):'No attachment — download button will be hidden';
      const link=document.getElementById(key+'AttachmentPreview');
      link.hidden=!item;
      if(item){link.href=CVAttachments.blobUrl(item);if(item.dataUrl)urls.push(link.href);}else link.removeAttribute('href');
    }
  };
  window.uploadAttachment=async function(key,event){
    const file=event.target.files[0];event.target.value='';
    if(!file||!cv)return;
    sync();const before=cv;
    try{
      if(file.size>CVAttachments.MAX_PDF_BYTES)throw new Error('PDF exceeds 500 KB. Use a hosted PDF link for larger files.');
      window.setAttachmentBusy?.(true);
      attachmentStatus('Reading PDF into the draft…');
      const bytes=new Uint8Array(await file.arrayBuffer());
      if(String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw new Error('Please select a PDF file.');
      let binary='';for(let i=0;i<bytes.length;i+=4096)binary+=String.fromCharCode(...bytes.subarray(i,i+4096));
      const item={name:file.name,dataUrl:'data:application/pdf;base64,'+btoa(binary)};
      const validated=CVAttachments.normalize({[key]:item})[key];
      if(cv!==before)throw new Error('The draft changed. Select the PDF again.');
      cv.attachments[key]=validated;render();attachmentStatus('PDF added to draft. Preview or Save CV to Database when ready.');
    }catch(error){attachmentStatus('Attachment update failed: '+error.message);}
    finally{window.setAttachmentBusy?.(false);}
  };
  window.updateAttachmentLink=function(){sync();try{cv.attachments=CVAttachments.normalize(cv.attachments);render();attachmentStatus('Attachment link updated in draft.');}catch(error){attachmentStatus('Attachment update failed: '+error.message);}};
  window.removeAttachment=function(key){sync();cv.attachments[key]=null;render();attachmentStatus('Attachment removed from draft. Save to hide its public download button.');};
  window.restoreAttachment=function(key){sync();cv.attachments[key]={...CVAttachments.defaults[key]};render();attachmentStatus('Original attachment restored in draft.');};
})();
