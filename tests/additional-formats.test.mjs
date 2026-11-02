import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAdditionalPdfFilename, decodeAdditionalText, escapeAdditionalHtml, isAdditionalFormat } from '../additional-formats-to-pdf.js';

test('sanitizes output filenames and preserves useful names', () => {
  assert.equal(sanitizeAdditionalPdfFilename('Class Notes.xlsx'), 'Class Notes.pdf');
  assert.equal(sanitizeAdditionalPdfFilename('../../bad:name?.txt'), '..-..-bad-name-.pdf');
  assert.equal(sanitizeAdditionalPdfFilename('.txt'), 'document.pdf');
});
test('decodes UTF-8, UTF-8 BOM, and UTF-16 text', () => {
  assert.equal(decodeAdditionalText(new TextEncoder().encode('Hello')), 'Hello');
  assert.equal(decodeAdditionalText(new Uint8Array([0xef,0xbb,0xbf,72,105])), 'Hi');
  assert.equal(decodeAdditionalText(new Uint8Array([0xff,0xfe,72,0,105,0])), 'Hi');
  assert.equal(decodeAdditionalText(new Uint8Array([0xfe,0xff,0,72,0,105])), 'Hi');
});
test('escapes text before inserting it into HTML', () => {
  assert.equal(escapeAdditionalHtml('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;');
});
test('recognizes only the six additional conversion formats', () => {
  for (const format of ['xlsx','pptx','odt','rtf','html','txt']) assert.equal(isAdditionalFormat(format), true);
  for (const format of ['doc','docx','pdf','zip','unknown']) assert.equal(isAdditionalFormat(format), false);
});
