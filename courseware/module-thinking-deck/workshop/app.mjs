import {WorkshopGame} from './gameplay.mjs?v=mc-fa48bdc938a3';
import {createDriveInput} from './drive-input.mjs?v=mc-fa48bdc938a3';
import {emptyProject,validateProject,parseProject,saveDefinition,placeOnChassis,moveOnChassis,placeInstance,rotateInstance,removeInstance,assemblyIssues,createHistory} from './model.mjs?v=mc-fa48bdc938a3';
const driveInput=createDriveInput();
const $=id=>document.getElementById(id),teacher=document.body.dataset.role==='teacher',params=new URLSearchParams(location.search);
const clean=(v,fallback)=>/^[a-zA-Z0-9_-]{1,64}$/.test(v||'')?v:fallback;
const session=clean(params.get('session'),'sample'),workspace=clean(params.get('workspace'),session),key=`msv:module-thinking-p1:mc-workshop-1:${session}:${workspace}`,source=crypto.randomUUID();
let game;
let project=emptyProject(workspace),mode='build',view,DriveWorld,physics,owner=false,releaseLock,epoch=0,sequence=0,lastSequence=-1,lastEpoch=0,selected=new Set(),snapshot=null,lastSnapshotAt=0,selectedInstance='',movingInstance=false,canRender=false,forward=false,reverse=false,thrustLevel=3,thrust=false,brake=false,steer=0,holding=false,storageProblem=false,importBackup=null;
function feedback(message,error=false){$('feedback').textContent=message;$('feedback').classList.toggle('error',error);}
try{const saved=localStorage.getItem(key);if(saved)project=parseProject(saved,workspace);}catch{storageProblem=true;feedback('保存内容无法读取。当前使用空工作台；原数据未覆盖。可先导出当前作品。',true);}
const history=createHistory(project);let channel;try{channel=new BroadcastChannel(key);}catch{/* storage event fallback */}
function emit(message){const packet={...message,source};if(channel)channel.postMessage(packet);else try{localStorage.setItem(key+':event',JSON.stringify({...packet,nonce:Math.random()}));}catch{feedback('双屏通道不可用；当前只在本窗口操作。请不要把两屏结果当成同步。',true);}}
function publish(){if(owner)emit({type:'state',epoch,sequence:++sequence,project,mode,snapshot,game:game?.state});}
function receive(packet){if(!packet||packet.source===source)return;if(packet.type==='hello'){publish();return;}if(owner||packet.type!=='state'||!Number.isSafeInteger(packet.sequence)||!Number.isFinite(packet.epoch))return;
 if(packet.epoch<lastEpoch||(packet.epoch===lastEpoch&&packet.sequence<=lastSequence))return;
 try{const next=validateProject(packet.project);if(!['build','assemble','drive'].includes(packet.mode))return;const changed=JSON.stringify(project)!==JSON.stringify(next)||mode!==packet.mode;project=next;mode=packet.mode;snapshot=packet.snapshot;if(Number.isFinite(snapshot?.thrustLevel)){thrustLevel=snapshot.thrustLevel;$('thrust-level').value=thrustLevel;$('thrust-output').textContent=thrustLevel+' 档';}lastEpoch=packet.epoch;lastSequence=packet.sequence;lastSnapshotAt=performance.now();if(changed)renderUI();if(view&&snapshot)view.pose(snapshot);game?.receive(packet.game,snapshot,mode,owner);$('connection').textContent='同场次投屏 · 单一物理结果';updateTelemetry();}catch{/* ignore invalid transport, never evaluate imported data */}
}
if(channel)channel.onmessage=e=>receive(e.data);addEventListener('storage',e=>{if(e.key===key+':event'&&e.newValue)try{receive(JSON.parse(e.newValue));}catch{/* malformed event */}});
function persist(){try{localStorage.setItem(key,JSON.stringify(project));storageProblem=false;$('storage-warning').textContent='';return true;}catch{storageProblem=true;$('storage-warning').textContent='⚠ 保存失败：作品仍在内存，请立即导出 JSON。';feedback('浏览器保存失败或容量不足；当前作品仍在内存，请立即导出 JSON。',true);return false;}}
function commit(next){if(!owner)return;const valid=validateProject(next);history.apply(valid);project=valid;snapshot=null;physics?.dispose();physics=null;if(mode==='drive')mode='assemble';const saved=persist();renderUI();publish();return saved;}
function act(work){if(!owner)return feedback('当前为观看窗口。请在唯一教师操作窗口完成拼装。',true);try{work();}catch(e){feedback('没有修改作品：'+(e.message||'操作无效')+'。请检查配方、选择和接口。',true);}}
const blockKey=b=>`${b.x},${b.y},${b.z}`;
function editBlock(coord,tool='place'){act(()=>{if(mode!=='build')return;const k=blockKey(coord),existing=project.blocks.find(b=>blockKey(b)===k);if(tool==='select'){if(existing){if(selected.has(k))selected.delete(k);else selected.add(k);renderUI();}return;}const next=structuredClone(project);if(tool==='erase'){next.blocks=next.blocks.filter(b=>blockKey(b)!==k);selected.delete(k);}else{if(existing)return feedback('这里已经有方块，先删除再放置。');next.blocks.push({x:coord.x,y:coord.y,z:coord.z,material:$('material').value});}commit(next);feedback(tool==='erase'?'方块已删除，可撤销。':'方块已放置。选择组合后保存为模块。');});}
function options(select,items){const value=select.value;select.replaceChildren();for(const [id,label]of items){const o=document.createElement('option');o.value=id;o.textContent=label;select.append(o);}if(items.some(([id])=>id===value))select.value=value;}
const socketNames={'wheel-fl':'前左轮','wheel-fr':'前右轮','wheel-rl':'后左轮','wheel-rr':'后右轮',engine:'推进器'};
function renderUI(){
 $('mode-label').textContent={build:'搭方块',assemble:'装小车',drive:'物理试驾'}[mode];$('build-tools').hidden=mode!=='build';$('library').hidden=mode==='drive';$('drive-controls').hidden=mode!=='drive';
 for(const b of document.querySelectorAll('[data-mode]')){b.classList.toggle('active',b.dataset.mode===mode);b.disabled=!owner||(!canRender&&b.dataset.mode==='drive');}
 for(const node of document.querySelectorAll('[data-author] button,[data-author] input,[data-author] select,button[data-author]'))if(!['claim','open-screen'].includes(node.id))node.disabled=!owner;
 $('selection-info').textContent=`已选 ${project.blocks.filter(b=>selected.has(blockKey(b))).length} 块 / 工作台 ${project.blocks.length} 块。先选中要保存的组合。`;
 options($('definition'),project.definitions.map(d=>[d.id,d.name]));showDefinition();options($('instance'),project.instances.map(i=>[i.id,`${i.position?'自选位置':socketNames[i.socket]} · ${project.definitions.find(d=>d.id===i.definitionId).name} · ${i.rotation}°`]));if(project.instances.some(i=>i.id===selectedInstance))$('instance').value=selectedInstance;
 const counts={wheel:0,thruster:0,chassis:0};for(const i of project.instances)counts[project.definitions.find(d=>d.id===i.definitionId).behavior]++;$('assembly-info').textContent=`${counts.wheel} 个轮子 · ${counts.thruster} 个推进器 · ${counts.chassis} 段加长车身。随时可以试驾。`+assemblyIssues(project).join('；');
 view?.setEditable(owner);view?.setProject(project,mode,selected,$('instance').value);view?.setAssemblyDefinition(movingInstance?project.instances.find(i=>i.id===selectedInstance)?.definitionId:$('definition').value,movingInstance);if(snapshot)view?.pose(snapshot);game?.render(snapshot,mode,owner);updateTelemetry();
}
function showDefinition(){const d=project.definitions.find(d=>d.id===$('definition').value);$('definition-info').textContent=d?`${d.responsibility} · ${d.blocks.length} 块 · ${d.blocks.map(b=>({rubber:'橡胶',metal:'金属',fuel:'虚拟燃料'})[b.material]).join('＋')}`:'先搭方块并保存模块。';}
$('definition').onchange=()=>{movingInstance=false;showDefinition();view?.setAssemblyDefinition($('definition').value);};$('instance').onchange=()=>{selectedInstance=$('instance').value;renderUI();};
$('material').onchange=()=>view?.setMaterial($('material').value);
$('home').onclick=()=>view?.home();$('follow').onchange=()=>{if(view){view.follow=$('follow').checked;view.lastTarget=null;}};
$('delete-selected').onclick=()=>act(()=>{if(!selected.size)return feedback('先 Shift+单击（触屏长按）选中方块。');const next={...project,blocks:project.blocks.filter(b=>!selected.has(blockKey(b)))};selected.clear();commit(next);feedback('已删除选中方块，可撤销。');});
$('select-all').onclick=()=>act(()=>{selected=new Set(project.blocks.map(blockKey));renderUI();});$('clear-blocks').onclick=()=>act(()=>{selected.clear();commit({...project,blocks:[]});feedback('只清空工作台，模块库和小车保持不变；可撤销。');});
for(const action of ['undo','redo'])$(action).onclick=()=>act(()=>{physics?.dispose();physics=null;snapshot=null;if(mode==='drive')mode='assemble';project=history[action]();selected.clear();persist();renderUI();publish();feedback(action==='undo'?'已撤销。':'已重做。');});
function moduleFeedback(message,error=false){
 const node=$('module-feedback');node.textContent=message;node.classList.toggle('error',error);
 feedback(message,error);node.scrollIntoView({block:'nearest'});
}
$('save-module').onsubmit=e=>{
 e.preventDefault();
 if(!owner)return moduleFeedback('当前为观看窗口，请在教师操作源窗口保存。',true);
 for(const [id,label] of [['module-name','模块名称'],['responsibility','一句职责']]){
  const field=$(id);field.removeAttribute('aria-invalid');
  if(!field.value.trim()||!field.validity.valid){
   moduleFeedback(`还没保存：请填写${label}（最多 ${field.maxLength} 字）。你搭好的方块都还在。`,true);
   field.setAttribute('aria-invalid','true');field.focus();field.scrollIntoView({block:'nearest'});return;
  }
 }
 try{
  const blocks=project.blocks.filter(b=>selected.has(blockKey(b)));
  if(!blocks.length)throw Error('先选择要保存的方块，可以点击“选择全部方块”');
  const saved=commit(saveDefinition(project,{id:crypto.randomUUID(),name:$('module-name').value.trim(),responsibility:$('responsibility').value.trim(),behavior:$('behavior').value,blocks}));
  const d=project.definitions.at(-1);$('definition').value=d.id;showDefinition();
  moduleFeedback(saved?`已保存「${d.name}」· ${d.blocks.length} 块。模块库已有 ${project.definitions.length} 个模块，可重复装到小车上。`:'模块已加入当前模块库，但浏览器存储失败；请立即导出作品 JSON，刷新可能丢失。',!saved);
 }catch(error){moduleFeedback('未保存：'+error.message+'。工作台方块保持不变。',true);}
};
$('load-definition').onclick=()=>act(()=>{const d=project.definitions.find(d=>d.id===$('definition').value);if(!d)throw Error('模块库为空');mode='build';selected=new Set(d.blocks.map(blockKey));commit({...project,blocks:structuredClone(d.blocks)});feedback('已复制内部方块到工作台；编辑不会改掉已有定义或实例。');});
$('place-module').onclick=()=>act(()=>{const id=crypto.randomUUID();const next=placeInstance(project,{id,definitionId:$('definition').value,socket:$('socket').value});mode='assemble';commit(next);selectedInstance=id;renderUI();feedback('连接成功：一个独立实例已吸附到接口。推进器橙箭头是喷射方向，绿箭头是相反的受力方向；需要时旋转 180°。');});
$('move-instance').onclick=()=>act(()=>{selectedInstance=$('instance').value;if(!selectedInstance)throw Error('先选中车上的模块');movingInstance=true;renderUI();feedback('移动模式：在车身上点击新位置。只移动这一份模块，其他实例不变。');});$('rotate-instance').onclick=()=>act(()=>{commit(rotateInstance(project,$('instance').value));feedback('此实例已转向；推进器按箭头方向施力，其他实例不变。');});$('delete-instance').onclick=()=>act(()=>{commit(removeInstance(project,$('instance').value));feedback('已拆下此实例，原模块还在模块库。');});
function editAssembly(hit,action){act(()=>{
 if(mode!=='assemble')return;
 if(action==='select'){selectedInstance=hit.id;movingInstance=false;renderUI();return;}
 if(action==='erase'){commit(removeInstance(project,hit.id));feedback('已拆下选中的这一份模块，模块库保留，可撤销。');return;}
 if(movingInstance){commit(moveOnChassis(project,selectedInstance,hit.position,hit.normal));movingInstance=false;renderUI();feedback('已移动到车身的新位置。试驾按这个实际位置计算。');return;}
 const id=crypto.randomUUID();commit(placeOnChassis(project,{id,definitionId:hit.definitionId,position:hit.position,normal:hit.normal}));selectedInstance=id;renderUI();feedback('模块已放到车身上。可继续放置，Shift+单击选中，右键单击拆下；拖动只转视角。');
});}
function switchMode(next){act(()=>{if(next==='drive'){if(!DriveWorld||!canRender)throw Error('三维或物理引擎尚未就绪');physics?.dispose();physics=new DriveWorld(project,{differential:true,glassFinish:true,breakableWall:true});snapshot=physics.snapshot();}else{physics?.dispose();physics=null;snapshot=null;}mode=next;stopInput();renderUI();view?.home();publish();feedback(next==='drive'?'按住 Space 喷射，松开停止喷射；↑ 普通前进，←／→ 转向，↓ 后退。碰道具自动拾取，两格背包满了可丢下一件；带钥匙到玻璃终点。玻璃、橙色墙和两侧方块都可撞倒。':'回到拼装可调整方向或连接，然后从同一起点复测。');});}
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>switchMode(b.dataset.mode);
function updateDriveInput(){({forward,reverse,thrust,brake,steer,holding}=driveInput.read());for(const [id,active]of [['forward',forward],['thrust',thrust],['brake',reverse],['steer-left',steer>0],['steer-right',steer<0]])$(id).classList.toggle('pressed',active);}
function stopInput(){driveInput.clear();updateDriveInput();}
for(const [id,action]of [['forward','forward'],['thrust','thrust'],['brake','reverse'],['steer-left','left'],['steer-right','right']]){
 const b=$(id),pointer='pointer:'+id,keyboard='button:'+id;
 b.onpointerdown=e=>{if(!owner||mode!=='drive')return;e.preventDefault();b.setPointerCapture(e.pointerId);driveInput.press(pointer,action);updateDriveInput();};
 b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>{driveInput.release(pointer);updateDriveInput();};
 b.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();if(owner&&mode==='drive'){driveInput.press(keyboard,action);updateDriveInput();}}};
 b.onkeyup=e=>{if(e.key==='Enter'){driveInput.release(keyboard);updateDriveInput();}};
}
const driveKeys={' ':'thrust',ArrowUp:'forward',ArrowDown:'reverse',ArrowLeft:'left',ArrowRight:'right'};
addEventListener('keydown',e=>{
 if(e.target.closest('input,textarea,select,[contenteditable="true"]')||e.metaKey||e.ctrlKey||e.altKey)return;
 if(mode==='drive'&&owner&&driveKeys[e.key]){e.preventDefault();e.stopPropagation();driveInput.press('key:'+e.key,driveKeys[e.key]);updateDriveInput();}
});
addEventListener('keyup',e=>{if(driveKeys[e.key]){if(mode==='drive'){e.preventDefault();e.stopPropagation();}driveInput.release('key:'+e.key);updateDriveInput();}});
addEventListener('blur',()=>{stopInput();physics?.pause();});document.addEventListener('visibilitychange',()=>{stopInput();physics?.pause();last=performance.now();});
$('thrust-level').onpointerup=()=>{$('canvas').focus();};
$('thrust-level').oninput=()=>{if(owner){thrustLevel=Math.max(1,Math.min(5,Number($('thrust-level').value)));$('thrust-output').textContent=thrustLevel+' 档';}};
$('reset-car').onclick=()=>act(()=>{if(physics){stopInput();physics.reset();snapshot=physics.snapshot();view?.pose(snapshot);view?.home();publish();feedback('同一辆车回到同一起点。方向和模块没有被替换。');}});
$('expand').onclick=()=>{const expanded=$('workspace').classList.toggle('expanded');$('expand').textContent=expanded?'收起展示区':'展开展示区';};$('fullscreen').onclick=async()=>{try{await $('workspace').requestFullscreen();}catch{feedback('浏览器未允许全屏，请使用「展开展示区」。',true);}};$('exit-full').onclick=()=>document.exitFullscreen();
$('save-project').onclick=()=>{if(owner&&persist())feedback('已保存到此浏览器／此设备。换设备请导出 JSON。');};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`mc-workshop-${workspace}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback('已导出模块定义、方块和当前装配实例。');};
$('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(!owner)throw Error('观看窗口不能导入');if(file.size>102400)throw Error('文件最多100KB');const text=await file.text(),next=parseProject(text,workspace);importBackup={name:file.name,text};mode='build';selected.clear();commit(next);feedback('导入成功，可撤销回到导入前；原始文件没有改动。');}catch(error){feedback('导入失败，当前作品未改变：'+error.message,true);}finally{e.target.value='';}};
$('open-screen').onclick=()=>{const url=new URL('../audience/index.html',location.href);url.searchParams.set('session',session);url.searchParams.set('workspace',workspace);const w=window.open(url,'msv-mc-'+session+'-'+workspace);if(!w)feedback('投屏窗口被拦截，请允许本站弹窗。',true);};
async function claim(){if(!teacher||owner)return;if(!navigator.locks){feedback('此浏览器不支持安全操作锁；请使用新版 Chrome / Edge / Safari。不会开启第二份独立模拟。',true);return;}navigator.locks.request(key+':owner',{ifAvailable:true},async lock=>{if(!lock){$('connection').textContent='另一教师窗口正在操作 · 当前只读';renderUI();emit({type:'hello'});return;}owner=true;epoch=Date.now();sequence=0;$('connection').textContent='教师操作源 · 此设备自动保存';renderUI();publish();await new Promise(resolve=>releaseLock=resolve);});}
$('claim').onclick=claim;addEventListener('pagehide',()=>{stopInput();releaseLock?.();});
function updateTelemetry(){if(snapshot){$('telemetry').textContent=`${owner?'真实物理':'投屏快照'} · ${snapshot.time.toFixed(1)} 秒 · 速度 ${snapshot.speed.toFixed(1)} · 位置 X ${snapshot.chassis.p.x.toFixed(1)} / 高度 ${snapshot.chassis.p.y.toFixed(1)}${snapshot.outOfBounds?' · 已离开试驾区，请重置':''}`;}else $('telemetry').textContent=`工作区 ${workspace} · ${project.blocks.length} 个工作台方块 · ${project.definitions.length} 个定义 · ${project.instances.length} 个实例`;}
let last=performance.now(),lastSend=0;
function frame(now){const delta=(now-last)/1000;last=now;if(owner&&physics&&!document.hidden){if(!snapshot?.outOfBounds){snapshot=physics.advance(delta,{forward,reverse,thrust,brake,steer,thrustLevel});view?.pose(snapshot);game?.step(snapshot,mode,owner);}else stopInput();if(now-lastSend>50){publish();updateTelemetry();lastSend=now;}}if(!owner&&now-lastSnapshotAt>3500)$('connection').textContent='等待教师操作源 · 未独立运行物理';view?.render();requestAnimationFrame(frame);}
async function boot(){const loading=window.MSVWorkshopLoading;try{loading?.set(1,"加载三维脚本与物理引擎文件，首次打开可能稍慢…");const [{WorkshopView},physical]=await Promise.all([import('./render.mjs?v=mc-fa48bdc938a3'),import('./physics.mjs?v=mc-fa48bdc938a3')]);loading?.set(2,"正在初始化物理引擎…");await physical.initPhysics();loading?.set(3,"正在创建方块场景…");DriveWorld=physical.DriveWorld;view=new WorkshopView($('canvas'),editBlock,editAssembly);game=new WorkshopGame(view,key,()=>{stopInput();publish();},()=>{physics?.reset();snapshot=physics?.snapshot()||null;});canRender=true;view.setMaterial($('material').value);renderUI();view.home();view.render();loading?.done();if(!storageProblem)feedback(teacher?'拖动转视角；移动鼠标看半透明预览，单击格子中心放第一块。':'观看教师正在搭建的同一件作品；相机可自行观察。');}catch(error){console.error('[workshop-boot]',error);loading?.fail('三维／物理加载失败，请重试。已保存作品不会清空。');$('fallback').hidden=false;canRender=false;renderUI();feedback('三维／物理不可用：未进入试驾；请重试或用静态说明讲解。',true);}}
addEventListener('msv-workshop-render-failed',()=>{stopInput();physics?.dispose();physics=null;snapshot=null;canRender=false;$('fallback').hidden=false;renderUI();feedback('三维上下文已丢失，试驾已停止；作品保留，可导出后重试。',true);});
$('retry').onclick=()=>location.reload();renderUI();claim();emit({type:'hello'});boot();requestAnimationFrame(frame);
// Diagnostics expose data, not a second control path; browser tests use real controls.
window.MSVWorkshop={inspect:()=>({project:structuredClone(project),mode,owner,game:structuredClone(game?.state),snapshot:structuredClone(snapshot),selected:[...selected],storageProblem,holding,controls:driveInput.read(),importBackup:importBackup?.name??null,canvas:view?{width:view.renderer.domElement.width,height:view.renderer.domElement.height,camera:view.camera.position.toArray()}:null,epoch,sequence,lastSequence,ghost:view?{visible:view.ghost.visible,cell:view.ghostCell,position:view.ghost.position.toArray()}:null}),screenPoint:(x,y,z)=>view?.screenPoint(x,y,z),forceStorageCheck:persist};
