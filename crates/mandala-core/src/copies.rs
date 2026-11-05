//! Sync copies.
//!
//! When the same note changes on two devices before sync catches up, the sync
//! tool keeps both: the note and a copy beside it. Every tool names the copy
//! its own way (`Note 2.md`, `Note (… conflicted copy …).md`,
//! `Note.sync-conflict-….md`, `Note-DESKTOP-1.md`), so Mandala does not read
//! the name's ending.
//!
//! A copy is a plain note: nothing stops for it, and the person can fold it
//! back in by dragging it onto its note (`combine.rs`). Mandala only makes
//! sure a copy of sand gets no extra life: it keeps the clock of the note it
//! was copied from (`reconcile`).
//!
//! To know a copy, Mandala keeps the last version it saw of every note in its
//! state folder (outside the vault, so it never syncs): the base.

use crate::fsx::write_atomic;
use crate::vault::Vault;
use anyhow::Result;
use std::collections::HashSet;
use std::fs;

/// How much of the note's last-seen text a copy must hold.
const SHARED: f64 = 0.5;

/// The share of `base`'s non-empty lines that are also in `text`.
fn shared(base: &str, text: &str) -> f64 {
    let lines: HashSet<&str> = text.lines().map(str::trim).filter(|l| !l.is_empty()).collect();
    let mut all = 0;
    let mut kept = 0;
    for l in base.lines().map(str::trim).filter(|l| !l.is_empty()) {
        all += 1;
        kept += lines.contains(l) as usize;
    }
    if all == 0 {
        0.0
    } else {
        kept as f64 / all as f64
    }
}

/// `copy` starts with `stem`, then a separator a sync tool would use.
fn named_after(copy: &str, stem: &str) -> bool {
    copy.len() > stem.len() && copy.starts_with(stem) && copy[stem.len()..].starts_with([' ', '(', '.', '-', '_'])
}

impl Vault {
    pub(crate) fn base_path(&self, rel: &str) -> std::path::PathBuf {
        self.state_dir().join("base").join(rel)
    }

    /// Remember a note as Mandala last saw it.
    pub(crate) fn remember(&self, rel: &str, text: &str) -> Result<()> {
        write_atomic(&self.base_path(rel), text.as_bytes())
    }

    pub(crate) fn remember_all(&self) -> Result<()> {
        for n in self.notes()? {
            let text = self.read(&n.rel)?;
            if fs::read_to_string(self.base_path(&n.rel)).ok().as_deref() != Some(text.as_str()) {
                self.remember(&n.rel, &text)?;
            }
        }
        Ok(())
    }

    /// The note `rel` was copied from by a sync tool, if it is a copy: Mandala
    /// has never seen it, it sits beside a note Mandala knows, its name starts
    /// with that note's name and a separator, and it holds at least half of
    /// that note as Mandala last saw it. So a real `Chapter 2.md` Mandala
    /// knew, or a new note that only shares a name, is never taken for a copy.
    pub fn copy_of(&self, rel: &str) -> Result<Option<String>> {
        if self.base_path(rel).exists() {
            return Ok(None);
        }
        let name = rel.rsplit('/').next().unwrap_or(rel);
        let dir = rel.strip_suffix(name).unwrap_or("");
        let stem = name.strip_suffix(".md").unwrap_or(name);
        let Ok(entries) = fs::read_dir(self.path(dir.trim_end_matches('/')).unwrap_or_else(|_| self.root().to_path_buf())) else {
            return Ok(None);
        };
        // The longest known name it starts with: `Plan b 2.md` beside both
        // `Plan.md` and `Plan b.md` belongs to the second.
        let mut best: Option<String> = None;
        for e in entries.flatten() {
            let other = e.file_name().to_string_lossy().into_owned();
            let Some(other_stem) = other.strip_suffix(".md") else { continue };
            let other_rel = format!("{dir}{other}");
            if other_rel == rel || !named_after(stem, other_stem) || !self.base_path(&other_rel).is_file() {
                continue;
            }
            if best.as_ref().is_none_or(|b| other_rel.len() > b.len()) {
                best = Some(other_rel);
            }
        }
        let Some(original) = best else { return Ok(None) };
        let base = fs::read_to_string(self.base_path(&original)).unwrap_or_default();
        Ok((shared(&base, &self.read(rel)?) >= SHARED).then_some(original))
    }
}

#[cfg(test)]
mod tests {
    use crate::vault::testing::*;
    use chrono::{Duration, Utc};

    const PLAN: &str = "# Plan\n\nWake early.\nSit.\nWalk.\n";

    #[test]
    fn finds_copies_from_any_sync_tool_by_name_and_text() {
        let f = arranged();
        put(&f.vault, "stone/Plan.md", PLAN);
        put(&f.vault, "stone/Planets.md", "# Planets\n\nWake early.\nSit.\nWalk.\n");
        f.vault.arrive(Utc::now()).unwrap();

        let edited = PLAN.replace("Walk.", "Run.");
        for copy in ["stone/Plan 2.md", "stone/Plan (Mac's conflicted copy 2026-10-31).md", "stone/Plan-DESKTOP-AB12.md", "stone/Plan.sync-conflict-20261031-101500-ABC1234.md"] {
            put(&f.vault, copy, &edited);
            assert_eq!(f.vault.copy_of(copy).unwrap().as_deref(), Some("stone/Plan.md"), "{copy}");
        }
        // Not copies: a new note that only shares the name, one whose name runs
        // on without a separator, and a note Mandala already knew.
        put(&f.vault, "stone/Plan for winter.md", "# Winter\n\nSomething else entirely.\n");
        put(&f.vault, "stone/Planetsx.md", PLAN);
        assert!(f.vault.copy_of("stone/Plan for winter.md").unwrap().is_none());
        assert!(f.vault.copy_of("stone/Planetsx.md").unwrap().is_none());
        assert!(f.vault.copy_of("stone/Planets.md").unwrap().is_none());
    }

    #[test]
    fn a_copy_of_sand_keeps_the_clock_of_its_note() {
        let f = arranged();
        let then = Utc::now() - Duration::hours(20);
        put(&f.vault, "sand/sun/Idea.md", PLAN);
        f.vault.arrive(then).unwrap();
        let before = f.vault.load_clock().unwrap().grains["sand/sun/Idea.md"].clone();

        put(&f.vault, "sand/sun/Idea 2.md", &PLAN.replace("Sit.", "Sit long."));
        let clock = f.vault.refresh(Utc::now()).unwrap();
        let copy = &clock.grains["sand/sun/Idea 2.md"];
        assert_eq!(copy.written, before.written, "no fresh start for a copy");
        assert_eq!(copy.dissolves, before.dissolves, "no extra life");
    }
}
