(() => {
  'use strict';
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
  const $ = id => document.getElementById(id);
  let selectedFile = null, resultModel = null, busy = false;
  function addUI() {
    if ($('panel-reconstruct')) return;
    const nav = [...document.querySelectorAll('.tool-section')].find(s => s.querySelector('[data-panel="ocr"]')) || [...document.querySelectorAll('.tool-section')].find(s => s.querySelector('[data-panel="compress"]'));
    if (nav) { const b=document.createElement('button'); b.type='button'; b.className='tool-btn'; b.dataset.panel='reconstruct'; b.textContent='📚 Reconstruct Study Text'; nav.insertBefore(b,nav.querySelector('[data-panel="ocr"]')||nav.querySelector('[data-panel="compress"]')); }
    const mobile=$('mobile-tools-grid');
    if (mobile) { const b=document.createElement('button'); b.type='button'; b.className='mobile-tool-card'; b.dataset.panel='reconstruct'; b.innerHTML='<span aria-hidden="true">📚</span><span>Study Text</span>'; mobile.insertBefore(b,mobile.querySelector('[data-panel="ocr"]')||mobile.querySelector('[data-panel="compress"]')); }
    const panel=document.createElement('section'); panel.className='panel'; panel.id='panel-reconstruct';
    panel.innerHTML=[
      '<h2>Study Text Reconstruction <span class="hint">Preview</span></h2>',
      '<p class="subtitle">Extract positioned text and organize it into a reviewable document structure. This first version uses PDF text geometry and conservative heuristics; it does not claim perfect table or figure understanding.</p>',
      '<div class="drop-zone" id="recon-drop"><div class="drop-icon">📚</div><p><strong>Choose a textbook PDF</strong> or drop it here</p><p class="hint">Processing is local in your browser. Your PDF is not uploaded.</p><input id="recon-input" type="file" accept=".pdf,application/pdf" hidden></div>',
      '<div id="recon-file-card" class="file-item" style="display:none;margin-bottom:16px"><div class="file-icon">PDF</div><div class="file-info"><div class="file-name" id="recon-file-name"></div><div class="file-meta" id="recon-file-meta"></div></div><button type="button" class="btn btn-secondary btn-sm" id="recon-remove">Remove</button></div>',
      '<div class="controls" style="flex-direction:column;align-items:stretch;gap:12px">',
      '<div class="control-group"><label for="recon-pages">Pages to reconstruct</label><input id="recon-pages" type="text" placeholder="All pages, or e.g. 1-5, 8, 12-14" style="width:100%"><span class="hint">Start with 1–5 representative pages for large textbooks.</span></div>',
      '<div class="control-group"><label for="recon-order">Reading-order strategy</label><select id="recon-order"><option value="columns" selected>Column-aware (recommended for textbooks)</option><option value="vertical">Top-to-bottom only (for single-column pages)</option></select></div>',
      '<div style="display:flex;flex-wrap:wrap;gap:10px"><button type="button" class="btn btn-primary" id="recon-run" disabled>Analyze document structure</button><button type="button" class="btn btn-secondary" id="recon-json" disabled>Export structured JSON</button><button type="button" class="btn btn-secondary" id="recon-md" disabled>Export Markdown</button><button type="button" class="btn btn-secondary" id="recon-offline-check">Check offline readiness</button></div>',
      '<div class="progress-bar" id="recon-progress-wrap" style="display:none"><div class="fill" id="recon-progress-fill"></div></div>',
      '<div id="recon-status" class="note" role="status" aria-live="polite" style="display:none"></div><div id="recon-summary" class="note" style="display:none"></div><div id="recon-preview" style="display:none"></div></div>'
    ].join('');
    const before=$('panel-ocr')||$('panel-compress'); if(before) before.parentNode.insertBefore(panel,before); else document.querySelector('main')?.appendChild(panel);
    document.querySelectorAll('[data-panel="reconstruct"]').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id==='panel-reconstruct'));
      document.querySelectorAll('.tool-btn').forEach(t=>t.classList.toggle('active',t.dataset.panel==='reconstruct'));
      document.querySelectorAll('.mobile-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab==='tools'));
      document.querySelector('.mobile-tools-sheet.open')?.classList.remove('open'); window.scrollTo({top:0,behavior:'smooth'});
    }));
    const drop=$('recon-drop'), input=$('recon-input');
    drop.addEventListener('click',()=>input.click()); input.addEventListener('change',()=>setFile(input.files&&input.files[0]));
    drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('dragover');}); drop.addEventListener('dragleave',()=>drop.classList.remove('dragover'));
    drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('dragover');setFile(e.dataTransfer?.files?.[0]);});
    $('recon-remove').addEventListener('click',clearFile); $('recon-run').addEventListener('click',analyze);
    $('recon-json').addEventListener('click',()=>exportFile(JSON.stringify(resultModel,null,2),safeBase()+'-structure.json','application/json')); $('recon-offline-check').addEventListener('click',checkOfflineReadiness);
    $('recon-md').addEventListener('click',()=>exportFile(toMarkdown(resultModel),safeBase()+'-reconstructed.md','text/markdown;charset=utf-8'));
  }

  async function checkOfflineReadiness(){
    const required=[
      './pdf-toolkit.html','./document-reconstruction.js',
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs',
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs',
      'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
      'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
      'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js',
      'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm',
      'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz'
    ];
    if(!('caches' in window)){setStatus('This browser does not expose the Cache API, so cached offline assets cannot be verified here.',true);return;}
    setStatus('Checking cached app, PDF.js, OCR engine, and English language data…');
    try{
      const cacheNames=await caches.keys(), missing=[];
      for(const url of required){let hit=false;for(const name of cacheNames){const cache=await caches.open(name);if(await cache.match(new URL(url,location.href).href)){hit=true;break;}}if(!hit)missing.push(url.split('/').pop());}
      const controlled=!!navigator.serviceWorker?.controller;
      if(!missing.length&&controlled)setStatus('Offline asset check passed: required app, PDF.js, Tesseract, and English data assets are cached. Now test by turning off the network and reopening the app; this check cannot guarantee every browser will allow all worker assets to start offline.');
      else{
        const notes=[];if(!controlled)notes.push('The page is not currently controlled by the service worker; refresh after the worker registers.');if(missing.length)notes.push('Missing cached assets: '+missing.join(', ')+'. Open the OCR tool and choose “Prepare OCR for offline use” while online, then check again.');
        setStatus('Offline readiness is incomplete. '+notes.join(' '),true);
      }
    }catch(e){setStatus('Could not inspect offline caches: '+(e?.message||String(e)),true);}
  }

  function setFile(f) {
    if(!f)return; if(f.type!=='application/pdf'&&!/\.pdf$/i.test(f.name))return setStatus('Please select a PDF file.',true);
    selectedFile=f; resultModel=null; $('recon-file-name').textContent=f.name; $('recon-file-meta').textContent=(f.size/1048576).toFixed(2)+' MB';
    $('recon-file-card').style.display='flex'; $('recon-drop').style.display='none'; $('recon-run').disabled=false; $('recon-json').disabled=true; $('recon-md').disabled=true;
    $('recon-summary').style.display='none'; $('recon-preview').style.display='none'; setStatus('');
  }
  function clearFile(){if(busy)return;selectedFile=null;resultModel=null;$('recon-input').value='';$('recon-file-card').style.display='none';$('recon-drop').style.display='';$('recon-run').disabled=true;$('recon-json').disabled=true;$('recon-md').disabled=true;$('recon-summary').style.display='none';$('recon-preview').style.display='none';setStatus('');}
  function setStatus(msg,error=false){const el=$('recon-status');el.style.display=msg?'block':'none';el.textContent=msg||'';el.style.borderColor=error?'var(--danger)':'var(--border)';}
  function progress(p){$('recon-progress-wrap').style.display='block';$('recon-progress-fill').style.width=Math.max(0,Math.min(100,p))+'%';}
  function parseRanges(raw,count){if(!raw.trim())return Array.from({length:count},(_,i)=>i+1);const set=new Set();for(const token of raw.split(',')){const m=token.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);if(!m)throw new Error('Use page ranges such as 1-5, 8, 12-14.');const a=Number(m[1]),b=Number(m[2]||m[1]);if(a<1||b<a||b>count)throw new Error('Page range '+token.trim()+' is outside this PDF (1-'+count+').');for(let p=a;p<=b;p++)set.add(p);}return [...set].sort((a,b)=>a-b);}
  async function getPdfJs(){const lib=await import(PDFJS);lib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';return lib;}
  function median(values){if(!values.length)return 0;const s=[...values].sort((a,b)=>a-b),mid=Math.floor(s.length/2);return s.length%2?s[mid]:(s[mid-1]+s[mid])/2;}
  function classifyLine(line,medianFont,pageWidth){const text=line.text.trim(),upper=text===text.toLocaleUpperCase()&&/[A-Z]/.test(text);if(/^(figure|fig\.|table|plate|image|box)\s*\d+/i.test(text)||/^(source|note|adapted from)\s*:/i.test(text))return 'caption';if(line.fragments.length>=3&&line.fragments.slice(1).some((f,i)=>f.x-line.fragments[i].xEnd>medianFont*2.8))return 'table-row';if(line.fontSize>=medianFont*1.32&&text.length<150)return 'heading';if(upper&&text.length<110&&text.split(/\s+/).length<=14)return 'heading';if(line.width>pageWidth*0.62&&line.fontSize>=medianFont*1.12&&text.length<180)return 'heading';return 'paragraph';}
  function groupLines(items,pageNumber){const fragments=[];for(const item of items||[]){const text=String(item.str||'').replace(/\s+/g,' ').trim();if(!text)continue;const tr=item.transform||[],x=Number(tr[4]||0),y=Number(tr[5]||0),fontSize=Math.max(1,Math.hypot(Number(tr[2]||0),Number(tr[3]||0))||Math.abs(Number(tr[0]||0))||Number(item.height)||10);fragments.push({text,x,y,xEnd:x+Math.max(0,Number(item.width)||0),width:Math.max(0,Number(item.width)||0),fontSize,height:Math.max(1,Number(item.height)||fontSize),page:pageNumber});}
    fragments.sort((a,b)=>b.y-a.y||a.x-b.x);const lines=[];for(const f of fragments){let line=lines.find(l=>Math.abs(l.y-f.y)<=Math.max(2,Math.min(l.fontSize,f.fontSize)*0.42));if(!line){line={page:pageNumber,y:f.y,fragments:[],x:f.x,xEnd:f.xEnd,fontSize:f.fontSize};lines.push(line);}line.fragments.push(f);line.x=Math.min(line.x,f.x);line.xEnd=Math.max(line.xEnd,f.xEnd);line.fontSize=Math.max(line.fontSize,f.fontSize);}
    for(const l of lines){l.fragments.sort((a,b)=>a.x-b.x);l.text=l.fragments.map(f=>f.text).join(' ').replace(/\s+([,.;:!?%)\]])/g,'$1').replace(/([(\\[])\s+/g,'$1').trim();l.width=Math.max(0,l.xEnd-l.x);l.type='paragraph';}return lines.sort((a,b)=>b.y-a.y||a.x-b.x);}
  function orderLines(lines,pageWidth,medianFont,mode){const nonempty=lines.filter(l=>l.text);if(mode==='vertical')return nonempty.sort((a,b)=>b.y-a.y||a.x-b.x);const anchors=nonempty.filter(l=>l.width>pageWidth*0.64||l.type==='heading'||l.type==='caption'),body=nonempty.filter(l=>!anchors.includes(l)),starts=body.map(l=>l.x).sort((a,b)=>a-b);let split=null,bestGap=0;for(let i=1;i<starts.length;i++){const gap=starts[i]-starts[i-1];if(gap>Math.max(24,medianFont*3.4)&&starts[i-1]>pageWidth*0.08&&starts[i]<pageWidth*0.78&&gap>bestGap){bestGap=gap;split=(starts[i-1]+starts[i])/2;}}if(split===null)return nonempty.sort((a,b)=>b.y-a.y||a.x-b.x);for(const l of body)l.column=l.x<split?0:1;const bands=anchors.slice().sort((a,b)=>b.y-a.y),ordered=[];let remaining=body.slice();for(const anchor of bands){const above=remaining.filter(l=>l.y>anchor.y);if(above.length){const left=above.filter(l=>(l.column||0)===0).sort((a,b)=>b.y-a.y||a.x-b.x),right=above.filter(l=>l.column===1).sort((a,b)=>b.y-a.y||a.x-b.x);ordered.push(...left,...right);const done=new Set(above);remaining=remaining.filter(l=>!done.has(l));}ordered.push(anchor);}if(remaining.length){ordered.push(...remaining.filter(l=>(l.column||0)===0).sort((a,b)=>b.y-a.y||a.x-b.x));ordered.push(...remaining.filter(l=>l.column===1).sort((a,b)=>b.y-a.y||a.x-b.x));}return ordered;}
  function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
  async function analyze(){if(!selectedFile||busy)return;busy=true;$('recon-run').disabled=true;$('recon-json').disabled=true;$('recon-md').disabled=true;$('recon-summary').style.display='none';$('recon-preview').style.display='none';progress(0);let doc=null;try{setStatus('Loading PDF text extraction library…');const pdfjs=await getPdfJs();doc=await pdfjs.getDocument({data:await selectedFile.arrayBuffer()}).promise;const pages=parseRanges($('recon-pages').value,doc.numPages),model={schemaVersion:'1.0',sourceName:selectedFile.name,generatedAt:new Date().toISOString(),pageCount:doc.numPages,processedPages:[],regions:[],warnings:[]};let order=0,digitalPages=0,sparsePages=0;
    for(let i=0;i<pages.length;i++){const pageNo=pages[i];setStatus('Analyzing page '+pageNo+' ('+(i+1)+' of '+pages.length+')…');const page=await doc.getPage(pageNo),viewport=page.getViewport({scale:1}),content=await page.getTextContent(),items=content.items||[],chars=items.reduce((n,it)=>n+String(it.str||'').trim().length,0);if(chars>=40)digitalPages++;else sparsePages++;const rawLines=groupLines(items,pageNo),fontMedian=median(rawLines.map(l=>l.fontSize).filter(n=>n>0))||10;for(const line of rawLines)line.type=classifyLine(line,fontMedian,viewport.width);const lines=orderLines(rawLines,viewport.width,fontMedian,$('recon-order').value);model.processedPages.push({page:pageNo,width:viewport.width,height:viewport.height,sourceTextChars:chars,hasTextLayer:chars>=40,lineCount:lines.length});for(const line of lines){if(!line.text)continue;model.regions.push({id:'p'+pageNo+'-r'+(++order),page:pageNo,type:line.type,text:line.text,bbox:{x:Math.round(line.x*100)/100,y:Math.round((viewport.height-line.y)*100)/100,width:Math.round(line.width*100)/100,height:Math.round(line.fontSize*100)/100},readingOrder:order,column:line.column===undefined?null:line.column+1,confidence:null,source:'pdf-text-layer'});}progress((i+1)/pages.length*100);}
    if(sparsePages)model.warnings.push(sparsePages+' selected page(s) have little or no extractable text. Run OCR on those pages first; this preview does not silently invent text.');model.summary={pagesAnalyzed:pages.length,digitalTextPages:digitalPages,likelyScannedOrSparsePages:sparsePages,regions:model.regions.length,headings:model.regions.filter(r=>r.type==='heading').length,captions:model.regions.filter(r=>r.type==='caption').length,tableRows:model.regions.filter(r=>r.type==='table-row').length};resultModel=model;renderResult(model);$('recon-json').disabled=false;$('recon-md').disabled=false;setStatus('Analysis complete. Review the detected structure before relying on exported reading order.');
  }catch(e){setStatus('Reconstruction failed: '+(e?.message||String(e)),true);}finally{try{await doc?.destroy();}catch(_){}busy=false;$('recon-run').disabled=!selectedFile;setTimeout(()=>$('recon-progress-wrap').style.display='none',800);}}
  function renderResult(model){const s=model.summary;$('recon-summary').innerHTML='<strong>Structure preview</strong><br>Pages analyzed: '+s.pagesAnalyzed+'<br>Pages with selectable text: '+s.digitalTextPages+'<br>Likely scanned/sparse pages: '+s.likelyScannedOrSparsePages+'<br>Regions: '+s.regions+' · Headings: '+s.headings+' · Captions: '+s.captions+' · Table-like rows: '+s.tableRows+(model.warnings.length?'<br><br><strong>Review:</strong> '+model.warnings.map(escapeHtml).join('<br>'):'');$('recon-summary').style.display='block';const preview=model.regions.slice(0,120).map(r=>'<div style="padding:8px 10px;border-bottom:1px solid var(--border)"><div class="hint">p. '+r.page+' · '+escapeHtml(r.type)+' · order '+r.readingOrder+'</div><div style="'+(r.type==='heading'?'font-weight:700;font-size:1.05em;':r.type==='caption'?'font-style:italic;':'')+'">'+escapeHtml(r.text)+'</div></div>').join('');$('recon-preview').innerHTML='<h3>First '+Math.min(120,model.regions.length)+' regions</h3><div style="max-height:560px;overflow:auto;border:1px solid var(--border);border-radius:10px">'+(preview||'<p>No extractable text found. Run OCR first for scanned pages.</p>')+'</div><p class="hint">Preview is limited to 120 regions. JSON contains all regions and approximate page coordinates.</p>';$('recon-preview').style.display='block';}
  function toMarkdown(model){const out=['# Reconstructed study text','','Source: '+model.sourceName,'Pages analyzed: '+model.summary.pagesAnalyzed,'','> Preliminary extraction: verify headings, columns, captions, table rows, symbols, and reading order against the original PDF.',''];let page=0;for(const r of model.regions){if(r.page!==page){page=r.page;out.push('', '## PDF page '+page,'');}if(r.type==='heading')out.push('### '+r.text,'');else if(r.type==='caption')out.push('*'+r.text+'*','');else if(r.type==='table-row')out.push(r.text.replace(/\s{2,}/g,' | '));else out.push(r.text,'');}if(model.warnings.length)out.push('','## Review warnings','',...model.warnings.map(w=>'- '+w));return out.join('\n');}
  function safeBase(){return(selectedFile?.name||'document').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'_')||'document';}
  function exportFile(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addUI);else addUI();
})();