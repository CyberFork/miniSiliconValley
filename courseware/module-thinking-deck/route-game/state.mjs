// Pure gameplay rules; no Classroom, wallet or workshop project writes.
export const CAPACITY=2;
export const REQUIRED_ITEM='key';
export const ITEMS=Object.freeze([
 Object.freeze({id:'coin',icon:'🪙',name:'金币',position:Object.freeze({x:2,y:.8,z:0}),color:0xf3cd62}),
 Object.freeze({id:'tool',icon:'🔧',name:'工具',position:Object.freeze({x:4.5,y:.8,z:0}),color:0x699edc}),
 Object.freeze({id:'key',icon:'🔑',name:'钥匙',position:Object.freeze({x:7,y:.95,z:0}),color:0x65cfab}),
]);
export function itemLabel(id){const item=ITEMS.find(item=>item.id===id);return item?`${item.icon} ${item.name}`:'道具';}
export const FINISH=Object.freeze({x:9,y:1.3,z:0});
export function createGameState(){return {bag:[],collected:[],ignored:[],droppedPositions:{},won:false,stage:0,message:'开车去碰道具：背包只有两格，带钥匙到玻璃方块终点才过关。',events:[]};}
const validPosition=p=>p&&['x','y','z'].every(axis=>Number.isFinite(p[axis]));
export function validItemPositions(positions){return positions===undefined||Boolean(positions&&typeof positions==='object'&&!Array.isArray(positions)&&Object.entries(positions).every(([id,p])=>ITEMS.some(item=>item.id===id)&&validPosition(p)));}
export function itemPosition(state,id){return state.droppedPositions?.[id]||ITEMS.find(item=>item.id===id)?.position;}
const near=(a,b,r)=>Math.hypot(a.x-b.x,a.z-b.z)<=r&&Math.abs(a.y-b.y)<=2;
function announce(state,message,stage){state.stage=stage;state.message=message;if(!state.events.includes(message))state.events=[...state.events,message].slice(-6);}
export function stepGame(previous,position){
 const state=structuredClone(previous);
 if(!position||![position.x,position.y,position.z].every(Number.isFinite)||state.won)return state;
 if(state.stage===0&&Math.hypot(position.x,position.z)>.5)announce(state,'移动模块：小车离开起点，去碰前方道具。',1);
 state.ignored=state.ignored.filter(id=>near(position,itemPosition(state,id),1.3));
 for(const item of ITEMS){
  if(state.ignored.includes(item.id)||state.collected.includes(item.id)||!near(position,itemPosition(state,item.id),1.3))continue;
  if(state.bag.length>=CAPACITY){announce(state,`拾取 → 背包：想收下${item.name}，但两格已满。先丢下一件；道具还在路上。`,2);continue;}
  state.bag.push(item.id);state.collected.push(item.id);announce(state,`拾取 → 背包：收到${item.name}，已存入第 ${state.bag.length} 格。`,3);
 }
 if(near(position,FINISH,1.35)){
  if(state.bag.includes(REQUIRED_ITEM)){state.won=true;announce(state,'关卡检查 → 结果：已经到终点，而且背包里有钥匙。闯关成功！',5);}
  else announce(state,'关卡检查：到了终点，但背包里没有钥匙，还不能过关。',4);
 }
 return state;
}
export function discardItem(previous,id,position){
 const state=structuredClone(previous);if(!state.bag.includes(id)||state.won||!validPosition(position))return state;
 state.droppedPositions={...state.droppedPositions,[id]:{x:position.x,y:position.y,z:position.z}};
 state.ignored=[...new Set([...state.ignored,id])];
 state.bag=state.bag.filter(value=>value!==id);state.collected=state.collected.filter(value=>value!==id);
 announce(state,`背包：已丢下${ITEMS.find(item=>item.id===id)?.name||'道具'}，空出一格；物品留在小车当前所在的地面。先驶离，再回来可拾取。`,3);return state;
}
