import { detectFileFormat } from './file-detection.js';

export function sanitizeDocxFilename(name) {
  const base = String(name || 'document').replace(/\.pdf$/i, '');
  const safe = base.normalize('NFKC').replace(/[\\\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim();
  return (safe || 'document').slice(0, 140) + '.docx';
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Reconstruct visually aligned PDF text items into editable, ordered lines. */
export function reconstructPdfLines(items, styles = {}) {
  const positioned = (items || []).filter(item => typeof item.str === 'string' && item.str.length).map(item => {
    const transform = item.transform || [];
    const style = styles[item.fontName] || {};
    const size = Math.hypot(Number(transform[0]) || 0, Number(transform[1]) || 0) || Math.abs(Number(item.height) || Number(transform[3]) || 10);
    const fontLabel = String(item.fontName || '') + ' ' + String(style.fontFamily || '');
    return {
      text: item.str,
      x: Number(transform[4]) || 0,
      y: Number(transform[5]) || 0,
      width: Math.max(0, Number(item.width) || 0),
      height: Math.max(1, Math.abs(Number(item.height) || size)),
      size: Math.max(5, Math.min(96, size)),
      font: /^[\w ,.'-]{1,60}$/.test(String(style.fontFamily || '')) ? style.fontFamily : undefined,
      bold: /bold|black|heavy|demi/i.test(fontLabel),
      italics: /italic|oblique/i.test(fontLabel)
    };
  });
  if (!positioned.length) return [];
  const sorted = positioned.sort((a, b) => Math.abs(b.y - a.y) > 2.5 ? b.y - a.y : a.x - b.x);
  const lines = [];
  for (const item of sorted) {
    let line = lines.find(candidate => Math.abs(candidate.y - item.y) <= Math.max(2.5, Math.min(5, item.height * 0.3)));
    if (!line) { line = { y: item.y, items: [] }; lines.push(line); }
    line.items.push(item);
  }
  lines.sort((a, b) => b.y - a.y);
  return lines.map(line => {
    line.items.sort((a, b) => a.x - b.x);
    let text = '', previous = null;
    const runs = [];
    for (const item of line.items) {
      let prefix = '';
      if (previous) {
        const gap = item.x - (previous.x + previous.width);
        if (gap > Math.max(1.5, previous.height * 0.18) && !/\s$/.test(text) && !/^[,.;:!?%)\]}]/.test(item.text)) prefix = ' ';
      }
      text += prefix + item.text;
      runs.push({ ...item, text: prefix + item.text });
      previous = item;
    }
    const sizes = line.items.map(item => item.size);
    return {
      text: text.trim(),
      fontSize: median(sizes),
      bold: line.items.filter(item => item.bold).length > line.items.length / 2,
      italics: line.items.filter(item => item.italics).length > line.items.length / 2,
      font: line.items.find(item => item.font)?.font,
      runs
    };
  }).filter(line => line.text);
}

export function countPdfTextPages(pageResults) {
  return (pageResults || []).filter(page => page.lines?.some(line => line.text.trim())).length;
}

const $ = id => document.getElementById(id);
let selectedFile = null, busy = false, cancelled = false;

function status(message, error = false) {
  const node = $('pdf-docx-status');
  if (!node) return;
  node.textContent = message || '';
  node.hidden = !message;
  node.dataset.error = error ? 'true' : 'false';
}
function setBusy(value) {
  busy = value;
  $('pdf-docx-run').disabled = value || !selectedFile;
  $('pdf-docx-clear').disabled = value || !selectedFile;
  $('pdf-docx-cancel').disabled = !value;
  $('pdf-docx-progress').hidden = !value;
}
function showPanel() {
  if (typeof window.PDFToolkitOpenTool === 'function') {
    window.PDFToolkitOpenTool('pdf-docx');
    return;
  }
  document.querySelectorAll('.panel').forEach(panel => panel.classList.toggle('active', panel.id === 'panel-pdf-docx'));
  document.querySelectorAll('.tool-btn').forEach(button => button.classList.toggle('active', button.dataset.panel === 'pdf-docx'));
  document.querySelectorAll('.mobile-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === 'tools'));
  document.querySelector('.mobile-tools-sheet.open')?.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function addStyles() {
  if ($('pdf-docx-styles')) return;
  const style = document.createElement('style');
  style.id = 'pdf-docx-styles';
  style.textContent = `
    .pdf-docx-filebar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;margin:14px 0;border:1px solid var(--border);border-radius:10px;background:var(--surface)}
    .pdf-docx-filebar>div{display:flex;flex-direction:column;min-width:0;gap:2px}
    .pdf-docx-filebar strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .pdf-docx-filebar span,.pdf-docx-hint{color:var(--text-muted);font-size:.78rem}
    .pdf-docx-actions{display:flex;flex-wrap:wrap;gap:9px;margin:14px 0}
    .pdf-docx-progress{display:flex;align-items:center;gap:10px;padding:12px 0;color:var(--text-muted)}
    .pdf-docx-spinner{width:18px;height:18px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:pdf-docx-spin .8s linear infinite}
    @keyframes pdf-docx-spin{to{transform:rotate(360deg)}}
    #pdf-docx-status[data-error="true"]{border-color:var(--danger)}
    .pdf-docx-stat{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
    .pdf-docx-stat span{padding:5px 9px;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:.78rem}
    @media(max-width:600px){.pdf-docx-filebar{align-items:flex-start;flex-direction:column}}
  `;
  document.head.append(style);
}
function addPanel() {
  if ($('panel-pdf-docx')) return;
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.id = 'panel-pdf-docx';
  panel.innerHTML = [
    '<h2>PDF to editable Word (DOCX)</h2>',
    '<p class="subtitle">Extract selectable PDF text and rebuild it as editable Word paragraphs. Processing stays on this device.</p>',
    '<div class="drop-zone" id="pdf-docx-drop" tabindex="0" role="button" aria-label="Choose or drop a PDF file">',
    '<div class="drop-icon">PDF</div><p><strong>Drop a PDF here</strong> or click to browse</p>',
    '<p class="hint">Text-based PDFs work best · scanned pages need OCR first</p>',
    '<input id="pdf-docx-input" type="file" accept=".pdf,application/pdf" hidden></div>',
    '<div class="pdf-docx-filebar" id="pdf-docx-filebar" hidden><div><strong id="pdf-docx-filename"></strong><span id="pdf-docx-filemeta"></span></div><button class="btn btn-secondary btn-sm" id="pdf-docx-change" type="button">Change PDF</button></div>',
    '<div class="pdf-docx-actions"><button class="btn btn-primary" id="pdf-docx-run" type="button" disabled>Convert to Word (.docx)</button><button class="btn btn-secondary" id="pdf-docx-clear" type="button" disabled>Clear</button><button class="btn btn-secondary" id="pdf-docx-cancel" type="button" disabled>Cancel</button></div>',
    '<div class="pdf-docx-progress" id="pdf-docx-progress" hidden><span class="pdf-docx-spinner"></span><span id="pdf-docx-progress-label">Reading PDF text…</span></div>',
    '<div class="note" id="pdf-docx-status" role="status" aria-live="polite" hidden></div>',
    '<div class="pdf-docx-stat" id="pdf-docx-stats" hidden></div>',
    '<div class="note"><strong>What to expect:</strong> PDF pages are fixed-layout, so this rebuilds editable text and approximate paragraph structure rather than restoring the original Word file. Font styling and page sizes are approximated. Complex columns, tables, equations, graphics, and floating objects may need manual cleanup. Images are not embedded in this first release. If the PDF is scanned or has no selectable text, run <strong>OCR & Searchable PDF</strong> first, then convert the OCR output.</div>'
  ].join('');
  const anchor = $('panel-docx-pdf') || $('panel-image-pdf') || $('panel-compress');
  if (anchor?.parentNode) anchor.parentNode.insertBefore(panel, anchor);
  else document.querySelector('main')?.append(panel);
}
function addNavigation() {
  if (!document.querySelector('[data-panel="pdf-docx"]')) {
    const section = [...document.querySelectorAll('.tool-section')].find(item => item.querySelector('[data-panel="docx-pdf"]') || item.querySelector('[data-panel="image-pdf"]'));
    if (section) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'tool-btn'; button.dataset.panel = 'pdf-docx';
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 15h6M9 18h4"/></svg><span>PDF to DOCX</span>';
      button.addEventListener('click', showPanel);
      section.append(button);
    }
  }
  const mobile = $('mobile-tools-grid');
  if (mobile && !mobile.querySelector('[data-panel="pdf-docx"]')) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'mobile-tool-card'; button.dataset.panel = 'pdf-docx';
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 15h6M9 18h4"/></svg><span>PDF to DOCX</span>';
    button.addEventListener('click', showPanel);
    mobile.append(button);
  }
  const actions = document.querySelector('.workspace-document-actions');
  if (actions && !$('workspace-pdf-to-docx')) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'btn btn-primary btn-sm'; button.id = 'workspace-pdf-to-docx';
    button.textContent = 'Convert to Word';
    button.addEventListener('click', () => window.PDFToolkitOpenPdfToDocx?.(window.PDFToolkitGetActiveFile?.()));
    actions.insertBefore(button, actions.firstChild);
  }
}
function formatSize(bytes) {
  return Number.isFinite(bytes) ? (bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1048576).toFixed(2) + ' MB') : 'Size unavailable';
}
async function validatePdf(file) {
  if (!file || (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf')) throw new Error('Choose a PDF file.');
  const detection = await detectFileFormat(file);
  if (!detection.isPdf) throw new Error('This file does not contain a valid PDF signature.');
}
function setFile(file) {
  if (!file || busy) return;
  selectedFile = file;
  $('pdf-docx-filebar').hidden = false;
  $('pdf-docx-filename').textContent = file.name;
  $('pdf-docx-filemeta').textContent = formatSize(file.size) + ' · PDF';
  $('pdf-docx-stats').hidden = true;
  status('PDF selected. Convert to create an editable Word document.');
  setBusy(false);
}
function clearFile() {
  if (busy) return;
  selectedFile = null;
  $('pdf-docx-input').value = '';
  $('pdf-docx-filebar').hidden = true;
  $('pdf-docx-stats').hidden = true;
  setBusy(false);
  status('');
}
function makeParagraph(line, medianSize, api) {
  const runs = (line.runs || []).map(run => new api.TextRun({
    text: run.text,
    bold: run.bold || undefined,
    italics: run.italics || undefined,
    size: Math.round(run.size * 2),
    font: run.font
  }));
  const isHeading = line.fontSize >= medianSize * 1.28 && line.text.length <= 120;
  const heading = isHeading ? (line.fontSize >= medianSize * 1.65 ? api.HeadingLevel.HEADING_1 : api.HeadingLevel.HEADING_2) : undefined;
  return new api.Paragraph({
    children: runs.length ? runs : [new api.TextRun(line.text)],
    heading,
    spacing: { before: isHeading ? 120 : 0, after: isHeading ? 80 : 35, line: 260 }
  });
}
async function loadPdfJs() {
  const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
  return pdfjs;
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.style.display = 'none';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function convert() {
  if (!selectedFile || busy) return;
  cancelled = false;
  setBusy(true);
  $('pdf-docx-stats').hidden = true;
  let pdf = null;
  try {
    status('Validating PDF…');
    await validatePdf(selectedFile);
    if (!window.docx?.Document || !window.docx?.Packer?.toBlob) throw new Error('The DOCX generation library did not load. Refresh while online and try again.');
    status('Opening PDF locally…');
    const pdfjs = await loadPdfJs();
    const bytes = await selectedFile.arrayBuffer();
    pdf = await pdfjs.getDocument({ data: bytes }).promise;
    const pageResults = [];
    let totalChars = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      if (cancelled) throw new Error('Conversion cancelled.');
      $('pdf-docx-progress-label').textContent = 'Extracting text from page ' + pageNumber + ' of ' + pdf.numPages + '…';
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent({ includeMarkedContent: false });
      const lines = reconstructPdfLines(content.items || [], content.styles || {});
      totalChars += lines.reduce((sum, line) => sum + line.text.length, 0);
      const viewport = page.getViewport({ scale: 1 });
      pageResults.push({ pageNumber, width: viewport.width, height: viewport.height, lines });
      $('pdf-docx-progress-label').textContent = 'Extracted page ' + pageNumber + ' of ' + pdf.numPages;
    }
    if (cancelled) throw new Error('Conversion cancelled.');
    const textPages = countPdfTextPages(pageResults);
    if (!textPages || !totalChars) throw new Error('No selectable text was found. This PDF appears to be scanned or image-only. Run OCR & Searchable PDF first, then use the OCR-processed PDF here.');
    const api = window.docx;
    const sections = pageResults.map(page => {
      const sizes = page.lines.map(line => line.fontSize).filter(Number.isFinite);
      const medianSize = median(sizes) || 11;
      const children = page.lines.length
        ? page.lines.map(line => makeParagraph(line, medianSize, api))
        : [new api.Paragraph({ children: [new api.TextRun({ text: '[No selectable text found on this page. Run OCR first to recover its text.]', italics: true, color: '777777' })] })];
      const width = Math.max(2880, Math.min(31680, Math.round(page.width * 20)));
      const height = Math.max(2880, Math.min(31680, Math.round(page.height * 20)));
      return {
        properties: {
          type: api.SectionType.NEXT_PAGE,
          page: {
            size: { width, height, orientation: width > height ? api.PageOrientation.LANDSCAPE : api.PageOrientation.PORTRAIT },
            margin: { top: 720, right: 720, bottom: 720, left: 720 }
          }
        },
        children
      };
    });
    status('Building editable Word document…');
    $('pdf-docx-progress-label').textContent = 'Generating DOCX file…';
    const document = new api.Document({
      title: selectedFile.name.replace(/\.pdf$/i, ''),
      sections
    });
    const blob = await api.Packer.toBlob(document);
    if (cancelled) throw new Error('Conversion cancelled.');
    const filename = sanitizeDocxFilename(selectedFile.name);
    downloadBlob(blob, filename);
    const emptyPages = pageResults.length - textPages;
    $('pdf-docx-stats').hidden = false;
    $('pdf-docx-stats').innerHTML = '<span>' + pdf.numPages + ' pages processed</span><span>' + textPages + ' pages with text</span><span>' + emptyPages + ' pages without text</span><span>' + (blob.size / 1024).toFixed(1) + ' KB DOCX</span>';
    status('DOCX created and download started. Review reading order, page breaks, and formatting in Word. ' + (emptyPages ? emptyPages + ' page(s) had no selectable text and were marked for OCR.' : 'All pages contained selectable text.'));
  } catch (error) {
    const message = error?.message || String(error);
    if (/password|encrypted/i.test(message) || error?.name === 'PasswordException') status('This PDF is password-protected. Unlock it with the PDF password tool, save an unlocked copy, then convert that copy.', true);
    else status(/cancelled/i.test(message) ? 'Conversion cancelled. No DOCX was downloaded.' : 'Conversion failed: ' + message, !/cancelled/i.test(message));
  } finally {
    if (pdf) { try { await pdf.destroy(); } catch (_) {} }
    setBusy(false);
  }
}
function init() {
  addStyles(); addPanel(); addNavigation();
  const drop = $('pdf-docx-drop'), input = $('pdf-docx-input');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); } });
  drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', event => { event.preventDefault(); drop.classList.remove('dragover'); const file = event.dataTransfer?.files?.[0]; if (file) { validatePdf(file).then(() => setFile(file)).catch(error => status(error.message, true)); } });
  input.addEventListener('change', () => { const file = input.files?.[0]; if (file) validatePdf(file).then(() => setFile(file)).catch(error => status(error.message, true)); });
  $('pdf-docx-change').addEventListener('click', () => input.click());
  $('pdf-docx-run').addEventListener('click', convert);
  $('pdf-docx-clear').addEventListener('click', clearFile);
  $('pdf-docx-cancel').addEventListener('click', () => { cancelled = true; status('Cancelling after the current page…'); });
}
if (typeof window !== 'undefined') {
  window.PDFToolkitSetPdfToDocxFile = file => { showPanel(); if (file) validatePdf(file).then(() => setFile(file)).catch(error => status(error.message, true)); };
  window.PDFToolkitOpenPdfToDocx = file => { showPanel(); if (file) validatePdf(file).then(() => setFile(file)).catch(error => status(error.message, true)); };
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}
