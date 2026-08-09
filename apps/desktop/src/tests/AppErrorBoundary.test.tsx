import { render, screen } from '@testing-library/react';
import { AppErrorBoundary } from '../ui/AppErrorBoundary';

function BrokenChild(): never {
  throw new Error('test forest failure');
}

describe('AppErrorBoundary', () => {
  test('offers a safe reload when the React tree crashes', () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      render(
        <AppErrorBoundary>
          <BrokenChild />
        </AppErrorBoundary>,
      );
    } finally {
      console.error = originalError;
    }

    expect(screen.getByRole('heading', { name: '森林暂时迷路了' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '重新载入游戏' })).toBeTruthy();
    expect(screen.getByText('test forest failure')).toBeTruthy();
  });
});
