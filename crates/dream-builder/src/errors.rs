use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CommandError {
    pub code: &'static str,
    pub message: String,
}

impl CommandError {
    pub fn invalid_detail(id: &str) -> Self {
        Self {
            code: "invalid_detail",
            message: format!("No interactive tree detail exists for id '{id}'"),
        }
    }
}
