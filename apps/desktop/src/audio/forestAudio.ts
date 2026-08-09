import type { ForestAudioCue } from './progressAudio';

export interface ForestAudioMix {
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
}

interface AudioContextWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const CUE_NOTES: Record<ForestAudioCue, readonly number[]> = {
  seed: [659.25, 880],
  checkpoint: [392, 523.25],
  memory: [293.66, 440, 587.33],
  ritual: [220, 329.63, 440],
  'ritual-step': [523.25],
  'ritual-error': [196, 174.61],
  restore: [261.63, 329.63, 392, 523.25],
};

export function gainFromPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = Math.min(100, Math.max(0, value)) / 100;
  return normalized * normalized;
}

class ForestAudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private restorationGain: GainNode | null = null;
  private ambientSources: AudioScheduledSourceNode[] = [];
  private mix: ForestAudioMix = {
    masterVolume: 80,
    musicVolume: 55,
    effectsVolume: 75,
  };
  private paused = true;
  private restored = false;

  async unlock(): Promise<boolean> {
    if (!this.context) {
      const Context = window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
      if (!Context) return false;
      this.context = new Context();
      this.createGraph(this.context);
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    this.applyMix();
    return this.context.state === 'running';
  }

  setMix(mix: ForestAudioMix): void {
    this.mix = mix;
    this.applyMix();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.applyMix();
  }

  setRestored(restored: boolean): void {
    this.restored = restored;
    this.applyMix();
  }

  playCue(cue: ForestAudioCue): void {
    const context = this.context;
    const effectsGain = this.effectsGain;
    if (!context || !effectsGain || context.state !== 'running') return;

    const now = context.currentTime;
    const notes = CUE_NOTES[cue];
    const duration = cue === 'restore' ? 1.6 : cue === 'memory' ? 1.05 : 0.48;
    for (const [index, frequency] of notes.entries()) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const start = now + index * (cue === 'restore' ? 0.12 : 0.055);
      oscillator.type = cue === 'ritual-error' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      if (cue === 'seed' || cue === 'restore') {
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.01, start + duration);
      }
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(cue === 'restore' ? 0.18 : 0.12, start + 0.03);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(envelope);
      envelope.connect(effectsGain);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
    }
  }

  dispose(): void {
    for (const source of this.ambientSources) {
      try {
        source.stop();
      } catch {
        // A source may already have stopped while the window is closing.
      }
    }
    this.ambientSources = [];
    void this.context?.close();
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.effectsGain = null;
    this.restorationGain = null;
  }

  private createGraph(context: AudioContext): void {
    this.masterGain = context.createGain();
    this.musicGain = context.createGain();
    this.effectsGain = context.createGain();
    this.restorationGain = context.createGain();

    this.musicGain.connect(this.masterGain);
    this.effectsGain.connect(this.masterGain);
    this.restorationGain.connect(this.musicGain);
    this.masterGain.connect(context.destination);

    const padA = this.createPad(context, 110, 0.035, 'sine');
    const padB = this.createPad(context, 164.81, 0.018, 'triangle');
    padA.connect(this.musicGain);
    padB.connect(this.musicGain);

    const restorationPad = this.createPad(context, 220, 0.028, 'sine');
    restorationPad.connect(this.restorationGain);

    const wind = this.createWind(context);
    wind.connect(this.musicGain);
    this.ambientSources.push(padA.source, padB.source, restorationPad.source, wind.source);
  }

  private createPad(
    context: AudioContext,
    frequency: number,
    gain: number,
    type: OscillatorType,
  ): { source: OscillatorNode; connect(destination: AudioNode): void } {
    const oscillator = context.createOscillator();
    const level = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    level.gain.value = gain;
    oscillator.connect(level);
    oscillator.start();
    return {
      source: oscillator,
      connect(destination) {
        level.connect(destination);
      },
    };
  }

  private createWind(context: AudioContext): {
    source: AudioBufferSourceNode;
    connect(destination: AudioNode): void;
  } {
    const seconds = 2;
    const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
    const data = buffer.getChannelData(0);
    let randomState = 0x13579bdf;
    for (let index = 0; index < data.length; index += 1) {
      randomState = (randomState * 1664525 + 1013904223) >>> 0;
      data[index] = (randomState / 0xffffffff) * 2 - 1;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    filter.Q.value = 0.55;
    const level = context.createGain();
    level.gain.value = 0.018;
    source.connect(filter);
    filter.connect(level);
    source.start();
    return {
      source,
      connect(destination) {
        level.connect(destination);
      },
    };
  }

  private applyMix(): void {
    const context = this.context;
    if (!context || !this.masterGain || !this.musicGain || !this.effectsGain) return;
    const now = context.currentTime;
    const ramp = 0.08;
    this.masterGain.gain.setTargetAtTime(gainFromPercent(this.mix.masterVolume), now, ramp);
    this.musicGain.gain.setTargetAtTime(
      gainFromPercent(this.mix.musicVolume) * (this.paused ? 0.22 : 1),
      now,
      ramp,
    );
    this.effectsGain.gain.setTargetAtTime(gainFromPercent(this.mix.effectsVolume), now, ramp);
    this.restorationGain?.gain.setTargetAtTime(this.restored ? 1 : 0.0001, now, 0.6);
  }
}

export const forestAudio = new ForestAudioEngine();
