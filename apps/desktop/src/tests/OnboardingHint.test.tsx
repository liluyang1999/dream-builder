import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { OnboardingHint, resetOnboardingHint } from '../ui/OnboardingHint';

describe('OnboardingHint', () => {
  beforeEach(() => localStorage.clear());

  test('can be reset between fresh-player observations', () => {
    localStorage.setItem('dream-builder.onboarded.v2', '1');
    resetOnboardingHint();
    render(<OnboardingHint />);

    expect(screen.getByRole('dialog', { name: '欢迎' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '开始探索' }));
    expect(screen.queryByRole('dialog', { name: '欢迎' })).toBeNull();
    expect(localStorage.getItem('dream-builder.onboarded.v2')).toBe('1');
  });
});
