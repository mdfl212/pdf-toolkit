import { detectFileFormat } from './file-detection.js';

const FORMAT_INFO = {
  xlsx: { label: 'Excel workbook', title: 'Excel to PDF', note: 'Workbook values and visible tables are rendered. Formulas are not recalculated; charts, drawings, macros, and exact Excel pagination are not preserved.' },
  pptx: { label: 'PowerPoint presentation', title: 'PowerPoint to PDF', note: 'Slides are rendered locally for printing. Animations and transitions are static; complex effects, embedded media, SmartArt, and unusual fonts may differ from PowerPoint.' },
  odt: { label: 'OpenDocument text', title: 'ODT to PDF', note: 'Text, basic paragraph formatting, lists, and tables are reconstructed. Images, charts, tracked changes, and advanced OpenDocument styles may be omitted.' },
  rtf: { label: 'Rich Text Format', title: 'RTF to PDF', note: 'RTF text and supported formatting are rendered locally. Some embedded image formats and uncommon RTF controls may not be reproduced.' },
  html: { label: 'HTML document', title: 'HTML to PDF', note: 'Scripts, forms, embedded frames, external stylesheets, and remote images are removed before preview and printing for safety and privacy.' },
  txt: { label: 'Plain text', title: 'Text to PDF', note: 'Text is printed with line breaks preserved. UTF-8 and UTF-16 text encodings are supported.' }
};
const MAX_FILE_BYTES = 80 * 1024 * 1024;
const MAX_WORKBOOK_CELLS = 250000;
const MAX_SLIDES = 200;
const $ = id => document.getElementById(id);
let selectedFile = null;
let selectedFormat = null;
let busy = false;
let rendered = false;
let renderToken = 0;

export function sanitizeAdditionalPdfFilename(name) {
  const base = String(name || 'document').replace(/\.[^.]+$/, '');
  const safe = base.normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim();
  return (safe || 'document').slice(0, 140) + '.pdf';
}
export function decodeAdditionalText(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) return new TextDecoder('utf-8').decode(data.subarray(3));
  if (data.length >= 2 && data[0] === 0xff && data[1] === 0xfe) return new TextDecoder('utf-16le').decode(data.subarray(2));
  if (data.length >= 2 && data[0] === 0xfe && data[1] === 0xff) return new TextDecoder('utf-16be').decode(data.subarray(2));
  return new TextDecoder('utf-8').decode(data);
}
export function escapeAdditionalHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
}
export function isAdditionalFormat(format) {
  return Object.prototype.hasOwnProperty.call(FORMAT_INFO, format);
}
function setStatus(message, error = false) {
  const node = $('additional-pdf-status');
  if (!node) return;
  node.textContent = message || '';
  node.hidden = !message;
  node.dataset.error = error ? 'true' : 'false';
}
function setBusy(value) {
  busy = value;
  $('additional-pdf-render').disabled = value || !selectedFile;
  $('additional-pdf-print').disabled = value || !rendered;
  $('additional-pdf-clear').disabled = value || !selectedFile;
  $('additional-pdf-progress').hidden = !value;
}
function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return 'Size unavailable';
  return bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1048576).toFixed(2) + ' MB';
}
function downloadScript(url, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  const existing = [...document.scripts].find(script => script.src === url);
  if (existing?.dataset.loaded === 'true' && window[globalName]) return Promise.resolve(window[globalName]);
  return new Promise((resolve, reject) => {
    const script = existing || document.createElement('script');
    const fail = () => reject(new Error('Could not load the ' + globalName + ' conversion library. Connect to the internet, refresh, and try again.'));
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      if (window[globalName]) resolve(window[globalName]);
      else fail();
    }, { once: true });
    script.addEventListener('error', fail, { once: true });
    if (!existing) { script.src = url; script.async = true; document.head.append(script); }
  });
}
function clearPreview() {
  $('additional-pdf-preview').replaceChildren();
  rendered = false;
  $('additional-pdf-preview-wrap').hidden = true;
  $('additional-pdf-print').disabled = true;
}
function showPanel() {
  document.querySelectorAll('.panel').forEach(panel => panel.classList.toggle('active', panel.id === 'panel-additional-formats'));
  document.querySelectorAll('.tool-btn').forEach(button => button.classList.toggle('active', button.dataset.panel === 'additional-formats'));
  document.querySelectorAll('.mobile-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === 'tools'));
  document.querySelector('.mobile-tools-sheet.open')?.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function addStyles() {
  if ($('additional-pdf-styles')) return;
  const style = document.createElement('style');
  style.id = 'additional-pdf-styles';
  style.textContent = [
    '.additional-pdf-preview{background:#fff;color:#202020;border-radius:10px;padding:24px;overflow:auto;max-height:68vh;box-shadow:0 4px 18px rgba(0,0,0,.18)}',
    '.additional-pdf-preview h1,.additional-pdf-preview h2,.additional-pdf-preview h3{color:#202020;margin:1em 0 .45em}',
    '.additional-pdf-preview p{margin:.45em 0}.additional-pdf-preview pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.55 ui-monospace,monospace;color:#202020}',
    '.additional-pdf-preview table{border-collapse:collapse;width:100%;margin:12px 0;font:12px/1.4 Arial,sans-serif;color:#202020}',
    '.additional-pdf-preview th,.additional-pdf-preview td{border:1px solid #b8b8b8;padding:5px 7px;vertical-align:top;text-align:left}',
    '.additional-pdf-preview th{background:#edf0f2;font-weight:700}.additional-pdf-preview img{max-width:100%;height:auto}',
    '.additional-pdf-preview .additional-slide{break-after:page;page-break-after:always;margin:0 auto 24px;max-width:100%;text-align:center}',
    '.additional-pdf-preview .additional-slide:last-child{break-after:auto;page-break-after:auto}',
    '.additional-pdf-preview .additional-slide img{display:block;width:100%;height:auto;max-height:72vh;object-fit:contain}',
    '.additional-pdf-preview .additional-sheet{break-before:page;page-break-before:always}.additional-pdf-preview .additional-sheet:first-child{break-before:auto;page-break-before:auto}',
    '.additional-pdf-preview .additional-odt-table{border-collapse:collapse}.additional-pdf-preview .additional-odt-table td{min-width:48px}',
    '@media(max-width:700px){.additional-pdf-preview{padding:12px}.additional-pdf-preview table{font-size:10px}}',
    '@media print{body.printing-additional>*{display:none!important}body.printing-additional #additional-pdf-print-frame{display:block!important}}'
  ].join('');
  document.head.append(style);
}
function addPanel() {
  if ($('panel-additional-formats')) return;
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.id = 'panel-additional-formats';
  panel.innerHTML = [
    '<h2>Additional formats to PDF</h2>',
    '<p class="subtitle">Convert Excel, PowerPoint, OpenDocument, RTF, HTML, and text files using local browser rendering, then review and choose Print / Save as PDF.</p>',
    '<div class="drop-zone" id="additional-pdf-drop" tabindex="0" role="button" aria-label="Choose or drop a supported document">',
    '<div class="drop-icon">▤</div><p><strong>Drop a supported file here</strong> or click to browse</p>',
    '<p class="hint">.xlsx · .pptx · .odt · .rtf · .html · .htm · .txt · files stay on this device</p>',
    '<input id="additional-pdf-input" type="file" accept=".xlsx,.pptx,.odt,.rtf,.html,.htm,.txt" hidden></div>',
    '<div class="docx-pdf-filebar" id="additional-pdf-filebar" hidden><div><strong id="additional-pdf-filename"></strong><span id="additional-pdf-filemeta"></span></div><button class="btn btn-secondary btn-sm" id="additional-pdf-change" type="button">Change file</button></div>',
    '<div class="docx-pdf-actions"><button class="btn btn-primary" id="additional-pdf-render" type="button" disabled>Prepare preview</button><button class="btn btn-secondary" id="additional-pdf-print" type="button" disabled>Print / Save as PDF</button><button class="btn btn-secondary btn-sm" id="additional-pdf-clear" type="button" disabled>Clear</button></div>',
    '<div class="docx-pdf-progress" id="additional-pdf-progress" hidden><span class="docx-pdf-spinner"></span><span>Preparing document locally…</span></div>',
    '<div class="note" id="additional-pdf-status" role="status" aria-live="polite" hidden></div>',
    '<div id="additional-pdf-preview-wrap" hidden><div class="docx-pdf-preview-heading"><strong>Document preview</strong><span id="additional-pdf-preview-meta"></span></div><div id="additional-pdf-preview" class="additional-pdf-preview" aria-label="Converted document preview"></div></div>',
    '<div class="note"><strong>Conversion limits:</strong> this uses browser rendering and the native print dialog, not Microsoft Office or LibreOffice. Complex layouts, formulas, charts, embedded media, fonts, and page breaks can differ. Review every page before saving. Legacy .doc files are not supported.</div>'
  ].join('');
  const anchor = $('panel-docx-pdf') || $('panel-pdf-images') || $('panel-compress');
  if (anchor?.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling);
  else document.querySelector('main')?.append(panel);
}
function addNavigation() {
  if (document.querySelector('[data-panel="additional-formats"]')) return;
  const section = [...document.querySelectorAll('.tool-section')].find(item => item.querySelector('[data-panel="docx-pdf"]') || item.querySelector('[data-panel="image-pdf"]'));
  if (section) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'tool-btn'; button.dataset.panel = 'additional-formats';
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 15h6M9 18h4"/></svg><span>Additional formats to PDF</span>';
    button.addEventListener('click', showPanel);
    section.append(button);
  }
  const mobile = $('mobile-tools-grid');
  if (mobile) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'mobile-tool-card'; button.dataset.panel = 'additional-formats';
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 15h6M9 18h4"/></svg><span>Additional formats to PDF</span>';
    button.addEventListener('click', showPanel);
    mobile.append(button);
  }
}
async function setFile(file) {
  if (!file || busy) return;
  try {
    if (file.size > MAX_FILE_BYTES) throw new Error('This file is larger than 80 MB. Try a smaller file to avoid exhausting browser memory.');
    const detection = await detectFileFormat(file);
    if (!isAdditionalFormat(detection.format)) throw new Error('This file is not a supported Batch 5 format. Supported formats: XLSX, PPTX, ODT, RTF, HTML, and TXT.');
    if (!detection.route.available) throw new Error('This format has not been enabled for conversion.');
    selectedFile = file;
    selectedFormat = detection.format;
    clearPreview();
    $('additional-pdf-filebar').hidden = false;
    $('additional-pdf-filename').textContent = file.name;
    $('additional-pdf-filemeta').textContent = formatSize(file.size) + ' · ' + detection.code;
    $('additional-pdf-render').disabled = false;
    $('additional-pdf-clear').disabled = false;
    setStatus(detection.label + ' selected. Prepare a preview to review the output before printing.');
  } catch (error) {
    setStatus(error?.message || String(error), true);
  }
}
function addText(parent, tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  parent.append(node);
  return node;
}
function decodeXmlText(node) {
  return node.textContent || '';
}
function odtNodeHtml(node) {
  if (node.nodeType === Node.TEXT_NODE) return escapeAdditionalHtml(node.nodeValue);
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const name = node.localName || node.nodeName.split(':').pop();
  const children = [...node.childNodes].map(odtNodeHtml).join('');
  const tags = {
    p: 'p', h: 'h3', span: 'span', a: 'span', list: 'ul', 'list-item': 'li',
    table: 'table', 'table-row': 'tr', 'table-cell': 'td', 'table-header-rows': 'tbody',
    'table-header-row': 'tr', 'table-columns': 'div', 'table-column': 'span'
  };
  if (name === 's') {
    const count = Math.max(1, Math.min(100, Number(node.getAttributeNS('urn:oasis:names:tc:opendocument:xmlns:text:1.0', 'c')) || 1));
    return ' '.repeat(count);
  }
  if (name === 'tab') return '    ';
  if (name === 'line-break') return '<br>';
  if (name === 'soft-page-break') return '<span class="odt-page-break"></span>';
  if (name === 'frame' || name === 'image' || name === 'object') return '';
  const tag = tags[name];
  if (!tag) return children;
  const cls = name === 'table' ? ' class="additional-odt-table"' : '';
  return '<' + tag + cls + '>' + children + '</' + tag + '>';
}
function odtToHtml(xml) {
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  if (parsed.querySelector('parsererror')) throw new Error('The ODT content.xml package could not be parsed.');
  const body = parsed.getElementsByTagNameNS('*', 'text')[0] || parsed.documentElement;
  const html = [...body.childNodes].map(odtNodeHtml).join('');
  if (!html.trim()) throw new Error('No printable text was found in this ODT file.');
  return html;
}
function sanitizeHtmlSource(source) {
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  parsed.querySelectorAll('script,style,iframe,frame,object,embed,form,input,button,textarea,select,option,link,base,meta[http-equiv],video,audio,source,svg').forEach(node => node.remove());
  parsed.querySelectorAll('*').forEach(node => {
    [...node.attributes].forEach(attribute => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith('on') || ['srcdoc','formaction','action','style','srcset','background'].includes(name)) node.removeAttribute(attribute.name);
      else if (['href','src','xlink:href'].includes(name) && /^(?:javascript|vbscript|file):/i.test(value)) node.removeAttribute(attribute.name);
      else if (['src','href','xlink:href'].includes(name) && /^https?:/i.test(value)) node.removeAttribute(attribute.name);
    });
  });
  parsed.querySelectorAll('img').forEach(node => {
    const src = node.getAttribute('src') || '';
    if (!/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(src)) node.remove();
  });
  return parsed.body.innerHTML;
}
async function renderText(file, target) {
  const text = decodeAdditionalText(new Uint8Array(await file.arrayBuffer()));
  const pre = document.createElement('pre');
  pre.textContent = text.replace(/\r\n?/g, '\n');
  target.append(pre);
  return { meta: 'Text document · ' + text.length.toLocaleString() + ' characters', warning: '' };
}
async function renderHtml(file, target) {
  const source = decodeAdditionalText(new Uint8Array(await file.arrayBuffer()));
  const safe = sanitizeHtmlSource(source);
  if (!safe.trim()) throw new Error('No safe printable HTML content remained after removing active content.');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = safe;
  target.append(wrapper);
  return { meta: 'Sanitized HTML preview', warning: 'Scripts, forms, remote resources, and external styles were removed.' };
}
async function renderRtf(file, target) {
  await Promise.all([
    downloadScript('https://cdn.jsdelivr.net/npm/rtf.js@3.0.9/dist/RTFJS.bundle.js', 'RTFJS'),
    downloadScript('https://cdn.jsdelivr.net/npm/rtf.js@3.0.9/dist/WMFJS.bundle.js', 'WMFJS'),
    downloadScript('https://cdn.jsdelivr.net/npm/rtf.js@3.0.9/dist/EMFJS.bundle.js', 'EMFJS')
  ]);
  window.RTFJS.loggingEnabled?.(false);
  window.WMFJS?.loggingEnabled?.(false);
  window.EMFJS?.loggingEnabled?.(false);
  const doc = new window.RTFJS.Document(await file.arrayBuffer());
  const nodes = await doc.render();
  nodes.forEach(node => target.append(node));
  if (!target.childNodes.length) throw new Error('The RTF renderer did not return printable content.');
  return { meta: 'RTF document rendered', warning: 'Check embedded images and unusual formatting in the preview.' };
}
async function renderOdt(file, target) {
  if (!window.JSZip) throw new Error('The ZIP reader did not load. Refresh the app while online and try again.');
  const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
  const content = zip.file('content.xml');
  if (!content) throw new Error('This ODT package does not contain content.xml.');
  const html = odtToHtml(await content.async('string'));
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  target.append(wrapper);
  return { meta: 'ODT document reconstructed', warning: FORMAT_INFO.odt.note };
}
async function renderXlsx(file, target) {
  const XLSX = await downloadScript('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js', 'XLSX');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, cellNF: false, cellStyles: false });
  if (!workbook.SheetNames.length) throw new Error('No worksheets were found in this workbook.');
  let totalCells = 0;
  workbook.SheetNames.forEach((name, index) => {
    const sheet = workbook.Sheets[name];
    const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : { s:{r:0,c:0}, e:{r:-1,c:-1} };
    const rows = Math.max(0, range.e.r - range.s.r + 1);
    const cols = Math.max(0, range.e.c - range.s.c + 1);
    totalCells += rows * cols;
    if (totalCells > MAX_WORKBOOK_CELLS) throw new Error('This workbook contains more than 250,000 printable cells. Split the workbook into smaller files or remove unused rows and columns.');
    const section = document.createElement('section');
    section.className = 'additional-sheet';
    addText(section, 'h2', name || 'Sheet ' + (index + 1));
    if (!rows || !cols) addText(section, 'p', '[This worksheet is empty.]');
    else {
      const table = document.createElement('table');
      const body = document.createElement('tbody');
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '', blankrows: false });
      matrix.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(value => addText(tr, 'td', value == null ? '' : String(value)));
        body.append(tr);
      });
      table.append(body);
      section.append(table);
    }
    target.append(section);
  });
  return { meta: workbook.SheetNames.length + ' worksheet(s) · ' + totalCells.toLocaleString() + ' cells', warning: FORMAT_INFO.xlsx.note };
}
async function renderPptx(file, target) {
  const [core, preview] = await Promise.all([
    import('https://esm.sh/@office-kit/pptx@0.28.0?bundle'),
    import('https://esm.sh/@office-kit/pptx-preview@0.28.0?bundle')
  ]);
  const presentation = await core.loadPresentation(await file.arrayBuffer());
  const slides = core.getSlides(presentation);
  if (!slides.length) throw new Error('No slides were found in this presentation.');
  if (slides.length > MAX_SLIDES) throw new Error('This presentation has more than 200 slides. Split it into smaller presentations to avoid browser memory issues.');
  slides.forEach((slide, index) => {
    const svg = preview.renderSlideToSvg(presentation, slide);
    const markup = typeof svg === 'string' ? svg : svg?.outerHTML;
    if (!markup || !/<svg[\s>]/i.test(markup)) throw new Error('The renderer could not create slide ' + (index + 1) + '.');
    const section = document.createElement('section');
    section.className = 'additional-slide';
    const image = document.createElement('img');
    image.alt = 'Slide ' + (index + 1);
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
    section.append(image);
    target.append(section);
  });
  return { meta: slides.length + ' slide(s) rendered', warning: FORMAT_INFO.pptx.note };
}
async function renderDocument() {
  if (!selectedFile || busy) return;
  const token = ++renderToken;
  setBusy(true);
  clearPreview();
  setStatus('Validating ' + FORMAT_INFO[selectedFormat].label + '…');
  try {
    const detection = await detectFileFormat(selectedFile);
    if (detection.format !== selectedFormat || !detection.route.available) throw new Error('The file content does not match the selected supported format.');
    const target = $('additional-pdf-preview');
    setStatus('Rendering ' + FORMAT_INFO[selectedFormat].label + ' locally. The document is not uploaded.');
    let result;
    if (selectedFormat === 'xlsx') result = await renderXlsx(selectedFile, target);
    else if (selectedFormat === 'pptx') result = await renderPptx(selectedFile, target);
    else if (selectedFormat === 'odt') result = await renderOdt(selectedFile, target);
    else if (selectedFormat === 'rtf') result = await renderRtf(selectedFile, target);
    else if (selectedFormat === 'html') result = await renderHtml(selectedFile, target);
    else result = await renderText(selectedFile, target);
    if (token !== renderToken) return;
    rendered = true;
    $('additional-pdf-preview-wrap').hidden = false;
    $('additional-pdf-preview-meta').textContent = result.meta;
    $('additional-pdf-print').disabled = false;
    setStatus('Preview ready. ' + (result.warning || FORMAT_INFO[selectedFormat].note) + ' Review it, then choose Print / Save as PDF.');
  } catch (error) {
    clearPreview();
    setStatus('Could not prepare this file: ' + (error?.message || String(error)), true);
  } finally {
    if (token === renderToken) setBusy(false);
  }
}
function printDocument() {
  if (!rendered || busy) return;
  const preview = $('additional-pdf-preview');
  const html = preview.innerHTML;
  const title = selectedFile?.name || 'document';
  const printCss = [
    '@page{size:auto;margin:14mm}',
    'html,body{margin:0;padding:0;background:#fff;color:#111;font:10pt/1.45 Arial,Helvetica,sans-serif}',
    'body{padding:0}h1,h2,h3{break-after:avoid;page-break-after:avoid}',
    'table{border-collapse:collapse;width:100%;max-width:100%;font-size:9pt;break-inside:auto}',
    'tr{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #aaa;padding:4px 6px;text-align:left;vertical-align:top}',
    'th{background:#eee!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    'pre{white-space:pre-wrap;overflow-wrap:anywhere;font:9pt/1.45 monospace}',
    '.additional-slide{break-after:page;page-break-after:always;text-align:center}',
    '.additional-slide:last-child{break-after:auto;page-break-after:auto}',
    '.additional-slide img{display:block;width:100%;height:auto;max-height:260mm;object-fit:contain}',
    '.additional-sheet{break-before:page;page-break-before:always}.additional-sheet:first-child{break-before:auto;page-break-before:auto}',
    'img{max-width:100%;height:auto}'
  ].join('');
  const frame = document.createElement('iframe');
  frame.id = 'additional-pdf-print-frame';
  frame.title = 'Print preview';
  frame.setAttribute('sandbox', 'allow-modals allow-same-origin');
  frame.style.cssText = 'position:fixed;width:1px;height:1px;right:0;bottom:0;border:0;opacity:0;pointer-events:none;';
  frame.onload = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      frame.contentWindow.addEventListener('afterprint', () => frame.remove(), { once: true });
      setTimeout(() => frame.remove(), 60000);
    } catch (error) {
      frame.remove();
      setStatus('The browser could not open its print dialog. Use the browser menu to print the preview.', true);
    }
  };
  const docHtml = '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; style-src \'unsafe-inline\'; font-src data:"><title>' + escapeAdditionalHtml(sanitizeAdditionalPdfFilename(title).replace(/\.pdf$/i, '')) + '</title><style>' + printCss + '</style></head><body>' + html + '</body></html>';
  document.body.append(frame);
  frame.srcdoc = docHtml;
  setStatus('In the print dialog, choose Save as PDF. Review page breaks and scaling before saving.');
}
function clearFile() {
  if (busy) return;
  renderToken++;
  selectedFile = null;
  selectedFormat = null;
  clearPreview();
  $('additional-pdf-input').value = '';
  $('additional-pdf-filebar').hidden = true;
  $('additional-pdf-render').disabled = true;
  $('additional-pdf-clear').disabled = true;
  setStatus('');
}
function init() {
  addStyles(); addPanel(); addNavigation();
  const drop = $('additional-pdf-drop'), input = $('additional-pdf-input');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); } });
  drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', event => { event.preventDefault(); drop.classList.remove('dragover'); if (event.dataTransfer?.files?.[0]) setFile(event.dataTransfer.files[0]); });
  input.addEventListener('change', () => { if (input.files?.[0]) setFile(input.files[0]); });
  $('additional-pdf-change').addEventListener('click', () => input.click());
  $('additional-pdf-render').addEventListener('click', renderDocument);
  $('additional-pdf-print').addEventListener('click', printDocument);
  $('additional-pdf-clear').addEventListener('click', clearFile);
}
if (typeof window !== 'undefined') {
  window.PDFToolkitOpenAdditionalFormats = file => { showPanel(); if (file) setFile(file); };
  window.PDFToolkitSetAdditionalFormatsFile = file => { showPanel(); if (file) setFile(file); };
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}
