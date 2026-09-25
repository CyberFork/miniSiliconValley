import * as THREE from '../vendor/three.module.min.js';
import {WorkshopView} from '../workshop/render.mjs';
import {initPhysics,DriveWorld,SIDE_BLOCKS,normalizeThrustLevel,terrainHeight} from '../workshop/physics.mjs';
import {emptyProject,saveDefinition,placeInstance,recipe} from '../workshop/model.mjs';
import {createRouteInput,ROUTE_KEY_ACTIONS} from './controls.mjs';
import {RouteEffects,createWorldItem} from './effects.mjs';
import {ITEMS,CAPACITY,createGameState,stepGame,discardItem,itemPosition,validItemPositions,itemLabel} from './state.mjs';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const session=/^[a-zA-Z0-9_-]{1,64}$/.test(params.get('session')||'')?params.get('session'):'sample';
const key=`msv:p1-route-game:v1:${session}`,source=crypto.randomUUID(),input=createRouteInput();
let victoryAcknowledged=false,thrustLevel=3,game=createGameState(),view,effects,world,owner=false,release,channel,epoch=0,sequence=0,lastEpoch=0,lastSequence=-1,lastFrame=0,lastSend=0,lastSave=0,lastSignal=0,snapshot=null,ready=false,disposed=false;
let active=params.get('warm')!=='1',frameRequest=0;
const items=new Map();
let claiming=false,pendingAction=null,controlError=false;
function demoCar(){let p=emptyProject('route-demo');for(const behavior of ['wheel','thruster'])p=saveDefinition(p,{id:behavior,name:behavior==='wheel'?'示范轮组':'示范推进器',responsibility:'课堂演示',behavior,blocks:recipe(behavior)});for(const socket of ['wheel-fl','wheel-fr','wheel-rl','wheel-rr','engine'])p=placeInstance(p,{id:socket,definitionId:socket==='engine'?'thruster':'wheel',socket,rotation:socket==='engine'?180:0});return p;}
function validGame(g){return g&&validItemPositions(g.droppedPositions)&&Array.isArray(g.bag)&&g.bag.length<=CAPACITY&&new Set(g.bag).size===g.bag.length&&g.bag.every(id=>ITEMS.some(i=>i.id===id))&&Array.isArray(g.collected)&&g.collected.every(id=>ITEMS.some(i=>i.id===id))&&Array.isArray(g.ignored)&&g.ignored.every(id=>ITEMS.some(i=>i.id===id))&&Number.isInteger(g.stage)&&g.stage>=0&&g.stage<=5&&typeof g.won==='boolean'&&typeof g.message==='string'&&Array.isArray(g.events)&&g.events.length<=6&&g.events.every(s=>typeof s==='string');}
function validSnapshot(s){const finite=v=>v&&Object.values(v).every(Number.isFinite),pose=p=>p&&finite(p.p)&&finite(p.q);return s&&(!s.obstacles||(Array.isArray(s.obstacles)&&s.obstacles.length===SIDE_BLOCKS.length&&new Set(s.obstacles.map(g=>g.id)).size===SIDE_BLOCKS.length&&s.obstacles.every(g=>SIDE_BLOCKS.some(b=>b.id===g.id)&&pose(g)&&(!g.v||finite(g.v))&&(!g.a||finite(g.a)))))&&pose(s.chassis)&&Array.isArray(s.wheels)&&s.wheels.length===4&&s.wheels.every(w=>pose(w)&&typeof w.id==='string')&&(!s.glass||(Array.isArray(s.glass)&&s.glass.length===20&&new Set(s.glass.map(g=>g.id)).size===20&&s.glass.every(g=>/^glass-[0-3]-[0-4]$/.test(g.id)&&pose(g)&&(!g.v||finite(g.v))&&(!g.a||finite(g.a)))));}
function save(){try{localStorage.setItem(key,JSON.stringify({game,snapshot}));}catch{$('connection').textContent='试玩中 · 本机保存不可用';}}
try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(validGame(saved?.game))game=saved.game;if(validSnapshot(saved?.snapshot)){snapshot=saved.snapshot;thrustLevel=normalizeThrustLevel(snapshot.thrustLevel);}}catch{/* malformed local game cannot overwrite workshop or classroom data */}
function send(packet){if(channel)channel.postMessage({...packet,source});}
function publish(){if(owner)send({type:'state',epoch,sequence:++sequence,game,snapshot});}
function syncInput(){const controls=input.read();document.querySelectorAll('[data-action]').forEach(b=>b.classList.toggle('pressed',b.dataset.action==='left'?controls.steer>0:b.dataset.action==='right'?controls.steer<0:controls[b.dataset.action]));}
function stop(){input.clear();syncInput();world?.pause();if(snapshot)snapshot={...snapshot,thrust:false};effects?.update(snapshot);if(owner)publish();}
function renderPower(){ $('thrust-level').value=thrustLevel;$('thrust-output').textContent=thrustLevel+' 档';$('thrust-level').disabled=!ready;}
function renderVictory(){
 if(!game.won){victoryAcknowledged=false;if($('victory').open)$('victory').close();}else if(active&&!victoryAcknowledged&&!$('victory').open){stop();$('victory').showModal();}$('victory-restart').disabled=!ready;
}
function renderGame(){renderPower();renderVictory();
 $('capacity').textContent=`${game.bag.length} / ${CAPACITY}`;$('status').textContent=game.message;
 $('bag').replaceChildren();for(let index=0;index<CAPACITY;index++){
  const id=game.bag[index],slot=document.createElement('div');slot.className='slot'+(id?'':' empty');slot.textContent=id?itemLabel(id):'空格';
  if(id){const button=document.createElement('button');button.textContent='丢下';button.disabled=!ready||game.won;button.addEventListener('click',()=>withControl(()=>{const p=snapshot?.chassis?.p;game=discardItem(game,id,p?{x:p.x,y:terrainHeight(p.x)+.35,z:p.z}:null);renderGame();save();publish();}));slot.append(button);}$('bag').append(slot);
 }
 $('events').replaceChildren();for(const event of game.events){const li=document.createElement('li');li.textContent=event;$('events').append(li);}
 [...$('route').children].forEach((node,index)=>node.classList.toggle('active',index===game.stage));
 document.querySelectorAll('[data-action],#reset-car,#reset-game').forEach(b=>b.disabled=!ready);
 for(const item of ITEMS){const obj=items.get(item.id);if(obj){obj.mesh.position.copy(itemPosition(game,item.id));obj.mesh.visible=!game.collected.includes(item.id);obj.label.hidden=!obj.mesh.visible;}}
}
function restoreWorld(){world?.dispose();world=new DriveWorld(demoCar(),{differential:true,glassFinish:true});if(snapshot){world.body.setTranslation(snapshot.chassis.p,true);world.body.setRotation(snapshot.chassis.q,true);for(const wheel of world.wheels){const pose=snapshot.wheels.find(w=>w.id===wheel.id);if(pose){wheel.body.setTranslation(pose.p,true);wheel.body.setRotation(pose.q,true);}}}if(snapshot?.obstacleLayout===2&&snapshot?.obstacles)for(const piece of world.obstacles){const saved=snapshot.obstacles.find(g=>g.id===piece.id);if(saved){piece.body.setTranslation(saved.p,true);piece.body.setRotation(saved.q,true);if(saved.v)piece.body.setLinvel(saved.v,true);if(saved.a)piece.body.setAngvel(saved.a,true);}}if(snapshot?.glass)for(const piece of world.glass){const saved=snapshot.glass.find(g=>g.id===piece.id);if(saved){piece.body.setTranslation(saved.p,true);piece.body.setRotation(saved.q,true);if(saved.v)piece.body.setLinvel(saved.v,true);if(saved.a)piece.body.setAngvel(saved.a,true);}}world.thrustLevel=thrustLevel;snapshot=world.snapshot();view.pose(snapshot);effects?.update(snapshot);}
function withControl(action){if(!ready||!active)return;if(owner){action();return;}pendingAction=action;claim(true);}
function relinquish(){
 if(!owner)return;stop();save();owner=false;world?.dispose();world=null;release?.();release=null;
 $('connection').textContent='同步观看 · 操作已交给另一窗口';renderGame();
}
async function claim(takeover=false){
 if(!ready||!active||owner||claiming)return;
 if(!navigator.locks||!channel){$('connection').textContent='双屏同步不可用，请用新版浏览器重新打开';return;}
 claiming=true;controlError=false;const abort=new AbortController();let timer;
 if(takeover){$('connection').textContent='正在接管此窗口…';send({type:'takeover'});timer=setTimeout(()=>abort.abort(),8000);}
 navigator.locks.request(key+':owner',takeover?{signal:abort.signal}:{ifAvailable:true},async lock=>{
  claiming=false;clearTimeout(timer);
  if(!lock){$('connection').textContent='同步观看 · 点击接管或驾驶按钮即可操作';send({type:'hello'});return;}
  if(disposed||!active)return;
  // The former owner saves before releasing the lock. Read that final snapshot,
  // not a potentially delayed BroadcastChannel packet, before becoming owner.
  try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(validGame(saved?.game)&&validSnapshot(saved?.snapshot)){game=saved.game;snapshot=saved.snapshot;thrustLevel=normalizeThrustLevel(snapshot.thrustLevel);}}catch{}
  owner=true;epoch=Math.max(Date.now(),lastEpoch+1);sequence=0;restoreWorld();
  $('connection').textContent='当前试玩窗口 · 其他窗口同步观看';renderGame();publish();
  const action=pendingAction;pendingAction=null;action?.();
  await new Promise(resolve=>release=resolve);
 }).catch(()=>{claiming=false;controlError=true;clearTimeout(timer);pendingAction=null;input.clear();syncInput();$('connection').textContent='接管未完成，请在原试玩窗口刷新后再点接管';});
}
try{channel=new BroadcastChannel(key);channel.onmessage=({data})=>{
 if(!data||data.source===source)return;
 if(data.type==='hello'){publish();return;}
 if(data.type==='takeover'){if(owner)relinquish();return;}
 if(owner||data.type!=='state'||!validGame(data.game)||!validSnapshot(data.snapshot)||!Number.isSafeInteger(data.epoch)||!Number.isSafeInteger(data.sequence))return;
 if(data.epoch<lastEpoch||(data.epoch===lastEpoch&&data.sequence<=lastSequence))return;
 lastEpoch=data.epoch;lastSequence=data.sequence;lastSignal=performance.now();const changed=JSON.stringify(game)!==JSON.stringify(data.game);game=data.game;snapshot=data.snapshot;thrustLevel=normalizeThrustLevel(snapshot.thrustLevel);renderPower();view?.pose(snapshot);if(active&&changed)renderGame();$('connection').textContent='同步观看 · 不运行第二份游戏';
};}catch{/* explicit feedback, not a silent second simulation */}
const keyActions={...ROUTE_KEY_ACTIONS,' ':'thrust'};
addEventListener('keydown',event=>{
 if(event.target.closest('input,textarea,select,[contenteditable=true]')||event.metaKey||event.ctrlKey||event.altKey)return;
 if(keyActions[event.key]){event.preventDefault();event.stopPropagation();if(ready&&active&&!$('victory').open){if(!owner)claim(true);input.press('key:'+event.key,keyActions[event.key]);syncInput();}}
});
addEventListener('keyup',event=>{if(keyActions[event.key]){event.preventDefault();event.stopPropagation();input.release('key:'+event.key);syncInput();}});
for(const button of document.querySelectorAll('[data-action]')){
 const id='pointer:'+button.dataset.action;
 button.addEventListener('pointerdown',event=>{if(!ready||!active||$('victory').open)return;if(!owner)claim(true);event.preventDefault();button.setPointerCapture(event.pointerId);input.press(id,button.dataset.action);syncInput();});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{input.release(id);syncInput();});
 button.addEventListener('keydown',event=>{if(event.key==='Enter'&&ready&&active&&!$('victory').open){event.preventDefault();if(!owner)claim(true);input.press('button:'+id,button.dataset.action);syncInput();}});
 button.addEventListener('keyup',event=>{if(event.key==='Enter'){input.release('button:'+id);syncInput();}});
}
$('reset-car').onclick=()=>withControl(()=>{stop();snapshot=null;restoreWorld();view.home();publish();save();});
$('reset-game').onclick=()=>withControl(()=>{stop();game=createGameState();snapshot=null;restoreWorld();view.home();renderGame();publish();save();});
function dismissVictory(){victoryAcknowledged=true;$('victory').close();$('canvas').focus();}
$('victory-continue').onclick=()=>withControl(dismissVictory);
$('victory').addEventListener('cancel',event=>{event.preventDefault();dismissVictory();});
$('victory-restart').onclick=()=>$('reset-game').click();
$('fullscreen').onclick=async()=>{try{const target=window.frameElement||document.documentElement;const doc=target.ownerDocument;if(doc.fullscreenElement)await doc.exitFullscreen();else await target.requestFullscreen();}catch{$('connection').textContent='浏览器未允许全屏，可放大教师预览区域';}};
$('claim').onclick=()=>claim(true);
$('thrust-level').onpointerup=()=>{$('canvas').focus();};
$('thrust-level').oninput=()=>{const level=normalizeThrustLevel($('thrust-level').value);withControl(()=>{thrustLevel=level;if(snapshot)snapshot={...snapshot,thrustLevel};renderPower();save();publish();});};
addEventListener('blur',stop);document.addEventListener('visibilitychange',()=>{stop();lastFrame=performance.now();if(owner){save();if(document.hidden)relinquish();}});
addEventListener('pagehide',()=>{disposed=true;stop();if(owner)save();release?.();channel?.close();world?.dispose();});
function addWorldItems(){
 for(const item of ITEMS){const mesh=createWorldItem(item);mesh.position.set(item.position.x,item.position.y,item.position.z);view.land.add(mesh);const label=document.createElement('span');label.className='item-label';label.textContent=item.name;$('canvas').append(label);items.set(item.id,{mesh,label});}
 const bag=new THREE.Mesh(new THREE.BoxGeometry(.5,.55,.55),new THREE.MeshStandardMaterial({color:0x2c947b}));bag.position.set(.8,.47,0);view.chassis.add(bag);
}
function frame(now){
 if(disposed||!active)return;const delta=lastFrame?(now-lastFrame)/1000:0;lastFrame=now;
 if(owner&&world&&!document.hidden&&!snapshot?.outOfBounds&&!$('victory').open){const controls=input.read();snapshot=world.advance(delta,{...controls,thrustLevel});const next=stepGame(game,snapshot.chassis.p);if(JSON.stringify(next)!==JSON.stringify(game)){game=next;renderGame();save();}view.pose(snapshot);if(now-lastSend>50){publish();lastSend=now;}if(now-lastSave>1000){save();lastSave=now;}if(snapshot.outOfBounds){stop();$('status').textContent='小车离开路线了。点击“小车回起点”；背包保留。';}}
 if(view){effects?.update(snapshot);view.render();const rect=$('canvas').getBoundingClientRect();for(const {mesh,label} of items.values()){if(!mesh.visible)continue;const point=mesh.position.clone();point.y+=.72;const screen=point.project(view.camera);label.hidden=screen.z< -1||screen.z>1||Math.abs(screen.x)>1||Math.abs(screen.y)>1;label.style.left=(screen.x+1)*rect.width/2+'px';label.style.top=(1-screen.y)*rect.height/2+'px';}}
 if(owner&&now-lastSend>500){publish();lastSend=now;}
 if(!owner&&!claiming&&!controlError&&now-lastSignal>4000)$('connection').textContent='可在此试玩 · 点击驾驶按钮或接管试玩';frameRequest=requestAnimationFrame(frame);
}
function setActive(value){
 const next=value===true;if(next===active)return;active=next;
 if(!active){cancelAnimationFrame(frameRequest);frameRequest=0;stop();relinquish();if($('victory').open)$('victory').close();return;}
 if(ready){lastFrame=0;renderGame();send({type:'hello'});if(params.get('role')!=='audience')claim();frameRequest=requestAnimationFrame(frame);}
}
addEventListener('msv-workshop-render-failed',()=>{setActive(false);ready=false;window.MSVRouteLoading?.fail('三维显示已中断，请重试加载；存档仍保留。');});
addEventListener('message',event=>{if(event.origin===location.origin&&event.source===parent&&event.data?.type==='msv-route-active')setActive(event.data.active);});
async function boot(){try{
 window.MSVRouteLoading?.set(1,'资源已加载，初始化物理引擎');await initPhysics();
 window.MSVRouteLoading?.set(2,'物理引擎已就绪，创建小车和地图');
 view=new WorkshopView($('canvas'),()=>{},undefined,{hideCrashWall:true});view.setEditable(false);view.setProject(demoCar(),'drive');effects=new RouteEffects(view);view.follow=true;view.home();addWorldItems();if(snapshot)view.pose(snapshot);
 view.render();ready=true;renderGame();send({type:'hello'});
 if(active){if(params.get('role')!=='audience')claim();frameRequest=requestAnimationFrame(frame);}
 window.MSVRouteLoading?.done();
 }catch(error){console.warn('玩家路线演示未能启动',error);$('fallback').hidden=false;$('connection').textContent='演示未启动，不会自动推进课堂';window.MSVRouteLoading?.fail('三维场景未能启动，请点击重试。');}}
renderGame();boot();
window.MSVRouteGame=Object.freeze({inspect:()=>({session,owner,active,ready,game:structuredClone(game),snapshot:structuredClone(snapshot),controls:input.read()})});
