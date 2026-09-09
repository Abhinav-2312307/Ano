/**
 * Street Rush — Procedural Web Audio Sound Generator
 * Generates racing audio without external sound assets:
 * - Engine RPM synthesis (sawtooth + dynamic lowpass filter)
 * - Nitro boost thruster roar
 * - Tire screech (bandpass white noise)
 * - Barrier impact clang
 * - Countdown beeps (3, 2, 1, GO!)
 * - Checkpoint pass ding
 * - Victory fanfare
 */

class StreetRushAudioSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('street_rush_sound_muted');
        this.isMuted = saved !== null ? JSON.parse(saved) : true;
      } catch {
        this.isMuted = true;
      }
    }
  }

  // Engine nodes
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineRunning: boolean = false;

  // Nitro nodes
  private nitroGain: GainNode | null = null;
  private nitroNoise: AudioBufferSourceNode | null = null;
  private nitroActive: boolean = false;

  private initCtx() {
    if (this.isMuted) return;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopEngineSound();
      this.stopNitroSound();
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    } else {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // ── 1. V8 ENGINE SOUND ─────────────────────────────────────
  public startEngineSound() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || this.engineRunning) return;

    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineFilter = this.ctx.createBiquadFilter();

      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(65, this.ctx.currentTime); // Idle RPM: 65Hz

      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(320, this.ctx.currentTime);

      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineGain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      this.engineOsc.start();
      this.engineRunning = true;
    } catch {
      // AudioContext autostart restrictions
    }
  }

  public updateEngineSound(speedRatio: number, isAccelerating: boolean) {
    if (this.isMuted || !this.engineOsc || !this.ctx || !this.engineRunning) return;
    const clamped = Math.min(1.2, Math.max(0, speedRatio));
    const now = this.ctx.currentTime;

    // Shift RPM up on acceleration, drop slightly on coasting
    const baseRpm = 65 + clamped * 260;
    const targetFreq = isAccelerating ? baseRpm * 1.15 : baseRpm;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.04);

    if (this.engineFilter) {
      const targetCutoff = 300 + clamped * 650;
      this.engineFilter.frequency.setTargetAtTime(targetCutoff, now, 0.05);
    }

    if (this.engineGain) {
      const targetGain = 0.05 + clamped * 0.08;
      this.engineGain.gain.setTargetAtTime(targetGain, now, 0.04);
    }
  }

  public stopEngineSound() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch {}
      this.engineOsc = null;
    }
    this.engineRunning = false;
  }

  // ── 2. NITRO BOOST WHOOSH ──────────────────────────────────
  public startNitroSound() {
    if (this.isMuted || this.nitroActive) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      this.nitroActive = true;
      const bufferSize = this.ctx.sampleRate * 1.0;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, this.ctx.currentTime);
      filter.Q.setValueAtTime(2.5, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.15);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
      this.nitroNoise = noise;
      this.nitroGain = gain;
    } catch {}
  }

  public stopNitroSound() {
    if (!this.nitroActive) return;
    this.nitroActive = false;
    if (this.nitroGain && this.ctx) {
      try {
        this.nitroGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
      } catch {}
    }
    setTimeout(() => {
      if (this.nitroNoise) {
        try {
          this.nitroNoise.stop();
          this.nitroNoise.disconnect();
        } catch {}
        this.nitroNoise = null;
      }
    }, 160);
  }

  // ── 3. TIRE SCREECH (DRIFT) ─────────────────────────────────
  public playTireScreech() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const duration = 0.22;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200 + Math.random() * 300, this.ctx.currentTime);
      filter.Q.setValueAtTime(4.0, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
    } catch {}
  }

  // ── 4. BARRIER IMPACT CLANG ─────────────────────────────────
  public playImpactSound(intensity: number = 1.0) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);

      const vol = Math.min(0.2, 0.08 * intensity);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.23);
    } catch {}
  }

  // ── 5. COUNTDOWN BEEPS ──────────────────────────────────────
  public playCountdownBeep(isGo: boolean = false) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = isGo ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(isGo ? 880 : 440, now); // A4 (low) vs A5 (high)

      const duration = isGo ? 0.45 : 0.2;
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {}
  }

  // ── 6. CHECKPOINT PASS DING ─────────────────────────────────
  public playCheckpointDing() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.06); // E6

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch {}
  }

  // ── 7. FINISH VICTORY FANFARE ───────────────────────────────
  public playFinishFanfare() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const now = this.ctx!.currentTime + i * 0.12;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now);
        osc.stop(now + 0.42);
      });
    } catch {}
  }
}

export const streetRushAudio = new StreetRushAudioSystem();
