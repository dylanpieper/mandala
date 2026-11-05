//! Settling: what is swept or deleted leaves the vault at once, but rests in
//! `.mandala/settling/` for 24 hours, where it can be restored. There is no
//! trash in the window; a settled note is found again by search, by the undo
//! that follows the sweep, or as dust past the mandala's rim.

use crate::clock::Grain;
use crate::fsx::{move_file, unique_path, write_atomic};
use crate::lifespan::{place_of, Place};
use crate::vault::{title_of, Vault};
use anyhow::{bail, Context, Result};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;

pub const SETTLE_FOR_HOURS: i64 = 24;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Reason {
    Swept,
    Deleted,
    /// From an older Mandala: a sync copy merged into its note.
    Merged,
    /// Combined into another note.
    Combined,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Settled {
    pub id: String,
    pub rel: String,
    pub title: String,
    pub reason: Reason,
    pub at: DateTime<Utc>,
}

impl Settled {
    pub fn restorable_until(&self) -> DateTime<Utc> {
        self.at + Duration::hours(SETTLE_FOR_HOURS)
    }
}

impl Vault {
    fn settling_dir(&self) -> std::path::PathBuf {
        self.dot().join("settling")
    }

    /// Take a note out of the vault, to rest for a day.
    pub fn settle(&self, rel: &str, reason: Reason, now: DateTime<Utc>) -> Result<Settled> {
        let from = self.path(rel)?;
        if !from.is_file() {
            bail!("no note at {rel}");
        }
        let base = now.format("%Y%m%dT%H%M%S%3f").to_string();
        let (id, dir) = (0..)
            .map(|n| if n == 0 { base.clone() } else { format!("{base}-{n}") })
            .map(|id| {
                let dir = self.settling_dir().join(&id);
                (id, dir)
            })
            .find(|(_, dir)| !dir.exists())
            .expect("a free id");
        let name = from.file_name().context("note has no name")?;
        move_file(&from, &dir.join(name))?;
        let settled = Settled { id, rel: rel.to_string(), title: title_of(rel), reason, at: now };
        write_atomic(&dir.join("meta.json"), &serde_json::to_vec_pretty(&settled)?)?;
        Ok(settled)
    }

    /// Everything settling, newest first.
    pub fn settling(&self) -> Result<Vec<Settled>> {
        let mut all = Vec::new();
        let Ok(entries) = fs::read_dir(self.settling_dir()) else { return Ok(all) };
        for entry in entries {
            let meta = entry?.path().join("meta.json");
            if let Ok(bytes) = fs::read(&meta) {
                all.push(serde_json::from_slice::<Settled>(&bytes)?);
            }
        }
        all.sort_by_key(|s| std::cmp::Reverse(s.at));
        Ok(all)
    }

    pub fn settled_text(&self, id: &str) -> Result<String> {
        let s = self.find_settled(id)?;
        let name = s.rel.rsplit('/').next().unwrap_or(&s.rel);
        Ok(fs::read_to_string(self.settling_dir().join(id).join(name))?)
    }

    fn find_settled(&self, id: &str) -> Result<Settled> {
        self.settling()?.into_iter().find(|s| s.id == id).with_context(|| format!("nothing settling as {id}"))
    }

    /// Put a settled note back where it was (or beside it, if that place is
    /// taken). Swept sand comes back with its lifespan started again.
    pub fn restore(&self, id: &str, now: DateTime<Utc>) -> Result<String> {
        let s = self.find_settled(id)?;
        let dir = self.settling_dir().join(id);
        let name = s.rel.rsplit('/').next().unwrap_or(&s.rel).to_string();
        let mut to = self.path(&s.rel)?;
        if to.exists() {
            let parent = to.parent().context("no parent")?.to_path_buf();
            let ext = std::path::Path::new(&name).extension().and_then(|e| e.to_str()).unwrap_or("md").to_string();
            let stem = name.strip_suffix(&format!(".{ext}")).unwrap_or(&name);
            to = unique_path(&parent, &format!("{stem} (restored)"), &ext);
        }
        move_file(&dir.join(&name), &to)?;
        fs::remove_dir_all(&dir)?;
        let rel = crate::fsx::rel_of(self.root(), &to).context("restored outside vault")?;
        if let Place::Sand(life) = place_of(&rel) {
            let mut clock = self.load_clock()?;
            let visit = clock.visit;
            clock.grains.insert(rel.clone(), Grain::new(life, now, visit, None));
            self.reconcile(&mut clock, now)?;
            self.save_clock(&clock)?;
        }
        Ok(rel)
    }

    /// Let go, for good, of what has settled for a day. Only its title and
    /// dates stay, in `.mandala/swept.log`.
    pub fn purge(&self, now: DateTime<Utc>) -> Result<usize> {
        let mut gone = 0;
        for s in self.settling()? {
            if now < s.restorable_until() {
                continue;
            }
            let mut log = fs::OpenOptions::new().create(true).append(true).open(self.dot().join("swept.log"))?;
            writeln!(log, "{}\t{:?}\t{}", s.at.to_rfc3339(), s.reason, s.rel)?;
            fs::remove_dir_all(self.settling_dir().join(&s.id))?;
            gone += 1;
        }
        Ok(gone)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lifespan::Life;
    use crate::vault::testing::*;

    #[test]
    fn settled_notes_leave_at_once_and_come_back() {
        let f = arranged();
        put(&f.vault, "stone/a.md", "keep me");
        let now = Utc::now();
        let s = f.vault.settle("stone/a.md", Reason::Deleted, now).unwrap();
        assert!(!f.vault.path("stone/a.md").unwrap().exists());
        assert!(f.vault.notes().unwrap().is_empty(), "a settled note is out of sight");
        assert_eq!(f.vault.settled_text(&s.id).unwrap(), "keep me");

        let rel = f.vault.restore(&s.id, now).unwrap();
        assert_eq!(rel, "stone/a.md");
        assert_eq!(f.vault.read("stone/a.md").unwrap(), "keep me");
        assert!(f.vault.settling().unwrap().is_empty());
    }

    #[test]
    fn restoring_onto_a_taken_name_goes_beside_it() {
        let f = arranged();
        put(&f.vault, "stone/a.md", "old");
        let s = f.vault.settle("stone/a.md", Reason::Deleted, Utc::now()).unwrap();
        put(&f.vault, "stone/a.md", "new");
        let rel = f.vault.restore(&s.id, Utc::now()).unwrap();
        assert_eq!(rel, "stone/a (restored).md");
        assert_eq!(f.vault.read("stone/a.md").unwrap(), "new");
    }

    #[test]
    fn restored_sand_starts_its_lifespan_again() {
        let f = arranged();
        put(&f.vault, "sand/sun/a.md", "a");
        let then = at(2026, 10, 1);
        let s = f.vault.settle("sand/sun/a.md", Reason::Swept, then).unwrap();
        let now = at(2026, 10, 31);
        f.vault.restore(&s.id, now).unwrap();
        let g = &f.vault.load_clock().unwrap().grains["sand/sun/a.md"];
        assert_eq!(g.life, Life::Sun);
        assert_eq!(g.dissolves, Some(now + Duration::hours(24)));
    }

    #[test]
    fn after_a_day_only_the_title_remains() {
        let f = arranged();
        put(&f.vault, "sand/sun/a.md", "a");
        let then = Utc::now();
        f.vault.settle("sand/sun/a.md", Reason::Swept, then).unwrap();
        assert_eq!(f.vault.purge(then + Duration::hours(23)).unwrap(), 0);
        assert_eq!(f.vault.purge(then + Duration::hours(24)).unwrap(), 1);
        assert!(f.vault.settling().unwrap().is_empty());
        let log = fs::read_to_string(f.vault.root().join(".mandala/swept.log")).unwrap();
        assert!(log.contains("sand/sun/a.md"));
        assert!(!log.contains("\ta\n"), "the log holds no text from the note");
    }
}
