import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useAppStore } from '../state/store';
import { ChapterCompleteOverlay } from '../ui/ChapterCompleteOverlay';

describe('ChapterCompleteOverlay', () => {
  beforeEach(() => {
    useAppStore.setState({
      chapterCompleteOpen: true,
      sessionMode: 'playing',
    });
  });

  test('lets the player keep exploring without changing committed progress', () => {
    const progress = useAppStore.getState().progress;
    render(<ChapterCompleteOverlay onScreenshot={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '继续漫游' }));

    expect(useAppStore.getState().chapterCompleteOpen).toBe(false);
    expect(useAppStore.getState().progress).toBe(progress);
  });

  test('offers an explicit screenshot action before returning to the title', () => {
    const onScreenshot = vi.fn();
    render(<ChapterCompleteOverlay onScreenshot={onScreenshot} />);

    fireEvent.click(screen.getByRole('button', { name: '保存这一刻' }));
    expect(onScreenshot).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: '返回标题' }));
    expect(useAppStore.getState().sessionMode).toBe('title');
  });
});
