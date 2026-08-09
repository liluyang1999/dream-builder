import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { HelpOverlay } from '../ui/HelpOverlay';

describe('HelpOverlay', () => {
  test('owns keyboard focus and closes with the documented question-mark shortcut', () => {
    const onClose = vi.fn();
    render(
      <HelpOverlay
        open
        onClose={onClose}
        onOpenPerformance={() => {}}
        onRestartChapter={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: '重新开始本章' })).toBe(document.activeElement);
    fireEvent.keyDown(window, { key: '?' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  test('cycles focus inside the modal and restores the invoking control', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            打开帮助
          </button>
          <HelpOverlay
            open={open}
            onClose={() => setOpen(false)}
            onOpenPerformance={() => {}}
            onRestartChapter={() => {}}
          />
        </>
      );
    }

    render(<Harness />);
    const invokingButton = screen.getByRole('button', { name: '打开帮助' });
    invokingButton.focus();
    fireEvent.click(invokingButton);

    const firstButton = screen.getByRole('button', { name: '重新开始本章' });
    const lastButton = screen.getByRole('button', { name: '关闭' });
    expect(firstButton).toBe(document.activeElement);

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(lastButton).toBe(document.activeElement);
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(firstButton).toBe(document.activeElement);

    fireEvent.click(lastButton);
    expect(invokingButton).toBe(document.activeElement);
  });

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
    expect(screen.getByRole('button', { name: '确认重开' })).toBe(document.activeElement);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '重新开始本章' }));

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
