import type { MagicField } from '@dream-builder/ipc-contracts';

const PULSE_RANGE_MULTIPLIER = 1.6;
const PULSE_FORCE_SCALE = 0.012;
const WIND_SCALE = 0.012;
const EMPTY_PULSES: MagicField['pulses'] = [];

/** Advance the preallocated particle buffers without React state or frame allocations. */
export function advanceMagicParticlePositions(
  positions: Float32Array,
  phases: Float32Array,
  elapsed: number,
  delta: number,
  field: MagicField | null,
  selectedId: boolean,
): void {
  if (!Number.isFinite(delta) || delta <= 0) return;
  // Preserve the original 60 Hz look while bounding a suspended-tab resume.
  const frameScale = Math.min(delta, 0.1) * 60;
  const baseAttraction = selectedId ? 0.018 : 0.008;
  const windX = (field?.wind.x ?? 0) * WIND_SCALE;
  const windY = (field?.wind.y ?? 0) * WIND_SCALE;
  const windZ = (field?.wind.z ?? 0) * WIND_SCALE;
  const pulses = field?.pulses ?? EMPTY_PULSES;

  for (let index = 0; index < phases.length; index += 1) {
    const offset = index * 3;
    const phase = (phases[index] ?? 0) + elapsed * (0.35 + (index % 7) * 0.018);
    let dx = Math.sin(phase) * baseAttraction + windX;
    let dy = Math.cos(phase * 0.7) * 0.004 + windY;
    let dz = Math.cos(phase) * baseAttraction + windZ;

    const x = positions[offset] ?? 0;
    const y = positions[offset + 1] ?? 0;
    const z = positions[offset + 2] ?? 0;

    for (const pulse of pulses) {
      const pdx = pulse.center.x - x;
      const pdy = pulse.center.y - y;
      const pdz = pulse.center.z - z;
      const dist = Math.hypot(pdx, pdy, pdz);
      const reach = pulse.radius * PULSE_RANGE_MULTIPLIER;
      if (dist > 0 && dist < reach) {
        const falloff = 1 - dist / reach;
        const force = falloff * pulse.strength * PULSE_FORCE_SCALE;
        const inv = force / dist;
        dx += pdx * inv;
        dy += pdy * inv;
        dz += pdz * inv;
      }
    }

    let nx = x + dx * frameScale;
    const ny = y + dy * frameScale;
    let nz = z + dz * frameScale;
    if (nx * nx + nz * nz > 3.4 * 3.4) {
      const returnScale = 0.92 ** frameScale;
      nx *= returnScale;
      nz *= returnScale;
    }
    positions[offset] = nx;
    positions[offset + 1] = ny > 4.6 ? 0.28 : ny;
    positions[offset + 2] = nz;
  }
}
