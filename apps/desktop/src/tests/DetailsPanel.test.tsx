import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { DetailsPanel } from '../ui/DetailsPanel';

describe('DetailsPanel', () => {
  test('stays out of the player HUD until a detail is selected', () => {
    const { container } = render(<DetailsPanel detail={null} />);
    expect(container.childElementCount).toBe(0);
  });

  test('renders the selected detail title and energy percentage', () => {
    render(
      <DetailsPanel
        detail={{
          id: 'rune-0',
          kind: 'rune',
          title: '树心符文 1',
          description: '树皮里的金色纹路',
          energy: 0.5,
        }}
      />,
    );
    expect(screen.getByText('树心符文 1')).toBeTruthy();
    expect(screen.getByText('能量 50%')).toBeTruthy();
  });
});
