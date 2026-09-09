const GamePersistenceService = require('../services/GamePersistenceService');

const MAX_PLAYERS = {
  'CHAMBER_CLASH': 6,
  'BLUFF': 6,
  'MEMORY_MATCH': 8,
  'DOTS_AND_BOXES': 8,
  'COLOR_WARS': 8,
  'INK_DECEPTION': 10,
  'FLAPPY_BIRD': 8,
  'PAPER_FALL': 8,
  'ARROW_MAZE': 8,
  'ULTIMATE_TIC_TAC_TOE': 2,
  'DEMOLITION_DERBY': 8,
  'STREET_RUSH': 8,
  'CAR_RACING': 8,
};
const DEFAULT_MAX_PLAYERS = 6;

class LobbyService {
  constructor() {
    this.lobbies = new Map(); // lobbyId -> { id, hostId, gameType, players: Map(userId -> { userId, nickname, isReady, role }), status: "WAITING" }
  }

  /**
   * Remove a user from all lobbies they are currently hosting or part of.
   * @param {string} userId - User to remove
   * @param {string|null} exceptLobbyId - Optional lobby to keep the user in
   * @returns {Array<{ lobbyId: string, deleted: boolean, lobby: any }>}
   */
  async removeUserFromAllLobbies(userId, exceptLobbyId = null) {
    if (!userId) return [];
    const affectedLobbies = [];

    for (const [lobbyId, lobby] of Array.from(this.lobbies.entries())) {
      if (lobbyId === exceptLobbyId) continue;

      if (lobby.players.has(userId) || lobby.hostId === userId) {
        lobby.players.delete(userId);
        await GamePersistenceService.removePlayer(lobbyId, userId).catch(() => {});

        if (lobby.players.size === 0) {
          this.lobbies.delete(lobbyId);
          affectedLobbies.push({ lobbyId, deleted: true, lobby: null });
        } else {
          if (lobby.hostId === userId) {
            const nextHostId = lobby.players.keys().next().value;
            lobby.hostId = nextHostId;
            const nextHost = lobby.players.get(nextHostId);
            if (nextHost) {
              nextHost.role = 'HOST';
              nextHost.isReady = true;
              await GamePersistenceService.addPlayer(lobbyId, nextHostId, nextHost.nickname, 'HOST').catch(() => {});
            }
          }
          affectedLobbies.push({ lobbyId, deleted: false, lobby });
        }
      }
    }

    return affectedLobbies;
  }

  async createLobby(lobbyId, hostId, hostName, gameType, customSettings = {}) {
    // Proactively clean up any previous lobbies the user was in or hosting
    const affectedLobbies = await this.removeUserFromAllLobbies(hostId, lobbyId);

    const hostCarId = customSettings?.selectedCarId || 'road_crusher';
    const isHostAssetReady = customSettings?.assetReady ?? true;
    const lobby = {
      id: lobbyId,
      hostId,
      gameType,
      players: new Map([[hostId, {
        userId: hostId,
        nickname: hostName,
        isReady: true,
        role: 'HOST',
        selectedCarId: hostCarId,
        assetReady: isHostAssetReady
      }]]),
      status: 'WAITING',
      settings: {
        maxPlayers: customSettings?.maxPlayers || MAX_PLAYERS[gameType] || DEFAULT_MAX_PLAYERS,
        boardSize: gameType === 'COLOR_WARS' ? 7 : (gameType === 'DOTS_AND_BOXES' ? 5 : undefined),
        turnTimer: (gameType === 'COLOR_WARS' || gameType === 'DOTS_AND_BOXES' || gameType === 'CHAMBER_CLASH' || gameType === 'ULTIMATE_TIC_TAC_TOE') ? 30 : undefined,
        pairCount: gameType === 'MEMORY_MATCH' ? 12 : undefined,
        mode: gameType === 'PAPER_FALL' ? 'SURVIVAL' : undefined,
        difficulty: (gameType === 'PAPER_FALL' || gameType === 'ULTIMATE_TIC_TAC_TOE') ? 'MEDIUM' : undefined,
        matchDuration: gameType === 'PAPER_FALL' ? 60 : undefined,
        multiplayerMode: gameType === 'ARROW_MAZE' ? 'LEVELS' : undefined,
        levelCount: gameType === 'ARROW_MAZE' ? 10 : undefined,
        timedDuration: gameType === 'ARROW_MAZE' ? 180 : undefined,
        deadTimeLimit: gameType === 'ARROW_MAZE' ? 60 : undefined,
        arenaId: gameType === 'DEMOLITION_DERBY' ? (customSettings?.arenaId || 'arena_1') : undefined,
        arenaIndex: gameType === 'DEMOLITION_DERBY' ? (customSettings?.arenaIndex || 1) : undefined,
        normalizedStats: gameType === 'DEMOLITION_DERBY' ? (customSettings?.normalizedStats ?? true) : undefined,
        ...(customSettings || {}),
      }
    };

    this.lobbies.set(lobbyId, lobby);
    await GamePersistenceService.createSession(lobbyId, gameType).catch(() => {});
    await GamePersistenceService.addPlayer(lobbyId, hostId, hostName, 'HOST').catch(() => {});
    return { lobby, affectedLobbies };
  }

  async joinLobby(lobbyId, userId, nickname, extraData = {}) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { lobby: null, affectedLobbies: [] };
    const maxPlayers = lobby.settings?.maxPlayers || MAX_PLAYERS[lobby.gameType] || DEFAULT_MAX_PLAYERS;
    if (lobby.players.size >= maxPlayers && !lobby.players.has(userId)) {
      return { lobby: null, affectedLobbies: [] };
    }

    // Clean up user from any other lobbies first
    const affectedLobbies = await this.removeUserFromAllLobbies(userId, lobbyId);

    const isHost = lobby.hostId === userId;
    const existingPlayer = lobby.players.get(userId);
    const selectedCarId = extraData?.selectedCarId || existingPlayer?.selectedCarId || 'road_crusher';
    const isJoinerAssetReady = extraData?.assetReady ?? true;

    const player = {
      userId,
      nickname,
      isReady: existingPlayer?.isReady ?? isHost,
      role: isHost ? 'HOST' : 'PLAYER',
      selectedCarId,
      assetReady: isJoinerAssetReady
    };
    lobby.players.set(userId, player);
    await GamePersistenceService.addPlayer(lobbyId, userId, nickname, player.role).catch(() => {});
    return { lobby, affectedLobbies };
  }

  selectCar(lobbyId, userId, carId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { success: false, error: 'Lobby not found' };

    const player = lobby.players.get(userId);
    if (!player) return { success: false, error: 'Player not found in lobby' };

    if (player.isReady && player.role !== 'HOST') {
      return {
        success: false,
        error: 'Cannot change car while READY. Unready first.',
        lobby
      };
    }

    player.selectedCarId = carId;
    return { success: true, lobby };
  }

  async leaveLobby(lobbyId, userId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;

    lobby.players.delete(userId);
    await GamePersistenceService.removePlayer(lobbyId, userId).catch(() => {});

    if (lobby.players.size === 0) {
      this.lobbies.delete(lobbyId);
      return null;
    }

    if (lobby.hostId === userId) {
      // Nominate next host
      const nextHostId = lobby.players.keys().next().value;
      lobby.hostId = nextHostId;
      const nextHost = lobby.players.get(nextHostId);
      if (nextHost) {
        nextHost.role = 'HOST';
        nextHost.isReady = true;
        await GamePersistenceService.addPlayer(lobbyId, nextHostId, nextHost.nickname, 'HOST').catch(() => {});
      }
    }
    return lobby;
  }

  toggleReady(lobbyId, userId, isReady) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;

    const player = lobby.players.get(userId);
    if (player && player.role !== 'HOST') {
      player.isReady = Boolean(isReady);
    }
    return lobby;
  }

  resetReadyStates(lobbyId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;

    for (const player of lobby.players.values()) {
      if (player.role !== 'HOST') {
        player.isReady = false;
      }
    }
    return lobby;
  }

  setLobbyStatus(lobbyId, status) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;
    lobby.status = status;
    return lobby;
  }

  kickPlayer(lobbyId, hostId, targetUserId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby || lobby.hostId !== hostId) return null;

    lobby.players.delete(targetUserId);
    GamePersistenceService.removePlayer(lobbyId, targetUserId).catch(console.error);
    return lobby;
  }

  getLobby(lobbyId) {
    return this.lobbies.get(lobbyId);
  }

  getPublicLobbies() {
    const results = [];
    for (const [id, lobby] of Array.from(this.lobbies.entries())) {
      if (lobby.status !== 'WAITING') continue;
      if (!lobby.players || lobby.players.size === 0) {
        this.lobbies.delete(id);
        continue;
      }
      const host = lobby.players.get(lobby.hostId) || Array.from(lobby.players.values())[0];
      if (!host) {
        this.lobbies.delete(id);
        continue;
      }
      const playersList = Array.from(lobby.players.values()).map(p => ({
        userId: p.userId,
        nickname: p.nickname,
        role: p.role,
        isReady: p.isReady,
        selectedCarId: p.selectedCarId || 'road_crusher',
        assetReady: p.assetReady ?? false
      }));

      results.push({
        id: lobby.id,
        hostId: lobby.hostId,
        hostName: host.nickname || 'Unknown',
        gameType: lobby.gameType,
        players: playersList,
        playerCount: lobby.players.size,
        maxPlayers: lobby.settings?.maxPlayers || MAX_PLAYERS[lobby.gameType] || DEFAULT_MAX_PLAYERS,
        status: lobby.status,
      });
    }
    return results;
  }
}

module.exports = new LobbyService();
