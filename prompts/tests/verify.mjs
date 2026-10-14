import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {buildPromptCenter,studentWorkbookSource} from '../build.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
// Frozen course source remains unchanged; public composition now has a separate source.
assert.equal(sha(await readFile(join(studentWorkbookSource,'student-prompt.txt'))),'0115cb417d432841867da325d8c822b461b14ad02030f48cb4d45abbdc8037bc');
const dir=await mkdtemp(join(tmpdir(),'prompt-composer-'));
try{
 const manifest=await buildPromptCenter(dir);
 for(const [name,hash] of Object.entries(manifest.files))assert.equal(sha(await readFile(join(dir,name))),hash);
 const html=await readFile(join(dir,'index.html'),'utf8');
 assert.equal((html.match(/<button\b/g)||[]).length,3);
 assert.match(html,/id="copy"/);assert.match(html,/id="copy-terminal"/);assert.match(html,/id="download"/);
 assert.match(html,/id="use-game"[^>]+checked/);assert.doesNotMatch(html,/id="use-paths"[^>]+checked/);
 assert.match(html,/立棍底座 · 主棍＋子棍/);assert.doesNotMatch(html,/id="use-base"/);
 const script=await readFile(join(dir,'workbook.js'),'utf8');
 assert.doesNotMatch(script,/fetch\(|XMLHttpRequest|localStorage|sessionStorage|innerHTML|outerHTML/);
 const compose=await readFile(join(dir,'compose.js'),'utf8'),data=await readFile(join(dir,'student-prompt.js'),'utf8');
 function harness(search='',pathname='/prompts/'){
  class El{value='';textContent='';open=false;disabled=true;checked=false;focused=false;selected=false;events={};addEventListener(n,f){this.events[n]=f;}focus(){this.focused=true;}select(){this.selected=true;}setSelectionRange(){this.selected=true;}}
  const nodes=Object.fromEntries(['planning','preview','copy','copy-terminal','download','status','preview-panel','use-game','use-paths','selection-summary','outcome-title'].map(id=>[id,new El()]));
  const state={copied:'',copyCount:0,denied:false,href:'',beforeUnload:null,download:null,urls:[],revoked:[]};
  class BlobMock{constructor(parts,opts={}){this.parts=parts;this.type=opts.type||'';}}
  const document={getElementById:id=>nodes[id],createElement:tag=>({href:'',download:'',click(){state.download=this;},remove(){this.removed=true;}}),body:{appendChild(){},removeChild(){}}};
  const URLMock={createObjectURL:blob=>{assert(blob instanceof BlobMock);const url='blob:test-'+state.urls.length;state.urls.push({url,blob});return url;},revokeObjectURL:url=>state.revoked.push(url)};
  const ctx={window:{location:{search,pathname},history:{replaceState:(_a,_b,url)=>state.href=url}},URLSearchParams,Blob:BlobMock,URL:URLMock,document,navigator:{clipboard:{writeText:async text=>{state.copyCount++;if(state.denied)throw Error('denied');state.copied=text;}}},setTimeout:(fn)=>fn(),addEventListener:(n,f)=>{if(n==='beforeunload')state.beforeUnload=f;}};
  vm.runInNewContext(compose,ctx);vm.runInNewContext(data,ctx);vm.runInNewContext(script,ctx);
  return {nodes,state,ctx};
 }
 const {nodes:n,state:s,ctx}=harness();
 assert(n['use-game'].checked&&!n['use-paths'].checked&&!n.copy.disabled);
 n.planning.value='<img src=x onerror=alert(1)> 活动策划';n.planning.events.input();
 for(const game of [true,false])for(const paths of [false,true]){
  n['use-game'].checked=game;n['use-paths'].checked=paths;n['use-game'].events.change();
  assert.equal(n.planning.value,'<img src=x onerror=alert(1)> 活动策划');
  const before=s.copyCount;
  await n.copy.events.click();assert.equal(s.copied,n.preview.value);assert.equal(s.copyCount,before+1);
  const normal=s.copied;
  await n['copy-terminal'].events.click();assert.equal(s.copyCount,before+2);
  assert.equal(JSON.parse(s.copied.slice(s.copied.indexOf('完整提示词：')+6)),normal);
  assert(!/[\r\n\u2028\u2029]/.test(s.copied));
  await n.copy.events.click();
  assert.equal(s.copied.includes('【游戏领域补充】'),game);assert.equal(s.copied.includes('【可选增强：先对齐路径，再归纳模块】'),paths);
  assert(s.copied.includes('主棍：已明确 n/6 项'));assert(!s.href.includes('策划'));
 }
 const terminalSource='CRLF\r\nCR\rESC\u001b TAB\t DEL\u007f C1\u0085 U+2028\u2028 U+2029\u2029\n```js\nconst s="hi";\n```';
 n.planning.value=terminalSource;n.planning.events.input();
 const original=n.preview.value;assert(!original.includes('\r'));assert(!original.endsWith('\n'));
 await n['copy-terminal'].events.click();
 assert.equal(JSON.parse(s.copied.slice(s.copied.indexOf('完整提示词：')+6)),original);
 assert(!/[\r\n\u0000-\u001f\u007f\u2028\u2029]/.test(s.copied));
 s.denied=true;await n['copy-terminal'].events.click();assert(n['preview-panel'].open&&n.preview.selected&&n.preview.focused&&!/[\r\n]/.test(n.preview.value));
 s.denied=false;await n.copy.events.click();assert.equal(n.preview.value,original);assert.equal(s.copied,original);
 n.planning.value='下载测试';n.planning.events.input();await n.download.events.click();assert.equal(s.download.download,'ligun-prompt.txt');assert.equal(s.download.href,s.urls.at(-1).url);assert.equal(s.urls.at(-1).blob.type,'text/plain;charset=utf-8');assert.deepEqual(s.revoked,[s.download.href]);assert.equal(s.urls.at(-1).blob.parts.join(''),n.preview.value);assert(n.preview.value.endsWith('下载测试'));
 s.denied=true;await n.copy.events.click();assert(n.preview.selected&&n.preview.value===s.urls.at(-1).blob.parts.join(''));
 let stopped=false;s.beforeUnload({preventDefault(){stopped=true;}});assert(stopped);
 assert(!harness('?game=0&paths=1').nodes['use-game'].checked);assert(harness('?game=0&paths=1').nodes['use-paths'].checked);
 assert(!harness('','/prompts/general/').nodes['use-game'].checked);
 assert(harness('?game=bad&paths=bad').nodes['use-game'].checked);
 delete ctx.window.MSV_PROMPT_MODULES;vm.runInNewContext(script,ctx);assert(n.copy.disabled&&n['copy-terminal'].disabled&&n.download.disabled);assert.equal(n.preview.value,'');assert(n.planning.value);
 console.log('PASS unified composer UI: defaults, four combinations, input preservation, copy/fallback, preset URLs, missing data, no upload/storage');
}finally{await rm(dir,{recursive:true,force:true});}
