const DEFINITIONS = {
  pdf: ['PDF document','PDF',['pdf'],true,null,'Open in PDF workspace'],
  jpeg: ['JPEG image','JPG',['jpg','jpeg'],true,null,'Convert image to PDF'],
  png: ['PNG image','PNG',['png'],true,null,'Convert image to PDF'],
  webp: ['WebP image','WEBP',['webp'],true,null,'Convert image to PDF'],
  gif: ['GIF image','GIF',['gif'],true,null,'Convert image to PDF'],
  bmp: ['Bitmap image','BMP',['bmp'],true,null,'Convert image to PDF'],
  tiff: ['TIFF image','TIFF',['tif','tiff'],true,null,'Convert image to PDF'],
  heic: ['HEIC / HEIF image','HEIC',['heic','heif'],true,null,'Convert image to PDF'],
  docx: ['Microsoft Word document','DOCX',['docx'],true,null,'Convert Word document to PDF'],
  doc: ['Legacy Microsoft Word document','DOC',['doc'],false,'Later batch','Convert legacy Word document to PDF'],
  xlsx: ['Microsoft Excel workbook','XLSX',['xlsx'],true,null,'Convert spreadsheet to PDF'],
  pptx: ['Microsoft PowerPoint presentation','PPTX',['pptx'],true,null,'Convert presentation to PDF'],
  odt: ['OpenDocument text document','ODT',['odt'],true,null,'Convert document to PDF'],
  rtf: ['Rich Text Format document','RTF',['rtf'],true,null,'Convert document to PDF'],
  html: ['HTML document','HTML',['html','htm'],true,null,'Convert HTML to PDF'],
  txt: ['Plain text document','TXT',['txt'],true,null,'Convert text to PDF']
};
const EXTENSIONS = Object.fromEntries(Object.entries(DEFINITIONS).flatMap(([key, value]) => value[2].map(ext => [ext,key])));
const decoder = new TextDecoder();

function extOf(name) {
  const base = String(name || '').split(/[\\/]/).pop() || '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}
function has(bytes, sig, offset=0) { return sig.every((v,i) => bytes[offset+i] === v); }
function latin(bytes, start=0, end=bytes.length) { return new TextDecoder('latin1').decode(bytes.subarray(start,end)); }
async function sliceBytes(file,start,end) { return new Uint8Array(await file.slice(start,end).arrayBuffer()); }

async function zipType(file) {
  if (file.size < 22) return 'zip';
  const start = Math.max(0,file.size-65557);
  const tail = await sliceBytes(file,start,file.size);
  const view = new DataView(tail.buffer,tail.byteOffset,tail.byteLength);
  let end=-1;
  for(let i=tail.length-22;i>=0;i--) if(view.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0) return 'zip';
  const size=view.getUint32(end+12,true), offset=view.getUint32(end+16,true);
  if(size===0xffffffff||offset===0xffffffff||size>8*1024*1024) return 'zip';
  const dir=await sliceBytes(file,offset,offset+size);
  const dv=new DataView(dir.buffer,dir.byteOffset,dir.byteLength);
  const names=[]; let p=0;
  while(p+46<=dir.length&&dv.getUint32(p,true)===0x02014b50){
    const n=dv.getUint16(p+28,true),e=dv.getUint16(p+30,true),c=dv.getUint16(p+32,true);
    if(p+46+n+e+c>dir.length) break;
    names.push(decoder.decode(dir.subarray(p+46,p+46+n)).replace(/\\/g,'/').toLowerCase());
    p+=46+n+e+c;
  }
  const set=new Set(names);
  if(set.has('word/document.xml')&&set.has('[content_types].xml')) return 'docx';
  if(set.has('xl/workbook.xml')&&set.has('[content_types].xml')) return 'xlsx';
  if(set.has('ppt/presentation.xml')&&set.has('[content_types].xml')) return 'pptx';
  if(set.has('content.xml')&&set.has('meta-inf/manifest.xml')) return 'odt';
  return 'zip';
}

function signatureType(bytes, ext) {
  const head=latin(bytes,0,Math.min(bytes.length,1024));
  if(/%PDF-\d\.\d/.test(head)) return ['pdf','PDF file signature'];
  if(has(bytes,[0xff,0xd8,0xff])) return ['jpeg','JPEG file signature'];
  if(has(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) return ['png','PNG file signature'];
  if(has(bytes,[0x47,0x49,0x46,0x38,0x37,0x61])||has(bytes,[0x47,0x49,0x46,0x38,0x39,0x61])) return ['gif','GIF file signature'];
  if(has(bytes,[0x42,0x4d])) return ['bmp','BMP file signature'];
  if(has(bytes,[0x49,0x49,0x2a,0,])||has(bytes,[0x4d,0x4d,0,0x2a])) return ['tiff','TIFF file signature'];
  if(bytes.length>=12&&latin(bytes,0,4)==='RIFF'&&latin(bytes,8,12)==='WEBP') return ['webp','WebP container signature'];
  if(bytes.length>=12&&latin(bytes,4,8)==='ftyp'&&/^(heic|heix|hevc|hevx|mif1|msf1|heis|hevm)$/i.test(latin(bytes,8,12))) return ['heic','HEIF/HEIC container signature'];
  if(/^\s*\{\s*\\rtf/i.test(head)) return ['rtf','RTF document signature'];
  if(ext==='doc'&&has(bytes,[0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])) return ['doc','OLE compound document signature'];
  return null;
}

function textType(bytes,ext) {
  if(!bytes.length) return null;
  if(ext==='txt' && bytes.length>=2 && ((bytes[0]===0xff&&bytes[1]===0xfe)||(bytes[0]===0xfe&&bytes[1]===0xff))) {
    let text;
    try { text=new TextDecoder(bytes[0]===0xff?'utf-16le':'utf-16be',{fatal:true}).decode(bytes.subarray(2)); } catch { return null; }
    const sample=text.trim();
    if(sample && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(sample)) return ['txt','UTF-16 text content and .txt extension'];
    return null;
  }
  if(bytes.includes(0)) return null;
  let text;
  try { text=new TextDecoder('utf-8',{fatal:true}).decode(bytes); } catch { return null; }
  const trimmed=text.replace(/^\uFEFF/,'').trimStart();
  if(/^(?:<!doctype\s+html\b|<html\b|<head\b|<body\b)/i.test(trimmed)) return ['html','HTML document content'];
  if(ext==='html'||ext==='htm') return ['html','HTML extension and text content'];
  if(ext==='txt') {
    let controls=0;
    for(const b of bytes) if(b<9||(b>13&&b<32)) controls++;
    if(controls/bytes.length<0.01) return ['txt','UTF-8 text content and .txt extension'];
  }
  return null;
}

/** Detect a browser File using content signatures/package structure before filename hints. */
export async function detectFileFormat(file) {
  if(!file||typeof file.slice!=='function'||typeof file.name!=='string') throw new TypeError('A browser File object is required.');
  const ext=extOf(file.name), hint=EXTENSIONS[ext]||null;
  const prefix=await sliceBytes(file,0,Math.min(file.size,4096));
  let match=signatureType(prefix,ext);
  if(!match&&has(prefix,[0x50,0x4b,0x03,0x04])) match=[await zipType(file),'ZIP package structure'];
  if(!match) match=textType(prefix,ext);
  const format=match?.[0]||'unknown', definition=DEFINITIONS[format];
  const mismatch=!!(definition&&ext&&!definition[2].includes(ext));
  let warning='';
  if(mismatch) warning='The content looks like '+definition[0]+', but the filename uses the .'+ext+' extension.';
  else if(!match&&hint) warning='The filename suggests '+DEFINITIONS[hint][0]+', but the file content did not match a recognized signature.';
  else if(format==='zip') warning='This ZIP archive does not match a supported Office or OpenDocument package structure.';
  const route=definition?{label:definition[5],available:definition[3],batch:definition[4],phase:definition[4]}:{label:'No conversion route available',available:false,batch:null,phase:null};
  return {
    format,label:definition?.[0]||(format==='zip'?'ZIP archive (unclassified)':'Unrecognized or unsupported file'),
    code:definition?.[1]||(format==='zip'?'ZIP':'FILE'),extension:ext,mimeType:file.type||'',size:file.size,
    confidence:match?'file content':'unverified',method:match?.[1]||'No recognized signature or supported text structure',
    extensionMismatch:mismatch,warning,route,isPdf:format==='pdf'
  };
}
export function formatFileSize(bytes) {
  if(!Number.isFinite(bytes)||bytes<0) return 'Unknown size';
  if(bytes<1024) return bytes+' B';
  const units=['KB','MB','GB','TB']; let value=bytes/1024,unit=0;
  while(value>=1024&&unit<units.length-1){value/=1024;unit++;}
  return value.toFixed(value>=10?1:2)+' '+units[unit];
}
