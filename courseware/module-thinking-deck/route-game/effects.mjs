import * as THREE from '../vendor/three.module.min.js';
import {GLASS_FINISH,terrainHeight} from '../workshop/physics.mjs';
// Billboard icons are shared by the route game and workshop; no external assets.
export function createWorldItem(item){
 const group=new THREE.Group();group.name=item.name;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const ctx=canvas.getContext('2d');
 ctx.font='216px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(item.icon,128,136);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const icon=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
 icon.name=item.id+'-icon';icon.position.y=.15;icon.scale.set(.85,.85,1);group.add(icon);
 return group;
}
// Render authoritative Rapier snapshots only: viewers never simulate rubble.
export class RouteEffects {
 constructor(view,{flame=true}={}){
  this.glass=new Map();this.view=view;
  for(let row=0;row<GLASS_FINISH.rows;row++)for(let col=0;col<GLASS_FINISH.columns;col++){
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(GLASS_FINISH.edge,GLASS_FINISH.edge,GLASS_FINISH.edge),new THREE.MeshStandardMaterial({color:0x8ad9ed,transparent:true,opacity:.48,roughness:.12,metalness:.08,depthWrite:false}));
   const edges=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:0xc6f9ff}));mesh.add(edges);mesh.position.set(GLASS_FINISH.x,terrainHeight(GLASS_FINISH.x)+.2+GLASS_FINISH.edge*(row+.5)+.006*row,(col-2)*GLASS_FINISH.edge);view.land.add(mesh);this.glass.set(`glass-${row}-${col}`,mesh);
  }
  const plinth=new THREE.Mesh(new THREE.BoxGeometry(1.1,.2,3.1),new THREE.MeshStandardMaterial({color:0x8fbfc6}));plinth.position.set(GLASS_FINISH.x,terrainHeight(GLASS_FINISH.x)+.1,0);view.land.add(plinth);
  if(!flame)return;
  this.flame=new THREE.Group();this.flame.name='喷射火焰';view.instanceGroups.get('engine').add(this.flame);
  for(const [radius,length,color] of [[.28,1.8,0xff6b16],[.15,1.2,0xffe98a]]){
   const cone=new THREE.Mesh(new THREE.ConeGeometry(radius,length,9),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending}));
   cone.rotation.z=-Math.PI/2;cone.position.x=.59+length/2;this.flame.add(cone);
  }
  this.flame.visible=false;
 }
 update(snapshot){
  for(const pose of snapshot?.glass||[]){const mesh=this.glass.get(pose.id);if(mesh){mesh.position.copy(pose.p);mesh.quaternion.copy(pose.q);}}
  if(!this.flame)return;
  this.flame.visible=Boolean(snapshot?.thrust);
  const level=snapshot?.thrustLevel||3,pulse=.9+.12*Math.sin((snapshot?.time||0)*47),size=.45+level*.25;this.flame.scale.set(pulse*size,Math.sqrt(size)/pulse,Math.sqrt(size)/pulse);
 }
}
