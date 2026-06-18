//! Core geometric value types.
//!
//! Teaching points:
//! - A small `Copy` struct (`Vec3`) with `impl` blocks and operator overloading
//!   (`Add`, `Mul`) — Rust's answer to value-type "objects".
//! - Newtypes (`Seed`, `Energy`) give domain meaning and type-safety to bare
//!   numbers, with `From`/`Into` conversions and clamping invariants.

use serde::Serialize;
use std::ops::{Add, Mul};

/// A 3D point/vector. Serialized as `{ x, y, z }` (camelCase already lowercase).
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Vec3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

impl Vec3 {
    pub const ZERO: Vec3 = Vec3 {
        x: 0.0,
        y: 0.0,
        z: 0.0,
    };

    pub const fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
    }
}

impl Add for Vec3 {
    type Output = Vec3;

    fn add(self, other: Vec3) -> Vec3 {
        Vec3::new(self.x + other.x, self.y + other.y, self.z + other.z)
    }
}

impl Mul<f32> for Vec3 {
    type Output = Vec3;

    fn mul(self, scalar: f32) -> Vec3 {
        Vec3::new(self.x * scalar, self.y * scalar, self.z * scalar)
    }
}

/// A generation seed. Newtype prevents mixing it with arbitrary `u64` values.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Seed(pub u64);

impl From<u64> for Seed {
    fn from(value: u64) -> Self {
        Seed(value)
    }
}

impl From<Seed> for u64 {
    fn from(seed: Seed) -> Self {
        seed.0
    }
}

/// Energy, constrained to `[0.0, 1.0]`. The constructor enforces the invariant,
/// so any `Energy` value is guaranteed in range. Serializes transparently as a
/// number (serde treats a single-field tuple struct as its inner value).
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Energy(f32);

impl Energy {
    pub fn new(value: f32) -> Self {
        Energy(clamp(value, 0.0, 1.0))
    }

    pub fn get(self) -> f32 {
        self.0
    }
}

/// Clamp that treats non-finite input as the lower bound (NaN-safe).
pub fn clamp(value: f32, min: f32, max: f32) -> f32 {
    if value.is_finite() {
        value.max(min).min(max)
    } else {
        min
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vec3_add_and_scale() {
        let sum = Vec3::new(1.0, 2.0, 3.0) + Vec3::new(0.5, 0.5, 0.5);
        assert_eq!(sum, Vec3::new(1.5, 2.5, 3.5));
        assert_eq!(Vec3::new(1.0, -2.0, 3.0) * 2.0, Vec3::new(2.0, -4.0, 6.0));
    }

    #[test]
    fn seed_roundtrips_through_u64() {
        let seed = Seed::from(424242_u64);
        assert_eq!(u64::from(seed), 424242);
    }

    #[test]
    fn energy_is_clamped_and_nan_safe() {
        assert_eq!(Energy::new(2.0).get(), 1.0);
        assert_eq!(Energy::new(-1.0).get(), 0.0);
        assert_eq!(Energy::new(f32::NAN).get(), 0.0);
    }
}
