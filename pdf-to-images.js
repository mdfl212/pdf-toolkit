(() => {
  'use strict';
  const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
  const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
  const $ = id => document.getElementById(id);
  let file = null, busy = false, cancelled = false;

  function addUI() {
    if ($('panel-pdf-images')) return;
    const quick = [...document.querySelectorAll('.tool-section')].find(s => s.querySelector('[data-panel="compress"]'));
    if (quick) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tool-btn'; b.dataset.panel = 'pdf-images';
      b.textContent = '🖼️ PDF to Images';
      quick.insertBefore(b, quick.querySelector('[data-panel="compress"]'));
    }
    const mobile = $('mobile-tools-grid');
    if (mobile) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mobile-tool-card'; b.dataset.panel = 'pdf-images';
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg><span>PDF to Images</span>';
      const before = mobile.querySelector('[data-panel="compress"]');
      if (before) mobile.insertBefore(b, before); else mobile.appendChild(b);
    }
    const panel = document.createElement('section');
    panel.className = 'panel'; panel.id = 'panel-pdf-images';
    panel.innerHTML = [
      '<h2>PDF to Images</h2>',
      '<p class="subtitle">Convert selected PDF pages into PNG or JPEG images and download them together in a ZIP file. Useful for sharing individual pages or uploading page images to another app.</p>',
      '<div class="drop-zone" id="pdf-images-drop"><div class="drop-icon">🖼️</div><p><strong>Drop a PDF here</strong> or click to browse</p><p class="hint">Processed locally in your browser; the original PDF is not changed or uploaded.</p><input type="file" accept=".pdf,application/pdf" hidden id="pdf-images-input"></div>',
      '<div id="pdf-images-file-card" class="file-item" style="display:none;margin-bottom:18px"><div class="file-icon">PDF</div><div class="file-info"><div class="file-name" id="pdf-images-file-name"></div><div class="file-meta" id="pdf-images-file-size"></div></div><button type="button" class="btn btn-secondary btn-sm" id="pdf-images-remove">Remove</button></div>',
      '<div class="controls" style="flex-direction:column;align-items:stretch;gap:14px">',
      '<div class="control-group"><label for="pdf-images-pages">Pages to convert</label><input type="text" id="pdf-images-pages" placeholder="Leave blank for all, or e.g. 1-5, 8, 12-14" style="min-width:100%;font-family:\'JetBrains Mono\',monospace"><span class="hint">Page numbers start at 1. Ranges are converted in ascending order.</span></div>',
      '<div class="control-group"><label for="pdf-images-format">Image format</label><select id="pdf-images-format"><option value="png">PNG — sharper text and diagrams, larger files</option><option value="jpeg">JPEG — smaller files, best for photographs</option></select></div>',
      '<div class="control-group"><label for="pdf-images-scale">Resolution</label><select id="pdf-images-scale"><option value="1">Standard — 1×</option><option value="1.5" selected>High — 1.5×</option><option value="2">Very high — 2×</option><option value="3">Maximum — 3× (uses more memory)</option></select></div>',
      '<div class="control-group" id="pdf-images-quality-wrap" style="display:none"><label for="pdf-images-quality">JPEG quality <span id="pdf-images-quality-value">85%</span></label><input type="range" id="pdf-images-quality" min="45" max="95" value="85" style="width:100%"></div>',
      '<div class="note" style="margin:0">Each selected page becomes a separate image inside one ZIP. Text in the images will not be selectable or searchable. Large PDFs or high resolutions can use significant memory; try fewer pages or a lower resolution if conversion fails.</div>',
      '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"><button type="button" class="btn btn-primary" id="pdf-images-run" disabled>Convert &amp; download ZIP</button><button type="button" class="btn btn-secondary" id="pdf-images-cancel" disabled>Cancel</button></div>',
      '<div class="progress-bar" id="pdf-images-progress-wrap" style="display:none"><div class="fill" id="pdf-images-progress-fill"></div></div>',
      '<div id="pdf-images-status" class="note" role="status" aria-live="polite" style="display:none;margin:0"></div>',
      '<div id="pdf-images-result" class="note" style="display:none;margin:0"></div></div>'
    ].join('');
    const before = $('panel-compress');
    if (before) before.parentNode.insertBefore(panel, before);
    else document.querySelector('main')?.appendChild(panel);

    document.querySelectorAll('[data-panel="pdf-images"]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-pdf-images'));
      document.querySelectorAll('.tool-btn').forEach(t => t.classList.toggle('active', t.dataset.panel === 'pdf-images'));
      document.querySelectorAll('.mobile-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'tools'));
      document.querySelector('.mobile-tools-sheet.open')?.classList.remove('open');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
  }

  function status(message, error = false) {
    const el = $('pdf-images-status');
    el.style.display = message ? 'block' : 'none';
    el.textContent = message || '';
    el.style.borderColor = error ? 'var(--danger)' : 'var(--border)';
  }
  function progress(percent, show = true) {
    $('pdf-images-progress-wrap').style.display = show ? 'block' : 'none';
    $('pdf-images-progress-fill').style.width = Math.max(0, Math.min(100, percent)) + '%';
  }
  function setBusy(value) {
    busy = value;
    $('pdf-images-run').disabled = value || !file;
    $('pdf-images-cancel').disabled = !value;
    $('pdf-images-remove').disabled = value;
    $('pdf-images-input').disabled = value;
  }
  function setFile(selected) {
    if (!selected) return;
    if (selected.type !== 'application/pdf' && !/\.pdf$/i.test(selected.name)) return status('Please choose a PDF file.', true);
    file = selected;
    $('pdf-images-file-name').textContent = selected.name;
    $('pdf-images-file-size').textContent = 'File size: ' + (selected.size / 1048576).toFixed(2) + ' MB';
    $('pdf-images-file-card').style.display = 'flex';
    $('pdf-images-drop').style.display = 'none';
    $('pdf-images-run').disabled = busy;
    $('pdf-images-result').style.display = 'none';
    status('');
  }
  function clearFile() {
    if (busy) return;
    file = null;
    $('pdf-images-input').value = '';
    $('pdf-images-file-card').style.display = 'none';
    $('pdf-images-drop').style.display = '';
    $('pdf-images-run').disabled = true;
    $('pdf-images-result').style.display = 'none';
    status('');
    progress(0, false);
  }
  function parseRanges(raw, count) {
    if (!raw.trim()) return Array.from({ length: count }, (_, i) => i + 1);
    const pages = new Set();
    for (const token of raw.split(',')) {
      const match = token.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
      if (!match) throw new Error('Use page numbers/ranges such as 1-5, 8, 12-14.');
      const start = Number(match[1]), end = Number(match[2] || match[1]);
      if (start < 1 || end < start || end > count) throw new Error('Page range "' + token.trim() + '" is outside this PDF (1-' + count + ').');
      for (let page = start; page <= end; page++) pages.add(page);
    }
    if (!pages.size) throw new Error('Enter at least one page or range.');
    return [...pages].sort((a, b) => a - b);
  }
  async function loadPdfJs() {
    const lib = await import(PDFJS_URL);
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    return lib;
  }
  function canvasBlob(canvas, mime, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode the page image.')), mime, quality);
    });
  }
  function safeBaseName(name) {
    return name.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'document';
  }
  async function run() {
    if (!file || busy) return;
    cancelled = false; setBusy(true); progress(0); $('pdf-images-result').style.display = 'none';
    let documentProxy = null, canvas = null;
    try {
      if (!window.JSZip) throw new Error('ZIP library did not load. Refresh the page and try again.');
      status('Opening PDF…');
      const bytes = await file.arrayBuffer();
      const pdfjs = await loadPdfJs();
      documentProxy = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
      const pages = parseRanges($('pdf-images-pages').value, documentProxy.numPages);
      const format = $('pdf-images-format').value;
      const scale = Number($('pdf-images-scale').value) || 1.5;
      const quality = Number($('pdf-images-quality').value) / 100;
      const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const extension = format === 'jpeg' ? 'jpg' : 'png';
      const zip = new JSZip();
      canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Could not create a canvas in this browser.');
      const baseName = safeBaseName(file.name);
      for (let i = 0; i < pages.length; i++) {
        if (cancelled) throw new Error('Conversion cancelled.');
        const pageNumber = pages[i];
        status('Rendering page ' + pageNumber + ' (' + (i + 1) + ' of ' + pages.length + ')…');
        const page = await documentProxy.getPage(pageNumber);
        const viewportAtOne = page.getViewport({ scale: 1 });
        let actualScale = scale;
        const maxPixels = 24000000;
        if (viewportAtOne.width * viewportAtOne.height * actualScale * actualScale > maxPixels) {
          actualScale = Math.sqrt(maxPixels / (viewportAtOne.width * viewportAtOne.height));
        }
        const viewport = page.getViewport({ scale: actualScale });
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport, background: '#ffffff' }).promise;
        if (cancelled) throw new Error('Conversion cancelled.');
        const blob = await canvasBlob(canvas, mime, format === 'jpeg' ? quality : undefined);
        zip.file(baseName + '-page-' + String(pageNumber).padStart(4, '0') + '.' + extension, blob);
        canvas.width = 0; canvas.height = 0;
        progress((i + 1) / pages.length * 85);
      }
      if (cancelled) throw new Error('Conversion cancelled.');
      status('Building ZIP file…');
      const zipBlob = await zip.generateAsync({ type: 'blob' }, meta => {
        progress(85 + (meta.percent || 0) * 0.15);
      });
      if (cancelled) throw new Error('Conversion cancelled.');
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url; a.download = baseName + '-images.zip'; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      progress(100);
      $('pdf-images-result').textContent = 'ZIP created with ' + pages.length + ' image(s) in ' + (format === 'jpeg' ? 'JPEG' : 'PNG') + ' format. Page numbers are included in each filename. Review the images before sharing or uploading them.';
      $('pdf-images-result').style.display = 'block';
      status('ZIP download started.');
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      status(/cancelled/i.test(message) ? 'Conversion cancelled. No ZIP was downloaded.' : 'Conversion failed: ' + message, !/cancelled/i.test(message));
    } finally {
      if (canvas) { canvas.width = 0; canvas.height = 0; }
      if (documentProxy) { try { await documentProxy.destroy(); } catch (_) {} }
      setBusy(false); progress(0, false);
    }
  }

  function init() {
    addUI();
    const drop = $('pdf-images-drop'), input = $('pdf-images-input');
    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', () => setFile(input.files && input.files[0]));
    drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', event => {
      event.preventDefault(); drop.classList.remove('dragover');
      setFile(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]);
    });
    $('pdf-images-remove').addEventListener('click', clearFile);
    $('pdf-images-run').addEventListener('click', run);
    $('pdf-images-cancel').addEventListener('click', () => { cancelled = true; status('Cancelling after the current page…'); });
    $('pdf-images-format').addEventListener('change', () => {
      $('pdf-images-quality-wrap').style.display = $('pdf-images-format').value === 'jpeg' ? 'flex' : 'none';
    });
    $('pdf-images-quality').addEventListener('input', () => {
      $('pdf-images-quality-value').textContent = $('pdf-images-quality').value + '%';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
