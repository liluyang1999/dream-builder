import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import {
  type GameProgress,
  INITIAL_GAME_PROGRESS,
  LIGHT_SEED_IDS,
  reduceGameProgress,
} from '../game/gameProgress';
import { PURIFICATION_SEQUENCE, type RuneDirection } from '../game/purificationPuzzle';
import { useAppStore } from '../state/store';
import { PurificationOverlay } from '../ui/PurificationOverlay';

const DIRECTION_LABEL: Record<RuneDirection, string> = {
  north: '向北',
  east: '向东',
  south: '向南',
  west: '向西',
};

describe('PurificationOverlay', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({ progress: createCleansingProgress(), interactionPrompt: null });
  });

  test('resets a wrong local attempt, then restores the forest after the full rhythm', () => {
    render(<PurificationOverlay />);
    expect(screen.getByRole('dialog', { name: '让微光沿正确方向流动' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '向北' }));
    fireEvent.click(screen.getByRole('button', { name: '向南' }));
    expect(screen.getByText(/光种不会丢失/)).toBeTruthy();
    expect(useAppStore.getState().progress.nodeState).toBe('cleansing');
    expect(useAppStore.getState().progress.collectedCount).toBe(3);

    for (const direction of PURIFICATION_SEQUENCE) {
      fireEvent.click(screen.getByRole('button', { name: DIRECTION_LABEL[direction] }));
    }

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useAppStore.getState().progress.nodeState).toBe('restored');
    expect(useAppStore.getState().progress.gateUnlocked).toBe(true);
  });

  test('cancels with Escape while retaining all collected light seeds', () => {
    render(<PurificationOverlay />);
    fireEvent.keyDown(window, { key: 'Escape' });

    const progress = useAppStore.getState().progress;
    expect(progress.nodeState).toBe('ready');
    expect(progress.collectedCount).toBe(3);
    expect(Object.values(progress.seeds).every((state) => state === 'collected')).toBe(true);
  });
});

function createCleansingProgress(): GameProgress {
  let progress = INITIAL_GAME_PROGRESS;
  for (const id of LIGHT_SEED_IDS) {
    progress = reduceGameProgress(progress, { type: 'reveal-seed', id });
    progress = reduceGameProgress(progress, { type: 'collect-seed', id });
  }
  return reduceGameProgress(progress, { type: 'begin-cleansing' });
}
