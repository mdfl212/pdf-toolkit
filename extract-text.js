(() => {
  'use strict';
  const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
  const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
  const $ = id => document.getElementById(id);
  let file = null, busy = false, cancelled = false;

  function addUI() {
    if ($('panel-extract-text')) return;
    const quick = [...document.querySelectorAll('.tool-section')].find(s => s.querySelector('[data-panel="compress"]'));
    if (quick) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tool-btn'; b.dataset.panel = 'extract-text';
      b.textContent = '📄 Extract Text to TXT';
      quick.insertBefore(b, quick.querySelector('[data-panel="compress"]'));
    }
    const mobile = $('mobile-tools-grid');
    if (mobile) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mobile-tool-card'; b.dataset.panel = 'extract-text';
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h5M8 12h8M8 16h8"/></svg><span>Extract Text</span>';
      const before = mobile.querySelector('[data-panel="compress"]');
      if (before) mobile.insertBefore(b, before); else mobile.appendChild(b);
    }
    const panel = document.createElement('section');
    panel.className = 'panel'; panel.id = 'panel-extract-text';
    panel.innerHTML = [
      '<h2>Extract Text to TXT</h2>',
      '<p class="subtitle">Export selectable text from a PDF into a plain-text file. Choose specific pages or extract the whole document. Scanned pages need OCR first.</p>',
      '<div class="drop-zone" id="extract-text-drop"><div class="drop-icon">📄</div><p><strong>Drop a PDF here</strong> or click to browse</p><p class="hint">The PDF is processed locally in this browser and is not uploaded.</p><input type="file" accept=".pdf,application/pdf" hidden id="extract-text-input"></div>',
      '<div id="extract-text-file-card" class="file-item" style="display:none;margin-bottom:18px"><div class="file-icon">PDF</div><div class="file-info"><div class="file-name" id="extract-text-file-name"></div><div class="file-meta" id="extract-text-file-size"></div></div><button type="button" class="btn btn-secondary btn-sm" id="extract-text-remove">Remove</button></div>',
      '<div class="controls" style="flex-direction:column;align-items:stretch;gap:14px">',
      '<div class="control-group"><label for="extract-text-pages">Pages to extract</label><input type="text" id="extract-text-pages" placeholder="Leave blank for all, or e.g. 1-5, 8, 12-14" style="min-width:100%;font-family:\'JetBrains Mono\',monospace"><span class="hint">Page numbers start at 1. Ranges are exported in ascending page order.</span></div>',
      '<label style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="extract-text-markers" checked style="min-width:0"> Include page-number separators</label>',
      '<div class="note" style="margin:0">This extracts text already stored in the PDF. It does not recognize text inside scanned page images. If the output is empty or incomplete, run OCR &amp; Searchable PDF first. Layouts with columns, tables, equations, or complex formatting may not preserve their visual arrangement.</div>',
      '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"><button type="button" class="btn btn-primary" id="extract-text-run" disabled>Extract text &amp; download TXT</button><button type="button" class="btn btn-secondary" id="extract-text-cancel" disabled>Cancel</button></div>',
      '<div class="progress-bar" id="extract-text-progress-wrap" style="display:none"><div class="fill" id="extract-text-progress-fill"></div></div>',
      '<div id="extract-text-status" class="note" role="status" aria-live="polite" style="display:none;margin:0"></div>',
      '<div id="extract-text-result" class="note" style="display:none;margin:0"></div></div>'
    ].join('');
    const before = $('panel-compress');
    if (before) before.parentNode.insertBefore(panel, before);
    else document.querySelector('main')?.appendChild(panel);

    document.querySelectorAll('[data-panel="extract-text"]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-extract-text'));
      document.querySelectorAll('.tool-btn').forEach(t => t.classList.toggle('active', t.dataset.panel === 'extract-text'));
      document.querySelectorAll('.mobile-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'tools'));
      document.querySelector('.mobile-tools-sheet.open')?.classList.remove('open');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
  }

  function status(message, error = false) {
    const el = $('extract-text-status');
    el.style.display = message ? 'block' : 'none';
    el.textContent = message || '';
    el.style.borderColor = error ? 'var(--danger)' : 'var(--border)';
  }
  function progress(percent, show = true) {
    $('extract-text-progress-wrap').style.display = show ? 'block' : 'none';
    $('extract-text-progress-fill').style.width = Math.max(0, Math.min(100, percent)) + '%';
  }
  function setBusy(value) {
    busy = value;
    $('extract-text-run').disabled = value || !file;
    $('extract-text-cancel').disabled = !value;
    $('extract-text-remove').disabled = value;
  }
  function setFile(selected) {
    if (!selected) return;
    if (selected.type !== 'application/pdf' && !/\.pdf$/i.test(selected.name)) return status('Please choose a PDF file.', true);
    file = selected;
    $('extract-text-file-name').textContent = selected.name;
    $('extract-text-file-size').textContent = 'File size: ' + (selected.size / 1048576).toFixed(2) + ' MB';
    $('extract-text-file-card').style.display = 'flex';
    $('extract-text-drop').style.display = 'none';
    $('extract-text-run').disabled = busy;
    $('extract-text-result').style.display = 'none';
    status('');
  }
  function clearFile() {
    if (busy) return;
    file = null;
    $('extract-text-input').value = '';
    $('extract-text-file-card').style.display = 'none';
    $('extract-text-drop').style.display = '';
    $('extract-text-run').disabled = true;
    $('extract-text-result').style.display = 'none';
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
  function downloadText(text, name) {
    const blob = new Blob(['\uFEFF', text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function pageText(items) {
    let out = '', previousY = null, previousEndX = null;
    for (const item of items) {
      const value = String(item.str || '');
      if (!value) continue;
      const transform = item.transform || [];
      const x = Number(transform[4]) || 0;
      const y = Number(transform[5]) || 0;
      if (previousY !== null && Math.abs(y - previousY) > 3) {
        out = out.replace(/[ \t]+$/, '') + '\n';
        previousEndX = null;
      } else if (previousEndX !== null && x - previousEndX > 1.5 && !/^[,.;:!?%)\]}]/.test(value) && !/[([{\/$-]$/.test(out)) {
        out += ' ';
      }
      out += value;
      previousY = y;
      previousEndX = x + (Number(item.width) || 0);
      if (item.hasEOL) {
        out = out.replace(/[ \t]+$/, '') + '\n';
        previousY = null;
        previousEndX = null;
      }
    }
    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  async function run() {
    if (!file || busy) return;
    cancelled = false; setBusy(true); progress(0); $('extract-text-result').style.display = 'none';
    let documentProxy = null;
    try {
      status('Opening PDF…');
      const bytes = await file.arrayBuffer();
      const pdfjs = await loadPdfJs();
      documentProxy = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
      const pages = parseRanges($('extract-text-pages').value, documentProxy.numPages);
      const includeMarkers = $('extract-text-markers').checked;
      const chunks = [];
      let emptyPages = 0, characterCount = 0;
      for (let i = 0; i < pages.length; i++) {
        if (cancelled) throw new Error('Extraction cancelled.');
        const pageNumber = pages[i];
        status('Extracting page ' + pageNumber + ' (' + (i + 1) + ' of ' + pages.length + ')…');
        const page = await documentProxy.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = pageText(content.items || []);
        if (!text) emptyPages++;
        if (includeMarkers) chunks.push('========== PAGE ' + pageNumber + ' ==========\n' + (text || '[No selectable text found on this page]'));
        else if (text) chunks.push(text);
        characterCount += text.length;
        progress((i + 1) / pages.length * 95);
      }
      if (cancelled) throw new Error('Extraction cancelled.');
      if (characterCount === 0) throw new Error('No selectable text was found on the selected pages. For scanned pages, use OCR & Searchable PDF first.');
      const output = chunks.join('\n\n');
      const baseName = file.name.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]+/g, '_') || 'document';
      downloadText(output + '\n', baseName + '-extracted-text.txt');
      progress(100);
      $('extract-text-result').textContent = 'Text file created. Pages processed: ' + pages.length + '. Characters extracted: ' + characterCount.toLocaleString() + '. Pages with no selectable text: ' + emptyPages + '. Review line breaks and tables before reusing the text.';
      $('extract-text-result').style.display = 'block';
      status('TXT download started.');
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      status(/cancelled/i.test(message) ? 'Extraction cancelled. No file was downloaded.' : 'Text extraction failed: ' + message, !/cancelled/i.test(message));
    } finally {
      if (documentProxy) { try { await documentProxy.destroy(); } catch (_) {} }
      setBusy(false); progress(0, false);
    }
  }

  function init() {
    addUI();
    const drop = $('extract-text-drop'), input = $('extract-text-input');
    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', () => setFile(input.files && input.files[0]));
    drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', event => {
      event.preventDefault(); drop.classList.remove('dragover');
      setFile(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]);
    });
    $('extract-text-remove').addEventListener('click', clearFile);
    $('extract-text-run').addEventListener('click', run);
    $('extract-text-cancel').addEventListener('click', () => { cancelled = true; status('Cancelling after the current page…'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
