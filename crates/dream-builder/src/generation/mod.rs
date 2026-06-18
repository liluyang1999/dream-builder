//! Scene generation: the `SceneGenerator` abstraction and its implementations.
//!
//! Teaching points:
//! - A `trait` as a seam: callers depend on `SceneGenerator`, not a concrete
//!   type, so the generation algorithm can be swapped or mocked.
//! - A **default method** (`generate_detail`) reuses `generate` + iterator
//!   combinators (`into_iter().find(...)`) and propagates a typed error.

pub mod fantasy_tree;
pub mod rng;

use crate::domain::detail::DetailInfo;
use crate::domain::geometry::Seed;
use crate::domain::scene::TreeScene;
use crate::errors::AppError;

pub use fantasy_tree::FantasyTreeGenerator;

/// Anything that can deterministically build a [`TreeScene`] from a [`Seed`].
pub trait SceneGenerator {
    /// Build the full scene for `seed`. Must be deterministic.
    fn generate(&self, seed: Seed) -> TreeScene;

    /// Look up one detail by id, re-deriving the scene for `seed`.
    /// Defaulted in terms of `generate`; implementors rarely override it.
    fn generate_detail(&self, seed: Seed, id: &str) -> Result<DetailInfo, AppError> {
        let normalized = id.trim();
        if normalized.is_empty() {
            return Err(AppError::InvalidDetail(id.to_string()));
        }
        self.generate(seed)
            .details
            .into_iter()
            .find(|detail| detail.id == normalized)
            .ok_or_else(|| AppError::InvalidDetail(normalized.to_string()))
    }
}
