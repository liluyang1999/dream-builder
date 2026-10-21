import { act, screen, waitFor } from '@testing-library/react';
import type { Root } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';

const mounted = vi.hoisted(() => ({ root: null as Root | null }));
vi.mock('react-dom/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-dom/client')>();
  return {
    ...original,
    createRoot: (...args: Parameters<typeof original.createRoot>) => {
      mounted.root = original.createRoot(...args);
      return mounted.root;
    },
  };
});
vi.mock('../App', () => {
  throw new Error('entry module unavailable');
});

afterEach(() => {
  act(() => mounted.root?.unmount());
  document.getElementById('app')?.remove();
  vi.restoreAllMocks();
});

test('offers recovery when the initial application module cannot load', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const container = document.createElement('div');
  container.id = 'app';
  document.body.appendChild(container);

  await act(async () => {
    await import('../main');
  });

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByRole('button', { name: '重新载入游戏' })).toBeTruthy();
});
