// Rapier owns motion. Three.js only renders snapshots; no path-following animation.
import RAPIER from './vendor/rapier.mjs';
import {chassisParts,validateProject,LEGACY_MOUNTS,mountPosition,mountNormal} from './model.mjs?v=mc-fa48bdc938a3';
export const SOCKET_POSITIONS = LEGACY_MOUNTS;
export const CRASH_WALL=Object.freeze({position:Object.freeze([11,2.2,0]),halfExtents:Object.freeze([.3,1.6,2])});
export const GLASS_FINISH=Object.freeze({x:9.3,edge:.56,columns:5,rows:4});
export function differentialTargets({forward=false,reverse=false,steer=0}={}){const drive=forward===reverse?0:forward?2.8:-2.2,turn=Math.max(-1,Math.min(1,Number.isFinite(steer)?steer:0))*1.8;return {left:drive-turn,right:drive+turn};}
export const TERRAIN_HALF_WIDTH=21;
export const normalizeThrustLevel=value=>Number.isFinite(Number(value))?Math.max(1,Math.min(5,Math.round(Number(value)))):3;
export const SIDE_BLOCKS=Object.freeze([-1,1].flatMap(side=>Array.from({length:16},(_,i)=>{const row=Math.floor(i/4),col=i%4;return Object.freeze({id:`side-${side<0?'wood':'stone'}-${row}-${col}`,material:side<0?'wood':'stone',edge:.8,mass:side<0?.45:.9,position:Object.freeze([9.3,terrainHeight(9.3)+.2+.4+row*.806,side*12+(col-1.5)*.8])});})));
export const CRASH_BLOCKS=Object.freeze(Array.from({length:20},(_,i)=>{const row=Math.floor(i/5),col=i%5;return Object.freeze({id:`crash-${row}-${col}`,edge:.7,position:Object.freeze([11,terrainHeight(11)+.2+.35+row*.706,(col-2)*.7])});}));
export const STEP=1/120;
export function terrainHeight(x){if(x<6)return 0;if(x<14)return (x-6)*.15;if(x<24)return 1.2+Math.sin((x-14)*Math.PI/5)*.35;if(x<26)return 1.2;if(x<26.5)return 1.2-(x-26)*4;return -.8;}
export function terrainMesh(){const vertices=[],indices=[];for(let i=0;i<=320;i++){const x=-15+i*.25;vertices.push(x,terrainHeight(x),-TERRAIN_HALF_WIDTH,x,terrainHeight(x),TERRAIN_HALF_WIDTH);if(i<320){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};}
let ready;
export async function initPhysics(){ready??=RAPIER.init();await ready;}
const vec=a=>({x:a[0],y:a[1],z:a[2]});
function cylinderOrientation(n){if(n[1]===1)return {x:0,y:0,z:0,w:1};if(n[1]===-1)return {x:1,y:0,z:0,w:0};return {x:n[2]*Math.SQRT1_2,y:0,z:-n[0]*Math.SQRT1_2,w:Math.SQRT1_2};}
function rotateX(q){return {x:1-2*(q.y*q.y+q.z*q.z),y:2*(q.x*q.y+q.w*q.z),z:2*(q.x*q.z-q.w*q.y)};}
export class DriveWorld {
 constructor(project,options={}){this.options=options;this.project=validateProject(project);this.reset();}
 reset(){this.world?.free();this.world=new RAPIER.World({x:0,y:-9.81,z:0});this.world.timestep=STEP;this.world.numSolverIterations=8;this.time=0;this.accumulator=0;this.steps=0;
  const terrain=terrainMesh();this.world.createCollider(RAPIER.ColliderDesc.trimesh(terrain.vertices,terrain.indices).setFriction(1.4));
  this.crash=[];
  if(!this.options.glassFinish||this.options.breakableWall){
   this.world.createCollider(RAPIER.ColliderDesc.cuboid(.55,.1,1.9).setTranslation(11,terrainHeight(11)+.1,0).setFriction(.9));
   this.crash=CRASH_BLOCKS.map(spec=>{const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...spec.position).setCcdEnabled(true));this.world.createCollider(RAPIER.ColliderDesc.cuboid(spec.edge/2,spec.edge/2,spec.edge/2).setMass(.35).setFriction(.65).setRestitution(.08),body);return {id:spec.id,body};});
  }
  for(const side of [-1,1])this.world.createCollider(RAPIER.ColliderDesc.cuboid(.65,.1,1.8).setTranslation(9.3,terrainHeight(9.3)+.1,side*12).setFriction(.9));
  this.obstacles=SIDE_BLOCKS.map(spec=>{const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...spec.position).setCcdEnabled(true));this.world.createCollider(RAPIER.ColliderDesc.cuboid(spec.edge/2,spec.edge/2,spec.edge/2).setMass(spec.mass).setFriction(.7).setRestitution(.08),body);return {id:spec.id,body};});
  this.glass=[];this.thrusting=false;this.thrustLevel=3;this.driveTargets={left:0,right:0};
  if(this.options.glassFinish){const {x,edge,columns,rows}=GLASS_FINISH;this.world.createCollider(RAPIER.ColliderDesc.cuboid(.55,.1,1.55).setTranslation(x,terrainHeight(x)+.1,0).setFriction(.9));for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,terrainHeight(x)+.2+edge*(row+.5)+.006*row,(col-(columns-1)/2)*edge).setCcdEnabled(true));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(edge/2,edge/2,edge/2).setMass(.22).setFriction(.65).setRestitution(.08),body);this.glass.push({id:`glass-${row}-${col}`,body});
  }}
  this.body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,2,0).setLinearDamping(.035).setAngularDamping(.1).setCcdEnabled(true));
  for(const part of chassisParts(this.project))this.world.createCollider(RAPIER.ColliderDesc.cuboid(...part.size.map(n=>n/2)).setTranslation(...part.position).setMass(part.id==='base'?8:Math.max(.5,part.size.reduce((a,b)=>a*b,1)*4)).setFriction(.6),this.body);
  this.wheels=[];this.engines=[];
  for(const instance of this.project.instances){const behavior=this.project.definitions.find(d=>d.id===instance.definitionId).behavior;if(behavior==='chassis')continue;if(behavior==='thruster'){this.engines.push(instance);continue;}const pos=mountPosition(instance),normal=mountNormal(instance);
   const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos[0],2+pos[1],pos[2]).setCcdEnabled(true));
   this.world.createCollider(RAPIER.ColliderDesc.cylinder(.2,.6).setRotation(cylinderOrientation(normal)).setMass(1).setFriction(this.options.differential?.5:1.6).setFrictionCombineRule(this.options.differential?RAPIER.CoefficientCombineRule.Min:RAPIER.CoefficientCombineRule.Average).setRestitution(.03),body);
   const joint=this.world.createImpulseJoint(RAPIER.JointData.revolute(vec(pos),{x:0,y:0,z:0},vec(normal)),this.body,body,true);joint.setContactsEnabled(false);this.wheels.push({id:instance.id,body,joint,side:pos[2]<0?'left':'right',axisSign:normal[2]||1});
  }
 }
 advance(delta,{forward=false,thrust=false,reverse=false,brake=false,steer=0,thrustLevel=3}={}){this.thrusting=thrust&&this.engines.length>0;this.thrustLevel=normalizeThrustLevel(thrustLevel);this.driveTargets=differentialTargets({forward,reverse,steer});this.accumulator+=Math.max(0,Math.min(.1,Number.isFinite(delta)?delta:0));let count=0;
  while(this.accumulator>=STEP&&count<12){this.body.resetForces(true);this.body.resetTorques(true);const velocity=this.body.linvel();
   if(thrust)for(const engine of this.engines){const direction=rotateX(this.body.rotation()),sign=engine.rotation===180?1:-1;const power=(this.options.differential?40:20)*this.thrustLevel;const force={x:direction.x*power*sign,y:direction.y*power*sign,z:direction.z*power*sign};
    if(engine.position){const p=engine.position,q=this.body.rotation(),t=this.body.translation(),v={x:p[0],y:p[1],z:p[2]},u={x:2*(q.y*v.z-q.z*v.y),y:2*(q.z*v.x-q.x*v.z),z:2*(q.x*v.y-q.y*v.x)};
     this.body.addForceAtPoint(force,{x:t.x+v.x+q.w*u.x+q.y*u.z-q.z*u.y,y:t.y+v.y+q.w*u.y+q.z*u.x-q.x*u.z,z:t.z+v.z+q.w*u.z+q.x*u.y-q.y*u.x},true);
    }else this.body.addForce(force,true);}
   // Classroom steering assist applies yaw torque; this is not a steering-rack model.
   const turn=Number.isFinite(steer)?Math.max(-1,Math.min(1,steer)):0;
   if(turn&&this.wheels.length&&!this.options.differential)this.body.addTorque({x:0,y:turn*32,z:0},true);
   if(this.wheels.length&&(this.options.differential||forward||reverse)){
    // Rocket acceleration must not be clamped to the ordinary wheel-motor speed.
    const dir=rotateX(this.body.rotation()),along=velocity.x*dir.x+velocity.z*dir.z;
    for(const w of this.wheels){w.body.resetTorques(true);const target=thrust?along+(w.side==='left'?-turn:turn)*1.8:this.driveTargets[w.side];w.joint.configureMotorVelocity(-target/(.6*w.axisSign),thrust?(turn?60:0):300);}
    if(!forward&&!thrust&&!reverse&&!turn)this.body.addForce({x:-velocity.x*12,y:0,z:-velocity.z*12},true);
   }else if(brake){this.body.addForce({x:-velocity.x*22,y:0,z:-velocity.z*22},true);for(const w of this.wheels){w.body.resetTorques(true);const av=w.body.angvel();w.body.addTorque({x:-av.x*1.3,y:-av.y*1.3,z:-av.z*1.3},true);}}
   else for(const w of this.wheels)w.body.resetTorques(true);
   this.world.step();this.time+=STEP;this.steps++;this.accumulator-=STEP;count++;
  }return this.snapshot();
 }
 snapshot(){const pose=b=>({p:{...b.translation()},q:{...b.rotation()}});const v=this.body.linvel();return {time:this.time,steps:this.steps,chassis:pose(this.body),wheels:this.wheels.map(w=>({id:w.id,...pose(w.body)})),velocity:{...v},speed:Math.hypot(v.x,v.z),thrust:this.thrusting,thrustLevel:this.thrustLevel,obstacleLayout:2,obstacles:this.obstacles.map(g=>({id:g.id,...pose(g.body),v:{...g.body.linvel()},a:{...g.body.angvel()}})),driveTargets:{...this.driveTargets},crash:this.crash.map(g=>({id:g.id,...pose(g.body)})),glass:this.glass.map(g=>({id:g.id,...pose(g.body),v:{...g.body.linvel()},a:{...g.body.angvel()}})),outOfBounds:this.body.translation().y < -15 || Math.abs(this.body.translation().x)>60 || Math.abs(this.body.translation().z)>TERRAIN_HALF_WIDTH+3};}
 pause(){this.thrusting=false;this.accumulator=0;this.body.resetForces(true);this.body.resetTorques(true);}
 dispose(){this.world.free();}
}
