import React from 'react';
import { RankItem, RaceStatus, SpectatedRacerInfo } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, AlertTriangle, Flag, Clock, Eye, ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import { CAR_SPECS } from '../config/carConfig';

interface RaceHUDProps {
  status: RaceStatus;
  countdownValue: number | null;
  currentLap: number;
  totalLaps: number;
  currentCheckpoint: number;
  totalCheckpoints: number;
  speedKmh: number;
  nitroMeter: number;
  isNitroActive: boolean;
  isDrifting: boolean;
  wrongWay: boolean;
  elapsedTimeMs: number;
  rankings: RankItem[];
  localRank: number;
  totalRacers: number;
  isFinished: boolean;
  finishPosition: number | null;
  isSpectating?: boolean;
  spectatedRacer?: SpectatedRacerInfo | null;
  availableSpectateTargets?: Array<{
    userId: string;
    nickname: string;
    rank: number;
  }>;
  onSwitchSpectate?: (direction: 'next' | 'prev') => void;
}

function formatRaceTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
}

export const RaceHUD: React.FC<RaceHUDProps> = ({
  status,
  countdownValue,
  currentLap,
  totalLaps,
  currentCheckpoint,
  totalCheckpoints,
  speedKmh,
  nitroMeter,
  isNitroActive,
  isDrifting,
  wrongWay,
  elapsedTimeMs,
  rankings,
  localRank,
  totalRacers,
  isFinished,
  finishPosition,
  isSpectating = false,
  spectatedRacer = null,
  availableSpectateTargets = [],
  onSwitchSpectate,
}) => {
  const displayLap = Math.min(totalLaps, currentLap + 1);

  return (
    <div className="pointer-events-none absolute inset-0 select-none overflow-hidden font-sans">
      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
        {/* Left: Position Rank / Finish Trophy */}
        <div className="flex items-center gap-3">
          {isFinished ? (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-slate-950/85 px-4 py-2 backdrop-blur-md shadow-lg shadow-amber-950/40">
              <Trophy className="w-6 h-6 text-amber-400" />
              <div>
                <span className="text-[9px] uppercase tracking-widest font-black text-amber-400 block">YOU FINISHED</span>
                <span className="text-2xl font-black text-white">
                  {finishPosition === 1 ? '1ST PLACE 🏆' : `${finishPosition || localRank}TH PLACE`}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-baseline gap-1 rounded-2xl border border-cyan-500/30 bg-slate-950/80 px-4 py-2 backdrop-blur-md shadow-lg shadow-cyan-950/50">
              <span className="text-[10px] uppercase tracking-widest font-black text-cyan-400">POS</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-3xl font-black text-white">
                  {localRank}
                </span>
                <span className="text-sm font-bold text-slate-400">/{totalRacers || 1}</span>
              </div>
            </div>
          )}

          {/* Drift Indicator */}
          {isDrifting && !isFinished && (
            <motion.div
              key="drift-indicator"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-amber-300 backdrop-blur-md"
            >
              DRIFT
            </motion.div>
          )}
        </div>

        {/* Center: Lap Counter & Race Clock */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/80 px-5 py-2 backdrop-blur-md shadow-xl">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Flag className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-wider">
                LAP {displayLap}/{totalLaps}
              </span>
            </div>

            <div className="h-4 w-px bg-white/20" />

            <div className="flex items-center gap-1.5 text-cyan-300 font-mono text-sm font-bold">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatRaceTime(elapsedTimeMs)}</span>
            </div>
          </div>

          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            CP {currentCheckpoint + 1}/{totalCheckpoints}
          </span>
        </div>

        {/* Right: Live Leaderboard Snippet */}
        <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-slate-950/80 p-2.5 backdrop-blur-md shadow-lg min-w-[160px]">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-0.5">STANDINGS</div>
          {rankings.slice(0, 4).map((r) => {
            const isCurrentlySpectated = isSpectating && spectatedRacer?.userId === r.userId;
            return (
              <div
                key={r.userId}
                className={`flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                  isCurrentlySpectated
                    ? 'bg-purple-500/30 text-purple-200 border border-purple-400/50'
                    : r.isLocal
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className={`w-4 text-center font-black ${
                      r.rank === 1 ? 'text-amber-400' : r.rank === 2 ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    #{r.rank}
                  </span>
                  <span className="truncate max-w-[80px]">{r.nickname}</span>
                </div>
                <div className="flex items-center gap-1">
                  {isCurrentlySpectated && <Eye className="w-3 h-3 text-cyan-400 animate-pulse" />}
                  <span className="text-[10px] font-mono text-slate-400">
                    {r.isFinished ? 'FIN' : `L${Math.min(totalLaps, r.completedLaps + 1)}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SPECTATOR OVERLAY BAR (WHEN FINISHED & SPECTATING) ── */}
      {isSpectating && spectatedRacer && (
        <div className="pointer-events-auto absolute top-20 inset-x-0 flex flex-col items-center gap-2 z-30">
          <motion.div
            key={`spectate-${spectatedRacer.userId}`}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center gap-3 rounded-2xl border border-cyan-500/40 bg-slate-950/90 px-5 py-2.5 backdrop-blur-xl shadow-2xl shadow-cyan-950/70"
          >
            {/* Pulsing Spectate Badge */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
              </span>
              <span className="text-xs font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> SPECTATING
              </span>
            </div>

            <div className="h-5 w-px bg-white/20" />

            {/* Spectated Racer Info */}
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-xs font-black text-amber-300">
                POS #{spectatedRacer.rank}
              </span>
              <span className="text-sm font-black text-white tracking-wide">
                {spectatedRacer.nickname}
              </span>
              <span className="text-xs text-slate-400">
                ({CAR_SPECS[spectatedRacer.carId]?.name || 'Racer'})
              </span>
              <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded-lg border border-cyan-500/30">
                Lap {Math.min(totalLaps, spectatedRacer.completedLaps + 1)}/{totalLaps}
              </span>
            </div>

            {/* Switch Target Controls */}
            {availableSpectateTargets && availableSpectateTargets.length > 1 && (
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  onClick={() => onSwitchSpectate?.('prev')}
                  className="flex h-7 px-2 items-center gap-1 rounded-lg border border-white/20 bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
                  title="Previous Racer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  onClick={() => onSwitchSpectate?.('next')}
                  className="flex h-7 px-2 items-center gap-1 rounded-lg border border-white/20 bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
                  title="Next Racer"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </motion.div>

          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 drop-shadow">
            Waiting for remaining racers to cross finish line • Use [A] / [D] or Arrow keys to switch
          </div>
        </div>
      )}

      {/* ── CENTER ALERTS & COUNTDOWN ──────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <AnimatePresence>
          {/* Countdown: 3, 2, 1, GO! */}
          {status === 'COUNTDOWN' && countdownValue !== null && countdownValue > 0 && (
            <motion.div
              key={`countdown-${countdownValue}`}
              initial={{ scale: 2.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="flex flex-col items-center"
            >
              <span className="text-8xl font-black italic tracking-tighter text-amber-400 drop-shadow-[0_0_40px_rgba(245,158,11,0.8)]">
                {countdownValue}
              </span>
              <span className="text-sm font-extrabold uppercase tracking-widest text-white/80 mt-2">
                GET READY!
              </span>
            </motion.div>
          )}

          {status === 'RACING' && elapsedTimeMs < 1500 && (
            <motion.div
              key="race-go-banner"
              initial={{ scale: 2.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="text-8xl font-black italic tracking-tight text-emerald-400 drop-shadow-[0_0_50px_rgba(52,211,153,0.9)]"
            >
              GO!
            </motion.div>
          )}

          {/* Wrong Way Warning */}
          {wrongWay && status === 'RACING' && !isFinished && (
            <motion.div
              key="wrong-way-warning"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: [1, 1.08, 1], opacity: 1 }}
              transition={{ repeat: Infinity, duration: 0.6 }}
              className="flex items-center gap-3 rounded-2xl border-2 border-red-500 bg-red-600/90 px-6 py-3 text-white shadow-2xl backdrop-blur-md"
            >
              <AlertTriangle className="w-8 h-8 text-white animate-bounce" />
              <div className="flex flex-col">
                <span className="text-2xl font-black uppercase tracking-wider">WRONG WAY!</span>
                <span className="text-xs font-bold text-red-200">Turn around and follow the track</span>
              </div>
            </motion.div>
          )}

          {/* Final Lap Banner */}
          {displayLap === totalLaps && !isFinished && status === 'RACING' && elapsedTimeMs > 2000 && currentCheckpoint === 0 && (
            <motion.div
              key="final-lap-banner"
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-amber-500/50 bg-amber-500/20 px-8 py-3 text-2xl font-black uppercase tracking-widest text-amber-300 backdrop-blur-md drop-shadow-[0_0_25px_rgba(245,158,11,0.5)]"
            >
              🏁 FINAL LAP! 🏁
            </motion.div>
          )}

          {/* Finish Banner when NOT spectating (Solo or all finished) */}
          {isFinished && !isSpectating && (
            <motion.div
              key="finish-result-banner"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-2 rounded-3xl border border-cyan-500/50 bg-slate-950/90 p-8 text-center backdrop-blur-xl shadow-2xl shadow-cyan-950/80"
            >
              <div className="text-xs font-black uppercase tracking-widest text-cyan-400">RACE FINISHED</div>
              <div className="text-5xl font-black tracking-tight text-white">
                {finishPosition === 1 ? '🏆 1ST PLACE!' : `${finishPosition || localRank}TH PLACE`}
              </div>
              <div className="text-sm font-mono text-slate-300 mt-1">
                Time: {formatRaceTime(elapsedTimeMs)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── BOTTOM HUD (SPEEDOMETER & NITRO) ────────────────── */}
      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-3">
        {/* Speedometer Gauge */}
        <div className="flex flex-col items-end rounded-2xl border border-white/10 bg-slate-950/85 px-6 py-3.5 backdrop-blur-md shadow-2xl">
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-black tracking-tighter text-white font-mono">
              {speedKmh}
            </span>
            <span className="text-xs font-extrabold uppercase text-slate-400">KM/H</span>
          </div>

          {/* Speed Bar */}
          <div className="mt-1.5 h-1.5 w-36 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all duration-75 ${
                speedKmh > 180
                  ? 'bg-gradient-to-r from-cyan-500 via-purple-500 to-rose-500'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500'
              }`}
              style={{ width: `${Math.min(100, (speedKmh / 230) * 100)}%` }}
            />
          </div>
        </div>

        {/* Nitro Meter */}
        <div className="flex items-center gap-3 rounded-2xl border border-cyan-500/30 bg-slate-950/85 px-4 py-2.5 backdrop-blur-md shadow-lg shadow-cyan-950/40">
          <div className="flex items-center gap-1.5">
            <Zap
              className={`w-4 h-4 ${
                isNitroActive ? 'text-cyan-400 animate-pulse' : 'text-slate-400'
              }`}
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
              NITRO
            </span>
          </div>

          <div className="relative h-3 w-32 overflow-hidden rounded-full border border-cyan-500/40 bg-slate-900">
            <div
              className={`h-full transition-all duration-75 ${
                isNitroActive
                  ? 'bg-gradient-to-r from-cyan-400 via-sky-300 to-white animate-pulse shadow-[0_0_12px_#06b6d4]'
                  : 'bg-gradient-to-r from-cyan-600 to-cyan-400'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, nitroMeter))}%` }}
            />
          </div>

          <span className="text-[10px] font-mono font-bold text-slate-400 min-w-[28px]">
            {Math.round(nitroMeter)}%
          </span>
        </div>
      </div>
    </div>
  );
};
