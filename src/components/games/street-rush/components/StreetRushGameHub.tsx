'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUserStore } from '@/store/useUserStore';
import { useStreetRushStore } from '@/store/useStreetRushStore';
import { CAR_SPECS, DEFAULT_CAR_ID } from '../config/carConfig';
import { RaceInputs, RankItem, SpectatedRacerInfo } from '../types';
import { StreetRushCanvas } from './StreetRushCanvas';
import { RaceHUD } from './RaceHUD';
import { MobileControls } from './MobileControls';
import { RaceResultsModal } from './RaceResultsModal';
import { streetRushAssetPreloader } from '@/lib/streetRushAssetPreloader';
import { streetRushAudio } from './StreetRushAudio';
import GameChatDrawer from '@/components/games/common/GameChatDrawer';
import { useGameChatStore } from '@/store/useGameChatStore';
import { useGamePresence } from '@/hooks/useGamePresence';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/layout/GlassCard';
import {
  Flag,
  Users,
  Copy,
  Check,
  Zap,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  LogOut,
  Sparkles,
  MessageSquare,
  Shield,
  Gauge,
  Loader2,
  ChevronRight,
  BookOpen,
  ArrowLeft,
  X,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';

export function StreetRushGameHub() {
  const searchParams = useSearchParams();
  const roomCodeParam =
    searchParams?.get('gameId') ||
    searchParams?.get('room') ||
    searchParams?.get('code') ||
    null;

  const userStoreId = useUserStore((s) => s.id);
  const userStoreNickname = useUserStore((s) => s.nickname);
  const login = useUserStore((s) => s.login);

  // Auto-login anonymous guest if not signed in
  useEffect(() => {
    if (!userStoreId) {
      login('Racer_' + Math.floor(1000 + Math.random() * 9000));
    }
  }, [userStoreId, login]);

  const userId = userStoreId || 'guest';
  const nickname = userStoreNickname || 'Player';

  const {
    lobbyState,
    availableLobbies,
    isCreatingLobby,
    lobbyError,
    targetLaps,
    setTargetLaps,
    updateLobbySettings,
    selectedCarId,
    soundMuted,
    raceStatus,
    countdownValue,
    raceResults,
    initLobbySockets,
    fetchLobbies,
    clearLobbyError,
    toggleSound,
    selectCar,
    reportAssetsReady,
    createLobby,
    joinLobby,
    toggleReady,
    startMatch,
    leaveLobby,
    sendTransform,
    sendCheckpoint,
    sendRacerFinished,
    sendPlayAgain,
    sendReturnToLobby,
  } = useStreetRushStore();

  const [assetState, setAssetState] = useState(streetRushAssetPreloader.getState());
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [directCodeInput, setDirectCodeInput] = useState('');
  const [spectateTargetUserId, setSpectateTargetUserId] = useState<string | null>(null);

  // Live HUD metrics state updated by canvas loop
  const [hudStats, setHudStats] = useState({
    speedKmh: 0,
    nitroMeter: 100,
    isNitro: false,
    isDrifting: false,
    currentLap: 0,
    currentCheckpoint: 0,
    wrongWay: false,
    localRank: 1,
    isFinished: false,
    finishPosition: null as number | null,
    rankings: [] as RankItem[],
    isSpectating: false,
    spectatedRacer: null as SpectatedRacerInfo | null,
    availableSpectateTargets: [] as Array<{
      userId: string;
      nickname: string;
      rank: number;
    }>,
  });

  const [elapsedTimeMs, setElapsedTimeMs] = useState(0);
  const raceStartTimestampRef = useRef<number>(0);

  // Mutable inputs ref
  const inputsRef = useRef<RaceInputs>({
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
    nitro: false,
  });

  // Chat drawer
  const { unreadCount: unreadChatCount, toggleChat } = useGameChatStore();

  // Active game presence
  useGamePresence('STREET_RUSH', raceStatus === 'RACING', lobbyState?.id);

  // ── 1. PRELOAD ASSETS ON MOUNT ─────────────────────────────
  useEffect(() => {
    initLobbySockets();
    fetchLobbies();

    const unsub = streetRushAssetPreloader.subscribe((state) => {
      setAssetState(state);
    });
    streetRushAssetPreloader.startPreload();

    return () => {
      unsub();
    };
  }, [initLobbySockets, fetchLobbies]);

  // Sync mute state with procedural audio engine
  useEffect(() => {
    streetRushAudio.setMuted(soundMuted);
  }, [soundMuted]);

  // Report asset readiness to room when assets finish loading
  useEffect(() => {
    if (assetState.isReady && lobbyState?.id && userId) {
      reportAssetsReady(lobbyState.id, userId, selectedCarId);
    }
  }, [assetState.isReady, lobbyState?.id, userId, selectedCarId, reportAssetsReady]);

  // Auto-join room from URL query param if present
  useEffect(() => {
    if (roomCodeParam && !lobbyState && userId) {
      joinLobby(roomCodeParam, userId, nickname, selectedCarId);
    }
  }, [roomCodeParam, lobbyState, userId, nickname, selectedCarId, joinLobby]);

  // ── 2. KEYBOARD CONTROLS LISTENER ──────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable)) {
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        inputsRef.current.throttle = 1;
      }
      if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        inputsRef.current.brake = 1;
      }
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        inputsRef.current.steer = -1;
      }
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        inputsRef.current.steer = 1;
      }
      if (e.key === ' ') {
        inputsRef.current.handbrake = true;
      }
      if (e.key === 'Shift') {
        inputsRef.current.nitro = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable)) {
        return;
      }

      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        inputsRef.current.throttle = 0;
      }
      if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        inputsRef.current.brake = 0;
      }
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        if (inputsRef.current.steer === -1) inputsRef.current.steer = 0;
      }
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        if (inputsRef.current.steer === 1) inputsRef.current.steer = 0;
      }
      if (e.key === ' ') {
        inputsRef.current.handbrake = false;
      }
      if (e.key === 'Shift') {
        inputsRef.current.nitro = false;
      }
    };

    const handleBlur = () => {
      inputsRef.current = {
        throttle: 0,
        brake: 0,
        steer: 0,
        handbrake: false,
        nitro: false,
      };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Clear inputs when race status changes (e.g. countdown -> racing, or leaving)
  useEffect(() => {
    inputsRef.current = {
      throttle: 0,
      brake: 0,
      steer: 0,
      handbrake: false,
      nitro: false,
    };
  }, [raceStatus]);

  // ── 3. RACE TIMER LOOP ─────────────────────────────────────
  useEffect(() => {
    if (raceStatus === 'RACING') {
      if (raceStartTimestampRef.current === 0) {
        raceStartTimestampRef.current = Date.now();
      }

      const timer = setInterval(() => {
        setElapsedTimeMs(Date.now() - raceStartTimestampRef.current);
      }, 100);

      return () => clearInterval(timer);
    } else if (raceStatus === 'LOBBY' || raceStatus === 'COUNTDOWN') {
      raceStartTimestampRef.current = 0;
      setElapsedTimeMs(0);
    }
  }, [raceStatus]);

  // Copy helpers
  const handleCopyCode = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const handleCopyLink = async () => {
    if (!lobbyState?.id) return;
    try {
      const url = `${window.location.origin}/dashboard/games/street-rush?gameId=${lobbyState.id}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const isHost = lobbyState?.hostId === userId;
  const playersList = lobbyState?.players || [];
  const myPlayer = playersList.find((p) => p.userId === userId);
  const isReady = Boolean(myPlayer?.isReady);

  const nonHostPlayers = playersList.filter((p) => p.role !== 'HOST' && p.userId !== lobbyState?.hostId);
  const allReady = nonHostPlayers.length === 0 || nonHostPlayers.every((p) => p.isReady);
  const canStart = isHost && playersList.length >= 1 && allReady;

  const renderRulesModal = () => (
    <AnimatePresence>
      {showRules && (
        <motion.div
          key="rules-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowRules(false)}
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0f1115] border border-white/[0.08] rounded-3xl p-6 md:p-8 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-[0_0_50px_rgba(0,0,0,0.8)] relative flex flex-col gap-5"
          >
            <button
              onClick={() => setShowRules(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-white/[0.06] pb-3">
              <BookOpen className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl font-black uppercase tracking-wider text-white">How to Play</h2>
            </div>

            <div className="space-y-4 text-xs text-zinc-300 leading-relaxed overflow-y-auto pr-1">
              <div>
                <h3 className="font-bold text-cyan-400 uppercase tracking-wide mb-1 text-[11px]">Race Objective</h3>
                <p>Complete 3 laps around the Neon Metropolis Circuit. Cross checkpoints sequentially and be the first across the finish line to claim victory!</p>
              </div>

              <div>
                <h3 className="font-bold text-cyan-400 uppercase tracking-wide mb-1 text-[11px]">Driving Controls</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white/[0.03] border border-white/[0.06] p-2.5 rounded-xl">
                    <span className="font-bold text-white block">Accelerate / Brake</span>
                    <span className="text-zinc-400">W / S or Up / Down arrows</span>
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.06] p-2.5 rounded-xl">
                    <span className="font-bold text-white block">Steering</span>
                    <span className="text-zinc-400">A / D or Left / Right arrows</span>
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.06] p-2.5 rounded-xl">
                    <span className="font-bold text-white block">Drift</span>
                    <span className="text-zinc-400">SPACEBAR while steering</span>
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.06] p-2.5 rounded-xl">
                    <span className="font-bold text-white block">Nitro Boost</span>
                    <span className="text-zinc-400">SHIFT key (consumes nitro)</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-cyan-400 uppercase tracking-wide mb-1 text-[11px]">Spectator Mode</h3>
                <p>When you finish your race ahead of opponents, you instantly enter Spectator Mode! The chase camera switches to active racers. Use <kbd className="bg-white/10 px-1.5 py-0.5 rounded font-mono">←</kbd> and <kbd className="bg-white/10 px-1.5 py-0.5 rounded font-mono">→</kbd> or Prev/Next to cycle targets.</p>
              </div>
            </div>

            <button
              onClick={() => setShowRules(false)}
              className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#050607] font-sans text-white">
      {/* ── VIEW 1: LOBBY & CAR SELECTION (CHAMBER CLASH DESIGN) ── */}
      {raceStatus === 'LOBBY' && (
        <div className="relative z-10 flex h-full w-full flex-col overflow-y-auto p-4 space-y-6">
          {/* Header Bar (Matching Chamber Clash) */}
          <div className="flex items-center justify-between p-3 sm:p-4 bg-white/5 border border-white/10 flex-shrink-0 z-30 backdrop-blur-md rounded-2xl max-w-5xl mx-auto w-full">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                href="/dashboard/games"
                className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                title="Back to Arcade"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-opacity"
              >
                <img
                  src="/ano-logo.png"
                  alt="Ano Logo"
                  className="w-8 h-8 object-contain group-hover:scale-105 transition-transform flex-shrink-0"
                />
                <span className="text-lg font-bold text-white tracking-wide">Ano</span>
              </Link>
              <div className="ml-1 sm:ml-2 border-l border-white/20 pl-3 sm:pl-4">
                <h1 className="text-base sm:text-lg md:text-xl font-bold text-white flex items-center gap-2">
                  <span>🏎️</span>
                  <span className="truncate">Street Rush</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRules(true)}
                className="px-3.5 py-1.5 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-full text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors hover:bg-white/10 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Rules</span>
              </button>

              <button
                onClick={toggleSound}
                className="p-2 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-full text-xs sm:text-sm transition-colors hover:bg-white/10 cursor-pointer"
                title={soundMuted ? 'Unmute Sound' : 'Mute Sound'}
              >
                {soundMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
              </button>

              {lobbyState && (
                <button
                  onClick={toggleChat}
                  className="relative px-3.5 py-1.5 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors hover:bg-white/10 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  <span className="hidden sm:inline">Chat</span>
                  {unreadChatCount > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
                      {unreadChatCount}
                    </span>
                  )}
                </button>
              )}

              {lobbyState && (
                <button
                  onClick={() => leaveLobby(lobbyState.id, userId)}
                  className="px-3.5 py-1.5 bg-red-600/20 text-red-400 rounded-full hover:bg-red-600/30 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer border border-red-500/30"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Leave Lobby</span>
                  <span className="sm:hidden">Leave</span>
                </button>
              )}
            </div>
          </div>

          {lobbyError && (
            <div className="max-w-5xl mx-auto w-full flex items-center justify-between rounded-2xl border border-red-500/40 bg-red-950/60 p-4 text-xs font-bold text-red-300">
              <span>{lobbyError}</span>
              <button onClick={clearLobbyError} className="underline cursor-pointer">
                Dismiss
              </button>
            </div>
          )}

          {/* ── NOT IN A LOBBY: PRE-LOBBY VIEW (CHAMBER CLASH STYLE) ── */}
          {!lobbyState ? (
            <div className="space-y-6 max-w-5xl mx-auto w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                {/* Host a Match Card */}
                <GlassCard className="p-8 text-center flex flex-col justify-between space-y-6 border-cyan-500/20 bg-white/[0.03]">
                  <div className="space-y-4">
                    <div className="text-6xl select-none">🏎️</div>
                    <div>
                      <h2 className="text-2xl font-black mb-2 text-white">Host a Match</h2>
                      <p className="text-sm text-zinc-400">1–8 players. Neon Metropolis Circuit.</p>
                    </div>

                    {/* Lap Count Selector for Host Match */}
                    <div className="pt-2">
                      <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
                        <Flag className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Race Length</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { count: 1, label: '1 Lap', subtitle: 'Sprint' },
                          { count: 2, label: '2 Laps', subtitle: 'Quick' },
                          { count: 3, label: '3 Laps', subtitle: 'Standard' },
                          { count: 5, label: '5 Laps', subtitle: 'Endurance' },
                        ].map((item) => {
                          const isSelected = targetLaps === item.count;
                          return (
                            <button
                              key={item.count}
                              type="button"
                              onClick={() => setTargetLaps(item.count)}
                              className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center ${
                                isSelected
                                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                                  : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:bg-white/[0.06] hover:text-white'
                              }`}
                            >
                              <span className="text-xs font-black">{item.label}</span>
                              <span className="text-[10px] text-zinc-400 font-normal">{item.subtitle}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <button
                      onClick={() => createLobby(userId, nickname, selectedCarId, targetLaps)}
                      disabled={isCreatingLobby}
                      className="w-full py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white rounded-xl font-bold shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isCreatingLobby ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-white" /> Create Lobby ({targetLaps} {targetLaps === 1 ? 'Lap' : 'Laps'})
                        </>
                      )}
                    </button>

                    {/* Room code input */}
                    <div className="flex gap-2 pt-1 border-t border-white/10">
                      <input
                        type="text"
                        placeholder="Enter room code..."
                        value={directCodeInput}
                        onChange={(e) => setDirectCodeInput(e.target.value.trim())}
                        className="flex-1 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          if (directCodeInput) {
                            joinLobby(directCodeInput, userId, nickname, selectedCarId);
                          }
                        }}
                        disabled={!directCodeInput}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        Join
                      </button>
                    </div>
                  </div>
                </GlassCard>

                {/* Active Lobbies Card */}
                <GlassCard className="p-6 flex flex-col space-y-4 border-white/[0.08] bg-white/[0.03]">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                    <Users className="w-5 h-5 text-cyan-400" /> Active Lobbies
                  </h2>
                  <div className="flex-1 space-y-2 overflow-y-auto max-h-[300px]">
                    {availableLobbies.length === 0 ? (
                      <div className="text-center py-12 text-zinc-600 text-sm">
                        No active lobbies found. Create one to start racing!
                      </div>
                    ) : (
                      availableLobbies.map((lobby) => {
                        const count = lobby.playerCount ?? (Array.isArray(lobby.players) ? lobby.players.length : 1);
                        const maxP = lobby.maxPlayers || 8;
                        return (
                          <div
                            key={lobby.id}
                            className="p-3 bg-white/[0.03] rounded-xl flex justify-between items-center border border-white/[0.05] hover:border-white/10 transition-colors"
                          >
                            <div>
                              <div className="font-bold text-sm text-white">
                                {lobby.hostName ? `${lobby.hostName}'s Game` : lobby.id.slice(0, 16)}
                              </div>
                              <div className="text-xs text-zinc-500 font-mono">
                                {count}/{maxP} Racers
                              </div>
                            </div>
                            <button
                              onClick={() => joinLobby(lobby.id, userId, nickname, selectedCarId)}
                              className="px-4 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-cyan-500/30"
                            >
                              Join
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </GlassCard>
              </div>

              {/* Machine Selection Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Choose Your Machine
                  </h2>
                  <span className="text-xs font-bold text-cyan-400">
                    Selected: {CAR_SPECS[selectedCarId]?.name}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.values(CAR_SPECS).map((car) => {
                    const isSelected = car.id === selectedCarId;
                    return (
                      <div
                        key={car.id}
                        onClick={() => selectCar(car.id)}
                        className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-950/40 shadow-lg shadow-cyan-950/80 scale-[1.02]'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-white text-sm">{car.name}</h3>
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: car.accentColor }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-zinc-400 leading-snug line-clamp-2 min-h-[32px]">
                          {car.description}
                        </p>
                        <div className="mt-2.5 space-y-1 text-[10px] font-semibold text-zinc-500">
                          <div className="flex justify-between">
                            <span>Top Speed</span>
                            <span className="text-zinc-300">{Math.round(car.maxSpeed * 3.6)} km/h</span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-cyan-400"
                              style={{ width: `${(car.maxSpeed / 55) * 100}%` }}
                            />
                          </div>
                          <div className="flex justify-between pt-0.5">
                            <span>Accel</span>
                            <span className="text-zinc-300">{car.acceleration} m/s²</span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-purple-400"
                              style={{ width: `${(car.acceleration / 35) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Asset Preload Indicator (Matching Chamber Clash) */}
              <div className="w-full mt-2 mb-4">
                {!assetState.isReady ? (
                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-cyan-300/80 font-bold uppercase tracking-wider">
                        STREET RUSH ASSETS
                      </span>
                      <span className="text-[11px] text-cyan-400 font-mono">{assetState.progress}%</span>
                    </div>
                    <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500/70 rounded-full transition-all duration-300"
                        style={{ width: `${assetState.progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1">
                      Loading 3D car models and track in background...
                    </p>
                  </div>
                ) : (
                  <div className="p-2 text-center">
                    <span className="text-[11px] text-green-400/70 font-bold uppercase tracking-wider">
                      ✓ Game Assets Ready
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── IN A LOBBY: LOBBY VIEW (CHAMBER CLASH STYLE) ── */
            <div className="space-y-6 max-w-5xl mx-auto w-full">
              {/* Lobby Code & Share Link Banner (Chamber Clash lines 1252-1265) */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-500 uppercase tracking-wider font-semibold">Lobby Code:</span>
                  <code className="text-cyan-400 font-mono font-bold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    {lobbyState.id}
                  </code>
                  <button
                    onClick={() => handleCopyCode(lobbyState.id)}
                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer text-xs font-medium border border-white/[0.08]"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-green-400 inline mr-1" /> : <Copy className="w-3 h-3 inline mr-1 text-zinc-400" />}
                    {copiedCode ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium border border-white/[0.08]"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
                </button>
              </div>

              {/* Lobby Grid: Players Card */}
              <GlassCard className="p-4 sm:p-6 space-y-6 bg-white/[0.03] border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                    <Users className="w-5 h-5 text-cyan-400" /> Racers ({playersList.length}/{lobbyState.maxPlayers || 8})
                  </h2>
                  <span className="text-xs text-zinc-500">1–8 racers to start</span>
                </div>

                {/* Player Slots Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  {playersList.map((p) => {
                    const isSelf = p.userId === userId;
                    const isHostPlayer = p.role === 'HOST' || p.userId === lobbyState.hostId;
                    const carInfo = CAR_SPECS[p.selectedCarId] || CAR_SPECS[DEFAULT_CAR_ID];

                    return (
                      <div
                        key={p.userId}
                        className={`p-3 sm:p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                          isSelf
                            ? 'border-cyan-500/50 bg-cyan-500/10'
                            : 'border-white/[0.06] bg-white/[0.03]'
                        }`}
                      >
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-zinc-800 rounded-full flex items-center justify-center font-black text-base sm:text-lg overflow-hidden border border-white/10">
                          {p.avatar ? (
                            <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            p.nickname.substring(0, 2).toUpperCase()
                          )}
                        </div>

                        <span className="font-semibold text-xs sm:text-sm truncate w-full text-center text-white">
                          {p.nickname} {isSelf && <span className="text-[10px] text-cyan-400 font-bold">(YOU)</span>}
                        </span>

                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: carInfo.accentColor }}
                          />
                          <span className="truncate">{carInfo.name}</span>
                        </div>

                        <span className="text-[11px] sm:text-xs text-zinc-500">
                          {isHostPlayer ? '👑 Host' : p.isReady ? '✅ Ready' : '⏳ Not Ready'}
                        </span>

                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide ${
                            p.assetReady ? 'text-green-400' : 'text-amber-400'
                          }`}
                        >
                          {p.assetReady ? '✓ Assets Ready' : '⏳ Loading...'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Switch Car in Lobby */}
                <div className="pt-3 border-t border-white/[0.06] space-y-2">
                  <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">
                    Switch Your Vehicle
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.values(CAR_SPECS).map((car) => {
                      const isSelected = selectedCarId === car.id;
                      return (
                        <button
                          key={car.id}
                          onClick={() => selectCar(car.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer border ${
                            isSelected
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                              : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:bg-white/[0.06] hover:text-white'
                          }`}
                        >
                          <span>{car.name}</span>
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: car.accentColor }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Race Distance / Lap Setting in Lobby */}
                <div className="pt-3 border-t border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5 text-cyan-400" />
                      Race Distance ({targetLaps} {targetLaps === 1 ? 'Lap' : 'Laps'})
                    </span>
                    {!isHost && (
                      <span className="text-[11px] text-zinc-500 font-medium">
                        Host controls lap count
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { count: 1, label: '1 Lap', subtitle: 'Sprint' },
                      { count: 2, label: '2 Laps', subtitle: 'Quick' },
                      { count: 3, label: '3 Laps', subtitle: 'Standard' },
                      { count: 5, label: '5 Laps', subtitle: 'Endurance' },
                    ].map((item) => {
                      const isSelected = targetLaps === item.count;
                      return (
                        <button
                          key={item.count}
                          disabled={!isHost}
                          onClick={() => {
                            if (isHost && lobbyState) {
                              updateLobbySettings(lobbyState.id, userId, { totalLaps: item.count });
                            }
                          }}
                          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between border ${
                            !isHost
                              ? isSelected
                                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 opacity-90 cursor-default'
                                : 'bg-white/[0.02] border-white/[0.04] text-zinc-600 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)] cursor-pointer'
                              : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:bg-white/[0.06] hover:text-white cursor-pointer'
                          }`}
                        >
                          <div className="flex flex-col text-left">
                            <span className="text-xs font-black">{item.label}</span>
                            <span className="text-[10px] text-zinc-500 font-normal">{item.subtitle}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-white/[0.06]">
                  {!isHost && (
                    <button
                      onClick={() => toggleReady(lobbyState.id, userId, !isReady)}
                      className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold transition-colors cursor-pointer text-xs ${
                        isReady
                          ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {isReady ? 'Unready' : 'Ready'}
                    </button>
                  )}

                  {isHost && (
                    <button
                      onClick={() => startMatch(lobbyState.id, userId)}
                      disabled={!canStart}
                      className={`px-8 py-2.5 rounded-xl font-bold transition-all cursor-pointer text-xs ${
                        canStart
                          ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                          : 'bg-zinc-900 text-zinc-600 cursor-not-allowed border border-white/5'
                      }`}
                    >
                      {playersList.length === 1
                        ? 'Start Solo Time Trial'
                        : !allReady
                        ? 'Waiting for Players to Ready...'
                        : 'Start Match'}
                    </button>
                  )}
                </div>
              </GlassCard>
            </div>
          )}

          {renderRulesModal()}
        </div>
      )}

      {/* ── VIEW 2: 3D RACING VIEW ──────────────────────────── */}
      {(raceStatus === 'COUNTDOWN' || raceStatus === 'RACING' || raceStatus === 'FINISHED' || raceStatus === 'GAME_OVER') && (
        <div className="relative h-full w-full">
          {/* 3D WebGL Canvas */}
          <StreetRushCanvas
            status={raceStatus}
            countdownValue={countdownValue}
            targetLaps={targetLaps}
            localUserId={userId}
            localNickname={nickname}
            localCarId={selectedCarId}
            inputsRef={inputsRef}
            spectateTargetId={spectateTargetUserId}
            onSpectateTargetChange={(targetId) => setSpectateTargetUserId(targetId)}
            onRacerCheckpoint={(cpIndex, lap) => {
              if (lobbyState?.id) {
                sendCheckpoint(lobbyState.id, userId, cpIndex, lap);
              }
            }}
            onRacerFinished={(finishTime) => {
              if (lobbyState?.id) {
                sendRacerFinished(lobbyState.id, userId, finishTime);
              }
            }}
            onSendTransform={(data) => {
              if (lobbyState?.id) {
                sendTransform(lobbyState.id, userId, data);
              }
            }}
            onStatsUpdate={(stats) => {
              setHudStats(stats);
            }}
          />

          {/* Minimal Modern Racing HUD */}
          <RaceHUD
            status={raceStatus}
            countdownValue={countdownValue}
            currentLap={hudStats.currentLap}
            totalLaps={targetLaps}
            currentCheckpoint={hudStats.currentCheckpoint}
            totalCheckpoints={7}
            speedKmh={hudStats.speedKmh}
            nitroMeter={hudStats.nitroMeter}
            isNitroActive={hudStats.isNitro}
            isDrifting={hudStats.isDrifting}
            wrongWay={hudStats.wrongWay}
            elapsedTimeMs={elapsedTimeMs}
            rankings={hudStats.rankings}
            localRank={hudStats.localRank}
            totalRacers={playersList.length || 1}
            isFinished={hudStats.isFinished}
            finishPosition={hudStats.finishPosition}
            isSpectating={hudStats.isSpectating}
            spectatedRacer={hudStats.spectatedRacer}
            availableSpectateTargets={hudStats.availableSpectateTargets}
            onSwitchSpectate={(direction) => {
              const targets = hudStats.availableSpectateTargets;
              if (targets.length <= 1) return;
              const currIdx = targets.findIndex((t) => t.userId === spectateTargetUserId);
              let nextIdx = direction === 'next' ? currIdx + 1 : currIdx - 1;
              if (nextIdx >= targets.length) nextIdx = 0;
              if (nextIdx < 0) nextIdx = targets.length - 1;
              setSpectateTargetUserId(targets[nextIdx].userId);
            }}
          />

          {/* Mobile Touch Controls (Hidden while spectating) */}
          {!hudStats.isSpectating && (
            <MobileControls
              onInputsChange={(updater) => {
                inputsRef.current = updater(inputsRef.current);
              }}
            />
          )}
        </div>
      )}

      {/* ── VIEW 3: RACE RESULTS MODAL ──────────────────────── */}
      {raceStatus === 'GAME_OVER' && raceResults && (
        <RaceResultsModal
          results={raceResults}
          localUserId={userId}
          isHost={isHost}
          onRematch={() => {
            const activeId = lobbyState?.id || raceResults?.matchId;
            if (activeId && isHost) {
              startMatch(activeId, userId);
            }
          }}
          onReturnToLobby={() => {
            const activeId = lobbyState?.id || raceResults?.matchId || '';
            sendReturnToLobby(activeId, userId);
          }}
          onLeaveGame={() => {
            const activeId = lobbyState?.id || raceResults?.matchId || '';
            leaveLobby(activeId, userId);
          }}
        />
      )}

      {/* In-Game Multiplayer Chat Drawer */}
      {lobbyState && (
        <GameChatDrawer
          gameId={lobbyState.id}
          currentUser={{ id: userId, nickname, avatar: useUserStore.getState().avatar }}
          title={lobbyState.status === 'WAITING' ? 'Lobby Chat' : 'Race Match Chat'}
        />
      )}
    </div>
  );
}
