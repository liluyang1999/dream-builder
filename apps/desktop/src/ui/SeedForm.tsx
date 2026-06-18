import { type FormEvent, useEffect, useState } from 'react';

interface Props {
  seed: number;
  onRegenerate(seed: number): void;
}

export function SeedForm({ seed, onRegenerate }: Props) {
  const [value, setValue] = useState(String(seed));

  // Keep the field in sync when the seed changes elsewhere (menu, history).
  useEffect(() => {
    setValue(String(seed));
  }, [seed]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onRegenerate(parsed);
    }
  }

  return (
    <form className="hud__seed" onSubmit={handleSubmit}>
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
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <button className="hud__button hud__button--ghost" type="submit">
        重新生成
      </button>
    </form>
  );
}
