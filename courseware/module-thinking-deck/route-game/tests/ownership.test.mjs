import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
const logic=source.slice(source.indexOf('function withControl('),source.indexOf('try{channel=new BroadcastChannel'));
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function harness(){
 let holder=null;const queue=[],saved=new Map(),contexts=[];
 const drain=()=>{if(holder||!queue.length)return;const request=queue.shift();if(request.signal?.aborted){request.reject(Error('aborted'));drain();return;}holder=request;Promise.resolve(request.callback({name:'game'})).then(()=>{holder=null;request.resolve();drain();});};
 const locks={request(name,options,callback){if(options.ifAvailable&&holder)return Promise.resolve(callback(null));return new Promise((resolve,reject)=>{const request={callback,resolve,reject,signal:options.signal};queue.push(request);options.signal?.addEventListener('abort',()=>{const i=queue.indexOf(request);if(i>=0){queue.splice(i,1);reject(Error('aborted'));}});drain();});}};
 function make(){const ui={connection:{textContent:''}},context={ready:true,active:true,owner:false,claiming:false,pendingAction:null,disposed:false,release:null,channel:{},navigator:{locks},key:'same-game',epoch:0,lastEpoch:0,sequence:0,thrustLevel:3,game:{won:true,bag:['key']},snapshot:{position:9,thrustLevel:3},world:null,restores:0,actions:0,renderCount:0,stops:0,AbortController,setTimeout,clearTimeout,Date,JSON,normalizeThrustLevel:x=>x,validGame:g=>g?.bag,validSnapshot:s=>s?.position!==undefined,$:id=>ui[id],localStorage:{getItem:k=>saved.get(k)},input:{clear(){}},syncInput(){},restoreWorld(){context.restores++;context.world={dispose(){}};},renderGame(){context.renderCount++;},publish(){},save(){saved.set('same-game',JSON.stringify({game:context.game,snapshot:context.snapshot}));},stop(){context.stops++;},send(packet){if(packet.type==='takeover')queueMicrotask(()=>contexts.forEach(other=>{if(other!==context&&other.owner)other.relinquish();}));}};vm.createContext(context);vm.runInContext(logic,context);contexts.push(context);return context;}
 return {make,holder:()=>holder};
}
test('projection takes control from active teacher under one lock and restarts saved winning game',async()=>{
 const h=harness(),teacher=h.make(),screen=h.make();await teacher.claim();await flush();assert.equal(teacher.owner,true);
 teacher.snapshot={position:12,thrustLevel:5};teacher.game={won:true,bag:['key']};screen.withControl(()=>{assert.equal(screen.snapshot.position,12,'read final saved handoff snapshot');screen.game={won:false,bag:[]};screen.actions++;});await flush();
 assert.equal(teacher.owner,false);assert.equal(screen.owner,true);assert.equal(teacher.world,null);assert.equal(screen.actions,1);assert.equal(screen.game.won,false);assert.equal(screen.thrustLevel,5);assert.ok(h.holder());
 teacher.withControl(()=>teacher.actions++);await flush();assert.equal(screen.owner,false);assert.equal(teacher.owner,true);assert.equal(teacher.actions,1);teacher.relinquish();await flush();assert.equal(h.holder(),null);
});
test('projection acquires a missing owner and restart action runs once',async()=>{
 const h=harness(),screen=h.make();screen.withControl(()=>screen.actions++);await flush();assert.equal(screen.owner,true);assert.equal(screen.actions,1);await screen.claim(true);assert.equal(screen.restores,1);screen.relinquish();await flush();
});
test('automatic teacher boot never steals an existing projection owner',async()=>{
 const h=harness(),screen=h.make(),teacher=h.make();await screen.claim();await flush();await teacher.claim();await flush();assert.equal(screen.owner,true);assert.equal(teacher.owner,false);assert.equal(teacher.restores,0);screen.relinquish();await flush();
});
test('ready projection controls and restart are enabled, explicit actions acquire ownership',()=>{
 assert.match(source,/\$\('reset-game'\)\.onclick=\(\)=>withControl/);
 assert.match(source,/\$\('victory-restart'\)\.onclick=\(\)=>\$\('reset-game'\)\.click\(\)/);
 assert.match(source,/if\(!owner\)claim\(true\)/);
 const frame=source.slice(source.indexOf('function frame(now)'));
 assert.match(frame,/if\(owner&&now-lastSend>500\)\{publish\(\);lastSend=now;\}/,'heartbeat outside physics/victory guard');
});
