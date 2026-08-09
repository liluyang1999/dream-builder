import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { HelpOverlay } from '../ui/HelpOverlay';

describe('HelpOverlay', () => {
  test('requires explicit confirmation before restarting the chapter', () => {
    const onClose = vi.fn();
    const onRestartChapter = vi.fn();
    render(
      <HelpOverlay
        open
        onClose={onClose}
        onOpenPerformance={() => {}}
        onRestartChapter={onRestartChapter}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '重新开始本章' }));
    expect(onRestartChapter).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('清除本章进度');

    fireEvent.click(screen.getByRole('button', { name: '确认重开' }));
    expect(onRestartChapter).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  test('opens the performance recorder from the secondary help surface', () => {
    const onOpenPerformance = vi.fn();
    render(
      <HelpOverlay
        open
        onClose={() => {}}
        onOpenPerformance={onOpenPerformance}
        onRestartChapter={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '性能记录' }));
    expect(onOpenPerformance).toHaveBeenCalledOnce();
  });
});
