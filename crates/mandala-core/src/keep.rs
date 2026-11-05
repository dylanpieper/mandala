//! Writing new sand, changing a lifespan, keeping, and returning to sand.

use crate::clock::Grain;
use crate::fsx::{file_stem_for, move_file, rel_of, unique_path, write_atomic};
use crate::lifespan::{place_of, Life, Place};
use crate::settle::{Reason, Settled};
use crate::vault::Vault;
use anyhow::{bail, Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::io::Write;

/// One line of `.mandala/kept.jsonl`: why a note was kept. Never in the note itself.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Kept {
    pub rel: String,
    pub from: String,
    pub at: DateTime<Utc>,
    pub because: Option<String>,
    pub life: Option<Life>,
}

impl Vault {
    /// A new sand note, with its clock started now.
    pub fn new_sand(&self, title: &str, life: Life, now: DateTime<Utc>) -> Result<String> {
        let dir = self.path(life.folder())?;
        let stem = file_stem_for(title);
        let path = unique_path(&dir, &stem, "md");
        // The heading carries the same " (1)" as the file name, so two notes
        // made the same day can be told apart.
        let taken = path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
        let suffix = taken.strip_prefix(&stem).unwrap_or("");
        write_atomic(&path, format!("# {}{suffix}\n\n", title.trim()).as_bytes())?;
        let rel = rel_of(self.root(), &path).context("outside vault")?;
        let mut clock = self.load_clock()?;
        let visit = clock.visit;
        clock.grains.insert(rel.clone(), Grain::new(life, now, visit, None));
        self.reconcile(&mut clock, now)?;
        self.save_clock(&clock)?;
        Ok(rel)
    }

    /// Move a sand note to another lifespan, chosen in Mandala. A shorter one
    /// ends no later than before (`relife`). A longer one is a deliberate gift
    /// of time: its clock starts over now (`restart`). `written` never changes.
    pub fn set_life(&self, rel: &str, life: Life, now: DateTime<Utc>) -> Result<String> {
        let Place::Sand(current) = place_of(rel) else { bail!("{rel} is not sand") };
        if life == current {
            return Ok(rel.to_string());
        }
        let to = self.move_into(rel, life.folder())?;
        let mut clock = self.load_clock()?;
        if let Some(g) = clock.grains.remove(rel) {
            let g = if life.rank() > current.rank() { g.restart(life, now) } else { g.relife(life) };
            clock.grains.insert(to.clone(), g);
        }
        self.reconcile(&mut clock, now)?;
        self.save_clock(&clock)?;
        Ok(to)
    }

    /// Set a sand note in stone, in `stone/<folder>/`, with the reason given.
    pub fn keep(&self, rel: &str, folder: &str, because: Option<&str>, now: DateTime<Utc>) -> Result<String> {
        let Place::Sand(life) = place_of(rel) else { bail!("{rel} is not sand") };
        let dest = if folder.trim().is_empty() { "stone".to_string() } else { format!("stone/{}", folder.trim()) };
        self.path(&dest)?; // refuses `..` and the like
        let to = self.move_into(rel, &dest)?;
        let kept = Kept {
            rel: to.clone(),
            from: rel.to_string(),
            at: now,
            because: because.map(str::trim).filter(|b| !b.is_empty()).map(String::from),
            life: Some(life),
        };
        let mut log = std::fs::OpenOptions::new().create(true).append(true).open(self.dot_file("kept.jsonl")?)?;
        writeln!(log, "{}", serde_json::to_string(&kept)?)?;
        if let Some(because) = &kept.because {
            self.carve(&to, because, now)?;
        }
        let mut clock = self.load_clock()?;
        clock.grains.remove(rel);
        self.save_clock(&clock)?;
        self.remember(&to, &self.read(&to)?)?;
        Ok(to)
    }

    /// Return a stone note to sand: it begins a new lifespan now.
    pub fn return_to_sand(&self, rel: &str, life: Life, now: DateTime<Utc>) -> Result<String> {
        if place_of(rel) != Place::Stone {
            bail!("{rel} is not stone");
        }
        let to = self.move_into(rel, life.folder())?;
        let mut clock = self.load_clock()?;
        let visit = clock.visit;
        clock.grains.insert(to.clone(), Grain::new(life, now, visit, None));
        self.reconcile(&mut clock, now)?;
        self.save_clock(&clock)?;
        Ok(to)
    }

    /// Delete a note: it settles for a day like swept sand.
    pub fn delete(&self, rel: &str, now: DateTime<Utc>) -> Result<Settled> {
        let s = self.settle(rel, Reason::Deleted, now)?;
        let mut clock = self.load_clock()?;
        clock.grains.remove(rel);
        self.save_clock(&clock)?;
        Ok(s)
    }

    /// Why each note was kept, newest last.
    pub fn kept_log(&self) -> Result<Vec<Kept>> {
        let Ok(text) = std::fs::read_to_string(self.dot_file("kept.jsonl")?) else { return Ok(Vec::new()) };
        text.lines().filter(|l| !l.trim().is_empty()).map(|l| Ok(serde_json::from_str(l)?)).collect()
    }

    fn dot_file(&self, name: &str) -> Result<std::path::PathBuf> {
        std::fs::create_dir_all(self.dot())?;
        Ok(self.dot().join(name))
    }

    fn move_into(&self, rel: &str, dir_rel: &str) -> Result<String> {
        let from = self.path(rel)?;
        let name = from.file_name().context("no file name")?.to_string_lossy().into_owned();
        let stem = name.strip_suffix(".md").unwrap_or(&name);
        let to = unique_path(&self.path(dir_rel)?, stem, "md");
        move_file(&from, &to)?;
        let to = rel_of(self.root(), &to).context("moved outside vault")?;
        self.reorder_moved(rel, &to)?;
        Ok(to)
    }

    /// Move a stone note into another folder of stone (`""` for stone itself).
    pub fn move_stone(&self, rel: &str, folder: &str) -> Result<String> {
        if place_of(rel) != Place::Stone {
            bail!("{rel} is not stone");
        }
        let dest = if folder.trim().is_empty() { "stone".to_string() } else { format!("stone/{}", folder.trim()) };
        let dir = self.path(&dest)?; // refuses `..` and the like
        if self.path(rel)?.parent() == Some(dir.as_path()) {
            return Ok(rel.to_string());
        }
        std::fs::create_dir_all(&dir)?;
        let to = self.move_into(rel, &dest)?;
        self.remember(&to, &self.read(&to)?)?;
        self.carry_carving(rel, &to)?;
        Ok(to)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault::testing::*;
    use chrono::Duration;

    #[test]
    fn new_sand_lands_in_its_lifespan_folder() {
        let f = arranged();
        let now = Utc::now();
        let rel = f.vault.new_sand("Morning pages", Life::Sun, now).unwrap();
        assert_eq!(rel, "sand/sun/Morning pages.md");
        assert_eq!(f.vault.read(&rel).unwrap(), "# Morning pages\n\n");
        let g = &f.vault.load_clock().unwrap().grains[&rel];
        assert_eq!(g.dissolves, Some(now + Duration::hours(24)));
        let again = f.vault.new_sand("Morning pages", Life::Sun, now).unwrap();
        assert_eq!(again, "sand/sun/Morning pages (1).md");
        assert_eq!(f.vault.read(&again).unwrap(), "# Morning pages (1)\n\n");
    }

    #[test]
    fn keeping_moves_to_stone_and_remembers_why() {
        let f = arranged();
        let now = Utc::now();
        let rel = f.vault.new_sand("Morning pages", Life::Sun, now).unwrap();
        let kept = f.vault.keep(&rel, "Practice", Some("The first full sit."), now).unwrap();
        assert_eq!(kept, "stone/Practice/Morning pages.md");
        assert!(f.vault.load_clock().unwrap().grains.is_empty());
        let log = f.vault.kept_log().unwrap();
        assert_eq!(log[0].because.as_deref(), Some("The first full sit."));
        assert_eq!(log[0].life, Some(Life::Sun));
        assert!(f.vault.keep(&kept, "", None, now).is_err(), "stone cannot be kept twice");
        assert!(f.vault.keep(&rel, "../escape", None, now).is_err());
    }

    #[test]
    fn set_life_shortens_from_the_start_and_restarts_when_longer() {
        let f = arranged();
        let then = Utc::now() - Duration::days(2);
        let rel = f.vault.new_sand("Note", Life::Quarter, then).unwrap();

        // Shorter: counts from when it was written, so 24h after `then`.
        let sun = f.vault.set_life(&rel, Life::Sun, then + Duration::hours(1)).unwrap();
        assert_eq!(sun, "sand/sun/Note.md");
        let g = f.vault.load_clock().unwrap().grains[&sun].clone();
        assert_eq!(g.dissolves, Some(then + Duration::hours(24)));

        // Longer: the clock starts over now; `written` stays.
        let now = Utc::now();
        let full = f.vault.set_life(&sun, Life::Full, now).unwrap();
        assert_eq!(full, "sand/moon/full/Note.md");
        let g = f.vault.load_clock().unwrap().grains[&full].clone();
        assert_eq!(g.written, then);
        assert_eq!(g.started, Some(now));
        assert_eq!(g.dissolves, Some(now + Life::Full.duration().unwrap()));
        assert!(g.fraction_left(now) > 0.99, "a restarted clock is full");

        // A breath given a sun gets 24 hours from now.
        let breath = f.vault.set_life(&full, Life::Breath, now).unwrap();
        assert_eq!(f.vault.load_clock().unwrap().grains[&breath].dissolves, None);
        let later = now + Duration::minutes(5);
        let sun = f.vault.set_life(&breath, Life::Sun, later).unwrap();
        assert_eq!(f.vault.load_clock().unwrap().grains[&sun].dissolves, Some(later + Duration::hours(24)));
    }

    #[test]
    fn stone_moves_between_its_folders() {
        let f = arranged();
        put(&f.vault, "stone/life/a.md", "a");
        put(&f.vault, "stone/prompts/b.md", "b");
        let to = f.vault.move_stone("stone/life/a.md", "prompts").unwrap();
        assert_eq!(to, "stone/prompts/a.md");
        assert_eq!(f.vault.move_stone(&to, "prompts").unwrap(), to, "same folder: nothing moves");
        assert_eq!(f.vault.move_stone(&to, "").unwrap(), "stone/a.md");
        assert!(f.vault.move_stone("stone/a.md", "../out").is_err());
        assert!(f.vault.move_stone("sand/sun/x.md", "life").is_err());
    }

    #[test]
    fn stone_can_return_to_sand() {
        let f = arranged();
        put(&f.vault, "stone/old.md", "old");
        let now = Utc::now();
        let rel = f.vault.return_to_sand("stone/old.md", Life::Half, now).unwrap();
        assert_eq!(rel, "sand/moon/half/old.md");
        assert!(f.vault.load_clock().unwrap().grains[&rel].dissolves.unwrap() > now);
    }
}
