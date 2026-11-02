import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePdfFilename, countRenderedDocxPages } from '../docx-to-pdf.js';

test('sanitizes DOCX names into safe PDF filenames',()=>{
  assert.equal(sanitizePdfFilename('Lecture Notes.docx'),'Lecture Notes.pdf');
  assert.equal(sanitizePdfFilename('../bad:name?.docx'),'..-bad-name-.pdf');
  assert.equal(sanitizePdfFilename('.docx'),'document.pdf');
});
test('limits generated filenames to a safe length',()=>{
  assert.ok(sanitizePdfFilename('x'.repeat(300)+'.docx').length<=144);
});
test('counts rendered pages from the preview container',()=>{
  const fake={querySelectorAll:selector=>selector.includes('section.docx')?{length:3}: {length:0}};
  assert.equal(countRenderedDocxPages(fake),3);
  assert.equal(countRenderedDocxPages(null),0);
});
