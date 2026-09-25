const MATERIALS = new Set(['rubber','metal','fuel']);
const SOCKETS = ['wheel-fl','wheel-fr','wheel-rl','wheel-rr','engine'];
const KEYS = {
 project:['schemaVersion','version','workspace','blocks','definitions','instances'],
 block:['x','y','z','material'], def:['id','name','responsibility','behavior','blocks'], inst:['id','definitionId','socket','rotation','position','normal']
};
export const LEGACY_MOUNTS=Object.freeze({'wheel-fl':[1,-.35,-.92],'wheel-fr':[1,-.35,.92],'wheel-rl':[-1,-.35,-.92],'wheel-rr':[-1,-.35,.92],engine:[-1.15,.5,0]});
export function mountPosition(instance){return instance.position||LEGACY_MOUNTS[instance.socket];}
export function mountNormal(instance){return instance.normal||[0,0,1];}
export const MAX_INSTANCES=64;
export function chassisSize(def){return ['x','y','z'].map(axis=>(Math.max(...def.blocks.map(b=>b[axis]))-Math.min(...def.blocks.map(b=>b[axis]))+1)*.4);}
export function chassisParts(project){return [{id:'base',position:[0,0,0],size:[3,.4,1.2]},...project.instances.filter(i=>project.definitions.find(d=>d.id===i.definitionId)?.behavior==='chassis').map(i=>({id:i.id,position:i.position,size:chassisSize(project.definitions.find(d=>d.id===i.definitionId))}))];}
function validateMount(i,behavior,parts,size){
 if(i.position===undefined&&i.normal===undefined){if(!SOCKETS.includes(i.socket)||behavior==='chassis')bad('invalid mount');return {};}
 if(!Array.isArray(i.position)||i.position.length!==3||!i.position.every(n=>Number.isFinite(n)&&Math.abs(n)<=18)||!Array.isArray(i.normal)||i.normal.length!==3||!i.normal.every(n=>[-1,0,1].includes(n))||i.normal.reduce((n,v)=>n+Math.abs(v),0)!==1)bad('invalid mount');
 const axis=i.normal.findIndex(n=>n!==0),offset=behavior==='chassis'?size[axis]/2:behavior==='thruster'?(axis===0?.62:.24):.24;
 if(!parts.some(part=>{const local=i.position.map((v,k)=>v-part.position[k]),half=part.size.map(v=>v/2);return Math.abs(local[axis]-i.normal[axis]*(half[axis]+offset))<.015&&local.every((v,k)=>k===axis||Math.abs(v)<=half[k]+.001);}))bad('invalid mount');
 if(behavior==='chassis'&&parts.some(part=>part.position.every((v,k)=>Math.abs(v-i.position[k])<(part.size[k]+size[k])/2-.015)))throw Error('车身模块不能重叠，请贴着外表面延长');
 return {position:[...i.position],normal:[...i.normal]};
}
const clone = x => structuredClone(x);
const messages={'invalid wheel recipe':'轮子需要恰好 5 个橡胶方块','invalid wheel shape':'轮子需要中心 1 块、上下左右各 1 块的平面十字；可以竖着或平放，但不能错开厚度','invalid thruster recipe':'推进器需要 2 个金属方块和 1 个虚拟燃料方块','invalid thruster shape':'沿 X 方向依次摆放：金属、金属、虚拟燃料','occupied socket':'该接口已有模块，请先拆下或换空接口','socket mismatch':'轮子要接轮子接口，推进器要接推进器接口','invalid coordinate':'方块超出工作台范围','duplicate block':'同一个格子不能重复放置','invalid mount':'请将模块放在车身表面','invalid instance':'实例或连接位置重复／无效','missing instance':'请先选中一个已装配模块'};
const bad = m => { throw new TypeError(messages[m] || '数据不符合工坊规则（'+m+'）'); };
const plain = x => x && typeof x==='object' && !Array.isArray(x) && Object.getPrototypeOf(x)===Object.prototype;
function exact(o, keys){ if(!plain(o) || Object.keys(o).some(k=>!keys.includes(k))) bad('invalid object'); }
function str(v,label,max=256){ if(typeof v!=='string'||!v.trim()||v.length>max) bad(`invalid ${label}`); return v; }
function coord(n,label){ if(!Number.isInteger(n)|| (label==='y' ? (n<0||n>4) : (n<-4||n>4))) bad('invalid coordinate'); return n; }
function block(b){ exact(b,KEYS.block); return {x:coord(b.x,'x'),y:coord(b.y,'y'),z:coord(b.z,'z'),material:(MATERIALS.has(b.material)?b.material:bad('invalid material'))}; }
function blocks(bs){ if(!Array.isArray(bs)||bs.length>64) bad('invalid blocks'); const out=bs.map(block), seen=new Set(); for(const b of out){const k=`${b.x},${b.y},${b.z}`;if(seen.has(k))bad('duplicate block');seen.add(k)} return out; }
function validateDefinition(d){ exact(d,KEYS.def); const out={id:str(d.id,'id'),name:str(d.name,'name'),responsibility:str(d.responsibility,'responsibility'),behavior:d.behavior,blocks:blocks(d.blocks)}; if(!['wheel','thruster','chassis'].includes(out.behavior))bad('invalid behavior'); checkRecipe(out.blocks,out.behavior); return out; }
// A wheel recipe is orientation-independent; original construction remains intact.
export function wheelPlane(bs){
 if(bs.length!==5)return null;
 for(const fixed of ['z','x','y']){
  if(!bs.every(b=>b[fixed]===bs[0][fixed]))continue;
  const axes=['x','y','z'].filter(a=>a!==fixed);
  for(const center of bs){
   const want=new Set(['0,0','1,0','-1,0','0,1','0,-1']);
   const actual=new Set(bs.map(b=>`${b[axes[0]]-center[axes[0]]},${b[axes[1]]-center[axes[1]]}`));
   if(actual.size===5&&[...actual].every(v=>want.has(v)))return fixed;
  }
 }
 return null;
}
function checkRecipe(bs,behavior){ const mats=bs.map(b=>b.material); if(behavior==='wheel'){if(bs.length!==5||mats.some(m=>m!=='rubber'))bad('invalid wheel recipe'); if(!wheelPlane(bs))bad('invalid wheel shape'); }
 else if(behavior==='chassis'){if(!bs.length||mats.some(m=>m!=='metal')||['x','y','z'].reduce((n,k)=>n*(Math.max(...bs.map(b=>b[k]))-Math.min(...bs.map(b=>b[k]))+1),1)!==bs.length)throw Error('车身请用金属方块搭成实心长方体');}
 else {if(bs.length!==3||bs.filter(b=>b.material==='metal').length!==2||bs.filter(b=>b.material==='fuel').length!==1||new Set(bs.map(b=>`${b.y},${b.z}`)).size!==1){bad('invalid thruster recipe')} const sorted=[...bs].sort((a,b)=>a.x-b.x); if(!(sorted[0].material==='metal'&&sorted[1].material==='metal'&&sorted[2].material==='fuel'&&sorted[1].x===sorted[0].x+1&&sorted[2].x===sorted[1].x+1))bad('invalid thruster shape');}}
export function recipe(behavior){ if(behavior==='wheel') return [{x:1,y:1,z:0,material:'rubber'},{x:2,y:1,z:0,material:'rubber'},{x:0,y:1,z:0,material:'rubber'},{x:1,y:2,z:0,material:'rubber'},{x:1,y:0,z:0,material:'rubber'}]; if(behavior==='chassis')return Array.from({length:9},(_,i)=>({x:i%3,y:0,z:Math.floor(i/3),material:'metal'})); if(behavior==='thruster')return [{x:0,y:0,z:0,material:'metal'},{x:1,y:0,z:0,material:'metal'},{x:2,y:0,z:0,material:'fuel'}]; bad('invalid behavior'); }
export function emptyProject(workspace=''){ return {schemaVersion:1,version:'mc-workshop-1',workspace:str(workspace,'workspace'),blocks:[],definitions:[],instances:[]}; }
export function validateProject(raw){
 exact(raw,KEYS.project);if(raw.schemaVersion!==1||raw.version!=='mc-workshop-1')bad('invalid schema');
 if(!Array.isArray(raw.definitions)||raw.definitions.length>16)bad('invalid definitions');
 const p={schemaVersion:1,version:'mc-workshop-1',workspace:str(raw.workspace,'workspace'),blocks:blocks(raw.blocks),definitions:raw.definitions.map(validateDefinition),instances:[]};
 if(!Array.isArray(raw.instances)||raw.instances.length>MAX_INSTANCES)throw Error('当前课堂场景最多安装 64 份模块');
 const defs=new Map(p.definitions.map(d=>[d.id,d]));if(defs.size!==p.definitions.length)bad('duplicate definition');
 const ids=new Set(),sockets=new Set();
 for(const i of raw.instances){
  exact(i,KEYS.inst);const d=defs.get(i.definitionId);if(!d||ids.has(i.id)||sockets.has(i.socket)||![0,180].includes(i.rotation))bad('invalid instance');
  const kind=SOCKETS.includes(i.socket)?(i.socket==='engine'?'thruster':'wheel'):/^(wheel|engine|chassis)-[1-9][0-9]{0,3}$/.exec(i.socket||'')?.[1];
  if((kind==='engine'?'thruster':kind)!==d.behavior)bad('socket mismatch');
  p.instances.push({id:str(i.id,'id'),definitionId:str(i.definitionId,'definitionId'),socket:i.socket,rotation:i.rotation,...(i.position!==undefined||i.normal!==undefined?{position:clone(i.position),normal:clone(i.normal)}:{})});ids.add(i.id);sockets.add(i.socket);
 }
 // Resolve structural connectivity independent of JSON instance ordering.
 const connected=[{id:'base',position:[0,0,0],size:[3,.4,1.2]}],pending=p.instances.filter(i=>defs.get(i.definitionId).behavior==='chassis');
 while(pending.length){let progress=false;for(let n=pending.length-1;n>=0;n--){const i=pending[n],size=chassisSize(defs.get(i.definitionId));try{validateMount(i,'chassis',connected,size);}catch{continue;}connected.push({id:i.id,position:i.position,size});pending.splice(n,1);progress=true;}if(!progress)throw Error('车身需要连接到现有车身，不能悬空或重叠');}
 for(const i of p.instances){const d=defs.get(i.definitionId);if(d.behavior!=='chassis')validateMount(i,d.behavior,connected);if(p.instances.some(j=>j!==i&&j.position&&i.position&&j.position.every((v,k)=>Math.abs(v-i.position[k])<.01)))throw Error('这里已经有模块，请换个位置');}
 return clone(p);
}
export function saveDefinition(project,input){const p=validateProject(project); const d=validateDefinition({...input,blocks:input.blocks}); if(p.definitions.some(x=>x.id===d.id))bad('duplicate definition'); if(p.definitions.length>=16)bad('too many definitions'); const min=Object.fromEntries(['x','y','z'].map(k=>[k,Math.min(...d.blocks.map(b=>b[k]))]));d.blocks=d.blocks.map(b=>({...b,x:b.x-min.x,y:b.y-min.y,z:b.z-min.z})); p.definitions.push(d); return p;}
export function placeInstance(project,{id,definitionId,socket,rotation=0,position,normal}){const p=validateProject(project); if(p.instances.some(i=>i.socket===socket))bad('occupied socket'); return validateProject({...p,instances:[...p.instances,{id,definitionId,socket,rotation,...(position?{position,normal}:{})}]});}
export function moveInstance(project,id,socket){const p=validateProject(project), i=p.instances.find(x=>x.id===id);if(!i)bad('missing instance'); const next={...i,socket};delete next.position;delete next.normal;return placeReplace(p,next);}
export function placeOnChassis(project,{id,definitionId,position,normal,rotation=0}){
 const p=validateProject(project),def=p.definitions.find(d=>d.id===definitionId);if(!def)bad('missing definition');
 let socket=(def.behavior==='thruster'?['engine']:def.behavior==='wheel'?SOCKETS.filter(s=>s!=='engine'):[]).find(s=>!p.instances.some(i=>i.socket===s));
 if(!socket){const prefix=def.behavior==='thruster'?'engine':def.behavior;let n=1;while(p.instances.some(i=>i.socket===prefix+'-'+n))n++;socket=prefix+'-'+n;}
 return placeInstance(p,{id,definitionId,socket,position,normal,rotation});
}
export function moveOnChassis(project,id,position,normal){const p=validateProject(project),i=p.instances.find(x=>x.id===id);if(!i)bad('missing instance');return placeReplace(p,{...i,position,normal});}
function placeReplace(p,ni){return validateProject({...p,instances:p.instances.map(i=>i.id===ni.id?ni:i)});}
export function rotateInstance(project,id){const p=validateProject(project),i=p.instances.find(x=>x.id===id);if(!i)bad('missing instance');return placeReplace(p,{...i,rotation:i.rotation===0?180:0});}
export function removeInstance(project,id){const p=validateProject(project);return {...p,instances:p.instances.filter(i=>i.id!==id)};}
export function assemblyIssues(project){const p=validateProject(project),kinds=p.instances.map(i=>p.definitions.find(d=>d.id===i.definitionId).behavior),issues=[];if(!kinds.includes('wheel'))issues.push('没有轮子：方向键不会产生轮子驱动力，车身会贴地');if(!kinds.includes('thruster'))issues.push('没有推进器：Space 不产生喷射');return issues;}
export function parseProject(json,workspace){if(typeof json!=='string'||json.length>100*1024)bad('invalid json'); const p=validateProject(JSON.parse(json)); if(workspace!==undefined)p.workspace=str(workspace,'workspace'); return p;}
export function createHistory(initial){let past=[validateProject(initial)],pos=0; return {get:()=>clone(past[pos]),apply(n){const valid=validateProject(n);past.splice(pos+1);past.push(valid);if(past.length>50)past.shift();else pos++;pos=Math.min(pos,past.length-1)},undo(){if(pos)pos--;return clone(past[pos])},redo(){if(pos<past.length-1)pos++;return clone(past[pos])}};}
