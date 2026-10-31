(() => {
'use strict';
const $ = id => document.getElementById(id);
let file = null, busy = false, detected = [], pageCount = 0;
function addUI() {
 if ($('panel-blank-pages')) return;
 const quick = [...document.querySelectorAll('.tool-section')].find(s => s.querySelector('[data-panel="compress"]'));
 if (quick) { const b=document.createElement('button'); b.type='button'; b.className='tool-btn'; b.dataset.panel='blank-pages'; b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h5"/></svg>Remove Blank Pages'; quick.appendChild(b); }
 const mobile=$('mobile-tools-grid');
 if (mobile) { const b=document.createElement('button'); b.type='button'; b.className='mobile-tool-card'; b.dataset.panel='blank-pages'; b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h5"/></svg><span>Blank Pages</span>'; mobile.appendChild(b); }
 const panel=document.createElement('section'); panel.className='panel'; panel.id='panel-blank-pages';
 panel.innerHTML=[
 '<h2>Detect & Remove Blank Pages</h2>',
 '<p class="subtitle">Find mostly empty pages in scanned textbooks, lecture notes, and handouts. Review detections before removing anything.</p>',
 '<div class="drop-zone" id="blank-drop"><div class="drop-icon">📄</div><p><strong>Choose a PDF to scan</strong> or drop it here</p><p class="hint">Runs locally in your browser. Your original file is never changed.</p><input type="file" accept=".pdf,application/pdf" hidden id="blank-input"></div>',
 '<div id="blank-file-card" class="file-item" style="display:none;margin-bottom:18px"><div class="file-icon">PDF</div><div class="file-info"><div class="file-name" id="blank-file-name"></div><div class="file-meta" id="blank-file-size"></div></div><button type="button" class="btn btn-secondary btn-sm" id="blank-remove-file">Remove</button></div>',
 '<div class="controls" style="flex-direction:column;align-items:stretch;gap:14px">',
 '<div class="control-group"><label for="blank-threshold">Blank-page sensitivity</label><select id="blank-threshold" style="width:100%"><option value="0.001">Strict — almost-white pages only</option><option value="0.003" selected>Balanced — recommended</option><option value="0.008">Sensitive — may flag lightly printed pages</option></select><span class="hint">Detection estimates visible pixel darkness. Faint text, pale diagrams, and nearly blank pages can be misclassified.</span></div>',
 '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"><button type="button" class="btn btn-primary" id="blank-scan" disabled>Scan for Blank Pages</button><button type="button" class="btn btn-secondary" id="blank-select-all" disabled>Select detected</button><button type="button" class="btn btn-secondary" id="blank-clear-selection" disabled>Clear selection</button></div>',
 '<div class="progress-bar" id="blank-progress-wrap" style="display:none"><div class="fill" id="blank-progress-fill"></div></div>',
 '<div id="blank-status" class="note" role="status" aria-live="polite" style="display:none;margin:0"></div>',
 '<div id="blank-results" style="display:none"><h3 style="margin-bottom:8px">Review pages</h3><p class="hint" style="margin-bottom:12px">Check only pages you want removed. Numbers refer to PDF page positions, not printed page numbers.</p><div id="blank-page-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:16px"></div><button type="button" class="btn btn-primary" id="blank-export" disabled>Remove selected pages &amp; download</button></div>',
 '<div class="note" style="margin:0">Always review selected pages before exporting. The original file is not changed.</div></div>'
 ].join('');
 const before=$('panel-compress'); if(before?.parentNode) before.parentNode.insertBefore(panel,before); else document.querySelector('main')?.appendChild(panel);
 const drop=$('blank-drop'), input=$('blank-input');
 drop.addEventListener('click',()=>{if(!busy)input.click();});
 drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('dragover');});
 drop.addEventListener('dragleave',()=>drop.classList.remove('dragover'));
 drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('dragover');if(!busy)setFile(e.dataTransfer?.files?.[0]);});
 input.addEventListener('change',()=>setFile(input.files?.[0]));
 $('blank-remove-file').addEventListener('click',clearFile); $('blank-scan').addEventListener('click',scan);
 $('blank-select-all').addEventListener('click',()=>selectDetected(true)); $('blank-clear-selection').addEventListener('click',()=>selectDetected(false)); $('blank-export').addEventListener('click',exportPdf);
 document.querySelectorAll('[data-panel="blank-pages"]').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id==='panel-blank-pages'));
  document.querySelectorAll('.tool-btn').forEach(t=>t.classList.toggle('active',t.dataset.panel==='blank-pages'));
  document.querySelectorAll('.mobile-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab==='tools'));
  document.querySelector('.mobile-tools-sheet.open')?.classList.remove('open'); window.scrollTo({top:0,behavior:'smooth'});
  const active=window.PDFToolkitGetActiveFile?.();if(active&&active!==file)setFile(active);
 }));
}
function status(msg,error=false){const el=$('blank-status');el.style.display=msg?'block':'none';el.textContent=msg||'';el.style.borderColor=error?'var(--danger)':'var(--border)';}
function selectedPages(){return detected.filter(x=>x.selected).map(x=>x.page);}
function setBusy(v){busy=v;$('blank-scan').disabled=v||!file;$('blank-remove-file').disabled=v;$('blank-input').disabled=v;$('blank-threshold').disabled=v;updateExportState();}
function setFile(f){if(!f)return;if(f.type!=='application/pdf'&&!/\.pdf$/i.test(f.name))return status('Please choose a PDF file.',true);file=f;if(window.PDFToolkitSetActiveFile&&window.PDFToolkitGetActiveFile?.()!==f)window.PDFToolkitSetActiveFile(f);detected=[];pageCount=0;$('blank-file-name').textContent=f.name;$('blank-file-size').textContent='Size: '+(f.size/1048576).toFixed(2)+' MB';$('blank-file-card').style.display='flex';$('blank-drop').style.display='none';$('blank-scan').disabled=busy;$('blank-results').style.display='none';$('blank-select-all').disabled=true;$('blank-clear-selection').disabled=true;status('PDF selected. Scan it to identify likely blank pages.');}
window.PDFToolkitSetBlankPagesFile=setFile;
function clearFile(){if(busy)return;file=null;detected=[];pageCount=0;$('blank-input').value='';$('blank-file-card').style.display='none';$('blank-drop').style.display='';$('blank-scan').disabled=true;$('blank-results').style.display='none';status('');}
async function loadPdfJs(){const lib=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');lib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';return lib;}
async function scan(){
 if(!file||busy)return;setBusy(true);detected=[];$('blank-results').style.display='none';const progress=$('blank-progress-wrap'),fill=$('blank-progress-fill');progress.style.display='block';fill.style.width='0%';let source;
 try{
  status('Loading PDF renderer…');const pdfjs=await loadPdfJs();source=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;pageCount=source.numPages;
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true,alpha:false});if(!ctx)throw new Error('Canvas pixel analysis is not available in this browser.');
  const threshold=Number($('blank-threshold').value);
  for(let n=1;n<=pageCount;n++){
   status('Checking page '+n+' of '+pageCount+'…');const page=await source.getPage(n);const base=page.getViewport({scale:1});const scale=Math.max(.15,Math.min(.45,420/Math.max(base.width,base.height)));const viewport=page.getViewport({scale});
   canvas.width=Math.max(1,Math.floor(viewport.width));canvas.height=Math.max(1,Math.floor(viewport.height));await page.render({canvasContext:ctx,viewport}).promise;
   const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let dark=0,total=canvas.width*canvas.height;
   for(let i=0;i<pixels.length;i+=4){if(.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2]<242)dark++;}
   const ratio=total?dark/total:1;if(ratio<threshold)detected.push({page:n,ratio,selected:true});
   fill.style.width=Math.round(n/pageCount*100)+'%';page.cleanup();
  }
  $('blank-results').style.display='block';renderDetected();$('blank-select-all').disabled=!detected.length;$('blank-clear-selection').disabled=!detected.length;
  status(detected.length?'Found '+detected.length+' likely blank page(s) out of '+pageCount+'. Review the selection before removing pages.':'No likely blank pages found in '+pageCount+' pages.');
 }catch(e){status(e?.message||'Could not scan this PDF. It may be damaged or password-protected.',true);}
 finally{try{await source?.destroy();}catch{}progress.style.display='none';setBusy(false);}
}
function renderDetected(){const list=$('blank-page-list');list.innerHTML='';if(!detected.length){list.innerHTML='<p class="hint">No pages were detected as blank.</p>';updateExportState();return;}
 detected.forEach(item=>{const label=document.createElement('label');label.style.cssText='display:flex;gap:8px;align-items:flex-start;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer';const cb=document.createElement('input');cb.type='checkbox';cb.checked=item.selected;cb.style.marginTop='4px';cb.addEventListener('change',()=>{item.selected=cb.checked;updateExportState();});const copy=document.createElement('span');copy.innerHTML='<strong>Page '+item.page+'</strong><br><span class="hint">Estimated ink: '+(item.ratio*100).toFixed(2)+'%</span>';label.append(cb,copy);list.appendChild(label);});updateExportState();}
function updateExportState(){const count=selectedPages().length;const btn=$('blank-export');if(!btn)return;btn.disabled=busy||count===0||count>=pageCount;btn.textContent=count>=pageCount?'Cannot remove every page':'Remove '+count+' selected page(s) & download';}
function selectDetected(value){detected.forEach(x=>x.selected=value);renderDetected();}
function download(bytes,name){const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function exportPdf(){const pages=selectedPages();if(!file||busy||!pages.length)return;if(pages.length>=pageCount)return status('You cannot remove every page from a PDF.',true);if(!confirm('Remove '+pages.length+' selected page(s)? The original file will remain unchanged.'))return;setBusy(true);try{status('Preparing the cleaned PDF…');const doc=await PDFLib.PDFDocument.load(await file.arrayBuffer());pages.sort((a,b)=>b-a).forEach(n=>doc.removePage(n-1));const bytes=await doc.save();const base=file.name.replace(/\.pdf$/i,'')||'document';download(bytes,base+'_without_blank_pages.pdf');status('Downloaded a cleaned copy. Your original PDF was not changed.');}catch(e){status(e?.message||'Could not remove selected pages. The PDF may be encrypted or unsupported.',true);}finally{setBusy(false);}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addUI,{once:true});else addUI();
})();