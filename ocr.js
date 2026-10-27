(() => {
  'use strict';
  const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1';
  const CORE = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1';
  const LANG = 'https://tessdata.projectnaptha.com/4.0.0';
  const $ = id => document.getElementById(id);
  let file = null, worker = null, busy = false, cancelled = false;

  function addUI() {
    if ($('panel-ocr')) return;
    const quick = [...document.querySelectorAll('.tool-section')].find(s => s.querySelector('[data-panel="compress"]'));
    if (quick) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tool-btn'; b.dataset.panel = 'ocr';
      b.textContent = '🔎 OCR & Searchable PDF';
      quick.insertBefore(b, quick.querySelector('[data-panel="compress"]'));
    }
    const mobile = $('mobile-tools-grid');
    if (mobile) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mobile-tool-card'; b.dataset.panel = 'ocr';
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><span>OCR</span>';
      mobile.insertBefore(b, mobile.querySelector('[data-panel="compress"]'));
    }
    const panel = document.createElement('section');
    panel.className = 'panel'; panel.id = 'panel-ocr';
    panel.innerHTML = [
      '<h2>OCR & Searchable PDF</h2>',
      '<p class="subtitle">Recognize English text on scanned pages and add an invisible searchable text layer while preserving the original page artwork. For offline use, prepare the assets once while online.</p>',
      '<div class="drop-zone" id="ocr-drop"><div class="drop-icon">🔎</div><p><strong>Drop a scanned PDF here</strong> or click to browse</p><p class="hint">Your file is processed locally in this browser; it is not uploaded.</p><input type="file" accept=".pdf,application/pdf" hidden id="ocr-input"></div>',
      '<div id="ocr-file-card" class="file-item" style="display:none;margin-bottom:18px"><div class="file-icon">PDF</div><div class="file-info"><div class="file-name" id="ocr-file-name"></div><div class="file-meta" id="ocr-file-size"></div></div><button type="button" class="btn btn-secondary btn-sm" id="ocr-remove">Remove</button></div>',
      '<div class="controls" style="flex-direction:column;align-items:stretch;gap:14px">',
      '<div class="control-group"><label for="ocr-pages">Pages to OCR</label><input type="text" id="ocr-pages" placeholder="All pages, or e.g. 1-5, 8, 12-14" style="min-width:100%;font-family:\'JetBrains Mono\',monospace"><span class="hint">Leave blank to process all pages. Page numbers start at 1.</span></div>',
      '<div class="control-group"><label for="ocr-scale">Recognition resolution</label><select id="ocr-scale"><option value="1.5">Fast — 1.5× resolution</option><option value="2" selected>Balanced — 2× resolution</option><option value="2.5">High — 2.5× resolution (slower)</option><option value="3">Maximum — 3× resolution (slowest; uses more memory)</option></select></div>',
      '<div class="control-group"><label for="ocr-layout">Page layout</label><select id="ocr-layout"><option value="auto" selected>Automatic — full page / columns</option><option value="sparse">Sparse text — scattered labels and notes</option></select><span class="hint">Use Sparse text for pages with separated labels, annotations, or text around diagrams.</span></div>',
      '<div class="control-group"><label><input type="checkbox" id="ocr-clean" style="width:auto;min-width:0;margin-right:8px">Improve faint scans (grayscale + contrast normalization)</label><span class="hint">Optional preprocessing may help pale or uneven scans; inspect output for tables, symbols, and photos.</span></div>',
      '<div class="note" style="margin:0">Pages that already contain selectable text are skipped to avoid duplicate text. OCR does not sharpen visible images; accuracy depends on scan quality. The first run needs internet unless OCR assets have been cached.</div>',
      '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"><button type="button" class="btn btn-secondary" id="ocr-detect" disabled>Detect scanned pages</button><button type="button" class="btn btn-primary" id="ocr-run" disabled>Make Searchable PDF</button><button type="button" class="btn btn-secondary" id="ocr-cancel" disabled>Cancel</button><button type="button" class="btn btn-secondary" id="ocr-offline">Prepare OCR for offline use</button></div>',
      '<div class="progress-bar" id="ocr-progress-wrap" style="display:none"><div class="fill" id="ocr-progress-fill"></div></div>',
      '<div id="ocr-status" class="note" role="status" aria-live="polite" style="display:none;margin:0"></div><div id="ocr-result" class="note" style="display:none;margin:0"></div></div>'
    ].join('');
    const before = $('panel-compress');
    if (before) before.parentNode.insertBefore(panel, before);
    else document.querySelector('main')?.appendChild(panel);
    document.querySelectorAll('[data-panel="ocr"]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-ocr'));
      document.querySelectorAll('.tool-btn').forEach(t => t.classList.toggle('active', t.dataset.panel === 'ocr'));
      document.querySelectorAll('.mobile-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'tools'));
      document.querySelector('.mobile-tools-sheet.open')?.classList.remove('open');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
  }
  function status(msg, error) {
    const el = $('ocr-status'); el.style.display = msg ? 'block' : 'none';
    el.textContent = msg || ''; el.style.borderColor = error ? 'var(--danger)' : 'var(--border)';
  }
  function progress(p, show = true) {
    $('ocr-progress-wrap').style.display = show ? 'block' : 'none';
    $('ocr-progress-fill').style.width = Math.max(0, Math.min(100, p)) + '%';
  }
  function setBusy(v) {
    busy = v; $('ocr-run').disabled = v || !file; $('ocr-detect').disabled = v || !file; $('ocr-cancel').disabled = !v;
    $('ocr-offline').disabled = v; $('ocr-remove').disabled = v;
  }
  function setFile(f) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) return status('Please choose a PDF file.', true);
    file = f; $('ocr-file-name').textContent = f.name;
    $('ocr-file-size').textContent = 'Original size: ' + (f.size / 1048576).toFixed(2) + ' MB';
    $('ocr-file-card').style.display = 'flex'; $('ocr-drop').style.display = 'none';
    $('ocr-run').disabled = busy; $('ocr-detect').disabled = busy; $('ocr-result').style.display = 'none'; status('');
  }
  function clearFile() {
    if (busy) return; file = null; $('ocr-input').value = '';
    $('ocr-file-card').style.display = 'none'; $('ocr-drop').style.display = '';
    $('ocr-run').disabled = true; $('ocr-detect').disabled = true; $('ocr-result').style.display = 'none'; status(''); progress(0, false);
  }
  function parseRanges(raw, count) {
    if (!raw.trim()) return Array.from({length: count}, (_, i) => i + 1);
    const pages = new Set();
    for (const token of raw.split(',')) {
      const m = token.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
      if (!m) throw new Error('Use page numbers/ranges such as 1-5, 8, 12-14.');
      const a = Number(m[1]), b = Number(m[2] || m[1]);
      if (a < 1 || b < a || b > count) throw new Error('Page range ' + token.trim() + ' is outside this PDF (1-' + count + ').');
      for (let n = a; n <= b; n++) pages.add(n);
    }
    if (!pages.size) throw new Error('Enter at least one page or range.');
    return [...pages].sort((a,b) => a-b);
  }
  // Distinguish a genuinely searchable page from a scanned page with only a few
  // selectable headers/footers. Use text quantity and its footprint, not a single
  // character-count cutoff.
  function hasUsableTextLayer(page, items) {
    const valid = (items || []).filter(item => String(item.str || '').trim());
    const chars = valid.reduce((n, item) => n + String(item.str || '').trim().length, 0);
    if (chars < 80 || valid.length < 8) return false;
    const viewport = page.getViewport({scale:1});
    let footprint = 0;
    for (const item of valid) {
      const width = Math.abs(Number(item.width) || 0);
      const height = Math.max(0, Math.abs(Number(item.height) || 0));
      footprint += width * height;
    }
    const pageArea = Math.max(1, viewport.width * viewport.height);
    return footprint / pageArea >= 0.002;
  }
  function enhanceScan(canvas, ctx) {
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    // Grayscale first, then stretch contrast using robust near-black/near-white
    // percentiles. This avoids a harsh binary threshold that can erase thin glyphs.
    const histogram = new Uint32Array(256);
    const gray = new Uint8Array(data.length / 4);
    for (let p = 0, i = 0; i < data.length; i += 4, p++) {
      const g = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
      gray[p] = g; histogram[g]++;
    }
    const total = gray.length;
    const percentile = target => {
      let sum = 0;
      for (let v = 0; v < 256; v++) { sum += histogram[v]; if (sum >= target) return v; }
      return 255;
    };
    const low = percentile(Math.max(1, Math.floor(total * 0.02)));
    const high = percentile(Math.max(1, Math.floor(total * 0.98)));
    const span = Math.max(32, high - low);
    for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
      const v = Math.max(0, Math.min(255, Math.round((gray[p] - low) * 255 / span)));
      data[i] = data[i+1] = data[i+2] = v;
    }
    ctx.putImageData(image, 0, 0);
  }
  function compactRanges(numbers) {
    const sorted = [...new Set(numbers)].sort((a, b) => a - b);
    if (!sorted.length) return '';
    const ranges = [];
    let start = sorted[0], end = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) end = sorted[i];
      else {
        ranges.push(start === end ? String(start) : start + '-' + end);
        start = end = sorted[i];
      }
    }
    ranges.push(start === end ? String(start) : start + '-' + end);
    return ranges.join(', ');
  }
  async function detectScannedPages() {
    if (!file || busy) return;
    cancelled = false;
    setBusy(true);
    progress(0);
    $('ocr-result').style.display = 'none';
    let doc = null;
    try {
      status('Opening PDF to inspect text layers…');
      const pdf = await pdfjs();
      doc = await pdf.getDocument({data: await file.arrayBuffer()}).promise;
      const scanned = [];
      const searchable = [];
      for (let i = 1; i <= doc.numPages; i++) {
        if (cancelled) throw new Error('Scan detection cancelled.');
        status('Checking page ' + i + ' of ' + doc.numPages + '…');
        const page = await doc.getPage(i);
        const items = (await page.getTextContent()).items || [];
        if (hasUsableTextLayer(page, items)) searchable.push(i);
        else scanned.push(i);
        progress(i / doc.numPages * 95);
      }
      if (cancelled) throw new Error('Scan detection cancelled.');
      $('ocr-pages').value = compactRanges(scanned);
      const message = scanned.length
        ? 'Detected ' + scanned.length + ' page(s) with little or no selectable text and selected them for OCR. ' + searchable.length + ' page(s) already contain selectable text and were left out. Review the page range before running OCR.'
        : 'All ' + doc.numPages + ' pages appear to contain selectable text. OCR may not be necessary.';
      $('ocr-result').textContent = message;
      $('ocr-result').style.display = 'block';
      progress(100);
      status('Scan detection complete. You can edit the selected page range manually.');
    } catch (e) {
      const message = e?.message || String(e);
      status(/cancelled/i.test(message) ? message : 'Scan detection failed: ' + message, !/cancelled/i.test(message));
    } finally {
      try { await doc?.destroy(); } catch (_) {}
      setBusy(false);
      progress(0, false);
    }
  }

  async function loadTesseract() {
    if (window.Tesseract) return window.Tesseract;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TESS + '/dist/tesseract.min.js'; s.async = true;
      s.onload = resolve; s.onerror = () => reject(new Error('Could not load OCR engine. Connect to the internet and retry.'));
      document.head.appendChild(s);
    });
    if (!window.Tesseract) throw new Error('OCR engine did not initialize.');
    return window.Tesseract;
  }
  async function pdfjs() {
    const lib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');
    lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
    return lib;
  }
  function download(bytes, name) {
    const url = URL.createObjectURL(new Blob([bytes], {type:'application/pdf'}));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function run() {
    if (!file || busy) return;
    cancelled = false; setBusy(true); progress(0); $('ocr-result').style.display = 'none';
    let pdfWorker = null, doc = null, canvas = null;
    let skipped = 0, processed = 0;
    try {
      status('Reading PDF…');
      const bytes = await file.arrayBuffer();
      doc = await PDFLib.PDFDocument.load(bytes.slice(0), { updateMetadata: false });
      const pdf = await pdfjs();
      const source = await pdf.getDocument({data: bytes.slice(0)}).promise;
      const pages = parseRanges($('ocr-pages').value, source.numPages);
      const scale = Number($('ocr-scale').value) || 2;
      status('Loading English OCR engine…');
      const Tesseract = await loadTesseract();
      pdfWorker = await Tesseract.createWorker('eng', 1, {
        workerPath: TESS + '/dist/worker.min.js', corePath: CORE, langPath: LANG,
        logger: info => {
          if (info.status === 'recognizing text') status('Recognizing text… ' + Math.round((info.progress || 0) * 100) + '%');
        }
      });
      worker = pdfWorker;
      const layout = $('ocr-layout')?.value || 'auto';
      await pdfWorker.setParameters({
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: layout === 'sparse' ? Tesseract.PSM.SPARSE_TEXT : Tesseract.PSM.AUTO
      });
      const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
      canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', {alpha:false});
      if (!ctx) throw new Error('Could not create an OCR canvas in this browser.');
      for (let i = 0; i < pages.length; i++) {
        if (cancelled) throw new Error('OCR cancelled.');
        const number = pages[i], page = await source.getPage(number);
        const textItems = (await page.getTextContent()).items || [];
        if (hasUsableTextLayer(page, textItems)) { skipped++; processed++; progress(processed / pages.length * 95); continue; }
        status('Rendering page ' + number + ' (' + (i+1) + ' of ' + pages.length + ')…');
        const viewport = page.getViewport({scale});
        canvas.width = Math.max(1, Math.ceil(viewport.width)); canvas.height = Math.max(1, Math.ceil(viewport.height));
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({canvasContext:ctx, viewport, background:'#fff'}).promise;
        if ($('ocr-clean')?.checked) {
          status('Enhancing scan contrast on page ' + number + '…');
          enhanceScan(canvas, ctx);
        }
        if (cancelled) throw new Error('OCR cancelled.');
        status('Recognizing page ' + number + ' (' + (i+1) + ' of ' + pages.length + ')…');
        const result = await pdfWorker.recognize(canvas);
        if (cancelled) throw new Error('OCR cancelled.');
        const outPage = doc.getPage(number - 1);
        for (const word of (result?.data?.words || [])) {
          const textWord = String(word.text || '').replace(/[^\x20-\x7E]/g, '').trim();
          if (!textWord || !word.bbox) continue;
          const b = word.bbox;
          const [x0, y0] = viewport.convertToPdfPoint(b.x0, b.y1);
          const [x1, y1] = viewport.convertToPdfPoint(b.x1, b.y0);
          const height = Math.max(2, Math.abs(y1-y0)), width = Math.max(1, Math.abs(x1-x0));
          try {
            outPage.drawText(textWord, {x:Math.max(0,x0), y:Math.max(0,Math.min(y0,y1)), size:Math.max(2,Math.min(48,height*.78)), font, opacity:0, maxWidth:width*1.1});
          } catch (_) {}
        }
        processed++; progress(processed / pages.length * 95);
        canvas.width = 0; canvas.height = 0;
      }
      if (cancelled) throw new Error('OCR cancelled.');
      if (processed === skipped) throw new Error('Selected pages already contain selectable text. Choose scanned pages without a text layer.');
      status('Building searchable PDF…');
      const output = await doc.save({useObjectStreams:true});
      const name = file.name.replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'_') || 'document';
      download(output, name + '-searchable.pdf'); progress(100);
      $('ocr-result').innerHTML = '<strong>Searchable PDF created.</strong><br>Pages OCR-processed: ' + (processed-skipped) + '<br>Pages skipped (already searchable): ' + skipped + '<br>Output size: ' + (output.byteLength/1048576).toFixed(2) + ' MB<br><br>Search for a word in the downloaded PDF and review OCR accuracy.';
      $('ocr-result').style.display = 'block'; status('Download started. Review the output before relying on it.');
    } catch (e) {
      const message = e?.message || String(e);
      status(/cancelled/i.test(message) ? 'OCR cancelled. No output was downloaded.' : 'OCR failed: ' + message, !/cancelled/i.test(message));
    } finally {
      if (pdfWorker) { try { await pdfWorker.terminate(); } catch (_) {} }
      worker = null;
      if (canvas) { canvas.width = 0; canvas.height = 0; }
      if (doc && doc.cleanup) { try { doc.cleanup(); } catch (_) {} }
      setBusy(false); progress(0, false);
    }
  }
  async function prepareOffline() {
    if (!('serviceWorker' in navigator)) return status('This browser does not support offline caching.', true);
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    const sw = navigator.serviceWorker.controller || reg?.active;
    if (!sw) return status('Offline caching is not active. Refresh the site once, then retry.', true);
    setBusy(true); status('Caching OCR engine, worker, language data, and PDF libraries. This may download tens of megabytes…');
    const timeout = setTimeout(() => { if (busy) { setBusy(false); status('Cache preparation timed out. Check your connection and retry.', true); } }, 600000);
    const listener = e => {
      if (e.data?.type === 'OCR_CACHE_PROGRESS') status('Preparing offline OCR: ' + e.data.done + '/' + e.data.total + ' — ' + e.data.current);
      if (e.data?.type === 'OCR_CACHE_DONE') {
        clearTimeout(timeout); navigator.serviceWorker.removeEventListener('message', listener); setBusy(false);
        status(e.data.failed?.length ? 'Offline preparation incomplete. Failed assets: ' + e.data.failed.join(', ') : 'Assets cached. Test by closing the app, disabling internet, reopening it, and running OCR before relying on offline use.', !!e.data.failed?.length);
      }
    };
    navigator.serviceWorker.addEventListener('message', listener);
    sw.postMessage({type:'CACHE_OCR_ASSETS'});
  }
  function init() {
    addUI();
    $('ocr-drop').addEventListener('click', () => $('ocr-input').click());
    $('ocr-input').addEventListener('change', e => setFile(e.target.files?.[0]));
    $('ocr-drop').addEventListener('dragover', e => { e.preventDefault(); $('ocr-drop').classList.add('dragover'); });
    $('ocr-drop').addEventListener('dragleave', () => $('ocr-drop').classList.remove('dragover'));
    $('ocr-drop').addEventListener('drop', e => { e.preventDefault(); $('ocr-drop').classList.remove('dragover'); setFile(e.dataTransfer?.files?.[0]); });
    $('ocr-remove').addEventListener('click', clearFile);
    $('ocr-detect').addEventListener('click', detectScannedPages);
    $('ocr-run').addEventListener('click', run);
    $('ocr-cancel').addEventListener('click', () => { cancelled = true; status('Cancelling after the current step…'); if (worker) worker.terminate(); });
    $('ocr-offline').addEventListener('click', () => prepareOffline().catch(e => { setBusy(false); status('Offline preparation failed: ' + (e?.message || e), true); }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();