import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const data={window:{}};vm.runInNewContext(read('deck-data.js'),data);
const lessons={window:{}};vm.runInNewContext(read('ai-lessons.js'),lessons);
const api=lessons.window.MSVAiLessons;
const runtime=read('deck-runtime.js');
const call=runtime.slice(runtime.indexOf('    window.MSVAiLessons?.wire('),runtime.indexOf('    window.MSVLessonTools?.wireRelation('));
let count=0,pages=0;
for(const slide of data.window.MSV_MODULE_DECK.slides){
 const tags=[...slide.content.matchAll(/<button\b[^>]*data-ai-key="([^"]+)"[^>]*>/g)];if(!tags.length)continue;pages++;
 for(const match of tags){
  const key=match[1],value=match[0].match(/data-ai-value="([^"]+)"/)?.[1];assert.ok(value);
  for(const controlled of [false,true]){
   const button={dataset:{aiKey:key,aiValue:value},events:{},setAttribute(){},addEventListener(k,f){this.events[k]=f},focus(){}};
   const deck={querySelector:s=>s==='.ai-lesson'?{}:s.startsWith('[data-ai-key=')?button:null,querySelectorAll:s=>s==='[data-ai-key]'?[button]:[]};
   const before={slideId:slide.id,activity:{ai:api.normalize({}),mapFocus:'kept'}};let sent;
   vm.runInNewContext(call,{window:{MSVAiLessons:api},deck,state:before,controlled,setState:(state,notify)=>{sent={state,notify};}});
   assert.equal(button.disabled,false,`${slide.source}/${key}/${value}/controlled=${controlled}`);
   button.events.click({preventDefault(){},stopPropagation(){}});
   assert.equal(sent.notify,true,'projection clicks must publish back to teacher');
   assert.equal(sent.state.slideId,slide.id);assert.equal(sent.state.activity.mapFocus,'kept');
   assert.equal(JSON.stringify(sent.state.activity.ai),JSON.stringify(api.reduce(before.activity.ai,key,value)));
   count++;
  }
 }
}
assert.ok(pages>=10);assert.ok(count>60);
console.log(`PASS ${count} real AI button bindings across ${pages} pages, standalone + controlled projection; state published without changing slide`);
// Teacher's next-page thumbnail stays intentionally non-interactive.
assert.match(read('presenter-runtime.js'),/MSVAiLessons\?\.wire\(stage,[\s\S]*?interactive\?/);
const teacher=read('presenter-runtime.js');
const receiver=teacher.slice(teacher.indexOf('  function acceptMessage('),teacher.indexOf('  function updateConnection('));
let rendered=0,persisted=0;
const sync={session:'same',state:{},Date,lastAudienceSignal:0,normalize:x=>x,updateConnection(){},persist(){persisted++},render(){rendered++},send(){}};
vm.createContext(sync);vm.runInContext(receiver,sync);
sync.acceptMessage({session:'same',source:'audience',type:'state',state:{slideId:'ai-02',activity:{ai:{tab:1}}}});
assert.equal(sync.state.activity.ai.tab,1);assert.equal(rendered,1);assert.equal(persisted,1);
sync.acceptMessage({session:'other',source:'audience',type:'state',state:{}});assert.equal(rendered,1);
console.log('PASS teacher receives projection state and ignores other sessions');
