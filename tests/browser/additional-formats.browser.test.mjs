import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' };
let server, browser, page, origin;
async function startServer() {
  server = http.createServer(async (req,res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const target = path.resolve(root,'.'+pathname);
      if (target !== root && !target.startsWith(root+path.sep)) throw new Error('Invalid path');
      const stat = await fs.stat(target), file = stat.isDirectory() ? path.join(target,'index.html') : target;
      res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin='http://127.0.0.1:'+server.address().port;
}
async function makeOdt() {
  const z=new JSZip();
  z.file('mimetype','application/vnd.oasis.opendocument.text',{compression:'STORE'});
  z.file('META-INF/manifest.xml','<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/></manifest:manifest>');
  z.file('content.xml','<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"><office:body><office:text><text:h text:outline-level="1">QA ODT HEADING</text:h><text:p>QA ODT PARAGRAPH</text:p><text:list><text:list-item><text:p>QA ODT LIST ITEM</text:p></text:list-item></text:list><table:table><table:table-row><table:table-cell><text:p>QA ODT TABLE CELL</text:p></table:table-cell></table:table-row></table:table></office:text></office:body></office:document-content>');
  return z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
async function makeXlsx() {
  const z=new JSZip();
  z.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  z.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  z.file('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="QA Worksheet" sheetId="1" r:id="rId1"/></sheets></workbook>');
  z.file('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  z.file('xl/worksheets/sheet1.xml','<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>QA XLSX CELL</t></is></c><c r="B1" t="inlineStr"><is><t>42</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>SECOND ROW</t></is></c></row></sheetData></worksheet>');
  return z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
async function makePptx() {
  const p=new PptxGenJS(); p.layout='LAYOUT_WIDE';
  p.addSlide().addText('QA PPTX SLIDE TEXT',{x:1,y:1,w:8,h:1,fontFace:'Arial',fontSize:28,bold:true});
  return Buffer.from(await p.write({outputType:'nodebuffer'}));
}
function payload(name,buffer,mimeType){return {name,mimeType,buffer:Buffer.from(buffer)};}
async function uploadAndRender(file,expected) {
  await page.locator('#additional-pdf-input').setInputFiles(file);
  await page.waitForFunction(()=>document.querySelector('#additional-pdf-status')?.textContent.includes('selected.'));
  await page.locator('#additional-pdf-render').click();
  await page.waitForFunction(()=>document.querySelector('#additional-pdf-status')?.textContent.includes('Preview ready.'),{timeout:150000});
  const text=await page.locator('#additional-pdf-preview').innerText();
  if(expected) assert.match(text,expected);
  assert.equal(await page.locator('#additional-pdf-print').isDisabled(),false);
}
async function clear(){await page.locator('#additional-pdf-clear').click();assert.equal(await page.locator('#additional-pdf-preview-wrap').isHidden(),true);}
test('Batch 5 browser conversion smoke and compatibility pass',{timeout:900000},async t=>{
  await startServer();
  const engine=process.env.BROWSER||'chromium', launchers={chromium,firefox,webkit};
  assert.ok(launchers[engine],'BROWSER must be chromium, firefox, or webkit');
  browser=await launchers[engine].launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',ignoreHTTPSErrors:true});
  page=await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/pdf-toolkit.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#panel-additional-formats',{state:'attached',timeout:60000});
  await page.waitForFunction(()=>!!window.JSZip,{timeout:60000});
  assert.equal(await page.locator('.tool-btn[data-panel="additional-formats"]').count(),1,'desktop navigation entry should be registered');
  await page.evaluate(() => window.PDFToolkitOpenAdditionalFormats());
  await page.waitForSelector('#panel-additional-formats.active',{timeout:15000});
  await t.test('XLSX worksheet rendering',async()=>{
    await uploadAndRender(payload('qa-workbook.xlsx',await makeXlsx(),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),/QA XLSX CELL/);
    assert.match(await page.locator('#additional-pdf-preview').innerText(),/QA Worksheet/); await clear();
  });
  await t.test('PPTX slide SVG rendering',async()=>{
    await uploadAndRender(payload('qa-slides.pptx',await makePptx(),'application/vnd.openxmlformats-officedocument.presentationml.presentation'),null);
    const img=page.locator('#additional-pdf-preview .additional-slide img').first(); await img.waitFor({state:'visible'});
    await page.waitForFunction(()=>{const i=document.querySelector('#additional-pdf-preview .additional-slide img');return !!i&&i.complete&&i.naturalWidth>0;},{timeout:30000});
    const src=await img.getAttribute('src'); assert.match(decodeURIComponent(src.split(',')[1]),/QA PPTX SLIDE TEXT/); await clear();
  });
  await t.test('ODT paragraphs, lists, and tables',async()=>{
    await uploadAndRender(payload('qa-document.odt',await makeOdt(),'application/vnd.oasis.opendocument.text'),/QA ODT PARAGRAPH/);
    const text=await page.locator('#additional-pdf-preview').innerText();
    assert.match(text,/QA ODT HEADING/); assert.match(text,/QA ODT LIST ITEM/); assert.match(text,/QA ODT TABLE CELL/); await clear();
  });
  await t.test('RTF renderer loads and renders text',async()=>{
    const rtf=Buffer.from('{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\f0\\fs28 QA RTF CONTENT\\par Second RTF line}','utf8');
    await uploadAndRender(payload('qa-notes.rtf',rtf,'application/rtf'),/QA RTF CONTENT/); await clear();
  });
  await t.test('HTML active content and external resources are removed',async()=>{
    const html='<!doctype html><html><head><style>body{display:none}</style><link rel="stylesheet" href="https://example.invalid/a.css"></head><body><h1>QA SAFE HTML</h1><p id="safe" style="color:red" onclick="window.__xss=1">Visible HTML</p><script>window.__xss=1</script><form><input value="secret"></form><iframe src="https://example.invalid"></iframe><img src="https://example.invalid/remote.png"><a id="unsafe" href="data:text/html,malicious">unsafe link</a></body></html>';
    await uploadAndRender(payload('qa-page.html',Buffer.from(html),'text/html'),/QA SAFE HTML/);
    assert.equal(await page.locator('#additional-pdf-preview script,#additional-pdf-preview style,#additional-pdf-preview form,#additional-pdf-preview iframe').count(),0);
    assert.equal(await page.locator('#additional-pdf-preview img').count(),0);
    assert.equal(await page.locator('#additional-pdf-preview #safe').getAttribute('onclick'),null);
    assert.equal(await page.locator('#additional-pdf-preview #safe').getAttribute('style'),null);
    assert.equal(await page.locator('#additional-pdf-preview #unsafe').getAttribute('href'),null); await clear();
  });
  await t.test('TXT UTF-16 decoding, line breaks, and print frame',async()=>{
    const buf=Buffer.from([0xff,0xfe,...Buffer.from('QA UTF16 LINE ONE\nQA UTF16 LINE TWO','utf16le')]);
    await uploadAndRender(payload('qa-text.txt',buf,'text/plain'),/QA UTF16 LINE ONE/);
    assert.equal(await page.locator('#additional-pdf-preview pre').innerText(),'QA UTF16 LINE ONE\nQA UTF16 LINE TWO');
    await page.evaluate(() => {
      const append = document.body.append.bind(document.body);
      document.body.append = (...nodes) => {
        append(...nodes);
        for (const node of nodes) if (node?.id === 'additional-pdf-print-frame' && node.contentWindow) {
          try { node.contentWindow.print = () => {}; } catch {}
        }
      };
    });
    await page.locator('#additional-pdf-print').click(); await page.waitForSelector('#additional-pdf-print-frame',{state:'attached'});
    const srcdoc=await page.locator('#additional-pdf-print-frame').getAttribute('srcdoc');
    assert.match(srcdoc,/QA UTF16 LINE ONE/); assert.match(srcdoc,/default-src/); await clear();
  });
  await t.test('mobile viewport layout remains usable',async()=>{
    await page.setViewportSize({width:390,height:844});
    await uploadAndRender(payload('qa-mobile.txt',Buffer.from('Mobile QA line one\nMobile QA line two'),'text/plain'),/Mobile QA line one/);
    const b=await page.locator('#additional-pdf-preview').boundingBox(); assert.ok(b&&b.width>0&&b.width<=390);
    await clear(); await page.setViewportSize({width:1280,height:900});
  });
  assert.deepEqual(errors,[],'browser runtime should not emit uncaught page errors');
  await context.close();
});
test.after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
