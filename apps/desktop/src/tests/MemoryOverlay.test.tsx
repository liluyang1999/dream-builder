import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { useAppStore } from '../state/store';
import { MemoryOverlay } from '../ui/MemoryOverlay';

describe('MemoryOverlay', () => {
  beforeEach(() => {
    useAppStore.setState({ activeMemoryId: null });
  });

  test('focuses the narrative, exposes it as a modal, and closes with Escape', () => {
    useAppStore.getState().openMemory('mossbound-echo');
    render(<MemoryOverlay />);

    expect(screen.getByRole('dialog', { name: '记忆碎片 · 守望者的约定' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '回到森林' })).toBe(document.activeElement);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
