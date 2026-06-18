//! Interactive detail metadata.
//!
//! Teaching points:
//! - A data-carrying-free `enum` with `#[serde(rename_all = "lowercase")]` maps
//!   cleanly onto the TS string union `'rune' | 'crystal' | 'leaf'`.
//! - `label()` uses an exhaustive `match`; adding a variant is a compile error
//!   until every match arm is handled.

use super::geometry::Energy;
use serde::Serialize;

/// The kind of interactive object a detail describes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DetailKind {
    Rune,
    Crystal,
    Leaf,
}

impl DetailKind {
    /// Human-facing (zh-CN) category label.
    pub fn label(self) -> &'static str {
        match self {
            DetailKind::Rune => "符文",
            DetailKind::Crystal => "水晶",
            DetailKind::Leaf => "叶簇",
        }
    }
}

/// Metadata shown in the HUD when an object is selected.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetailInfo {
    pub id: String,
    pub kind: DetailKind,
    pub title: String,
    pub description: String,
    pub energy: Energy,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detail_kind_serializes_lowercase() {
        let json = serde_json::to_value(DetailKind::Crystal).unwrap();
        assert_eq!(json, serde_json::json!("crystal"));
    }

    #[test]
    fn energy_serializes_as_plain_number() {
        let detail = DetailInfo {
            id: "rune-0".to_string(),
            kind: DetailKind::Rune,
            title: "t".to_string(),
            description: "d".to_string(),
            energy: Energy::new(0.5),
        };
        let json = serde_json::to_value(&detail).unwrap();
        assert_eq!(json["energy"], serde_json::json!(0.5));
        assert_eq!(json["kind"], serde_json::json!("rune"));
    }
}
