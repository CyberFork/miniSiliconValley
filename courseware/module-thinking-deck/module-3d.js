import * as THREE from "./vendor/three.module.min.js";
import { createVoxelDesigns, VOXEL_EDGE } from "./voxel-designs.js";
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

function createCommonScene(host, cameraPosition = [8, 5.5, 10]) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
  camera.position.set(...cameraPosition);
  camera.lookAt(0, 0.3, 0);
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
  const cameraCleanup = addCameraControls(host, camera, renderer.domElement);
  return { scene, camera, renderer, observer, cameraCleanup };
}

function addCameraControls(host, camera, canvas) {
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.3, 0);
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

  let first = true;
  const setMode = (mode) => {
    const selected = targets[mode] ? mode : "car";
    for (const [name, piece] of Object.entries(pieces)) setTransform(piece, targets[selected][name], first);
    first = false;
  };
  setMode(host.getAttribute("data-module-3d-mode") || "car");

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const update = (time) => {
    Object.values(pieces).forEach((piece) => approachTarget(piece, reducedMotion ? 1 : 0.105));
    const idle = reducedMotion ? 0 : Math.sin(time * 0.00045) * 0.12;
    root.rotation.y = idle;
    pieces.wheelA.rotation.y += reducedMotion ? 0 : 0.012;
    pieces.wheelB.rotation.y += reducedMotion ? 0 : 0.012;
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

  let mode = "parts";
  let first = true;
  const setMode = (value) => {
    mode = targets[value] ? value : "parts";
    for (const [name, piece] of Object.entries(pieces)) setTransform(piece, targets[mode][name], first);
    parcels.forEach((parcel, index) => setTransform(parcel, mode === "parts"
      ? { position: [-2.6 + index * 2.4, 1.45 - index * 0.35, -1.5 + index * 0.7], rotation: [0.2 * index, 0.3 * index, 0] }
      : { position: [parcel.userData.offset, 0.15, 0] }, first));
    first = false;
  };
  setMode(host.getAttribute("data-module-3d-mode") || "parts");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const update = (time) => {
    Object.values(pieces).forEach((piece) => approachTarget(piece, reducedMotion ? 1 : 0.105));
    if (mode !== "works" || reducedMotion) parcels.forEach((parcel) => approachTarget(parcel, reducedMotion ? 1 : 0.105));
    root.rotation.y = (reducedMotion ? 0 : Math.sin(time * 0.00025) * 0.08);
    if (mode === "works" && !reducedMotion) {
      pieces.gearA.userData.rotor.rotation.z += 0.035;
      pieces.gearB.userData.rotor.rotation.z -= 0.025;
      parcels.forEach((parcel) => {
        parcel.position.x += 0.012;
        if (parcel.position.x > 3.1) parcel.position.x = -2.3;
      });
      const pulse = 0.48 + Math.sin(time * 0.006) * 0.18;
      for (const name of ["sensorLeft", "sensorTop", "sensorRight"]) pieces[name].material.opacity = pulse;
    }
  };
  return { ...common, setMode, update };
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

  let currentCase = "car";
  let currentStep = "blocks";
  let first = true;
  const setMode = (value) => {
    const [caseValue, stepValue] = String(value || "").split(":");
    currentCase = designs[caseValue] ? caseValue : "car";
    currentStep = ["blocks", "components", "object"].includes(stepValue) ? stepValue : "blocks";
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
  const update = (time) => {
    pieces.forEach((piece) => {
      approachTarget(piece, reducedMotion ? 1 : 0.105);
      piece.updateMatrix();
      piece.userData.batch.setMatrixAt(piece.userData.materialIndex, piece.matrix);
    });
    batches.forEach(batch => { batch.instanceMatrix.needsUpdate = true; });
    const idle = reducedMotion ? 0 : Math.sin(time * 0.0003) * 0.08;
    root.rotation.y = idle;
    root.position.x = currentCase === "car" && currentStep === "object" && !reducedMotion ? Math.sin(time * 0.0011) * 0.2 : 0;
  };
  return { ...common, setMode, update };
}

function mountScene(host) {
  let instance;
  try {
    const factories = { transform: createTransformToy, automation: createAutomationLab, voxel: createVoxelForge };
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
  const cleanups = [...root.querySelectorAll("[data-module-3d]")].map(mountScene);
  return () => cleanups.forEach((cleanup) => cleanup());
}

export function disposeAllModuleScenes() {
  [...liveScenes].forEach((dispose) => dispose());
}
