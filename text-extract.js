(() => {
  'use strict';
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
  const $ = id => document.getElementById(id);
  let file = null, busy = false, cancelled = false;

  function addUI() {
    if ($('panel-text-extract')) return;
    const quick = [...document.querySelectorAll('.tool-section')].find(s => s.querySelector('[data-panel="compress"]'));
    if (quick) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tool-btn'; b.dataset.panel = 'text-extract';
      b.textContent = '📄 Extract PDF Text';
      quick.insertBefore(b, quick.querySelector('[data-panel="compress"]'));
    }
    const mobile = $('mobile-tools-grid');
    if (mobile) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mobile-tool-card'; b.dataset.panel = 'text-extract';
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h9l5 5v13H5z"/><path d="M14 3v6h5M8 13h8M8 17h8"/></svg><span>Extract Text</span>';
      mobile.insertBefore(b, mobile.querySelector('[data-panel="compress"]'));
    }
    const panel = document.createElement('section');
    panel.className = 'panel'; panel.id = 'panel-text-extract';
    panel.innerHTML = [
      '<h2>Extract PDF Text</h2>',
      '<p class="subtitle">Export selectable text from a PDF into a plain-text file. Useful for notes, study excerpts, and preparing smaller text selections for an LLM.</p>',
      '<div class="drop-zone" id="text-extract-drop"><div class="drop-icon">📄</div><p><strong>Drop a PDF here</strong> or click to browse</p><p class="hint">Processed locally in your browser; your PDF is not uploaded.</p><input type="file" accept=".pdf,application/pdf" hidden id="text-extract-input"></div>',
      '<div id="text-extract-file-card" class="file-item" style="display:none;margin-bottom:18px"><div class="file-icon">PDF</div><div class="file-info"><div class="file-name" id="text-extract-file-name"></div><div class="file-meta" id="text-extract-file-size"></div></div><button type="button" class="btn btn-secondary btn-sm" id="text-extract-remove">Remove</button></div>',
      '<div class="controls" style="flex-direction:column;align-items:stretch;gap:14px">',
      '<div class="control-group"><label for="text-extract-pages">Pages to extract</label><input type="text" id="text-extract-pages" placeholder="All pages, or e.g. 1-5, 8, 12-14" style="min-width:100%;font-family:JetBrains Mono,monospace"><span class="hint">Leave blank to extract all pages. Page numbers start at 1.</span></div>',
      '<div class="note" style="margin:0">This extracts text already stored in the PDF. Scanned pages without a text layer will be marked in the output; run <strong>OCR & Searchable PDF</strong> first, then extract text from the OCR result. Reading order may be imperfect in multi-column layouts, equations, or tables.</div>',
      '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"><button type="button" class="btn btn-primary" id="text-extract-run" disabled>Extract Text (.txt)</button><button type="button" class="btn btn-secondary" id="text-extract-cancel" disabled>Cancel</button></div>',
      '<div class="progress-bar" id="text-extract-progress-wrap" style="display:none"><div class="fill" id="text-extract-progress-fill"></div></div>',
      '<div id="text-extract-status" class="note" role="status" aria-live="polite" style="display:none;margin:0"></div><div id="text-extract-result" class="note" style="display:none;margin:0"></div></div>'
    ].join('');
    const before = $('panel-compress');
    if (before) before.parentNode.insertBefore(panel, before);
    else document.querySelector('main')?.appendChild(panel);
    document.querySelectorAll('[data-panel="text-extract"]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-text-extract'));
      document.querySelectorAll('.tool-btn').forEach(t => t.classList.toggle('active', t.dataset.panel === 'text-extract'));
      document.querySelectorAll('.mobile-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'tools'));
      const active = window.PDFToolkitGetActiveFile?.(); if (active && active !== file) setFile(active);
    }));
  }

  function status(message, error = false) {
    const el = $('text-extract-status');
    if (!el) return;
    el.textContent = message;
    el.style.display = message ? 'block' : 'none';
    el.style.borderColor = error ? 'var(--danger)' : 'var(--border)';
  }
  function setBusy(value) {
    busy = value;
    $('text-extract-run').disabled = value || !file;
    $('text-extract-cancel').disabled = !value;
    $('text-extract-remove').disabled = value;
    $('text-extract-input').disabled = value;
  }
  function setFile(next) {
    if (!next) return;
    if (next.type !== 'application/pdf' && !next.name.toLowerCase().endsWith('.pdf')) {
      status('Please choose a PDF file.', true); return;
    }
    file = next;
    if (window.PDFToolkitSetActiveFile && window.PDFToolkitGetActiveFile?.() !== next) window.PDFToolkitSetActiveFile(next);
    $('text-extract-file-name').textContent = next.name;
    $('text-extract-file-size').textContent = 'File size: ' + (next.size / 1048576).toFixed(2) + ' MB';
    $('text-extract-file-card').style.display = 'flex';
    $('text-extract-drop').style.display = 'none';
    $('text-extract-result').style.display = 'none';
    status('');
    setBusy(false);
  }
  window.PDFToolkitSetTextExtractFile = setFile;
  function clearFile() {
    if (busy) return;
    file = null; $('text-extract-input').value = '';
    $('text-extract-file-card').style.display = 'none';
    $('text-extract-drop').style.display = '';
    $('text-extract-result').style.display = 'none';
    status(''); setBusy(false);
  }
  function parseRanges(value, max) {
    const input = value.trim();
    if (!input) return Array.from({length:max}, (_, i) => i + 1);
    const pages = new Set();
    for (const part of input.split(',')) {
      const token = part.trim();
      if (!token) continue;
      const match = token.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
      if (!match) throw new Error('Invalid page range "' + token + '". Use values such as 1-5, 8, 12-14.');
      const start = Number(match[1]), end = match[2] ? Number(match[2]) : start;
      if (start < 1 || end < start || end > max) throw new Error('Page range "' + token + '" is outside this PDF. It has ' + max + ' pages.');
      for (let p = start; p <= end; p++) pages.add(p);
    }
    if (!pages.size) throw new Error('Enter at least one page number or leave the field blank for all pages.');
    return [...pages].sort((a,b) => a-b);
  }
  function reconstructText(items) {
    const positioned = items
      .filter(item => typeof item.str === 'string' && item.str.length)
      .map(item => ({
        text: item.str,
        x: Number(item.transform?.[4] || 0),
        y: Number(item.transform?.[5] || 0),
        width: Number(item.width || 0),
        height: Math.abs(Number(item.height || item.transform?.[3] || 0))
      }));
    if (!positioned.length) return '';
    positioned.sort((a,b) => Math.abs(b.y-a.y) > 2.5 ? b.y-a.y : a.x-b.x);
    const lines = [];
    for (const item of positioned) {
      let line = lines.find(candidate => Math.abs(candidate.y - item.y) <= Math.max(2.5, Math.min(5, item.height * 0.35)));
      if (!line) { line = {y:item.y, items:[]}; lines.push(line); }
      line.items.push(item);
    }
    lines.sort((a,b) => b.y-a.y);
    return lines.map(line => {
      line.items.sort((a,b) => a.x-b.x);
      let out = '', previous = null;
      for (const item of line.items) {
        if (previous) {
          const gap = item.x - (previous.x + previous.width);
          if (gap > Math.max(2, previous.height * 0.18) && !/\s$/.test(out) && !/^[,.;:!?%)\]}]/.test(item.text)) out += ' ';
        }
        out += item.text;
        previous = item;
      }
      return out.trimEnd();
    }).filter(line => line.trim()).join('\n');
  }
  function downloadText(text, name) {
    const blob = new Blob(['\uFEFF', text], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function run() {
    if (!file || busy) return;
    cancelled = false; setBusy(true);
    $('text-extract-result').style.display = 'none';
    $('text-extract-progress-wrap').style.display = 'block';
    $('text-extract-progress-fill').style.width = '3%';
    let doc = null;
    try {
      status('Opening PDF…');
      const pdfjs = await import(PDFJS);
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
      const data = await file.arrayBuffer();
      doc = await pdfjs.getDocument({data}).promise;
      const pages = parseRanges($('text-extract-pages').value, doc.numPages);
      const sections = [];
      let textPages = 0, emptyPages = 0;
      for (let i = 0; i < pages.length; i++) {
        if (cancelled) throw new Error('Extraction cancelled.');
        const pageNo = pages[i];
        status('Extracting page ' + pageNo + ' (' + (i+1) + ' of ' + pages.length + ')…');
        const page = await doc.getPage(pageNo);
        const content = await page.getTextContent({includeMarkedContent:false});
        const text = reconstructText(content.items || []);
        if (text) { sections.push('===== PDF page ' + pageNo + ' =====\n\n' + text); textPages++; }
        else { sections.push('===== PDF page ' + pageNo + ' =====\n\n[No selectable text found. If this is a scanned page, run OCR & Searchable PDF first.]'); emptyPages++; }
        $('text-extract-progress-fill').style.width = Math.round((i+1)/pages.length*95) + '%';
      }
      if (cancelled) throw new Error('Extraction cancelled.');
      const output = sections.join('\n\n\n') + '\n';
      const base = file.name.replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'_') || 'document';
      downloadText(output, base + '-extracted-text.txt');
      $('text-extract-progress-fill').style.width = '100%';
      $('text-extract-result').textContent = 'Text export ready. Pages processed: ' + pages.length + '. Pages with selectable text: ' + textPages + '. Pages without selectable text: ' + emptyPages + '. Output: ' + (new Blob([output]).size / 1024).toFixed(1) + ' KB. Review reading order and page markers before using the text for study or AI tools.';
      $('text-extract-result').style.display = 'block';
      status('Text file download started.');
    } catch (error) {
      const message = error?.message || String(error);
      status(/cancelled/i.test(message) ? message : 'Text extraction failed: ' + message, !/cancelled/i.test(message));
    } finally {
      try { doc?.destroy(); } catch (_) {}
      $('text-extract-progress-wrap').style.display = 'none';
      setBusy(false);
    }
  }
  function init() {
    addUI();
    $('text-extract-drop').addEventListener('click', () => $('text-extract-input').click());
    $('text-extract-input').addEventListener('change', e => setFile(e.target.files?.[0]));
    $('text-extract-drop').addEventListener('dragover', e => { e.preventDefault(); $('text-extract-drop').classList.add('dragover'); });
    $('text-extract-drop').addEventListener('dragleave', () => $('text-extract-drop').classList.remove('dragover'));
    $('text-extract-drop').addEventListener('drop', e => { e.preventDefault(); $('text-extract-drop').classList.remove('dragover'); setFile(e.dataTransfer?.files?.[0]); });
    $('text-extract-remove').addEventListener('click', clearFile);
    $('text-extract-run').addEventListener('click', run);
    $('text-extract-cancel').addEventListener('click', () => { cancelled = true; status('Cancelling after the current page…'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();