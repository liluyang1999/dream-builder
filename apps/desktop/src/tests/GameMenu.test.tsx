import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { INITIAL_GAME_PROGRESS } from '../game/gameProgress';
import { useAppStore } from '../state/store';
import { GameMenu } from '../ui/GameMenu';

function renderMenu(onNewGame = vi.fn()) {
  render(<GameMenu onNewGame={onNewGame} onOpenHelp={vi.fn()} onQuit={vi.fn()} />);
  return onNewGame;
}

describe('GameMenu', () => {
  beforeEach(() => {
    useAppStore.setState({
      sessionMode: 'title',
      settingsOpen: false,
      creditsOpen: false,
      helpOpen: false,
      progress: INITIAL_GAME_PROGRESS,
    });
  });

  test('starts an untouched chapter from the title screen', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: '进入森林' }));
    expect(useAppStore.getState().sessionMode).toBe('playing');
  });

  test('requires a second explicit action before replacing existing progress', () => {
    useAppStore.setState({
      progress: { ...INITIAL_GAME_PROGRESS, activeCheckpoint: 'creek' },
    });
    const onNewGame = renderMenu();

    fireEvent.click(screen.getByRole('button', { name: '开始新旅程' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(onNewGame).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '确认开始新旅程' })).toBe(document.activeElement);

    fireEvent.click(screen.getByRole('button', { name: '确认开始新旅程' }));
    expect(onNewGame).toHaveBeenCalledOnce();
  });

  test('resumes a paused session with Escape', () => {
    useAppStore.setState({ sessionMode: 'paused' });
    renderMenu();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useAppStore.getState().sessionMode).toBe('playing');
  });
});
