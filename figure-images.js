(() => {
  'use strict';
  const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
  const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
  const $ = id => document.getElementById(id);
  let file = null, busy = false, cancelled = false, candidates = [];

  function addUI() {
    if ($('panel-figure-images')) return;
    const quick = [...document.querySelectorAll('.tool-section')].find(s => s.querySelector('[data-panel="compress"]'));
    if (quick) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tool-btn'; b.dataset.panel = 'figure-images';
      b.textContent = '🧬 Extract Figure Images';
      quick.insertBefore(b, quick.querySelector('[data-panel="compress"]'));
    }
    const mobile = $('mobile-tools-grid');
    if (mobile) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mobile-tool-card'; b.dataset.panel = 'figure-images';
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg><span>Extract Figures</span>';
      const before = mobile.querySelector('[data-panel="compress"]');
      if (before) mobile.insertBefore(b, before); else mobile.appendChild(b);
    }
    const panel = document.createElement('section');
    panel.className = 'panel'; panel.id = 'panel-figure-images';
    panel.innerHTML = [
      '<h2>Extract Figure Images</h2>',
      '<p class="subtitle">Find original embedded image assets in a PDF, filter out tiny decorative elements, review the candidates, and download selected images in a ZIP. Designed for textbook figures, pathology photographs, and illustrations.</p>',
      '<div class="drop-zone" id="figure-images-drop"><div class="drop-icon">🧬</div><p><strong>Drop a PDF here</strong> or click to browse</p><p class="hint">Processed locally in this browser. No PDF or extracted image is uploaded.</p><input type="file" accept=".pdf,application/pdf" hidden id="figure-images-input"></div>',
      '<div id="figure-images-file-card" class="file-item" style="display:none;margin-bottom:18px"><div class="file-icon">PDF</div><div class="file-info"><div class="file-name" id="figure-images-file-name"></div><div class="file-meta" id="figure-images-file-size"></div></div><button type="button" class="btn btn-secondary btn-sm" id="figure-images-remove">Remove</button></div>',
      '<div class="controls" style="flex-direction:column;align-items:stretch;gap:14px">',
      '<div class="control-group"><label for="figure-images-pages">Pages to scan</label><input type="text" id="figure-images-pages" placeholder="Leave blank for all, or e.g. 1-5, 8, 12-14" style="min-width:100%;font-family:\'JetBrains Mono\',monospace"><span class="hint">Page numbers start at 1. Narrow the range for very large books.</span></div>',
      '<div class="control-group"><label for="figure-images-min-size">Minimum image dimensions</label><select id="figure-images-min-size"><option value="64">Any size (64 × 64 px and up)</option><option value="120" selected>Standard filter (120 × 120 px and up)</option><option value="220">Large figures (220 × 220 px and up)</option><option value="350">High-detail figures (350 × 350 px and up)</option></select><span class="hint">This filters tiny assets, not all headers or decorations. Review the previews before exporting.</span></div>',
      '<div class="control-group"><label style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="figure-images-dedupe" checked style="min-width:0"> Skip exact repeated image objects</label></div>',
      '<div class="note" style="margin:0">Important: this extracts embedded image objects, not screenshots of whole pages. Some PDFs store a full page or a styled layout as one image; those cannot be separated into clean figures by file-size filtering alone. Vector-only diagrams may not appear. Review the candidates and deselect page backgrounds, logos, or unwanted assets.</div>',
      '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"><button type="button" class="btn btn-primary" id="figure-images-scan" disabled>Find images</button><button type="button" class="btn btn-secondary" id="figure-images-cancel" disabled>Cancel scan</button><button type="button" class="btn btn-secondary" id="figure-images-select-all" disabled>Select all</button><button type="button" class="btn btn-secondary" id="figure-images-select-none" disabled>Select none</button><button type="button" class="btn btn-primary" id="figure-images-export" disabled>Download selected ZIP</button></div>',
      '<div class="progress-bar" id="figure-images-progress-wrap" style="display:none"><div class="fill" id="figure-images-progress-fill"></div></div>',
      '<div id="figure-images-status" class="note" role="status" aria-live="polite" style="display:none;margin:0"></div>',
      '<div id="figure-images-results" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,180px),1fr));gap:12px"></div>',
      '<div id="figure-images-result" class="note" style="display:none;margin:0"></div></div>'
    ].join('');
    const before = $('panel-compress');
    if (before) before.parentNode.insertBefore(panel, before);
    else document.querySelector('main')?.appendChild(panel);
    document.querySelectorAll('[data-panel="figure-images"]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-figure-images'));
      document.querySelectorAll('.tool-btn').forEach(t => t.classList.toggle('active', t.dataset.panel === 'figure-images'));
      document.querySelectorAll('.mobile-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'tools'));
      document.querySelector('.mobile-tools-sheet.open')?.classList.remove('open');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
  }

  function status(message, error = false) {
    const el = $('figure-images-status');
    el.style.display = message ? 'block' : 'none';
    el.textContent = message || '';
    el.style.borderColor = error ? 'var(--danger)' : 'var(--border)';
  }
  function progress(percent, show = true) {
    $('figure-images-progress-wrap').style.display = show ? 'block' : 'none';
    $('figure-images-progress-fill').style.width = Math.max(0, Math.min(100, percent)) + '%';
  }
  function setBusy(value) {
    busy = value;
    $('figure-images-scan').disabled = value || !file;
    $('figure-images-cancel').disabled = !value;
    $('figure-images-remove').disabled = value;
    $('figure-images-input').disabled = value;
  }
  function setFile(selected) {
    if (!selected) return;
    if (selected.type !== 'application/pdf' && !/\.pdf$/i.test(selected.name)) return status('Please choose a PDF file.', true);
    file = selected; candidates = [];
    $('figure-images-file-name').textContent = selected.name;
    $('figure-images-file-size').textContent = 'File size: ' + (selected.size / 1048576).toFixed(2) + ' MB';
    $('figure-images-file-card').style.display = 'flex';
    $('figure-images-drop').style.display = 'none';
    $('figure-images-scan').disabled = busy;
    $('figure-images-results').replaceChildren();
    $('figure-images-export').disabled = true;
    $('figure-images-result').style.display = 'none';
    status('');
  }
  function clearFile() {
    if (busy) return;
    file = null; candidates = [];
    $('figure-images-input').value = '';
    $('figure-images-file-card').style.display = 'none';
    $('figure-images-drop').style.display = '';
    $('figure-images-scan').disabled = true;
    $('figure-images-export').disabled = true;
    $('figure-images-results').replaceChildren();
    $('figure-images-result').style.display = 'none';
    status(''); progress(0, false);
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
    return [...pages].sort((a, b) => a - b);
  }
  async function loadPdfJs() {
    const lib = await import(PDFJS_URL);
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    return lib;
  }
  function imageObject(page, id) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = value => { if (!settled) { settled = true; resolve(value); } };
      try {
        const value = page.objs.get(id, done);
        if (value !== undefined && value !== null) done(value);
      } catch (error) { reject(error); }
    });
  }
  function toCanvasImage(obj) {
    const width = Number(obj && (obj.width || obj.bitmap && obj.bitmap.width));
    const height = Number(obj && (obj.height || obj.bitmap && obj.bitmap.height));
    if (!width || !height || width < 1 || height < 1) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return null;
    try {
      // PDF.js can expose decoded images as ImageBitmaps, image-like objects,
      // RGBA/RGB/grayscale buffers, or packed 1-bit grayscale data.
      const drawable = obj.bitmap || (typeof ImageBitmap !== 'undefined' && obj instanceof ImageBitmap ? obj : null);
      if (drawable && typeof ctx.drawImage === 'function') {
        ctx.drawImage(drawable, 0, 0, width, height);
      } else if (obj.data && obj.data.length === width * height * 4) {
        ctx.putImageData(new ImageData(new Uint8ClampedArray(obj.data), width, height), 0, 0);
      } else if (obj.data && obj.data.length === width * height * 3) {
        const rgba = new Uint8ClampedArray(width * height * 4);
        for (let i = 0, j = 0; i < obj.data.length; i += 3, j += 4) {
          rgba[j] = obj.data[i]; rgba[j + 1] = obj.data[i + 1]; rgba[j + 2] = obj.data[i + 2]; rgba[j + 3] = 255;
        }
        ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
      } else if (obj.data && obj.data.length === width * height) {
        const rgba = new Uint8ClampedArray(width * height * 4);
        for (let i = 0, j = 0; i < obj.data.length; i++, j += 4) {
          rgba[j] = rgba[j + 1] = rgba[j + 2] = obj.data[i]; rgba[j + 3] = 255;
        }
        ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
      } else if (obj.data && obj.data.length === Math.ceil(width / 8) * height) {
        // PDF.js ImageKind.GRAYSCALE_1BPP uses packed bits. Expand each bit
        // into a visible grayscale pixel; avoid assuming a byte per pixel.
        const rgba = new Uint8ClampedArray(width * height * 4);
        const rowBytes = Math.ceil(width / 8);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const byte = obj.data[y * rowBytes + (x >> 3)];
            const value = (byte & (0x80 >> (x & 7))) ? 255 : 0;
            const j = (y * width + x) * 4;
            rgba[j] = rgba[j + 1] = rgba[j + 2] = value;
            rgba[j + 3] = 255;
          }
        }
        ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
      } else {
        canvas.width = 0; canvas.height = 0; return null;
      }
      return canvas;
    } catch (_) {
      canvas.width = 0; canvas.height = 0; return null;
    }
  }
  function hashCanvas(canvas) {
    try {
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      const sample = ctx.getImageData(0, 0, w, h).data;
      let hash = 2166136261;
      const step = Math.max(4, Math.floor(sample.length / 4096 / 4) * 4);
      for (let i = 0; i < sample.length; i += step) hash = Math.imul(hash ^ sample[i], 16777619);
      return w + 'x' + h + ':' + (hash >>> 0).toString(16);
    } catch (_) { return canvas.width + 'x' + canvas.height; }
  }
  function safeName(name) { return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'document'; }

  function slugName(value) {
    return safeName(String(value || 'untitled').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^[_ .-]+|[_ .-]+$/g, '')).slice(0, 100) || 'untitled';
  }
  function extractCaptionLines(textContent) {
    const lines = [];
    for (const item of textContent.items || []) {
      if (!item.str || !item.str.trim() || !Array.isArray(item.transform)) continue;
      const y = Number(item.transform[5]);
      if (!Number.isFinite(y)) continue;
      let line = lines.find(entry => Math.abs(entry.y - y) < 2.5);
      if (!line) { line = { y, parts: [] }; lines.push(line); }
      line.parts.push({ x: Number(item.transform[4]) || 0, text: item.str.trim() });
    }
    return lines.map(line => line.parts.sort((a, b) => a.x - b.x).map(part => part.text).join(' ').replace(/\\s+/g, ' ').trim())
      .filter(text => /^(?:fig(?:ure)?s?\\.?)[ \\u00a0]*[A-Z]?\\d+(?:[.-]\\d+)*(?:[A-Z])?\\b/i.test(text))
      .map(text => {
        const match = text.match(/^(?:fig(?:ure)?s?\\.?)[ \\u00a0]*([A-Z]?\\d+(?:[.-]\\d+)*(?:[A-Z])?)\\s*[.:)-]?\\s*(.*)$/i);
        return match ? { number: match[1], caption: (match[2] || '').trim(), text } : { number: '', caption: text, text };
      });
  }
  function assignPageCaptions(items, captions) {
    if (!captions.length) return;
    // This is a suggestion, not a guarantee: some PDFs don't preserve a reliable
    // reading order. Users can edit the filename label before exporting.
    items.forEach((item, index) => {
      const cap = captions.length === 1 ? captions[0] : captions[Math.min(index, captions.length - 1)];
      if (!cap) return;
      item.figureNumber = cap.number || '';
      item.caption = cap.caption || cap.text || '';
      item.label = [item.figureNumber ? 'Fig_' + item.figureNumber : '', item.caption].filter(Boolean).join('_');
      item.captionSuggested = true;
    });
  }
  function cardFor(item, index) {
    const card = document.createElement('label');
    card.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface);min-width:0;cursor:pointer';
    const img = document.createElement('img');
    img.src = item.url; img.alt = 'Extracted image candidate ' + (index + 1);
    img.style.cssText = 'width:100%;height:150px;object-fit:contain;background:#fff;border-radius:6px';
    const checkRow = document.createElement('span');
    checkRow.style.cssText = 'display:flex;gap:8px;align-items:flex-start;font-size:.85rem;overflow-wrap:anywhere';
    const check = document.createElement('input');
    check.type = 'checkbox'; check.checked = true; check.dataset.index = String(index); check.style.cssText = 'min-width:0;margin-top:5px';
    checkRow.append(check, document.createTextNode('Page ' + item.page + ' · ' + item.width + ' × ' + item.height));
    const labelWrap = document.createElement('span');
    labelWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;font-size:.8rem';
    const label = document.createElement('span');
    label.textContent = 'Filename label';
    const labelInput = document.createElement('input');
    labelInput.type = 'text'; labelInput.value = item.label || ('Page_' + item.page + '_Image_' + (index + 1));
    labelInput.setAttribute('aria-label', 'Filename label for image ' + (index + 1));
    labelInput.style.cssText = 'width:100%;min-width:0;box-sizing:border-box';
    labelInput.addEventListener('input', () => { item.label = labelInput.value; });
    labelWrap.append(label, labelInput);
    const meta = document.createElement('span');
    meta.style.cssText = 'font-size:.75rem;color:var(--text-muted);overflow-wrap:anywhere';
    meta.textContent = (item.figureNumber ? 'Detected figure ' + item.figureNumber + ' · ' : '') + 'Page ' + item.page + ' · ' + Math.round(item.bytes / 1024) + ' KB';
    card.append(img, checkRow, labelWrap, meta);
    check.addEventListener('change', updateSelection);
    return card;
  }
  function updateSelection() {
    const selected = $('figure-images-results').querySelectorAll('input[type="checkbox"]:checked').length;
    $('figure-images-export').disabled = busy || selected === 0;
    $('figure-images-export').textContent = selected ? 'Download selected (' + selected + ') ZIP' : 'Download selected ZIP';
  }
  async function scan() {
    if (!file || busy) return;
    cancelled = false; setBusy(true); candidates = [];
    $('figure-images-results').replaceChildren();
    $('figure-images-export').disabled = true;
    $('figure-images-select-all').disabled = true; $('figure-images-select-none').disabled = true;
    $('figure-images-result').style.display = 'none'; progress(0);
    let doc = null;
    try {
      if (!window.JSZip) throw new Error('ZIP library did not load. Refresh the page and try again.');
      status('Opening PDF…');
      const pdfjs = await loadPdfJs();
      doc = await pdfjs.getDocument({ data: (await file.arrayBuffer()).slice(0) }).promise;
      const pages = parseRanges($('figure-images-pages').value, doc.numPages);
      const minSize = Number($('figure-images-min-size').value) || 120;
      const seen = new Set();
      let ignored = 0, opCount = 0;
      for (let p = 0; p < pages.length; p++) {
        if (cancelled) throw new Error('Scan cancelled.');
        const pageNo = pages[p], page = await doc.getPage(pageNo);
        status('Scanning page ' + pageNo + ' (' + (p + 1) + ' of ' + pages.length + ')…');
        const textContent = await page.getTextContent();
        const pageCaptions = extractCaptionLines(textContent);
        const pageCandidates = [];
        const list = await page.getOperatorList();
        const OPS = pdfjs.OPS;
        for (let i = 0; i < list.fnArray.length; i++) {
          const fn = list.fnArray[i], args = list.argsArray[i] || [];
          if (fn !== OPS.paintImageXObject && fn !== OPS.paintInlineImageXObject && fn !== OPS.paintJpegXObject) continue;
          opCount++;
          if (cancelled) throw new Error('Scan cancelled.');
          let obj = null;
          try {
            if (fn === OPS.paintInlineImageXObject) obj = args[0];
            else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) obj = await imageObject(page, args[0]);
          } catch (_) { obj = null; }
          const canvas = toCanvasImage(obj);
          if (!canvas) { ignored++; continue; }
          const width = canvas.width, height = canvas.height;
          if (width < minSize || height < minSize || width * height < minSize * minSize) {
            ignored++; canvas.width = 0; canvas.height = 0; continue;
          }
          const hash = hashCanvas(canvas);
          if ($('figure-images-dedupe').checked && seen.has(hash)) {
            ignored++; canvas.width = 0; canvas.height = 0; continue;
          }
          seen.add(hash);
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
          if (!blob) { ignored++; canvas.width = 0; canvas.height = 0; continue; }
          const url = URL.createObjectURL(blob);
          const item = { page: pageNo, width, height, blob, url, bytes: blob.size, hash, name: 'figure-' + String(candidates.length + 1).padStart(4, '0') + '.png', label: 'Page_' + pageNo + '_Image_' + (pageCandidates.length + 1), figureNumber: '', caption: '' };
          pageCandidates.push(item);
          candidates.push(item);
          canvas.width = 0; canvas.height = 0;
        }
        assignPageCaptions(pageCandidates, pageCaptions);
        progress((p + 1) / pages.length * 95);
        try { page.cleanup(); } catch (_) {}
      }
      if (cancelled) throw new Error('Scan cancelled.');
      $('figure-images-results').replaceChildren(...candidates.map(cardFor));
      $('figure-images-select-all').disabled = candidates.length === 0;
      $('figure-images-select-none').disabled = candidates.length === 0;
      updateSelection();
      $('figure-images-result').textContent = 'Found ' + candidates.length + ' image candidate(s); skipped ' + ignored + ' small, repeated, unsupported, or undecodable object(s). ' + opCount + ' image drawing operation(s) were inspected. Candidate review is important: image size cannot reliably tell a medical figure from a decorative asset.';
      $('figure-images-result').style.display = 'block';
      status(candidates.length ? 'Review the image candidates below, then download the selected ones.' : 'No extractable image candidates met the current filter. Try a lower minimum size or a different PDF.');
      progress(100);
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      status(/cancelled/i.test(message) ? 'Scan cancelled.' : 'Image scan failed: ' + message, !/cancelled/i.test(message));
    } finally {
      if (doc) { try { await doc.destroy(); } catch (_) {} }
      setBusy(false); progress(0, false);
    }
  }
  async function exportZip() {
    if (busy || !candidates.length || !window.JSZip) return;
    const checks = [...$('figure-images-results').querySelectorAll('input[type="checkbox"]')];
    const chosen = checks.filter(c => c.checked).map(c => candidates[Number(c.dataset.index)]).filter(Boolean);
    if (!chosen.length) return;
    setBusy(true);
    try {
      const zip = new JSZip(), base = safeName(file ? file.name.replace(/\.pdf$/i, '') : 'document');
      const usedNames = new Set();
      const manifest = [['filename', 'figure_number', 'caption', 'source_page', 'width_px', 'height_px'].join(',')];
      chosen.forEach((item, i) => {
        let stem = slugName(item.label || ('Page_' + item.page + '_Image_' + (i + 1)));
        const key = stem.toLowerCase();
        const uniqueStem = usedNames.has(key) ? stem + '_page' + item.page + '_' + (i + 1) : stem;
        usedNames.add(uniqueStem.toLowerCase());
        const filename = uniqueStem + '.png';
        zip.file(filename, item.blob);
        const csv = value => '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
        manifest.push([filename, item.figureNumber || '', item.caption || '', item.page, item.width, item.height].map(csv).join(','));
      });
      zip.file('manifest.csv', manifest.join('\\r\\n'));
      status('Building ZIP file…'); progress(0.9);
      const blob = await zip.generateAsync({ type: 'blob' }, meta => progress(meta.percent || 0));
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = base + '-extracted-images.zip'; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status('ZIP download started.');
    } catch (error) { status('Could not create ZIP: ' + (error.message || error), true); }
    finally { setBusy(false); progress(0, false); updateSelection(); }
  }
  function init() {
    addUI();
    const drop = $('figure-images-drop'), input = $('figure-images-input');
    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', () => setFile(input.files && input.files[0]));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('dragover'); setFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
    $('figure-images-remove').addEventListener('click', clearFile);
    $('figure-images-scan').addEventListener('click', scan);
    $('figure-images-cancel').addEventListener('click', () => { cancelled = true; status('Cancelling after the current image…'); });
    $('figure-images-select-all').addEventListener('click', () => { $('figure-images-results').querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = true); updateSelection(); });
    $('figure-images-select-none').addEventListener('click', () => { $('figure-images-results').querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false); updateSelection(); });
    $('figure-images-export').addEventListener('click', exportZip);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
