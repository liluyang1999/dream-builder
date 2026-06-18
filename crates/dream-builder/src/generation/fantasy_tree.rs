//! The default fantasy-tree generator.
//!
//! Teaching points:
//! - A unit struct implementing a trait (`SceneGenerator`) — zero-size, cheap to
//!   pass around, easy to swap for a test double.
//! - Generation goes through the `Rng` trait and the `TreeSceneBuilder`, keeping
//!   the algorithm declarative and the output deterministic per seed.

use super::SceneGenerator;
use super::rng::{Rng, SeededRng};
use crate::domain::detail::{DetailInfo, DetailKind};
use crate::domain::geometry::{Energy, Seed, Vec3, clamp};
use crate::domain::scene::{
    BranchSegment, CrystalCluster, LeafCluster, RuneMark, TreeScene, TreeSceneBuilder,
};
use std::f32::consts::TAU;

const RUNE_GLYPHS: [&str; 8] = ["A", "E", "I", "O", "U", "R", "S", "T"];

/// Builds the canonical moonlit fantasy tree.
#[derive(Debug, Default, Clone, Copy)]
pub struct FantasyTreeGenerator;

impl SceneGenerator for FantasyTreeGenerator {
    fn generate(&self, seed: Seed) -> TreeScene {
        let raw_seed: u64 = seed.into();
        let mut rng = SeededRng::new(raw_seed);

        let branches_trunk = build_trunk(&mut rng);
        let (branches_arms, leaf_clusters, leaf_details) = build_canopy(&mut rng);
        let (runes, rune_details) = build_runes(&mut rng);
        let (crystals, crystal_details) = build_crystals(&mut rng);

        let mut branches = branches_trunk;
        branches.extend(branches_arms);

        let mut details = leaf_details;
        details.extend(rune_details);
        details.extend(crystal_details);

        TreeSceneBuilder::new(raw_seed)
            .branches(branches)
            .leaf_clusters(leaf_clusters)
            .runes(runes)
            .crystals(crystals)
            .details(details)
            .build()
    }
}

fn build_trunk(rng: &mut impl Rng) -> Vec<BranchSegment> {
    let mut branches = Vec::with_capacity(10);
    let mut last = Vec3::ZERO;
    for index in 0..10 {
        let t = index as f32 / 9.0;
        let next = Vec3::new(
            (t * TAU * 0.42).sin() * 0.1,
            0.42 + index as f32 * 0.38,
            (t * TAU * 0.33).cos() * 0.08,
        );
        branches.push(BranchSegment {
            id: format!("branch-trunk-{index}"),
            start: last,
            end: next,
            radius_start: clamp(0.48 - t * 0.28, 0.08, 0.5),
            radius_end: clamp(0.42 - t * 0.3, 0.06, 0.45),
            twist: rng.range(-0.35, 0.35),
            level: 0,
        });
        last = next;
    }
    branches
}

fn build_canopy(rng: &mut impl Rng) -> (Vec<BranchSegment>, Vec<LeafCluster>, Vec<DetailInfo>) {
    let mut branches = Vec::with_capacity(16);
    let mut leaf_clusters = Vec::with_capacity(16);
    let mut details = Vec::with_capacity(16);

    for tier in 0..4 {
        let base_y = 1.35 + tier as f32 * 0.62;
        let tier_radius = 0.16 - tier as f32 * 0.02;
        for arm in 0..4 {
            let angle = (arm as f32 / 4.0) * TAU + tier as f32 * 0.52 + rng.range(-0.14, 0.14);
            let length = rng.range(0.86, 1.42) + tier as f32 * 0.1;
            let start = Vec3::new(
                (base_y * 0.7).sin() * 0.08,
                base_y,
                (base_y * 0.4).cos() * 0.08,
            );
            let end = Vec3::new(
                start.x + angle.cos() * length,
                base_y + rng.range(0.46, 0.84),
                start.z + angle.sin() * length,
            );
            branches.push(BranchSegment {
                id: format!("branch-{tier}-{arm}"),
                start,
                end,
                radius_start: clamp(tier_radius, 0.06, 0.18),
                radius_end: clamp(tier_radius * rng.range(0.32, 0.48), 0.025, 0.08),
                twist: rng.range(-0.8, 0.8),
                level: tier + 1,
            });

            let leaf_id = format!("leaf-{tier}-{arm}");
            leaf_clusters.push(LeafCluster {
                id: leaf_id.clone(),
                position: Vec3::new(
                    end.x + rng.range(-0.15, 0.15),
                    end.y + rng.range(0.18, 0.45),
                    end.z + rng.range(-0.15, 0.15),
                ),
                radius: rng.range(0.5, 0.82),
                density: rng.range_u32(18, 38),
                hue: rng.range(0.46, 0.56),
            });
            details.push(DetailInfo {
                id: leaf_id,
                kind: DetailKind::Leaf,
                title: format!("星雾叶簇 {}", tier * 4 + arm + 1),
                description: "叶片在鼠标掠过时会产生青绿色微光，并带动周围粒子轻微旋转。"
                    .to_string(),
                energy: Energy::new(rng.range(0.48, 0.74)),
            });
        }
    }
    (branches, leaf_clusters, details)
}

fn build_runes(rng: &mut impl Rng) -> (Vec<RuneMark>, Vec<DetailInfo>) {
    let mut runes = Vec::with_capacity(8);
    let mut details = Vec::with_capacity(8);
    for index in 0..8 {
        let height = 0.72 + index as f32 * 0.34;
        let angle = index as f32 * 0.88;
        let id = format!("rune-{index}");
        runes.push(RuneMark {
            id: id.clone(),
            position: Vec3::new(angle.cos() * 0.34, height, angle.sin() * 0.34),
            normal: Vec3::new(angle.cos(), 0.0, angle.sin()),
            glyph: RUNE_GLYPHS[index % RUNE_GLYPHS.len()].to_string(),
            intensity: clamp(rng.range(0.62, 1.0), 0.0, 1.0),
        });
        details.push(DetailInfo {
            id,
            kind: DetailKind::Rune,
            title: format!("树心符文 {}", index + 1),
            description: "树皮里的金色纹路记录着古树的年轮和魔法流向。".to_string(),
            energy: Energy::new(rng.range(0.66, 0.98)),
        });
    }
    (runes, details)
}

fn build_crystals(rng: &mut impl Rng) -> (Vec<CrystalCluster>, Vec<DetailInfo>) {
    let mut crystals = Vec::with_capacity(6);
    let mut details = Vec::with_capacity(6);
    for index in 0..6 {
        let angle = index as f32 / 6.0 * TAU + 0.32;
        let id = format!("crystal-{index}");
        crystals.push(CrystalCluster {
            id: id.clone(),
            position: Vec3::new(
                angle.cos() * rng.range(0.72, 1.24),
                rng.range(1.8, 3.55),
                angle.sin() * rng.range(0.72, 1.24),
            ),
            scale: rng.range(0.18, 0.36),
            hue: rng.range(0.68, 0.82),
        });
        details.push(DetailInfo {
            id,
            kind: DetailKind::Crystal,
            title: format!("暮光水晶 {}", index + 1),
            description: "紫色晶体会在选中后增强附近 Bloom，并向树冠释放脉冲光。".to_string(),
            energy: Energy::new(rng.range(0.58, 0.9)),
        });
    }
    (crystals, details)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generation_is_deterministic_for_seed() {
        let generator = FantasyTreeGenerator;
        let first = generator.generate(Seed::from(424242));
        let second = generator.generate(Seed::from(424242));
        assert_eq!(first, second);
    }

    #[test]
    fn generated_counts_stay_bounded() {
        let scene = FantasyTreeGenerator.generate(Seed::from(99));
        assert!((18..=64).contains(&scene.branches.len()));
        assert!((8..=32).contains(&scene.leaf_clusters.len()));
        assert!((5..=16).contains(&scene.runes.len()));
        assert!((4..=12).contains(&scene.crystals.len()));
        assert_eq!(
            scene.details.len(),
            scene.leaf_clusters.len() + scene.runes.len() + scene.crystals.len()
        );
    }

    #[test]
    fn detail_lookup_returns_valid_metadata() {
        let generator = FantasyTreeGenerator;
        let scene = generator.generate(Seed::from(8));
        let id = scene.runes[0].id.clone();
        let detail = generator
            .generate_detail(Seed::from(8), &id)
            .expect("detail should exist");
        assert_eq!(detail.id, id);
        assert!((0.0..=1.0).contains(&detail.energy.get()));
    }

    #[test]
    fn detail_lookup_rejects_invalid_ids() {
        let error = FantasyTreeGenerator
            .generate_detail(Seed::from(8), "missing-detail")
            .expect_err("invalid detail should fail");
        assert_eq!(error.code(), "invalid_detail");
    }
}
