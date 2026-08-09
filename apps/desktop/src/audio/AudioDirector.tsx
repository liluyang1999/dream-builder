import { useEffect, useRef } from 'react';
import { useAppStore } from '../state/store';
import { forestAudio } from './forestAudio';
import { cuesForProgressChange } from './progressAudio';

export function AudioDirector() {
  const masterVolume = useAppStore((state) => state.masterVolume);
  const musicVolume = useAppStore((state) => state.musicVolume);
  const effectsVolume = useAppStore((state) => state.effectsVolume);
  const sessionMode = useAppStore((state) => state.sessionMode);
  const progress = useAppStore((state) => state.progress);
  const previousProgressRef = useRef(progress);

  useEffect(() => {
    forestAudio.setMix({ masterVolume, musicVolume, effectsVolume });
  }, [masterVolume, musicVolume, effectsVolume]);

  useEffect(() => {
    forestAudio.setPaused(sessionMode !== 'playing');
  }, [sessionMode]);

  useEffect(() => {
    forestAudio.setRestored(progress.nodeState === 'restored');
    const previous = previousProgressRef.current;
    for (const cue of cuesForProgressChange(previous, progress)) {
      forestAudio.playCue(cue);
    }
    previousProgressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    let active = true;
    const unlock = () => {
      void forestAudio.unlock().then((unlocked) => {
        if (!active || !unlocked) return;
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      });
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      active = false;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  return null;
}
