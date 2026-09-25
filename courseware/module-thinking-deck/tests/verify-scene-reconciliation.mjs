import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
// Match DOMStringMap's real mapping: hyphen before a digit is NOT removed.
class Host {
 constructor(type,mode,ready=false){this.attrs=new Map([['data-module-3d',type],['data-module-3d-mode',mode]]);this.dataset={'module-3d':type,'module-3dMode':mode};this.style={};this.children=[];if(ready){this.attrs.set('data-webgl-ready','true');this.dataset.webglReady='true';}}
 getAttribute(name){return this.attrs.get(name)??null;}
 get attributes(){return [...this.attrs].map(([name,value])=>({name,value}));}
 setAttribute(name,value){this.attrs.set(name,String(value));}
 append(node){this.children.push(node);node.parent=this;}
 replaceWith(node){this.parent.children[this.parent.children.indexOf(this)]=node;node.parent=this.parent;this.replacedBy=node;}
 remove(){this.removed=true;if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
}
const css='[data-module-3d]',timers=[];
const source=await readFile(new URL('../lesson-tools.js',import.meta.url),'utf8');
function load(code){const box={matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>fn(),setTimeout:(fn,ms)=>timers.push({fn,ms})};vm.createContext(box);vm.runInContext(code.slice(code.indexOf(' function takeScenes('),code.indexOf(' function paintRelation(')),box);return box;}
function container(...hosts){const root={children:hosts,querySelectorAll(selector){const all=this.children.flatMap(h=>[h,...h.children]);return selector===css?all:all.filter(h=>h.dataset.webglReady);},querySelector(selector){return selector.startsWith('[data-slide-id=')?{}:this.children[0];}};hosts.forEach(h=>h.parent=root);return root;}
function crossType(tools,from,to){const old=new Host(from,'old',true),fresh=new Host(to,'new');const root=container(fresh);tools.restoreScenes(root,[old]);assert.equal(root.children[0],fresh,`${from}→${to}: fresh factory host must remain`);assert.equal(old.dataset.sceneLeaving,'true');assert.equal(old.inert,true);assert.equal(old.getAttribute('data-module-3d'),from);}
const tools=load(source),types=['transform','automation','voxel','game'];
for(const from of types)for(const to of types)if(from!==to)crossType(tools,from,to);
// Mutation test proves this fixture fails for the original undefined===undefined bug.
const buggy=load(source.replace("node.getAttribute('data-module-3d')===previous.getAttribute('data-module-3d')",'node.dataset.module3d===previous.dataset.module3d'));
assert.throws(()=>crossType(buggy,'transform','automation'),/fresh factory host/);
for(const type of types){const old=new Host(type,'before',true),fresh=new Host(type,'after'),root=container(fresh);old.dataset.cameraState='user-orbit';tools.restoreScenes(root,[old]);assert.equal(root.children[0],old);assert.equal(old.getAttribute('data-module-3d-mode'),'after');assert.equal(old.dataset.cameraState,'user-orbit');assert.equal(old.dataset.sceneLeaving,undefined);}
// Rapid switching can leave an older fading scene nested in the new host.
const retired=new Host('transform','car',true);retired.dataset.sceneLeaving='true';const live=new Host('automation','works',true);live.append(retired);const active=tools.takeScenes(container(live),'module-tradeoff');assert.equal(active.length,1);assert.equal(active[0],live);
const incoming=new Host('voxel','car:blocks'),next=container(incoming);tools.restoreScenes(next,active);assert.equal(next.children[0],incoming);assert.equal(live.dataset.sceneLeaving,'true');
assert(timers.every(t=>t.ms===450));timers.forEach(t=>t.fn());assert(live.removed);
console.log('Scene reconciliation PASS: real dataset mapping, all 12 cross-type pairs, same-type camera retention, rapid switch, original-bug mutation; DOM logic only');
