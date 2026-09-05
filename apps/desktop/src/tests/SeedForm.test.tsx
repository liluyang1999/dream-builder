import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { SeedForm } from '../ui/SeedForm';

describe('SeedForm', () => {
  test.each(['1e3', '0', '4294967295'])('uses the complete numeric value %s', (value) => {
    const onRegenerate = vi.fn();
    render(<SeedForm seed={424242} onRegenerate={onRegenerate} />);
    const field = screen.getByRole('spinbutton', { name: '种子' });
    fireEvent.change(field, { target: { value } });
    fireEvent.submit(field.closest('form') as HTMLFormElement);
    expect(onRegenerate).toHaveBeenCalledExactlyOnceWith(Number(value));
  });

  test.each(['', '-1', '1.5', '4294967296', '1e30'])(
    'rejects invalid or out-of-range seed %s with recoverable feedback',
    (value) => {
      const onRegenerate = vi.fn();
      render(<SeedForm seed={424242} onRegenerate={onRegenerate} />);
      const field = screen.getByRole('spinbutton', { name: '种子' });
      fireEvent.change(field, { target: { value } });
      fireEvent.submit(field.closest('form') as HTMLFormElement);
      expect(onRegenerate).not.toHaveBeenCalled();
      expect(screen.getByRole('alert').textContent).toContain('0 至 4294967295');
      expect(field.getAttribute('aria-invalid')).toBe('true');

      fireEvent.change(field, { target: { value: '42' } });
      expect(screen.queryByRole('alert')).toBeNull();
      fireEvent.submit(field.closest('form') as HTMLFormElement);
      expect(onRegenerate).toHaveBeenCalledExactlyOnceWith(42);
    },
  );

  test('refreshes the draft when the active world seed changes', () => {
    const { rerender } = render(<SeedForm seed={424242} onRegenerate={vi.fn()} />);
    const field = screen.getByRole('spinbutton', { name: '种子' }) as HTMLInputElement;
    fireEvent.change(field, { target: { value: '123' } });
    rerender(<SeedForm seed={77} onRegenerate={vi.fn()} />);
    expect(field.value).toBe('77');
  });
});
