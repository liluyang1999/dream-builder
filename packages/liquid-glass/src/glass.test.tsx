import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { GlassButton, GlassPanel, GlassProvider, detectGlassQuality } from './index';

describe('liquid-glass', () => {
  test('GlassProvider exposes theme + quality via data attributes', () => {
    const { container } = render(
      <GlassProvider theme="dark" quality="balanced">
        <GlassPanel>内容</GlassPanel>
      </GlassProvider>,
    );
    const root = container.querySelector('.lg-root');
    expect(root?.getAttribute('data-lg-theme')).toBe('dark');
    expect(root?.getAttribute('data-lg-quality')).toBe('balanced');
    expect(container.querySelector('.lg-panel')).not.toBeNull();
  });

  test('primary GlassButton is a solid accent button', () => {
    render(
      <GlassProvider>
        <GlassButton variant="primary">前进</GlassButton>
      </GlassProvider>,
    );
    const button = screen.getByRole('button', { name: '前进' });
    expect(button.className).toContain('lg-button--primary');
  });

  test('ghost GlassButton uses the glass surface', () => {
    render(
      <GlassProvider>
        <GlassButton variant="ghost">幽灵</GlassButton>
      </GlassProvider>,
    );
    const button = screen.getByRole('button', { name: '幽灵' });
    expect(button.className).toContain('lg-surface');
    expect(button.getAttribute('data-lg-specular')).toBe('on');
  });

  test('detectGlassQuality returns a valid tier', () => {
    expect(['high', 'balanced', 'low']).toContain(detectGlassQuality());
  });
});
