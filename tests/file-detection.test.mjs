import test from 'node:test';
import assert from 'node:assert/strict';
import { detectFileFormat, formatFileSize } from '../file-detection.js';

function file(name, bytes, type='') {
  const blob=new Blob([bytes],{type});
  Object.defineProperty(blob,'name',{value:name});
  return blob;
}
function zip(names) {
  const enc=new TextEncoder();
  const locals=[],central=[];
  let localOffset=0;
  for(const name of names) {
    const n=enc.encode(name);
    const local=new Uint8Array(30+n.length),lv=new DataView(local.buffer);
    lv.setUint32(0,0x04034b50,true);lv.setUint16(26,n.length,true);local.set(n,30);
    locals.push(local);
    const record=new Uint8Array(46+n.length),cv=new DataView(record.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(28,n.length,true);cv.setUint32(42,localOffset,true);record.set(n,46);
    central.push(record);localOffset+=local.length;
  }
  const size=central.reduce((a,b)=>a+b.length,0),dir=new Uint8Array(size);
  let p=0;for(const b of central){dir.set(b,p);p+=b.length;}
  const end=new Uint8Array(22),v=new DataView(end.buffer);
  v.setUint32(0,0x06054b50,true);v.setUint16(8,names.length,true);v.setUint16(10,names.length,true);
  v.setUint32(12,size,true);v.setUint32(16,localOffset,true);
  return new Blob([...locals,dir,end]);
}

test('PDF signature overrides a misleading extension',async()=>{
  const r=await detectFileFormat(file('lecture.bin','%PDF-1.7\n'));
  assert.equal(r.format,'pdf');assert.equal(r.isPdf,true);assert.equal(r.extensionMismatch,true);
});
test('detects common image signatures',async t=>{
  const cases=[
    ['photo.jpg',[255,216,255,224],'jpeg'],['scan.png',[137,80,78,71,13,10,26,10],'png'],
    ['anim.gif',[... 'GIF89a'].map(c=>c.charCodeAt(0)),'gif'],['image.bmp',[66,77],'bmp'],
    ['scan.tif',[73,73,42,0],'tiff'],['photo.webp',[...'RIFF0000WEBP'].map(c=>c.charCodeAt(0)),'webp'],
    ['photo.heic',[...'0000ftypheic'].map(c=>c.charCodeAt(0)),'heic']
  ];
  for(const [name,bytes,expected] of cases) await t.test(name,async()=>{
    const r=await detectFileFormat(file(name,bytes));assert.equal(r.format,expected);assert.equal(r.route.phase,'Batch 2');
  });
});
test('identifies DOCX, XLSX, and PPTX from ZIP package entries',async t=>{
  const cases=[
    ['notes.docx',['[Content_Types].xml','word/document.xml'],'docx'],
    ['data.xlsx',['[Content_Types].xml','xl/workbook.xml'],'xlsx'],
    ['slides.pptx',['[Content_Types].xml','ppt/presentation.xml'],'pptx'],
    ['notes.odt',['content.xml','META-INF/manifest.xml'],'odt']
  ];
  for(const [name,entries,expected] of cases) await t.test(name,async()=>{
    const r=await detectFileFormat(file(name,await zip(entries).arrayBuffer()));assert.equal(r.format,expected);
  });
});
test('detects RTF, HTML, and TXT',async()=>{
  assert.equal((await detectFileFormat(file('note.rtf','{\\rtf1 Hello}'))).format,'rtf');
  assert.equal((await detectFileFormat(file('page.dat','<!doctype html><html></html>'))).format,'html');
  assert.equal((await detectFileFormat(file('notes.txt','Plain UTF-8 notes'))).format,'txt');
});
test('does not trust a false PDF extension',async()=>{
  const r=await detectFileFormat(file('fake.pdf','not a PDF'));assert.equal(r.format,'unknown');assert.match(r.warning,/filename suggests/i);
});
test('does not classify an arbitrary ZIP as DOCX',async()=>{
  const r=await detectFileFormat(file('archive.zip',await zip(['manifest.json']).arrayBuffer()));
  assert.equal(r.format,'zip');assert.equal(r.route.available,false);
});
test('rejects invalid detector input',async()=>{
  await assert.rejects(()=>detectFileFormat({name:'bad.pdf'}),/File object/i);
});
test('formats file sizes',()=>{
  assert.equal(formatFileSize(0),'0 B');assert.equal(formatFileSize(1024),'1.00 KB');assert.equal(formatFileSize(1048576),'1.00 MB');
});
