import { create } from 'zustand';
import { socketService } from '@/lib/socket';
import { useUserStore } from '@/store/useUserStore';
import {
  RaceResult,
  RacerState,
  RaceStatus,
  StreetRushLobbyState,
} from '@/components/games/street-rush/types';
import { DEFAULT_CAR_ID } from '@/components/games/street-rush/config/carConfig';
import { streetRushAudio } from '@/components/games/street-rush/components/StreetRushAudio';

interface StreetRushStoreState {
  // Lobby State
  lobbyState: StreetRushLobbyState | null;
  availableLobbies: StreetRushLobbyState[];
  isCreatingLobby: boolean;
  lobbyError: string | null;
  selectedCarId: string;
  soundMuted: boolean;

  // Race State
  raceStatus: RaceStatus;
  countdownValue: number | null;
  targetLaps: number;
  racersMap: Record<string, RacerState>;
  raceResults: RaceResult | null;

  // Actions
  initLobbySockets: () => void;
  fetchLobbies: () => void;
  clearLobbyError: () => void;
  toggleSound: () => void;
  selectCar: (carId: string) => void;
  setTargetLaps: (laps: number) => void;
  updateLobbySettings: (gameId: string, hostId: string, settings: { totalLaps?: number }) => void;
  reportAssetsReady: (gameId: string, userId: string, carId: string) => void;

  createLobby: (userId: string, nickname: string, carId?: string, totalLaps?: number) => void;
  joinLobby: (gameId: string, userId: string, nickname: string, carId?: string) => void;
  toggleReady: (gameId: string, userId: string, isReady: boolean) => void;
  startMatch: (gameId: string, hostId: string) => void;
  leaveLobby: (gameId: string, userId: string) => void;

  sendTransform: (gameId: string, userId: string, data: any) => void;
  sendCheckpoint: (gameId: string, userId: string, checkpointIndex: number, lap: number) => void;
  sendRacerFinished: (gameId: string, userId: string, finishTime: number) => void;
  sendPlayAgain: (gameId: string, userId: string) => void;
  sendReturnToLobby: (gameId: string, userId: string) => void;
}

let socketListenersAttached = false;

const getInitialSoundMuted = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    const saved = localStorage.getItem('street_rush_sound_muted');
    return saved !== null ? JSON.parse(saved) : true;
  } catch {
    return true;
  }
};

export const useStreetRushStore = create<StreetRushStoreState>((set, get) => ({
  lobbyState: null,
  availableLobbies: [],
  isCreatingLobby: false,
  lobbyError: null,
  selectedCarId: DEFAULT_CAR_ID,
  soundMuted: getInitialSoundMuted(),

  raceStatus: 'LOBBY',
  countdownValue: null,
  targetLaps: 3,
  racersMap: {},
  raceResults: null,

  toggleSound: () => {
    const nextMuted = !get().soundMuted;
    streetRushAudio.setMuted(nextMuted);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('street_rush_sound_muted', JSON.stringify(nextMuted));
      }
    } catch {}
    set({ soundMuted: nextMuted });
  },

  selectCar: (carId: string) => {
    set({ selectedCarId: carId });
    const { lobbyState } = get();
    const socket = socketService.getSocket();
    if (socket && lobbyState?.id) {
      const currentUserId = useUserStore.getState().id || 'guest';
      socket.emit('street_rush_select_car', {
        gameId: lobbyState.id,
        userId: currentUserId,
        carId,
      });
      socket.emit('lobby_select_car', {
        gameId: lobbyState.id,
        userId: currentUserId,
        carId,
      });
    }
  },

  reportAssetsReady: (gameId: string, userId: string, carId: string) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('street_rush_assets_ready', {
        gameId,
        userId,
        selectedCarId: carId,
      });
    }
  },

  clearLobbyError: () => set({ lobbyError: null }),

  initLobbySockets: () => {
    if (socketListenersAttached) return;
    const socket = socketService.getSocket();
    if (!socket) return;
    socketListenersAttached = true;

    // 1. Lobby State Broadcast
    socket.on('lobby_state', (state: StreetRushLobbyState) => {
      if (state && (state.gameType === 'STREET_RUSH' || state.gameType === 'CAR_RACING' || !state.gameType)) {
        const laps = state.settings?.totalLaps || get().targetLaps || 3;
        set({ lobbyState: state, targetLaps: laps, isCreatingLobby: false });
        if (state.status === 'WAITING' && get().raceStatus !== 'GAME_OVER') {
          set({ raceStatus: 'LOBBY', countdownValue: null, raceResults: null });
        }
      }
    });

    // 2. Public Lobbies List
    socket.on('lobbies_list_response', (lobbies: StreetRushLobbyState[]) => {
      const rushLobbies = (lobbies || []).filter(
        (l) => l.gameType === 'STREET_RUSH' || l.gameType === 'CAR_RACING'
      );
      set({ availableLobbies: rushLobbies });
    });

    socket.on('lobbies_updated', (lobbies: StreetRushLobbyState[]) => {
      const rushLobbies = (lobbies || []).filter(
        (l) => l.gameType === 'STREET_RUSH' || l.gameType === 'CAR_RACING'
      );
      set({ availableLobbies: rushLobbies });
    });

    // 3. Countdown Synchronized from Server
    socket.on('game_countdown', (data: { countdownValue: number; totalRacers?: number; spawnData?: any[] }) => {
      streetRushAudio.playCountdownBeep(data.countdownValue === 0);
      set({
        raceStatus: 'COUNTDOWN',
        countdownValue: data.countdownValue,
      });

      // Initialize racers map from spawnData if provided
      if (data.spawnData && Array.isArray(data.spawnData)) {
        const rMap: Record<string, RacerState> = {};
        data.spawnData.forEach((s) => {
          rMap[s.userId] = {
            userId: s.userId,
            nickname: s.nickname,
            carId: s.carId || DEFAULT_CAR_ID,
            x: s.x,
            y: s.y,
            z: s.z,
            rotationY: s.rotationY,
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
        });
        set({ racersMap: rMap });
      }
    });

    // 4. Game Started / Active Racing
    socket.on('game_started', (data: any) => {
      streetRushAudio.playCountdownBeep(true);
      set({
        raceStatus: 'RACING',
        countdownValue: null,
        targetLaps: data.targetLaps || get().targetLaps || 3,
      });

      if (data.racerStates && Array.isArray(data.racerStates)) {
        const rMap: Record<string, RacerState> = {};
        data.racerStates.forEach((s: any) => {
          rMap[s.userId] = { ...s };
        });
        set({ racersMap: rMap });
      }
    });

    // 5. Remote Racer Transform Updates (in-place update for 60fps WebGL loop without React thrashing)
    socket.on('race_transform_update', (data: { userId: string; transform: any }) => {
      const { racersMap } = get();
      if (racersMap[data.userId]) {
        Object.assign(racersMap[data.userId], data.transform);
      }
    });

    // 6. Racer Checkpoint Passed
    socket.on('racer_checkpoint_event', (data: { userId: string; checkpointIndex: number; lap: number }) => {
      const { racersMap } = get();
      if (racersMap[data.userId]) {
        set({
          racersMap: {
            ...racersMap,
            [data.userId]: {
              ...racersMap[data.userId],
              currentCheckpoint: data.checkpointIndex,
              completedLaps: data.lap,
            },
          },
        });
      }
    });

    // 7. Racer Finished
    socket.on('racer_finished_event', (data: { userId: string; finishPosition: number; finishTime: number }) => {
      const { racersMap } = get();
      if (racersMap[data.userId]) {
        set({
          racersMap: {
            ...racersMap,
            [data.userId]: {
              ...racersMap[data.userId],
              isFinished: true,
              finishPosition: data.finishPosition,
              finishTime: data.finishTime,
            },
          },
        });
      }
    });

    // 8. Game Over / Official Standings
    socket.on('game_over', (data: any) => {
      set({
        raceStatus: 'GAME_OVER',
        raceResults: data.results || data,
      });
    });

    // 9. Error handling
    socket.on('game_error', (data: { message: string }) => {
      set({ lobbyError: data.message, isCreatingLobby: false });
    });

    socket.on('lobby_closed', () => {
      set({ lobbyState: null, raceStatus: 'LOBBY', countdownValue: null, raceResults: null });
    });
  },

  setTargetLaps: (laps: number) => {
    set({ targetLaps: laps });
    const { lobbyState } = get();
    const socket = socketService.getSocket();
    if (socket && lobbyState?.id && lobbyState.hostId) {
      socket.emit('lobby_settings_update', {
        gameId: lobbyState.id,
        hostId: lobbyState.hostId,
        settings: { totalLaps: laps },
      });
    }
  },

  updateLobbySettings: (gameId: string, hostId: string, settings: { totalLaps?: number }) => {
    if (settings.totalLaps) {
      set({ targetLaps: settings.totalLaps });
    }
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('lobby_settings_update', {
        gameId,
        hostId,
        settings,
      });
    }
  },

  fetchLobbies: () => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('lobbies_list');
    }
  },

  createLobby: (userId: string, nickname: string, carId?: string, totalLaps?: number) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    set({ isCreatingLobby: true, lobbyError: null });

    const chosenCar = carId || get().selectedCarId || DEFAULT_CAR_ID;
    const laps = totalLaps || get().targetLaps || 3;
    set({ targetLaps: laps });

    socket.emit('lobby_create', {
      gameType: 'STREET_RUSH',
      userId,
      nickname,
      selectedCarId: chosenCar,
      assetReady: true,
      settings: {
        totalLaps: laps,
      },
      totalLaps: laps,
    });
  },

  joinLobby: (gameId: string, userId: string, nickname: string, carId?: string) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    set({ lobbyError: null });

    const chosenCar = carId || get().selectedCarId || DEFAULT_CAR_ID;
    socket.emit('lobby_join', {
      gameId,
      userId,
      nickname,
      selectedCarId: chosenCar,
      assetReady: true,
    });
  },

  toggleReady: (gameId: string, userId: string, isReady: boolean) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('lobby_ready', { gameId, userId, isReady });
    }
  },

  startMatch: (gameId: string, hostId: string) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('game_start', { gameId, hostId });
    }
  },

  leaveLobby: (gameId: string, userId: string) => {
    const socket = socketService.getSocket();
    const { lobbyState } = get();
    const targetGameId = gameId || lobbyState?.id;
    if (socket && targetGameId) {
      socket.emit('lobby_leave', { gameId: targetGameId, userId });
    }
    set({ lobbyState: null, raceStatus: 'LOBBY', countdownValue: null, raceResults: null });
  },

  sendTransform: (gameId: string, userId: string, data: any) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('game_action', {
        gameId,
        userId,
        action: 'race_transform',
        data,
      });
    }
  },

  sendCheckpoint: (gameId: string, userId: string, checkpointIndex: number, lap: number) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('game_action', {
        gameId,
        userId,
        action: 'racer_checkpoint',
        data: { checkpointIndex, lap },
      });
    }
  },

  sendRacerFinished: (gameId: string, userId: string, finishTime: number) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('game_action', {
        gameId,
        userId,
        action: 'racer_finished',
        data: { finishTime },
      });
    }
  },

  sendPlayAgain: (gameId: string, userId: string) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('game_action', {
        gameId,
        userId,
        action: 'play_again',
      });
    }
  },

  sendReturnToLobby: (gameId: string, userId: string) => {
    set({ raceStatus: 'LOBBY', countdownValue: null, raceResults: null });
    const { lobbyState } = get();
    const targetGameId = gameId || lobbyState?.id;
    const socket = socketService.getSocket();
    if (socket && targetGameId) {
      socket.emit('lobby_ready', { gameId: targetGameId, userId, isReady: false });
    }
  },
}));
