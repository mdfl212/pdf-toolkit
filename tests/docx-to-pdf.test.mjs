import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePdfFilename, countRenderedDocxPages, hasRenderedDocxPages, isDocxRendererReady } from '../docx-to-pdf.js';

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

test('requires both JSZip and the docx-preview renderAsync API',()=>{
  assert.equal(isDocxRendererReady({renderAsync(){}},{}),true);
  assert.equal(isDocxRendererReady({renderAsync(){}},null),false);
  assert.equal(isDocxRendererReady({},{}),false);
  assert.equal(isDocxRendererReady(null,{}),false);
});
test('only treats a preview with rendered DOCX pages as printable',()=>{
  const empty={querySelectorAll:()=>({length:0})};
  const pages={querySelectorAll:()=>({length:2})};
  assert.equal(hasRenderedDocxPages(empty),false);
  assert.equal(hasRenderedDocxPages(pages),true);
});
