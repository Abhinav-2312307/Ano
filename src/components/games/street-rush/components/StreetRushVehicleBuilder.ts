import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CAR_SPECS, DEFAULT_CAR_ID } from '../config/carConfig';

export interface Vehicle3DInstance {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  wheelFLGroup: THREE.Group;
  wheelFRGroup: THREE.Group;
  wheelRLGroup: THREE.Group;
  wheelRRGroup: THREE.Group;
  wheelFLMesh: THREE.Object3D;
  wheelFRMesh: THREE.Object3D;
  wheelRLMesh: THREE.Object3D;
  wheelRRMesh: THREE.Object3D;
  exhaustL: THREE.Mesh;
  exhaustR: THREE.Mesh;
  nitroConeL: THREE.Mesh;
  nitroConeR: THREE.Mesh;
  underglowMesh: THREE.Mesh;
  nameplateSprite: THREE.Sprite;
  nameplateCanvas: HTMLCanvasElement;
  nameplateContext: CanvasRenderingContext2D;
  lastDrawnRank: number;
  lastDrawnNickname: string;
  carId: string;
  isLocal: boolean;
}

const gltfCache: Record<string, THREE.Group> = {};

export function preloadStreetRushGLB(carId: string = DEFAULT_CAR_ID): Promise<THREE.Group | null> {
  const normId = CAR_SPECS[carId]?.id || DEFAULT_CAR_ID;
  if (gltfCache[normId]) {
    return Promise.resolve(gltfCache[normId]);
  }

  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    const loader = new GLTFLoader();
    loader.load(
      `/models/derby/${normId}.glb`,
      (gltf) => {
        gltfCache[normId] = gltf.scene;
        resolve(gltf.scene);
      },
      undefined,
      () => {
        // Fallback procedural car is always available
        resolve(null);
      }
    );
  });
}

export function preloadAllStreetRushCars(): Promise<void> {
  const carIds = Object.keys(CAR_SPECS);
  return Promise.all(carIds.map((id) => preloadStreetRushGLB(id))).then(() => {});
}

// ── NAMEPLATE CANVAS TEXTURE GENERATOR ──────────────────────
function createNameplateSprite(nickname: string, rank: number, isLocal: boolean): {
  sprite: THREE.Sprite;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;

  drawNameplate(canvas, ctx, nickname, rank, isLocal);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.2, 0.8, 1.0);
  sprite.position.set(0, 2.3, 0);

  return { sprite, canvas, ctx };
}

function drawNameplate(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  nickname: string,
  rank: number,
  isLocal: boolean
) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background Pill
  ctx.fillStyle = isLocal ? 'rgba(6, 182, 212, 0.85)' : 'rgba(15, 23, 42, 0.82)';
  ctx.beginPath();
  ctx.roundRect(12, 12, canvas.width - 24, canvas.height - 24, 24);
  ctx.fill();

  ctx.strokeStyle = isLocal ? '#a5f3fc' : 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Rank Badge (Circle)
  ctx.fillStyle = rank === 1 ? '#eab308' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : '#334155';
  ctx.beginPath();
  ctx.arc(52, 48, 24, 0, Math.PI * 2);
  ctx.fill();

  // Rank text
  ctx.fillStyle = rank === 1 ? '#000000' : '#ffffff';
  ctx.font = 'black 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`#${rank}`, 52, 49);

  // Nickname
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const displayNick = nickname.length > 14 ? nickname.slice(0, 13) + '…' : nickname;
  ctx.fillText(displayNick.toUpperCase(), 92, 48);

  if (isLocal) {
    ctx.font = 'extrabold 12px sans-serif';
    ctx.fillStyle = '#083344';
    ctx.fillText('YOU', canvas.width - 60, 48);
  }
}

// ── PROCEDURAL FALLBACK VEHICLE ────────────────────────────
function buildProceduralChassis(accentHex: string): {
  body: THREE.Group;
  wheelFL: THREE.Mesh;
  wheelFR: THREE.Mesh;
  wheelRL: THREE.Mesh;
  wheelRR: THREE.Mesh;
} {
  const group = new THREE.Group();

  // Main sports car aerodynamic wedge
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.2,
    metalness: 0.8,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentHex),
    roughness: 0.3,
    metalness: 0.6,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x030712,
    roughness: 0.1,
    metalness: 0.9,
  });

  // Lower body
  const lowerGeo = new THREE.BoxGeometry(1.8, 0.45, 3.8);
  const lowerMesh = new THREE.Mesh(lowerGeo, bodyMat);
  lowerMesh.position.y = 0.4;
  lowerMesh.castShadow = true;
  group.add(lowerMesh);

  // Cabin
  const cabinGeo = new THREE.BoxGeometry(1.4, 0.4, 1.8);
  const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
  cabinMesh.position.set(0, 0.75, -0.2);
  cabinMesh.castShadow = true;
  group.add(cabinMesh);

  // Rear Wing / Spoiler
  const wingGeo = new THREE.BoxGeometry(1.7, 0.08, 0.4);
  const wingMesh = new THREE.Mesh(wingGeo, accentMat);
  wingMesh.position.set(0, 0.9, 1.6);
  group.add(wingMesh);

  const wingPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.1), bodyMat);
  wingPillarL.position.set(-0.6, 0.75, 1.6);
  group.add(wingPillarL);

  const wingPillarR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.1), bodyMat);
  wingPillarR.position.set(0.6, 0.75, 1.6);
  group.add(wingPillarR);

  // Front Splitter
  const splitterGeo = new THREE.BoxGeometry(1.85, 0.06, 0.4);
  const splitterMesh = new THREE.Mesh(splitterGeo, accentMat);
  splitterMesh.position.set(0, 0.2, -1.9);
  group.add(splitterMesh);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });

  const wheelFL = new THREE.Mesh(wheelGeo, tireMat);
  const wheelFR = new THREE.Mesh(wheelGeo, tireMat);
  const wheelRL = new THREE.Mesh(wheelGeo, tireMat);
  const wheelRR = new THREE.Mesh(wheelGeo, tireMat);

  return { body: group, wheelFL, wheelFR, wheelRL, wheelRR };
}

// ── CREATE VEHICLE 3D OBJECT ───────────────────────────────
export function createStreetRushVehicle(
  carId: string = DEFAULT_CAR_ID,
  nickname: string = 'Racer',
  isLocal: boolean = false,
  initialRank: number = 1
): Vehicle3DInstance {
  const spec = CAR_SPECS[carId] || CAR_SPECS[DEFAULT_CAR_ID];
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Wheel pivot groups (for steering)
  const wheelFLGroup = new THREE.Group();
  const wheelFRGroup = new THREE.Group();
  const wheelRLGroup = new THREE.Group();
  const wheelRRGroup = new THREE.Group();

  wheelFLGroup.position.set(-0.95, 0.38, -1.15);
  wheelFRGroup.position.set(0.95, 0.38, -1.15);
  wheelRLGroup.position.set(-0.95, 0.38, 1.25);
  wheelRRGroup.position.set(0.95, 0.38, 1.25);

  root.add(wheelFLGroup);
  root.add(wheelFRGroup);
  root.add(wheelRLGroup);
  root.add(wheelRRGroup);

  // Fallback procedural chassis initially
  const proc = buildProceduralChassis(spec.accentColor);
  bodyGroup.add(proc.body);

  let wheelFLMesh: THREE.Object3D = proc.wheelFL;
  let wheelFRMesh: THREE.Object3D = proc.wheelFR;
  let wheelRLMesh: THREE.Object3D = proc.wheelRL;
  let wheelRRMesh: THREE.Object3D = proc.wheelRR;

  wheelFLGroup.add(wheelFLMesh);
  wheelFRGroup.add(wheelFRMesh);
  wheelRLGroup.add(wheelRLMesh);
  wheelRRGroup.add(wheelRRMesh);

  // Asynchronously load & swap GLB model from existing /models/derby/
  preloadStreetRushGLB(spec.id).then((scene) => {
    if (!scene) return;
    const cloned = scene.clone(true);
    cloned.rotation.y = 0; // Model faces -Z

    // Restyle car paint with accent color
    const accentCol = new THREE.Color(spec.accentColor);
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((m) => m.clone());
          } else {
            mesh.material = mesh.material.clone();
          }
          const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
          if (mat.name && (mat.name.includes('Accent') || mat.name.includes('Metal') || mat.name.includes('Decal'))) {
            mat.color = accentCol;
          }
        }
      }
    });

    // Extract wheel meshes from GLB if present
    const glbWheelFL = cloned.getObjectByName('DERBY_Wheel_FL');
    const glbWheelFR = cloned.getObjectByName('DERBY_Wheel_FR');
    const glbWheelRL = cloned.getObjectByName('DERBY_Wheel_RL');
    const glbWheelRR = cloned.getObjectByName('DERBY_Wheel_RR');

    if (glbWheelFL && glbWheelFR && glbWheelRL && glbWheelRR) {
      // Reparent to our steering groups
      wheelFLGroup.clear();
      wheelFRGroup.clear();
      wheelRLGroup.clear();
      wheelRRGroup.clear();

      wheelFLMesh = glbWheelFL;
      wheelFRMesh = glbWheelFR;
      wheelRLMesh = glbWheelRL;
      wheelRRMesh = glbWheelRR;

      wheelFLMesh.position.set(0, 0, 0);
      wheelFRMesh.position.set(0, 0, 0);
      wheelRLMesh.position.set(0, 0, 0);
      wheelRRMesh.position.set(0, 0, 0);

      wheelFLGroup.add(wheelFLMesh);
      wheelFRGroup.add(wheelFRMesh);
      wheelRLGroup.add(wheelRLMesh);
      wheelRRGroup.add(wheelRRMesh);
    }

    bodyGroup.clear();
    bodyGroup.add(cloned);
  });

  // ── NITRO EXHAUST CONES ───────────────────────────────────
  const exhaustGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.25, 8);
  exhaustGeo.rotateX(Math.PI / 2);
  const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.9, roughness: 0.2 });

  const exhaustL = new THREE.Mesh(exhaustGeo, exhaustMat);
  exhaustL.position.set(-0.4, 0.32, 1.85);
  bodyGroup.add(exhaustL);

  const exhaustR = new THREE.Mesh(exhaustGeo, exhaustMat);
  exhaustR.position.set(0.4, 0.32, 1.85);
  bodyGroup.add(exhaustR);

  // Glowing Nitro Flame Cones (invisible until nitro is fired)
  const coneGeo = new THREE.ConeGeometry(0.16, 1.1, 8);
  coneGeo.rotateX(-Math.PI / 2); // Pointing backwards
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4, // Cyan flame
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });

  const nitroConeL = new THREE.Mesh(coneGeo, coneMat.clone());
  nitroConeL.position.set(-0.4, 0.32, 2.4);
  bodyGroup.add(nitroConeL);

  const nitroConeR = new THREE.Mesh(coneGeo, coneMat.clone());
  nitroConeR.position.set(0.4, 0.32, 2.4);
  bodyGroup.add(nitroConeR);

  // ── NEON UNDERGLOW DISC ───────────────────────────────────
  const underglowGeo = new THREE.PlaneGeometry(2.4, 4.0);
  underglowGeo.rotateX(-Math.PI / 2);
  const underglowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(spec.accentColor),
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const underglowMesh = new THREE.Mesh(underglowGeo, underglowMat);
  underglowMesh.position.y = 0.05;
  bodyGroup.add(underglowMesh);

  // ── NAMEPLATE ─────────────────────────────────────────────
  const { sprite, canvas, ctx } = createNameplateSprite(nickname, initialRank, isLocal);
  root.add(sprite);

  return {
    root,
    bodyGroup,
    wheelFLGroup,
    wheelFRGroup,
    wheelRLGroup,
    wheelRRGroup,
    wheelFLMesh,
    wheelFRMesh,
    wheelRLMesh,
    wheelRRMesh,
    exhaustL,
    exhaustR,
    nitroConeL,
    nitroConeR,
    underglowMesh,
    nameplateSprite: sprite,
    nameplateCanvas: canvas,
    nameplateContext: ctx,
    lastDrawnRank: initialRank,
    lastDrawnNickname: nickname,
    carId: spec.id,
    isLocal,
  };
}

// ── UPDATE VEHICLE ANIMATIONS & DYNAMICS ────────────────────
export function updateStreetRushVehicleVisuals(
  veh: Vehicle3DInstance,
  x: number,
  y: number,
  z: number,
  rotationY: number,
  speed: number,
  steerRatio: number,
  isDrifting: boolean,
  isNitro: boolean,
  currentRank: number,
  nickname: string,
  dt: number = 0.016
) {
  // 1. Root transform
  veh.root.position.set(x, y, z);
  veh.root.rotation.y = rotationY;

  // 2. Front wheel steering
  const maxSteerRad = 0.48;
  const targetSteerAngle = -steerRatio * maxSteerRad;
  veh.wheelFLGroup.rotation.y = targetSteerAngle;
  veh.wheelFRGroup.rotation.y = targetSteerAngle;

  // 3. Wheel rolling spin (X axis)
  const wheelRadius = 0.38;
  const spinDelta = (speed * dt) / wheelRadius;
  veh.wheelFLMesh.rotation.x -= spinDelta;
  veh.wheelFRMesh.rotation.x -= spinDelta;
  veh.wheelRLMesh.rotation.x -= spinDelta;
  veh.wheelRRMesh.rotation.x -= spinDelta;

  // 4. Subtle body roll & pitch on cornering / acceleration
  const targetRoll = isDrifting ? -steerRatio * 0.12 : -steerRatio * 0.06;
  const targetPitch = isNitro ? -0.04 : (speed > 25 ? -0.02 : 0);
  veh.bodyGroup.rotation.z += (targetRoll - veh.bodyGroup.rotation.z) * Math.min(1.0, 12 * dt);
  veh.bodyGroup.rotation.x += (targetPitch - veh.bodyGroup.rotation.x) * Math.min(1.0, 10 * dt);

  // 5. Nitro exhaust flame pulse
  const nitroMatL = veh.nitroConeL.material as THREE.MeshBasicMaterial;
  const nitroMatR = veh.nitroConeR.material as THREE.MeshBasicMaterial;

  if (isNitro) {
    const pulse = 0.75 + Math.random() * 0.25;
    nitroMatL.opacity = pulse;
    nitroMatR.opacity = pulse;
    const lengthScale = 0.85 + Math.random() * 0.4;
    veh.nitroConeL.scale.set(1.0, lengthScale, 1.0);
    veh.nitroConeR.scale.set(1.0, lengthScale, 1.0);
  } else {
    nitroMatL.opacity = Math.max(0, nitroMatL.opacity - dt * 6);
    nitroMatR.opacity = Math.max(0, nitroMatR.opacity - dt * 6);
  }

  // 6. Nameplate rank update: ONLY re-draw and upload texture when rank or nickname changes
  if (veh.nameplateCanvas && veh.nameplateContext) {
    if (veh.lastDrawnRank !== currentRank || veh.lastDrawnNickname !== nickname) {
      veh.lastDrawnRank = currentRank;
      veh.lastDrawnNickname = nickname;
      drawNameplate(veh.nameplateCanvas, veh.nameplateContext, nickname, currentRank, veh.isLocal);
      const mat = veh.nameplateSprite.material as THREE.SpriteMaterial;
      if (mat.map) mat.map.needsUpdate = true;
    }
  }
}
