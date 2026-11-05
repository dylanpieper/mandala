//! Pictures in notes: pasted images and drawings, kept as files beside the
//! notes and embedded as `![[name.png]]`, as Obsidian does.
//!
//! - New pictures go to Obsidian's attachment folder (`attachmentFolderPath`
//!   in `.obsidian/app.json`) if it names one, else to the first existing of
//!   `LEFT_IN_PLACE`, else to `attachments/`. Arranging never moves it.
//! - An embed names a file, not a path: it is found by name anywhere in the
//!   vault outside dot folders, the attachment folder first.
//! - Only picture files are read or written here.

use crate::arrange::LEFT_IN_PLACE;
use crate::fsx::{file_stem_for, rel_of, unique_path, write_atomic};
use crate::vault::Vault;
use anyhow::{bail, Context, Result};
use std::fs;
use std::path::Path;

pub const PICTURES: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "svg"];

fn is_picture(name: &str) -> bool {
    Path::new(name).extension().and_then(|e| e.to_str()).is_some_and(|e| PICTURES.contains(&e.to_lowercase().as_str()))
}

impl Vault {
    /// The folder new pictures go into, relative to the vault.
    pub fn attachment_dir(&self) -> String {
        let configured = fs::read(self.root().join(".obsidian/app.json"))
            .ok()
            .and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok())
            .and_then(|v| v["attachmentFolderPath"].as_str().map(str::to_string))
            .map(|p| p.trim_matches('/').to_string())
            .filter(|p| !p.is_empty() && !p.starts_with('.') && self.path(p).is_ok());
        if let Some(p) = configured {
            return p;
        }
        LEFT_IN_PLACE
            .iter()
            .find(|d| self.root().join(d).is_dir())
            .map_or_else(|| "attachments".to_string(), |d| d.to_string())
    }

    /// Where a picture embedded as `name` is, relative to the vault.
    pub fn find_picture(&self, name: &str) -> Result<Option<String>> {
        let name = name.trim();
        if !is_picture(name) {
            return Ok(None);
        }
        // A path written out (`attachments/a.png`) is used as it is.
        if name.contains('/') {
            return Ok(self.path(name)?.is_file().then(|| name.to_string()));
        }
        let first = format!("{}/{name}", self.attachment_dir());
        if self.path(&first)?.is_file() {
            return Ok(Some(first));
        }
        let walker = walkdir::WalkDir::new(self.root())
            .into_iter()
            .filter_entry(|e| e.depth() == 0 || !e.file_name().to_string_lossy().starts_with('.'));
        for entry in walker.flatten() {
            if entry.file_type().is_file() && entry.file_name().to_string_lossy() == name {
                return Ok(rel_of(self.root(), entry.path()));
            }
        }
        Ok(None)
    }

    pub fn read_picture(&self, name: &str) -> Result<Vec<u8>> {
        let rel = self.find_picture(name)?.with_context(|| format!("no picture named {name}"))?;
        Ok(fs::read(self.path(&rel)?)?)
    }

    /// Save a new picture under a free name like `name`; returns the name to
    /// embed. Never overwrites.
    pub fn save_picture(&self, name: &str, bytes: &[u8]) -> Result<String> {
        if !is_picture(name) {
            bail!("{name} is not a picture");
        }
        let p = Path::new(name);
        let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("png").to_lowercase();
        let stem = file_stem_for(&p.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default());
        let dir = self.path(&self.attachment_dir())?;
        let path = unique_path(&dir, &stem, &ext);
        write_atomic(&path, bytes)?;
        Ok(path.file_name().context("no name")?.to_string_lossy().into_owned())
    }

    /// Let a picture go: it rests for a day with what was let go, as a note
    /// does, and can be restored.
    pub fn remove_picture(&self, name: &str, now: chrono::DateTime<chrono::Utc>) -> Result<crate::settle::Settled> {
        let rel = self.find_picture(name)?.with_context(|| format!("no picture named {name}"))?;
        self.settle(&rel, crate::settle::Reason::Deleted, now)
    }

    /// Replace a picture Mandala can find, such as a drawing changed again.
    pub fn replace_picture(&self, name: &str, bytes: &[u8]) -> Result<()> {
        let rel = self.find_picture(name)?.with_context(|| format!("no picture named {name}"))?;
        write_atomic(&self.path(&rel)?, bytes)
    }
}

#[cfg(test)]
mod tests {
    use crate::vault::testing::*;

    #[test]
    fn pictures_go_to_the_attachment_folder_and_are_found_by_name() {
        let f = arranged();
        let name = f.vault.save_picture("Pasted 2026-11-01.png", b"png").unwrap();
        assert_eq!(name, "Pasted 2026-11-01.png");
        assert_eq!(f.vault.find_picture(&name).unwrap().as_deref(), Some("attachments/Pasted 2026-11-01.png"));
        assert_eq!(f.vault.read_picture(&name).unwrap(), b"png");

        let again = f.vault.save_picture("Pasted 2026-11-01.png", b"two").unwrap();
        assert_eq!(again, "Pasted 2026-11-01 (1).png", "never overwrites");
    }

    #[test]
    fn a_picture_anywhere_is_found_and_only_pictures() {
        let f = arranged();
        put(&f.vault, "stone/Travel/kyoto.jpg", "jpg");
        assert_eq!(f.vault.find_picture("kyoto.jpg").unwrap().as_deref(), Some("stone/Travel/kyoto.jpg"));
        assert_eq!(f.vault.find_picture("stone/Travel/kyoto.jpg").unwrap().as_deref(), Some("stone/Travel/kyoto.jpg"));
        assert!(f.vault.find_picture("missing.png").unwrap().is_none());
        put(&f.vault, "stone/Note.md", "x");
        assert!(f.vault.find_picture("Note.md").unwrap().is_none());
        assert!(f.vault.save_picture("evil.md", b"x").is_err());
        assert!(f.vault.find_picture("../outside.png").is_err());
    }

    #[test]
    fn a_removed_picture_rests_and_comes_back() {
        let f = arranged();
        let name = f.vault.save_picture("Drawing.svg", b"<svg/>").unwrap();
        let s = f.vault.remove_picture(&name, chrono::Utc::now()).unwrap();
        assert!(f.vault.find_picture(&name).unwrap().is_none());
        // Its place was taken meanwhile: it comes back beside it, still an SVG.
        f.vault.save_picture("Drawing.svg", b"<svg>new</svg>").unwrap();
        let back = f.vault.restore(&s.id, chrono::Utc::now()).unwrap();
        assert_eq!(back, "attachments/Drawing (restored).svg");
    }

    #[test]
    fn obsidians_attachment_folder_is_used_when_set() {
        let f = arranged();
        put(&f.vault, ".obsidian/app.json", r#"{"attachmentFolderPath": "Files/Images"}"#);
        let name = f.vault.save_picture("Drawing.svg", b"<svg/>").unwrap();
        assert_eq!(f.vault.find_picture(&name).unwrap().as_deref(), Some("Files/Images/Drawing.svg"));
        f.vault.replace_picture(&name, b"<svg>2</svg>").unwrap();
        assert_eq!(f.vault.read_picture(&name).unwrap(), b"<svg>2</svg>");
    }
}
