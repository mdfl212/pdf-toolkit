export function calculateImagePageLayout(imageWidth, imageHeight, pageWidth, pageHeight, fit = 'contain', margin = 0) {
  for (const value of [imageWidth, imageHeight, pageWidth, pageHeight, margin]) {
    if (!Number.isFinite(value) || value < 0) throw new TypeError('Image and page dimensions must be non-negative finite numbers.');
  }
  if (!imageWidth || !imageHeight || pageWidth <= margin * 2 || pageHeight <= margin * 2) throw new RangeError('Image dimensions and usable page dimensions must be greater than zero.');
  const availableWidth = pageWidth - margin * 2, availableHeight = pageHeight - margin * 2;
  const scale = (fit === 'cover' ? Math.max : Math.min)(availableWidth / imageWidth, availableHeight / imageHeight);
  const width = imageWidth * scale, height = imageHeight * scale;
  return { x:(pageWidth-width)/2, y:(pageHeight-height)/2, width, height };
}
export function reorderImageItems(items, fromIndex, toIndex) {
  if (!Array.isArray(items)) throw new TypeError('Image items must be an array.');
  if (![fromIndex,toIndex].every(Number.isInteger) || fromIndex<0 || toIndex<0 || fromIndex>=items.length || toIndex>=items.length) throw new RangeError('Image reorder index is outside the selected list.');
  const next=[...items], [item]=next.splice(fromIndex,1); next.splice(toIndex,0,item); return next;
}
const $ = id => document.getElementById(id);
const imageTypes = new Set(['image/jpeg','image/png','image/webp','image/gif','image/bmp','image/tiff','image/heic','image/heif']);
let items=[], busy=false, objectUrls=new Set();
function releaseUrl(url){if(url&&objectUrls.has(url)){URL.revokeObjectURL(url);objectUrls.delete(url);}}
function isImageFile(file){const ext=String(file?.name||'').split('.').pop().toLowerCase();return imageTypes.has(file?.type)||['jpg','jpeg','png','webp','gif','bmp','tif','tiff','heic','heif'].includes(ext);}
function setStatus(message,error=false){const node=$('image-pdf-status');node.textContent=message||'';node.hidden=!message;node.dataset.error=error?'true':'false';}
function renderItems(){
  const list=$('image-pdf-list');list.replaceChildren();
  items.forEach((item,index)=>{
    const row=document.createElement('article');row.className='image-pdf-item';
    const img=document.createElement('img');img.src=item.previewUrl;img.alt='';
    const info=document.createElement('div');info.className='image-pdf-item-info';
    const name=document.createElement('strong');name.textContent=item.file.name;
    const meta=document.createElement('span');meta.textContent=(item.width&&item.height?item.width+' × '+item.height+' px · ':'')+(item.file.size/1048576).toFixed(2)+' MB';info.append(name,meta);
    const actions=document.createElement('div');actions.className='image-pdf-item-actions';
    const up=document.createElement('button');up.type='button';up.className='btn btn-secondary btn-sm';up.textContent='↑';up.title='Move image up';up.disabled=busy||index===0;up.addEventListener('click',()=>moveItem(index,index-1));
    const down=document.createElement('button');down.type='button';down.className='btn btn-secondary btn-sm';down.textContent='↓';down.title='Move image down';down.disabled=busy||index===items.length-1;down.addEventListener('click',()=>moveItem(index,index+1));
    const remove=document.createElement('button');remove.type='button';remove.className='btn btn-secondary btn-sm';remove.textContent='Remove';remove.disabled=busy;remove.addEventListener('click',()=>removeItem(item.id));
    actions.append(up,down,remove);row.append(img,info,actions);list.append(row);
  });
  $('image-pdf-count').textContent=items.length+' image'+(items.length===1?'':'s')+' selected';
  $('image-pdf-run').disabled=busy||!items.length;$('image-pdf-clear').disabled=busy||!items.length;
}
function moveItem(from,to){items=reorderImageItems(items,from,to);renderItems();}
function removeItem(id){const item=items.find(entry=>entry.id===id);if(item)releaseUrl(item.previewUrl);items=items.filter(entry=>entry.id!==id);renderItems();}
async function addFiles(files){
  const incoming=Array.from(files||[]).filter(isImageFile);
  if(!incoming.length){setStatus('Choose supported image files (JPEG, PNG, WebP, GIF, BMP, TIFF or HEIC/HEIF).',true);return;}
  const known=new Set(items.map(item=>item.file));
  for(const file of incoming){if(known.has(file))continue;const previewUrl=URL.createObjectURL(file);objectUrls.add(previewUrl);let width=0,height=0;try{const bitmap=await createImageBitmap(file);width=bitmap.width;height=bitmap.height;bitmap.close?.();}catch(_){}items.push({id:'img-'+Math.random().toString(36).slice(2,10),file,previewUrl,width,height});}
  $('image-pdf-input').value='';setStatus(incoming.length+' image file'+(incoming.length===1?'':'s')+' added. Review and arrange the order before creating the PDF.');renderItems();
}
function addUI(){
  if($('panel-image-pdf'))return;
  const quick=[...document.querySelectorAll('.tool-section')].find(section=>section.querySelector('[data-panel="pdf-images"]'));
  if(quick){const button=document.createElement('button');button.type='button';button.className='tool-btn';button.dataset.panel='image-pdf';button.textContent='🖼️ Images to PDF';quick.insertBefore(button,quick.querySelector('[data-panel="pdf-images"]'));}
  const mobile=$('mobile-tools-grid');
  if(mobile){const button=document.createElement('button');button.type='button';button.className='mobile-tool-card';button.dataset.panel='image-pdf';button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg><span>Images to PDF</span>';const before=mobile.querySelector('[data-panel="pdf-images"]');if(before)mobile.insertBefore(button,before);else mobile.append(button);}
  const panel=document.createElement('section');panel.className='panel';panel.id='panel-image-pdf';
  panel.innerHTML=[
    '<h2>Images to PDF</h2>',
    '<p class="subtitle">Combine multiple pictures into one PDF. Preview, reorder and remove images before conversion. Everything runs locally in this browser.</p>',
    '<div class="drop-zone" id="image-pdf-drop"><div class="drop-icon">🖼️</div><p><strong>Drop images here</strong> or click to browse</p><p class="hint">JPEG, PNG, WebP, GIF, BMP, TIFF and HEIC/HEIF when your browser can decode them</p><input id="image-pdf-input" type="file" accept="image/*,.tif,.tiff,.heic,.heif" multiple hidden></div>',
    '<div class="image-pdf-toolbar"><strong id="image-pdf-count">0 images selected</strong><div><button type="button" class="btn btn-secondary btn-sm" id="image-pdf-add">Add images</button> <button type="button" class="btn btn-secondary btn-sm" id="image-pdf-clear" disabled>Clear all</button></div></div>',
    '<div id="image-pdf-list" class="image-pdf-list" aria-live="polite"></div>',
    '<div class="controls image-pdf-controls"><div class="control-group"><label for="image-pdf-size">Page size</label><select id="image-pdf-size"><option value="a4">A4</option><option value="letter">US Letter</option><option value="fit">Fit page to each image</option></select></div><div class="control-group"><label for="image-pdf-fit">Image placement</label><select id="image-pdf-fit"><option value="contain">Fit entire image (no crop)</option><option value="cover">Fill page (may crop edges)</option></select></div><div class="control-group"><label for="image-pdf-margin">Page margin</label><select id="image-pdf-margin"><option value="0">None</option><option value="12" selected>12 pt</option><option value="24">24 pt</option></select></div></div>',
    '<div class="note">Each image becomes one PDF page in the order shown above. Fit-to-image uses the image pixel dimensions at 72 points per inch. Some formats (especially HEIC/TIFF) depend on browser decoding support.</div>',
    '<div class="image-pdf-run-row"><button type="button" class="btn btn-primary" id="image-pdf-run" disabled>Create PDF</button></div>',
    '<div class="progress-bar" id="image-pdf-progress-wrap" style="display:none"><div class="fill" id="image-pdf-progress-fill"></div></div>',
    '<div id="image-pdf-status" class="note" role="status" aria-live="polite" hidden></div><div id="image-pdf-result" class="note" hidden></div>'
  ].join('');
  const beforePanel=$('panel-pdf-images')||$('panel-compress');if(beforePanel)beforePanel.parentNode.insertBefore(panel,beforePanel);else document.querySelector('main')?.append(panel);
  document.querySelectorAll('[data-panel="image-pdf"]').forEach(button=>button.addEventListener('click',()=>{
    document.querySelectorAll('.panel').forEach(section=>section.classList.toggle('active',section.id==='panel-image-pdf'));
    document.querySelectorAll('.tool-btn').forEach(tool=>tool.classList.toggle('active',tool.dataset.panel==='image-pdf'));
    document.querySelectorAll('.mobile-tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.tab==='tools'));
    document.querySelector('.mobile-tools-sheet.open')?.classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});
  }));
}
async function decodeImage(file){
  try{const bitmap=await createImageBitmap(file);return{source:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close?.()};}
  catch(firstError){const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();return{source:image,width:image.naturalWidth,height:image.naturalHeight,close:()=>URL.revokeObjectURL(url)};}catch(_){URL.revokeObjectURL(url);throw new Error('Could not decode "'+file.name+'". This browser may not support its image format.');}}
}
async function imageBytes(file,decoded){
  const type=file.type.toLowerCase();
  if(type==='image/jpeg'||/\.jpe?g$/i.test(file.name))return{kind:'jpg',bytes:new Uint8Array(await file.arrayBuffer())};
  if(type==='image/png'||/\.png$/i.test(file.name))return{kind:'png',bytes:new Uint8Array(await file.arrayBuffer())};
  const canvas=document.createElement('canvas');canvas.width=decoded.width;canvas.height=decoded.height;
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas is unavailable in this browser.');
  context.drawImage(decoded.source,0,0);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Could not convert "'+file.name+'" to a PDF-compatible image.')),'image/png'));
  canvas.width=0;canvas.height=0;return{kind:'png',bytes:new Uint8Array(await blob.arrayBuffer())};
}
async function createPdf(){
  if(!items.length||busy)return;
  if(!window.PDFLib?.PDFDocument){setStatus('The PDF creation library did not load. Refresh the page and try again.',true);return;}
  busy=true;$('image-pdf-run').disabled=true;$('image-pdf-clear').disabled=true;$('image-pdf-add').disabled=true;
  $('image-pdf-progress-wrap').style.display='block';$('image-pdf-result').hidden=true;
  try{
    const pdf=await window.PDFLib.PDFDocument.create();
    const size=$('image-pdf-size').value,fit=$('image-pdf-fit').value,margin=Number($('image-pdf-margin').value);
    for(let index=0;index<items.length;index++){
      const item=items[index];setStatus('Preparing image '+(index+1)+' of '+items.length+': '+item.file.name);
      const decoded=await decodeImage(item.file);
      try{
        const encoded=await imageBytes(item.file,decoded);
        const embedded=encoded.kind==='jpg'?await pdf.embedJpg(encoded.bytes):await pdf.embedPng(encoded.bytes);
        const imageWidth=embedded.width,imageHeight=embedded.height;let pageWidth,pageHeight;
        if(size==='fit'){pageWidth=imageWidth;pageHeight=imageHeight;}
        else{const portrait=size==='a4'?[595.28,841.89]:[612,792];const dimensions=imageWidth/imageHeight>1?[portrait[1],portrait[0]]:portrait;[pageWidth,pageHeight]=dimensions;}
        const page=pdf.addPage([pageWidth,pageHeight]);
        page.drawImage(embedded,calculateImagePageLayout(imageWidth,imageHeight,pageWidth,pageHeight,fit,margin));
      }finally{decoded.close();}
      $('image-pdf-progress-fill').style.width=((index+1)/items.length*90)+'%';
    }
    setStatus('Writing PDF…');const bytes=await pdf.save();const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
    const link=document.createElement('a');link.href=url;link.download='combined-images.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
    $('image-pdf-progress-fill').style.width='100%';$('image-pdf-result').textContent='Created a PDF with '+items.length+' page'+(items.length===1?'':'s')+' ('+(bytes.length/1048576).toFixed(2)+' MB). Your original images were not modified.';$('image-pdf-result').hidden=false;setStatus('PDF download started.');
  }catch(error){setStatus('PDF creation failed: '+(error?.message||String(error)),true);}
  finally{busy=false;$('image-pdf-clear').disabled=!items.length;$('image-pdf-add').disabled=false;$('image-pdf-progress-wrap').style.display='none';renderItems();}
}
function init(){
  addUI();
  $('image-pdf-drop').addEventListener('click',()=>$('image-pdf-input').click());
  $('image-pdf-add').addEventListener('click',()=>$('image-pdf-input').click());
  $('image-pdf-input').addEventListener('change',event=>addFiles(event.target.files));
  $('image-pdf-drop').addEventListener('dragover',event=>{event.preventDefault();$('image-pdf-drop').classList.add('dragover');});
  $('image-pdf-drop').addEventListener('dragleave',()=>$('image-pdf-drop').classList.remove('dragover'));
  $('image-pdf-drop').addEventListener('drop',event=>{event.preventDefault();$('image-pdf-drop').classList.remove('dragover');addFiles(event.dataTransfer.files);});
  $('image-pdf-clear').addEventListener('click',()=>{items.forEach(item=>releaseUrl(item.previewUrl));items=[];setStatus('');$('image-pdf-result').hidden=true;renderItems();});
  $('image-pdf-run').addEventListener('click',createPdf);renderItems();
}
if(typeof window!=='undefined'){
  window.PDFToolkitSetImageFiles=files=>{if(document.getElementById('panel-image-pdf'))addFiles(files);};
  window.PDFToolkitOpenImageConverter=files=>{
    window.PDFToolkitSetImageFiles(files);
    document.querySelectorAll('.panel').forEach(section=>section.classList.toggle('active',section.id==='panel-image-pdf'));
    document.querySelectorAll('.tool-btn').forEach(tool=>tool.classList.toggle('active',tool.dataset.panel==='image-pdf'));
    document.querySelectorAll('.mobile-tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.tab==='tools'));
    document.querySelector('.mobile-tools-sheet.open')?.classList.remove('open');
    window.scrollTo({top:0,behavior:'smooth'});
  };
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
