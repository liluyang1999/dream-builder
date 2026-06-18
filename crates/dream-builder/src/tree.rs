use crate::errors::CommandError;
use serde::Serialize;
use std::f32::consts::TAU;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Vec3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

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
#[serde(rename_all = "lowercase")]
pub enum DetailKind {
    Rune,
    Crystal,
    Leaf,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetailInfo {
    pub id: String,
    pub kind: DetailKind,
    pub title: String,
    pub description: String,
    pub energy: f32,
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

#[tauri::command]
pub fn generate_tree(seed: u64) -> TreeScene {
    build_tree_scene(seed)
}

#[tauri::command]
pub fn detail_info(seed: u64, id: String) -> Result<DetailInfo, CommandError> {
    lookup_detail(&id, seed)
}

#[tauri::command]
pub fn magic_field(seed: u64, tick: u32) -> MagicField {
    compute_magic_field(seed, tick)
}

pub fn build_tree_scene(seed: u64) -> TreeScene {
    let mut rng = SeededRng::new(seed);
    let mut branches = Vec::new();
    let mut leaf_clusters = Vec::new();
    let mut runes = Vec::new();
    let mut crystals = Vec::new();
    let mut details = Vec::new();

    let mut last = Vec3 {
        x: 0.0,
        y: 0.0,
        z: 0.0,
    };
    for index in 0..10 {
        let t = index as f32 / 9.0;
        let next = Vec3 {
            x: (t * TAU * 0.42).sin() * 0.1,
            y: 0.42 + index as f32 * 0.38,
            z: (t * TAU * 0.33).cos() * 0.08,
        };
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

    for tier in 0..4 {
        let base_y = 1.35 + tier as f32 * 0.62;
        let tier_radius = 0.16 - tier as f32 * 0.02;
        for arm in 0..4 {
            let angle = (arm as f32 / 4.0) * TAU + tier as f32 * 0.52 + rng.range(-0.14, 0.14);
            let length = rng.range(0.86, 1.42) + tier as f32 * 0.1;
            let start = Vec3 {
                x: (base_y * 0.7).sin() * 0.08,
                y: base_y,
                z: (base_y * 0.4).cos() * 0.08,
            };
            let end = Vec3 {
                x: start.x + angle.cos() * length,
                y: base_y + rng.range(0.46, 0.84),
                z: start.z + angle.sin() * length,
            };
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
            let leaf_position = Vec3 {
                x: end.x + rng.range(-0.15, 0.15),
                y: end.y + rng.range(0.18, 0.45),
                z: end.z + rng.range(-0.15, 0.15),
            };
            leaf_clusters.push(LeafCluster {
                id: leaf_id.clone(),
                position: leaf_position,
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
                energy: clamp(rng.range(0.48, 0.74), 0.0, 1.0),
            });
        }
    }

    let glyphs = ["A", "E", "I", "O", "U", "R", "S", "T"];
    for index in 0..8 {
        let height = 0.72 + index as f32 * 0.34;
        let angle = index as f32 * 0.88;
        let id = format!("rune-{index}");
        runes.push(RuneMark {
            id: id.clone(),
            position: Vec3 {
                x: angle.cos() * 0.34,
                y: height,
                z: angle.sin() * 0.34,
            },
            normal: Vec3 {
                x: angle.cos(),
                y: 0.0,
                z: angle.sin(),
            },
            glyph: glyphs[index % glyphs.len()].to_string(),
            intensity: clamp(rng.range(0.62, 1.0), 0.0, 1.0),
        });
        details.push(DetailInfo {
            id,
            kind: DetailKind::Rune,
            title: format!("树心符文 {}", index + 1),
            description: "树皮里的金色纹路记录着古树的年轮和魔法流向。".to_string(),
            energy: clamp(rng.range(0.66, 0.98), 0.0, 1.0),
        });
    }

    for index in 0..6 {
        let angle = index as f32 / 6.0 * TAU + 0.32;
        let id = format!("crystal-{index}");
        crystals.push(CrystalCluster {
            id: id.clone(),
            position: Vec3 {
                x: angle.cos() * rng.range(0.72, 1.24),
                y: rng.range(1.8, 3.55),
                z: angle.sin() * rng.range(0.72, 1.24),
            },
            scale: rng.range(0.18, 0.36),
            hue: rng.range(0.68, 0.82),
        });
        details.push(DetailInfo {
            id,
            kind: DetailKind::Crystal,
            title: format!("暮光水晶 {}", index + 1),
            description: "紫色晶体会在选中后增强附近 Bloom，并向树冠释放脉冲光。".to_string(),
            energy: clamp(rng.range(0.58, 0.9), 0.0, 1.0),
        });
    }

    TreeScene {
        seed,
        branches,
        leaf_clusters,
        runes,
        crystals,
        details,
        palette: TreePalette {
            bark: "#5b3728".to_string(),
            leaves: "#37d6b0".to_string(),
            glow: "#f7c76b".to_string(),
            crystal: "#9d70ff".to_string(),
            background_top: "#070914".to_string(),
            background_bottom: "#13251f".to_string(),
        },
    }
}

pub fn lookup_detail(id: &str, seed: u64) -> Result<DetailInfo, CommandError> {
    let normalized = id.trim();
    if normalized.is_empty() {
        return Err(CommandError::invalid_detail(id));
    }

    build_tree_scene(seed)
        .details
        .into_iter()
        .find(|detail| detail.id == normalized)
        .ok_or_else(|| CommandError::invalid_detail(normalized))
}

pub fn compute_magic_field(seed: u64, tick: u32) -> MagicField {
    let mut rng = SeededRng::new(seed ^ 0xA17C_EE51);
    let phase = tick as f32 * 0.016;
    let mut pulses = Vec::new();

    for index in 0..4 {
        let angle = index as f32 / 4.0 * TAU + phase * (0.25 + index as f32 * 0.03);
        let orbit = 0.62 + index as f32 * 0.28;
        pulses.push(MagicPulse {
            id: format!("pulse-{index}"),
            center: Vec3 {
                x: angle.cos() * orbit,
                y: 0.88 + index as f32 * 0.58 + (phase + index as f32).sin() * 0.12,
                z: angle.sin() * orbit,
            },
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
        wind: Vec3 {
            x: clamp((phase * 0.33).sin() * 0.45, -1.0, 1.0),
            y: clamp((phase * 0.21).cos() * 0.08, -1.0, 1.0),
            z: clamp((phase * 0.27).cos() * 0.45, -1.0, 1.0),
        },
        pulses,
    }
}

struct SeededRng {
    state: u64,
}

impl SeededRng {
    fn new(seed: u64) -> Self {
        Self {
            state: seed ^ 0x9E37_79B9_7F4A_7C15,
        }
    }

    fn next_u32(&mut self) -> u32 {
        self.state ^= self.state >> 12;
        self.state ^= self.state << 25;
        self.state ^= self.state >> 27;
        ((self.state.wrapping_mul(0x2545_F491_4F6C_DD1D)) >> 32) as u32
    }

    fn next_f32(&mut self) -> f32 {
        self.next_u32() as f32 / u32::MAX as f32
    }

    fn range(&mut self, min: f32, max: f32) -> f32 {
        min + (max - min) * self.next_f32()
    }

    fn range_u32(&mut self, min: u32, max: u32) -> u32 {
        min + (self.next_u32() % (max - min + 1))
    }
}

fn clamp(value: f32, min: f32, max: f32) -> f32 {
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
    fn generation_is_deterministic_for_seed() {
        let first = build_tree_scene(424242);
        let second = build_tree_scene(424242);

        assert_eq!(first, second);
    }

    #[test]
    fn generated_counts_stay_bounded() {
        let scene = build_tree_scene(99);

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
        let scene = build_tree_scene(8);
        let id = scene.runes[0].id.clone();
        let detail = lookup_detail(&id, 8).expect("detail should exist");

        assert_eq!(detail.id, id);
        assert!((0.0..=1.0).contains(&detail.energy));
    }

    #[test]
    fn detail_lookup_rejects_invalid_ids() {
        let error = lookup_detail("missing-detail", 8).expect_err("invalid detail should fail");

        assert_eq!(error.code, "invalid_detail");
    }

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
