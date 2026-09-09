/**
 * Street Rush — Track & Circuit Configuration
 * Neon City Industrial Street Circuit:
 * Start/Finish -> Long Straight -> 90° Turn 1 -> Short Straight -> Sweeping Turn 2
 * -> Industrial Chicane -> Back Straight -> Final 90° Turn -> Home Straight.
 */

export interface TrackWaypoint {
  x: number;
  z: number;
}

export interface CheckpointGate {
  index: number;
  name: string;
  x: number;
  z: number;
  // Direction along which cars must pass through
  dirX: number;
  dirZ: number;
  radius: number; // Trigger radius
  width: number; // Visual gate width
}

export interface SpawnSlot {
  index: number;
  x: number;
  y: number;
  z: number;
  rotationY: number;
}

export const TRACK_SETTINGS = {
  name: 'Neon Metropolis Circuit',
  totalLaps: 3,
  trackWidth: 14.0, // meters wide
  halfWidth: 7.0,
  barrierOffset: 7.8, // Outer barrier wall distance from centerline
  curbWidth: 0.9,
};

/**
 * Closed loop centerline waypoints (smoothed via Catmull-Rom spline in 3D builder)
 */
export const TRACK_CENTERLINE_NODES: TrackWaypoint[] = [
  // Home Straight & Start/Finish (z = 0)
  { x: 0, z: 40 },
  { x: 0, z: 10 },
  { x: 0, z: -30 },
  { x: 0, z: -80 },
  { x: 0, z: -115 },

  // Turn 1: 90-degree fast right hander
  { x: 12, z: -136 },
  { x: 34, z: -145 },
  { x: 65, z: -145 },

  // Acceleration Straight 1
  { x: 95, z: -145 },
  { x: 125, z: -145 },

  // Turn 2: Wide sweeping high-speed carousel
  { x: 155, z: -135 },
  { x: 175, z: -110 },
  { x: 180, z: -70 },
  { x: 175, z: -25 },

  // Industrial Chicane (technical narrow S-curve)
  { x: 165, z: 5 },
  { x: 145, z: 25 },
  { x: 135, z: 45 },
  { x: 130, z: 70 },

  // Back Straight (long high-speed nitro straight)
  { x: 110, z: 75 },
  { x: 80, z: 75 },
  { x: 50, z: 75 },

  // Final Turn (90-degree left sweep back onto the home straight)
  { x: 26, z: 70 },
  { x: 10, z: 58 },
  { x: 0, z: 40 }, // Loops back smoothly
];

/**
 * 7 Sequential Checkpoints (0 to 6)
 * Checkpoint 0 is the Start/Finish line.
 */
export const CHECKPOINTS: CheckpointGate[] = [
  {
    index: 0,
    name: 'START / FINISH',
    x: 0,
    z: 0,
    dirX: 0,
    dirZ: -1, // Facing forward into the track
    radius: 10.0,
    width: 15.0,
  },
  {
    index: 1,
    name: 'TURN 1 APEX',
    x: 48,
    z: -145,
    dirX: 1,
    dirZ: 0,
    radius: 10.0,
    width: 15.0,
  },
  {
    index: 2,
    name: 'SECTOR 1 STRAIGHT',
    x: 110,
    z: -145,
    dirX: 1,
    dirZ: 0,
    radius: 10.0,
    width: 15.0,
  },
  {
    index: 3,
    name: 'NEON CAROUSEL',
    x: 178,
    z: -60,
    dirX: 0,
    dirZ: 1,
    radius: 11.0,
    width: 15.0,
  },
  {
    index: 4,
    name: 'CHICANE EXIT',
    x: 138,
    z: 50,
    dirX: -0.5,
    dirZ: 0.86,
    radius: 10.0,
    width: 15.0,
  },
  {
    index: 5,
    name: 'NITRO BACKSTRAIGHT',
    x: 80,
    z: 75,
    dirX: -1,
    dirZ: 0,
    radius: 10.0,
    width: 15.0,
  },
  {
    index: 6,
    name: 'FINAL HAIRPIN',
    x: 10,
    z: 55,
    dirX: -0.6,
    dirZ: -0.8,
    radius: 10.0,
    width: 15.0,
  },
];

/**
 * Staggered grid starting positions behind the start line (facing -Z)
 */
export const SPAWN_SLOTS: SpawnSlot[] = [
  { index: 0, x: -3.5, y: 0, z: 12, rotationY: 0 }, // Pole Position (Left)
  { index: 1, x: 3.5, y: 0, z: 20, rotationY: 0 }, // Slot 2 (Right)
  { index: 2, x: -3.5, y: 0, z: 28, rotationY: 0 }, // Slot 3 (Left)
  { index: 3, x: 3.5, y: 0, z: 36, rotationY: 0 }, // Slot 4 (Right)
  { index: 4, x: -3.5, y: 0, z: 44, rotationY: 0 }, // Slot 5 (Left)
  { index: 5, x: 3.5, y: 0, z: 52, rotationY: 0 }, // Slot 6 (Right)
  { index: 6, x: -3.5, y: 0, z: 60, rotationY: 0 }, // Slot 7 (Left)
  { index: 7, x: 3.5, y: 0, z: 68, rotationY: 0 }, // Slot 8 (Right)
];
