import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, RotateCcw, Home, LogOut, Award, Clock } from 'lucide-react';
import { RaceResult } from '../types';

interface RaceResultsModalProps {
  results: RaceResult | null;
  localUserId: string;
  isHost: boolean;
  onRematch: () => void;
  onReturnToLobby: () => void;
  onLeaveGame: () => void;
}

function formatTime(ms: number | null): string {
  if (!ms) return 'DNF';
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
}

export const RaceResultsModal: React.FC<RaceResultsModalProps> = ({
  results,
  localUserId,
  isHost,
  onRematch,
  onReturnToLobby,
  onLeaveGame,
}) => {
  if (!results) return null;

  const localEntry = results.standings.find((s) => s.userId === localUserId);
  const isWinner = localEntry?.rank === 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-cyan-500/30 bg-slate-950/95 p-8 shadow-2xl shadow-cyan-950/80"
      >
        {/* Header Title */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-amber-400">
            <Trophy className="w-4 h-4" /> RACE COMPLETE
          </div>
          <h2 className="mt-3 text-4xl font-black italic tracking-tight text-white uppercase">
            {isWinner ? (
              <span className="bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 bg-clip-text text-transparent">
                VICTORY! YOU WON!
              </span>
            ) : (
              <span>RACE RESULTS</span>
            )}
          </h2>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
            {results.trackName} — 3 Laps Completed
          </p>
        </div>

        {/* Podium Standings Table */}
        <div className="mt-6 space-y-2.5">
          {results.standings.map((entry) => {
            const isSelf = entry.userId === localUserId;
            const rankColors =
              entry.rank === 1
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                : entry.rank === 2
                ? 'border-slate-400/40 bg-slate-400/10 text-slate-200'
                : entry.rank === 3
                ? 'border-amber-700/40 bg-amber-700/10 text-amber-600'
                : 'border-white/10 bg-slate-900/50 text-slate-400';

            return (
              <div
                key={entry.userId}
                className={`flex items-center justify-between rounded-2xl border p-4 backdrop-blur-sm transition-all ${rankColors} ${
                  isSelf ? 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/20' : ''
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black ${
                      entry.rank === 1
                        ? 'bg-amber-400 text-black'
                        : entry.rank === 2
                        ? 'bg-slate-300 text-black'
                        : entry.rank === 3
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    #{entry.rank}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-white">
                        {entry.nickname}
                      </span>
                      {isSelf && (
                        <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase text-cyan-300 border border-cyan-500/30">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      {entry.carId.replace('_', ' ')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-right">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-mono text-sm font-bold text-white">
                    {entry.isDNF ? 'DNF' : formatTime(entry.finishTime)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
          {isHost && (
            <button
              onClick={onRematch}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3.5 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-cyan-500/30 transition-all hover:brightness-110 active:scale-95"
            >
              <RotateCcw className="w-4 h-4" /> Rematch
            </button>
          )}

          <button
            onClick={onReturnToLobby}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-slate-900 px-5 py-3.5 text-sm font-black uppercase tracking-wider text-slate-200 transition-all hover:bg-slate-800 active:scale-95"
          >
            <Home className="w-4 h-4" /> Return to Lobby
          </button>

          <button
            onClick={onLeaveGame}
            className="flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-950/40 px-5 py-3.5 text-sm font-black uppercase tracking-wider text-red-400 transition-all hover:bg-red-900/60 active:scale-95"
          >
            <LogOut className="w-4 h-4" /> Leave
          </button>
        </div>
      </motion.div>
    </div>
  );
};
