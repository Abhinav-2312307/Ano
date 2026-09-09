import * as THREE from 'three';
import { CAR_SPECS, DEFAULT_CAR_ID, GLOBAL_PHYSICS } from '../config/carConfig';
import { RaceInputs, RacerState } from '../types';
import { TRACK_SETTINGS } from '../config/trackConfig';

export interface CollisionEvent {
  hitBarrier: boolean;
  intensity: number;
}

export function simulateCarPhysics(
  state: RacerState,
  inputs: RaceInputs,
  spline: THREE.CatmullRomCurve3,
  samples: THREE.Vector3[],
  sampleNormals: THREE.Vector3[],
  dt: number = 0.016
): CollisionEvent {
  const spec = CAR_SPECS[state.carId] || CAR_SPECS[DEFAULT_CAR_ID];

  // 1. Nitro Boost Management
  let isNitro = false;
  if (inputs.nitro && state.nitroMeter > 5 && inputs.throttle > 0.1 && state.speed > 5) {
    isNitro = true;
    state.nitroMeter = Math.max(0, state.nitroMeter - GLOBAL_PHYSICS.NITRO_DRAIN_PER_SEC * dt);
  } else {
    state.nitroMeter = Math.min(GLOBAL_PHYSICS.NITRO_CAPACITY, state.nitroMeter + GLOBAL_PHYSICS.NITRO_RECHARGE_PER_SEC * dt);
  }
  state.isNitro = isNitro;

  // 2. Acceleration and Top Speed
  const maxSpeed = isNitro
    ? spec.maxSpeed * GLOBAL_PHYSICS.NITRO_MULTIPLIER_SPEED
    : spec.maxSpeed;

  const accelRate = isNitro
    ? spec.acceleration * GLOBAL_PHYSICS.NITRO_MULTIPLIER_ACCEL
    : spec.acceleration;

  // Forward / Reverse throttle drive
  if (inputs.throttle > 0.05) {
    if (state.speed < maxSpeed) {
      state.speed += inputs.throttle * accelRate * dt;
    }
  } else if (inputs.brake > 0.05) {
    if (state.speed > 0.5) {
      // Active braking
      state.speed = Math.max(0, state.speed - inputs.brake * spec.brakeForce * dt);
    } else {
      // Reverse
      if (state.speed > -GLOBAL_PHYSICS.REVERSE_MAX_SPEED) {
        state.speed -= inputs.brake * GLOBAL_PHYSICS.REVERSE_ACCELERATION * dt;
      }
    }
  } else {
    // Active engine braking: cleanly decelerate to halt when throttle is released
    if (state.speed > 0) {
      state.speed = Math.max(0, state.speed - GLOBAL_PHYSICS.ENGINE_BRAKE * dt);
    } else if (state.speed < 0) {
      state.speed = Math.min(0, state.speed + GLOBAL_PHYSICS.ENGINE_BRAKE * dt);
    }
    state.speed *= Math.pow(GLOBAL_PHYSICS.SURFACE_FRICTION, dt * 60);
    if (Math.abs(state.speed) < 0.25) {
      state.speed = 0;
      state.vx = 0;
      state.vz = 0;
    }
  }

  // 3. Handbrake / Drifting Dynamics
  const isDrifting = inputs.handbrake && Math.abs(state.speed) > GLOBAL_PHYSICS.DRIFT_SMOKE_MIN_SPEED;
  state.isDrifting = isDrifting;

  if (isDrifting) {
    // Handbrake induces slight speed scrubbing but sharp yaw rotation
    state.speed = Math.max(0, state.speed - GLOBAL_PHYSICS.HANDBRAKE_DECEL * 0.4 * dt);
  }

  // 4. Steering and Yaw Rotation
  if (Math.abs(inputs.steer) > 0.02 && Math.abs(state.speed) > 0.4) {
    const speedRatio = Math.min(1.0, Math.abs(state.speed) / 40);
    // At high speeds, lock angle slightly tightens for high-speed stability
    const steerSpeed = GLOBAL_PHYSICS.STEERING_SPEED * spec.handling * (1.0 - speedRatio * (1.0 - GLOBAL_PHYSICS.STEERING_SPEED_FALLOFF));

    const driftBoost = isDrifting ? GLOBAL_PHYSICS.DRIFT_FACTOR : 1.0;
    const direction = state.speed >= 0 ? 1 : -1;

    // In Three.js: steering left (-X) is positive Y rotation, steering right (+X) is negative Y rotation
    const yawDelta = -inputs.steer * steerSpeed * driftBoost * direction * dt;
    state.rotationY += yawDelta;
  }

  // 5. Compute Velocity Vector
  // Forward vector is (-sin(rotY), 0, -cos(rotY))
  const forwardX = -Math.sin(state.rotationY);
  const forwardZ = -Math.cos(state.rotationY);

  if (!isDrifting) {
    state.vx = forwardX * state.speed;
    state.vz = forwardZ * state.speed;
  } else {
    // Lateral slip during drift: blend forward velocity with lateral slide
    const lateralX = Math.cos(state.rotationY);
    const lateralZ = -Math.sin(state.rotationY);
    const slipSpeed = state.speed * inputs.steer * 0.45;

    state.vx = forwardX * state.speed * GLOBAL_PHYSICS.DRIFT_SLIP_FRICTION + lateralX * slipSpeed;
    state.vz = forwardZ * state.speed * GLOBAL_PHYSICS.DRIFT_SLIP_FRICTION + lateralZ * slipSpeed;
  }

  // 6. Integrate Position
  state.x += state.vx * dt;
  state.z += state.vz * dt;

  // 7. Track Boundary Collision
  // Find nearest track centerline sample
  let closestDistSq = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const dx = state.x - s.x;
    const dz = state.z - s.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < closestDistSq) {
      closestDistSq = dSq;
      closestIndex = i;
    }
  }

  const centerPt = samples[closestIndex];
  const normal = sampleNormals[closestIndex];

  // Vector from centerline to car
  const toCarX = state.x - centerPt.x;
  const toCarZ = state.z - centerPt.z;

  // Lateral distance from track centerline (dot with track normal)
  const lateralOffset = toCarX * normal.x + toCarZ * normal.z;
  const maxAllowableOffset = TRACK_SETTINGS.barrierOffset - GLOBAL_PHYSICS.CAR_RADIUS; // ~6.0m

  let collision: CollisionEvent = { hitBarrier: false, intensity: 0 };

  if (Math.abs(lateralOffset) > maxAllowableOffset) {
    collision.hitBarrier = true;
    const overshoot = Math.abs(lateralOffset) - maxAllowableOffset;
    collision.intensity = Math.min(1.0, overshoot * 1.5 + (Math.abs(state.speed) / 40) * 0.8);

    // Push car back inside boundary along track normal
    const sign = lateralOffset > 0 ? 1 : -1;
    const correctionDist = overshoot + 0.2;
    state.x -= normal.x * sign * correctionDist;
    state.z -= normal.z * sign * correctionDist;

    // Dampen forward velocity on barrier scrape
    state.speed *= GLOBAL_PHYSICS.BARRIER_SCRAPE_DECEL;
    if (Math.abs(state.speed) < 0.3) {
      state.speed = 0;
    }
    state.vx = forwardX * state.speed;
    state.vz = forwardZ * state.speed;
  }

  return collision;
}

/**
 * Elastic car-to-car collision resolution
 */
export function resolveCarCarCollisions(racers: RacerState[]): void {
  const radius = GLOBAL_PHYSICS.CAR_RADIUS;
  const minDist = radius * 2;
  const minDistSq = minDist * minDist;

  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i];
      const b = racers[j];

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < minDistSq && distSq > 0.001) {
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;

        const nx = dx / dist;
        const nz = dz / dist;

        // Separate cars equally
        a.x -= nx * overlap * 0.5;
        a.z -= nz * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.z += nz * overlap * 0.5;

        // Gentle momentum transfer
        const avgSpeed = (a.speed + b.speed) * 0.5;
        a.speed = a.speed * 0.7 + avgSpeed * 0.3;
        b.speed = b.speed * 0.7 + avgSpeed * 0.3;
      }
    }
  }
}
