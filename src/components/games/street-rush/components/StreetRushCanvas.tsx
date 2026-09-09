import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RaceInputs, RacerState, RaceStatus, RankItem, SpectatedRacerInfo } from '../types';
import { buildStreetRushTrack, Track3DScene } from './StreetRushTrackBuilder';
import {
  createStreetRushVehicle,
  updateStreetRushVehicleVisuals,
  Vehicle3DInstance,
} from './StreetRushVehicleBuilder';
import { StreetRushCameraController } from './StreetRushCamera';
import { StreetRushParticleSystem } from './StreetRushParticles';
import { streetRushAudio } from './StreetRushAudio';
import { simulateCarPhysics, resolveCarCarCollisions } from '../systems/carPhysics';
import { updateRaceProgress } from '../systems/raceProgress';
import { computeLiveRankings } from '../systems/ranking';
import { SPAWN_SLOTS, TRACK_SETTINGS } from '../config/trackConfig';
import { useStreetRushStore } from '@/store/useStreetRushStore';

interface StreetRushCanvasProps {
  status: RaceStatus;
  countdownValue: number | null;
  localUserId: string;
  localNickname: string;
  localCarId: string;
  inputsRef: React.MutableRefObject<RaceInputs>;
  spectateTargetId?: string | null;
  onSpectateTargetChange?: (targetUserId: string) => void;
  onRacerCheckpoint: (checkpointIndex: number, lap: number) => void;
  onRacerFinished: (finishTime: number) => void;
  onSendTransform: (data: {
    x: number;
    y: number;
    z: number;
    rotationY: number;
    speed: number;
    isDrifting: boolean;
    isNitro: boolean;
    currentCheckpoint: number;
    completedLaps: number;
    progress: number;
  }) => void;
  targetLaps?: number;
  onStatsUpdate: (stats: {
    speedKmh: number;
    nitroMeter: number;
    isNitro: boolean;
    isDrifting: boolean;
    currentLap: number;
    currentCheckpoint: number;
    wrongWay: boolean;
    localRank: number;
    isFinished: boolean;
    finishPosition: number | null;
    rankings: RankItem[];
    isSpectating: boolean;
    spectatedRacer: SpectatedRacerInfo | null;
    availableSpectateTargets: Array<{
      userId: string;
      nickname: string;
      rank: number;
    }>;
  }) => void;
}

export const StreetRushCanvas: React.FC<StreetRushCanvasProps> = ({
  status,
  countdownValue,
  targetLaps = 3,
  localUserId,
  localNickname,
  localCarId,
  inputsRef,
  spectateTargetId,
  onSpectateTargetChange,
  onRacerCheckpoint,
  onRacerFinished,
  onSendTransform,
  onStatsUpdate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep latest props and callbacks in mutable refs to avoid tearing down WebGL on re-render
  const statusRef = useRef(status);
  statusRef.current = status;

  const countdownValRef = useRef(countdownValue);
  countdownValRef.current = countdownValue;

  const targetLapsRef = useRef(targetLaps);
  targetLapsRef.current = targetLaps;

  const spectateTargetIdRef = useRef<string | null>(spectateTargetId || null);
  spectateTargetIdRef.current = spectateTargetId || null;

  const callbacksRef = useRef({
    onRacerCheckpoint,
    onRacerFinished,
    onSendTransform,
    onStatsUpdate,
    onSpectateTargetChange,
  });
  callbacksRef.current = {
    onRacerCheckpoint,
    onRacerFinished,
    onSendTransform,
    onStatsUpdate,
    onSpectateTargetChange,
  };

  // Internal mutable reference to active spectating target
  const activeSpectatingUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isDisposed = false;
    let animFrameId: number;
    let lastTime = performance.now();

    // ── 1. THREE.JS SCENE, CAMERA, RENDERER ────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060812);
    scene.fog = new THREE.FogExp2(0x060812, 0.0032);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const cameraCtrl = new StreetRushCameraController(65, width / height);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // ── 2. LIGHTING ───────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x0f172a, 0.85);
    scene.add(ambientLight);

    const moonLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    moonLight.position.set(30, 70, -20);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 1024;
    moonLight.shadow.mapSize.height = 1024;
    moonLight.shadow.camera.near = 10;
    moonLight.shadow.camera.far = 200;
    moonLight.shadow.camera.left = -70;
    moonLight.shadow.camera.right = 70;
    moonLight.shadow.camera.top = 70;
    moonLight.shadow.camera.bottom = -70;
    scene.add(moonLight);

    // ── 3. BUILD TRACK & PARTICLES ────────────────────────────
    const track: Track3DScene = buildStreetRushTrack();
    scene.add(track.group);

    const particles = new StreetRushParticleSystem();
    scene.add(particles.group);

    // ── 4. RACER VEHICLES INSTANCES ───────────────────────────
    const vehicleInstances = new Map<string, Vehicle3DInstance>();

    // Determine initial spawn slot (prefer server authoritative spawn from racersMap)
    const initialRacers = useStreetRushStore.getState().racersMap;
    const myServerRacer = initialRacers[localUserId];
    const myIndex = Object.keys(initialRacers).indexOf(localUserId);
    const fallbackSpawn = SPAWN_SLOTS[myIndex >= 0 ? myIndex % SPAWN_SLOTS.length : 0];
    const spawn = {
      x: myServerRacer?.x ?? fallbackSpawn.x,
      y: myServerRacer?.y ?? fallbackSpawn.y,
      z: myServerRacer?.z ?? fallbackSpawn.z,
      rotationY: myServerRacer?.rotationY ?? fallbackSpawn.rotationY,
    };

    const localRacerState: RacerState = {
      userId: localUserId,
      nickname: localNickname,
      carId: localCarId,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      rotationY: spawn.rotationY,
      speed: 0,
      vx: 0,
      vz: 0,
      isDrifting: false,
      isNitro: false,
      nitroMeter: 100,
      currentCheckpoint: 0,
      completedLaps: 0,
      progress: 0,
      wrongWay: false,
      isFinished: false,
      finishTime: null,
      finishPosition: null,
      rank: 1,
      connected: true,
    };

    const localVeh = createStreetRushVehicle(localCarId, localNickname, true, 1);
    localVeh.root.position.set(spawn.x, spawn.y, spawn.z);
    localVeh.root.rotation.y = spawn.rotationY;
    scene.add(localVeh.root);
    vehicleInstances.set(localUserId, localVeh);

    // Start engine audio
    streetRushAudio.startEngineSound();

    let lastNetworkSync = 0;
    let lastStatsUpdate = 0;
    let raceStartTime = 0;

    // ── KEYBOARD SHORTCUTS FOR SPECTATOR TARGET CYCLING ───────
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!localRacerState.isFinished) return;
      const racers = useStreetRushStore.getState().racersMap;
      const activeRacers = Object.values(racers).filter(
        (r) => r.userId !== localUserId && !r.isFinished
      );
      if (activeRacers.length <= 1) return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        const currIdx = activeRacers.findIndex((r) => r.userId === activeSpectatingUserIdRef.current);
        const prevIdx = currIdx <= 0 ? activeRacers.length - 1 : currIdx - 1;
        const target = activeRacers[prevIdx];
        activeSpectatingUserIdRef.current = target.userId;
        cameraCtrl.snapTo(target.x, target.y, target.z, target.rotationY);
        callbacksRef.current.onSpectateTargetChange?.(target.userId);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        const currIdx = activeRacers.findIndex((r) => r.userId === activeSpectatingUserIdRef.current);
        const nextIdx = (currIdx + 1) % activeRacers.length;
        const target = activeRacers[nextIdx];
        activeSpectatingUserIdRef.current = target.userId;
        cameraCtrl.snapTo(target.x, target.y, target.z, target.rotationY);
        callbacksRef.current.onSpectateTargetChange?.(target.userId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // ── 5. GAME LOOP ──────────────────────────────────────────
    const animate = (currentTime: number) => {
      if (isDisposed) return;
      animFrameId = requestAnimationFrame(animate);

      const dt = Math.min(0.04, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      const currentStatus = statusRef.current;
      const currentCountdown = countdownValRef.current;
      const inputs = inputsRef.current;

      // ── Update Start Lights on Gantry based on countdown ────
      if (track.startLightMeshes.length >= 4) {
        if (currentStatus === 'COUNTDOWN') {
          const redVal = currentCountdown === 3 ? 1 : currentCountdown === 2 ? 2 : 3;
          track.startLightMeshes.forEach((mesh, idx) => {
            const mat = mesh.material as THREE.MeshBasicMaterial;
            mat.color.setHex(idx < redVal ? 0xef4444 : 0x334155);
          });
        } else if (currentStatus === 'RACING') {
          track.startLightMeshes.forEach((mesh) => {
            const mat = mesh.material as THREE.MeshBasicMaterial;
            mat.color.setHex(0x22c55e);
          });
        }
      }

      // ── Remote Vehicle Sync & Spawning (Direct Store Query) ──
      const currentRacers = useStreetRushStore.getState().racersMap;
      for (const [racerId, rState] of Object.entries(currentRacers)) {
        if (racerId === localUserId) continue;

        let remoteVeh = vehicleInstances.get(racerId);
        if (!remoteVeh) {
          remoteVeh = createStreetRushVehicle(
            rState.carId || 'apex_phantom',
            rState.nickname || 'Racer',
            false,
            rState.rank || 2
          );
          scene.add(remoteVeh.root);
          vehicleInstances.set(racerId, remoteVeh);
        }

        // Smooth lerp towards network transform
        const lerpFactor = Math.min(1.0, 14 * dt);
        remoteVeh.root.position.x += (rState.x - remoteVeh.root.position.x) * lerpFactor;
        remoteVeh.root.position.y += (rState.y - remoteVeh.root.position.y) * lerpFactor;
        remoteVeh.root.position.z += (rState.z - remoteVeh.root.position.z) * lerpFactor;

        let diffY = rState.rotationY - remoteVeh.root.rotation.y;
        while (diffY < -Math.PI) diffY += Math.PI * 2;
        while (diffY > Math.PI) diffY -= Math.PI * 2;
        remoteVeh.root.rotation.y += diffY * lerpFactor;

        updateStreetRushVehicleVisuals(
          remoteVeh,
          remoteVeh.root.position.x,
          remoteVeh.root.position.y,
          remoteVeh.root.position.z,
          remoteVeh.root.rotation.y,
          rState.speed || 0,
          0,
          rState.isDrifting || false,
          rState.isNitro || false,
          rState.rank || 2,
          rState.nickname || 'Racer',
          dt
        );
      }

      // Remove disconnected vehicles
      for (const [vehId, vInstance] of vehicleInstances.entries()) {
        if (vehId !== localUserId && !currentRacers[vehId]) {
          scene.remove(vInstance.root);
          vehicleInstances.delete(vehId);
        }
      }

      // ── Local Vehicle Simulation (When Racing & Not Finished) ──
      if (currentStatus === 'RACING' && !localRacerState.isFinished) {
        if (raceStartTime === 0) raceStartTime = performance.now();

        // 1. Run arcade physics simulation
        const col = simulateCarPhysics(
          localRacerState,
          inputs,
          track.spline,
          track.samples,
          track.sampleNormals,
          dt
        );

        if (col.hitBarrier) {
          streetRushAudio.playImpactSound(col.intensity);
          cameraCtrl.triggerImpulse(col.intensity * 0.4);
        }

        // 2. Audio & Particle effects
        const isAccelerating = inputs.throttle > 0.1;
        streetRushAudio.updateEngineSound(Math.abs(localRacerState.speed) / 50, isAccelerating);

        if (localRacerState.isNitro) {
          streetRushAudio.startNitroSound();
          const fwdX = -Math.sin(localRacerState.rotationY);
          const fwdZ = -Math.cos(localRacerState.rotationY);
          particles.emitNitro(localRacerState.x, localRacerState.y + 0.3, localRacerState.z, fwdX, fwdZ);
        } else {
          streetRushAudio.stopNitroSound();
        }

        if (localRacerState.isDrifting) {
          streetRushAudio.playTireScreech();
          particles.emitSmoke(localRacerState.x, localRacerState.y, localRacerState.z, localRacerState.vx, localRacerState.vz);
        }

        // 3. Multi-car collision resolution
        const allRacersList = [
          localRacerState,
          ...Object.values(currentRacers).filter((r) => r.userId !== localUserId),
        ];
        resolveCarCarCollisions(allRacersList);

        // 4. Checkpoint & Lap progression
        const activeTotalLaps = targetLapsRef.current || TRACK_SETTINGS.totalLaps;
        const cpResult = updateRaceProgress(localRacerState, activeTotalLaps);

        if (cpResult.passedCheckpoint) {
          streetRushAudio.playCheckpointDing();
          callbacksRef.current.onRacerCheckpoint(cpResult.checkpointIndex, localRacerState.completedLaps);
        }

        if (cpResult.isRaceFinished) {
          streetRushAudio.playFinishFanfare();
          localRacerState.isFinished = true;
          localRacerState.finishTime = Math.round(performance.now() - raceStartTime);
          callbacksRef.current.onRacerFinished(localRacerState.finishTime);
        }

        // 5. Send Transform to Network (~25Hz)
        if (currentTime - lastNetworkSync > 40) {
          lastNetworkSync = currentTime;
          callbacksRef.current.onSendTransform({
            x: localRacerState.x,
            y: localRacerState.y,
            z: localRacerState.z,
            rotationY: localRacerState.rotationY,
            speed: localRacerState.speed,
            isDrifting: localRacerState.isDrifting,
            isNitro: localRacerState.isNitro,
            currentCheckpoint: localRacerState.currentCheckpoint,
            completedLaps: localRacerState.completedLaps,
            progress: localRacerState.progress,
          });
        }
      } else if (localRacerState.isFinished) {
        // Coast gently to a stop past the finish line
        if (localRacerState.speed > 0) {
          localRacerState.speed = Math.max(0, localRacerState.speed - 16 * dt);
          localRacerState.x += -Math.sin(localRacerState.rotationY) * localRacerState.speed * dt;
          localRacerState.z += -Math.cos(localRacerState.rotationY) * localRacerState.speed * dt;
        }
        streetRushAudio.updateEngineSound(localRacerState.speed / 50, false);
        streetRushAudio.stopNitroSound();
      } else if (currentStatus === 'COUNTDOWN' || currentStatus === 'LOBBY') {
        // Enforce stationary idle state on starting grid
        localRacerState.speed = 0;
        localRacerState.vx = 0;
        localRacerState.vz = 0;
        localRacerState.x = spawn.x;
        localRacerState.y = spawn.y;
        localRacerState.z = spawn.z;
        localRacerState.rotationY = spawn.rotationY;
        streetRushAudio.updateEngineSound(0, false);
      }

      // ── Update Local Vehicle 3D Visuals ─────────────────────
      updateStreetRushVehicleVisuals(
        localVeh,
        localRacerState.x,
        localRacerState.y,
        localRacerState.z,
        localRacerState.rotationY,
        localRacerState.speed,
        localRacerState.isFinished ? 0 : inputs.steer,
        localRacerState.isDrifting,
        localRacerState.isNitro,
        localRacerState.rank,
        localRacerState.nickname,
        dt
      );

      // ── Compute Live Rankings ───────────────────────────────
      const allRacersForRank = [
        localRacerState,
        ...Object.values(currentRacers).filter((r) => r.userId !== localUserId),
      ];
      const liveRankings = computeLiveRankings(allRacersForRank, localUserId);

      // ── SPECTATING MODE LOGIC ───────────────────────────────
      const activeUnfinishedRacers = Object.values(currentRacers).filter(
        (r) => r.userId !== localUserId && !r.isFinished
      );

      let isSpectating = false;
      let spectatedRacerInfo: SpectatedRacerInfo | null = null;

      if (localRacerState.isFinished && activeUnfinishedRacers.length > 0) {
        isSpectating = true;

        // Honor external prop if requested, otherwise maintain current or pick leader
        if (spectateTargetIdRef.current && activeUnfinishedRacers.some((r) => r.userId === spectateTargetIdRef.current)) {
          if (activeSpectatingUserIdRef.current !== spectateTargetIdRef.current) {
            activeSpectatingUserIdRef.current = spectateTargetIdRef.current;
            const t = currentRacers[spectateTargetIdRef.current];
            if (t) cameraCtrl.snapTo(t.x, t.y, t.z, t.rotationY);
          }
        }

        const currentTargetValid = activeSpectatingUserIdRef.current && activeUnfinishedRacers.some((r) => r.userId === activeSpectatingUserIdRef.current);
        if (!currentTargetValid) {
          activeUnfinishedRacers.sort((a, b) => (a.rank || 99) - (b.rank || 99));
          const leadRacer = activeUnfinishedRacers[0];
          activeSpectatingUserIdRef.current = leadRacer.userId;
          cameraCtrl.snapTo(leadRacer.x, leadRacer.y, leadRacer.z, leadRacer.rotationY);
          callbacksRef.current.onSpectateTargetChange?.(leadRacer.userId);
        }

        const targetId = activeSpectatingUserIdRef.current || activeUnfinishedRacers[0].userId;
        const targetRacer = currentRacers[targetId] || activeUnfinishedRacers[0];
        const targetVeh = vehicleInstances.get(targetId);

        const targetX = targetVeh ? targetVeh.root.position.x : targetRacer.x;
        const targetY = targetVeh ? targetVeh.root.position.y : targetRacer.y;
        const targetZ = targetVeh ? targetVeh.root.position.z : targetRacer.z;
        const targetRotY = targetVeh ? targetVeh.root.rotation.y : targetRacer.rotationY;

        // 3rd-person chase camera follows spectated car
        cameraCtrl.update(
          targetX,
          targetY,
          targetZ,
          targetRotY,
          targetRacer.speed || 0,
          targetRacer.isNitro || false,
          targetRacer.isDrifting || false,
          dt
        );

        spectatedRacerInfo = {
          userId: targetRacer.userId,
          nickname: targetRacer.nickname,
          carId: targetRacer.carId,
          rank: targetRacer.rank || 1,
          completedLaps: targetRacer.completedLaps || 0,
          speedKmh: Math.round(Math.abs(targetRacer.speed || 0) * 3.6),
        };
      } else {
        // Normal gameplay camera on local car
        cameraCtrl.update(
          localRacerState.x,
          localRacerState.y,
          localRacerState.z,
          localRacerState.rotationY,
          localRacerState.speed,
          localRacerState.isNitro,
          localRacerState.isDrifting,
          dt
        );
      }

      // ── Particle System Update ──────────────────────────────
      particles.update(dt);

      // ── Throttled HUD Reporting (~10Hz) ─────────────────────
      if (currentTime - lastStatsUpdate > 100 || localRacerState.isFinished) {
        lastStatsUpdate = currentTime;
        callbacksRef.current.onStatsUpdate({
          speedKmh: isSpectating && spectatedRacerInfo ? spectatedRacerInfo.speedKmh : Math.round(Math.abs(localRacerState.speed) * 3.6),
          nitroMeter: Math.round(localRacerState.nitroMeter),
          isNitro: isSpectating && spectatedRacerInfo ? Boolean(currentRacers[spectatedRacerInfo.userId]?.isNitro) : localRacerState.isNitro,
          isDrifting: isSpectating && spectatedRacerInfo ? Boolean(currentRacers[spectatedRacerInfo.userId]?.isDrifting) : localRacerState.isDrifting,
          currentLap: isSpectating && spectatedRacerInfo ? spectatedRacerInfo.completedLaps : localRacerState.completedLaps,
          currentCheckpoint: localRacerState.currentCheckpoint,
          wrongWay: isSpectating ? false : localRacerState.wrongWay,
          localRank: localRacerState.finishPosition || localRacerState.rank,
          isFinished: localRacerState.isFinished,
          finishPosition: localRacerState.finishPosition,
          rankings: liveRankings,
          isSpectating,
          spectatedRacer: spectatedRacerInfo,
          availableSpectateTargets: activeUnfinishedRacers.map((r) => ({
            userId: r.userId,
            nickname: r.nickname,
            rank: r.rank || 1,
          })),
        });
      }

      // ── Render ──────────────────────────────────────────────
      renderer.render(scene, cameraCtrl.camera);
    };

    animFrameId = requestAnimationFrame(animate);

    // Resize listener
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraCtrl.setAspect(w / h);
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);

      streetRushAudio.stopEngineSound();
      streetRushAudio.stopNitroSound();

      particles.dispose();
      renderer.dispose();
      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [localUserId, localCarId]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full overflow-hidden bg-[#060812]" />;
};
