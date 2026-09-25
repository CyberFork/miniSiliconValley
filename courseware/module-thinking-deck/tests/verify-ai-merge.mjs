import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);const read=f=>fs.readFileSync(new URL(f,root),'utf8');
const box={window:{}};for(const f of ['deck-data.js','presenter-notes.js'])vm.runInNewContext(read(f),box);
const d=box.window.MSV_MODULE_DECK,notes=box.window.MSV_MODULE_PRESENTER_NOTES;
assert.equal(d.slides.length,41);assert.equal(d.slides.slice(0,25).reduce((n,s)=>n+s.minutes,0),120);assert.equal(d.slides.slice(25).reduce((n,s)=>n+s.minutes,0),120);
assert.equal(d.teachingStages.length,2);assert.equal(Object.keys(notes).length,41);
for(const s of d.slides){assert.equal(parseInt(notes[s.id].minutes),s.minutes);assert.ok(notes[s.id].script.length>=3);}
const ai=d.slides.slice(25,39);assert.equal(ai.length,14);assert.equal(ai.at(-1).id,'ai-14');
assert.doesNotMatch(JSON.stringify(ai)+JSON.stringify(Object.fromEntries(Object.entries(notes).filter(([k])=>k.startsWith('ai-')))),/校园寻宝|预约系统|微棍/);
const catalog=JSON.parse(fs.readFileSync(new URL('../../app/lib/courseware-text-catalog.json',root),'utf8'));
const old=catalog.find(x=>x.version==='2026.09.23-p1-r19'),now=catalog.find(x=>x.version===d.version);
const changedBaseline=new Set([
  'module-s12:subtitle','module-s12:text.f0002','module-s12:text.f0004','module-s12:text.f0005','module-s12:text.f0006','module-s12:text.f0045',
  'module-my-map:subtitle','module-my-map:text.f0001','module-my-map:text.f0002','module-my-map:text.f0004'
]);
for(const [k,v] of Object.entries(old.fields))if(!changedBaseline.has(k))assert.equal(now.fields[k],v,'preserved '+k);
assert.equal(old.slideIds.length,24);assert.equal(now.slideIds.length,41);
assert.ok(ai.filter(s=>s.content.includes('data-ai-key')).length>=10);
assert.match(ai.find(s=>s.id==='ai-12').content,/data-car-game/);
for(const s of ['ai-05'])assert.equal((ai.find(x=>x.id===s).content.match(/data-ai-key="field"/g)||[]).length,6);
assert.ok(!d.slides.some(s=>s.id==='ai-04'));
assert.equal(d.slideAliases['ai-04'],'ai-05');
assert.deepEqual(Array.from(ai,s=>s.source),Array.from({length:14},(_,i)=>`AI-${String(i+1).padStart(2,'0')}`));
assert.equal(ai.find(s=>s.id==='ai-05').minutes,13);
assert.equal((ai.find(s=>s.id==='ai-05').content.match(/白话解释/g)||[]).length,6);
assert.equal((ai.find(s=>s.id==='ai-05').content.match(/小车主棍这样写/g)||[]).length,6);
assert.match(notes['ai-05'].script.join(' '),/4分钟/);
assert.doesNotMatch(JSON.stringify(notes),/\/13 页/);
const derive=ai.find(s=>s.id==='ai-07');
assert.equal((derive.content.match(/data-ai-key="derive"/g)||[]).length,3);
assert.doesNotMatch(derive.content,/data-ai-key="field"/);
assert.match(derive.content,/人写主棍 · 整款游戏/);assert.match(derive.content,/AI 写子棍 · 只管背包/);
assert.match(derive.content,/继承：规则不能改/);assert.match(derive.content,/细化：补上怎么做/);assert.match(derive.content,/边界：别替别人做/);
const r20=catalog.find(x=>x.version==='2026.09.23-p1-r20');
for(const [k,v] of Object.entries(r20.fields))if(!k.startsWith('ai-04:')&&!['ai-05:title','ai-05:subtitle','ai-07:title','ai-07:subtitle'].includes(k)&&!changedBaseline.has(k))assert.equal(now.fields[k],v,'r20 text preserved '+k);
globalThis.window={};await import(new URL('ai-lessons.js',root));const {normalize,reduce,bagResult,wire}=window.MSVAiLessons;
assert.equal(normalize({field:99}).field,0);assert.equal(normalize({derive:99}).derive,0);assert.equal(reduce({},'derive','2').derive,2);assert.equal(normalize({answers:['yes','later','first','later','first']}).answers.length,3);
let s=reduce({},'change','approve');assert.equal(s.change,'original');assert.equal(s.changeWarning,true);
s=reduce(s,'change','propose');assert.equal(s.change,'proposed');s=reduce(s,'change','approve');assert.equal(s.change,'proposed');assert.equal(s.changeWarning,true);
s=reduce(s,'change','sync');assert.equal(s.change,'synced');s=reduce(s,'change','approve');assert.equal(s.change,'approved');
s=reduce({},'answer','later');s=reduce(s,'answer','first');s=reduce(s,'answer','first');s=reduce(s,'answer','first');assert.deepEqual(s.answers,['later','first','first']);
assert.deepEqual(reduce(s,'dialogReset','yes').answers,[]);
for(const [bagCase,expected] of [[0,['key']],[1,['key']],[2,['coin','tool']]]){
 const result=await bagResult(reduce(normalize({bagCase}),'bag','collect'));assert.deepEqual(result.bag,expected);
}
s=normalize({bagCase:2});s=reduce(s,'bag','collect');s=reduce(s,'bag','discard');s=reduce(s,'bag','collect');assert.deepEqual((await bagResult(s)).bag,['coin','key']);
assert.deepEqual(reduce(s,'bagCase','0').bagSteps,[]);
// Run actual DOM event wiring using a minimal controlled fixture.
const button={dataset:{aiKey:'field',aiValue:'2'},events:{},setAttribute(k,v){this[k]=v},addEventListener(k,f){this.events[k]=f}};
const panel={dataset:{aiPanel:'field',aiIs:'2'}};
const fake={querySelector:s=>s==='.ai-lesson'?{}:null,querySelectorAll:s=>s==='[data-ai-key]'?[button]:s==='[data-ai-panel]'?[panel]:[]};
let emitted;wire(fake,normalize({field:2}),v=>emitted=v);assert.equal(panel.hidden,false);assert.equal(button['aria-pressed'],'true');button.events.click({preventDefault(){},stopPropagation(){}});assert.equal(emitted.field,2);
wire(fake,{},null);assert.equal(button.disabled,true);assert.equal(panel.hidden,true);
for(const surface of ['deck-runtime.js','presenter-runtime.js']){assert.match(read(surface),/MSVAiLessons\?\.normalize/);assert.match(read(surface),/MSVAiLessons\?\.wire/);assert.match(read(surface),/activity:\{\.\.\.state.activity,ai\}/);}
for(const file of ['presenter-runtime.js','deck-runtime.js']){
 const source=read(file),begin=source.indexOf('  function isRecap('),end=source.indexOf('\n  function ',source.indexOf('  function normalize(')+5);
 const box={window:{},model:d,Date,state:null,maxReveal:index=>(d.slides[index].content.match(/data-reveal/g)||[]).length};
 vm.createContext(box);vm.runInContext(source.slice(begin,end),box);
 assert.equal(box.normalize({slideId:'ai-04'}).slideId,'ai-05','merged deep-link alias');
 assert.equal(box.normalize({slideId:'ai-07'}).slideId,'ai-07','existing deep links stay stable');
}
for(const f of ['index.html','presenter.html'])assert.match(read(f),/ai-lessons\.js/);
button.dataset={aiKey:'derive',aiValue:'1'};panel.dataset={aiPanel:'derive',aiIs:'1'};
wire(fake,{derive:1},v=>emitted=v);assert.equal(panel.hidden,false);button.events.click({preventDefault(){},stopPropagation(){}});assert.equal(emitted.derive,1);
wire(fake,{derive:0},null);assert.equal(panel.hidden,true);assert.equal(button.disabled,true);
console.log('AI merge PASS: 39 teaching + 2 reference pages, 120+120, 429 old fields preserved, 14 concrete slides, real bag rules, authority gates, reducer and DOM wiring, both screen adapters');
const runtimeCatalog=JSON.parse(fs.readFileSync(new URL('../shared/runtime-text-catalog.json',root),'utf8'))[0];
const status={dataset:{},textContent:''};
const statusRoot={querySelector:selector=>selector==='.ai-lesson'?{}:selector==='[data-ai-change-status]'?status:null,querySelectorAll:()=>[]};
for(const state of ['original','proposed','synced','approved','warning']){
 wire(statusRoot,{change:state==='warning'?'original':state,changeWarning:state==='warning'},null);
 const key='ai-09:'+status.dataset.msvRuntimeField;
 assert.equal(status.textContent,runtimeCatalog.fields[key]);
 assert.equal(status.dataset.msvRuntimeField,'runtime.change.'+state);
}
assert.equal(window.MSVAiLessons.changeCopy.approved,'人类已验收：相关子棍引用最新三格背包版本，继续执行开发任务。');
assert.doesNotMatch(window.MSVAiLessons.changeCopy.approved,/原小车|v2/);
console.log('AI-08 editable status: all five states match server catalog, requested copy exact PASS');
