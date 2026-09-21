// Rapier owns motion. Three.js only renders snapshots; no path-following animation.
import RAPIER from './vendor/rapier.mjs';
import {assemblyIssues,validateProject} from './model.mjs';
export const SOCKET_POSITIONS = Object.freeze({'wheel-fl':[1,-.35,-.92],'wheel-fr':[1,-.35,.92],'wheel-rl':[-1,-.35,-.92],'wheel-rr':[-1,-.35,.92],engine:[-1.15,.5,0]});
export const STEP=1/120;
export function terrainHeight(x){if(x<6)return 0;if(x<14)return (x-6)*.15;if(x<24)return 1.2+Math.sin((x-14)*Math.PI/5)*.35;if(x<26)return 1.2;if(x<26.5)return 1.2-(x-26)*4;return -.8;}
export function terrainMesh(){const vertices=[],indices=[];for(let i=0;i<=320;i++){const x=-15+i*.25;vertices.push(x,terrainHeight(x),-7,x,terrainHeight(x),7);if(i<320){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};}
let ready;
export async function initPhysics(){ready??=RAPIER.init();await ready;}
const vec=a=>({x:a[0],y:a[1],z:a[2]});
function rotateX(q){return {x:1-2*(q.y*q.y+q.z*q.z),y:2*(q.x*q.y+q.w*q.z),z:2*(q.x*q.z-q.w*q.y)};}
export class DriveWorld {
 constructor(project){this.project=validateProject(project);const issues=assemblyIssues(project);if(issues.length)throw Error(issues.join('；'));this.reset();}
 reset(){this.world?.free();this.world=new RAPIER.World({x:0,y:-9.81,z:0});this.world.timestep=STEP;this.world.numSolverIterations=8;this.time=0;this.accumulator=0;this.steps=0;
  const terrain=terrainMesh();this.world.createCollider(RAPIER.ColliderDesc.trimesh(terrain.vertices,terrain.indices).setFriction(1.4));
  this.body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,2,0).setLinearDamping(.035).setAngularDamping(.1).setCcdEnabled(true));
  this.world.createCollider(RAPIER.ColliderDesc.cuboid(1.5,.2,.6).setMass(8).setFriction(.6),this.body);
  this.wheels=[];
  for(const instance of this.project.instances){if(instance.socket==='engine'){this.engine=instance;continue;}const pos=SOCKET_POSITIONS[instance.socket];
   const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos[0],2+pos[1],pos[2]).setCcdEnabled(true));
   this.world.createCollider(RAPIER.ColliderDesc.cylinder(.2,.6).setRotation({x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2}).setMass(1).setFriction(1.6).setRestitution(.03),body);
   const joint=this.world.createImpulseJoint(RAPIER.JointData.revolute(vec(pos),{x:0,y:0,z:0},{x:0,y:0,z:1}),this.body,body,true);joint.setContactsEnabled(false);this.wheels.push({id:instance.id,body});
  }
 }
 advance(delta,{thrust=false,brake=false}={}){this.accumulator+=Math.max(0,Math.min(.1,Number.isFinite(delta)?delta:0));let count=0;
  while(this.accumulator>=STEP&&count<12){this.body.resetForces(true);const velocity=this.body.linvel();
   if(thrust){const direction=rotateX(this.body.rotation()),sign=this.engine.rotation===180?-1:1;this.body.addForce({x:direction.x*60*sign,y:direction.y*60*sign,z:direction.z*60*sign},true);}
   if(brake){this.body.addForce({x:-velocity.x*22,y:0,z:-velocity.z*22},true);for(const w of this.wheels){w.body.resetTorques(true);const av=w.body.angvel();w.body.addTorque({x:-av.x*1.3,y:-av.y*1.3,z:-av.z*1.3},true);}}
   else for(const w of this.wheels)w.body.resetTorques(true);
   this.world.step();this.time+=STEP;this.steps++;this.accumulator-=STEP;count++;
  }return this.snapshot();
 }
 snapshot(){const pose=b=>({p:{...b.translation()},q:{...b.rotation()}});const v=this.body.linvel();return {time:this.time,steps:this.steps,chassis:pose(this.body),wheels:this.wheels.map(w=>({id:w.id,...pose(w.body)})),velocity:{...v},speed:Math.hypot(v.x,v.z),outOfBounds:this.body.translation().y < -15 || Math.abs(this.body.translation().x)>60};}
 pause(){this.accumulator=0;this.body.resetForces(true);}
 dispose(){this.world.free();}
}
