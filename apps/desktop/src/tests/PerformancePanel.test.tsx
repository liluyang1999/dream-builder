import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { performanceCapture } from '../performance/performanceCapture';
import { useAppStore } from '../state/store';
import { PerformancePanel } from '../ui/PerformancePanel';

describe('PerformancePanel', () => {
  beforeEach(() => {
    performanceCapture.clear();
    useAppStore.setState({ seed: 424242, source: 'fallback', reducedMotion: false });
  });

  afterEach(() => {
    act(() => performanceCapture.clear());
  });

  test('starts and manually completes an explicitly requested capture', () => {
    render(<PerformancePanel open onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: '开始 10 分钟记录' }));
    expect(screen.getByText('记录中')).toBeTruthy();
    expect(screen.getByRole('button', { name: '停止并生成报告' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '停止并生成报告' }));
    expect(screen.getByText('报告已生成')).toBeTruthy();
    expect(screen.getByRole('button', { name: '清除报告' })).toBeTruthy();
  });

  test('closes without discarding an active capture', () => {
    const onClose = vi.fn();
    render(<PerformancePanel open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '开始 10 分钟记录' }));

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(performanceCapture.getSnapshot().status).toBe('recording');
  });
});
