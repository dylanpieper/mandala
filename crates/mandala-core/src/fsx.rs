//! Small file helpers. Every write Mandala makes goes through `write_atomic`.

use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};

/// Write to a temporary file beside `path`, then rename over it, so a reader
/// (Obsidian, a sync tool) never sees half a file.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    let dir = path.parent().context("path has no parent")?;
    fs::create_dir_all(dir)?;
    let name = path.file_name().context("path has no file name")?.to_string_lossy();
    let tmp = dir.join(format!(".{name}.mandala-tmp"));
    fs::write(&tmp, bytes).with_context(|| format!("writing {}", tmp.display()))?;
    rename_over(&tmp, path).with_context(|| format!("renaming into {}", path.display()))?;
    Ok(())
}

/// On Windows a rename onto a file another program has open (a sync tool,
/// an indexer, Obsidian) fails for a moment, so it is tried again for about
/// a second. Elsewhere the rename always replaces at once.
fn rename_over(from: &Path, to: &Path) -> std::io::Result<()> {
    #[cfg(windows)]
    for _ in 0..20 {
        match fs::rename(from, to) {
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => std::thread::sleep(std::time::Duration::from_millis(50)),
            other => return other,
        }
    }
    fs::rename(from, to)
}

/// Move a file, creating the destination's folders.
pub fn move_file(from: &Path, to: &Path) -> Result<()> {
    if let Some(dir) = to.parent() {
        fs::create_dir_all(dir)?;
    }
    fs::rename(from, to).with_context(|| format!("moving {} to {}", from.display(), to.display()))
}

/// `dir/name.md`, or `dir/name (1).md`, `(2)`… if taken. Never `name 2.md`:
/// that is how iCloud names its conflict copies.
pub fn unique_path(dir: &Path, stem: &str, ext: &str) -> PathBuf {
    let first = dir.join(format!("{stem}.{ext}"));
    if !first.exists() {
        return first;
    }
    (1..).map(|n| dir.join(format!("{stem} ({n}).{ext}"))).find(|p| !p.exists()).expect("an unused name")
}

/// A note title made safe as a file name.
pub fn file_stem_for(title: &str) -> String {
    let cleaned: String =
        title.chars().map(|c| if matches!(c, '/' | '\\' | ':' | '\n' | '\r') { '-' } else { c }).collect();
    let trimmed = cleaned.trim().trim_start_matches('.').trim();
    if trimmed.is_empty() {
        "Untitled".to_string()
    } else {
        trimmed.to_string()
    }
}

/// Path relative to `root` with `/` separators.
pub fn rel_of(root: &Path, path: &Path) -> Option<String> {
    let rel = path.strip_prefix(root).ok()?;
    let parts: Vec<String> = rel.components().map(|c| c.as_os_str().to_string_lossy().into_owned()).collect();
    Some(parts.join("/"))
}

/// Copy a folder tree.
pub fn copy_tree(from: &Path, to: &Path) -> Result<()> {
    for entry in walkdir::WalkDir::new(from) {
        let entry = entry?;
        let rel = entry.path().strip_prefix(from)?;
        let dest = to.join(rel);
        if entry.file_type().is_dir() {
            fs::create_dir_all(&dest)?;
        } else if entry.file_type().is_file() {
            if let Some(dir) = dest.parent() {
                fs::create_dir_all(dir)?;
            }
            fs::copy(entry.path(), &dest)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unique_path_never_uses_icloud_naming() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("Note.md"), "").unwrap();
        let p = unique_path(dir.path(), "Note", "md");
        assert_eq!(p.file_name().unwrap(), "Note (1).md");
    }

    #[test]
    fn titles_become_safe_stems() {
        assert_eq!(file_stem_for("a/b: c"), "a-b- c");
        assert_eq!(file_stem_for("  "), "Untitled");
        assert_eq!(file_stem_for(".hidden"), "hidden");
    }
}
