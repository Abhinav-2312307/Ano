const userService = require('./userService');
const { getRedisClient, createRedisClient, isRedisAvailable } = require('../lib/redis');

// Central Game Display Names Map
const GAME_DISPLAY_NAMES = {
  // Uppercase keys
  'BLUFF': 'Bluff Card Game',
  'MEMORY_MATCH': 'Memory Match',
  'DOTS_AND_BOXES': 'Dots and Boxes',
  'COLOR_WARS': 'Chain Reaction',
  'SCRIBBLE': 'Scribble',
  'INK_DECEPTION': 'Ink & Deception',
  'CHAMBER_CLASH': 'Chamber Clash',
  'FLAPPY_BIRD': 'Flappy Bird',
  'FLAPPY': 'Flappy Bird',
  'PAPER_FALL': 'PaperFall',
  'ARROW_MAZE': 'Arrow Maze',
  'ULTIMATE_TIC_TAC_TOE': 'Ultimate Tic-Tac-Toe',
  '2048': '2048',
  'MINESWEEPER': 'Minesweeper',
  'CONNECT_FOUR': 'Connect 4',
  'DEMOLITION_DERBY': 'Demolition Derby',
  'STREET_RUSH': 'Street Rush',
  'CAR_RACING': 'Street Rush',

  // Lowercase / slug keys
  'bluff': 'Bluff Card Game',
  'memory-match': 'Memory Match',
  'dots-and-boxes': 'Dots and Boxes',
  'color-wars': 'Chain Reaction',
  'scribble': 'Scribble',
  'ink-deception': 'Ink & Deception',
  'chamber-clash': 'Chamber Clash',
  'flappy-bird': 'Flappy Bird',
  'flappy': 'Flappy Bird',
  'paper-fall': 'PaperFall',
  'arrow-maze': 'Arrow Maze',
  'ultimate-tic-tac-toe': 'Ultimate Tic-Tac-Toe',
  'minesweeper': 'Minesweeper',
  'connect-four': 'Connect 4',
  'demolition-derby': 'Demolition Derby',
  'street-rush': 'Street Rush',
};

const PRESENCE_TTL_SECONDS = 120; // 2 minutes heartbeat TTL
const PUBSUB_CHANNEL = 'ano:pubsub:presence_updated';
const KEY_PREFIX_USER = 'ano:presence:user:';
const KEY_PREFIX_SESSION = 'ano:presence:session:';
const KEY_PREFIX_USER_SOCKETS = 'ano:presence:user_sockets:';

/**
 * Format any unknown gameType slug into Title Case
 */
function resolveGameName(gameType) {
  if (!gameType) return 'Game';
  if (GAME_DISPLAY_NAMES[gameType]) return GAME_DISPLAY_NAMES[gameType];

  return gameType
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
}

class PresenceService {
  constructor() {
    // In-memory fallback structures
    this.userPresences = new Map();   // userId -> UserPresence
    this.socketPresences = new Map(); // socketId -> { userId, gameId, gameType, isSpectating }
    this.localUserSockets = new Map(); // userId -> Set<socketId>
    
    this.io = null;
    this.onlineUsers = null;
    this.subClient = null;
    this.isSubscribed = false;
  }

  /**
   * Initialize presence service with Socket.IO instance and onlineUsers map
   */
  init(io, onlineUsers) {
    this.io = io;
    this.onlineUsers = onlineUsers;

    // Setup Redis Pub/Sub for cross-instance presence syncing
    this.setupPubSub();
  }

  /**
   * Setup Redis subscriber for presence events
   */
  setupPubSub() {
    if (this.isSubscribed) return;

    try {
      this.subClient = createRedisClient('PresenceSubscriber');
      if (this.subClient) {
        this.subClient.connect().catch((err) => {
          // Handled via client.on('error')
        });

        this.subClient.on('ready', async () => {
          try {
            await this.subClient.subscribe(PUBSUB_CHANNEL);
            this.isSubscribed = true;
            console.log('[Presence] Subscribed to Redis presence pub/sub channel.');
          } catch (err) {
            console.warn('[Presence] Failed to subscribe to pub/sub channel:', err.message);
          }
        });

        this.subClient.on('message', (channel, message) => {
          if (channel === PUBSUB_CHANNEL) {
            try {
              const presence = JSON.parse(message);
              // Update local memory cache
              if (presence.status === 'OFFLINE') {
                this.userPresences.delete(presence.userId);
              } else {
                this.userPresences.set(presence.userId, presence);
              }
            } catch (err) {
              console.warn('[Presence] Error parsing pub/sub message:', err.message);
            }
          }
        });
      }
    } catch (err) {
      console.warn('[Presence] Could not initialize Redis pub/sub subscriber:', err.message);
    }
  }

  /**
   * Helper: Resolve game info
   */
  resolveGameInfo(gameType, gameId = null, isSpectating = false) {
    if (!gameType) return null;
    return {
      gameId: gameId || null,
      gameType,
      gameName: resolveGameName(gameType),
      isSpectating: Boolean(isSpectating),
    };
  }

  /**
   * Publish presence update to Redis pub/sub & local sockets
   */
  async broadcastPresence(presence) {
    if (!presence) return;

    // 1. Direct Socket.IO broadcast (replicated across nodes via @socket.io/redis-adapter)
    if (this.io) {
      this.io.emit('presence_updated', presence);
      this.io.emit('user_presence_change', {
        userId: presence.userId,
        presenceStatus: presence.status === 'PLAYING'
          ? `${presence.game?.isSpectating ? 'Spectating' : 'Playing'} ${presence.game?.gameName || 'a game'}`
          : (presence.status === 'ONLINE' ? 'Online' : null)
      });
    }

    // 2. Publish to Redis Pub/Sub channel for any external backend subscribers
    if (isRedisAvailable()) {
      try {
        const client = getRedisClient();
        await client.publish(PUBSUB_CHANNEL, JSON.stringify(presence));
      } catch (err) {
        // Ignore publish errors
      }
    }
  }

  /**
   * Mark user as ONLINE (when opening a tab or connecting)
   */
  async setOnline(userId, socketId) {
    if (!userId) return null;

    // 1. Redis Path
    if (isRedisAvailable()) {
      try {
        const client = getRedisClient();
        const pipeline = client.pipeline();

        if (socketId) {
          pipeline.sadd(`${KEY_PREFIX_USER_SOCKETS}${userId}`, socketId);
          pipeline.expire(`${KEY_PREFIX_USER_SOCKETS}${userId}`, PRESENCE_TTL_SECONDS);
          // Set session with default online status
          pipeline.set(
            `${KEY_PREFIX_SESSION}${socketId}`,
            JSON.stringify({ userId, status: 'ONLINE', game: null }),
            'EX',
            PRESENCE_TTL_SECONDS
          );
        }

        await pipeline.exec();

        // Check if user currently has an active playing session in another socket
        const activeSockets = await client.smembers(`${KEY_PREFIX_USER_SOCKETS}${userId}`);
        let existingGame = null;

        if (activeSockets && activeSockets.length > 0) {
          const sessionKeys = activeSockets.map(s => `${KEY_PREFIX_SESSION}${s}`);
          const sessionsRaw = await client.mget(sessionKeys);

          for (const raw of sessionsRaw) {
            if (raw) {
              const session = JSON.parse(raw);
              if (session.game) {
                existingGame = session.game;
                break;
              }
            }
          }
        }

        const newStatus = existingGame ? 'PLAYING' : 'ONLINE';
        const presence = {
          userId,
          status: newStatus,
          game: existingGame || null,
          updatedAt: Date.now()
        };

        // Store aggregated user presence in Redis with TTL
        await client.set(
          `${KEY_PREFIX_USER}${userId}`,
          JSON.stringify(presence),
          'EX',
          PRESENCE_TTL_SECONDS
        );

        // Sync local memory map
        this.userPresences.set(userId, presence);

        // Sync to DB
        const dbStatus = newStatus === 'PLAYING'
          ? `${presence.game.isSpectating ? 'Spectating' : 'Playing'} ${presence.game.gameName}`
          : 'Online';
        userService.updatePresenceStatus(userId, dbStatus).catch(() => {});

        await this.broadcastPresence(presence);
        return presence;
      } catch (err) {
        // Fall back to memory
      }
    }

    // 2. In-Memory Fallback Path
    if (socketId) {
      if (!this.localUserSockets.has(userId)) {
        this.localUserSockets.set(userId, new Set());
      }
      this.localUserSockets.get(userId).add(socketId);
    }

    let existingGame = null;
    const activeSockets = (this.onlineUsers && this.onlineUsers.get(userId)) || this.localUserSockets.get(userId) || new Set();

    if (socketId && this.socketPresences.has(socketId)) {
      const sp = this.socketPresences.get(socketId);
      existingGame = this.resolveGameInfo(sp.gameType, sp.gameId, sp.isSpectating);
    } else {
      for (const sId of activeSockets) {
        if (this.socketPresences.has(sId)) {
          const sp = this.socketPresences.get(sId);
          existingGame = this.resolveGameInfo(sp.gameType, sp.gameId, sp.isSpectating);
          break;
        }
      }
    }

    const current = this.userPresences.get(userId);
    if (!existingGame && current && current.status === 'PLAYING' && current.game) {
      existingGame = current.game;
    }

    const newStatus = existingGame ? 'PLAYING' : 'ONLINE';
    const presence = {
      userId,
      status: newStatus,
      game: existingGame || null,
      updatedAt: Date.now()
    };

    this.userPresences.set(userId, presence);

    const dbStatus = newStatus === 'PLAYING'
      ? `${presence.game.isSpectating ? 'Spectating' : 'Playing'} ${presence.game.gameName}`
      : 'Online';
    userService.updatePresenceStatus(userId, dbStatus).catch(() => {});

    await this.broadcastPresence(presence);
    return presence;
  }

  /**
   * Set user as PLAYING (or SPECTATING) a game session
   */
  async setPlaying(userId, socketId, { gameId, gameType, isSpectating = false }) {
    if (!userId) return null;

    const game = this.resolveGameInfo(gameType, gameId, isSpectating);
    const presence = {
      userId,
      status: 'PLAYING',
      game,
      updatedAt: Date.now()
    };

    // 1. Redis Path
    if (isRedisAvailable()) {
      try {
        const client = getRedisClient();
        const pipeline = client.pipeline();

        if (socketId) {
          pipeline.sadd(`${KEY_PREFIX_USER_SOCKETS}${userId}`, socketId);
          pipeline.expire(`${KEY_PREFIX_USER_SOCKETS}${userId}`, PRESENCE_TTL_SECONDS);
          pipeline.set(
            `${KEY_PREFIX_SESSION}${socketId}`,
            JSON.stringify({ userId, status: 'PLAYING', game }),
            'EX',
            PRESENCE_TTL_SECONDS
          );
        }

        // Store user presence
        pipeline.set(
          `${KEY_PREFIX_USER}${userId}`,
          JSON.stringify(presence),
          'EX',
          PRESENCE_TTL_SECONDS
        );

        await pipeline.exec();

        this.userPresences.set(userId, presence);

        const dbStatus = `${isSpectating ? 'Spectating' : 'Playing'} ${game.gameName}`;
        userService.updatePresenceStatus(userId, dbStatus).catch(() => {});

        console.log(`[Presence] User ${userId} is now ${dbStatus} (gameId: ${gameId || 'solo'})`);
        await this.broadcastPresence(presence);
        return presence;
      } catch (err) {
        // Fall back to memory
      }
    }

    // 2. In-Memory Fallback Path
    if (socketId) {
      if (!this.localUserSockets.has(userId)) {
        this.localUserSockets.set(userId, new Set());
      }
      this.localUserSockets.get(userId).add(socketId);
      this.socketPresences.set(socketId, { userId, gameId, gameType, isSpectating });
    }

    const activeSockets = (this.onlineUsers && this.onlineUsers.get(userId)) || this.localUserSockets.get(userId) || new Set();
    for (const sId of activeSockets) {
      this.socketPresences.set(sId, { userId, gameId, gameType, isSpectating });
    }

    this.userPresences.set(userId, presence);

    const dbStatus = `${isSpectating ? 'Spectating' : 'Playing'} ${game.gameName}`;
    userService.updatePresenceStatus(userId, dbStatus).catch(() => {});

    console.log(`[Presence] User ${userId} is now ${dbStatus} (gameId: ${gameId || 'solo'})`);
    await this.broadcastPresence(presence);
    return presence;
  }

  /**
   * Clear PLAYING status for a socket/user and return to ONLINE (or remaining active game if multi-tab)
   */
  async clearPlaying(userId, socketId = null, gameId = null) {
    if (!userId) return null;

    // 1. Redis Path
    if (isRedisAvailable()) {
      try {
        const client = getRedisClient();
        
        if (socketId) {
          // Revert this session back to normal online
          await client.set(
            `${KEY_PREFIX_SESSION}${socketId}`,
            JSON.stringify({ userId, status: 'ONLINE', game: null }),
            'EX',
            PRESENCE_TTL_SECONDS
          );
        }

        // Check remaining sockets for this user
        const activeSockets = await client.smembers(`${KEY_PREFIX_USER_SOCKETS}${userId}`);
        let remainingGame = null;

        if (activeSockets && activeSockets.length > 0) {
          const sessionKeys = activeSockets.map(s => `${KEY_PREFIX_SESSION}${s}`);
          const sessionsRaw = await client.mget(sessionKeys);

          for (const raw of sessionsRaw) {
            if (raw) {
              const session = JSON.parse(raw);
              if (session.game && (!gameId || session.game.gameId !== gameId)) {
                remainingGame = session.game;
                break;
              }
            }
          }
        }

        const hasActiveSockets = activeSockets && activeSockets.length > 0;
        const newStatus = remainingGame ? 'PLAYING' : (hasActiveSockets ? 'ONLINE' : 'OFFLINE');
        const presence = {
          userId,
          status: newStatus,
          game: remainingGame || null,
          updatedAt: Date.now()
        };

        if (newStatus === 'OFFLINE') {
          await client.del(`${KEY_PREFIX_USER}${userId}`);
          this.userPresences.delete(userId);
        } else {
          await client.set(
            `${KEY_PREFIX_USER}${userId}`,
            JSON.stringify(presence),
            'EX',
            PRESENCE_TTL_SECONDS
          );
          this.userPresences.set(userId, presence);
        }

        const dbStatus = newStatus === 'PLAYING'
          ? `${presence.game.isSpectating ? 'Spectating' : 'Playing'} ${presence.game.gameName}`
          : (newStatus === 'ONLINE' ? 'Online' : null);
        userService.updatePresenceStatus(userId, dbStatus).catch(() => {});

        console.log(`[Presence] User ${userId} playing presence cleared -> status: ${newStatus}`);
        await this.broadcastPresence(presence);
        return presence;
      } catch (err) {
        // Fall back to memory
      }
    }

    // 2. In-Memory Fallback Path
    if (socketId && this.socketPresences.has(socketId)) {
      this.socketPresences.delete(socketId);
    }

    const activeSockets = (this.onlineUsers && this.onlineUsers.get(userId)) || this.localUserSockets.get(userId) || new Set();
    let remainingGame = null;
    for (const sId of activeSockets) {
      if (sId !== socketId && this.socketPresences.has(sId)) {
        const sp = this.socketPresences.get(sId);
        if (!gameId || sp.gameId !== gameId) {
          remainingGame = this.resolveGameInfo(sp.gameType, sp.gameId, sp.isSpectating);
          break;
        } else {
          this.socketPresences.delete(sId);
        }
      }
    }

    const hasSockets = activeSockets.size > 0;
    const newStatus = remainingGame ? 'PLAYING' : (hasSockets ? 'ONLINE' : 'OFFLINE');
    const presence = {
      userId,
      status: newStatus,
      game: remainingGame || null,
      updatedAt: Date.now()
    };

    if (newStatus === 'OFFLINE') {
      this.userPresences.delete(userId);
    } else {
      this.userPresences.set(userId, presence);
    }

    const dbStatus = newStatus === 'PLAYING'
      ? `${presence.game.isSpectating ? 'Spectating' : 'Playing'} ${presence.game.gameName}`
      : (newStatus === 'ONLINE' ? 'Online' : null);
    userService.updatePresenceStatus(userId, dbStatus).catch(() => {});

    console.log(`[Presence] User ${userId} playing presence cleared -> status: ${newStatus}`);
    await this.broadcastPresence(presence);
    return presence;
  }

  /**
   * Handle socket disconnect
   */
  async handleSocketDisconnect(userId, socketId) {
    if (!userId) return null;

    // 1. Redis Path
    if (isRedisAvailable()) {
      try {
        const client = getRedisClient();
        if (socketId) {
          await client.srem(`${KEY_PREFIX_USER_SOCKETS}${userId}`, socketId);
          await client.del(`${KEY_PREFIX_SESSION}${socketId}`);
        }

        const remainingSockets = await client.smembers(`${KEY_PREFIX_USER_SOCKETS}${userId}`);
        if (!remainingSockets || remainingSockets.length === 0) {
          // User is completely offline
          const presence = {
            userId,
            status: 'OFFLINE',
            game: null,
            updatedAt: Date.now()
          };
          await client.del(`${KEY_PREFIX_USER}${userId}`);
          await client.del(`${KEY_PREFIX_USER_SOCKETS}${userId}`);
          this.userPresences.delete(userId);
          userService.updatePresenceStatus(userId, null).catch(() => {});
          await this.broadcastPresence(presence);
          return presence;
        } else {
          // User still has active sockets in other tabs
          return this.clearPlaying(userId, socketId);
        }
      } catch (err) {
        // Fall back to memory
      }
    }

    // 2. In-Memory Fallback Path
    if (socketId) {
      this.socketPresences.delete(socketId);
      if (this.localUserSockets.has(userId)) {
        this.localUserSockets.get(userId).delete(socketId);
      }
    }

    const activeSockets = (this.onlineUsers && this.onlineUsers.get(userId)) || this.localUserSockets.get(userId);
    const remainingCount = activeSockets ? activeSockets.size : 0;

    if (remainingCount === 0) {
      const presence = {
        userId,
        status: 'OFFLINE',
        game: null,
        updatedAt: Date.now()
      };
      this.userPresences.delete(userId);
      if (this.localUserSockets.has(userId)) {
        this.localUserSockets.delete(userId);
      }
      userService.updatePresenceStatus(userId, null).catch(() => {});
      await this.broadcastPresence(presence);
      return presence;
    } else {
      return this.clearPlaying(userId, socketId);
    }
  }

  /**
   * Refresh presence TTL on socket heartbeat
   */
  async touchPresence(userId, socketId) {
    if (!userId || !isRedisAvailable()) return;
    try {
      const client = getRedisClient();
      const pipeline = client.pipeline();
      pipeline.expire(`${KEY_PREFIX_USER}${userId}`, PRESENCE_TTL_SECONDS);
      pipeline.expire(`${KEY_PREFIX_USER_SOCKETS}${userId}`, PRESENCE_TTL_SECONDS);
      if (socketId) {
        pipeline.expire(`${KEY_PREFIX_SESSION}${socketId}`, PRESENCE_TTL_SECONDS);
      }
      await pipeline.exec();
    } catch (err) {
      // Ignore heartbeat refresh errors
    }
  }

  /**
   * Get current presence for a user
   */
  async getPresence(userId) {
    if (!userId) return null;

    if (isRedisAvailable()) {
      try {
        const client = getRedisClient();
        const raw = await client.get(`${KEY_PREFIX_USER}${userId}`);
        if (raw) {
          return JSON.parse(raw);
        }
      } catch (err) {
        // Fall back to memory
      }
    }

    if (this.userPresences.has(userId)) {
      return this.userPresences.get(userId);
    }

    const isOnline = this.onlineUsers ? (this.onlineUsers.get(userId)?.size || 0) > 0 : false;
    return {
      userId,
      status: isOnline ? 'ONLINE' : 'OFFLINE',
      game: null,
      updatedAt: Date.now()
    };
  }

  /**
   * Get all active presences as an object Record<userId, UserPresence>
   */
  async getAllPresences() {
    const result = {};

    if (isRedisAvailable()) {
      try {
        const client = getRedisClient();
        const keys = await client.keys(`${KEY_PREFIX_USER}*`);
        if (keys.length > 0) {
          const values = await client.mget(keys);
          values.forEach((v) => {
            if (v) {
              const p = JSON.parse(v);
              if (p.status !== 'OFFLINE') {
                result[p.userId] = p;
              }
            }
          });
          return result;
        }
      } catch (err) {
        // Fall back to memory
      }
    }

    for (const [uId, pres] of this.userPresences.entries()) {
      if (pres.status !== 'OFFLINE') {
        result[uId] = pres;
      }
    }
    return result;
  }
}

const presenceService = new PresenceService();
module.exports = presenceService;
module.exports.GAME_DISPLAY_NAMES = GAME_DISPLAY_NAMES;
module.exports.resolveGameName = resolveGameName;
