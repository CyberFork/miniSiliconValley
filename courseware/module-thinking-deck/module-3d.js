import {sampleBagComparison} from "./bag-compare.js";
import {ITEMS} from "./route-game/state.mjs";
import * as THREE from "./vendor/three.module.min.js";
import { createVoxelDesigns, VOXEL_EDGE } from "./voxel-designs.js";
import { MODULE_ASSEMBLY_LAYOUT, MODULE_ASSEMBLY_SIZE } from "./module-assembly-layout.js";
import { sampleTransformPhase, TRANSFORM_DURATION_MS } from "./transform-sequence.js";
import { OrbitControls } from "./vendor/OrbitControls.js";

const PALETTE = Object.freeze({
  navy: 0x10293f,
  blue: 0x2154d7,
  paleBlue: 0xbdd2ff,
  mint: 0x63d7b0,
  yellow: 0xf2c84b,
  orange: 0xef7657,
  cream: 0xfff8e7,
  ink: 0x152a36,
});

const liveScenes = new Set();

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.06, ...options });
}

function box(name, color, size = [1, 1, 1], transparent = false) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    material(color, transparent ? { transparent: true, opacity: 0.64, depthWrite: false } : {}),
  );
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(name, color, radius = 0.5, depth = 0.35) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 28), material(color));
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function gear(name, color, radius = 0.72, teeth = 12) {
  const group = new THREE.Group();
  group.name = name;
  const rotor = new THREE.Group();
  group.userData.rotor = rotor;
  group.add(rotor);
  const hub = cylinder(`${name}-hub`, color, radius * 0.64, 0.34);
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);
  for (let index = 0; index < teeth; index += 1) {
    const tooth = box(`${name}-tooth-${index}`, color, [radius * 0.35, radius * 0.22, 0.34]);
    const angle = (index / teeth) * Math.PI * 2;
    tooth.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    tooth.rotation.z = angle;
    rotor.add(tooth);
  }
  return group;
}

function setTransform(object, value, immediate = false) {
  const position = new THREE.Vector3(...value.position);
  const scale = new THREE.Vector3(...(value.scale || [1, 1, 1]));
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(value.rotation || [0, 0, 0])));
  object.userData.targetPosition = position;
  object.userData.targetScale = scale;
  object.userData.targetQuaternion = quaternion;
  if (immediate) {
    object.position.copy(position);
    object.scale.copy(scale);
    object.quaternion.copy(quaternion);
  }
}

function approachTarget(object, amount = 0.105) {
  if (!object.userData.targetPosition) return;
  object.position.lerp(object.userData.targetPosition, amount);
  object.scale.lerp(object.userData.targetScale, amount);
  object.quaternion.slerp(object.userData.targetQuaternion, amount);
}

function createCommonScene(host, cameraPosition = [8, 5.5, 10], cameraTarget = [0, 0.3, 0]) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
  camera.position.set(...cameraPosition);
  camera.lookAt(...cameraTarget);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = "module-3d-canvas";
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute("aria-label", "可旋转的三维模型。拖动上下左右旋转，滚轮缩放，Shift 加拖动平移。方向键旋转，加减号缩放，0 复位。");
  renderer.domElement.style.touchAction = "none";
  host.prepend(renderer.domElement);

  const ambient = new THREE.HemisphereLight(0xffffff, PALETTE.navy, 2.35);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(5, 8, 7);
  key.castShadow = true;
  scene.add(key);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 14), material(0xf1ead8, { roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.05;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(18, 18, PALETTE.blue, 0xc9c3b3);
  grid.position.y = -2.02;
  grid.material.opacity = 0.22;
  grid.material.transparent = true;
  scene.add(grid);

  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const cameraCleanup = addCameraControls(host, camera, renderer.domElement, cameraTarget);
  return { scene, camera, renderer, observer, cameraCleanup };
}

function addCameraControls(host, camera, canvas, target = [0, 0.3, 0]) {
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...target);
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.85;
  controls.minDistance = camera.position.distanceTo(controls.target) * 0.4;
  controls.maxDistance = camera.position.distanceTo(controls.target) * 2.5;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.maxTargetRadius = 6;
  controls.update();
  controls.saveState();
  // A read-only observation hook also supports deterministic gesture regression tests.
  const report = () => { host.dataset.cameraState = JSON.stringify({
    azimuth: controls.getAzimuthalAngle(), polar: controls.getPolarAngle(),
    distance: controls.getDistance(), target: controls.target.toArray(),
    minDistance: controls.minDistance, maxDistance: controls.maxDistance,
  }); };
  controls.addEventListener("change", report);
  report();
  const help = "拖动上下左右旋转；滚轮缩放；Shift＋拖动平移。触屏：单指旋转，双指缩放／平移。键盘：方向键、＋／−、0 复位。";
  canvas.title = help;
  const hint = host.querySelector(".module-3d-hint");
  if (hint) { hint.textContent = "上下左右拖动 · 滚轮／双指缩放"; hint.title = help; }
  const toolbar = document.createElement("div");
  toolbar.className = "module-3d-toolbar";
  toolbar.setAttribute("role", "group");
  toolbar.setAttribute("aria-label", "三维视角控制");
  const zoom = (factor) => {
    camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
    controls.update();
  };
  const act = (action) => {
    if (action === "reset") controls.reset();
    else zoom(action === "in" ? 0.8 : 1.25);
  };
  for (const [action, label, text] of [["in", "放大模型", "＋"], ["out", "缩小模型", "−"], ["reset", "复位视角", "复位"]]) {
    const button = document.createElement("button");
    button.type = "button"; button.dataset.cameraAction = action;
    button.textContent = text; button.setAttribute("aria-label", label); button.title = label;
    button.addEventListener("click", (event) => { event.stopPropagation(); act(action); });
    toolbar.append(button);
  }
  // Do not let the deck's page shortcuts consume native toolbar activation.
  const stopKeys = (event) => event.stopPropagation();
  toolbar.addEventListener("keydown", stopKeys);
  host.append(toolbar);
  const key = (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "_", "0"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === "0") { controls.reset(); return; }
    if (["+", "=", "-", "_"].includes(event.key)) { zoom(["+", "="].includes(event.key) ? 0.8 : 1.25); return; }
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if (event.key === "ArrowLeft") spherical.theta -= 0.15;
    if (event.key === "ArrowRight") spherical.theta += 0.15;
    if (event.key === "ArrowUp") spherical.phi -= 0.15;
    if (event.key === "ArrowDown") spherical.phi += 0.15;
    camera.position.setFromSpherical(spherical).add(controls.target);
    controls.update();
  };
  canvas.addEventListener("keydown", key);
  return () => {
    controls.removeEventListener("change", report);
    controls.dispose();
    canvas.removeEventListener("keydown", key);
    toolbar.removeEventListener("keydown", stopKeys);
    toolbar.remove();
    delete host.dataset.cameraState;
  };
}

function createTransformToy(host) {
  const common = createCommonScene(host, [8.8, 5.1, 10.8]);
  const root = new THREE.Group();
  common.scene.add(root);

  const pieces = {
    body: box("body", PALETTE.blue, [4.2, 1.3, 2.2]),
    wing: box("wing", PALETTE.paleBlue, [6.2, 0.28, 1.35]),
    glass: box("glass", PALETTE.mint, [1.8, 0.95, 1.65], true),
    joint: cylinder("joint", PALETTE.orange, 0.48, 0.8),
    wheelA: cylinder("wheel-a", PALETTE.yellow, 0.74, 0.62),
    wheelB: cylinder("wheel-b", PALETTE.yellow, 0.74, 0.62),
  };
  Object.values(pieces).forEach((piece) => root.add(piece));

  const targets = {
    car: {
      body: { position: [0, -0.3, 0] },
      wing: { position: [0.2, 0.25, 0], scale: [0.65, 1, 1] },
      glass: { position: [0.55, 0.75, 0], rotation: [0, 0, -0.18] },
      joint: { position: [-0.2, -0.1, 1.35], rotation: [Math.PI / 2, 0, 0] },
      wheelA: { position: [-1.35, -1.05, 1.25], rotation: [Math.PI / 2, 0, 0] },
      wheelB: { position: [1.35, -1.05, 1.25], rotation: [Math.PI / 2, 0, 0] },
    },
    plane: {
      body: { position: [0, -0.1, 0], scale: [0.56, 1.05, 1.7], rotation: [0, 0, Math.PI / 2] },
      wing: { position: [0, 0, 0], scale: [1, 1, 1.45] },
      glass: { position: [0, 1.15, 0.15], scale: [0.78, 0.85, 0.9] },
      joint: { position: [0, -0.2, 1.65], rotation: [Math.PI / 2, 0, 0] },
      wheelA: { position: [-1.05, -1.25, 0.5], scale: [0.7, 0.7, 0.7], rotation: [Math.PI / 2, 0, 0] },
      wheelB: { position: [1.05, -1.25, 0.5], scale: [0.7, 0.7, 0.7], rotation: [Math.PI / 2, 0, 0] },
    },
    robot: {
      body: { position: [0, 0.25, 0], scale: [0.64, 1.45, 0.84], rotation: [0, 0, 0] },
      wing: { position: [0, 0.65, -0.45], scale: [0.84, 1.1, 0.62], rotation: [0, 0, 0] },
      glass: { position: [0, 0.75, 1.05], scale: [0.72, 0.72, 0.36], rotation: [0, 0, 0] },
      joint: { position: [0, 2.15, 0], rotation: [0, 0, Math.PI / 2] },
      wheelA: { position: [-0.9, -1.6, 0.25], scale: [0.8, 0.8, 0.8], rotation: [Math.PI / 2, 0, 0] },
      wheelB: { position: [0.9, -1.6, 0.25], scale: [0.8, 0.8, 0.8], rotation: [Math.PI / 2, 0, 0] },
    },
  };

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const exploded={body:[0,0,0],wing:[0,3.6,-.4],glass:[0,2.2,3.1],joint:[0,-.4,3.9],wheelA:[-4,-.4,0],wheelB:[4,-.4,0]};
  const capture=piece=>({position:piece.position.clone(),scale:piece.scale.clone(),quaternion:piece.quaternion.clone()});
  const fromTarget=value=>({position:new THREE.Vector3(...value.position),scale:new THREE.Vector3(...(value.scale||[1,1,1])),quaternion:new THREE.Quaternion().setFromEuler(new THREE.Euler(...(value.rotation||[0,0,0])))});
  let selected=null,started=0,token='',origins={},spread={};
  const setMode = mode => {
    const next=targets[mode]?mode:'car';
    const requested=Number(host.getAttribute('data-transform-start'))||0;
    const nextToken=next+':'+requested;
    if(token===nextToken)return;
    const first=selected===null;
    if(first){const source=requested&&Date.now()-requested<TRANSFORM_DURATION_MS?(next==='plane'?'car':'plane'):next;for(const [name,piece] of Object.entries(pieces))setTransform(piece,targets[source][name],true);}
    origins=Object.fromEntries(Object.entries(pieces).map(([name,piece])=>[name,capture(piece)]));
    spread=Object.fromEntries(Object.entries(pieces).map(([name])=>[name,{...origins[name],position:new THREE.Vector3(...exploded[name])}]));
    started=requested||(!first?Date.now():0);selected=next;token=nextToken;
  };
  setMode(host.getAttribute('data-module-3d-mode')||'car');
  const update=()=>{
    const elapsed=started?Date.now()-started:TRANSFORM_DURATION_MS;
    const state=sampleTransformPhase(reducedMotion?TRANSFORM_DURATION_MS:elapsed);
    host.dataset.transformPhase=state.phase;host.dataset.transformDuration=String(TRANSFORM_DURATION_MS);
    for(const [name,piece] of Object.entries(pieces)){
      const end=fromTarget(targets[selected][name]);
      const a=state.phase==='explode'?origins[name]:spread[name];
      const b=state.phase==='explode'?spread[name]:end;
      piece.position.lerpVectors(a.position,b.position,state.progress);
      piece.scale.lerpVectors(a.scale,b.scale,state.progress);
      piece.quaternion.slerpQuaternions(a.quaternion,b.quaternion,state.progress);
    }
    // Keep the whole object and the user's camera stationary during the explanation.
    root.rotation.y=0;
  };

  return { ...common, setMode, update };
}

function createAutomationLab(host) {
  const common = createCommonScene(host, [10.5, 7.2, 12.5]);
  const root = new THREE.Group();
  common.scene.add(root);

  const pieces = {
    base: box("base", PALETTE.blue, [6.8, 0.45, 3.2]),
    motor: box("motor", PALETTE.yellow, [1.7, 1.5, 1.8]),
    beamA: box("beam-a", PALETTE.orange, [5.2, 0.35, 0.45]),
    beamB: box("beam-b", PALETTE.orange, [5.2, 0.35, 0.45]),
    gearA: gear("gear-a", PALETTE.yellow, 0.72, 12),
    gearB: gear("gear-b", PALETTE.mint, 1.02, 16),
    belt: box("belt", PALETTE.ink, [5.4, 0.18, 1.45]),
    sensorLeft: box("sensor-left", PALETTE.mint, [0.28, 2.5, 0.32], true),
    sensorTop: box("sensor-top", PALETTE.mint, [2.1, 0.28, 0.32], true),
    sensorRight: box("sensor-right", PALETTE.mint, [0.28, 2.5, 0.32], true),
  };
  Object.values(pieces).forEach((piece) => root.add(piece));
  const parcels = [-1.8, 0, 1.8].map((x, index) => {
    const parcel = box(`parcel-${index}`, [PALETTE.orange, PALETTE.yellow, PALETTE.paleBlue][index], [0.72, 0.72, 0.72]);
    parcel.userData.offset = x;
    root.add(parcel);
    return parcel;
  });

  const targets = {
    parts: {
      base: { position: [-2.4, -1.15, -0.8], scale: [0.45, 1, 0.75], rotation: [0, 0.15, 0] },
      motor: { position: [2.8, -0.4, -1.8], rotation: [0.1, -0.35, 0] },
      beamA: { position: [-2.8, 0.75, 0.9], scale: [0.55, 1, 1], rotation: [0, 0.4, 0.15] },
      beamB: { position: [2.2, 1.2, 1.1], scale: [0.52, 1, 1], rotation: [0, -0.3, -0.2] },
      gearA: { position: [-0.4, 0.25, 1.2], rotation: [0, 0.3, 0] },
      gearB: { position: [1.45, 0.1, 0.45], rotation: [0.2, -0.15, 0] },
      belt: { position: [0.2, -1.45, 1.1], scale: [0.42, 1, 0.8], rotation: [0, 0.2, 0] },
      sensorLeft: { position: [-3.2, 1.5, -0.8], rotation: [0.2, 0, 0.35] },
      sensorTop: { position: [0.1, 2.2, -1.2], rotation: [0.15, 0.2, 0] },
      sensorRight: { position: [3.3, 1.4, 0.4], rotation: [-0.15, 0, -0.3] },
    },
    components: {
      base: { position: [0, -1.6, 0] },
      motor: { position: [-5.1, .6, -1.8] },
      beamA: { position: [0, -.1, -3.6] },
      beamB: { position: [0, -.1, 3.4] },
      gearA: { position: [-1.05, 1.5, 4], rotation: [Math.PI / 2, 0, 0] },
      gearB: { position: [.65, 1.5, 4], rotation: [Math.PI / 2, 0, 0] },
      belt: { position: [.8, 2.8, 0] },
      sensorLeft: { position: [4.9, .85, -2.7] },
      sensorTop: { position: [4.9, 2.05, -1.8] },
      sensorRight: { position: [4.9, .85, -.9] },
    },
    works: {
      base: { position: [0, -1.1, 0] },
      motor: { position: [-3.25, -0.1, -0.3] },
      beamA: { position: [0, -0.7, -1.2] },
      beamB: { position: [0, -0.7, 1.2] },
      gearA: { position: [-1.05, 0.05, 1.4], rotation: [Math.PI / 2, 0, 0] },
      gearB: { position: [0.65, 0.05, 1.4], rotation: [Math.PI / 2, 0, 0] },
      belt: { position: [0.8, -0.45, 0] },
      sensorLeft: { position: [2.4, 0.25, -0.9] },
      sensorTop: { position: [2.4, 1.45, 0] },
      sensorRight: { position: [2.4, 0.25, 0.9] },
    },
  };

  // Labels follow actual 3D anchor coordinates, not fixed screen coordinates.
  const pinDefs = [
    ['入口',[-2.3,.65,0],['input','interface']],
    ['动力',[-3.25,1.1,-.3],['input','rule','interface']],
    ['齿轮',[0,1.2,1.4],['rule','interface']],
    ['传送带',[.5,.6,0],['duty','rule']],
    ['出口',[3.1,.7,0],['output','interface','exception']],
  ];
  const pins=host.hasAttribute('data-conveyor-focus')?pinDefs.map(([label,position,fields])=>{const el=document.createElement('span');el.className='conveyor-pin';el.textContent=label;host.append(el);return {el,position:new THREE.Vector3(...position),fields};}):[];
  const focusPieces={duty:['belt','beamA','beamB'],input:['motor'],rule:['gearA','gearB','belt'],output:['sensorLeft','sensorTop','sensorRight'],interface:['motor','gearA','sensorLeft','sensorTop','sensorRight'],exception:['sensorLeft','sensorTop','sensorRight']};
  const focusBoxes=pins.length?Object.fromEntries(Object.entries(pieces).map(([name,piece])=>{const box=new THREE.BoxHelper(piece,0xd85631);common.scene.add(box);return [name,box];})):{};
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration=2500;
  let mode=null,token='',started=0,origins={},ends={},rotorStart=[0,0];
  const capture=piece=>({position:piece.position.clone(),scale:piece.scale.clone(),quaternion:piece.quaternion.clone()});
  const nodes={...pieces,...Object.fromEntries(parcels.map((parcel,index)=>['parcel'+index,parcel]))};
  const parcelTarget=(selected,index)=>selected==='parts'
    ?{position:[-2.6+index*2.4,1.45-index*.35,-1.5+index*.7],rotation:[.2*index,.3*index,0]}
    :{position:[parcels[index].userData.offset,selected==='components'?-.95:.15,0]};
  const pose=value=>({position:new THREE.Vector3(...value.position),scale:new THREE.Vector3(...(value.scale||[1,1,1])),quaternion:new THREE.Quaternion().setFromEuler(new THREE.Euler(...(value.rotation||[0,0,0])))});
  const setMode=value=>{
    const next=targets[value]?value:'parts';
    const requested=Number(host.getAttribute('data-automation-start'))||0;
    const nextToken=next+':'+requested;if(nextToken===token)return;
    const first=mode===null;
    if(first){
      const initial=requested&&Date.now()-requested<duration?(next==='works'?'components':'works'):next;
      for(const [name,piece] of Object.entries(pieces))setTransform(piece,targets[initial][name],true);
      parcels.forEach((parcel,index)=>setTransform(parcel,parcelTarget(initial,index),true));
    }
    origins=Object.fromEntries(Object.entries(nodes).map(([name,piece])=>[name,capture(piece)]));
    ends=Object.fromEntries(Object.entries(pieces).map(([name])=>[name,pose(targets[next][name])]));
    parcels.forEach((_parcel,index)=>{ends['parcel'+index]=pose(parcelTarget(next,index));});
    rotorStart=[pieces.gearA.userData.rotor.rotation.z,pieces.gearB.userData.rotor.rotation.z];
    started=requested||(!first?Date.now():Date.now()-duration);mode=next;token=nextToken;
  };
  const phaseLabel=host.hasAttribute('data-automation-start')?document.createElement('span'):null;
  if(phaseLabel){phaseLabel.className='automation-phase';phaseLabel.setAttribute('aria-live','polite');host.append(phaseLabel);}
  setMode(host.getAttribute('data-module-3d-mode')||'parts');
  const update=()=>{
    const elapsed=Math.max(0,Date.now()-started);
    const raw=reducedMotion?1:Math.min(1,elapsed/duration),progress=raw*raw*(3-2*raw);
    for(const [name,piece] of Object.entries(nodes)){
      piece.position.lerpVectors(origins[name].position,ends[name].position,progress);
      piece.scale.lerpVectors(origins[name].scale,ends[name].scale,progress);
      piece.quaternion.slerpQuaternions(origins[name].quaternion,ends[name].quaternion,progress);
    }
    const running=mode==='works'&&raw===1&&!reducedMotion;
    host.dataset.automationPhase=raw<1?(mode==='works'?'assembling':'exploding'):running?'running':'stopped';
    if(phaseLabel){const text=raw<1?(mode==='works'?'正在拼接 · 完成后启动':'正在向多个方向拆开'):mode==='works'?(reducedMotion?'已拼好 · 已减少动态效果':'已拼好 · 组件合作中'):'组件已拆开 · 可拖动观察';if(phaseLabel.textContent!==text)phaseLabel.textContent=text;}
    root.rotation.y=0;
    if(running){
      const runTime=Math.max(0,elapsed-duration);
      pieces.gearA.userData.rotor.rotation.z=rotorStart[0]+runTime*.0021;
      pieces.gearB.userData.rotor.rotation.z=rotorStart[1]-runTime*.0015;
      parcels.forEach(parcel=>{parcel.position.x=-2.3+((parcel.userData.offset+2.3+runTime*.00072)%5.4);});
      const pulse=.48+Math.sin(runTime*.006)*.18;
      for(const name of ['sensorLeft','sensorTop','sensorRight'])pieces[name].material.opacity=pulse;
    }
    const focus=host.getAttribute('data-conveyor-focus')||'duty';
    common.camera.updateMatrixWorld();root.updateMatrixWorld(true);
    pins.forEach(pin=>{const point=root.localToWorld(pin.position.clone()).project(common.camera);pin.el.style.left=((point.x+1)*50)+'%';pin.el.style.top=((1-point.y)*50)+'%';pin.el.classList.toggle('active',pin.fields.includes(focus));});
    for(const [name,box] of Object.entries(focusBoxes)){box.visible=(focusPieces[focus]||[]).includes(name);if(box.visible)box.update();}
  };

  return { ...common, setMode, update, sceneCleanup:()=>{phaseLabel?.remove();pins.forEach(pin=>pin.el.remove());} };
}

function createVoxelForge(host) {
  const common = createCommonScene(host, [8.4, 5.4, 10.5]);
  common.camera.fov = 40; // Fit separated wheels/seats too, not just the assembled car.
  common.camera.updateProjectionMatrix();
  const root = new THREE.Group();
  root.scale.setScalar(1.45);
  common.scene.add(root);

  const designs = createVoxelDesigns();
  const colors = {
    rubber: 0x27313a,
    iron: 0x8f9fa8,
    plastic: PALETTE.orange,
    glass: 0x73dce8,
    metal: 0xc4cdd2,
  };
  const materialKeys = Object.keys(colors);
  const pieces = [];
  const batches = [];
  const geometry = new THREE.BoxGeometry(VOXEL_EDGE, VOXEL_EDGE, VOXEL_EDGE);
  for (const materialKey of materialKeys) {
    const capacity = Math.max(...Object.values(designs).map((design) => design[materialKey].length));
    // One GPU draw batch per material, rather than hundreds of meshes per preview.
    const batch = new THREE.InstancedMesh(geometry, material(colors[materialKey], materialKey === "glass"
      ? { transparent: true, opacity: 0.7, depthWrite: false } : {}), capacity);
    batch.name = `voxel-${materialKey}`;
    batch.castShadow = true;
    batch.receiveShadow = true;
    batch.frustumCulled = false; // Matrices move between separated components and the complete object.
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    batches.push(batch);
    root.add(batch);
    for (let index = 0; index < capacity; index += 1) {
      const piece = new THREE.Object3D(); // CPU transform only; never added as a separate draw call.
      piece.userData = { materialKey, materialIndex: index, batch };
      // Subtle checker shading makes the smaller cells readable without increasing draw calls.
      const sub = index % 8;
      const shade = ((sub >> 2) + ((sub >> 1) & 1) + (sub & 1)) % 2 ? 0.82 : 1;
      batch.setColorAt(index, new THREE.Color(shade, shade, shade));
      pieces.push(piece);
    }
  }
  host.dataset.voxelGeometry = JSON.stringify({ edge: VOXEL_EDGE, resolution: 2, batches: batches.length,
    counts: Object.fromEntries(Object.entries(designs).map(([name, design]) =>
      [name, Object.values(design).reduce((sum, cells) => sum + cells.length, 0)])) });

  const scatterOrigins = {
    car: { rubber: [-4.2, -1.3, -1.1], iron: [-1.4, -1.3, -1.1], plastic: [2.7, -1.3, -1.1] },
    scope: { glass: [-4.1, -1.3, -1.1], metal: [-1.35, -1.3, -1.1], iron: [2.35, -1.3, -1.1] },
  };
  const componentOffsets = {
    car: {
      frame: [0, -0.55, 0],
      "wheel-left-front": [-1.1, 0.7, -0.35], "wheel-left-back": [1.1, 0.7, -0.35],
      "wheel-right-front": [-1.1, 0.7, 0.35], "wheel-right-back": [1.1, 0.7, 0.35],
      "seat-0": [-0.45, 1.15, 0], "seat-1": [0.45, 1.15, 0], steering: [0.8, 1.15, 0],
    },
    scope: { stock: [-0.65, -0.65, 0], scope: [0.75, 1.25, 0] },
  };
  const scatterTarget = (caseName, materialKey, target) => {
    const index = target.sourceIndex;
    const cellOffset = [target.subIndex >> 2, (target.subIndex >> 1) & 1, target.subIndex & 1].map(bit => (bit ? 1 : -1) * VOXEL_EDGE / 2);
    const [originX, originY, originZ] = scatterOrigins[caseName][materialKey] || [0, -1.3, 0];
    return {
      position: [originX + (index % 5) * 0.48, originY + (Math.floor(index / 5) % 4) * 0.48, originZ + Math.floor(index / 20) * 0.48].map((v, axis) => v + cellOffset[axis]),
    };
  };

  const functional=host.hasAttribute('data-car-functions');
  const terrains={};
  const addTerrain=(id,name,color,size,position,rotation=0)=>{
    const group=terrains[id]||(terrains[id]=new THREE.Group());if(!group.parent)common.scene.add(group);
    const mesh=box(name,color,size);mesh.position.set(...position);mesh.rotation.z=rotation;
    mesh.material.transparent=true;mesh.material.opacity=0;group.add(mesh);return mesh;
  };
  if(functional){
    addTerrain('drive','道路',0x83949b,[12,.15,2.8],[0,-1.9,0]);
    addTerrain('jump','起跳坡',PALETTE.orange,[4,.25,2.8],[-3,-1.5,0],.18);
    addTerrain('jump','落地坡',PALETTE.orange,[4,.25,2.8],[3,-1.5,0],-.18);
    addTerrain('river','河流',0x38adcf,[3,.1,12],[0,-1.98,0]);
    addTerrain('river','桥面',0x987e54,[12,.25,2.7],[0,-1.7,0]);
    for(const z of [-1.45,1.45])addTerrain('river','桥栏',PALETTE.mint,[11,.25,.15],[0,-1.2,z]);
    const curve=addTerrain('turn','转弯路线',0x83949b,[.01,.01,.01],[0,-1.9,0]);
    curve.geometry.dispose();curve.geometry=new THREE.TorusGeometry(3,1,4,64);curve.rotation.set(Math.PI/2,0,0);curve.scale.z=.1;
  }
  const carBottom=Math.min(...Object.values(designs.car).flat().map(cell=>cell.position[1]-VOXEL_EDGE/2));
  let currentCase = "car";
  let currentStep = "blocks";
  let first = true;
  const setMode = (value) => {
    const [caseValue, stepValue] = String(value || "").split(":");
    currentCase = designs[caseValue] ? caseValue : "car";
    currentStep = ["blocks", "components", "object",...(functional?["drive","jump","turn","river"]:[])].includes(stepValue) ? stepValue : "blocks";
    const design = designs[currentCase];
    for (const piece of pieces) {
      const materialKey = piece.userData.materialKey;
      const target = design[materialKey][piece.userData.materialIndex];
      if (!target) {
        setTransform(piece, { position: [0, -1.8, 0], scale: [0.001, 0.001, 0.001] }, first);
        continue;
      }
      if (currentStep === "blocks") {
        setTransform(piece, { ...scatterTarget(currentCase, materialKey, target), scale: [1, 1, 1] }, first);
        continue;
      }
      const offset = currentStep === "components" ? (componentOffsets[currentCase][target.component] || [0, 0, 0]) : [0, 0, 0];
      setTransform(piece, {
        position: target.position.map((coordinate, index) => coordinate + offset[index]),
        scale: [1, 1, 1],
      }, first);
    }
    // Record default framing from actual geometry, so content checks catch clipped models.
    common.camera.updateMatrixWorld();
    root.updateMatrixWorld(true);
    const framing = { min: [Infinity, Infinity], max: [-Infinity, -Infinity] };
    for (const piece of pieces) {
      if (!design[piece.userData.materialKey][piece.userData.materialIndex]) continue;
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
        const corner = piece.userData.targetPosition.clone().add(new THREE.Vector3(x, y, z).multiplyScalar(VOXEL_EDGE / 2));
        root.localToWorld(corner).project(common.camera);
        for (const [axis, value] of [corner.x, corner.y].entries()) {
          framing.min[axis] = Math.min(framing.min[axis], value);
          framing.max[axis] = Math.max(framing.max[axis], value);
        }
      }
    }
    host.dataset.voxelFraming = JSON.stringify(framing);
    first = false;
  };
  setMode(host.getAttribute("data-module-3d-mode") || "car:blocks");

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const update = () => {
    pieces.forEach((piece) => {
      approachTarget(piece, reducedMotion ? 1 : 0.105);
      piece.updateMatrix();
      piece.userData.batch.setMatrixAt(piece.userData.materialIndex, piece.matrix);
    });
    batches.forEach(batch => { batch.instanceMatrix.needsUpdate = true; });
    const action=functional&&['drive','jump','turn','river'].includes(currentStep)?currentStep:null;
    const phase=reducedMotion?0:((Date.now()%10000)/10000)*Math.PI*2;
    const size=action?.8:1.45;
    const x=action?(action==='turn'?3*Math.cos(phase):4.3*Math.sin(phase)):0;
    const z=action==='turn'?3*Math.sin(phase):0;
    const jump=action==='jump'?Math.max(0,1-Math.abs(x)/4.3)*1.8:0;
    const y=action?(action==='river'?-1.575:-1.825)-carBottom*size+jump:0;
    const rotation=action==='turn'?-phase-Math.PI/2:0;
    const ease=reducedMotion?1:.065;
    root.position.lerp(new THREE.Vector3(x,y,z),ease);
    root.scale.lerp(new THREE.Vector3(size,size,size),ease);
    root.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,rotation,0)),ease);
    for(const [id,group] of Object.entries(terrains))for(const mesh of group.children){
      mesh.material.opacity+=((id===action?1:0)-mesh.material.opacity)*ease;
      mesh.visible=mesh.material.opacity>.005;
    }
    if(functional)host.dataset.carDemonstration=action||currentStep;
  };
  return { ...common, setMode, update };
}

// A small game scene makes cooperation visible without introducing a new business case.
function createGameModules(host){
 const common=createCommonScene(host,[8,6,10]),root=new THREE.Group();common.scene.add(root);
 const road=box('移动模块',PALETTE.blue,[5,.25,1.6]);road.position.set(-1,-.5,0);root.add(road);
 const pickup=box('拾取模块',PALETTE.yellow,[1.4,.25,1.6]);pickup.position.set(2.5,-.5,0);root.add(pickup);
 const bag=box('背包模块',PALETTE.mint,[1.8,1.6,1.6]);bag.position.set(4,.1,0);root.add(bag);
 const player=box('玩家',PALETTE.orange,[.65,.9,.65]);root.add(player);
 const item=box('道具',PALETTE.yellow,[.4,.4,.4]);root.add(item);
 let mode='split';const setMode=value=>{mode=value==='play'?'play':'split';};setMode(host.getAttribute('data-module-3d-mode'));
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const update=()=>{const t=reduced?0:(Date.now()%6000)/6000,ease=reduced?1:.08;
  road.position.z+=((mode==='split'?1:0)-road.position.z)*ease;
  pickup.position.z+=((mode==='split'?-1:0)-pickup.position.z)*ease;
  bag.position.z+=((mode==='split'?1:0)-bag.position.z)*ease;
  player.position.lerp(new THREE.Vector3(mode==='play'?-3+Math.min(t*2,1)*5.5:-2,.1,mode==='split'?1:0),ease);
  item.position.lerp(new THREE.Vector3(mode==='play'&&t>.5?2.5+(t-.5)*3:2.5,mode==='play'&&t>.5?.9:.1,mode==='split'?-1:0),ease);

 };return {...common,setMode,update};
}

// S14: explode four responsibility groups from S13, then reconnect their interfaces.
function createCarModuleAssembly(host){
 const common=createCommonScene(host,[3,8,13]);
 const colors={move:PALETTE.blue,pickup:PALETTE.yellow,bag:PALETTE.mint,finish:PALETTE.orange};
 const names={move:'① 移动',pickup:'② 拾取',bag:'③ 背包',finish:'④ 终点检查'};
 const groups={},labels=[],wheels=[];
 for(const id of Object.keys(colors)){
  const group=new THREE.Group();group.name=id;common.scene.add(group);groups[id]=group;
  const base=box(id+'-base',colors[id],MODULE_ASSEMBLY_SIZE);group.add(base);
  const label=document.createElement('span');label.className='assembly-pin';label.textContent=names[id];label.dataset.module=id;host.append(label);labels.push({id,label});
 }
 function add(id,name,color,size,position){const part=box(name,color,size);part.position.set(...position);groups[id].add(part);return part;}
 const chassis=add('move','小车车身',PALETTE.blue,[1.55,.25,.75],[0,.58,0]);
 for(const x of [-.55,.55])for(const z of [-.58,.58]){
  const wheel=new THREE.Group();wheel.position.set(x,.4,z);groups.move.add(wheel);wheels.push(wheel);
  for(const [a,b] of [[0,0],[.19,0],[-.19,0],[0,.19],[0,-.19]]){const cube=box('橡胶方块',PALETTE.ink,[.2,.2,.2]);cube.position.set(a,b,0);wheel.add(cube);}
 }
 add('move','推进器',PALETTE.yellow,[.35,.3,.32],[-.45,.85,0]);
 add('move','燃料',PALETTE.orange,[.2,.3,.32],[-.73,.85,0]);
 const coin=add('pickup','待拾取道具',PALETTE.yellow,[.45,.45,.45],[0,.5,0]);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.65,.045,8,32),material(PALETTE.orange));ring.rotation.x=Math.PI/2;ring.position.y=.22;groups.pickup.add(ring);
 for(const x of [-.47,.47]){add('bag','背包底',PALETTE.mint,[.75,.2,1],[x,.27,0]);for(const z of [-.45,.45])add('bag','背包格边',PALETTE.mint,[.75,.5,.12],[x,.5,z]);for(const dx of [-.33,.33])add('bag','背包格侧',PALETTE.mint,[.12,.5,.9],[x+dx,.5,0]);}
 const fullItems=[add('bag','占格金币',PALETTE.yellow,[.4,.4,.4],[-.47,.65,0]),add('bag','占格工具',PALETTE.blue,[.35,.3,.65],[.47,.65,0])];
 const stored=add('bag','已收钥匙',PALETTE.yellow,[.22,.22,.55],[-.47,.65,0]);
 for(const z of [-.65,.65])add('finish','终点柱',PALETTE.orange,[.18,1.5,.18],[0,.9,z]);
 const gate=add('finish','终点门',PALETTE.orange,[.18,.18,1.48],[0,1.65,0]);
 const packet=box('接口传递',PALETTE.yellow,[.22,.22,.22]);common.scene.add(packet);
 const links=[];
 for(const id of ['move','pickup','bag']){const index=['move','pickup','bag'].indexOf(id);const x=MODULE_ASSEMBLY_LAYOUT.joined[id][0];const arrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(x+1.1,-.12,0),.4,PALETTE.blue,.16,.13);common.scene.add(arrow);links[index]=arrow;}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let mode='split',first=true;
 const setMode=value=>{
  mode=['split','joined','focus-move','focus-pickup','focus-bag','focus-finish','bag-full'].includes(value)?value:'split';
  const focus=mode.startsWith('focus-')?mode.slice(6):null;
  const targets={};
  for(const [id,group] of Object.entries(groups)){
   group.visible=true;
   const position=focus&&id===focus?[0,-.5,0]:MODULE_ASSEMBLY_LAYOUT[mode==='joined'||mode==='bag-full'?'joined':'split'][id];
   targets[id]=position;setTransform(group,{position,scale:focus?(id===focus?[1.8,1.8,1.8]:[.001,.001,.001]):[1,1,1]},first||reduced);
  }
  first=false;host.dataset.assemblyTargets=JSON.stringify(targets);
  links.forEach(link=>link.visible=mode==='joined');packet.visible=mode==='joined';
 };
 setMode(host.getAttribute('data-module-3d-mode'));
 function update(){
  const t=reduced?0:(Date.now()%8000)/8000;
  for(const group of Object.values(groups))approachTarget(group,reduced?1:.12);
  wheels.forEach(wheel=>wheel.rotation.z=mode==='joined'?-t*Math.PI*8:0);
  chassis.position.y=.58;coin.visible=mode!=='joined'||t<.45;stored.visible=mode!=='bag-full'&&(mode!=='joined'||t>=.45);
  fullItems.forEach(item=>item.visible=mode==='bag-full');ring.material.color.setHex(mode==='bag-full'?0xb83d27:PALETTE.orange);
  gate.material.color.setHex(mode==='joined'&&t>.75?PALETTE.mint:PALETTE.orange);
  packet.position.set(-3.9+t*7.8,.65,0);
  common.camera.updateMatrixWorld();common.scene.updateMatrixWorld(true);
  for(const {id,label} of labels){const point=new THREE.Vector3(0,2.05,0);groups[id].localToWorld(point).project(common.camera);label.hidden=groups[id].scale.x<.2||point.z< -1||point.z>1||Math.abs(point.x)>1||Math.abs(point.y)>1;label.style.left=(point.x+1)*host.clientWidth/2+'px';label.style.top=(1-point.y)*host.clientHeight/2+'px';}
 }
 return {...common,setMode,update,sceneCleanup:()=>labels.forEach(({label})=>label.remove())};
}

// HOW-04: an explicitly incorrect rule versus a correct rule, isolated from gameplay.
function createBagComparison(host){
 const common=createCommonScene(host,[1.8,4.5,8],[0,-.65,0]);
 const car=new THREE.Group();common.scene.add(car);const wheels=[];
 const body=box('方块小车车身',PALETTE.blue,[3,.3,1.45]);body.position.y=-.92;car.add(body);
 for(const x of [-1.08,1.08])for(const z of [-.9,.9]){
  const wheel=new THREE.Group();wheel.position.set(x,-1.3,z);car.add(wheel);wheels.push(wheel);
  for(const [dx,dy] of [[0,0],[.34,0],[-.34,0],[0,.34],[0,-.34]]){const part=box('橡胶方块',PALETTE.ink,[.36,.36,.36]);part.position.set(dx,dy,0);wheel.add(part);}
 }
 const motor=box('推进器金属',PALETTE.paleBlue,[.6,.32,.42]);motor.position.set(-1,-.6,0);car.add(motor);
 const fuel=box('推进器燃料',PALETTE.yellow,[.3,.32,.42]);fuel.position.set(-1.45,-.6,0);car.add(fuel);
 for(const x of [-.42,.42]){const tray=box('背包格子',PALETTE.mint,[.76,.12,.9]);tray.position.set(x,-.67,0);car.add(tray);for(const z of [-.45,.45]){const edge=box('背包格边',PALETTE.mint,[.76,.35,.08]);edge.position.set(x,-.48,z);car.add(edge);}}
 const sprites={};
 for(const item of ITEMS){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.font='216px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(item.icon,128,136);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false}));sprite.scale.set(.82,.82,1);common.scene.add(sprite);sprites[item.id]=sprite;
 }
 const status=document.createElement('div');status.className='bag-demo-status';status.setAttribute('role','status');host.append(status);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let mode='wrong',message='';
 const setMode=value=>{mode=value==='wrong'?'wrong':'correct';status.dataset.rule=mode;};setMode(host.getAttribute('data-module-3d-mode'));
 function update(){
  const started=Number(host.dataset.bagDemoStart)||0;
  const sample=sampleBagComparison(mode,started?(reduced?6000:Date.now()-started):0);
  car.position.x=sample.carX;wheels.forEach(w=>w.rotation.z=-(sample.carX+3)*2.2);
  sprites.tool.position.set(sample.carX+.42,-.08,0);
  const k=sample.keyProgress,c=sample.coinProgress;
  sprites.key.position.set(2+(sample.carX-.42-2)*k,-1.45+1.37*k+Math.sin(k*Math.PI)*1.4,0);
  sprites.coin.position.set(sample.carX-.42-2.2*c,-.08+1.6*Math.sin(c*Math.PI),-.5*c);sprites.coin.visible=c<1;sprites.coin.material.opacity=1-c*.8;
  if(message!==sample.message){message=sample.message;status.textContent=message;}
 }
 return {...common,setMode,update,sceneCleanup:()=>{status.remove();Object.values(sprites).forEach(sprite=>sprite.material.map.dispose());}};
}

function mountScene(host) {
  let instance;
  try {
    const factories = { transform: createTransformToy, automation: createAutomationLab, voxel: createVoxelForge, game: createGameModules, "car-modules": createCarModuleAssembly, "bag-compare": createBagComparison };
    const sceneType = host.getAttribute("data-module-3d");
    const factory = factories[sceneType];
    if (!factory) throw new Error(`未知 3D 课堂场景：${sceneType}`);
    instance = factory(host);
  } catch (error) {
    host.dataset.webglFailed = "true";
    console.warn("3D 课堂示意无法启动，已保留 HTML 降级图。", error);
    return () => {};
  }
  host.dataset.webglReady = "true";
  const modeObserver = new MutationObserver(() => instance.setMode(host.getAttribute("data-module-3d-mode")));
  modeObserver.observe(host, { attributes: true, attributeFilter: ["data-module-3d-mode"] });
  let frame = 0;
  let disposed = false;
  const draw = (time) => {
    if (disposed) return;
    if (!host.isConnected) { dispose(); return; }
    instance.update(time);
    instance.renderer.render(instance.scene, instance.camera);
    if (!host.dataset.renderStats) host.dataset.renderStats = JSON.stringify({
      calls: instance.renderer.info.render.calls, geometries: instance.renderer.info.memory.geometries,
    });
    frame = requestAnimationFrame(draw);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    modeObserver.disconnect();
    instance.observer.disconnect();
    instance.cameraCleanup();
    instance.sceneCleanup?.();
    instance.scene.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose?.());
      else object.material?.dispose?.();
    });
    instance.renderer.dispose();
    instance.renderer.domElement.remove();
    liveScenes.delete(dispose);
  };
  liveScenes.add(dispose);
  frame = requestAnimationFrame(draw);
  return dispose;
}

export function mountModuleScenes(root = document) {
  const cleanups = [...root.querySelectorAll('[data-module-3d]:not([data-webgl-ready="true"])')].map(mountScene);
  return () => cleanups.forEach((cleanup) => cleanup());
}

export function disposeAllModuleScenes() {
  [...liveScenes].forEach((dispose) => dispose());
}
