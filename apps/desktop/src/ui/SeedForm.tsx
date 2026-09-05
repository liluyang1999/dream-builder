import { GlassButton } from '@dream-builder/liquid-glass';
import { type FormEvent, useEffect, useState } from 'react';

interface Props {
  seed: number;
  onRegenerate(seed: number): void;
}

export function SeedForm({ seed, onRegenerate }: Props) {
  const [value, setValue] = useState(String(seed));
  const [invalid, setInvalid] = useState(false);

  // Keep the field in sync when the seed changes elsewhere (menu, history).
  useEffect(() => {
    setValue(String(seed));
    setInvalid(false);
  }, [seed]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsed = Number(value);
    if (value.trim() === '' || !Number.isInteger(parsed) || parsed < 0 || parsed > 4294967295) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onRegenerate(parsed);
  }

  return (
    <form className="hud__seed" onSubmit={handleSubmit} noValidate>
      <label className="hud__seed-label" htmlFor="hud-seed">
        种子
      </label>
      <input
        id="hud-seed"
        className="hud__seed-input"
        type="number"
        min={0}
        max={4294967295}
        step={1}
        inputMode="numeric"
        required
        aria-invalid={invalid}
        aria-describedby={invalid ? 'hud-seed-error' : undefined}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setInvalid(false);
        }}
      />
      <GlassButton type="submit">重新生成</GlassButton>
      {invalid ? (
        <p id="hud-seed-error" className="hud__seed-error" role="alert">
          请输入 0 至 4294967295 之间的整数。
        </p>
      ) : null}
    </form>
  );
}
