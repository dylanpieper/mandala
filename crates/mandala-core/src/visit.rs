//! A visit: arriving, and closing.
//!
//! Mandala only runs when it is open, so arriving is when time catches up:
//! wait for sync, see what came in, let go of what ran out. Closing is when
//! breaths leave. Nothing is swept that the person has not been shown.

use crate::clock::{Clock, Grain};
use crate::lifespan::{Life, Place};
use crate::settle::{Reason, Settled};
use crate::vault::{inode, title_of, Vault};
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;

#[derive(Clone, Debug, Serialize)]
pub struct NoteRef {
    pub rel: String,
    pub title: String,
    pub life: Option<Life>,
    pub written: Option<DateTime<Utc>>,
    pub dissolves: Option<DateTime<Utc>>,
}

impl NoteRef {
    fn sand(rel: &str, g: &Grain) -> NoteRef {
        NoteRef {
            rel: rel.to_string(),
            title: title_of(rel),
            life: Some(g.life),
            written: Some(g.written),
            dissolves: g.dissolves,
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct Arrival {
    pub visit: u64,
    /// When the last visit ended (or began, if it never closed).
    pub since: Option<DateTime<Utc>>,
    pub stone_changed: Vec<NoteRef>,
    pub sand_new: Vec<NoteRef>,
    /// Ran out while Mandala was closed: shown once, then let go or kept.
    pub leaving: Vec<NoteRef>,
    /// Sand that was moved into stone elsewhere (Obsidian on the phone) since
    /// the last visit, with no carving yet: offered one, skippable.
    pub kept_elsewhere: Vec<NoteRef>,
}

impl Vault {
    /// iCloud placeholders for notes not yet downloaded (`.Name.md.icloud`).
    pub fn pending_downloads(&self) -> usize {
        walkdir::WalkDir::new(self.root())
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                let n = e.file_name().to_string_lossy();
                n.starts_with('.') && n.ends_with(".md.icloud")
            })
            .count()
    }

    /// Ask iCloud to bring every placeholder down. A no-op off macOS.
    pub fn request_downloads(&self) -> Result<()> {
        #[cfg(target_os = "macos")]
        for e in walkdir::WalkDir::new(self.root()).into_iter().filter_map(|e| e.ok()) {
            let n = e.file_name().to_string_lossy();
            if n.starts_with('.') && n.ends_with(".icloud") {
                let real = &n[1..n.len() - ".icloud".len()];
                let path = e.path().with_file_name(real);
                let _ = std::process::Command::new("brctl").arg("download").arg(path).status();
            }
        }
        Ok(())
    }

    /// Begin a visit. Call once iCloud has nothing pending.
    pub fn arrive(&self, now: DateTime<Utc>) -> Result<Arrival> {
        let mut clock = self.load_clock()?;
        let known: BTreeSet<String> = clock.grains.keys().cloned().collect();
        let since = clock.last_close.or(clock.last_open);
        clock.visit += 1;
        clock.last_open = Some(now);
        let before = clock.grains.clone();
        self.reconcile(&mut clock, now)?;
        let kept_elsewhere = self.kept_elsewhere(&before, &clock.grains)?;

        let stone_changed = match since {
            None => Vec::new(),
            Some(since) => self
                .notes()?
                .into_iter()
                .filter(|n| n.place == Place::Stone && n.modified > since)
                .filter(|n| !kept_elsewhere.iter().any(|k| k.rel == n.rel))
                .map(|n| NoteRef { title: n.title, rel: n.rel, life: None, written: None, dissolves: None })
                .collect(),
        };
        let sand_new = if since.is_none() {
            Vec::new()
        } else {
            clock.grains.iter().filter(|(rel, _)| !known.contains(*rel)).map(|(rel, g)| NoteRef::sand(rel, g)).collect()
        };
        let leaving = leaving_at_arrival(&clock, now);
        self.remember_all()?;
        self.purge(now)?;
        self.save_clock(&clock)?;
        Ok(Arrival { visit: clock.visit, since, stone_changed, sand_new, leaving, kept_elsewhere })
    }

    /// Stone notes that were sand when the clock was last saved: followed by
    /// inode after a move, or by text when sync delivered the move as a delete
    /// and a create. Only those with no carving yet.
    fn kept_elsewhere(&self, before: &BTreeMap<String, Grain>, after: &BTreeMap<String, Grain>) -> Result<Vec<NoteRef>> {
        let mut gone: Vec<(&String, &Grain)> = before.iter().filter(|(rel, _)| !after.contains_key(*rel)).collect();
        if gone.is_empty() {
            return Ok(Vec::new());
        }
        let carvings = self.carvings()?;
        let mut kept = Vec::new();
        for note in self.notes()? {
            if note.place != Place::Stone || carvings.contains_key(&note.rel) {
                continue;
            }
            let path = self.path(&note.rel)?;
            let ino = inode(&path);
            let by_ino = gone.iter().position(|(_, g)| g.ino.is_some() && g.ino == ino);
            let found = match by_ino {
                Some(i) => Some(i),
                None => {
                    let text = fs::read_to_string(&path).ok();
                    gone.iter().position(|(rel, _)| text.is_some() && fs::read_to_string(self.base_path(rel)).ok() == text)
                }
            };
            if let Some(i) = found {
                gone.remove(i);
                kept.push(NoteRef { title: note.title, rel: note.rel, life: None, written: None, dissolves: None });
            }
        }
        Ok(kept)
    }

    /// Sweep these notes (the ones the person let go of on arrival).
    pub fn let_go(&self, rels: &[String], now: DateTime<Utc>) -> Result<Vec<Settled>> {
        let settled = rels.iter().map(|r| self.settle(r, Reason::Swept, now)).collect::<Result<Vec<_>>>()?;
        let mut clock = self.load_clock()?;
        self.reconcile(&mut clock, now)?;
        self.save_clock(&clock)?;
        Ok(settled)
    }

    /// During a visit, let go of timed sand whose time is up, as it runs out.
    /// The person is looking, so this is not a background sweep. Refuses (lets
    /// nothing go) while sync still has notes to bring down, so a lifespan
    /// changed on the phone is never swept for an old time. Breaths wait for
    /// the close.
    pub fn sweep_ran_out(&self, now: DateTime<Utc>) -> Result<Vec<Settled>> {
        if self.pending_downloads() > 0 {
            return Ok(Vec::new());
        }
        let mut clock = self.load_clock()?;
        self.reconcile(&mut clock, now)?;
        let gone: Vec<String> =
            clock.grains.iter().filter(|(_, g)| g.has_run_out(now)).map(|(r, _)| r.clone()).collect();
        let settled = gone.iter().map(|r| self.settle(r, Reason::Swept, now)).collect::<Result<Vec<_>>>()?;
        self.reconcile(&mut clock, now)?;
        self.save_clock(&clock)?;
        Ok(settled)
    }

    /// The breaths that will leave if the visit ends now.
    pub fn breaths(&self, now: DateTime<Utc>) -> Result<Vec<NoteRef>> {
        let mut clock = self.load_clock()?;
        self.reconcile(&mut clock, now)?;
        Ok(clock.grains.iter().filter(|(_, g)| g.life == Life::Breath).map(|(r, g)| NoteRef::sand(r, g)).collect())
    }

    /// End the visit: breaths leave (to settle for a day).
    pub fn close(&self, now: DateTime<Utc>) -> Result<Vec<Settled>> {
        let mut clock = self.load_clock()?;
        self.reconcile(&mut clock, now)?;
        let breaths: Vec<String> =
            clock.grains.iter().filter(|(_, g)| g.life == Life::Breath).map(|(r, _)| r.clone()).collect();
        let settled = breaths.iter().map(|r| self.settle(r, Reason::Swept, now)).collect::<Result<Vec<_>>>()?;
        clock.last_close = Some(now);
        self.reconcile(&mut clock, now)?;
        self.save_clock(&clock)?;
        Ok(settled)
    }
}

/// What ran out while Mandala was closed, oldest first: timed sand past its
/// time, and breaths left over from a visit that never closed.
fn leaving_at_arrival(clock: &Clock, now: DateTime<Utc>) -> Vec<NoteRef> {
    let mut out: Vec<NoteRef> = clock
        .grains
        .iter()
        .filter(|(_, g)| g.has_run_out(now) || (g.life == Life::Breath && g.seen_visit < clock.visit))
        .map(|(r, g)| NoteRef::sand(r, g))
        .collect();
    out.sort_by_key(|n| n.dissolves.unwrap_or(n.written.unwrap_or(now)));
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault::testing::*;
    use chrono::Duration;
    use std::fs;

    /// A first visit that knows `rels`, then closed.
    fn visited(f: &Fixture, rels: &[(&str, &str)]) -> DateTime<Utc> {
        for (rel, text) in rels {
            put(&f.vault, rel, text);
        }
        let t0 = Utc::now();
        f.vault.arrive(t0).unwrap();
        f.vault.close(t0).unwrap();
        t0
    }

    fn rels(notes: &[NoteRef]) -> Vec<&str> {
        notes.iter().map(|n| n.rel.as_str()).collect()
    }

    #[test]
    fn sand_moved_into_stone_elsewhere_was_kept() {
        let f = arranged();
        let t0 = visited(&f, &[("sand/sun/idea.md", "an idea")]);
        let from = f.vault.path("sand/sun/idea.md").unwrap();
        let to = f.vault.path("stone/Ideas/idea.md").unwrap();
        fs::create_dir_all(to.parent().unwrap()).unwrap();
        fs::rename(from, to).unwrap();

        let a = f.vault.arrive(t0 + Duration::hours(1)).unwrap();
        assert_eq!(rels(&a.kept_elsewhere), vec!["stone/Ideas/idea.md"]);
        assert!(a.stone_changed.is_empty() && a.sand_new.is_empty());
    }

    #[test]
    fn a_keep_that_syncs_as_delete_and_create_is_found_by_its_text() {
        let f = arranged();
        let t0 = visited(&f, &[("sand/moon/full/poem.md", "half a poem")]);
        fs::remove_file(f.vault.path("sand/moon/full/poem.md").unwrap()).unwrap();
        put(&f.vault, "stone/poem.md", "half a poem");

        let a = f.vault.arrive(t0 + Duration::hours(1)).unwrap();
        assert_eq!(rels(&a.kept_elsewhere), vec!["stone/poem.md"]);
        assert!(a.stone_changed.is_empty(), "shown once, as kept");
    }

    #[test]
    fn only_a_keep_with_no_reason_yet_is_offered() {
        let f = arranged();
        let t0 = visited(&f, &[("sand/sun/a.md", "a"), ("sand/sun/gone.md", "gone")]);
        fs::rename(f.vault.path("sand/sun/a.md").unwrap(), f.vault.path("stone/a.md").unwrap()).unwrap();
        f.vault.carve("stone/a.md", "already carved", t0).unwrap();
        fs::remove_file(f.vault.path("sand/sun/gone.md").unwrap()).unwrap();

        let a = f.vault.arrive(t0 + Duration::hours(1)).unwrap();
        assert!(a.kept_elsewhere.is_empty());
    }

    #[test]
    fn first_arrival_shows_nothing_new() {
        let f = arranged();
        put(&f.vault, "stone/a.md", "a");
        put(&f.vault, "sand/sun/b.md", "b");
        let a = f.vault.arrive(Utc::now()).unwrap();
        assert_eq!(a.visit, 1);
        assert!(a.stone_changed.is_empty() && a.sand_new.is_empty() && a.leaving.is_empty());
    }

    #[test]
    fn arrival_shows_what_came_in_and_what_ran_out() {
        let f = arranged();
        put(&f.vault, "sand/sun/old.md", "old");
        let t0 = Utc::now();
        f.vault.arrive(t0).unwrap();
        f.vault.close(t0).unwrap();

        std::thread::sleep(std::time::Duration::from_millis(20));
        put(&f.vault, "sand/moon/full/new.md", "new");
        put(&f.vault, "stone/edited.md", "edited on the phone");

        let a = f.vault.arrive(t0 + Duration::hours(30)).unwrap();
        let new: Vec<_> = a.sand_new.iter().map(|n| n.rel.as_str()).collect();
        assert_eq!(new, vec!["sand/moon/full/new.md"]);
        assert_eq!(a.stone_changed.len(), 1);
        let leaving: Vec<_> = a.leaving.iter().map(|n| n.rel.as_str()).collect();
        assert_eq!(leaving, vec!["sand/sun/old.md"], "a sun written before t0 has run out 30h later");
        assert!(f.vault.path("sand/sun/old.md").unwrap().exists(), "nothing leaves before it is shown");

        f.vault.let_go(&["sand/sun/old.md".into()], t0 + Duration::hours(30)).unwrap();
        assert!(!f.vault.path("sand/sun/old.md").unwrap().exists());
    }

    #[test]
    fn sand_that_runs_out_during_a_visit_lets_go_on_its_own() {
        let f = arranged();
        put(&f.vault, "sand/sun/parking.md", "level 3, row F");
        put(&f.vault, "sand/moon/full/later.md", "later");
        put(&f.vault, "sand/breath/b.md", "b");
        put(&f.vault, "stone/kept.md", "kept");
        put(&f.vault, "elsewhere.md", "outside the mandala");
        let t0 = Utc::now();
        f.vault.arrive(t0).unwrap();
        assert!(f.vault.sweep_ran_out(t0).unwrap().is_empty(), "nothing has run out yet");

        let gone = f.vault.sweep_ran_out(t0 + Duration::hours(25)).unwrap();
        let rels: Vec<_> = gone.iter().map(|s| s.rel.as_str()).collect();
        assert_eq!(rels, vec!["sand/sun/parking.md"]);
        assert!(!f.vault.path("sand/sun/parking.md").unwrap().exists());
        for stays in ["sand/moon/full/later.md", "sand/breath/b.md", "stone/kept.md", "elsewhere.md"] {
            assert!(f.vault.path(stays).unwrap().exists(), "{stays} stays");
        }
        let restored = f.vault.restore(&gone[0].id, t0 + Duration::hours(26)).unwrap();
        assert_eq!(restored, "sand/sun/parking.md", "it settles for a day, as any let go");
    }

    #[test]
    fn sand_is_not_swept_while_sync_is_still_bringing_notes_down() {
        let f = arranged();
        put(&f.vault, "sand/sun/a.md", "a");
        let t0 = Utc::now();
        f.vault.arrive(t0).unwrap();
        put(&f.vault, "sand/sun/.other.md.icloud", "");
        assert!(f.vault.sweep_ran_out(t0 + Duration::hours(25)).unwrap().is_empty());
        assert!(f.vault.path("sand/sun/a.md").unwrap().exists());
    }

    #[test]
    fn a_lifespan_changed_on_the_phone_counts_before_the_sweep() {
        let f = arranged();
        put(&f.vault, "sand/moon/full/a.md", "a");
        let t0 = Utc::now();
        f.vault.arrive(t0).unwrap();
        // Moved to a shorter lifespan in Obsidian on the phone.
        std::fs::rename(f.vault.path("sand/moon/full/a.md").unwrap(), f.vault.path("sand/sun/a.md").unwrap()).unwrap();
        let gone = f.vault.sweep_ran_out(t0 + Duration::hours(25)).unwrap();
        assert_eq!(gone.len(), 1, "the shorter lifespan ends it, without waiting for a refresh");
    }

    #[test]
    fn breaths_leave_when_the_visit_ends() {
        let f = arranged();
        let t0 = Utc::now();
        f.vault.arrive(t0).unwrap();
        put(&f.vault, "sand/breath/framer.md", "0161 496 0734");
        put(&f.vault, "sand/sun/stays.md", "stays");
        assert_eq!(f.vault.breaths(t0).unwrap().len(), 1);
        let gone = f.vault.close(t0).unwrap();
        assert_eq!(gone.len(), 1);
        assert!(!f.vault.path("sand/breath/framer.md").unwrap().exists());
        assert!(f.vault.path("sand/sun/stays.md").unwrap().exists());
    }

    #[test]
    fn a_breath_from_a_visit_that_never_closed_leaves_on_the_next_arrival() {
        let f = arranged();
        let t0 = Utc::now();
        f.vault.arrive(t0).unwrap();
        put(&f.vault, "sand/breath/b.md", "b");
        f.vault.breaths(t0).unwrap();
        let mut clock = f.vault.load_clock().unwrap();
        f.vault.reconcile(&mut clock, t0).unwrap();
        f.vault.save_clock(&clock).unwrap();
        // The app crashed: no close.
        let a = f.vault.arrive(t0 + Duration::minutes(5)).unwrap();
        assert_eq!(a.leaving.len(), 1);
        assert_eq!(a.leaving[0].life, Some(Life::Breath));
    }

    #[test]
    fn a_breath_written_on_the_phone_waits_for_the_next_close() {
        let f = arranged();
        let t0 = Utc::now();
        f.vault.arrive(t0).unwrap();
        f.vault.close(t0).unwrap();
        put(&f.vault, "sand/breath/phone.md", "from the phone");
        let a = f.vault.arrive(t0 + Duration::hours(3)).unwrap();
        assert!(a.leaving.is_empty(), "seen for the first time on this visit");
        assert_eq!(a.sand_new.len(), 1);
        assert_eq!(f.vault.close(t0 + Duration::hours(4)).unwrap().len(), 1);
    }
}
