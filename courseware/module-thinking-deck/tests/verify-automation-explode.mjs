import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.min.js';
const read=n=>readFile(new URL('../'+n,import.meta.url),'utf8');
const source=await read('module-3d.js');let now=10000,reduced=false;
const ctx={THREE,Date:{now:()=>now},matchMedia:()=>({matches:reduced}),PALETTE:{blue:0x2154d7,yellow:0xf2c84b,orange:0xef7657,mint:0x63d7b0,ink:0x152a36,paleBlue:0xbdd2ff},document:{createElement:()=>({setAttribute(){},remove(){}})},createCommonScene:()=>{const camera=new THREE.PerspectiveCamera(33,880/335,.1,100);camera.position.set(10.5,7.2,12.5);camera.lookAt(0,.3,0);return {scene:new THREE.Scene(),camera};}};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function material('),source.indexOf('function createCommonScene(')),ctx);
vm.runInContext(source.slice(source.indexOf('function createAutomationLab('),source.indexOf('function createVoxelForge(')),ctx);
const attrs={'data-module-3d-mode':'works'},host={dataset:{},getAttribute:k=>attrs[k],hasAttribute:k=>k in attrs,append(){}};
const scene=ctx.createAutomationLab(host),names=['base','motor','beam-a','beam-b','gear-a','gear-b','belt','sensor-left','sensor-top','sensor-right'];
const node=n=>scene.scene.getObjectByName(n),capture=()=>Object.fromEntries(names.map(n=>[n,node(n).position.clone()]));
scene.update();const joined=capture(),camera=scene.camera.position.clone();now+=500;scene.update();assert(node('gear-a').userData.rotor.rotation.z>0,'initial works mode must actually run');
scene.setMode('components');const current=capture(),rotor=node('gear-a').userData.rotor.rotation.z;scene.update();assert(node('motor').position.equals(current.motor),'no first-frame teleport');
now+=1250;scene.update();assert(node('motor').position.x<joined.motor.x&&node('motor').position.x>-5.1,'halfway separated');assert.equal(node('gear-a').userData.rotor.rotation.z,rotor,'gear stops immediately on dismantling');
now+=1250;scene.update();const exploded=capture();assert(exploded.motor.x<-5);assert(exploded.belt.y>2.7);assert(exploded['beam-a'].z<-3.5);assert(exploded['beam-b'].z>3.3);assert(exploded['sensor-left'].x>4.8);
for(const name of names)assert(exploded[name].distanceTo(joined[name])>.1,name+' actually separates');
// Whole sensor remains a coherent component, not three randomly scattered sticks.
assert(Math.abs(exploded['sensor-top'].y-exploded['sensor-left'].y-1.2)<1e-8);
scene.scene.updateMatrixWorld(true);scene.camera.updateMatrixWorld();
for(const name of names){const box=new THREE.Box3().setFromObject(node(name));for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).project(scene.camera);assert(Math.abs(p.x)<1&&Math.abs(p.y)<1,name+' stays in default exploded view');}}
scene.setMode('works');scene.update();assert(node('belt').position.equals(exploded.belt));assert.equal(host.dataset.automationPhase,'assembling');
now+=2499;scene.update();assert.equal(node('gear-a').userData.rotor.rotation.z,rotor,'no rotation before final millisecond');assert.equal(host.dataset.automationPhase,'assembling');
now+=1;scene.update();for(const name of names)assert(node(name).position.distanceTo(joined[name])<1e-8,name+' reassembles exactly');assert.equal(host.dataset.automationPhase,'running');
const parcel=node('parcel-0').position.x;now+=500;scene.update();assert(node('parcel-0').position.x>parcel,'parcel starts moving only after assembly');assert(node('gear-a').userData.rotor.rotation.z>rotor);
scene.setMode('components');now+=700;scene.update();const interrupted=node('belt').position.clone();scene.setMode('works');scene.update();assert(node('belt').position.equals(interrupted),'rapid reversal keeps current pose');now+=2500;scene.update();assert(node('belt').position.distanceTo(joined.belt)<1e-8);assert(scene.camera.position.equals(camera));
reduced=true;const still=ctx.createAutomationLab(host);still.setMode('components');still.update();still.setMode('works');still.update();const gear=still.scene.getObjectByName('gear-a').userData.rotor.rotation.z;now+=5000;still.update();assert.equal(still.scene.getObjectByName('gear-a').userData.rotor.rotation.z,gear,'reduced motion does not spin');
for(const surface of ['teacher','audience'])assert.equal(await read(`dist/${surface}/module-3d.js`),source);
console.log('Automation actual multi-axis explosion, continuous 2.5s assembly, motion gate, framing, interruption and camera PASS');
