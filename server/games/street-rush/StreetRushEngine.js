const BaseGameEngine = require('../engine/BaseGameEngine');

/**
 * 8 Dynamic Staggered Starting Grid Slots behind Start Line (facing -Z)
 */
const SPAWN_SLOTS = [
  { index: 0, x: -3.5, y: 0, z: 12, rotationY: 0 }, // Pole Position (Left)
  { index: 1, x: 3.5, y: 0, z: 20, rotationY: 0 }, // Slot 2 (Right)
  { index: 2, x: -3.5, y: 0, z: 28, rotationY: 0 }, // Slot 3 (Left)
  { index: 3, x: 3.5, y: 0, z: 36, rotationY: 0 }, // Slot 4 (Right)
  { index: 4, x: -3.5, y: 0, z: 44, rotationY: 0 }, // Slot 5 (Left)
  { index: 5, x: 3.5, y: 0, z: 52, rotationY: 0 }, // Slot 6 (Right)
  { index: 6, x: -3.5, y: 0, z: 60, rotationY: 0 }, // Slot 7 (Left)
  { index: 7, x: 3.5, y: 0, z: 68, rotationY: 0 }, // Slot 8 (Right)
];

const TOTAL_CHECKPOINTS = 7; // Checkpoint 0 (Start/Finish) + 1 to 6
const DEFAULT_TOTAL_LAPS = 3;

/**
 * Street Rush — Server-Authoritative 3D Multiplayer Racing Engine
 * Handles 1–8 players, synchronized 3-2-1-GO countdown, dynamic starting grid slots,
 * server-validated sequential checkpoint and lap progression (anti-cheat),
 * authoritative finishing order, and race completion.
 */
class StreetRushEngine extends BaseGameEngine {
  constructor(gameId) {
    super(gameId, 'STREET_RUSH');
    this.targetLaps = DEFAULT_TOTAL_LAPS;
    this.matchId = null;
    this.startTime = null;
    this.countdownTimer = null;
    this.racers = new Map(); // userId -> RacerServerState
    this.finishOrder = []; // userIds in order of finish
    this.results = null;
    this.raceTimeout = null;
  }

  startGame() {
    if (this.status === 'COUNTDOWN' || this.status === 'RACING' || this.countdownTimer) {
      return;
    }

    if (this.players.size < 1) {
      console.log(`[StreetRushEngine] Cannot start race: 0 players in gameId=${this.gameId}`);
      return;
    }

    if (this.settings?.totalLaps) {
      const parsed = Number(this.settings.totalLaps);
      if ([1, 2, 3, 5].includes(parsed)) {
        this.targetLaps = parsed;
      }
    }

    this.matchId = `race_${this.gameId}_${Date.now()}`;
    this.status = 'COUNTDOWN';
    this.finishOrder = [];
    this.results = null;

    // Assign starting grid positions dynamically
    let slotIndex = 0;
    for (const [userId, player] of this.players) {
      const spawn = SPAWN_SLOTS[slotIndex % SPAWN_SLOTS.length];
      const carId = player.selectedCarId || 'apex_phantom';

      this.racers.set(userId, {
        userId,
        nickname: player.nickname,
        avatar: player.avatar || null,
        carId,
        x: spawn.x,
        y: spawn.y,
        z: spawn.z,
        rotationY: spawn.rotationY,
        speed: 0,
        vx: 0,
        vz: 0,
        isDrifting: false,
        isNitro: false,
        currentCheckpoint: 0,
        completedLaps: 0,
        progress: 0,
        isFinished: false,
        finishTime: null,
        finishPosition: null,
        connected: true,
      });

      slotIndex++;
    }

    console.log(`[StreetRushEngine] Starting match ${this.matchId} with ${this.racers.size} racers`);

    // Synchronize 3-2-1-GO Countdown to all clients
    let count = 3;
    const spawnData = Array.from(this.racers.values());

    this.emit('game_countdown', {
      countdownValue: count,
      matchId: this.matchId,
      totalRacers: this.racers.size,
      spawnData,
    });

    this.countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        this.emit('game_countdown', {
          countdownValue: count,
          matchId: this.matchId,
          totalRacers: this.racers.size,
        });
      } else {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.status = 'RACING';
        this.startTime = Date.now();

        console.log(`[StreetRushEngine] Match ${this.matchId} GO! Total racers: ${this.racers.size}`);

        this.emit('game_started', {
          matchId: this.matchId,
          gameId: this.gameId,
          status: 'RACING',
          startTime: this.startTime,
          targetLaps: this.targetLaps,
          racerStates: Array.from(this.racers.values()),
        });

        // 3-minute safety timeout to conclude race if players idle or disconnect
        this.raceTimeout = setTimeout(() => {
          if (this.status === 'RACING') {
            console.log(`[StreetRushEngine] Safety timeout reached for match ${this.matchId}`);
            this._endRace();
          }
        }, 180000);
      }
    }, 1000);
  }

  handlePlayerAction(userId, action, data) {
    // 1. Car Selection in Lobby
    if (action === 'select_car') {
      const carId = data?.carId;
      if (carId && this.players.has(userId)) {
        const p = this.players.get(userId);
        p.selectedCarId = carId;
        return { success: true };
      }
    }

    if (action === 'set_laps' || action === 'update_settings') {
      const laps = Number(data?.totalLaps || data?.laps);
      if ([1, 2, 3, 5].includes(laps)) {
        this.targetLaps = laps;
        if (!this.settings) this.settings = {};
        this.settings.totalLaps = laps;
        return { success: true, forceStateSync: true };
      }
    }

    const racer = this.racers.get(userId);
    if (!racer) {
      return { success: false, error: 'Racer not found in active session' };
    }

    // 2. Transform Update (Position, Speed, Rotation)
    if (action === 'race_transform') {
      if (this.status !== 'RACING') return { success: true };

      racer.x = Number(data.x) || racer.x;
      racer.y = Number(data.y) || racer.y;
      racer.z = Number(data.z) || racer.z;
      racer.rotationY = Number(data.rotationY) || racer.rotationY;
      racer.speed = Number(data.speed) || 0;
      racer.isDrifting = Boolean(data.isDrifting);
      racer.isNitro = Boolean(data.isNitro);
      racer.progress = Number(data.progress) || racer.progress;

      // Broadcast to other racers
      this.emit('race_transform_update', {
        userId,
        transform: {
          x: racer.x,
          y: racer.y,
          z: racer.z,
          rotationY: racer.rotationY,
          speed: racer.speed,
          isDrifting: racer.isDrifting,
          isNitro: racer.isNitro,
          progress: racer.progress,
        },
      });

      return { success: true, forceStateSync: false };
    }

    // 3. Checkpoint Validation
    if (action === 'racer_checkpoint') {
      if (this.status !== 'RACING' || racer.isFinished) return { success: true };

      const reportedCP = Number(data.checkpointIndex);
      const expectedCP = (racer.currentCheckpoint + 1) % TOTAL_CHECKPOINTS;

      // Validate sequential checkpoint progression
      if (reportedCP === expectedCP) {
        racer.currentCheckpoint = reportedCP;

        // If passing Checkpoint 0, validate and increment completed lap
        if (reportedCP === 0) {
          racer.completedLaps += 1;
          console.log(`[StreetRushEngine] Racer ${racer.nickname} completed lap ${racer.completedLaps}/${this.targetLaps}`);

          // Check if racer finished all laps
          if (racer.completedLaps >= this.targetLaps) {
            this._handleRacerFinish(racer, Date.now() - this.startTime);
          }
        }

        this.emit('racer_checkpoint_event', {
          userId,
          checkpointIndex: racer.currentCheckpoint,
          lap: racer.completedLaps,
        });
      }

      return { success: true };
    }

    // 4. Racer Finished Notification
    if (action === 'racer_finished') {
      if (!racer.isFinished && racer.completedLaps >= this.targetLaps) {
        const elapsed = Number(data.finishTime) || (Date.now() - this.startTime);
        this._handleRacerFinish(racer, elapsed);
      }
      return { success: true };
    }

    return { success: true };
  }

  _handleRacerFinish(racer, finishTimeMs) {
    if (racer.isFinished) return;

    racer.isFinished = true;
    racer.finishPosition = this.finishOrder.length + 1;
    racer.finishTime = finishTimeMs;
    this.finishOrder.push(racer.userId);

    console.log(`[StreetRushEngine] Racer ${racer.nickname} FINISHED in position #${racer.finishPosition} time=${finishTimeMs}ms`);

    this.emit('racer_finished_event', {
      userId: racer.userId,
      finishPosition: racer.finishPosition,
      finishTime: racer.finishTime,
    });

    // Check if all connected active racers have finished
    const connectedRacers = Array.from(this.racers.values()).filter((r) => r.connected);
    const allFinished = connectedRacers.every((r) => r.isFinished);

    if (allFinished || this.finishOrder.length >= connectedRacers.length) {
      this._endRace();
    }
  }

  _endRace() {
    if (this.status === 'FINISHED') return;
    this.status = 'FINISHED';

    if (this.raceTimeout) {
      clearTimeout(this.raceTimeout);
      this.raceTimeout = null;
    }

    // Build official final standings
    const standings = [];

    // 1. First, racers that crossed the finish line in order
    this.finishOrder.forEach((uId, idx) => {
      const r = this.racers.get(uId);
      if (r) {
        standings.push({
          rank: idx + 1,
          userId: r.userId,
          nickname: r.nickname,
          avatar: r.avatar,
          carId: r.carId,
          finishTime: r.finishTime,
          isDNF: false,
        });
      }
    });

    // 2. Unfinished or disconnected racers sorted by progress (DNF)
    const unfinished = Array.from(this.racers.values())
      .filter((r) => !this.finishOrder.includes(r.userId))
      .sort((a, b) => b.progress - a.progress);

    unfinished.forEach((r, idx) => {
      standings.push({
        rank: this.finishOrder.length + idx + 1,
        userId: r.userId,
        nickname: r.nickname,
        avatar: r.avatar,
        carId: r.carId,
        finishTime: null,
        isDNF: true,
      });
    });

    const winnerRacer = standings[0] || { userId: '', nickname: 'Nobody', finishTime: 0 };

    this.results = {
      matchId: this.matchId,
      trackName: 'Neon Metropolis Circuit',
      totalLaps: this.targetLaps,
      totalRacers: this.racers.size,
      winner: {
        userId: winnerRacer.userId,
        nickname: winnerRacer.nickname,
        finishTime: winnerRacer.finishTime,
      },
      standings,
    };

    console.log(`[StreetRushEngine] RACE COMPLETE! Winner: ${winnerRacer.nickname}`);

    this.emit('game_over', {
      matchId: this.matchId,
      results: this.results,
    });
  }

  removePlayer(userId) {
    const racer = this.racers.get(userId);
    if (racer) {
      racer.connected = false;
      racer.isFinished = true;
    }

    const removed = super.removePlayer(userId);

    // If all remaining players are finished, conclude race
    if (this.status === 'RACING') {
      const activeRacers = Array.from(this.racers.values()).filter((r) => r.connected && !r.isFinished);
      if (activeRacers.length === 0) {
        this._endRace();
      }
    }

    return removed;
  }

  serializeState(targetUserId) {
    return {
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      matchId: this.matchId,
      targetLaps: this.targetLaps,
      racers: Array.from(this.racers.values()),
      finishOrder: this.finishOrder,
      results: this.results,
    };
  }

  cleanup() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.raceTimeout) {
      clearTimeout(this.raceTimeout);
      this.raceTimeout = null;
    }
    this.racers.clear();
    this.finishOrder = [];
  }
}

module.exports = StreetRushEngine;
