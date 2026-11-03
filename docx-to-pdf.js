import { detectFileFormat } from './file-detection.js';
export function sanitizePdfFilename(name) {
  const base = String(name || 'document').replace(/\.[^.]+$/, '');
  const safe = base.normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim();
  return (safe || 'document').slice(0, 140) + '.pdf';
}
export function isDocxRendererReady(docx, jszip) {
  return !!jszip && typeof docx?.renderAsync === 'function';
}
export function hasRenderedDocxPages(container) {
  return countRenderedDocxPages(container) > 0;
}
export function countRenderedDocxPages(container) {
  if (!container || typeof container.querySelectorAll !== 'function') return 0;
  const pages = container.querySelectorAll('.docx-wrapper > section.docx, .docx-wrapper > .docx, section.docx');
  return pages.length;
}

// Extract explicitly declared Word fonts without changing the source document.
export function extractDocxFontNames(xmlDocuments) {
  const names = new Set();
  const sources = Array.isArray(xmlDocuments) ? xmlDocuments : [xmlDocuments];
  for (const source of sources) {
    const xml = String(source || '');
    for (const match of xml.matchAll(/<w:font\b[^>]*\bw:name=["']([^"']+)["']/gi)) names.add(match[1].trim());
    for (const match of xml.matchAll(/\bw:(?:ascii|hAnsi|eastAsia|cs)=["']([^"']+)["']/gi)) names.add(match[1].trim());
  }
  return [...names].filter(Boolean).sort((a,b) => a.localeCompare(b));
}
export async function inspectDocxFonts(zip, fontCheck = () => true) {
  const xmlParts = [];
  for (const path of ['word/document.xml','word/styles.xml','word/fontTable.xml','word/theme/theme1.xml']) {
    const entry = zip?.file?.(path);
    if (entry) {
      try { xmlParts.push(await entry.async('string')); } catch (_) {}
    }
  }
  const fonts = extractDocxFontNames(xmlParts);
  const unavailable = fonts.filter(name => {
    try { return !fontCheck('12px "' + name.replace(/["\\\\]/g, '') + '"'); } catch (_) { return false; }
  });
  return { fonts, unavailable };
}

const $ = id => document.getElementById(id);
let selectedFile = null, rendering = false, rendered = false, printInProgress = false;
let renderToken = 0;
let rendererLoadPromise = null;
const DOCX_RENDER_TIMEOUT_MS = 45000;
const FONT_READY_TIMEOUT_MS = 8000;

function withTimeout(promise, milliseconds, label) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label + ' timed out after ' + Math.round(milliseconds / 1000) + ' seconds.')), milliseconds);
    })
  ]).finally(() => clearTimeout(timer));
}
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      script.remove();
      reject(new Error('Timed out loading ' + src));
    }, 12000);
    script.src = src;
    script.async = true;
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error('Could not load ' + src));
    };
    document.head.append(script);
  });
}
async function ensureDocxRenderer() {
  if (isDocxRendererReady(window.docx, window.JSZip)) return;
  if (rendererLoadPromise) return rendererLoadPromise;
  rendererLoadPromise = (async () => {
    if (!window.JSZip) {
      try { await loadScript('./vendor/jszip-3.10.1.min.js'); } catch (_) {}
      if (!window.JSZip) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    }
    if (!window.docx || typeof window.docx.renderAsync !== 'function') {
      try { await loadScript('./vendor/docx-preview-0.4.1.min.js'); } catch (_) {}
      if (!window.docx || typeof window.docx.renderAsync !== 'function') {
        await loadScript('https://cdn.jsdelivr.net/npm/docx-preview@0.4.1/dist/docx-preview.min.js');
      }
    }
    if (!isDocxRendererReady(window.docx, window.JSZip)) {
      throw new Error('The rendering scripts loaded, but the required docx.renderAsync or JSZip API is unavailable.');
    }
  })().finally(() => { rendererLoadPromise = null; });
  return rendererLoadPromise;
}

function setStatus(message, error = false) {
  const node = $('docx-pdf-status');
  if (!node) return;
  node.textContent = message || '';
  node.hidden = !message;
  node.dataset.error = error ? 'true' : 'false';
}
function setBusy(value) {
  rendering = value;
  $('docx-pdf-render').disabled = value || !selectedFile;
  $('docx-pdf-print').disabled = value || !rendered;
  $('docx-pdf-clear').disabled = value || !selectedFile;
  $('docx-pdf-progress').hidden = !value;
}
function showPanel() {
  document.querySelectorAll('.panel').forEach(panel => panel.classList.toggle('active', panel.id === 'panel-docx-pdf'));
  document.querySelectorAll('.tool-btn').forEach(button => button.classList.toggle('active', button.dataset.panel === 'docx-pdf'));
  document.querySelectorAll('.mobile-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === 'tools'));
  document.querySelector('.mobile-tools-sheet.open')?.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function addNavigation() {
  if (document.querySelector('[data-panel="docx-pdf"]')) return;
  const section = [...document.querySelectorAll('.tool-section')].find(item => item.querySelector('[data-panel="image-pdf"]') || item.querySelector('[data-panel="pdf-images"]'));
  if (section) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'tool-btn'; button.dataset.panel = 'docx-pdf';
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 15h6M9 18h4"/></svg><span>DOCX to PDF</span>';
    button.addEventListener('click', showPanel);
    section.insertBefore(button, section.querySelector('[data-panel="image-pdf"]') || section.firstChild);
  }
  const mobile = $('mobile-tools-grid');
  if (mobile) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'mobile-tool-card'; button.dataset.panel = 'docx-pdf';
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 15h6M9 18h4"/></svg><span>DOCX to PDF</span>';
    button.addEventListener('click', () => { showPanel(); });
    mobile.append(button);
  }
}
function addPanel() {
  if ($('panel-docx-pdf')) return;
  const panel = document.createElement('section');
  panel.className = 'panel'; panel.id = 'panel-docx-pdf';
  panel.innerHTML = [
    '<h2>Word (DOCX) to PDF</h2>',
    '<p class="subtitle">Open a Word document locally, review the rendered pages, then use your browser’s Print / Save as PDF command. Text remains selectable and searchable in the resulting PDF.</p>',
    '<div class="drop-zone" id="docx-pdf-drop" tabindex="0" role="button" aria-label="Choose or drop a DOCX file">',
    '<div class="drop-icon">W</div><p><strong>Drop a DOCX file here</strong> or click to browse</p>',
    '<p class="hint">Microsoft Word .docx only · processing stays on this device</p>',
    '<input id="docx-pdf-input" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden></div>',
    '<div class="docx-pdf-filebar" id="docx-pdf-filebar" hidden><div><strong id="docx-pdf-filename"></strong><span id="docx-pdf-filemeta"></span></div><button class="btn btn-secondary btn-sm" id="docx-pdf-change" type="button">Change file</button></div>',
    '<div class="docx-pdf-actions"><button class="btn btn-primary" id="docx-pdf-render" type="button" disabled>Prepare document preview</button><button class="btn btn-secondary" id="docx-pdf-print" type="button" disabled>Print / Save as PDF</button><button class="btn btn-secondary btn-sm" id="docx-pdf-clear" type="button" disabled>Clear</button></div>',
    '<div class="docx-pdf-progress" id="docx-pdf-progress" hidden><span class="docx-pdf-spinner"></span><span>Rendering Word document…</span></div>',
    '<div class="note" id="docx-pdf-status" role="status" aria-live="polite" hidden></div>',\n    '<div class="note" id="docx-pdf-font-report" hidden></div>',
    '<div class="docx-pdf-preview-heading" id="docx-pdf-preview-heading" hidden><strong>Document preview</strong><span id="docx-pdf-page-count"></span></div>',
    '<div id="docx-pdf-style-host" class="docx-pdf-style-host"></div><div id="docx-pdf-preview" class="docx-pdf-preview" aria-label="Rendered Word document preview"></div>',
    '<div class="note docx-pdf-note"><strong>Conversion limits:</strong> This browser-only workflow uses docx-preview and the browser print engine, not Microsoft Word or LibreOffice. It preserves selectable text but cannot guarantee Word-identical pagination, floating objects, SmartArt, equations, tracked changes, or complex tables. Review font warnings and every page before sharing. For high-fidelity conversion, use a desktop/server renderer such as LibreOffice. Legacy .doc files are not supported.</div>'
  ].join('');
  const anchor = $('panel-pdf-images') || $('panel-compress');
  if (anchor?.parentNode) anchor.parentNode.insertBefore(panel, anchor);
  else document.querySelector('main')?.append(panel);
}
function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return 'Size unavailable';
  return bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1048576).toFixed(2) + ' MB';
}
async function validateDocx(file) {
  if (!file || !/\.docx$/i.test(file.name)) throw new Error('Choose a .docx Word document. Legacy .doc files are not supported.');
  if (file.size < 22) throw new Error('This file is too small to be a valid DOCX document.');
  const detection = await detectFileFormat(file);
  if (detection.format !== 'docx') throw new Error('This file is not a recognized Word DOCX package. Check that it is a genuine .docx document.');
  return true;
}
function clearPreview() {
  const preview = $('docx-pdf-preview'), styles = $('docx-pdf-style-host');
  if (preview) preview.replaceChildren();
  if (styles) styles.replaceChildren();
  rendered = false;
  $('docx-pdf-preview-heading').hidden = true;
  $('docx-pdf-print').disabled = true;
}
async function setFile(file) {
  if (!file) return;
  if (rendering) { setStatus('Wait for the current document render to finish before changing files.', true); return; }
  try {
    await validateDocx(file);
    selectedFile = file;
    clearPreview();
    $('docx-pdf-filebar').hidden = false;
    $('docx-pdf-filename').textContent = file.name;
    $('docx-pdf-filemeta').textContent = formatSize(file.size) + ' · DOCX';
    $('docx-pdf-render').disabled = false;
    $('docx-pdf-clear').disabled = false;
    setStatus('Word document selected. Prepare the preview to review its layout before printing.');
  } catch (error) { setStatus(error.message, true); }
}
async function renderDocument() {
  if (!selectedFile || rendering) return;
  const token = ++renderToken;
  setBusy(true);
  clearPreview();
  setStatus('Loading the local Word rendering engine…');
  try {
    await ensureDocxRenderer();
    if (token !== renderToken) return;
    setStatus('Reading and laying out the Word document locally…');

    // Render into detached containers first. A timed-out or late render cannot
    // leave a half-rendered preview visible or accidentally enable printing.
    const stagingPreview = document.createElement('div');
    const stagingStyles = document.createElement('div');
    await withTimeout(window.docx.renderAsync(selectedFile, stagingPreview, stagingStyles, {
      className: 'docx',
      inWrapper: true,
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      renderAltChunks: false,
      renderChanges: false,
      useBase64URL: true
    }), DOCX_RENDER_TIMEOUT_MS, 'Word document rendering');
    if (token !== renderToken) return;
    const pages = countRenderedDocxPages(stagingPreview);
    if (!pages) throw new Error('The renderer finished but did not produce any document pages.');

    const styleHost = $('docx-pdf-style-host');
    styleHost.replaceChildren(...Array.from(stagingStyles.childNodes));
    if (document.fonts?.ready) {
      setStatus('Applying document fonts and preparing the preview…');
      await withTimeout(document.fonts.ready, FONT_READY_TIMEOUT_MS, 'Document font loading');
    }
    if (token !== renderToken) return;

    const preview = $('docx-pdf-preview');
    preview.replaceChildren(...Array.from(stagingPreview.childNodes));
    rendered = true;
    $('docx-pdf-preview-heading').hidden = false;
    $('docx-pdf-page-count').textContent = pages + ' rendered page' + (pages === 1 ? '' : 's');
    $('docx-pdf-print').disabled = false;
    const report = $('docx-pdf-font-report');
    if (fontAudit.fonts.length) {
      const unavailable = fontAudit.unavailable;
      report.hidden = false;
      report.textContent = unavailable.length
        ? 'Font check: ' + fontAudit.fonts.length + ' declared font(s) found. These may be unavailable in this browser/device: ' + unavailable.join(', ') + '. The browser may substitute fonts, changing line wrapping and pagination. Install the original fonts where licensed, then render again.'
        : 'Font check: ' + fontAudit.fonts.length + ' declared font(s) found. No missing-font warning was reported by this browser. This does not guarantee exact Word font metrics or identical pagination.';
    } else {
      report.hidden = false;
      report.textContent = 'Font check: no explicit font declarations were detected in the inspected DOCX parts. The renderer/browser default font handling will apply.';
    }
    setStatus('Preview ready. Review page breaks, tables, diagrams, and font warnings before saving. Browser rendering is not identical to Microsoft Word or Google Docs.');
  } catch (error) {
    if (token === renderToken) {
      clearPreview();
      setStatus('Could not prepare the DOCX preview: ' + (error?.message || String(error)) + ' Your document remains on this device. Check your connection if the local renderer could not be loaded, then refresh and retry.', true);
    }
  } finally {
    if (token === renderToken) setBusy(false);
  }
}
function printDocument() {
  if (!rendered || rendering || printInProgress) return;
  printInProgress = true;
  const previousTitle = document.title;
  document.title = sanitizePdfFilename(selectedFile?.name).replace(/\.pdf$/i, '');
  document.body.classList.add('printing-docx');
  setStatus('In the print dialog, choose Save as PDF as the destination. Disable browser headers and footers if you do not want them.');
  const cleanup = () => {
    document.body.classList.remove('printing-docx');
    document.title = previousTitle;
    printInProgress = false;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
}
function clearFile() {
  if (rendering) return;
  renderToken++;
  selectedFile = null;
  clearPreview();
  $('docx-pdf-input').value = '';
  $('docx-pdf-filebar').hidden = true;\n  if ($('docx-pdf-font-report')) { $('docx-pdf-font-report').hidden = true; $('docx-pdf-font-report').textContent = ''; }
  $('docx-pdf-render').disabled = true;
  $('docx-pdf-clear').disabled = true;
  setStatus('');
}
function init() {
  addPanel(); addNavigation();
  const drop = $('docx-pdf-drop'), input = $('docx-pdf-input');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); } });
  drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', event => { event.preventDefault(); drop.classList.remove('dragover'); setFile(event.dataTransfer.files?.[0]); });
  input.addEventListener('change', () => setFile(input.files?.[0]));
  $('docx-pdf-change').addEventListener('click', () => input.click());
  $('docx-pdf-render').addEventListener('click', renderDocument);
  $('docx-pdf-print').addEventListener('click', printDocument);
  $('docx-pdf-clear').addEventListener('click', clearFile);
}
if (typeof window !== 'undefined') {
  window.PDFToolkitSetDocxFile = file => setFile(file);
  window.PDFToolkitOpenDocxConverter = file => {
    showPanel();
    if (file) setFile(file);
  };
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}
