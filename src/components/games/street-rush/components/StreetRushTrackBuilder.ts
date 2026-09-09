import * as THREE from 'three';
import {
  CHECKPOINTS,
  TRACK_CENTERLINE_NODES,
  TRACK_SETTINGS,
} from '../config/trackConfig';

export interface Track3DScene {
  group: THREE.Group;
  spline: THREE.CatmullRomCurve3;
  samples: THREE.Vector3[];
  sampleNormals: THREE.Vector3[];
  sampleTangents: THREE.Vector3[];
  totalLength: number;
  startLightMeshes: THREE.Mesh[];
  checkpointMeshes: THREE.Mesh[];
}

export function buildStreetRushTrack(): Track3DScene {
  const group = new THREE.Group();

  // 1. Build smooth closed spline curve from centerline nodes
  const splinePoints = TRACK_CENTERLINE_NODES.map((p) => new THREE.Vector3(p.x, 0, p.z));
  const spline = new THREE.CatmullRomCurve3(splinePoints, true, 'centripetal', 0.5);

  const numSamples = 260;
  const samples = spline.getSpacedPoints(numSamples);
  const totalLength = spline.getLength();

  const sampleNormals: THREE.Vector3[] = [];
  const sampleTangents: THREE.Vector3[] = [];

  const halfW = TRACK_SETTINGS.halfWidth; // 7m
  const curbW = TRACK_SETTINGS.curbWidth; // 0.9m
  const barrierDist = TRACK_SETTINGS.barrierOffset; // 7.8m

  // Compute normals (perpendicular vector pointing horizontally outward)
  for (let i = 0; i < samples.length; i++) {
    const tangent = spline.getTangentAt(i / (samples.length - 1)).normalize();
    sampleTangents.push(tangent);

    // Up is (0, 1, 0), cross product gives lateral perpendicular
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    sampleNormals.push(normal);
  }

  // ── 2. ASPHALT ROAD GEOMETRY ──────────────────────────────
  const roadPositions: number[] = [];
  const roadNormals: number[] = [];
  const roadUVs: number[] = [];
  const roadIndices: number[] = [];

  // Curbs geometry
  const curbPositionsL: number[] = [];
  const curbColorsL: number[] = [];
  const curbIndicesL: number[] = [];

  const curbPositionsR: number[] = [];
  const curbColorsR: number[] = [];
  const curbIndicesR: number[] = [];

  // Guardrail barrier geometry
  const barrierPositionsL: number[] = [];
  const barrierIndicesL: number[] = [];

  const barrierPositionsR: number[] = [];
  const barrierIndicesR: number[] = [];

  for (let i = 0; i < samples.length; i++) {
    const pt = samples[i];
    const norm = sampleNormals[i];

    // Left and right road edge vertices
    const leftPt = pt.clone().addScaledVector(norm, -halfW);
    const rightPt = pt.clone().addScaledVector(norm, halfW);

    roadPositions.push(leftPt.x, 0.02, leftPt.z);
    roadPositions.push(rightPt.x, 0.02, rightPt.z);

    roadNormals.push(0, 1, 0, 0, 1, 0);

    const uvV = (i / samples.length) * 40; // Repeat texture along track
    roadUVs.push(0, uvV);
    roadUVs.push(1, uvV);

    // Curbs
    const curbOuterL = pt.clone().addScaledVector(norm, -(halfW + curbW));
    const curbOuterR = pt.clone().addScaledVector(norm, halfW + curbW);

    curbPositionsL.push(leftPt.x, 0.03, leftPt.z);
    curbPositionsL.push(curbOuterL.x, 0.07, curbOuterL.z);

    curbPositionsR.push(rightPt.x, 0.03, rightPt.z);
    curbPositionsR.push(curbOuterR.x, 0.07, curbOuterR.z);

    // Checkerboard curb pattern (red and white)
    const isRed = Math.floor(i / 3) % 2 === 0;
    const rCol = isRed ? [0.92, 0.15, 0.15] : [0.95, 0.95, 0.95];
    curbColorsL.push(...rCol, ...rCol);
    curbColorsR.push(...rCol, ...rCol);

    // Barriers
    const barrierBaseL = pt.clone().addScaledVector(norm, -barrierDist);
    const barrierBaseR = pt.clone().addScaledVector(norm, barrierDist);

    barrierPositionsL.push(barrierBaseL.x, 0, barrierBaseL.z);
    barrierPositionsL.push(barrierBaseL.x, 0.95, barrierBaseL.z);

    barrierPositionsR.push(barrierBaseR.x, 0, barrierBaseR.z);
    barrierPositionsR.push(barrierBaseR.x, 0.95, barrierBaseR.z);

    // Quad indices
    if (i < samples.length - 1) {
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const v2 = (i + 1) * 2;
      const v3 = (i + 1) * 2 + 1;

      // Road quads
      roadIndices.push(v0, v1, v2);
      roadIndices.push(v1, v3, v2);

      // Curbs quads
      curbIndicesL.push(v0, v1, v2);
      curbIndicesL.push(v1, v3, v2);

      curbIndicesR.push(v0, v2, v1);
      curbIndicesR.push(v1, v2, v3);

      // Barriers quads
      barrierIndicesL.push(v0, v1, v2);
      barrierIndicesL.push(v1, v3, v2);

      barrierIndicesR.push(v0, v2, v1);
      barrierIndicesR.push(v1, v2, v3);
    }
  }

  // Build Road Mesh
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roadNormals, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUVs, 2));
  roadGeo.setIndex(roadIndices);

  // Procedural asphalt canvas texture with road stripes
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 512;
  roadCanvas.height = 512;
  const rCtx = roadCanvas.getContext('2d')!;

  // Dark asphalt base
  rCtx.fillStyle = '#181a20';
  rCtx.fillRect(0, 0, 512, 512);

  // Subtle asphalt grit noise
  for (let n = 0; n < 3000; n++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    rCtx.fillStyle = Math.random() > 0.5 ? 'rgba(40, 44, 52, 0.6)' : 'rgba(10, 12, 16, 0.5)';
    rCtx.fillRect(x, y, 2, 2);
  }

  // Yellow shoulder edge lines
  rCtx.fillStyle = '#eab308';
  rCtx.fillRect(24, 0, 10, 512);
  rCtx.fillRect(478, 0, 10, 512);

  // Dashed white center line
  rCtx.fillStyle = '#ffffff';
  for (let y = 0; y < 512; y += 64) {
    rCtx.fillRect(250, y, 12, 38);
  }

  const roadTex = new THREE.CanvasTexture(roadCanvas);
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(1, 40);

  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex,
    roughness: 0.85,
    metalness: 0.1,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // Build Curbs Meshes
  const curbGeoL = new THREE.BufferGeometry();
  curbGeoL.setAttribute('position', new THREE.Float32BufferAttribute(curbPositionsL, 3));
  curbGeoL.setAttribute('color', new THREE.Float32BufferAttribute(curbColorsL, 3));
  curbGeoL.setIndex(curbIndicesL);
  curbGeoL.computeVertexNormals();

  const curbGeoR = new THREE.BufferGeometry();
  curbGeoR.setAttribute('position', new THREE.Float32BufferAttribute(curbPositionsR, 3));
  curbGeoR.setAttribute('color', new THREE.Float32BufferAttribute(curbColorsR, 3));
  curbGeoR.setIndex(curbIndicesR);
  curbGeoR.computeVertexNormals();

  const curbMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    metalness: 0.2,
  });
  group.add(new THREE.Mesh(curbGeoL, curbMat));
  group.add(new THREE.Mesh(curbGeoR, curbMat));

  // Build Barriers
  const barrierGeoL = new THREE.BufferGeometry();
  barrierGeoL.setAttribute('position', new THREE.Float32BufferAttribute(barrierPositionsL, 3));
  barrierGeoL.setIndex(barrierIndicesL);
  barrierGeoL.computeVertexNormals();

  const barrierGeoR = new THREE.BufferGeometry();
  barrierGeoR.setAttribute('position', new THREE.Float32BufferAttribute(barrierPositionsR, 3));
  barrierGeoR.setIndex(barrierIndicesR);
  barrierGeoR.computeVertexNormals();

  const barrierMat = new THREE.MeshStandardMaterial({
    color: 0x3f3f46,
    metalness: 0.7,
    roughness: 0.4,
  });
  group.add(new THREE.Mesh(barrierGeoL, barrierMat));
  group.add(new THREE.Mesh(barrierGeoR, barrierMat));

  // Neon top trim light strips on barriers
  const neonMatCyan = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
  const neonMatPurple = new THREE.MeshBasicMaterial({ color: 0xa855f7 });

  const trimGeoL = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(
      samples.map((s, idx) => s.clone().addScaledVector(sampleNormals[idx], -barrierDist).setY(0.96)),
      true
    ),
    120,
    0.06,
    6,
    true
  );
  group.add(new THREE.Mesh(trimGeoL, neonMatCyan));

  const trimGeoR = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(
      samples.map((s, idx) => s.clone().addScaledVector(sampleNormals[idx], barrierDist).setY(0.96)),
      true
    ),
    120,
    0.06,
    6,
    true
  );
  group.add(new THREE.Mesh(trimGeoR, neonMatPurple));

  // ── 3. GROUND RUNOFF & TERRAIN ─────────────────────────────
  const groundGeo = new THREE.PlaneGeometry(600, 600);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x090b10,
    roughness: 0.95,
    metalness: 0.1,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.y = -0.01;
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // ── 4. STREET LIGHT POSTS ──────────────────────────────────
  const lightPostGeo = new THREE.CylinderGeometry(0.12, 0.15, 6, 8);
  const lightArmGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.8, 6);
  lightArmGeo.rotateZ(Math.PI / 3);

  const postMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.8, roughness: 0.3 });
  const fixtureMat = new THREE.MeshBasicMaterial({ color: 0xfef08a }); // Warm white/gold street lamp

  const stepLight = Math.floor(samples.length / 24); // ~24 street lamps around circuit
  for (let i = 0; i < samples.length; i += stepLight) {
    const pt = samples[i];
    const norm = sampleNormals[i];
    const postPos = pt.clone().addScaledVector(norm, -(barrierDist + 1.6));

    const postMesh = new THREE.Mesh(lightPostGeo, postMat);
    postMesh.position.set(postPos.x, 3, postPos.z);
    group.add(postMesh);

    const armMesh = new THREE.Mesh(lightArmGeo, postMat);
    armMesh.position.set(postPos.x + norm.x * 1.0, 5.7, postPos.z + norm.z * 1.0);
    group.add(armMesh);

    const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), fixtureMat);
    bulbMesh.position.set(postPos.x + norm.x * 1.8, 5.3, postPos.z + norm.z * 1.8);
    group.add(bulbMesh);

    // Subtle localized point light
    const lampLight = new THREE.PointLight(0xfef08a, 1.4, 28, 1.6);
    lampLight.position.copy(bulbMesh.position);
    group.add(lampLight);
  }

  // ── 5. FUTURISTIC NEON SKYSCRAPERS (BACKGROUND SCENERY) ────
  const buildingBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  const buildingColors = [0x0f172a, 0x111827, 0x0a0e1a, 0x1e1b4b, 0x18181b];

  // Instanced building clusters safely outside track boundaries
  const buildingClusters = [
    // Outer West
    { x: -50, z: -40, w: 24, d: 24, h: 55 },
    { x: -75, z: -90, w: 32, d: 30, h: 80 },
    { x: -55, z: 20, w: 28, d: 26, h: 65 },
    { x: -80, z: 70, w: 36, d: 32, h: 90 },

    // North
    { x: 30, z: -190, w: 34, d: 30, h: 75 },
    { x: 90, z: -195, w: 40, d: 35, h: 95 },
    { x: 150, z: -180, w: 30, d: 28, h: 70 },

    // East
    { x: 220, z: -110, w: 35, d: 35, h: 85 },
    { x: 230, z: -40, w: 32, d: 28, h: 90 },
    { x: 220, z: 30, w: 38, d: 32, h: 80 },
    { x: 190, z: 95, w: 30, d: 30, h: 65 },

    // South
    { x: 100, z: 125, w: 35, d: 32, h: 75 },
    { x: 30, z: 120, w: 30, d: 28, h: 80 },
    { x: -25, z: 110, w: 26, d: 26, h: 60 },

    // Interior Plaza (Inside closed loop)
    { x: 85, z: -50, w: 28, d: 28, h: 58 },
    { x: 80, z: -95, w: 24, d: 24, h: 48 },
    { x: 105, z: -10, w: 26, d: 24, h: 52 },
  ];

  buildingClusters.forEach((b, idx) => {
    const col = buildingColors[idx % buildingColors.length];
    const mat = new THREE.MeshStandardMaterial({
      color: col,
      roughness: 0.4,
      metalness: 0.7,
    });
    const mesh = new THREE.Mesh(buildingBoxGeo, mat);
    mesh.scale.set(b.w, b.h, b.d);
    mesh.position.set(b.x, b.h / 2, b.z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);

    // Glowing window stripes on skyscraper facades
    if (b.h > 60) {
      const windowGeo = new THREE.PlaneGeometry(b.w * 0.85, b.h * 0.8);
      const winMat = new THREE.MeshBasicMaterial({
        color: idx % 2 === 0 ? 0x06b6d4 : 0xf43f5e,
        transparent: true,
        opacity: 0.18,
      });
      const winMesh = new THREE.Mesh(windowGeo, winMat);
      winMesh.position.set(b.x, b.h / 2, b.z + b.d / 2 + 0.1);
      group.add(winMesh);
    }
  });

  // ── 6. START / FINISH OVERHEAD GANTRY ──────────────────────
  const gantryGroup = new THREE.Group();
  gantryGroup.position.set(0, 0, 0);

  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
  const pillarGeo = new THREE.CylinderGeometry(0.3, 0.35, 7.5, 8);

  // Left & Right Support Pillars
  const pillarL = new THREE.Mesh(pillarGeo, pillarMat);
  pillarL.position.set(-(barrierDist + 0.4), 3.75, 0);
  gantryGroup.add(pillarL);

  const pillarR = new THREE.Mesh(pillarGeo, pillarMat);
  pillarR.position.set(barrierDist + 0.4, 3.75, 0);
  gantryGroup.add(pillarR);

  // Overhead Crossbeam
  const beamGeo = new THREE.BoxGeometry((barrierDist + 0.6) * 2, 1.4, 1.6);
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.7, roughness: 0.3 });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(0, 7.0, 0);
  gantryGroup.add(beam);

  // Banner texture: "STREET RUSH"
  const bannerCanvas = document.createElement('canvas');
  bannerCanvas.width = 1024;
  bannerCanvas.height = 128;
  const bCtx = bannerCanvas.getContext('2d')!;

  bCtx.fillStyle = '#06b6d4';
  bCtx.fillRect(0, 0, 1024, 128);

  bCtx.fillStyle = '#090d16';
  bCtx.fillRect(6, 6, 1012, 116);

  // Chequered flag accents
  for (let x = 12; x < 140; x += 16) {
    for (let y = 12; y < 116; y += 16) {
      if ((Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0) {
        bCtx.fillStyle = '#ffffff';
        bCtx.fillRect(x, y, 16, 16);
      }
    }
  }

  bCtx.fillStyle = '#ffffff';
  bCtx.font = 'black 64px sans-serif';
  bCtx.textAlign = 'center';
  bCtx.textBaseline = 'middle';
  bCtx.fillText('★ STREET RUSH ★', 512, 64);

  const bannerTex = new THREE.CanvasTexture(bannerCanvas);
  const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex });
  const bannerFront = new THREE.Mesh(new THREE.PlaneGeometry((barrierDist + 0.4) * 2, 1.2), bannerMat);
  bannerFront.position.set(0, 7.0, 0.81);
  gantryGroup.add(bannerFront);

  // 4 Digital Start Lights on Gantry
  const startLightMeshes: THREE.Mesh[] = [];
  const lightHousingGeo = new THREE.BoxGeometry(0.6, 0.6, 0.2);
  const lightHousingMat = new THREE.MeshStandardMaterial({ color: 0x000000 });

  [-1.8, -0.6, 0.6, 1.8].forEach((xOff) => {
    const housing = new THREE.Mesh(lightHousingGeo, lightHousingMat);
    housing.position.set(xOff, 6.0, 0.82);
    gantryGroup.add(housing);

    const lightBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x334155 }) // Off by default
    );
    lightBulb.position.set(xOff, 6.0, 0.94);
    gantryGroup.add(lightBulb);
    startLightMeshes.push(lightBulb);
  });

  // Start / Finish Line on Road Surface
  const finishLineCanvas = document.createElement('canvas');
  finishLineCanvas.width = 512;
  finishLineCanvas.height = 64;
  const fCtx = finishLineCanvas.getContext('2d')!;

  for (let x = 0; x < 512; x += 32) {
    for (let y = 0; y < 64; y += 32) {
      fCtx.fillStyle = (Math.floor(x / 32) + Math.floor(y / 32)) % 2 === 0 ? '#ffffff' : '#000000';
      fCtx.fillRect(x, y, 32, 32);
    }
  }

  const finishTex = new THREE.CanvasTexture(finishLineCanvas);
  const finishLineMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(halfW * 2, 3.0),
    new THREE.MeshBasicMaterial({ map: finishTex, depthWrite: false })
  );
  finishLineMesh.rotateX(-Math.PI / 2);
  finishLineMesh.position.set(0, 0.04, 0);
  gantryGroup.add(finishLineMesh);

  group.add(gantryGroup);

  // ── 7. CHECKPOINT VISUAL GATES ─────────────────────────────
  const checkpointMeshes: THREE.Mesh[] = [];
  const gateArchGeo = new THREE.PlaneGeometry(halfW * 2, 0.8);

  CHECKPOINTS.forEach((cp, idx) => {
    if (idx === 0) return; // Checkpoint 0 has the main Start/Finish gantry

    const cpMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const cpMesh = new THREE.Mesh(gateArchGeo, cpMat);
    cpMesh.rotateX(-Math.PI / 2);
    cpMesh.position.set(cp.x, 0.05, cp.z);

    // Align with gate normal
    const angle = Math.atan2(cp.dirX, cp.dirZ);
    cpMesh.rotation.z = angle;

    group.add(cpMesh);
    checkpointMeshes.push(cpMesh);
  });

  return {
    group,
    spline,
    samples,
    sampleNormals,
    sampleTangents,
    totalLength,
    startLightMeshes,
    checkpointMeshes,
  };
}
