import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Zap, Disc } from 'lucide-react';
import { RaceInputs } from '../types';

interface MobileControlsProps {
  onInputsChange: (updater: (prev: RaceInputs) => RaceInputs) => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({ onInputsChange }) => {
  const [leftActive, setLeftActive] = useState(false);
  const [rightActive, setRightActive] = useState(false);
  const [gasActive, setGasActive] = useState(false);
  const [brakeActive, setBrakeActive] = useState(false);
  const [driftActive, setDriftActive] = useState(false);
  const [nitroActive, setNitroActive] = useState(false);

  // Steer Left
  const handleLeftDown = () => {
    setLeftActive(true);
    onInputsChange((prev) => ({ ...prev, steer: -1 }));
  };
  const handleLeftUp = () => {
    setLeftActive(false);
    onInputsChange((prev) => ({ ...prev, steer: rightActive ? 1 : 0 }));
  };

  // Steer Right
  const handleRightDown = () => {
    setRightActive(true);
    onInputsChange((prev) => ({ ...prev, steer: 1 }));
  };
  const handleRightUp = () => {
    setRightActive(false);
    onInputsChange((prev) => ({ ...prev, steer: leftActive ? -1 : 0 }));
  };

  // Gas
  const handleGasDown = () => {
    setGasActive(true);
    onInputsChange((prev) => ({ ...prev, throttle: 1, brake: 0 }));
  };
  const handleGasUp = () => {
    setGasActive(false);
    onInputsChange((prev) => ({ ...prev, throttle: 0 }));
  };

  // Brake
  const handleBrakeDown = () => {
    setBrakeActive(true);
    onInputsChange((prev) => ({ ...prev, brake: 1, throttle: 0 }));
  };
  const handleBrakeUp = () => {
    setBrakeActive(false);
    onInputsChange((prev) => ({ ...prev, brake: 0 }));
  };

  // Drift
  const handleDriftDown = () => {
    setDriftActive(true);
    onInputsChange((prev) => ({ ...prev, handbrake: true }));
  };
  const handleDriftUp = () => {
    setDriftActive(false);
    onInputsChange((prev) => ({ ...prev, handbrake: false }));
  };

  // Nitro
  const handleNitroDown = () => {
    setNitroActive(true);
    onInputsChange((prev) => ({ ...prev, nitro: true }));
  };
  const handleNitroUp = () => {
    setNitroActive(false);
    onInputsChange((prev) => ({ ...prev, nitro: false }));
  };

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-6 z-20 flex justify-between px-6 select-none md:hidden">
      {/* ── LEFT THUMB: STEERING ──────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onTouchStart={handleLeftDown}
          onTouchEnd={handleLeftUp}
          onMouseDown={handleLeftDown}
          onMouseUp={handleLeftUp}
          className={`flex h-16 w-16 items-center justify-center rounded-2xl border ${
            leftActive
              ? 'border-cyan-400 bg-cyan-500/40 text-white shadow-lg shadow-cyan-500/50 scale-95'
              : 'border-white/20 bg-slate-900/70 text-slate-200'
          } backdrop-blur-md transition-all active:scale-90`}
          aria-label="Steer Left"
        >
          <ArrowLeft className="w-8 h-8" />
        </button>

        <button
          type="button"
          onTouchStart={handleRightDown}
          onTouchEnd={handleRightUp}
          onMouseDown={handleRightDown}
          onMouseUp={handleRightUp}
          className={`flex h-16 w-16 items-center justify-center rounded-2xl border ${
            rightActive
              ? 'border-cyan-400 bg-cyan-500/40 text-white shadow-lg shadow-cyan-500/50 scale-95'
              : 'border-white/20 bg-slate-900/70 text-slate-200'
          } backdrop-blur-md transition-all active:scale-90`}
          aria-label="Steer Right"
        >
          <ArrowRight className="w-8 h-8" />
        </button>
      </div>

      {/* ── RIGHT THUMB: PEDALS & DRIFT / NITRO ───────────── */}
      <div className="flex items-end gap-3">
        {/* Drift / Handbrake button */}
        <button
          type="button"
          onTouchStart={handleDriftDown}
          onTouchEnd={handleDriftUp}
          onMouseDown={handleDriftDown}
          onMouseUp={handleDriftUp}
          className={`flex h-12 w-14 items-center justify-center rounded-xl border text-[10px] font-black uppercase tracking-wider ${
            driftActive
              ? 'border-amber-400 bg-amber-500/50 text-white scale-95 shadow-md shadow-amber-500/50'
              : 'border-white/20 bg-slate-900/70 text-amber-300'
          } backdrop-blur-md transition-all active:scale-90`}
        >
          <Disc className="w-3.5 h-3.5 mr-1" /> DRIFT
        </button>

        {/* Nitro button */}
        <button
          type="button"
          onTouchStart={handleNitroDown}
          onTouchEnd={handleNitroUp}
          onMouseDown={handleNitroDown}
          onMouseUp={handleNitroUp}
          className={`flex h-12 w-14 items-center justify-center rounded-xl border text-[10px] font-black uppercase tracking-wider ${
            nitroActive
              ? 'border-cyan-400 bg-cyan-500/60 text-white scale-95 shadow-lg shadow-cyan-400/60'
              : 'border-cyan-500/30 bg-cyan-950/60 text-cyan-300'
          } backdrop-blur-md transition-all active:scale-90`}
        >
          <Zap className="w-4 h-4 mr-0.5" /> BOOST
        </button>

        {/* Brake / Reverse */}
        <button
          type="button"
          onTouchStart={handleBrakeDown}
          onTouchEnd={handleBrakeUp}
          onMouseDown={handleBrakeDown}
          onMouseUp={handleBrakeUp}
          className={`flex h-16 w-16 items-center justify-center rounded-2xl border text-xs font-black uppercase tracking-wider ${
            brakeActive
              ? 'border-red-400 bg-red-500/50 text-white scale-95'
              : 'border-white/20 bg-slate-900/70 text-red-300'
          } backdrop-blur-md transition-all active:scale-90`}
        >
          BRAKE
        </button>

        {/* Gas / Accelerate */}
        <button
          type="button"
          onTouchStart={handleGasDown}
          onTouchEnd={handleGasUp}
          onMouseDown={handleGasDown}
          onMouseUp={handleGasUp}
          className={`flex h-20 w-20 items-center justify-center rounded-2xl border text-sm font-black uppercase tracking-wider ${
            gasActive
              ? 'border-emerald-400 bg-emerald-500/50 text-white scale-95 shadow-xl shadow-emerald-500/40'
              : 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300'
          } backdrop-blur-md transition-all active:scale-90`}
        >
          GAS
        </button>
      </div>
    </div>
  );
};
