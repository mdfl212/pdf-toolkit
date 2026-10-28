import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [ocr, serviceWorker, readme, checklist] = await Promise.all([
  readFile(new URL('../ocr.js', import.meta.url), 'utf8'),
  readFile(new URL('../sw.js', import.meta.url), 'utf8'),
  readFile(new URL('../README.md', import.meta.url), 'utf8'),
  readFile(new URL('../docs/OCR_SEARCHABILITY_TESTS.md', import.meta.url), 'utf8')
]);

test('all user-facing OCR layout modes are mapped to Tesseract page segmentation modes', () => {
  for (const mode of ['auto', 'single-column', 'single-block', 'sparse']) {
    assert.match(ocr, new RegExp("'" + mode.replace('-', '\\-') + "'\\s*:\\s*Tesseract\\.PSM\\."));
  }
  assert.match(ocr, /tessedit_pageseg_mode:\s*pageSegmentationMode/);
});

test('OCR text is added invisibly while original page artwork is rendered into the output PDF', () => {
  assert.match(ocr, /page\.render\(\{canvasContext:ctx, viewport, background:'#fff'\}\)\.promise/);
  assert.match(ocr, /outPage\.drawText\(rawWord,\s*\{[^}]*opacity:\s*0[^}]*\}\)/);
});

test('large-page render is capped and canvas/PDF resources are cleaned up', () => {
  assert.match(ocr, /const maxPixels = 18000000/);
  assert.match(ocr, /canvas\.width = 0; canvas\.height = 0/);
  assert.match(ocr, /await source\.destroy\(\)/);
  assert.match(ocr, /await pdfWorker\.terminate\(\)/);
});

test('usable existing text layers are skipped to avoid duplicate overlays', () => {
  assert.match(ocr, /if \(hasUsableTextLayer\(page, textItems\)\)\s*\{\s*skipped\+\+;/);
  assert.match(ocr, /Selected pages already contain selectable text/);
});

test('service worker cache version changes with the OCR update', () => {
  assert.match(serviceWorker, /const CACHE = 'pdf-toolkit-v5'/);
});

test('documentation describes searchability limitations and links the manual regression checklist', () => {
  assert.match(readme, /defective existing text layers are not automatically repaired/i);
  assert.match(readme, /OCR_SEARCHABILITY_TESTS\.md/);
  assert.match(checklist, /Highlight positioning/);
  assert.match(checklist, /Visual preservation/);
  assert.match(checklist, /BobEvn/);
});
