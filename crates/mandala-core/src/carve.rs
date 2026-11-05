//! The carving: why a stone note was kept, shown and edited beside the note.
//! Never in the note itself.
//!
//! Kept in `.mandala/carved.json` (stone path → carving), so it travels with
//! the vault. Each carving holds the file's inode as well: a note renamed or
//! moved outside Mandala (Obsidian, Finder) is followed, as `life.json` does.
//! The first read seeds the file from `kept.jsonl`, the older log of keeps.

use crate::fsx::write_atomic;
use crate::lifespan::{place_of, Place};
use crate::vault::{inode, Vault};
use anyhow::{bail, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::fs;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Carving {
    pub text: String,
    pub at: DateTime<Utc>,
    #[serde(default)]
    pub ino: Option<u64>,
}

type Carvings = BTreeMap<String, Carving>;

impl Vault {
    fn carved_path(&self) -> std::path::PathBuf {
        self.dot().join("carved.json")
    }

    fn ino_of(&self, rel: &str) -> Option<u64> {
        self.path(rel).ok().and_then(|p| inode(&p))
    }

    fn save_carvings(&self, c: &Carvings) -> Result<()> {
        fs::create_dir_all(self.dot())?;
        write_atomic(&self.carved_path(), &serde_json::to_vec_pretty(c)?)
    }

    /// Every carving, under the note's path today.
    pub fn carvings(&self) -> Result<Carvings> {
        let mut changed = false;
        let mut all: Carvings = match fs::read(self.carved_path()) {
            Ok(b) => serde_json::from_slice(&b).unwrap_or_default(),
            Err(_) => {
                changed = true;
                let mut seeded = Carvings::new();
                for k in self.kept_log()? {
                    if let Some(text) = k.because.filter(|t| !t.trim().is_empty()) {
                        seeded.insert(k.rel.clone(), Carving { text, at: k.at, ino: self.ino_of(&k.rel) });
                    }
                }
                seeded
            }
        };
        // Follow notes that moved without Mandala, by inode.
        let lost: Vec<String> = all.iter().filter(|(r, _)| !self.path(r).is_ok_and(|p| p.is_file())).map(|(r, _)| r.clone()).collect();
        if !lost.is_empty() {
            let by_ino: HashMap<u64, String> = self
                .notes()?
                .into_iter()
                .filter(|n| place_of(&n.rel) == Place::Stone && !all.contains_key(&n.rel))
                .filter_map(|n| self.ino_of(&n.rel).map(|i| (i, n.rel)))
                .collect();
            for rel in lost {
                let Some(found) = all[&rel].ino.and_then(|i| by_ino.get(&i)) else { continue };
                let c = all.remove(&rel).expect("listed above");
                all.insert(found.clone(), c);
                changed = true;
            }
        }
        if changed {
            self.save_carvings(&all)?;
        }
        Ok(all)
    }

    pub fn carving(&self, rel: &str) -> Result<Option<Carving>> {
        Ok(self.carvings()?.remove(rel))
    }

    /// Carve (or re-carve) why a stone note is kept. Empty text removes it.
    pub fn carve(&self, rel: &str, text: &str, now: DateTime<Utc>) -> Result<()> {
        if place_of(rel) != Place::Stone || !self.path(rel)?.is_file() {
            bail!("{rel} is not a stone note");
        }
        let mut all = self.carvings()?;
        let text = text.trim();
        if text.is_empty() {
            all.remove(rel);
        } else {
            all.insert(rel.to_string(), Carving { text: text.to_string(), at: now, ino: self.ino_of(rel) });
        }
        self.save_carvings(&all)
    }

    /// A stone note Mandala moved keeps its carving.
    pub(crate) fn carry_carving(&self, from: &str, to: &str) -> Result<()> {
        let mut all = self.carvings()?;
        if let Some(mut c) = all.remove(from) {
            c.ino = self.ino_of(to);
            all.insert(to.to_string(), c);
            self.save_carvings(&all)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::vault::testing::*;
    use chrono::Utc;

    #[test]
    fn keeping_carves_the_reason_and_it_can_be_changed_or_cleared() {
        let f = arranged();
        put(&f.vault, "sand/sun/Bell.md", "# Bell");
        let rel = f.vault.keep("sand/sun/Bell.md", "Practice", Some("It rang true."), Utc::now()).unwrap();
        assert_eq!(f.vault.carving(&rel).unwrap().unwrap().text, "It rang true.");

        f.vault.carve(&rel, "  It still rings.  ", Utc::now()).unwrap();
        assert_eq!(f.vault.carving(&rel).unwrap().unwrap().text, "It still rings.");
        f.vault.carve(&rel, "", Utc::now()).unwrap();
        assert!(f.vault.carving(&rel).unwrap().is_none());
    }

    #[test]
    fn a_note_with_no_reason_can_be_given_one_but_sand_cannot() {
        let f = arranged();
        put(&f.vault, "stone/Old.md", "arranged, never kept in Mandala");
        put(&f.vault, "sand/sun/New.md", "sand");
        assert!(f.vault.carving("stone/Old.md").unwrap().is_none());
        f.vault.carve("stone/Old.md", "My first essay.", Utc::now()).unwrap();
        assert_eq!(f.vault.carving("stone/Old.md").unwrap().unwrap().text, "My first essay.");
        assert!(f.vault.carve("sand/sun/New.md", "no", Utc::now()).is_err());
        assert!(f.vault.carve("stone/Missing.md", "no", Utc::now()).is_err());
    }

    #[test]
    fn the_carving_follows_the_note_when_moved_in_mandala_or_elsewhere() {
        let f = arranged();
        put(&f.vault, "stone/Bell.md", "# Bell");
        f.vault.carve("stone/Bell.md", "It rang true.", Utc::now()).unwrap();

        // Moved in Mandala.
        let to = f.vault.move_stone("stone/Bell.md", "Practice").unwrap();
        assert_eq!(f.vault.carving(&to).unwrap().unwrap().text, "It rang true.");

        // Renamed outside Mandala: followed by inode.
        std::fs::rename(f.vault.path(&to).unwrap(), f.vault.path("stone/Practice/Temple bell.md").unwrap()).unwrap();
        if cfg!(unix) {
            assert_eq!(f.vault.carving("stone/Practice/Temple bell.md").unwrap().unwrap().text, "It rang true.");
        }
    }

    #[test]
    fn older_reasons_are_read_from_the_keep_log() {
        let f = arranged();
        put(&f.vault, "sand/sun/Bell.md", "# Bell");
        let rel = f.vault.keep("sand/sun/Bell.md", "", Some("Old reason."), Utc::now()).unwrap();
        // As if carved.json had never been written.
        let _ = std::fs::remove_file(f.vault.root().join(".mandala/carved.json"));
        assert_eq!(f.vault.carving(&rel).unwrap().unwrap().text, "Old reason.");
    }

    #[test]
    fn search_finds_a_note_by_its_carving() {
        let f = arranged();
        put(&f.vault, "stone/Bell.md", "# Bell\n\nNothing here.");
        f.vault.carve("stone/Bell.md", "The temple at dusk.", Utc::now()).unwrap();
        let hits = f.vault.search("temple").unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].line, "The temple at dusk.");
    }
}
