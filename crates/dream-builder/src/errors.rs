//! Backend error type.
//!
//! Teaching points:
//! - `thiserror` derives `std::error::Error` + `Display` from one enum.
//! - A hand-written `Serialize` keeps the on-the-wire shape `{ code, message }`
//!   that the frontend already expects, while the Rust side enjoys a rich enum.
//! - `code()` uses an exhaustive `match`, so adding a variant forces us to give
//!   it a stable string code (the compiler will not let us forget).

use serde::Serialize;
use serde::ser::SerializeStruct;
use thiserror::Error;

/// Every fallible command in the app returns `Result<_, AppError>`.
#[derive(Debug, Error)]
pub enum AppError {
    /// A detail id was requested that no interactive object owns.
    #[error("找不到交互对象“{0}”的详情")]
    InvalidDetail(String),

    /// Settings crossed the native boundary with an unsupported value.
    #[error("设置无效：{0}")]
    InvalidSettings(String),

    /// Reading or writing persisted settings failed.
    #[error("无法保存设置：{0}")]
    Persistence(String),

    /// Writing an exported scene to disk failed.
    #[error("无法导出场景：{0}")]
    Export(String),
}

impl AppError {
    /// Stable, machine-readable code surfaced to the frontend.
    pub fn code(&self) -> &'static str {
        match self {
            AppError::InvalidDetail(_) => "invalid_detail",
            AppError::InvalidSettings(_) => "invalid_settings",
            AppError::Persistence(_) => "persistence_error",
            AppError::Export(_) => "export_error",
        }
    }
}

/// Serialize as `{ "code": "...", "message": "..." }` to match the TS contract.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_detail_carries_stable_code() {
        let error = AppError::InvalidDetail("missing".to_string());
        assert_eq!(error.code(), "invalid_detail");
        assert!(error.to_string().contains("missing"));
    }

    #[test]
    fn serializes_to_code_and_message() {
        let json = serde_json::to_value(AppError::Export("disk full".to_string())).unwrap();
        assert_eq!(json["code"], "export_error");
        assert!(json["message"].as_str().unwrap().contains("disk full"));
    }

    #[test]
    fn invalid_settings_carries_stable_code() {
        let error = AppError::InvalidSettings("master volume".to_string());
        assert_eq!(error.code(), "invalid_settings");
    }
}
