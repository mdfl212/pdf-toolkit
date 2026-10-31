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
      '<div class="note" style="margin:0 0 8px"><strong>Fallback: render and crop a whole figure</strong><br>Use this when a diagram is made from vector lines, text, and multiple image pieces. Choose a page, render it, then drag on the page to select the complete figure. This works in the browser on Android too.</div>',
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:10px;align-items:end">',
      '<div class="control-group"><label for="figure-crop-page">PDF page number</label><input type="number" id="figure-crop-page" min="1" value="1" style="width:100%;box-sizing:border-box"></div>',
      '<button type="button" class="btn btn-secondary" id="figure-crop-render" disabled>Render page</button>',
      '<button type="button" class="btn btn-secondary" id="figure-crop-clear" disabled>Clear selection</button>',
      '<button type="button" class="btn btn-primary" id="figure-crop-add" disabled>Add crop</button>',
      '<button type="button" class="btn btn-primary" id="figure-crop-download" disabled>Download crops ZIP (0)</button>',
      '</div>',
      '<p class="hint">Tip: zoom your browser if needed. Drag around the figure; the crop is saved at the rendered page resolution. You can include labels and captions by making the selection larger.</p>',
      '<div id="figure-crop-stage" style="display:none;position:relative;width:100%;overflow:auto;border:1px solid var(--border);border-radius:8px;background:#eee;touch-action:pan-y">',
      '<canvas id="figure-crop-page-canvas" style="display:block;width:100%;height:auto;touch-action:pan-y"></canvas>',
      '<canvas id="figure-crop-overlay" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair"></canvas>',
      '</div>',

      '<div class="note" style="margin-top:18px"><strong>Interactive PDF crop workspace</strong><br>Automatically suggest figure and table regions, then review and adjust the outlines directly on the pages. Suggestions are drafts: verify every boundary before export.</div>',
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:10px;align-items:end;margin:12px 0">',
      '<div class="control-group"><label for="figure-workspace-pages">Pages to display and analyze</label><input type="text" id="figure-workspace-pages" placeholder="Blank = all pages; or 1-10, 15" style="width:100%;box-sizing:border-box"><span class="hint">For very large textbooks, start with a chapter range to limit memory use.</span></div>',
      '<button type="button" class="btn btn-primary" id="figure-workspace-auto" disabled>Auto-suggest crops</button>',
      '<button type="button" class="btn btn-secondary" id="figure-workspace-add" disabled>Add crop</button>',
      '<button type="button" class="btn btn-secondary" id="figure-workspace-remove" disabled>Remove selected</button>',
      '<button type="button" class="btn btn-primary" id="figure-workspace-export" disabled>Export reviewed crops (0)</button>',
      '</div>',
      '<p class="hint">Tap a crop outline to select it. Drag inside to move it; drag a corner handle to resize. To add a crop, tap “Add crop” and drag on a page. Includes figures, graphs, flowcharts, and table-caption-based suggestions where detectable.</p>',
      '<div id="figure-workspace-status" class="note" role="status" aria-live="polite" style="display:none"></div>',
      '<div id="figure-workspace-pages-root" style="display:grid;gap:16px"></div>',
      '<div id="figure-workspace-crops" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,170px),1fr));gap:10px;margin-top:12px"></div>',
      '<div id="figure-crop-status" class="note" style="display:none;margin:8px 0"></div>',
      '<div id="figure-crop-queue" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,140px),1fr));gap:10px"></div>',
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
      const active = window.PDFToolkitGetActiveFile?.(); if (active && active !== file) setFile(active);
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
    file = selected;
    if (window.PDFToolkitSetActiveFile && window.PDFToolkitGetActiveFile?.() !== selected) window.PDFToolkitSetActiveFile(selected);
    candidates = [];
    $('figure-images-file-name').textContent = selected.name;
    $('figure-images-file-size').textContent = 'File size: ' + (selected.size / 1048576).toFixed(2) + ' MB';
    $('figure-images-file-card').style.display = 'flex';
    $('figure-images-drop').style.display = 'none';
    $('figure-images-scan').disabled = busy;
    if ($('figure-crop-render')) $('figure-crop-render').disabled = busy;
    if ($('figure-workspace-auto')) $('figure-workspace-auto').disabled = busy;
    if ($('figure-workspace-add')) $('figure-workspace-add').disabled = true;
    if ($('figure-workspace-export')) $('figure-workspace-export').disabled = true;
    if ($('figure-workspace-pages-root')) $('figure-workspace-pages-root').replaceChildren();
    workspaceBoxes = []; workspaceSelected = null; workspacePages.clear(); if (workspaceDoc) { try { workspaceDoc.destroy(); } catch (_) {} workspaceDoc = null; }
    $('figure-images-results').replaceChildren();
    $('figure-images-export').disabled = true;
    $('figure-images-result').style.display = 'none';
    status('');
  }
  window.PDFToolkitSetFigureImagesFile = setFile;
  function clearFile() {
    if (busy) return;
    file = null; candidates = [];
    $('figure-images-input').value = '';
    $('figure-images-file-card').style.display = 'none';
    $('figure-images-drop').style.display = '';
    $('figure-images-scan').disabled = true;
    if ($('figure-crop-render')) $('figure-crop-render').disabled = true;
    if ($('figure-workspace-auto')) $('figure-workspace-auto').disabled = true;
    if ($('figure-workspace-add')) $('figure-workspace-add').disabled = true;
    if ($('figure-workspace-export')) $('figure-workspace-export').disabled = true;
    if ($('figure-workspace-pages-root')) $('figure-workspace-pages-root').replaceChildren();
    workspaceBoxes = []; workspaceSelected = null; workspacePages.clear(); if (workspaceDoc) { try { workspaceDoc.destroy(); } catch (_) {} workspaceDoc = null; }
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
    return lines.map(line => line.parts.sort((a, b) => a.x - b.x).map(part => part.text).join(' ').replace(/\s+/g, ' ').trim())
      .filter(text => /^(?:fig(?:ure)?s?\.?)[ \u00a0]*[A-Z]?\d+(?:[.-]\d+)*(?:[A-Z])?\b/i.test(text))
      .map(text => {
        const match = text.match(/^(?:fig(?:ure)?s?\.?)[ \u00a0]*([A-Z]?\d+(?:[.-]\d+)*(?:[A-Z])?)\s*[.:)-]?\s*(.*)$/i);
        return match ? { number: match[1], caption: (match[2] || '').trim(), text } : { number: '', caption: text, text };
      });
  }
  function assignPageCaptions(items, captions) {
    if (!captions.length) return;
    // Auto-label only when there is one caption on the page or a one-to-one
    // count. Other layouts are ambiguous, so leave their labels editable/manual.
    if (captions.length !== 1 && captions.length !== items.length) return;
    items.forEach((item, index) => {
      const cap = captions.length === 1 ? captions[0] : captions[index];
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
  let cropPageCanvas = null, cropOverlay = null, cropSelection = null, cropDrag = null, cropQueue = [];
  function cropStatus(message, error = false) {
    const el = $('figure-crop-status');
    if (!el) return;
    el.style.display = message ? 'block' : 'none';
    el.textContent = message || '';
    el.style.borderColor = error ? 'var(--danger)' : 'var(--border)';
  }
  function drawCropSelection() {
    if (!cropOverlay) return;
    const ctx = cropOverlay.getContext('2d');
    ctx.clearRect(0, 0, cropOverlay.width, cropOverlay.height);
    if (!cropSelection) return;
    const { x, y, w, h } = cropSelection;
    ctx.save();
    ctx.fillStyle = 'rgba(20, 120, 220, 0.12)';
    ctx.strokeStyle = '#1677d2';
    ctx.lineWidth = Math.max(2, cropOverlay.width / 700);
    ctx.setLineDash([8, 5]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
  function setupCropOverlay() {
    cropPageCanvas = $('figure-crop-page-canvas');
    cropOverlay = $('figure-crop-overlay');
    cropOverlay.width = cropPageCanvas.width;
    cropOverlay.height = cropPageCanvas.height;
    cropSelection = null;
    drawCropSelection();
    const point = e => {
      const r = cropOverlay.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(cropOverlay.width, (e.clientX - r.left) * cropOverlay.width / r.width)),
        y: Math.max(0, Math.min(cropOverlay.height, (e.clientY - r.top) * cropOverlay.height / r.height))
      };
    };
    cropOverlay.onpointerdown = e => {
      e.preventDefault();
      cropOverlay.setPointerCapture(e.pointerId);
      const p = point(e);
      cropDrag = { x: p.x, y: p.y };
      cropSelection = { x: p.x, y: p.y, w: 0, h: 0 };
      drawCropSelection();
    };
    cropOverlay.onpointermove = e => {
      if (!cropDrag) return;
      e.preventDefault();
      const p = point(e);
      cropSelection = { x: Math.min(cropDrag.x, p.x), y: Math.min(cropDrag.y, p.y), w: Math.abs(p.x - cropDrag.x), h: Math.abs(p.y - cropDrag.y) };
      drawCropSelection();
    };
    const finish = () => {
      cropDrag = null;
      const ok = cropSelection && cropSelection.w >= 12 && cropSelection.h >= 12;
      $('figure-crop-add').disabled = !ok;
      if (ok) cropStatus('Selection: ' + Math.round(cropSelection.w) + ' × ' + Math.round(cropSelection.h) + ' rendered pixels. Tap “Add crop” to save it.');
    };
    cropOverlay.onpointerup = finish;
    cropOverlay.onpointercancel = finish;
  }
  async function renderCropPage() {
    if (!file || busy) return;
    const pageNo = Number($('figure-crop-page').value);
    if (!Number.isInteger(pageNo) || pageNo < 1) return cropStatus('Enter a valid page number.', true);
    setBusy(true);
    $('figure-crop-render').disabled = true;
    cropStatus('Rendering page ' + pageNo + '…');
    try {
      const pdfjs = await loadPdfJs();
      const doc = await pdfjs.getDocument({ data: (await file.arrayBuffer()).slice(0) }).promise;
      if (pageNo > doc.numPages) throw new Error('This PDF has only ' + doc.numPages + ' page(s).');
      const page = await doc.getPage(pageNo);
      const base = page.getViewport({ scale: 1.8 });
      const maxWidth = 1800;
      const scale = Math.min(1.8, maxWidth / base.width);
      const viewport = page.getViewport({ scale });
      const canvas = $('figure-crop-page-canvas');
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      $('figure-crop-stage').style.display = 'block';
      setupCropOverlay();
      $('figure-crop-clear').disabled = false;
      $('figure-crop-add').disabled = true;
      cropStatus('Page ' + pageNo + ' rendered. Drag over the figure you want to crop.');
      try { page.cleanup(); } catch (_) {}
      await doc.destroy();
    } catch (error) {
      cropStatus('Could not render page: ' + (error.message || error), true);
    } finally {
      setBusy(false);
      $('figure-crop-render').disabled = !file;
    }
  }
  async function addCrop() {
    if (!cropPageCanvas || !cropSelection || cropSelection.w < 12 || cropSelection.h < 12) return;
    const { x, y, w, h } = cropSelection;
    const out = document.createElement('canvas');
    out.width = Math.round(w); out.height = Math.round(h);
    out.getContext('2d').drawImage(cropPageCanvas, Math.round(x), Math.round(y), out.width, out.height, 0, 0, out.width, out.height);
    const blob = await new Promise(resolve => out.toBlob(resolve, 'image/png'));
    out.width = 0; out.height = 0;
    if (!blob) return cropStatus('Could not encode this crop as PNG.', true);
    const pageNo = Number($('figure-crop-page').value);
    cropQueue.push({ blob, page: pageNo, width: Math.round(w), height: Math.round(h), name: 'Page_' + pageNo + '_Crop_' + cropQueue.length });
    renderCropQueue();
    cropSelection = null; drawCropSelection();
    $('figure-crop-add').disabled = true;
    cropStatus('Crop added. You can select another figure or page.');
  }
  function renderCropQueue() {
    const root = $('figure-crop-queue');
    root.replaceChildren();
    cropQueue.forEach((item, index) => {
      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid var(--border);border-radius:8px;padding:8px;min-width:0';
      const img = document.createElement('img');
      img.src = URL.createObjectURL(item.blob);
      img.style.cssText = 'width:100%;height:110px;object-fit:contain;background:#fff';
      const name = document.createElement('input');
      name.value = item.name; name.setAttribute('aria-label', 'Filename for crop ' + (index + 1));
      name.style.cssText = 'width:100%;box-sizing:border-box;margin-top:6px';
      name.addEventListener('input', () => { item.name = name.value; });
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'btn btn-secondary btn-sm'; remove.textContent = 'Remove';
      remove.style.cssText = 'margin-top:6px;width:100%';
      remove.addEventListener('click', () => { cropQueue.splice(index, 1); renderCropQueue(); });
      card.append(img, name, remove); root.append(card);
    });
    $('figure-crop-download').disabled = cropQueue.length === 0;
    $('figure-crop-download').textContent = 'Download crops ZIP (' + cropQueue.length + ')';
  }
  async function downloadCrops() {
    if (!cropQueue.length || !window.JSZip) return;
    const zip = new JSZip();
    const used = new Set();
    const rows = [['filename','source_page','width_px','height_px'].join(',')];
    cropQueue.forEach((item, i) => {
      let stem = slugName(item.name || ('Page_' + item.page + '_Crop_' + (i + 1)));
      if (used.has(stem.toLowerCase())) stem += '_' + (i + 1);
      used.add(stem.toLowerCase());
      const filename = stem + '.png';
      zip.file(filename, item.blob);
      rows.push([filename, item.page, item.width, item.height].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));
    });
    zip.file('manifest.csv', rows.join('\r\n'));
    cropStatus('Building crops ZIP…');
    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = safeName(file ? file.name.replace(/\.pdf$/i, '') : 'document') + '-figure-crops.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      cropStatus('Crop ZIP download started.');
    } catch (error) { cropStatus('Could not create ZIP: ' + (error.message || error), true); }
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
      zip.file('manifest.csv', manifest.join('\r\n'));
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

  let workspaceDoc = null, workspacePages = new Map(), workspaceBoxes = [], workspaceSelected = null, workspaceAddMode = false, workspaceDrag = null, workspaceBusy = false;
  const workspaceScale = 1.05;
  function workspaceStatus(message, error = false) {
    const el = $('figure-workspace-status'); if (!el) return;
    el.style.display = message ? 'block' : 'none'; el.textContent = message || '';
    el.style.borderColor = error ? 'var(--danger)' : 'var(--border)';
  }
  function workspaceUpdateButtons() {
    $('figure-workspace-add').disabled = !workspaceDoc || workspaceBusy;
    $('figure-workspace-remove').disabled = !workspaceSelected || workspaceBusy;
    $('figure-workspace-export').disabled = !workspaceBoxes.length || workspaceBusy;
    $('figure-workspace-export').textContent = 'Export reviewed crops (' + workspaceBoxes.length + ')';
  }
  function workspaceDrawPage(pageNo) {
    const entry = workspacePages.get(pageNo); if (!entry || !entry.overlay) return;
    const ctx = entry.overlay.getContext('2d'); ctx.clearRect(0, 0, entry.overlay.width, entry.overlay.height);
    for (const box of workspaceBoxes.filter(b => b.page === pageNo)) {
      const selected = box.id === workspaceSelected;
      ctx.save(); ctx.fillStyle = selected ? 'rgba(22,119,210,.16)' : 'rgba(22,163,74,.10)';
      ctx.strokeStyle = selected ? '#1677d2' : '#16a34a'; ctx.lineWidth = selected ? 3 : 2;
      ctx.fillRect(box.x, box.y, box.w, box.h); ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = selected ? '#1677d2' : '#15803d'; ctx.font = 'bold 12px sans-serif';
      ctx.fillRect(box.x, Math.max(0, box.y - 19), Math.min(Math.max(70, ctx.measureText(box.label).width + 12), entry.overlay.width - box.x), 19);
      ctx.fillStyle = '#fff'; ctx.fillText(box.label.slice(0, 42), box.x + 5, Math.max(13, box.y - 5), Math.max(40, entry.overlay.width - box.x - 8));
      if (selected) {
        ctx.fillStyle = '#1677d2';
        for (const [hx, hy] of [[box.x,box.y],[box.x+box.w,box.y],[box.x,box.y+box.h],[box.x+box.w,box.y+box.h]]) ctx.fillRect(hx-5,hy-5,10,10);
      }
      ctx.restore();
    }
  }
  function workspaceDrawAll() { for (const p of workspacePages.keys()) workspaceDrawPage(p); }
  function workspaceRenderList() {
    const root = $('figure-workspace-crops'); root.replaceChildren();
    workspaceBoxes.forEach(box => {
      const card = document.createElement('div'); card.style.cssText = 'border:1px solid var(--border);border-radius:8px;padding:8px;display:grid;gap:6px;min-width:0';
      const title = document.createElement('button'); title.type='button'; title.className='btn btn-secondary btn-sm'; title.textContent=(box.id===workspaceSelected?'● ':'')+'Page '+box.page+' · '+box.kind; title.addEventListener('click',()=>{workspaceSelected=box.id;workspaceDrawAll();workspaceRenderList();workspaceUpdateButtons();const node=workspacePages.get(box.page)?.node;node?.scrollIntoView({behavior:'smooth',block:'center'});});
      const label = document.createElement('input'); label.value=box.label; label.setAttribute('aria-label','Crop label'); label.style.cssText='width:100%;box-sizing:border-box'; label.addEventListener('input',()=>{box.label=label.value||'Crop';workspaceDrawPage(box.page);});
      const remove = document.createElement('button'); remove.type='button'; remove.className='btn btn-secondary btn-sm'; remove.textContent='Remove'; remove.addEventListener('click',()=>{workspaceBoxes=workspaceBoxes.filter(b=>b.id!==box.id);if(workspaceSelected===box.id)workspaceSelected=null;workspaceDrawAll();workspaceRenderList();workspaceUpdateButtons();});
      card.append(title,label,remove);root.append(card);
    });
    workspaceUpdateButtons();
  }
  function workspaceBoxAt(pageNo, p) {
    const list=workspaceBoxes.filter(b=>b.page===pageNo);
    for(let i=list.length-1;i>=0;i--){const b=list[i];if(p.x>=b.x-7&&p.x<=b.x+b.w+7&&p.y>=b.y-7&&p.y<=b.y+b.h+7)return b;}
    return null;
  }
  function workspaceBindOverlay(pageNo, overlay) {
    const point=e=>{const r=overlay.getBoundingClientRect();return{x:Math.max(0,Math.min(overlay.width,(e.clientX-r.left)*overlay.width/r.width)),y:Math.max(0,Math.min(overlay.height,(e.clientY-r.top)*overlay.height/r.height))};};
    overlay.onpointerdown=e=>{
      const p=point(e); let box=workspaceSelected?workspaceBoxes.find(b=>b.id===workspaceSelected&&b.page===pageNo):null;
      if(workspaceAddMode){e.preventDefault();overlay.setPointerCapture(e.pointerId);workspaceDrag={mode:'new',page:pageNo,start:p,box:{id:'crop-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),page:pageNo,x:p.x,y:p.y,w:0,h:0,label:'Page_'+pageNo+'_Crop',kind:'Manual'}};workspaceBoxes.push(workspaceDrag.box);workspaceSelected=workspaceDrag.box.id;return;}
      const hit=workspaceBoxAt(pageNo,p);
      if(!hit){workspaceSelected=null;workspaceDrawAll();workspaceRenderList();workspaceUpdateButtons();return;}
      workspaceSelected=hit.id;box=hit;
      const nearRight=Math.abs(p.x-(box.x+box.w))<12,nearBottom=Math.abs(p.y-(box.y+box.h))<12;
      const nearLeft=Math.abs(p.x-box.x)<12,nearTop=Math.abs(p.y-box.y)<12;
      const resize=nearRight||nearLeft||nearBottom||nearTop;
      workspaceDrag={mode:resize?'resize':'move',page:pageNo,start:p,original:{x:box.x,y:box.y,w:box.w,h:box.h},box,edge:nearLeft?'l':nearRight?'r':nearTop?'t':nearBottom?'b':'',corner:(nearLeft?'l':nearRight?'r':'')+(nearTop?'t':nearBottom?'b':'')};
      overlay.setPointerCapture(e.pointerId);workspaceDrawAll();workspaceRenderList();workspaceUpdateButtons();e.preventDefault();
    };
    overlay.onpointermove=e=>{
      if(!workspaceDrag||workspaceDrag.page!==pageNo)return;const p=point(e),d=workspaceDrag,dx=p.x-d.start.x,dy=p.y-d.start.y,b=d.box;
      if(d.mode==='new'){b.x=Math.min(d.start.x,p.x);b.y=Math.min(d.start.y,p.y);b.w=Math.abs(dx);b.h=Math.abs(dy);}
      else if(d.mode==='move'){b.x=Math.max(0,Math.min(overlay.width-b.w,d.original.x+dx));b.y=Math.max(0,Math.min(overlay.height-b.h,d.original.y+dy));}
      else {const o=d.original,corner=d.corner,edge=d.edge;if(corner.includes('l')||edge==='l'){b.x=Math.max(0,Math.min(o.x+o.w-16,o.x+dx));b.w=o.x+o.w-b.x;}else if(corner.includes('r')||edge==='r')b.w=Math.max(16,Math.min(overlay.width-o.x,o.w+dx));if(corner.includes('t')||edge==='t'){b.y=Math.max(0,Math.min(o.y+o.h-16,o.y+dy));b.h=o.y+o.h-b.y;}else if(corner.includes('b')||edge==='b')b.h=Math.max(16,Math.min(overlay.height-o.y,o.h+dy));}
      workspaceDrawPage(pageNo);
    };
    const finish=()=>{if(!workspaceDrag||workspaceDrag.page!==pageNo)return;const d=workspaceDrag;workspaceDrag=null;if(d.mode==='new'&&(d.box.w<18||d.box.h<18)){workspaceBoxes=workspaceBoxes.filter(b=>b.id!==d.box.id);workspaceSelected=null;}else if(d.mode==='new'){d.box.label='Page_'+pageNo+'_Crop_'+workspaceBoxes.filter(b=>b.page===pageNo).length;workspaceAddMode=false;workspaceStatus('Crop added. You can resize it or rename it below.');}workspaceDrawAll();workspaceRenderList();workspaceUpdateButtons();};
    overlay.onpointerup=finish;overlay.onpointercancel=finish;
  }
  // Find the nearest sustained whitespace boundary after scanning from a caption anchor.
  // Rendered pixels allow this to work even when the figure has no text layer.
  function workspaceFindContentEdge(canvas, x0, x1, startY, direction, limitY) {
    try {
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const left=Math.max(0,Math.floor(x0)), right=Math.min(canvas.width,Math.ceil(x1));
      const top=Math.max(0,Math.min(canvas.height-1,Math.floor(Math.min(startY,limitY))));
      const bottom=Math.max(0,Math.min(canvas.height-1,Math.ceil(Math.max(startY,limitY))));
      if(right-left<8||bottom-top<8)return null;
      const pixels=ctx.getImageData(left,top,right-left,bottom-top+1).data;
      const width=right-left,height=bottom-top+1;
      const inkRows=new Uint8Array(height);
      const sampleStep=Math.max(1,Math.floor(width/700));
      const threshold=Math.max(3,Math.floor(width*.0025));
      for(let y=0;y<height;y++){
        let ink=0;
        for(let x=0;x<width;x+=sampleStep){
          const k=(y*width+x)*4;
          if(pixels[k]<238||pixels[k+1]<238||pixels[k+2]<238){ink++;if(ink>=threshold)break;}
        }
        inkRows[y]=ink>=threshold?1:0;
      }
      const start=Math.max(0,Math.min(height-1,Math.round(startY-top)));
      const step=direction==='up'?-1:1;
      let seenInk=false,lastInk=-1,gap=0;
      const sustainedGap=14;
      for(let y=start;y>=0&&y<height;y+=step){
        if(inkRows[y]){seenInk=true;lastInk=y;gap=0;}
        else if(seenInk){
          gap++;
          if(gap>=sustainedGap)return top+lastInk;
        }
      }
      return seenInk?top+lastInk:null;
    } catch (_) { return null; }
  }

  async function workspaceAutoSuggest() {
    if(!file||workspaceBusy)return;
    workspaceBusy=true;workspaceStatus('Opening PDF and analyzing page captions…');$('figure-workspace-auto').disabled=true;
    try{
      const pdfjs=await loadPdfJs();if(workspaceDoc){try{await workspaceDoc.destroy();}catch(_){}}
      workspaceDoc=await pdfjs.getDocument({data:(await file.arrayBuffer()).slice(0)}).promise;
      const pageNos=parseRanges($('figure-workspace-pages').value,workspaceDoc.numPages);
      if(pageNos.length>40)throw new Error('Please analyze 40 pages or fewer at a time to protect browser memory. Use a chapter range and continue with the next range.');
      workspacePages.clear();workspaceBoxes=[];workspaceSelected=null;
      const root=$('figure-workspace-pages-root');root.replaceChildren();
      for(let i=0;i<pageNos.length;i++){
        const pageNo=pageNos[i];workspaceStatus('Analyzing page '+pageNo+' ('+(i+1)+' of '+pageNos.length+')…');
        const page=await workspaceDoc.getPage(pageNo),viewport=page.getViewport({scale:workspaceScale});
        const node=document.createElement('section');node.style.cssText='border:1px solid var(--border);border-radius:10px;padding:10px;min-width:0;overflow:hidden';
        const heading=document.createElement('div');heading.style.cssText='font-weight:600;margin-bottom:8px';heading.textContent='Page '+pageNo;
        const stage=document.createElement('div');stage.style.cssText='position:relative;width:100%;max-width:'+Math.ceil(viewport.width)+'px;margin:0 auto;background:#fff;overflow:hidden';
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.style.cssText='display:block;width:100%;height:auto';
        const overlay=document.createElement('canvas');overlay.width=canvas.width;overlay.height=canvas.height;overlay.style.cssText='position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair';
        stage.append(canvas,overlay);node.append(heading,stage);root.append(node);
        const entry={pageNo,page,viewport,node,canvas,overlay,rendered:false};workspacePages.set(pageNo,entry);workspaceBindOverlay(pageNo,overlay);
        await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
        entry.rendered=true;
        const textContent=await page.getTextContent();
        const lines=[];
        for(const item of textContent.items||[]){
          if(!item.str||!item.str.trim()||!Array.isArray(item.transform))continue;
          const pt=viewport.convertToViewportPoint(item.transform[4],item.transform[5]);
          let line=lines.find(l=>Math.abs(l.y-pt[1])<4);
          const itemRight=pt[0]+Math.abs(Number(item.width)||0)*viewport.scale;
          if(!line){line={y:pt[1],x:pt[0],xEnd:itemRight,parts:[]};lines.push(line);}
          line.x=Math.min(line.x,pt[0]);line.xEnd=Math.max(line.xEnd,itemRight);line.parts.push(item.str.trim());
        }
        lines.forEach(l=>l.text=l.parts.join(' ').replace(/\s+/g,' ').trim());
        const anchors=lines.filter(l=>/^(?:fig(?:ure)?s?\.?|table|box|algorithm)\s*[A-Z]?\d+(?:[.-]\d+)*(?:[A-Z])?\b/i.test(l.text));
        const pageH=viewport.height,pageW=viewport.width;
        // If captions appear in both page halves, treat them as separate
        // columns. Otherwise retain a full-width crop for single/full-width
        // figures, where column inference would be too speculative.
        // A caption line that itself spans much of the page is evidence of a
        // full-width figure/table, even when other captions sit in both columns.
        const isWideAnchor=a=>(a.xEnd||a.x)-a.x>pageW*.56;
        const hasLeftAnchor=anchors.some(a=>!isWideAnchor(a)&&a.x<pageW*.42);
        const hasRightAnchor=anchors.some(a=>!isWideAnchor(a)&&a.x>pageW*.58);
        const useColumns=hasLeftAnchor&&hasRightAnchor;
        const columnOf=a=>isWideAnchor(a)?'full':(useColumns?(a.x<pageW*.5?'left':a.x>pageW*.5?'right':'full'):'full');
        const byColumn=new Map();
        anchors.forEach(a=>{const key=columnOf(a);if(!byColumn.has(key))byColumn.set(key,[]);byColumn.get(key).push(a);});
        for(const list of byColumn.values())list.sort((a,b)=>a.y-b.y);
        anchors.forEach((a,j)=>{
          const isTable=/^table\b/i.test(a.text), column=columnOf(a), peers=byColumn.get(column)||[];
          const index=peers.indexOf(a), prior=peers[index-1], next=peers[index+1];
          const twoCol=column==='left'||column==='right';
          const colW=pageW*.46;
          const x=column==='left'?Math.max(0,a.x-8):column==='right'?Math.max(0,pageW-colW-8):pageW*.04;
          const w=twoCol?Math.min(colW,pageW-x):pageW*.92;
          // Bound the suggestion by captions in the same column only. A
          // neighboring caption in the opposite column must not control height.
          const upperLimit=prior?(prior.y+a.y)/2:0;
          const lowerLimit=next?(next.y+a.y)/2:pageH;
          let y,h;
          if(isTable){
            y=Math.max(0,a.y-14,upperLimit);
            h=Math.min(pageH*.38,Math.max(110,lowerLimit-y-8));
          } else {
            h=Math.min(pageH*.38,Math.max(110,a.y-upperLimit-5));
            y=Math.max(upperLimit,a.y-h-5);
          }
          // Use the label as an anchor, then scan rendered pixels outward.
          // Figures usually sit above their caption; tables usually sit below their title.
          // Keep the old estimate when no plausible whitespace boundary is detected.
          const scanX0=twoCol?(column==='left'?0:pageW*.52):pageW*.04;
          const scanX1=twoCol?(column==='left'?pageW*.48:pageW):pageW*.96;
          if(isTable){
            const edge=workspaceFindContentEdge(canvas,scanX0,scanX1,Math.min(pageH-1,a.y+16),'down',Math.min(lowerLimit,pageH-1));
            if(edge!==null&&edge>y+65)h=Math.min(pageH*.72,edge-y+8);
          } else {
            const edge=workspaceFindContentEdge(canvas,scanX0,scanX1,Math.max(0,a.y-16),'up',Math.max(upperLimit,0));
            if(edge!==null&&edge<a.y-65){y=Math.max(upperLimit,edge-5);h=Math.max(0,a.y-y-2);}
          }
          h=Math.min(h,pageH-y,Math.max(0,lowerLimit-y));
          if(h<40)return;
          const safeX=Math.max(0,Math.min(pageW-1,x));
          const safeW=Math.max(1,Math.min(w,pageW-safeX));
          workspaceBoxes.push({id:'auto-'+pageNo+'-'+j,page:pageNo,x:safeX,y,w:safeW,h,label:(isTable?'Table_':'Fig_')+(a.text.match(/\d+(?:[.-]\d+)*/)||['suggested'])[0],kind:isTable?'Table suggestion':'Figure suggestion',confidence:'review'});
        });
        // Canvas was rendered before pixel-boundary analysis.
        workspaceDrawPage(pageNo);
        try{page.cleanup();}catch(_){}
      }
      workspaceRenderList();workspaceUpdateButtons();
      workspaceStatus('Viewer ready: '+pageNos.length+' page(s), '+workspaceBoxes.length+' caption-anchored suggestion(s). These are rough starting boxes, not verified figure/table boundaries. Use Add crop for missed content and inspect each outline.');
    }catch(error){workspaceStatus('Could not prepare crop workspace: '+(error.message||error),true);}
    finally{workspaceBusy=false;$('figure-workspace-auto').disabled=!file;workspaceUpdateButtons();}
  }
  async function workspaceExport() {
    if(!workspaceBoxes.length||workspaceBusy||!window.JSZip||!workspaceDoc)return;
    workspaceBusy=true;workspaceUpdateButtons();workspaceStatus('Rendering reviewed crops for export…');
    try{
      const zip=new JSZip(),used=new Set(),rows=[['filename','label','type','source_page','x_pt','y_pt','width_pt','height_pt'].join(',')];
      const pdfjs=await loadPdfJs();let n=0;
      for(const box of workspaceBoxes){
        const entry=workspacePages.get(box.page);if(!entry)continue;
        const page=await workspaceDoc.getPage(box.page),scale=2,viewport=page.getViewport({scale});
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
        const factor=scale/workspaceScale,x=Math.max(0,Math.floor(box.x*factor)),y=Math.max(0,Math.floor(box.y*factor)),w=Math.min(canvas.width-x,Math.ceil(box.w*factor)),h=Math.min(canvas.height-y,Math.ceil(box.h*factor));
        if(w<2||h<2){canvas.width=0;canvas.height=0;continue;}
        const out=document.createElement('canvas');out.width=w;out.height=h;out.getContext('2d').drawImage(canvas,x,y,w,h,0,0,w,h);
        const blob=await new Promise(resolve=>out.toBlob(resolve,'image/png'));canvas.width=0;canvas.height=0;out.width=0;out.height=0;if(!blob)continue;
        let stem=slugName(box.label||('Page_'+box.page+'_Crop_'+(++n)));if(used.has(stem.toLowerCase()))stem+='_'+box.page+'_'+(++n);used.add(stem.toLowerCase());const filename=stem+'.png';zip.file(filename,blob);
        const csv=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
        rows.push([filename,box.label,box.kind,box.page,(box.x/workspaceScale).toFixed(2),(box.y/workspaceScale).toFixed(2),(box.w/workspaceScale).toFixed(2),(box.h/workspaceScale).toFixed(2)].map(csv).join(','));
        workspaceStatus('Exporting crop '+(n+1)+' of '+workspaceBoxes.length+'…');
      }
      zip.file('manifest.csv',rows.join('\r\n'));const blob=await zip.generateAsync({type:'blob'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=safeName(file.name.replace(/\.pdf$/i,''))+'-reviewed-crops.zip';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      workspaceStatus('Export started. Review manifest.csv for page numbers and crop coordinates.');
    }catch(error){workspaceStatus('Could not export crops: '+(error.message||error),true);}
    finally{workspaceBusy=false;workspaceUpdateButtons();}
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
    $('figure-crop-render').addEventListener('click', renderCropPage);
    $('figure-crop-clear').addEventListener('click', () => { cropSelection = null; drawCropSelection(); $('figure-crop-add').disabled = true; cropStatus('Selection cleared. Drag to select a figure.'); });
    $('figure-crop-add').addEventListener('click', addCrop);
    $('figure-crop-download').addEventListener('click', downloadCrops);

    $('figure-workspace-auto').addEventListener('click', workspaceAutoSuggest);
    $('figure-workspace-add').addEventListener('click', () => { workspaceAddMode=true; workspaceStatus('Add-crop mode is on. Drag a rectangle on the page where the crop should be.'); });
    $('figure-workspace-remove').addEventListener('click', () => { if(!workspaceSelected)return;workspaceBoxes=workspaceBoxes.filter(b=>b.id!==workspaceSelected);workspaceSelected=null;workspaceDrawAll();workspaceRenderList();workspaceStatus('Selected crop removed.'); });
    $('figure-workspace-export').addEventListener('click', workspaceExport);

  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
