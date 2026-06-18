//! Scene data structures + a builder.
//!
//! Teaching points:
//! - Plain serializable structs form the wire contract (camelCase via serde).
//! - `TreeSceneBuilder` shows the builder pattern: a chained, ownership-moving
//!   API that assembles a `TreeScene` and applies a default palette if none was
//!   supplied. `Default` is derived where it makes sense.

use super::detail::DetailInfo;
use super::geometry::Vec3;
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchSegment {
    pub id: String,
    pub start: Vec3,
    pub end: Vec3,
    pub radius_start: f32,
    pub radius_end: f32,
    pub twist: f32,
    pub level: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LeafCluster {
    pub id: String,
    pub position: Vec3,
    pub radius: f32,
    pub density: u32,
    pub hue: f32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuneMark {
    pub id: String,
    pub position: Vec3,
    pub normal: Vec3,
    pub glyph: String,
    pub intensity: f32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CrystalCluster {
    pub id: String,
    pub position: Vec3,
    pub scale: f32,
    pub hue: f32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreePalette {
    pub bark: String,
    pub leaves: String,
    pub glow: String,
    pub crystal: String,
    pub background_top: String,
    pub background_bottom: String,
}

impl Default for TreePalette {
    fn default() -> Self {
        Self {
            bark: "#5b3728".to_string(),
            leaves: "#37d6b0".to_string(),
            glow: "#f7c76b".to_string(),
            crystal: "#9d70ff".to_string(),
            background_top: "#070914".to_string(),
            background_bottom: "#13251f".to_string(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeScene {
    pub seed: u64,
    pub branches: Vec<BranchSegment>,
    pub leaf_clusters: Vec<LeafCluster>,
    pub runes: Vec<RuneMark>,
    pub crystals: Vec<CrystalCluster>,
    pub details: Vec<DetailInfo>,
    pub palette: TreePalette,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MagicPulse {
    pub id: String,
    pub center: Vec3,
    pub radius: f32,
    pub strength: f32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MagicField {
    pub tick: u32,
    pub wind: Vec3,
    pub pulses: Vec<MagicPulse>,
}

/// Assembles a [`TreeScene`] via a chained, ownership-moving builder.
#[derive(Debug, Default)]
pub struct TreeSceneBuilder {
    seed: u64,
    branches: Vec<BranchSegment>,
    leaf_clusters: Vec<LeafCluster>,
    runes: Vec<RuneMark>,
    crystals: Vec<CrystalCluster>,
    details: Vec<DetailInfo>,
    palette: Option<TreePalette>,
}

impl TreeSceneBuilder {
    pub fn new(seed: u64) -> Self {
        Self {
            seed,
            ..Self::default()
        }
    }

    pub fn branches(mut self, branches: Vec<BranchSegment>) -> Self {
        self.branches = branches;
        self
    }

    pub fn leaf_clusters(mut self, leaf_clusters: Vec<LeafCluster>) -> Self {
        self.leaf_clusters = leaf_clusters;
        self
    }

    pub fn runes(mut self, runes: Vec<RuneMark>) -> Self {
        self.runes = runes;
        self
    }

    pub fn crystals(mut self, crystals: Vec<CrystalCluster>) -> Self {
        self.crystals = crystals;
        self
    }

    pub fn details(mut self, details: Vec<DetailInfo>) -> Self {
        self.details = details;
        self
    }

    pub fn palette(mut self, palette: TreePalette) -> Self {
        self.palette = Some(palette);
        self
    }

    /// Finalize. A default palette is applied when none was provided.
    pub fn build(self) -> TreeScene {
        TreeScene {
            seed: self.seed,
            branches: self.branches,
            leaf_clusters: self.leaf_clusters,
            runes: self.runes,
            crystals: self.crystals,
            details: self.details,
            palette: self.palette.unwrap_or_default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builder_applies_default_palette() {
        let scene = TreeSceneBuilder::new(7).build();
        assert_eq!(scene.seed, 7);
        assert_eq!(scene.palette, TreePalette::default());
        assert!(scene.branches.is_empty());
    }
}
