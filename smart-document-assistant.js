const PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
const STOP=new Set(('a an and are as at be been being by can could did do does for from had has have he her hers him his how i if in into is it its may me might more most my no not of on or our ours she should so some such than that the their theirs them then there these they this those through to too under up us was we were what when where which who why will with would you your about after before between during each few further here once only other own same very also all any both each ever every much neither nor per rather quite just still use using used based document documents page pages pdf section chapter').split(/\s+/));
export function tokenize(value){return String(value||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9][a-z0-9'-]{1,}/g)||[];}
export function splitIntoSentences(value){return String(value||'').replace(/\s+/g,' ').trim().split(/(?<=[.!?])\s+(?=[A-Z0-9“"'(])/).map(text=>text.trim()).filter(text=>text.length>=24);}
export function reconstructPageText(items){
 const positioned=(items||[]).filter(item=>typeof item.str==='string'&&item.str.trim()).map(item=>({text:item.str,x:Number(item.transform?.[4]||0),y:Number(item.transform?.[5]||0),width:Number(item.width||0),height:Math.abs(Number(item.height||item.transform?.[3]||0))}));
 if(!positioned.length)return '';positioned.sort((a,b)=>Math.abs(b.y-a.y)>2.5?b.y-a.y:a.x-b.x);const lines=[];
 for(const item of positioned){let line=lines.find(candidate=>Math.abs(candidate.y-item.y)<=Math.max(2.5,Math.min(5,item.height*.35)));if(!line){line={y:item.y,items:[]};lines.push(line);}line.items.push(item);}
 lines.sort((a,b)=>b.y-a.y);
 return lines.map(line=>{line.items.sort((a,b)=>a.x-b.x);let out='',previous=null;for(const item of line.items){if(previous){const gap=item.x-(previous.x+previous.width);if(gap>Math.max(2,previous.height*.18)&&!/\s$/.test(out)&&! /^[,.;:!?%)\]}]/.test(item.text))out+=' ';}out+=item.text;previous=item;}return out.trimEnd();}).filter(line=>line.trim()).join('\n');
}
function usefulTokens(text){return tokenize(text).filter(word=>!STOP.has(word)&&word.length>2&&!/^\d+$/.test(word));}
export function extractKeyTerms(pages,limit=10){
 const counts=new Map(),spread=new Map();for(const page of pages||[]){const seen=new Set();for(const term of usefulTokens(page.text)){counts.set(term,(counts.get(term)||0)+1);if(!seen.has(term)){spread.set(term,(spread.get(term)||0)+1);seen.add(term);}}}
 return [...counts].map(([term,count])=>({term,count,pages:spread.get(term)||0,score:count+2*(spread.get(term)||0)})).sort((a,b)=>b.score-a.score||b.count-a.count||a.term.localeCompare(b.term)).slice(0,limit);
}
export function extractiveSummary(pages,limit=6){
 const all=[];for(const page of pages||[])splitIntoSentences(page.text).forEach((text,index)=>all.push({text,page:page.page,index,terms:usefulTokens(text)}));if(!all.length)return [];
 const freq=new Map();for(const item of all)for(const term of new Set(item.terms))freq.set(term,(freq.get(term)||0)+1);
 return all.map(item=>{const weight=item.terms.reduce((sum,term)=>sum+(freq.get(term)||0),0),penalty=item.terms.length<5?.35:Math.min(1,item.terms.length/12),bonus=item.index===0?1.12:1;return {...item,score:weight*penalty*bonus};}).sort((a,b)=>b.score-a.score).slice(0,limit).sort((a,b)=>a.page-b.page||a.index-b.index).map(({text,page,score})=>({text,page,score:Number(score.toFixed(2))}));
}
export function rankQuestionEvidence(pages,question,limit=5){
 const query=usefulTokens(question);if(!query.length)return [];const unique=[...new Set(query)],phrase=String(question||'').toLowerCase().trim(),candidates=[];
 for(const page of pages||[])for(const sentence of splitIntoSentences(page.text)){const lower=sentence.toLowerCase(),terms=usefulTokens(sentence),counts=new Map();for(const term of terms)counts.set(term,(counts.get(term)||0)+1);const matched=unique.filter(term=>counts.has(term));if(!matched.length)continue;const coverage=matched.length/unique.length,frequency=matched.reduce((sum,term)=>sum+Math.min(3,counts.get(term)),0),phraseBonus=phrase.length>8&&lower.includes(phrase)?5:0,score=matched.length*4+frequency+coverage*3+phraseBonus;candidates.push({text:sentence,page:page.page,score:Number(score.toFixed(2)),coverage});}
 return candidates.sort((a,b)=>b.score-a.score||a.page-b.page).slice(0,limit);
}
export function buildStudyPrompts(terms,limit=6){return (terms||[]).slice(0,limit).map(item=>'Define '+item.term+' and explain its role in this document.');}
export function formatAssistantMarkdown(result,question=null,evidence=[]){
 const lines=['# Document analysis','','**File:** '+result.fileName,'**Pages:** '+result.pageCount,'**Pages with selectable text:** '+result.textPages,'**Pages without selectable text:** '+result.emptyPages,'','## Extractive overview',''];
 for(const item of result.summary)lines.push('- '+item.text+' *(PDF p. '+item.page+')*');lines.push('','## Key topics','',result.terms.map(item=>item.term).join(', ')||'No key terms found.','','## PDF bookmarks','');
 if(result.outline.length)for(const item of result.outline)lines.push('  '.repeat(item.depth)+'- '+item.title+(item.page?' *(PDF p. '+item.page+')':''));else lines.push('No embedded bookmarks found.');
 lines.push('','## Study prompts','',...result.prompts.map(prompt=>'- '+prompt));
 if(question){lines.push('','## Question','',question,'','## Matching source evidence','');if(evidence.length)for(const item of evidence)lines.push('> '+item.text,'> — PDF page '+item.page,'');else lines.push('No supporting passage was found in the extracted text.','');}
 lines.push('','---','Generated locally from selectable PDF text. Verify all excerpts in the original document.');return lines.join('\n');
}
let pdfjsPromise=null;
async function loadPdfJs(){if(!pdfjsPromise)pdfjsPromise=import(PDFJS).then(pdfjs=>{pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';return pdfjs;});return pdfjsPromise;}
async function readOutline(doc){
 let outline=[];try{outline=await doc.getOutline()||[];}catch{}const result=[];
 async function walk(items,depth=0){for(const item of items||[]){if(result.length>=250)return;let page=null;try{const dest=typeof item.dest==='string'?await doc.getDestination(item.dest):item.dest;if(Array.isArray(dest)&&dest[0])page=await doc.getPageIndex(dest[0])+1;}catch{}result.push({title:String(item.title||'Untitled bookmark'),page,depth});await walk(item.items,Math.min(depth+1,8));}}
 await walk(outline);return result;
}
export async function analyzePdfFile(file,onProgress=()=>{},shouldCancel=()=>false){
 if(!file||typeof file.arrayBuffer!=='function')throw new TypeError('Choose a PDF file to analyze.');const pdfjs=await loadPdfJs(),bytes=await file.arrayBuffer(),doc=await pdfjs.getDocument({data:bytes}).promise;
 try{
  const metadata=await doc.getMetadata().catch(()=>({info:{}})),outline=await readOutline(doc),pages=[];let emptyPages=0,chars=0;
  for(let pageNo=1;pageNo<=doc.numPages;pageNo++){if(shouldCancel())throw new Error('Analysis cancelled.');const page=await doc.getPage(pageNo),content=await page.getTextContent({includeMarkedContent:false}),text=reconstructPageText(content.items||[]);if(text){pages.push({page:pageNo,text});chars+=text.length;}else emptyPages++;onProgress({page:pageNo,total:doc.numPages,percent:Math.round(pageNo/doc.numPages*100)});if(chars>2000000)throw new Error('This document contains more than 2 million characters of selectable text. Split it into smaller chapter PDFs and analyze those separately.');}
  if(!pages.length){const error=new Error('No selectable text was found. This may be a scanned PDF. Run OCR & Searchable PDF, save the searchable PDF, and analyze it again.');error.code='NO_TEXT_LAYER';throw error;}
  const terms=extractKeyTerms(pages,10),summary=extractiveSummary(pages,7),prompts=buildStudyPrompts(terms,6);
  return {fileName:file.name,pageCount:doc.numPages,textPages:pages.length,emptyPages,characterCount:chars,title:String(metadata.info?.Title||''),author:String(metadata.info?.Author||''),subject:String(metadata.info?.Subject||''),outline,pages,terms,summary,prompts};
 }finally{try{await doc.destroy();}catch{}}
}
const $=id=>document.getElementById(id);let selectedFile=null,busy=false,cancelled=false,analysis=null,lastEvidence=null;
function appendText(parent,tag,text,className=''){const node=document.createElement(tag);node.textContent=String(text??'');if(className)node.className=className;parent.appendChild(node);return node;}
function status(message,error=false){const node=$('assistant-status');if(node){node.textContent=message||'';node.style.color=error?'var(--danger)':'var(--text-muted)';}}
function setBusy(value){busy=value;$('assistant-analyze').disabled=value||!selectedFile;$('assistant-cancel').disabled=!value;$('assistant-change-file').disabled=value;$('assistant-file-input').disabled=value;}
async function setFile(file){if(!file)return;if(!/\.pdf$/i.test(file.name||'')&&file.type!=='application/pdf'){status('Please choose a PDF file.',true);return;}selectedFile=file;analysis=null;lastEvidence=null;$('assistant-file-name').textContent=file.name;$('assistant-file-meta').textContent=(file.size/1048576).toFixed(2)+' MB · selected for local analysis';$('assistant-results').hidden=true;$('assistant-export').disabled=true;status('PDF selected. Select Analyze document to begin.');setBusy(false);}
window.PDFToolkitSetAssistantFile=setFile;
async function chooseFile(file){if(!file)return;try{if(window.PDFToolkitGetActiveFile?.()!==file){const loaded=await window.PDFToolkitSetActiveFile?.(file);if(!loaded)return;}await setFile(file);}catch(error){status('Unable to open PDF: '+(error?.message||error),true);}}
function renderAnalysis(result){
 $('assistant-results').hidden=false;const stats=$('assistant-stats');stats.replaceChildren();[[result.pageCount,'PDF pages'],[result.textPages,'pages with text'],[result.emptyPages,'pages without text'],[(result.characterCount/1000).toFixed(1)+'k','characters']].forEach(([value,label])=>appendText(stats,'span',String(value)+' '+label,'assistant-stat'));
 const summary=$('assistant-summary');summary.replaceChildren();for(const item of result.summary){const li=appendText(summary,'li',item.text);appendText(li,'span','PDF p. '+item.page,'assistant-citation');}
 const topics=$('assistant-topics');topics.replaceChildren();for(const item of result.terms)appendText(topics,'span',item.term,'assistant-chip');
 const outline=$('assistant-outline');outline.replaceChildren();if(result.outline.length)for(const item of result.outline){const li=appendText(outline,'li',item.title+(item.page?' — PDF p. '+item.page:' — page unavailable'));li.style.marginLeft=Math.min(item.depth,6)*12+'px';}else appendText(outline,'li','No embedded bookmarks were found in this PDF.');
 const prompts=$('assistant-prompts');prompts.replaceChildren();for(const prompt of result.prompts)appendText(prompts,'li',prompt);
 $('assistant-coverage').textContent=result.emptyPages?result.emptyPages+' page(s) had no selectable text and were excluded. If these are scans, run OCR & Searchable PDF and analyze the OCR output. Text reading order may vary in multi-column layouts, tables, and equations.':'All pages contained selectable text. Reading order may still vary in multi-column layouts, tables, and equations.';$('assistant-export').disabled=false;
}
async function runAnalysis(){if(!selectedFile||busy)return;cancelled=false;setBusy(true);analysis=null;lastEvidence=null;$('assistant-results').hidden=true;$('assistant-progress-wrap').hidden=false;$('assistant-progress-fill').style.width='0%';
 try{status('Opening PDF and reading document structure…');const result=await analyzePdfFile(selectedFile,progress=>{$('assistant-progress-fill').style.width=progress.percent+'%';status('Reading page '+progress.page+' of '+progress.total+'…');},()=>cancelled);analysis=result;renderAnalysis(result);status('Analysis ready. Found text on '+result.textPages+' of '+result.pageCount+' pages.');}catch(error){status(error?.message||'Document analysis failed.',true);}finally{$('assistant-progress-wrap').hidden=true;setBusy(false);}
}
function renderEvidence(evidence){const target=$('assistant-answer');target.replaceChildren();if(!evidence.length){appendText(target,'p','I could not find supporting passages for that question in the extracted text. Try different wording or check the original document.','assistant-muted');return;}appendText(target,'p','Found '+evidence.length+' relevant passage(s). These are source excerpts, not a generated answer.','assistant-muted');for(const item of evidence){const card=appendText(target,'article','','assistant-evidence');appendText(card,'strong','PDF page '+item.page);appendText(card,'blockquote',item.text);}}
function askQuestion(event){event.preventDefault();if(!analysis){status('Analyze a PDF before asking a question.',true);return;}const question=$('assistant-question').value.trim();if(!question)return;lastEvidence=rankQuestionEvidence(analysis.pages,question,5);renderEvidence(lastEvidence);}
function exportNotes(){if(!analysis)return;const markdown=formatAssistantMarkdown(analysis,$('assistant-question').value.trim()||null,lastEvidence||[]),blob=new Blob([markdown],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(analysis.fileName.replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'_')||'document')+'-analysis.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function init(){
 $('assistant-change-file').addEventListener('click',()=>$('assistant-file-input').click());$('assistant-file-input').addEventListener('change',event=>chooseFile(event.target.files?.[0]));$('assistant-analyze').addEventListener('click',runAnalysis);$('assistant-cancel').addEventListener('click',()=>{cancelled=true;status('Cancelling after the current page…');});$('assistant-question-form').addEventListener('submit',askQuestion);$('assistant-export').addEventListener('click',exportNotes);
 document.addEventListener('pdf-toolkit:panel-change',event=>{if(event.detail?.panelId==='assistant'&&event.detail.activeFile&&event.detail.activeFile!==selectedFile)setFile(event.detail.activeFile);});const active=window.PDFToolkitGetActiveFile?.();if(active)setFile(active);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.PDFToolkitSmartAssistant={analyzePdfFile,extractiveSummary,extractKeyTerms,rankQuestionEvidence};
