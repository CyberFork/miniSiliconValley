import * as THREE from '../vendor/three.module.min.js';
import {CAPACITY,ITEMS,createGameState,stepGame,discardItem,itemPosition,validItemPositions,itemLabel} from '../route-game/state.mjs';
import {terrainHeight} from './physics.mjs?v=mc-fa48bdc938a3';
import {RouteEffects,createWorldItem} from '../route-game/effects.mjs';
const valid=s=>s&&validItemPositions(s.droppedPositions)&&Array.isArray(s.bag)&&s.bag.length<=CAPACITY&&['bag','collected','ignored'].every(k=>Array.isArray(s[k])&&s[k].every(id=>ITEMS.some(i=>i.id===id)))&&typeof s.won==='boolean'&&typeof s.message==='string'&&Array.isArray(s.events)&&s.events.every(e=>typeof e==='string');
export class WorkshopGame{
 constructor(view,key,notify,reset){
  this.view=view;this.key=key+':game';this.notify=notify;this.reset=reset;this.state=createGameState();
  try{const saved=JSON.parse(localStorage.getItem(this.key));if(valid(saved))this.state=saved;}catch{}
  this.effects=new RouteEffects(view,{flame:false});this.items=new Map();
  for(const item of ITEMS){const group=createWorldItem(item);group.position.copy(item.position);const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff9e9';ctx.fillRect(0,0,256,96);ctx.fillStyle='#182c40';ctx.font='bold 40px sans-serif';ctx.textAlign='center';ctx.fillText(item.name,128,62);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas)}));label.position.y=.95;label.scale.set(1.4,.53,1);group.add(label);view.land.add(group);this.items.set(item.id,group);}
  this.panel=document.createElement('section');this.panel.className='workshop-game';this.panel.innerHTML='<h2>闯关模块 · 带钥匙到玻璃终点</h2><p>移动 → 碰到道具 → 放进背包 → 检查终点 → 显示结果</p><div data-bag></div><p data-message role="status"></p><details><summary>模块刚刚怎样合作？</summary><ol data-events></ol></details><button data-restart>重新闯关（保留小车）</button>';
  document.querySelector('.tools').append(this.panel);
  this.dialog=document.createElement('dialog');this.dialog.className='workshop-win';this.dialog.innerHTML='<h2>🎉 闯关成功！</h2><p>到达终点 ＋ 背包里有钥匙，两个条件都满足！</p><p>移动、拾取、背包、关卡判断和结果模块合作完成了任务。</p><button data-continue>继续试驾</button> <button data-again>重新闯关</button>';document.body.append(this.dialog);
  this.dialog.querySelector('[data-continue]').onclick=()=>this.dialog.close();
  const restart=()=>{if(!this.owner)return;this.state=createGameState();this.announced=false;this.dialog.close();this.reset();this.save();this.render(null,this.mode,this.owner);this.notify();};this.panel.querySelector('[data-restart]').onclick=restart;this.dialog.querySelector('[data-again]').onclick=restart;
 }
 save(){try{localStorage.setItem(this.key,JSON.stringify(this.state));}catch{document.getElementById('storage-warning').textContent='闯关进度未能保存，当前仍可继续；小车作品不受影响。';}}
 receive(state,snapshot,mode,owner){if(valid(state))this.state=structuredClone(state);this.render(snapshot,mode,owner);}
 step(snapshot,mode,owner){if(this.dialog.open)return;const next=stepGame(this.state,snapshot?.chassis?.p);if(JSON.stringify(next)!==JSON.stringify(this.state)){this.state=next;this.save();this.notify();}this.render(snapshot,mode,owner);}
 render(snapshot,mode,owner){this.snapshot=snapshot;this.owner=owner;this.mode=mode;document.body.dataset.mode=mode;this.panel.hidden=mode!=='drive';this.effects.update(snapshot);for(const [id,item]of this.items){item.position.copy(itemPosition(this.state,id));item.visible=mode!=='build'&&!this.state.collected.includes(id);}const bag=this.panel.querySelector('[data-bag]');const signature=JSON.stringify([this.state,owner]);if(this.signature!==signature){this.signature=signature;bag.replaceChildren();const title=document.createElement('strong');title.textContent=`背包 ${this.state.bag.length} / ${CAPACITY}　`;bag.append(title);for(const id of this.state.bag){const button=document.createElement('button');button.textContent=itemLabel(id)+' · 丢下';button.disabled=!owner||this.state.won;button.onclick=()=>{const p=this.snapshot?.chassis?.p;this.state=discardItem(this.state,id,p?{x:p.x,y:terrainHeight(p.x)+.35,z:p.z}:null);this.save();this.render(this.snapshot,this.mode,this.owner);this.notify();};bag.append(button);}this.panel.querySelector('[data-message]').textContent=this.state.message;const list=this.panel.querySelector('[data-events]');list.replaceChildren();for(const event of this.state.events){const li=document.createElement('li');li.textContent=event;list.append(li);}}
 this.panel.querySelector('[data-restart]').disabled=!owner;this.dialog.querySelector('[data-again]').disabled=!owner;if(mode==='drive'&&this.state.won&&!this.announced){this.announced=true;this.dialog.showModal();this.notify();}if(!this.state.won)this.announced=false;
 }
}
