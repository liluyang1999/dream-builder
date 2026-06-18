//! Time-varying "magic field": orbiting pulses + a gentle global wind.
//!
//! Teaching points:
//! - A pure function of `(seed, tick)` — no shared state, trivially testable.
//! - Every output is `clamp`ed into a finite range, so the frontend never has to
//!   defend against `NaN`/`inf` drifting into the particle simulation.

use crate::domain::geometry::{Vec3, clamp};
use crate::domain::scene::{MagicField, MagicPulse};
use crate::generation::rng::{Rng, SeededRng};
use std::f32::consts::TAU;

/// Compute the field for a given seed at animation `tick`.
pub fn compute_magic_field(seed: u64, tick: u32) -> MagicField {
    let mut rng = SeededRng::new(seed ^ 0xA17C_EE51);
    let phase = tick as f32 * 0.016;
    let mut pulses = Vec::with_capacity(4);

    for index in 0..4 {
        let angle = index as f32 / 4.0 * TAU + phase * (0.25 + index as f32 * 0.03);
        let orbit = 0.62 + index as f32 * 0.28;
        pulses.push(MagicPulse {
            id: format!("pulse-{index}"),
            center: Vec3::new(
                angle.cos() * orbit,
                0.88 + index as f32 * 0.58 + (phase + index as f32).sin() * 0.12,
                angle.sin() * orbit,
            ),
            radius: clamp(
                0.42 + rng.range(0.0, 0.36) + phase.sin().abs() * 0.18,
                0.05,
                3.0,
            ),
            strength: clamp(0.42 + (phase * 0.7 + index as f32).cos() * 0.25, 0.0, 1.0),
        });
    }

    MagicField {
        tick,
        wind: Vec3::new(
            clamp((phase * 0.33).sin() * 0.45, -1.0, 1.0),
            clamp((phase * 0.21).cos() * 0.08, -1.0, 1.0),
            clamp((phase * 0.27).cos() * 0.45, -1.0, 1.0),
        ),
        pulses,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn magic_field_values_are_finite_and_clamped() {
        let field = compute_magic_field(7, u32::MAX);
        assert!(field.wind.x.is_finite());
        assert!(field.wind.y.is_finite());
        assert!(field.wind.z.is_finite());
        assert!((-1.0..=1.0).contains(&field.wind.x));
        assert!((2..=6).contains(&field.pulses.len()));
        for pulse in field.pulses {
            assert!(pulse.center.x.is_finite());
            assert!((0.05..=3.0).contains(&pulse.radius));
            assert!((0.0..=1.0).contains(&pulse.strength));
        }
    }
}
