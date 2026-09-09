const LobbyService = require('../lobby/LobbyService');
const BluffEngine = require('../bluff/BluffEngine');
const MemoryMatchEngine = require('../memory-match/MemoryMatchEngine');
const DotsAndBoxesEngine = require('../dots-and-boxes/DotsAndBoxesEngine');
const ColorWarsEngine = require('../color-wars/ColorWarsEngine');
const ScribbleEngine = require('../scribble/ScribbleEngine');
const InkDeceptionEngine = require('../ink-deception/InkDeceptionEngine');
const ChamberClashEngine = require('../chamber-clash/ChamberClashEngine');
const FlappyBirdEngine = require('../flappy-bird/FlappyBirdEngine');
const PaperFallEngine = require('../paper-fall/PaperFallEngine');
const ArrowMazeEngine = require('../arrow-maze/ArrowMazeEngine');
const UltimateTicTacToeEngine = require('../ultimate-tic-tac-toe/UltimateTicTacToeEngine');
const DemolitionDerbyEngine = require('../demolition-derby/DemolitionDerbyEngine');
const StreetRushEngine = require('../street-rush/StreetRushEngine');
const userService = require('../../services/userService');
const presenceService = require('../../services/presenceService');

const ENGINE_MAP = {
  'BLUFF': BluffEngine,
  'MEMORY_MATCH': MemoryMatchEngine,
  'DOTS_AND_BOXES': DotsAndBoxesEngine,
  'COLOR_WARS': ColorWarsEngine,
  'SCRIBBLE': ScribbleEngine,
  'INK_DECEPTION': InkDeceptionEngine,
  'CHAMBER_CLASH': ChamberClashEngine,
  'FLAPPY_BIRD': FlappyBirdEngine,
  'PAPER_FALL': PaperFallEngine,
  'ARROW_MAZE': ArrowMazeEngine,
  'ULTIMATE_TIC_TAC_TOE': UltimateTicTacToeEngine,
  'DEMOLITION_DERBY': DemolitionDerbyEngine,
  'STREET_RUSH': StreetRushEngine,
  'CAR_RACING': StreetRushEngine,
};

const GAME_DISPLAY_NAMES = presenceService.GAME_DISPLAY_NAMES || {
  'BLUFF': 'Bluff',
  'MEMORY_MATCH': 'Memory Match',
  'DOTS_AND_BOXES': 'Dots and Boxes',
  'COLOR_WARS': 'Color Wars',
  'SCRIBBLE': 'Scribble',
  'INK_DECEPTION': 'Ink & Deception',
  'CHAMBER_CLASH': 'Chamber Clash',
  'FLAPPY_BIRD': 'Flappy Bird',
  'PAPER_FALL': 'PaperFall',
  'ARROW_MAZE': 'Arrow Maze',
  'ULTIMATE_TIC_TAC_TOE': 'Ultimate Tic-Tac-Toe',
  'DEMOLITION_DERBY': 'Demolition Derby',
  'STREET_RUSH': 'Street Rush',
  'CAR_RACING': 'Street Rush',
};

// In-memory chat message buffer for active game lobbies and matches (gameId -> Message[])
const gameChatMessages = new Map();

function registerGameSockets(io, socket, onlineUsers, activeGames, socketToUser) {
  // Helper to update and broadcast user presence changes
  const updatePresence = async (userId, presenceStatus) => {
    try {
      await userService.updatePresenceStatus(userId, presenceStatus);
      io.emit('user_presence_change', { userId, presenceStatus });
    } catch (err) {
      console.error('Failed to update presence:', err.message);
    }
  };

  // Helper to serialize lobby map for client
  const serializeLobby = (lobby) => {
    if (!lobby) return null;
    const playersList = Array.from(lobby.players.values()).map(p => ({
      userId: p.userId,
      nickname: p.nickname,
      isReady: p.isReady,
      role: p.role,
      selectedCarId: p.selectedCarId || 'road_crusher',
      vehicleId: p.selectedCarId || 'road_crusher',
      assetReady: p.assetReady ?? false
    }));
    const hostPlayer = lobby.players.get(lobby.hostId) || playersList[0];
    return {
      id: lobby.id,
      hostId: lobby.hostId,
      hostName: hostPlayer?.nickname || lobby.hostName || 'Unknown',
      gameType: lobby.gameType,
      players: playersList,
      playerCount: playersList.length,
      maxPlayers: lobby.settings?.maxPlayers || (lobby.gameType === 'STREET_RUSH' || lobby.gameType === 'CAR_RACING' ? 8 : (lobby.maxPlayers || 8)),
      status: lobby.status,
      settings: lobby.settings || null
    };
  };

  // Helper to broadcast updated lobby list to all connected clients
  const broadcastLobbies = () => {
    io.emit('lobbies_updated', LobbyService.getPublicLobbies());
  };

  // ========================
  // LOBBY ACTIONS
  // ========================

  // Client requests the current list of public lobbies
  socket.on('lobbies_list', () => {
    socket.emit('lobbies_list_response', LobbyService.getPublicLobbies());
  });

  socket.on('lobby_create', async (payload) => {
    const { gameType, userId, nickname, selectedCarId, arenaId, assetReady, settings, ...extraSettings } = payload || {};
    console.log(`Lobby create requested by ${nickname} (${userId}) for ${gameType} car=${selectedCarId} assetReady=${assetReady}`);
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const customSettings = {
      ...(selectedCarId ? { selectedCarId } : {}),
      ...(arenaId ? { arenaId } : {}),
      assetReady: assetReady !== undefined ? Boolean(assetReady) : true,
      ...(settings || {}),
      ...extraSettings
    };
    const { lobby, affectedLobbies } = await LobbyService.createLobby(gameId, userId, nickname, gameType, customSettings);

    // Notify any previous lobbies that the user left
    if (affectedLobbies && affectedLobbies.length > 0) {
      for (const affected of affectedLobbies) {
        socket.leave(affected.lobbyId);
        if (affected.deleted) {
          io.to(affected.lobbyId).emit('lobby_closed', { message: 'Host left or closed the lobby.' });
        } else if (affected.lobby) {
          io.to(affected.lobbyId).emit('lobby_state', serializeLobby(affected.lobby));
        }
      }
    }

    socket.join(gameId);
    socket.emit('lobby_state', serializeLobby(lobby));
    io.to(gameId).emit('lobby_state', serializeLobby(lobby));
    await presenceService.setOnline(userId, socket.id);
    broadcastLobbies();
  });

  socket.on('lobby_join', async (payload) => {
    const { gameId, userId, nickname, selectedCarId, assetReady, ...extraData } = payload || {};
    console.log(`Player ${nickname} (${userId}) joined lobby ${gameId} with car=${selectedCarId} assetReady=${assetReady}`);

    const { lobby, affectedLobbies } = await LobbyService.joinLobby(gameId, userId, nickname, {
      selectedCarId,
      assetReady: assetReady !== undefined ? Boolean(assetReady) : true,
      ...extraData
    });
    if (!lobby) {
      return socket.emit('game_error', { message: 'Lobby is full or no longer exists.' });
    }

    // Leave any previous socket rooms for affected lobbies and notify them
    if (affectedLobbies && affectedLobbies.length > 0) {
      for (const affected of affectedLobbies) {
        socket.leave(affected.lobbyId);
        if (affected.deleted) {
          io.to(affected.lobbyId).emit('lobby_closed', { message: 'Host left or closed the lobby.' });
        } else if (affected.lobby) {
          io.to(affected.lobbyId).emit('lobby_state', serializeLobby(affected.lobby));
        }
      }
    }

    socket.join(gameId);
    socket.emit('lobby_state', serializeLobby(lobby));
    io.to(gameId).emit('lobby_state', serializeLobby(lobby));
    await presenceService.setOnline(userId, socket.id);
    broadcastLobbies();
  });

  socket.on('lobby_ready', ({ gameId, userId, isReady }) => {
    const lobby = LobbyService.toggleReady(gameId, userId, isReady);
    if (lobby) {
      io.to(gameId).emit('lobby_state', serializeLobby(lobby));
    }
  });

  // ── CHAMBER CLASH: Client reports all assets finished loading ──
  socket.on('chamber_clash_assets_ready', ({ gameId, userId, assetVersion }) => {
    const EXPECTED_ASSET_VERSION = 'v1';
    const lobby = LobbyService.getLobby(gameId);
    if (!lobby) return;
    let player = lobby.players.get(userId);
    if (!player && userId) {
      player = Array.from(lobby.players.values()).find(p => p.userId === userId);
    }
    if (!player) return;

    if (assetVersion !== EXPECTED_ASSET_VERSION) {
      console.warn(`[ASSET READY] Player ${userId} sent wrong asset version: ${assetVersion}, expected ${EXPECTED_ASSET_VERSION}`);
      player.assetReady = false;
    } else {
      player.assetReady = true;
      console.log(`[ASSET READY] Player ${userId} assets ready (${assetVersion}) in lobby ${gameId}`);
    }

    io.to(gameId).emit('lobby_state', serializeLobby(lobby));
    broadcastLobbies();
  });

  // ── DEMOLITION DERBY: Client reports all 3D vehicle & arena assets finished loading ──
  socket.on('derby_assets_ready', ({ gameId, userId, selectedCarId }) => {
    const lobby = LobbyService.getLobby(gameId);
    if (!lobby) return;
    let player = lobby.players.get(userId);
    if (!player && userId) {
      player = Array.from(lobby.players.values()).find(p => p.userId === userId);
    }
    if (!player) return;

    player.assetReady = true;
    if (selectedCarId) {
      player.selectedCarId = selectedCarId;
    }
    console.log(`[DERBY ASSETS READY] Player ${userId} (${player.nickname}) vehicle ${player.selectedCarId || 'road_crusher'} assets ready in lobby ${gameId}`);

    io.to(gameId).emit('lobby_state', serializeLobby(lobby));
    broadcastLobbies();
  });

  // ── STREET RUSH: Client reports all 3D vehicle & circuit assets finished loading ──
  socket.on('street_rush_assets_ready', ({ gameId, userId, selectedCarId }) => {
    const lobby = LobbyService.getLobby(gameId);
    if (!lobby) return;
    let player = lobby.players.get(userId);
    if (!player && userId) {
      player = Array.from(lobby.players.values()).find(p => p.userId === userId);
    }
    if (!player) return;

    player.assetReady = true;
    if (selectedCarId) {
      player.selectedCarId = selectedCarId;
    }
    console.log(`[STREET RUSH ASSETS READY] Player ${userId} (${player.nickname}) vehicle ${player.selectedCarId || 'apex_phantom'} assets ready in lobby ${gameId}`);

    io.to(gameId).emit('lobby_state', serializeLobby(lobby));
    broadcastLobbies();
  });

  socket.on('lobby_kick', ({ gameId, hostId, targetUserId }) => {
    const lobby = LobbyService.kickPlayer(gameId, hostId, targetUserId);
    if (lobby) {
      io.to(gameId).emit('lobby_state', serializeLobby(lobby));
      // Notify target client they were kicked
      io.emit(`lobby_kicked_${gameId}_${targetUserId}`, { message: 'You have been kicked by the host.' });
      broadcastLobbies();
    }
  });

  socket.on('lobby_leave', async ({ gameId, userId }) => {
    console.log(`Player ${userId} leaving lobby ${gameId}`);
    const lobby = await LobbyService.leaveLobby(gameId, userId);
    socket.leave(gameId);
    await presenceService.clearPlaying(userId, socket.id, gameId);

    if (lobby) {
      io.to(gameId).emit('lobby_state', serializeLobby(lobby));
    } else {
      io.to(gameId).emit('lobby_closed', { message: 'Lobby has been closed.' });
    }
    broadcastLobbies();
    
    // Also remove from active game if playing
    const engine = activeGames.get(gameId);
    if (engine && engine.status !== 'FINISHED') {
      const removed = engine.removePlayer(userId);
      if (removed) {
        broadcastGameStates(gameId, engine);
        if (engine.players.size === 0) {
          activeGames.delete(gameId);
        }
      }
    }

    broadcastLobbies();
  });

  const handleLobbyInvite = async (data) => {
    try {
      const { gameId, targetUserId } = data || {};
      const senderId = data?.senderId || data?.hostId;
      const senderName = data?.senderName || data?.hostName || 'Someone';
      const gameType = data?.gameType || 'FLAPPY_BIRD';

      if (!targetUserId || !gameId) return;

      const notificationService = require('../../services/notificationService');
      const notif = await notificationService.createNotification({
        recipientId: targetUserId,
        senderId,
        type: 'room_invite',
        title: `${senderName} invited you to play!`,
        message: `Join their ${GAME_DISPLAY_NAMES[gameType] || gameType} lobby.`,
        metadata: { gameId, gameType }
      });

      if (notif) {
        const recipientSockets = onlineUsers.get(targetUserId);
        if (recipientSockets) {
          for (const socketId of recipientSockets) {
            io.to(socketId).emit('new_notification', notif);
          }
        }
      }
    } catch (err) {
      console.error('Failed to send game invite:', err.message);
    }
  };

  socket.on('lobby_invite', handleLobbyInvite);
  socket.on('game_invite', handleLobbyInvite);

  socket.on('lobby_settings_update', ({ gameId, hostId, settings }) => {
    const lobby = LobbyService.getLobby(gameId);
    if (lobby && lobby.hostId === hostId) {
      lobby.settings = { ...lobby.settings, ...settings };
      io.to(gameId).emit('lobby_state', serializeLobby(lobby));
      broadcastLobbies();
    }
  });

  // ========================
  // IN-GAME MULTIPLAYER CHAT
  // ========================

  socket.on('game_chat_send', ({ gameId, userId, nickname, avatar, text }) => {
    if (!gameId || !userId || !text || typeof text !== 'string') return;
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500) return;

    const message = {
      id: `gmsg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      gameId,
      senderId: userId,
      senderName: nickname || 'Player',
      senderAvatar: avatar || null,
      text: trimmed,
      timestamp: Date.now(),
      system: false
    };

    if (!gameChatMessages.has(gameId)) {
      gameChatMessages.set(gameId, []);
    }
    const history = gameChatMessages.get(gameId);
    history.push(message);
    if (history.length > 100) history.shift();

    // Broadcast to everyone currently in the lobby / match room
    io.to(gameId).emit('game_chat_message', message);
  });

  socket.on('game_chat_get_history', ({ gameId }) => {
    if (!gameId) return;
    const history = gameChatMessages.get(gameId) || [];
    socket.emit('game_chat_history', { gameId, messages: history });
  });

  // ========================
  // GAME CONTROL EVENTS
  // ========================

  socket.on('game_start', async ({ gameId, hostId }) => {
    const lobby = LobbyService.getLobby(gameId);
    if (!lobby || lobby.hostId !== hostId) {
      return socket.emit('game_error', { message: 'Only the host can start the game.' });
    }

    if (lobby.status === 'PLAYING' || lobby.status === 'COUNTDOWN') {
      console.log(`[GameSocket] Game already in progress or starting for lobby ${gameId}`);
      return;
    }

    if (lobby.players.size < 2 && lobby.gameType !== 'ARROW_MAZE' && lobby.gameType !== 'PAPER_FALL' && lobby.gameType !== 'STREET_RUSH') {
      return socket.emit('game_error', { message: 'You need at least 2 players to start!' });
    }

    const playersList = Array.from(lobby.players.values());
    const nonHostPlayers = playersList.filter(p => p.role !== 'HOST' && p.userId !== lobby.hostId);
    const allReady = nonHostPlayers.length === 0 || nonHostPlayers.every(p => p.isReady);
    if (!allReady) {
      return socket.emit('game_error', { message: 'Wait for all players to be ready!' });
    }

    // For Chamber Clash, every player must have finished loading assets
    if (lobby.gameType === 'CHAMBER_CLASH') {
      const allAssetsReady = playersList.every(p => p.assetReady === true);
      if (!allAssetsReady) {
        const notReady = playersList.filter(p => !p.assetReady).map(p => p.nickname).join(', ');
        return socket.emit('game_error', { message: `PLAYERS_NOT_ASSET_READY: Waiting for ${notReady} to finish loading game assets.` });
      }
    }

    const EngineClass = ENGINE_MAP[lobby.gameType];
    if (!EngineClass) {
      return socket.emit('game_error', { message: 'Unsupported game type.' });
    }

    // Clean up existing engine for this gameId if any
    const existingEngine = activeGames.get(gameId);
    if (existingEngine && typeof existingEngine.cleanup === 'function') {
      existingEngine.cleanup();
    }

    let engine = new EngineClass(gameId);
    engine.onEvent = (type, data) => {
      io.to(gameId).emit(type, data);

      // Automatically update presence to spectator on player elimination or race finish
      if (type === 'player_eliminated' && data && data.playerId) {
        presenceService.setPlaying(data.playerId, null, {
          gameId,
          gameType: engine.gameType,
          isSpectating: true
        }).catch(console.error);
      }
      if (type === 'racer_finished_event' && data && data.userId) {
        presenceService.setPlaying(data.userId, null, {
          gameId,
          gameType: engine.gameType,
          isSpectating: true
        }).catch(console.error);
      }

      // When match completes: reset ready states on the server and broadcast authoritative lobby state
      if (type === 'game_over') {
        const activeLobby = LobbyService.getLobby(gameId);
        if (activeLobby) {
          activeLobby.status = 'WAITING';
          LobbyService.resetReadyStates(gameId);
          io.to(gameId).emit('lobby_state', serializeLobby(activeLobby));
          broadcastLobbies();
        }
      }

      // Dual-cast to player-specific socket channels to ensure 100% delivery
      if (engine.players) {
        engine.players.forEach((p, id) => {
          const sockets = onlineUsers.get(id);
          if (sockets) {
            sockets.forEach(sId => io.to(sId).emit(type, data));
          }
        });
      }

      // Auto-sync game state on critical events to prevent desyncs (e.g. on timeouts or skip turns)
      const SYNC_EVENTS = ['round_started', 'turn_started', 'player_damaged', 'player_healed', 'player_eliminated', 'game_started', 'round_finished', 'status_added', 'status_removed', 'extra_turn_granted', 'shell_inverted', 'shell_ejected', 'item_stolen'];
      if (SYNC_EVENTS.includes(type)) {
        broadcastGameStates(gameId, engine);
      }
    };
    engine.onPrivateEvent = (targetUserId, type, data) => {
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach(sId => io.to(sId).emit(type, data));
      }
    };

    if (lobby.settings) {
      engine.settings = { ...engine.settings, ...lobby.settings };
    }

    lobby.players.forEach(p => {
      const chosenCar = p.selectedCarId || p.vehicleId || 'road_crusher';
      engine.players.set(p.userId, {
        userId: p.userId,
        nickname: p.nickname,
        role: p.role,
        isReady: true,
        isOnline: true,
        selectedCarId: chosenCar,
        vehicleId: chosenCar,
        hand: []
      });
    });

    engine._broadcastCallback = () => {
      broadcastGameStates(gameId, engine);
    };

    // Keep the lobby alive in LobbyService with PLAYING status!
    lobby.status = 'PLAYING';
    engine.startGame();
    activeGames.set(gameId, engine);
    broadcastLobbies();

    for (const p of playersList) {
      const userSockets = onlineUsers.get(p.userId);
      const playerSocketId = userSockets ? Array.from(userSockets)[0] : null;
      await presenceService.setPlaying(p.userId, playerSocketId, {
        gameId,
        gameType: lobby.gameType,
        isSpectating: false
      });
    }

    broadcastGameStates(gameId, engine);
  });

  const broadcastGameStates = (gameId, engine) => {
    console.log(`[${new Date().toISOString()}] [GameSocket] broadcastGameStates for gameType="${engine.gameType}" gameId="${gameId}". Player count: ${engine.players.size}`);
    engine.players.forEach((p, id) => {
      const sockets = onlineUsers.get(id);
      console.log(`[${new Date().toISOString()}] [GameSocket] Player "${p.nickname}" (${id}) online sockets:`, sockets ? Array.from(sockets) : 'none');
      if (sockets) {
        sockets.forEach(sId => {
          console.log(`[${new Date().toISOString()}] [GameSocket] Emitting game_state for "${p.nickname}" to socket ${sId}`);
          io.to(sId).emit('game_state', engine.serializeState(id));
        });
      }
    });

    engine.spectators.forEach(specId => {
      const sockets = onlineUsers.get(specId);
      if (sockets) {
        sockets.forEach(sId => {
          io.to(sId).emit('game_state', engine.serializeState(null));
        });
      }
    });
  };

  // ========================
  // PLAYPLAY ACTION EVENTS
  // ========================

  socket.on('game_action', ({ gameId, userId, action, data }) => {
    const engine = activeGames.get(gameId);
    if (!engine) {
      const lobby = LobbyService.getLobby(gameId);
      if (lobby) {
        const effectiveUserId = userId || socketToUser?.get(socket.id)?.userId;
        if (action === 'select_car') {
          const carId = data?.carId;
          const res = LobbyService.selectCar(gameId, effectiveUserId, carId);
          if (res && res.error) {
            return socket.emit('game_error', { message: res.error });
          }
          io.to(gameId).emit('lobby_state', serializeLobby(lobby));
          broadcastLobbies();
          return;
        }
        if (action === 'set_laps' || action === 'update_settings') {
          const laps = Number(data?.totalLaps || data?.laps);
          if ([1, 2, 3, 5].includes(laps)) {
            if (!lobby.settings) lobby.settings = {};
            lobby.settings.totalLaps = laps;
            io.to(gameId).emit('lobby_state', serializeLobby(lobby));
            broadcastLobbies();
          }
          return;
        }
        return;
      }
      return socket.emit('game_error', { message: 'Game session not found.' });
    }

    if (action === 'play_again' && engine.status === 'FINISHED') {
      const isParticipant = engine.players.has(userId);
      if (!isParticipant) {
        return socket.emit('game_error', { message: 'You are not a participant in this game.' });
      }

      const hostP = Array.from(engine.players.values()).find(p => p.role === 'HOST') || Array.from(engine.players.values())[0];
      const hostId = hostP ? hostP.userId : userId;
      const hostName = hostP ? hostP.nickname : (engine.players.get(userId)?.nickname || 'Host');

      // Re-create lobby with same ID and current players
      const LobbyService = require('../lobby/LobbyService');
      const newLobby = {
        id: gameId,
        gameType: engine.gameType,
        hostId: hostId,
        hostName: hostName,
        players: new Map(Array.from(engine.players.values()).map(p => [
          p.userId,
          {
            userId: p.userId,
            nickname: p.nickname,
            role: p.userId === hostId ? 'HOST' : 'PLAYER',
            isReady: p.userId === hostId
          }
        ])),
        settings: engine.settings,
        status: 'WAITING',
        createdAt: new Date(),
        maxPlayers: engine.gameType === 'SCRIBBLE' ? 12 : (engine.gameType === 'ULTIMATE_TIC_TAC_TOE' ? 2 : 8),
        isPrivate: engine.settings?.isPrivate || false
      };

      LobbyService.lobbies.set(gameId, newLobby);
      activeGames.delete(gameId);

      // Clear playing presence for all players in this game
      engine.players.forEach((p, pId) => {
        presenceService.clearPlaying(pId, null, gameId).catch(console.error);
      });

      const serialized = serializeLobby(newLobby);
      io.to(gameId).emit('lobby_state', serialized);

      // Also directly emit to all participant sockets to ensure delivery
      engine.players.forEach((p, pId) => {
        const sockets = onlineUsers.get(pId);
        if (sockets) {
          sockets.forEach(sId => {
            io.to(sId).emit('lobby_state', serialized);
          });
        }
      });

      broadcastLobbies();
      return;
    }

    const res = engine.handlePlayerAction(userId, action, data);
    if (!res.success) {
      return socket.emit('game_error', { message: res.error });
    }

    if (action === 'challenge_bluff' && res.challengeResult) {
      io.to(gameId).emit('game_challenge_reveal', res.challengeResult);
    }

    // Generic broadcast event support for any engine
    if (res.broadcastEvent) {
      io.to(gameId).emit(res.broadcastEvent.type, res.broadcastEvent.data);
    }
    if (res.broadcastEvents && Array.isArray(res.broadcastEvents)) {
      res.broadcastEvents.forEach(evt => {
        io.to(gameId).emit(evt.type, evt.data);
      });
    }
    if (res.privateEvents && Array.isArray(res.privateEvents)) {
      res.privateEvents.forEach(evt => {
        const sockets = onlineUsers.get(evt.userId);
        if (sockets) {
          sockets.forEach(sId => io.to(sId).emit(evt.type, evt.data));
        }
      });
    }

    if (res.forceStateSync !== false) {
      broadcastGameStates(gameId, engine);
    }

    // Wire up delayed broadcast callback (used by MemoryMatch for mismatch flip-back)
    engine._broadcastCallback = () => {
      broadcastGameStates(gameId, engine);
    };

    if (engine.status === 'FINISHED' && engine.gameType !== 'SCRIBBLE' && engine.gameType !== 'DEMOLITION_DERBY' && engine.gameType !== 'STREET_RUSH' && engine.gameType !== 'CAR_RACING') {
      setTimeout(() => {
        engine.players.forEach(p => {
          presenceService.clearPlaying(p.userId, null, gameId).catch(console.error);
        });
        activeGames.delete(gameId);
      }, 5000);
    }
  });

  // ========================
  // SCRIBBLE SPECIFIC EVENTS
  // ========================

  socket.on('scribble_canvas_event', ({ gameId, userId, action, data }) => {
    // We only broadcast to the room, we don't store strokes to avoid DB bloat
    const engine = activeGames.get(gameId);
    if (!engine || engine.gameType !== 'SCRIBBLE') return;
    
    // Only the drawer can draw
    if (engine.currentDrawerId !== userId) return;

    // Broadcast stroke/tool change to everyone else in the game
    socket.to(gameId).emit('scribble_canvas_event', { action, data });
  });

  socket.on('scribble_save_canvas', async ({ gameId, userId, imageData }) => {
    const engine = activeGames.get(gameId);
    if (!engine || engine.gameType !== 'SCRIBBLE') return;
    
    if (engine.currentDrawerId !== userId) return;
    
    console.log(`[Scribble] Received canvas image to save for game ${gameId}`);
  });

  // ========================
  // INK & DECEPTION CANVAS EVENTS
  // ========================
  socket.on('ink_deception_canvas_event', ({ gameId, userId, action, data }) => {
    const engine = activeGames.get(gameId);
    if (!engine || engine.gameType !== 'INK_DECEPTION') return;
    
    // Server validation: only active drawer can broadcast drawing coordinates
    if (engine.turnState === 'DRAWING') {
      const activeDrawerId = engine.drawingQueue[engine.currentDrawerIndex];
      if (activeDrawerId !== userId) return;
    } else {
      return;
    }

    socket.to(gameId).emit('ink_deception_canvas_event', { action, data });
  });

  socket.on('ink_deception_save_canvas', async ({ gameId, userId, imageData }) => {
    const engine = activeGames.get(gameId);
    if (!engine || engine.gameType !== 'INK_DECEPTION') return;
    
    const activeDrawerId = engine.drawingQueue[engine.currentDrawerIndex];
    if (activeDrawerId !== userId) return;
    
    console.log(`[Ink & Deception] Received canvas image to save for game ${gameId}`);
  });

  // Handle sudden disconnects (e.g. closing tab)
  socket.on('disconnect', () => {
    let disconnectedUserId = null;
    for (const [uId, sockets] of onlineUsers.entries()) {
      if (sockets.has(socket.id)) {
        disconnectedUserId = uId;
        break;
      }
    }

    if (disconnectedUserId) {
      const userSockets = onlineUsers.get(disconnectedUserId);
      if (userSockets && userSockets.size > 1) {
        // User has other active tabs, don't remove from games
        return;
      }

      // 1. Clean up lobbies
      for (const [lobbyId, lobby] of LobbyService.lobbies.entries()) {
        if (lobby.players.has(disconnectedUserId)) {
          LobbyService.leaveLobby(lobbyId, disconnectedUserId).then(updatedLobby => {
            if (updatedLobby) {
              io.to(lobbyId).emit('lobby_state', serializeLobby(updatedLobby));
            }
            broadcastLobbies();
          }).catch(console.error);
        }
      }

      // 2. Clean up active games
      for (const [gameId, engine] of activeGames.entries()) {
        if (engine.players.has(disconnectedUserId)) {
          if (engine.gameType === 'INK_DECEPTION') {
            engine.handlePlayerDisconnect(disconnectedUserId);
            broadcastGameStates(gameId, engine);
          } else {
            if (engine.status !== 'FINISHED') {
              const removed = engine.removePlayer(disconnectedUserId);
              if (removed) {
                broadcastGameStates(gameId, engine);
                if (engine.players.size === 0) activeGames.delete(gameId);
              }
            }
          }
        }
      }
    }
  });

  socket.on('game_reconnect', async ({ gameId, userId }) => {
    const engine = activeGames.get(gameId);
    if (!engine) {
      return socket.emit('game_error', { message: 'Game session not found or finished.' });
    }

    const player = engine.players.get(userId);
    if (player) {
      if (engine.gameType === 'INK_DECEPTION') {
        engine.handlePlayerReconnect(userId);
      } else {
        player.isOnline = true;
      }
      socket.join(gameId);
      socket.emit('game_state', engine.serializeState(userId));
      io.to(gameId).emit('player_reconnected', { userId, nickname: player.nickname });
      broadcastGameStates(gameId, engine);

      await presenceService.setPlaying(userId, socket.id, {
        gameId,
        gameType: engine.gameType,
        isSpectating: player.isAlive === false
      });
    }
  });

  socket.on('game_spectate', async ({ gameId, userId }) => {
    const engine = activeGames.get(gameId);
    if (!engine) {
      return socket.emit('game_error', { message: 'Game session not found.' });
    }

    engine.spectators.add(userId);
    socket.join(gameId);
    socket.emit('game_state', engine.serializeState(null));

    await presenceService.setPlaying(userId, socket.id, {
      gameId,
      gameType: engine.gameType,
      isSpectating: true
    });
  });

  // ========================
  // FLAPPY BIRD SPECIFIC SOCKET EVENTS
  // ========================
  socket.on('flappy_jump', ({ gameId, userId, y, vy }) => {
    const engine = activeGames.get(gameId);
    if (engine && typeof engine.handleJump === 'function') {
      const res = engine.handleJump(userId, y, vy);
      if (res) {
        socket.to(gameId).emit('flappy_jump', res);
      }
    }
  });

  socket.on('flappy_death', ({ gameId, userId, score, timeSurvived }) => {
    const engine = activeGames.get(gameId);
    if (engine && typeof engine.handlePlayerDeath === 'function') {
      const res = engine.handlePlayerDeath(userId, score, timeSurvived);
      if (res) {
        io.to(gameId).emit('flappy_death', res);
        broadcastGameStates(gameId, engine);
      }
    }
  });

  const restoreLobbyFromEngine = (gameId, engine) => {
    let lobby = LobbyService.getLobby(gameId);
    if (!lobby && engine) {
      const hostUser = Array.from(engine.players.values()).find(p => p.role === 'HOST') || Array.from(engine.players.values())[0];
      const hostId = hostUser ? hostUser.userId : '';
      const hostName = hostUser ? hostUser.nickname : 'Player';

      const playersMap = new Map();
      for (const p of engine.players.values()) {
        const pState = engine.playerStates ? engine.playerStates.get(p.userId) : null;
        playersMap.set(p.userId, {
          userId: p.userId,
          nickname: p.nickname,
          role: p.role || (p.userId === hostId ? 'HOST' : 'PLAYER'),
          isReady: p.userId === hostId,
          selectedCarId: p.selectedCarId || pState?.vehicleId || 'road_crusher'
        });
      }

      lobby = {
        id: gameId,
        hostId,
        gameType: engine.gameType || 'DEMOLITION_DERBY',
        players: playersMap,
        status: 'WAITING',
        settings: engine.settings || { maxPlayers: 8 },
        createdAt: new Date()
      };
      LobbyService.lobbies.set(gameId, lobby);
    } else if (lobby) {
      lobby.status = 'WAITING';
      for (const p of lobby.players.values()) {
        p.isReady = false;
      }
    }
    return lobby;
  };

  socket.on('flappy_return_to_lobby', async ({ gameId, userId }) => {
    const engine = activeGames.get(gameId);
    if (engine && typeof engine.handleReturnToLobby === 'function') {
      engine.handleReturnToLobby(userId);
      broadcastGameStates(gameId, engine);
    }

    await presenceService.clearPlaying(userId, socket.id, gameId);

    // Only restore the lobby when the game is actually finished
    // If game is still in progress (other players alive), don't create a lobby yet
    if (!engine || engine.status === 'FINISHED') {
      const lobby = restoreLobbyFromEngine(gameId, engine);
      if (lobby) {
        const player = lobby.players.get(userId);
        if (player && player.role !== 'HOST') {
          player.isReady = false;
        }
        socket.join(gameId);
        io.to(gameId).emit('lobby_state', serializeLobby(lobby));
        broadcastLobbies();
      }
    } else {
      // Game still in progress — just make sure the returning player stays in the socket room
      socket.join(gameId);
    }
  });

  socket.on('flappy_reset_lobby', async ({ gameId }) => {
    const engine = activeGames.get(gameId);
    const lobby = restoreLobbyFromEngine(gameId, engine);

    if (engine) {
      engine.players.forEach(p => {
        presenceService.clearPlaying(p.userId, null, gameId).catch(console.error);
      });
      if (typeof engine.resetToLobby === 'function') {
        const newState = engine.resetToLobby();
        io.to(gameId).emit('game_state', newState);
      }
    }

    if (lobby) {
      for (const p of lobby.players.values()) {
        p.isReady = p.role === 'HOST';
      }
      io.to(gameId).emit('lobby_state', serializeLobby(lobby));
    }

    activeGames.delete(gameId);
    broadcastLobbies();
  });

  // ========================
  // PAPER FALL SPECIFIC SOCKET EVENTS
  // ========================

  socket.on('paperfall_progress', ({ gameId, userId, ...data }) => {
    const engine = activeGames.get(gameId);
    if (engine && engine.gameType === 'PAPER_FALL') {
      engine.handlePlayerAction(userId, 'progress', data);
    }
  });

  socket.on('paperfall_word_typed', ({ gameId, userId, word, score }) => {
    const engine = activeGames.get(gameId);
    if (engine && engine.gameType === 'PAPER_FALL') {
      engine.handlePlayerAction(userId, 'word_typed', { word, score });
    }
  });

  socket.on('paperfall_finished', ({ gameId, userId, stats }) => {
    const engine = activeGames.get(gameId);
    if (engine && engine.gameType === 'PAPER_FALL') {
      engine.handlePlayerAction(userId, 'finished', { stats });
    }
  });

  socket.on('paperfall_return_to_lobby', async ({ gameId, userId }) => {
    const engine = activeGames.get(gameId);
    if (engine && engine.gameType === 'PAPER_FALL') {
      engine.handlePlayerAction(userId, 'return_to_lobby', {});
    }

    await presenceService.clearPlaying(userId, socket.id, gameId);

    if (!engine || engine.status === 'FINISHED') {
      const lobby = restoreLobbyFromEngine(gameId, engine);
      if (lobby) {
        const player = lobby.players.get(userId);
        if (player && player.role !== 'HOST') {
          player.isReady = false;
        }
        socket.join(gameId);
        io.to(gameId).emit('lobby_state', serializeLobby(lobby));
        broadcastLobbies();
      }
    } else {
      socket.join(gameId);
    }
  });

  socket.on('paperfall_reset_lobby', async ({ gameId }) => {
    const engine = activeGames.get(gameId);
    const lobby = restoreLobbyFromEngine(gameId, engine);

    if (engine) {
      engine.players.forEach(p => {
        presenceService.clearPlaying(p.userId, null, gameId).catch(console.error);
      });
    }

    if (lobby) {
      for (const p of lobby.players.values()) {
        p.isReady = p.role === 'HOST';
      }
      io.to(gameId).emit('lobby_state', serializeLobby(lobby));
    }

    activeGames.delete(gameId);
    broadcastLobbies();
  });

  // ========================
  // ARROW MAZE SPECIFIC SOCKET EVENTS
  // ========================

  socket.on('arrowmaze_progress', ({ gameId, userId, ...data }) => {
    const engine = activeGames.get(gameId);
    if (engine && engine.gameType === 'ARROW_MAZE') {
      engine.handlePlayerAction(userId, 'progress', data);
    }
  });

  socket.on('arrowmaze_level_cleared', ({ gameId, userId, ...data }) => {
    const engine = activeGames.get(gameId);
    if (engine && engine.gameType === 'ARROW_MAZE') {
      engine.handlePlayerAction(userId, 'level_cleared', data);
    }
  });

  socket.on('arrowmaze_life_lost', ({ gameId, userId, ...data }) => {
    const engine = activeGames.get(gameId);
    if (engine && engine.gameType === 'ARROW_MAZE') {
      engine.handlePlayerAction(userId, 'life_lost', data);
    }
  });

  socket.on('arrowmaze_finished', ({ gameId, userId, stats }) => {
    const engine = activeGames.get(gameId);
    if (engine && engine.gameType === 'ARROW_MAZE') {
      engine.handlePlayerAction(userId, 'finished', { stats });
    }
  });

  socket.on('arrowmaze_return_to_lobby', async ({ gameId, userId }) => {
    const engine = activeGames.get(gameId);
    if (engine && engine.gameType === 'ARROW_MAZE') {
      engine.handlePlayerAction(userId, 'return_to_lobby', {});
    }

    await presenceService.clearPlaying(userId, socket.id, gameId);

    if (!engine || engine.status === 'FINISHED') {
      const lobby = restoreLobbyFromEngine(gameId, engine);
      if (lobby) {
        const player = lobby.players.get(userId);
        if (player && player.role !== 'HOST') {
          player.isReady = false;
        }
        socket.join(gameId);
        io.to(gameId).emit('lobby_state', serializeLobby(lobby));
        broadcastLobbies();
      }
    } else {
      socket.join(gameId);
    }
  });

  socket.on('arrowmaze_reset_lobby', async ({ gameId }) => {
    const engine = activeGames.get(gameId);
    const lobby = restoreLobbyFromEngine(gameId, engine);

    if (engine) {
      engine.players.forEach(p => {
        presenceService.clearPlaying(p.userId, null, gameId).catch(console.error);
      });
    }

    if (lobby) {
      for (const p of lobby.players.values()) {
        p.isReady = p.role === 'HOST';
      }
      io.to(gameId).emit('lobby_state', serializeLobby(lobby));
    }

    activeGames.delete(gameId);
    broadcastLobbies();
  });

  // ========================
  // DEMOLITION DERBY SPECIFIC SOCKET EVENTS
  // ========================

  socket.on('derby_transform_update', (payload = {}) => {
    const { gameId, userId, playerId, ...data } = payload;
    const effectiveUserId = userId || playerId || socketToUser?.get(socket.id)?.userId;
    const engine = activeGames.get(gameId);
    if (engine && engine.gameType === 'DEMOLITION_DERBY' && effectiveUserId) {
      engine.handlePlayerAction(effectiveUserId, 'transform_update', data);
    }
  });

  socket.on('derby_hit_impact', (payload = {}) => {
    const { gameId, userId, attackerId, ...data } = payload;
    const effectiveUserId = attackerId || userId || socketToUser?.get(socket.id)?.userId;
    const engine = activeGames.get(gameId);
    if (engine && engine.gameType === 'DEMOLITION_DERBY' && effectiveUserId) {
      engine.handlePlayerAction(effectiveUserId, 'hit_impact', {
        ...data,
        targetId: data.targetId || payload.targetId,
        impactSpeed: data.impactSpeed || payload.impactSpeed,
      });
    }
  });

  socket.on('derby_env_impact', (payload = {}) => {
    const { gameId, userId, playerId, ...data } = payload;
    const effectiveUserId = playerId || userId || socketToUser?.get(socket.id)?.userId;
    const engine = activeGames.get(gameId);
    if (engine && engine.gameType === 'DEMOLITION_DERBY' && effectiveUserId) {
      engine.handlePlayerAction(effectiveUserId, 'env_impact', data);
    }
  });

  socket.on('derby_return_to_lobby', async ({ gameId, userId }) => {
    const effectiveUserId = userId || socketToUser?.get(socket.id)?.userId;
    socket.join(gameId);

    if (effectiveUserId) {
      await presenceService.clearPlaying(effectiveUserId, socket.id, gameId).catch(console.error);
    }

    const engine = activeGames.get(gameId);
    if (engine && engine.gameType === 'DEMOLITION_DERBY' && effectiveUserId) {
      engine.handlePlayerAction(effectiveUserId, 'return_to_lobby', {});
    }

    let lobby = LobbyService.getLobby(gameId);
    if (!lobby && engine) {
      lobby = restoreLobbyFromEngine(gameId, engine);
    }
    if (lobby) {
      lobby.status = 'WAITING';
      const player = lobby.players.get(effectiveUserId);
      if (player && player.role !== 'HOST') {
        player.isReady = false;
      }
      io.to(gameId).emit('lobby_state', serializeLobby(lobby));
      broadcastLobbies();
    }
  });

  socket.on('derby_select_car', ({ gameId, userId, carId }) => {
    const effectiveUserId = userId || socketToUser?.get(socket.id)?.userId;
    console.log(`[GameSocket] derby_select_car: gameId=${gameId}, userId=${effectiveUserId}, carId=${carId}`);

    const res = LobbyService.selectCar(gameId, effectiveUserId, carId);
    if (res && res.error) {
      return socket.emit('game_error', { message: res.error });
    }

    const lobby = LobbyService.getLobby(gameId);
    if (lobby) {
      io.to(gameId).emit('lobby_state', serializeLobby(lobby));
      broadcastLobbies();
    }

    const engine = activeGames.get(gameId);
    if (engine && engine.gameType === 'DEMOLITION_DERBY') {
      engine.handlePlayerAction(effectiveUserId, 'select_car', { carId });
    }
  });

  const handleCarSelect = ({ gameId, userId, carId }) => {
    const effectiveUserId = userId || socketToUser?.get(socket.id)?.userId;
    console.log(`[GameSocket] car_select: gameId=${gameId}, userId=${effectiveUserId}, carId=${carId}`);

    const res = LobbyService.selectCar(gameId, effectiveUserId, carId);
    if (res && res.error) {
      return socket.emit('game_error', { message: res.error });
    }

    const lobby = LobbyService.getLobby(gameId);
    if (lobby) {
      io.to(gameId).emit('lobby_state', serializeLobby(lobby));
      broadcastLobbies();
    }

    const engine = activeGames.get(gameId);
    if (engine && typeof engine.handlePlayerAction === 'function') {
      engine.handlePlayerAction(effectiveUserId, 'select_car', { carId });
    }
  };

  socket.on('street_rush_select_car', handleCarSelect);
  socket.on('lobby_select_car', handleCarSelect);

  socket.on('derby_select_arena', ({ gameId, hostId, arenaId }) => {
    const lobby = LobbyService.getLobby(gameId);
    if (lobby) {
      if (lobby.hostId !== hostId) {
        return socket.emit('game_error', { message: 'Only host can select arena.' });
      }
      if (!lobby.settings) lobby.settings = {};
      lobby.settings.arenaId = arenaId;
      io.to(gameId).emit('lobby_state', serializeLobby(lobby));
      broadcastLobbies();
    }

    const engine = activeGames.get(gameId);
    if (engine && engine.gameType === 'DEMOLITION_DERBY') {
      engine.handlePlayerAction(hostId, 'select_arena', { arenaId });
    }
  });

  socket.on('derby_reset_lobby', async ({ gameId }) => {
    const engine = activeGames.get(gameId);
    if (engine) {
      engine.players.forEach(p => {
        presenceService.clearPlaying(p.userId, null, gameId).catch(console.error);
      });
    }

    let lobby = LobbyService.getLobby(gameId);
    if (!lobby && engine) {
      lobby = restoreLobbyFromEngine(gameId, engine);
    }

    if (lobby) {
      lobby.status = 'WAITING';
      LobbyService.resetReadyStates(gameId);
      io.to(gameId).emit('lobby_state', serializeLobby(lobby));
    }

    activeGames.delete(gameId);
    broadcastLobbies();
  });
}

module.exports = registerGameSockets;
