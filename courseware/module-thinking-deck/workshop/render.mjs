import {wheelPlane,mountPosition,mountNormal,chassisParts,chassisSize} from './model.mjs?v=mc-fa48bdc938a3';
import * as THREE from '../vendor/three.module.min.js';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {CRASH_BLOCKS,TERRAIN_HALF_WIDTH,SIDE_BLOCKS,terrainMesh,terrainHeight} from './physics.mjs?v=mc-fa48bdc938a3';
const colors={rubber:0x35465a,metal:0x91b7c6,fuel:0xf6bc41};
export class WorkshopView {
 constructor(host,onBlock,onAssembly,options={}){this.options=options;this.host=host;this.onBlock=onBlock;this.onAssembly=onAssembly;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#d8eced');this.camera=new THREE.PerspectiveCamera(45,1,.1,240);this.camera.position.set(8,7,10);this.renderer=new THREE.WebGLRenderer({antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));host.append(this.renderer.domElement);this.renderer.domElement.addEventListener("webglcontextlost",e=>{e.preventDefault();dispatchEvent(new Event("msv-workshop-render-failed"));});this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,1,0);this.controls.enableDamping=true;this.controls.minDistance=3;this.controls.maxDistance=65;
  this.scene.add(new THREE.HemisphereLight(0xffffff,0x657f65,2.5));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(4,12,6);this.scene.add(sun);
  // Nine one-unit cells: grid lines at half integers, block centers at integers.
  this.grid=new THREE.GridHelper(9,9,0x345861,0x7b9a97);this.grid.position.y=.012;this.scene.add(this.grid);this.floor=this.box([9,.06,9],0xe8dfc4);this.floor.position.y=-.035;this.scene.add(this.floor);this.blocks=new THREE.Group();this.car=new THREE.Group();this.land=new THREE.Group();this.scene.add(this.blocks,this.car,this.land);this.makeTerrain();this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.currentMode='build';this.follow=false;this.lastTarget=null;this.editable=false;this.material='rubber';this.gestures=new Map();this.hover=null;
  this.ghost=this.box([.94,.94,.94],colors.rubber);this.ghost.material.transparent=true;this.ghost.material.opacity=.42;this.ghost.material.depthWrite=false;this.ghost.visible=false;this.scene.add(this.ghost);this.highlight(this.ghost);this.moduleGhost=new THREE.Group();this.moduleGhost.visible=false;this.scene.add(this.moduleGhost);this.bindGestures();
  this.resize=new ResizeObserver(()=>{const {width,height}=host.getBoundingClientRect();if(width&&height){this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}});this.resize.observe(host);
 }
 highlight(cube){cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry),new THREE.LineBasicMaterial({color:0xf4c84b})));}
 box(size,color){return new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:.8}));}
 clear(group){for(const child of [...group.children]){child.traverse(n=>{n.geometry?.dispose();if(n.material)n.material.dispose();});group.remove(child);}}
 makeTerrain(){for(const side of [-1,1]){const base=this.box([1.3,.2,3.6],0x647b80);base.position.set(9.3,terrainHeight(9.3)+.1,side*12);this.land.add(base);}this.obstacleMeshes=new Map();for(const spec of SIDE_BLOCKS){const mesh=this.box([spec.edge,spec.edge,spec.edge],spec.material==='wood'?0xb77c43:0x81939f);mesh.position.fromArray(spec.position);this.land.add(mesh);this.obstacleMeshes.set(spec.id,mesh);}const {vertices,indices}=terrainMesh(),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x7cba64,roughness:1,side:THREE.DoubleSide}));this.land.add(mesh);
  this.crashMeshes=new Map();if(!this.options.hideCrashWall){const base=this.box([1.1,.2,3.8],0x647b80);base.position.set(11,terrainHeight(11)+.1,0);this.land.add(base);for(const spec of CRASH_BLOCKS){const wall=this.box([spec.edge*.99,spec.edge*.99,spec.edge*.99],0xdf7849);wall.position.fromArray(spec.position);this.land.add(wall);this.crashMeshes.set(spec.id,wall);}}
  // Original voxel scenery: no Minecraft textures, trademarks or external assets.
  for(let x=-8;x<=48;x+=2){for(const z of [-TERRAIN_HALF_WIDTH+.3,TERRAIN_HALF_WIDTH-.3]){const h=terrainHeight(x),soil=this.box([1.96,2,1],0x967550);soil.position.set(x,h-1,z);this.land.add(soil);const grass=this.box([1.96,.16,1],0x75a855);grass.position.set(x,h-.02,z);this.land.add(grass);}}
  for(const x of [-5,8,19,33,45]){const h=terrainHeight(x),z=-TERRAIN_HALF_WIDTH+.5,trunk=this.box([.45,1.8,.45],0x886443);trunk.position.set(x,h+.9,z);this.land.add(trunk);const leaves=this.box([1.6,1.5,1.6],0x438856);leaves.position.set(x,h+2.3,z);this.land.add(leaves);}
  for(const [x,labelColor]of [[6,0xf3cf57],[14,0x4080d8],[26,0xef7657],[35,0x53a68d]]){const marker=this.box([.15,3,.15],labelColor);marker.position.set(x,1.2,-5);this.land.add(marker);}this.land.visible=false;}
 // Build and camera are simultaneous: only a short click edits; drags orbit/pan.
 setEditable(value){this.editable=value;if(!value){this.ghost.visible=false;this.moduleGhost.visible=false;}}
 setMaterial(value){this.material=value;this.ghost.material.color.setHex(colors[value]??colors.rubber);}
 screenPoint(x,y,z){this.camera.updateMatrixWorld();const point=new THREE.Vector3(x,y,z).project(this.camera),r=this.renderer.domElement.getBoundingClientRect();return {x:r.left+(point.x+1)*r.width/2,y:r.top+(1-point.y)*r.height/2};}
 setAssemblyDefinition(id,moving=false){this.assemblyDefinition=id;this.moving=moving;}
 pickAssembly(x,y,action='place'){
  if(!this.editable||this.currentMode!=='assemble')return null;
  const r=this.renderer.domElement.getBoundingClientRect();if(x<r.left||x>r.right||y<r.top||y>r.bottom)return null;
  this.pointer.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);this.camera.updateMatrixWorld();this.car.updateMatrixWorld(true);this.ray.setFromCamera(this.pointer,this.camera);
  if(action!=='place'){
   const hit=this.ray.intersectObjects([...this.instanceGroups.values()],true)[0];if(!hit)return null;
   let obj=hit.object;while(obj&&!obj.userData.instance)obj=obj.parent;return obj?{id:obj.userData.instance.id}:null;
  }
  const hit=this.ray.intersectObjects(this.chassisMeshes,false)[0],d=this.project.definitions.find(d=>d.id===this.assemblyDefinition);if(!hit||!d)return null;
  const point=hit.object.worldToLocal(hit.point.clone()),n=hit.face.normal,normal=[n.x,n.y,n.z].map(Math.round),axis=normal.findIndex(v=>v!==0),part=hit.object.userData.chassisPart,half=part.size.map(v=>v/2),size=d.behavior==='chassis'?chassisSize(d):null;
  const position=[point.x,point.y,point.z].map((v,i)=>part.position[i]+(i===axis?normal[i]*(half[i]+(size?size[i]/2:d.behavior==='thruster'?(axis===0?.62:.24):.24)):Math.max(-half[i],Math.min(half[i],Math.round(v*5)/5))));
  return {position,normal,definitionId:d.id};
 }
 moduleGroup(d,instance,selected=false){
  const g=new THREE.Group(),min={},max={};for(const axis of ['x','y','z']){min[axis]=Math.min(...d.blocks.map(b=>b[axis]));max[axis]=Math.max(...d.blocks.map(b=>b[axis]));}
  const orient=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3().fromArray(mountNormal(instance)));
  for(const b of d.blocks){const cube=this.box([.38,.38,.38],colors[b.material]);if(selected)this.highlight(cube);const c={x:b.x-(min.x+max.x)/2,y:b.y-(min.y+max.y)/2,z:b.z-(min.z+max.z)/2},plane=d.behavior==='wheel'?wheelPlane(d.blocks):null;
   cube.position.set((plane==='x'?c.z:c.x)*.4,(plane==='y'?c.z:c.y)*.4,(plane==='x'?c.x:plane==='y'?c.y:c.z)*.4);
   if(d.behavior==='wheel'){cube.position.applyQuaternion(orient);cube.quaternion.copy(orient);}g.add(cube);
  }return g;
 }
 pick(x,y,action='place'){
  if(this.currentMode==='assemble')return this.pickAssembly(x,y,action);
  if(!this.editable||this.currentMode!=='build')return null;
  const r=this.renderer.domElement.getBoundingClientRect();if(x<r.left||x>r.right||y<r.top||y>r.bottom)return null;
  this.pointer.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);this.camera.updateMatrixWorld();this.blocks.updateMatrixWorld(true);this.ray.setFromCamera(this.pointer,this.camera);
  const hit=this.ray.intersectObjects(this.blocks.children,false)[0];let c;
  if(hit){c={...hit.object.userData.block};if(action==='place'){c.x+=Math.round(hit.face.normal.x);c.y+=Math.round(hit.face.normal.y);c.z+=Math.round(hit.face.normal.z);}}
  else if(action==='place'){const point=new THREE.Vector3();if(this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),point))c={x:Math.floor(point.x+.5),y:0,z:Math.floor(point.z+.5)};}
  if(!c||c.x< -4||c.x>4||c.z< -4||c.z>4||c.y<0||c.y>4)return null;
  if(action==='place'&&this.project?.blocks.some(b=>b.x===c.x&&b.y===c.y&&b.z===c.z))return null;
  return {x:c.x,y:c.y,z:c.z};
 }
 updateGhost(){
  const dragging=[...this.gestures.values()].some(g=>g.moved||g.cancelled||g.consumed),c=!dragging&&this.hover?this.pick(this.hover.x,this.hover.y):null;
  this.ghost.visible=this.currentMode==='build'&&Boolean(c);this.ghostCell=c;
  if(this.currentMode==='assemble'){
   this.moduleGhost.visible=Boolean(c);if(c){const key=JSON.stringify(c);if(key!==this.lastGhost){this.clear(this.moduleGhost);const d=this.project.definitions.find(d=>d.id===c.definitionId),g=this.moduleGroup(d,{normal:c.normal});g.traverse(n=>{if(n.material){n.material.transparent=true;n.material.opacity=.45;n.material.depthWrite=false;}});this.moduleGhost.add(g);this.lastGhost=key;}this.moduleGhost.position.fromArray(c.position);this.moduleGhost.position.add(this.chassis.position);}
  }else this.moduleGhost.visible=false;
  if(this.ghost.visible)this.ghost.position.set(c.x,c.y+.5,c.z);
 }
 dispatchEdit(c,action){if(this.currentMode==='assemble')this.onAssembly?.(c,action);else this.onBlock(c,action);}

 bindGestures(){const canvas=this.renderer.domElement;
  const cancel=()=>{for(const g of this.gestures.values())clearTimeout(g.timer);this.gestures.clear();this.hover=null;this.ghost.visible=false;this.moduleGhost.visible=false;};
  canvas.addEventListener('pointerdown',e=>{
   if(![0,2].includes(e.button))return;
   const g={x:e.clientX,y:e.clientY,button:e.button,moved:false,cancelled:false,consumed:false,shift:e.shiftKey};this.gestures.set(e.pointerId,g);this.hover={x:e.clientX,y:e.clientY};
   if(this.gestures.size>1){for(const item of this.gestures.values()){item.cancelled=true;clearTimeout(item.timer);}}
   if(e.pointerType==='touch'&&this.gestures.size===1)g.timer=setTimeout(()=>{if(g.cancelled||g.moved)return;g.consumed=true;const c=this.pick(g.x,g.y,'select');if(c)this.dispatchEdit(c,'select');this.ghost.visible=false;},550);
   this.updateGhost();
  });
  canvas.addEventListener('pointermove',e=>{this.hover={x:e.clientX,y:e.clientY};const g=this.gestures.get(e.pointerId);if(g&&Math.hypot(e.clientX-g.x,e.clientY-g.y)>6){g.moved=true;clearTimeout(g.timer);}this.updateGhost();});
  canvas.addEventListener('pointerup',e=>{const g=this.gestures.get(e.pointerId);if(!g)return;clearTimeout(g.timer);this.gestures.delete(e.pointerId);const outsideDistance=Math.hypot(e.clientX-g.x,e.clientY-g.y)>6;
   if(!g.cancelled&&!g.moved&&!g.consumed&&!outsideDistance&&this.gestures.size===0){const action=g.button===2?'erase':g.shift?'select':'place',c=this.pick(e.clientX,e.clientY,action);if(c)this.dispatchEdit(c,action);}
   this.hover=null;this.ghost.visible=false;
  });
  canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',e=>{const g=this.gestures.get(e.pointerId);if(g){clearTimeout(g.timer);this.gestures.delete(e.pointerId);}this.ghost.visible=false;});
  canvas.addEventListener('pointerleave',()=>{this.hover=null;this.ghost.visible=false;});canvas.addEventListener('contextmenu',e=>e.preventDefault());addEventListener('blur',cancel);
 }
 setProject(project,mode,selectedBlocks=new Set(),selectedInstance=''){this.project=project;this.currentMode=mode;this.blocks.visible=mode==='build';this.car.visible=mode!=='build';this.grid.visible=mode==='build';this.floor.visible=mode==='build';if(mode!=='build'){this.hover=null;this.ghost.visible=false;}this.land.visible=mode!=='build';this.controls.enabled=true;this.clear(this.blocks);this.clear(this.car);this.instanceGroups=new Map();this.driveFlames=[];
  for(const b of project.blocks){const cube=this.box([.94,.94,.94],colors[b.material]);if(selectedBlocks.has(`${b.x},${b.y},${b.z}`))this.highlight(cube);cube.position.set(b.x,b.y+.5,b.z);cube.userData.block=b;this.blocks.add(cube);}
  this.chassis=new THREE.Group();this.chassisMeshes=[];this.car.add(this.chassis);this.chassis.position.y=2;
  for(const part of chassisParts(project)){const mesh=this.box(part.size,part.id==='base'?0x2c609a:colors.metal);mesh.position.fromArray(part.position);mesh.userData.chassisPart=part;this.chassis.add(mesh);this.chassisMeshes.push(mesh);if(part.id==='base')this.chassisMesh=mesh;else{mesh.userData.instance=project.instances.find(i=>i.id===part.id);this.instanceGroups.set(part.id,mesh);if(part.id===selectedInstance)this.highlight(mesh);}}
  for(const i of project.instances){
   const d=project.definitions.find(d=>d.id===i.definitionId);if(d.behavior==='chassis')continue;const g=this.moduleGroup(d,i,i.id===selectedInstance),pos=mountPosition(i);
   g.userData.instance=i;this.instanceGroups.set(i.id,g);
   if(d.behavior==='thruster'){if(!this.options.hideCrashWall){const flame=new THREE.Group();for(const [radius,length,color]of [[.28,1.8,0xff6b16],[.15,1.2,0xffe98a]]){const cone=new THREE.Mesh(new THREE.ConeGeometry(radius,length,9),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending}));cone.rotation.z=-Math.PI/2;cone.position.x=.59+length/2;flame.add(cone);}flame.visible=false;g.add(flame);this.driveFlames.push(flame);}this.chassis.add(g);g.position.fromArray(pos);g.rotation.y=i.rotation*Math.PI/180;
    for(const [sign,color,lift]of [[i.rotation===180?-1:1,0xef7657,0],[i.rotation===180?1:-1,0x218267,.6]])this.chassis.add(new THREE.ArrowHelper(new THREE.Vector3(sign,0,0),new THREE.Vector3(pos[0],pos[1]+lift,pos[2]),1.6,color,.3,.2));
   }else{this.car.add(g);g.position.fromArray(pos);g.position.y+=2;}
  }

 }
 pose(snapshot){if(!snapshot)return;for(const flame of this.driveFlames){flame.visible=Boolean(snapshot.thrust);const size=.45+(snapshot.thrustLevel||3)*.25,pulse=.9+.12*Math.sin((snapshot.time||0)*47);flame.scale.set(size*pulse,Math.sqrt(size)/pulse,Math.sqrt(size)/pulse);}for(const pose of snapshot.crash||[]){const mesh=this.crashMeshes.get(pose.id);if(mesh){mesh.position.copy(pose.p);mesh.quaternion.copy(pose.q);}}for(const pose of snapshot.obstacles||[]){const mesh=this.obstacleMeshes.get(pose.id);if(mesh){mesh.position.copy(pose.p);mesh.quaternion.copy(pose.q);}}this.chassis.position.copy(snapshot.chassis.p);this.chassis.quaternion.copy(snapshot.chassis.q);for(const w of snapshot.wheels){const g=this.instanceGroups.get(w.id);if(g){g.position.copy(w.p);g.quaternion.copy(w.q);}}if(this.follow){const target=new THREE.Vector3().copy(snapshot.chassis.p);if(this.lastTarget)this.camera.position.add(target.clone().sub(this.lastTarget));this.controls.target.copy(target);this.lastTarget=target;}}
 home(){const target=this.currentMode==='build'?new THREE.Vector3(0,1,0):this.chassis.position.clone();this.camera.position.copy(target).add(new THREE.Vector3(6,4.5,7));this.controls.target.copy(target);this.lastTarget=target;this.controls.update();}
 render(){this.controls.update();this.updateGhost();this.renderer.render(this.scene,this.camera);}
}
