import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDocxFilename, reconstructPdfLines, countPdfTextPages } from '../pdf-to-docx.js';

test('sanitizes PDF names into safe DOCX filenames', () => {
  assert.equal(sanitizeDocxFilename('Lecture Notes.pdf'), 'Lecture Notes.docx');
  assert.equal(sanitizeDocxFilename('../bad:name?.pdf'), '..-bad-name-.docx');
  assert.equal(sanitizeDocxFilename('.pdf'), 'document.docx');
  assert.ok(sanitizeDocxFilename('x'.repeat(300) + '.pdf').length <= 145);
});

test('reconstructs text items into reading-order lines with inferred spaces', () => {
  const items = [
    { str: 'World', transform: [10,0,0,10,55,700], width: 25, height: 10, fontName: 'Arial' },
    { str: 'Hello', transform: [10,0,0,10,10,700], width: 25, height: 10, fontName: 'Arial' },
    { str: 'Second line', transform: [10,0,0,10,10,680], width: 60, height: 10, fontName: 'Arial' }
  ];
  const lines = reconstructPdfLines(items, { Arial: { fontFamily: 'Arial' } });
  assert.deepEqual(lines.map(line => line.text), ['Hello World', 'Second line']);
  assert.equal(lines[0].font, 'Arial');
  assert.equal(lines[0].runs.map(run => run.text).join(''), 'Hello World');
});

test('detects bold and italic font hints', () => {
  const lines = reconstructPdfLines([
    { str: 'Important', transform: [12,0,0,12,0,10], width: 50, height: 12, fontName: 'Arial-BoldItalic' }
  ]);
  assert.equal(lines[0].bold, true);
  assert.equal(lines[0].italics, true);
});

test('counts pages that contain extractable text', () => {
  assert.equal(countPdfTextPages([{ lines: [{ text: 'x' }] }, { lines: [] }, { lines: [{ text: '  ' }] }]), 1);
});
