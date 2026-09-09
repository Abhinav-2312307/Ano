/**
 * Street Rush — Centralized Car & Vehicle Physics Configuration
 * All vehicle dynamics tuning values are stored here for easy balance adjustments.
 */

export interface CarSpec {
  id: string;
  name: string;
  modelFile: string; // Existing GLB in /models/derby/
  description: string;
  accentColor: string;
  bodyColor: string;
  maxSpeed: number; // m/s (~3.6 km/h per m/s)
  acceleration: number;
  brakeForce: number;
  handling: number; // Steering multiplier
  driftGrip: number;
  weight: number;
}

export const CAR_SPECS: Record<string, CarSpec> = {
  apex_phantom: {
    id: 'apex_phantom',
    name: 'Apex Phantom',
    modelFile: 'apex_phantom.glb',
    description: 'Sleek aerodynamic supercar built for razor-sharp cornering and top-end speed.',
    accentColor: '#06b6d4', // Cyan
    bodyColor: '#0f172a',
    maxSpeed: 52, // ~187 km/h
    acceleration: 30,
    brakeForce: 38,
    handling: 2.6,
    driftGrip: 0.93,
    weight: 1200,
  },
  road_crusher: {
    id: 'road_crusher',
    name: 'Road Crusher V8',
    modelFile: 'road_crusher.glb',
    description: 'Raw American muscle with thunderous low-end torque and explosive acceleration.',
    accentColor: '#f97316', // Orange
    bodyColor: '#7c2d12',
    maxSpeed: 50, // ~180 km/h
    acceleration: 32,
    brakeForce: 36,
    handling: 2.4,
    driftGrip: 0.90,
    weight: 1550,
  },
  iron_tanker: {
    id: 'iron_tanker',
    name: 'Iron Tanker',
    modelFile: 'iron_tanker.glb',
    description: 'Heavy reinforced chassis that brushes off barrier collisions without losing stride.',
    accentColor: '#eab308', // Amber / Gold
    bodyColor: '#1c1917',
    maxSpeed: 48, // ~173 km/h
    acceleration: 27,
    brakeForce: 42,
    handling: 2.2,
    driftGrip: 0.95,
    weight: 2200,
  },
  armored_juggernaut: {
    id: 'armored_juggernaut',
    name: 'Armored Juggernaut',
    modelFile: 'armored_juggernaut.glb',
    description: 'Armored speed demon with maximum barrier resilience and aggressive wide track.',
    accentColor: '#a855f7', // Purple
    bodyColor: '#18181b',
    maxSpeed: 49, // ~176 km/h
    acceleration: 28,
    brakeForce: 40,
    handling: 2.3,
    driftGrip: 0.92,
    weight: 2400,
  },
};

export const DEFAULT_CAR_ID = 'apex_phantom';

export const GLOBAL_PHYSICS = {
  // Base Speeds & Acceleration
  BASE_MAX_SPEED: 50, // ~180 km/h
  BASE_ACCELERATION: 28, // m/s²
  REVERSE_MAX_SPEED: 14, // ~50 km/h
  REVERSE_ACCELERATION: 16,

  // Nitro System
  NITRO_MULTIPLIER_SPEED: 1.28, // Max speed boosted to ~230 km/h
  NITRO_MULTIPLIER_ACCEL: 1.6, // Rapid blast
  NITRO_CAPACITY: 100, // 100%
  NITRO_DRAIN_PER_SEC: 32, // ~3.1 seconds of continuous burn
  NITRO_RECHARGE_PER_SEC: 12, // Refills in ~8.3 seconds of normal driving

  // Braking & Friction
  BRAKE_FORCE: 38,
  HANDBRAKE_DECEL: 24,
  ENGINE_BRAKE: 20, // Rapid engine deceleration when releasing throttle (~1s to stop)
  SURFACE_FRICTION: 0.96, // Rolling resistance
  OFFROAD_FRICTION: 0.90, // When brushing curbs/grass

  // Steering & Drifting
  STEERING_SPEED: 2.5, // Max yaw rad/s
  STEERING_SPEED_FALLOFF: 0.55, // Higher speed reduces maximum lock angle for stability
  DRIFT_FACTOR: 1.85, // Yaw rotation boost during handbrake
  DRIFT_SLIP_FRICTION: 0.90, // Lateral sliding grip
  DRIFT_SMOKE_MIN_SPEED: 12, // Speed above which drift smoke kicks in

  // Collisions & Rebound
  CAR_RADIUS: 1.8,
  BARRIER_BOUNCE_COEFF: 0.45, // Soft arcade rebound
  BARRIER_SCRAPE_DECEL: 0.75, // Moderate velocity retain on wall scrape
  CAR_CAR_RESTITUTION: 0.6, // Elastic separation between cars
};
