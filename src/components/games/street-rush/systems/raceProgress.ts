import { CHECKPOINTS, TRACK_SETTINGS } from '../config/trackConfig';
import { RacerState } from '../types';

export interface CheckpointCrossResult {
  passedCheckpoint: boolean;
  checkpointIndex: number;
  completedLap: boolean;
  isRaceFinished: boolean;
}

export function updateRaceProgress(
  racer: RacerState,
  totalLaps: number = TRACK_SETTINGS.totalLaps
): CheckpointCrossResult {
  const result: CheckpointCrossResult = {
    passedCheckpoint: false,
    checkpointIndex: racer.currentCheckpoint,
    completedLap: false,
    isRaceFinished: racer.isFinished,
  };

  if (racer.isFinished) {
    return result;
  }

  const totalCPs = CHECKPOINTS.length; // 7 checkpoints (0 to 6)
  const nextCheckpointIndex = (racer.currentCheckpoint + 1) % totalCPs;
  const gate = CHECKPOINTS[nextCheckpointIndex];

  // Vector from gate center to car
  const dx = racer.x - gate.x;
  const dz = racer.z - gate.z;
  const distSq = dx * dx + dz * dz;

  // Car forward vector
  const carForwardX = -Math.sin(racer.rotationY);
  const carForwardZ = -Math.cos(racer.rotationY);

  // Wrong Way check: dot product with current gate direction
  const currentGate = CHECKPOINTS[racer.currentCheckpoint];
  const alignDot = carForwardX * currentGate.dirX + carForwardZ * currentGate.dirZ;
  racer.wrongWay = alignDot < -0.35 && racer.speed > 3;

  // Check if car is inside gate radius
  if (distSq <= gate.radius * gate.radius) {
    // Verify forward passage through gate
    const forwardPassDot = carForwardX * gate.dirX + carForwardZ * gate.dirZ;

    if (forwardPassDot > 0.05 || distSq <= 5.0 * 5.0) {
      // Valid sequential checkpoint passage!
      racer.currentCheckpoint = nextCheckpointIndex;
      result.passedCheckpoint = true;
      result.checkpointIndex = nextCheckpointIndex;

      // Checkpoint 0 crossing means a lap was completed
      if (nextCheckpointIndex === 0) {
        racer.completedLaps += 1;
        result.completedLap = true;

        if (racer.completedLaps >= totalLaps) {
          racer.isFinished = true;
          result.isRaceFinished = true;
        }
      }
    }
  }

  // Calculate continuous progress scalar for live ranking
  const distToNext = Math.sqrt(distSq);
  const normalizedSectorProgress = Math.max(0, Math.min(1, 1 - distToNext / (gate.radius * 3.5)));

  if (racer.isFinished) {
    // Keep finished racers ranked at the top, ordered by their finish time or position
    const timeBonus = racer.finishTime ? Math.max(0, 1000000 - racer.finishTime) : 0;
    racer.progress = 1000000 + (10 - (racer.finishPosition || 10)) * 10000 + timeBonus;
  } else {
    racer.progress = racer.completedLaps * 1000 + racer.currentCheckpoint * 100 + normalizedSectorProgress * 100;
  }

  return result;
}
