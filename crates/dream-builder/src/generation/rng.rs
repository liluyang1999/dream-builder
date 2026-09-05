//! Deterministic pseudo-random numbers.
//!
//! Teaching points:
//! - A `trait` with **default methods**: implementors only supply `next_u32`;
//!   `next_f32`/`range`/`range_u32` come for free, layered on top.
//! - `SeededRng` is a tiny xorshift generator; identical seeds always produce
//!   identical streams, which is what makes scene generation reproducible.

/// A source of pseudo-random numbers. Implement `next_u32`; get the rest free.
pub trait Rng {
    /// The single required method: the next 32-bit value in the stream.
    fn next_u32(&mut self) -> u32;

    /// A float in `[0.0, 1.0]`.
    fn next_f32(&mut self) -> f32 {
        self.next_u32() as f32 / u32::MAX as f32
    }

    /// A float in `[min, max)` (approximately; endpoints depend on rounding).
    fn range(&mut self, min: f32, max: f32) -> f32 {
        min + (max - min) * self.next_f32()
    }

    /// An integer in `[min, max]` inclusive. `max` must be `>= min`.
    fn range_u32(&mut self, min: u32, max: u32) -> u32 {
        let width = u64::from(max) - u64::from(min) + 1;
        min + (u64::from(self.next_u32()) % width) as u32
    }
}

/// xorshift64* generator seeded from a `u64`.
pub struct SeededRng {
    state: u64,
}

impl SeededRng {
    pub fn new(seed: u64) -> Self {
        Self {
            state: seed ^ 0x9E37_79B9_7F4A_7C15,
        }
    }
}

impl Rng for SeededRng {
    fn next_u32(&mut self) -> u32 {
        self.state ^= self.state >> 12;
        self.state ^= self.state << 25;
        self.state ^= self.state >> 27;
        (self.state.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 32) as u32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_same_stream() {
        let mut a = SeededRng::new(42);
        let mut b = SeededRng::new(42);
        for _ in 0..16 {
            assert_eq!(a.next_u32(), b.next_u32());
        }
    }

    #[test]
    fn range_u32_stays_in_bounds() {
        let mut rng = SeededRng::new(1);
        for _ in 0..1000 {
            let value = rng.range_u32(3, 7);
            assert!((3..=7).contains(&value));
        }
    }

    #[test]
    fn range_u32_supports_the_full_inclusive_domain() {
        struct FixedRng(u32);
        impl Rng for FixedRng {
            fn next_u32(&mut self) -> u32 {
                self.0
            }
        }

        for value in [0, 1, u32::MAX / 2, u32::MAX] {
            assert_eq!(FixedRng(value).range_u32(0, u32::MAX), value);
            assert_eq!(FixedRng(value).range_u32(u32::MAX, u32::MAX), u32::MAX);
        }
    }

    #[test]
    fn next_f32_in_unit_interval() {
        let mut rng = SeededRng::new(99);
        for _ in 0..1000 {
            let value = rng.next_f32();
            assert!((0.0..=1.0).contains(&value));
        }
    }
}
