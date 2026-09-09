/**
 * Street Rush — Type Definitions
 */

export type RaceStatus = 'LOBBY' | 'COUNTDOWN' | 'RACING' | 'FINISHED' | 'GAME_OVER';

export interface RaceInputs {
  throttle: number; // 0 to 1
  brake: number; // 0 to 1
  steer: number; // -1 (left) to +1 (right)
  handbrake: boolean; // Drift trigger
  nitro: boolean; // Nitro boost trigger
}

export interface RacerState {
  userId: string;
  nickname: string;
  avatar?: string | null;
  carId: string;
  carColor?: string;
  accentColor?: string;

  // Transform
  x: number;
  y: number;
  z: number;
  rotationY: number;
  pitch?: number;
  roll?: number;

  // Velocity & Dynamics
  speed: number; // m/s
  vx: number;
  vz: number;
  isDrifting: boolean;
  isNitro: boolean;
  nitroMeter: number; // 0 to 100

  // Race Progression
  currentCheckpoint: number; // 0 to totalCheckpoints - 1
  completedLaps: number; // 0 to 3
  progress: number; // Continuous ranking scalar
  wrongWay: boolean;

  // Status & Completion
  isFinished: boolean;
  finishTime: number | null; // Total elapsed ms
  finishPosition: number | null; // 1, 2, 3, 4
  rank: number; // Live dynamic position
  connected: boolean;
}

export interface RankItem {
  userId: string;
  nickname: string;
  avatar?: string | null;
  rank: number;
  completedLaps: number;
  currentCheckpoint: number;
  isFinished: boolean;
  finishTime?: number | null;
  speed: number;
  isLocal?: boolean;
}

export interface SpectatedRacerInfo {
  userId: string;
  nickname: string;
  carId: string;
  rank: number;
  completedLaps: number;
  speedKmh: number;
}

export interface RaceHUDStats {
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
}

export interface RaceResult {
  matchId: string;
  trackName: string;
  totalLaps: number;
  totalRacers: number;
  winner: {
    userId: string;
    nickname: string;
    finishTime: number;
  };
  standings: Array<{
    rank: number;
    userId: string;
    nickname: string;
    avatar?: string | null;
    carId: string;
    finishTime: number | null;
    isDNF: boolean;
  }>;
}

export interface StreetRushLobbyPlayer {
  userId: string;
  nickname: string;
  avatar?: string | null;
  isReady: boolean;
  role: 'HOST' | 'PLAYER';
  selectedCarId: string;
  assetReady?: boolean;
}

export interface StreetRushLobbyState {
  id: string;
  hostId: string;
  hostName?: string;
  gameType: string;
  players: StreetRushLobbyPlayer[];
  playerCount?: number;
  maxPlayers?: number;
  status: 'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'FINISHED';
  settings?: {
    totalLaps?: number;
    maxPlayers?: number;
    trackId?: string;
  } | null;
}
