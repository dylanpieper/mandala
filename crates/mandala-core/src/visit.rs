//! A visit: arriving, and closing.
//!
//! Mandala only runs when it is open, so arriving is when time catches up:
//! once sync has brought every note down, what ran out while Mandala was
//! closed settles. Closing is when breaths leave. Nothing is deleted: each
//! note settles for a day, and the window names what left, with Restore.

use crate::clock::Clock;
use crate::lifespan::Life;
use crate::settle::{Reason, Settled};
use crate::vault::Vault;
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct NoteRef {
    pub rel: String,
    pub title: String,
    pub life: Option<Life>,
    pub written: Option<DateTime<Utc>>,
    pub dissolves: Option<DateTime<Utc>>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Arrival {
    pub visit: u64,
    /// When the last visit ended (or began, if it never closed).
    pub since: Option<DateTime<Utc>>,
    /// What left since the last visit, oldest first: the breaths that settled
    /// when it closed, and the sand that ran out while Mandala was closed,
    /// which settles now. Each can be restored for a day.
    pub left: Vec<Settled>,
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

    /// Begin a visit, before any note is written in it. The window calls this
    /// once sync has nothing pending. If sync still has notes to bring down,
    /// nothing settles now: timed sand waits for `sweep_ran_out`, and a breath
    /// left from a visit that never closed waits for this visit's close.
    pub fn arrive(&self, now: DateTime<Utc>) -> Result<Arrival> {
        let mut clock = self.load_clock()?;
        let since = clock.last_close.or(clock.last_open);
        // Breaths settle as a visit closes: name them here, where the person
        // sees them. Only if the last visit did close, so they are named once.
        let closed = clock.last_close.filter(|c| clock.last_open.is_none_or(|o| o <= *c));
        let mut left: Vec<Settled> = match closed {
            Some(closed) => self.settling()?.into_iter().filter(|s| s.reason == Reason::Swept && s.at >= closed).collect(),
            None => Vec::new(),
        };
        clock.visit += 1;
        clock.last_open = Some(now);
        self.reconcile(&mut clock, now)?;
        if self.pending_downloads() == 0 {
            for rel in ran_out_at_arrival(&clock, now) {
                left.push(self.settle(&rel, Reason::Swept, now)?);
            }
            self.reconcile(&mut clock, now)?;
        }
        left.sort_by_key(|s| s.at);
        self.remember_all()?;
        self.purge(now)?;
        self.save_clock(&clock)?;
        Ok(Arrival { visit: clock.visit, since, left })
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

    /// End the visit: breaths leave (to settle for a day). The next arrival names them.
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

/// What ran out while Mandala was closed: timed sand past its time, and
/// breaths left over from a visit that never closed.
fn ran_out_at_arrival(clock: &Clock, now: DateTime<Utc>) -> Vec<String> {
    clock
        .grains
        .iter()
        .filter(|(_, g)| g.has_run_out(now) || (g.life == Life::Breath && g.seen_visit < clock.visit))
        .map(|(r, _)| r.clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault::testing::*;
    use chrono::Duration;

    fn rels(left: &[Settled]) -> Vec<&str> {
        left.iter().map(|s| s.rel.as_str()).collect()
    }

    #[test]
    fn first_arrival_lets_nothing_go() {
        let f = arranged();
        put(&f.vault, "stone/a.md", "a");
        put(&f.vault, "sand/sun/b.md", "b");
        let a = f.vault.arrive(Utc::now()).unwrap();
        assert_eq!(a.visit, 1);
        assert!(a.left.is_empty());
        assert!(f.vault.path("sand/sun/b.md").unwrap().exists());
    }

    #[test]
    fn sand_that_ran_out_while_closed_settles_on_arrival_and_is_named() {
        let f = arranged();
        put(&f.vault, "sand/sun/old.md", "old");
        put(&f.vault, "sand/moon/full/later.md", "later");
        let t0 = Utc::now();
        f.vault.arrive(t0).unwrap();
        f.vault.close(t0).unwrap();

        let a = f.vault.arrive(t0 + Duration::hours(30)).unwrap();
        assert_eq!(rels(&a.left), vec!["sand/sun/old.md"], "a sun written before t0 has run out 30h later");
        assert!(!f.vault.path("sand/sun/old.md").unwrap().exists());
        assert!(f.vault.path("sand/moon/full/later.md").unwrap().exists());
        let back = f.vault.restore(&a.left[0].id, t0 + Duration::hours(31)).unwrap();
        assert_eq!(back, "sand/sun/old.md", "it settles for a day, as any let go");
    }

    #[test]
    fn nothing_settles_on_arrival_while_sync_is_still_bringing_notes_down() {
        let f = arranged();
        put(&f.vault, "sand/sun/a.md", "a");
        let t0 = Utc::now();
        f.vault.arrive(t0).unwrap();
        f.vault.close(t0).unwrap();
        put(&f.vault, "sand/sun/.other.md.icloud", "");
        let a = f.vault.arrive(t0 + Duration::hours(30)).unwrap();
        assert!(a.left.is_empty());
        assert!(f.vault.path("sand/sun/a.md").unwrap().exists());
    }

    #[test]
    fn breaths_leave_when_the_visit_ends_and_the_next_arrival_names_them() {
        let f = arranged();
        let t0 = Utc::now();
        f.vault.arrive(t0).unwrap();
        put(&f.vault, "sand/breath/framer.md", "0161 496 0734");
        put(&f.vault, "sand/sun/stays.md", "stays");
        let gone = f.vault.close(t0).unwrap();
        assert_eq!(gone.len(), 1);
        assert!(!f.vault.path("sand/breath/framer.md").unwrap().exists());
        assert!(f.vault.path("sand/sun/stays.md").unwrap().exists());

        let a = f.vault.arrive(t0 + Duration::hours(1)).unwrap();
        assert_eq!(rels(&a.left), vec!["sand/breath/framer.md"]);
        let again = f.vault.arrive(t0 + Duration::hours(2)).unwrap();
        assert!(again.left.is_empty(), "named once: this visit never closed, so there is nothing new");
    }

    #[test]
    fn a_note_let_go_during_the_visit_is_not_named_again() {
        let f = arranged();
        let t0 = Utc::now();
        f.vault.arrive(t0).unwrap();
        put(&f.vault, "sand/sun/x.md", "x");
        f.vault.delete("sand/sun/x.md", t0).unwrap();
        f.vault.close(t0 + Duration::minutes(1)).unwrap();
        let a = f.vault.arrive(t0 + Duration::hours(1)).unwrap();
        assert!(a.left.is_empty());
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
        assert_eq!(rels(&gone), vec!["sand/sun/parking.md"]);
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
    fn a_breath_from_a_visit_that_never_closed_leaves_on_the_next_arrival() {
        let f = arranged();
        let t0 = Utc::now();
        f.vault.arrive(t0).unwrap();
        put(&f.vault, "sand/breath/b.md", "b");
        let mut clock = f.vault.load_clock().unwrap();
        f.vault.reconcile(&mut clock, t0).unwrap();
        f.vault.save_clock(&clock).unwrap();
        // The app crashed: no close.
        let a = f.vault.arrive(t0 + Duration::minutes(5)).unwrap();
        assert_eq!(rels(&a.left), vec!["sand/breath/b.md"]);
        assert!(!f.vault.path("sand/breath/b.md").unwrap().exists());
    }

    #[test]
    fn a_breath_written_on_the_phone_waits_for_the_next_close() {
        let f = arranged();
        let t0 = Utc::now();
        f.vault.arrive(t0).unwrap();
        f.vault.close(t0).unwrap();
        put(&f.vault, "sand/breath/phone.md", "from the phone");
        let a = f.vault.arrive(t0 + Duration::hours(3)).unwrap();
        assert!(a.left.is_empty(), "seen for the first time on this visit");
        assert_eq!(f.vault.close(t0 + Duration::hours(4)).unwrap().len(), 1);
    }
}
