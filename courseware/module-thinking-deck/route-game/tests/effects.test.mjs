import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.min.js';
import {RouteEffects} from '../effects.mjs';
test('flame points out of the fuel end and is driven by the shared thrust snapshot',()=>{
 const land=new THREE.Group(),engine=new THREE.Group();engine.rotation.y=Math.PI;
 const effects=new RouteEffects({land,instanceGroups:new Map([['engine',engine]])});
 const glass=Array.from(effects.glass.keys(),(id,i)=>({id,p:{x:9+i*.1,y:.3,z:1},q:{x:0,y:0,z:0,w:1}}));
 effects.update({thrust:true,time:1,glass});assert(effects.flame.visible);engine.updateMatrixWorld(true);
 const tip=new THREE.Vector3(2,0,0);effects.flame.localToWorld(tip);assert(tip.x<0,'engine rotation=180 exhausts backwards, while power goes forwards');
 assert(effects.flame.children.length>=2,'warm outer plume and bright core');
 assert(effects.glass.get(glass[3].id).position.x===glass[3].p.x,'rubble renders authoritative physics pose');
 const old=effects.flame.scale.x;effects.update({thrust:true,time:1.01,glass});assert.notEqual(effects.flame.scale.x,old,'jet visibly flickers');
 effects.update({thrust:false,time:1.02,glass});assert.equal(effects.flame.visible,false,'releasing thrust or reversing turns fire off');
});
