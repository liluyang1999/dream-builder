//! Replace one file only after a complete sibling file has been written.

use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

static NEXT_FILE: AtomicU64 = AtomicU64::new(0);

struct PendingFile(PathBuf);

impl Drop for PendingFile {
    fn drop(&mut self) {
        if let Err(error) = fs::remove_file(&self.0)
            && error.kind() != io::ErrorKind::NotFound
        {
            log::warn!("无法清理未提交的临时文件：{error}");
        }
    }
}

pub(crate) fn write(path: &Path, bytes: &[u8]) -> io::Result<()> {
    write_with(path, |file| file.write_all(bytes))
}

fn write_with(path: &Path, write: impl FnOnce(&mut File) -> io::Result<()>) -> io::Result<()> {
    // A sibling keeps rename on one filesystem. create_new prevents overwriting
    // another writer's temporary file; no old destination is removed first.
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty());
    let parent = parent.unwrap_or_else(|| Path::new("."));
    let (pending, mut file) = create_pending_file(parent)?;
    write(&mut file)?;
    file.sync_all()?;
    // Windows cannot rename a file while this write handle is still open.
    drop(file);
    fs::rename(&pending.0, path)
}

fn create_pending_file(parent: &Path) -> io::Result<(PendingFile, File)> {
    for _ in 0..16 {
        let path = parent.join(format!(
            ".dream-builder-write-{}-{}.tmp",
            std::process::id(),
            NEXT_FILE.fetch_add(1, Ordering::Relaxed)
        ));
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => return Ok((PendingFile(path), file)),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        }
    }
    Err(io::Error::new(
        io::ErrorKind::AlreadyExists,
        "无法分配独立的临时文件",
    ))
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_DIRECTORY: AtomicU64 = AtomicU64::new(0);

    pub(crate) struct TestDirectory(PathBuf);

    impl TestDirectory {
        pub(crate) fn new() -> Self {
            let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/test-data");
            fs::create_dir_all(&root).unwrap();
            loop {
                let path = root.join(format!(
                    "atomic-file-{}-{}",
                    std::process::id(),
                    NEXT_DIRECTORY.fetch_add(1, Ordering::Relaxed)
                ));
                match fs::create_dir(&path) {
                    Ok(()) => return Self(path),
                    Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
                    Err(error) => panic!("cannot create test directory: {error}"),
                }
            }
        }

        pub(crate) fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[test]
    fn partial_write_failure_preserves_existing_file_and_removes_temporary_file() {
        let directory = TestDirectory::new();
        let path = directory.path().join("settings.json");
        fs::write(&path, b"last committed snapshot").unwrap();

        let result = write_with(&path, |file| {
            file.write_all(b"incomplete")?;
            Err(io::Error::other("injected interrupted write"))
        });

        assert!(result.is_err());
        assert_eq!(fs::read(&path).unwrap(), b"last committed snapshot");
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn successful_write_creates_and_replaces_files_without_residue() {
        let directory = TestDirectory::new();
        let path = directory.path().join("scene.json");

        write(&path, b"first").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"first");
        write(&path, b"replacement").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"replacement");
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn failed_first_write_leaves_no_partial_file() {
        let directory = TestDirectory::new();
        let path = directory.path().join("scene.json");
        let result = write_with(&path, |file| {
            file.write_all(b"partial")?;
            Err(io::Error::other("injected interrupted write"))
        });

        assert!(result.is_err());
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 0);
    }

    #[cfg(windows)]
    #[test]
    fn occupied_windows_destination_preserves_old_file_and_cleans_pending_file() {
        use std::os::windows::fs::OpenOptionsExt;

        let directory = TestDirectory::new();
        let path = directory.path().join("scene.json");
        fs::write(&path, b"last committed scene").unwrap();
        // Allow ordinary reads/writes but deny deletion/rename while open.
        let occupied = OpenOptions::new()
            .read(true)
            .share_mode(0x0000_0001 | 0x0000_0002)
            .open(&path)
            .unwrap();

        assert!(write(&path, b"replacement").is_err());
        assert_eq!(fs::read(&path).unwrap(), b"last committed scene");
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
        drop(occupied);
        write(&path, b"replacement").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"replacement");
    }
}
