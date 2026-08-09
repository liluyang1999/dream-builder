import { DEFAULT_SETTINGS } from '@dream-builder/ipc-contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { useAppStore } from '../state/store';
import { SettingsOverlay } from '../ui/SettingsOverlay';

describe('SettingsOverlay', () => {
  beforeEach(() => {
    useAppStore.setState({
      settingsOpen: true,
      masterVolume: DEFAULT_SETTINGS.masterVolume,
      graphicsQuality: DEFAULT_SETTINGS.graphicsQuality,
      highContrast: false,
    });
  });

  test('applies bounded audiovisual preferences immediately', () => {
    render(<SettingsOverlay />);

    fireEvent.change(screen.getByRole('slider', { name: '总音量' }), {
      target: { value: '37' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: '画面质量' }), {
      target: { value: 'low' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: '高对比度' }));

    const state = useAppStore.getState();
    expect(state.masterVolume).toBe(37);
    expect(state.graphicsQuality).toBe('low');
    expect(state.highContrast).toBe(true);
  });

  test('closes with Escape without changing the session mode', () => {
    useAppStore.setState({ sessionMode: 'paused' });
    render(<SettingsOverlay />);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(useAppStore.getState().settingsOpen).toBe(false);
    expect(useAppStore.getState().sessionMode).toBe('paused');
  });
});
