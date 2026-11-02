export function sanitizePdfFilename(name) {
  const base = String(name || 'document').replace(/\.[^.]+$/, '');
  const safe = base.normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim();
  return (safe || 'document').slice(0, 140) + '.pdf';
}
export function countRenderedDocxPages(container) {
  if (!container || typeof container.querySelectorAll !== 'function') return 0;
  const pages = container.querySelectorAll('.docx-wrapper > section.docx, .docx-wrapper > .docx, section.docx');
  return pages.length;
}
const $ = id => document.getElementById(id);
let selectedFile = null, rendering = false, rendered = false, printInProgress = false;
let renderToken = 0;

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
    '<div class="note" id="docx-pdf-status" role="status" aria-live="polite" hidden></div>',
    '<div class="docx-pdf-preview-heading" id="docx-pdf-preview-heading" hidden><strong>Document preview</strong><span id="docx-pdf-page-count"></span></div>',
    '<div id="docx-pdf-style-host" class="docx-pdf-style-host"></div><div id="docx-pdf-preview" class="docx-pdf-preview" aria-label="Rendered Word document preview"></div>',
    '<div class="note docx-pdf-note"><strong>Important:</strong> This uses the browser’s native print engine to create a text-based PDF; choose <em>Save as PDF</em> in the print dialog. Layout can differ from Microsoft Word, especially with unusual fonts, floating objects, complex tables, tracked changes, or documents relying on Word-only features. Check the preview and saved PDF before sharing. Legacy .doc files are not supported in this batch.</div>'
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
  const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
    throw new Error('The file does not have a valid DOCX ZIP package signature. Check that it is a genuine .docx file.');
  }
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
  if (!window.docx || typeof window.docx.renderAsync !== 'function') {
    setStatus('The Word rendering library did not load. Connect to the internet, refresh the app, and try again. The document itself is not uploaded.', true);
    return;
  }
  setBusy(true); clearPreview();
  setStatus('Reading and laying out the Word document locally…');
  try {
    await window.docx.renderAsync(selectedFile, $('docx-pdf-preview'), $('docx-pdf-style-host'), {
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
    });
    if (token !== renderToken) return;
    if (document.fonts?.ready) await document.fonts.ready;
    const pages = countRenderedDocxPages($('docx-pdf-preview'));
    rendered = true;
    $('docx-pdf-preview-heading').hidden = false;
    $('docx-pdf-page-count').textContent = pages ? pages + ' rendered page' + (pages === 1 ? '' : 's') : 'Preview rendered';
    $('docx-pdf-print').disabled = false;
    setStatus('Preview ready. Review the pages, then choose Print / Save as PDF. Browser pagination and Word layout may differ.');
  } catch (error) {
    clearPreview();
    setStatus('Could not render this DOCX: ' + (error?.message || String(error)) + '. The file may be damaged or use unsupported Word features.', true);
  } finally {
    if (token === renderToken) setBusy(false);
  }
}
function printDocument() {
  if (!rendered || rendering || printInProgress) return;
  printInProgress = true;
  document.body.classList.add('printing-docx');
  setStatus('In the print dialog, choose Save as PDF as the destination. Disable browser headers and footers if you do not want them.');
  const cleanup = () => {
    document.body.classList.remove('printing-docx');
    printInProgress = false;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  setTimeout(() => {
    if (printInProgress) cleanup();
  }, 1200);
}
function clearFile() {
  if (rendering) return;
  renderToken++;
  selectedFile = null;
  clearPreview();
  $('docx-pdf-input').value = '';
  $('docx-pdf-filebar').hidden = true;
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
