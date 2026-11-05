//! The clock: `.mandala/life.json`, when each grain of sand was written and
//! when it dissolves, plus the visit count.
//!
//! The folder decides the lifespan; the clock only remembers times. It is
//! rebuilt from the vault by `Vault::reconcile`, so losing it costs only the
//! "written" times of notes whose files no longer carry them.

use crate::fsx::write_atomic;
use crate::lifespan::Life;
use anyhow::Result;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Grain {
    pub life: Life,
    pub written: DateTime<Utc>,
    /// `None` for a breath, which leaves at the end of a visit instead.
    pub dissolves: Option<DateTime<Utc>>,
    /// The visit in which Mandala first saw this note.
    pub seen_visit: u64,
    /// The file's inode, to follow it when it is moved (on the phone, say).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ino: Option<u64>,
    /// When the clock last started over (a longer lifespan given in Mandala).
    /// `None`: it runs from `written`, which always stays the real creation time.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started: Option<DateTime<Utc>>,
}

impl Grain {
    pub fn new(life: Life, written: DateTime<Utc>, seen_visit: u64, ino: Option<u64>) -> Grain {
        Grain { life, written, dissolves: life.duration().map(|d| written + d), seen_visit, ino, started: None }
    }

    /// Where the clock counts from.
    pub fn start(&self) -> DateTime<Utc> {
        self.started.unwrap_or(self.written)
    }

    /// The same grain under another lifespan, without extending it: the
    /// earlier of the old and new times wins. Used for every move Mandala did
    /// not ask for (Obsidian on the phone) and for shorter lifespans.
    pub fn relife(&self, life: Life) -> Grain {
        let fresh = life.duration().map(|d| self.start() + d);
        let dissolves = match (self.dissolves, fresh) {
            (Some(old), Some(new)) => Some(old.min(new)),
            (_, new) => new,
        };
        Grain { life, dissolves, ..self.clone() }
    }

    /// The same grain under a longer lifespan, its clock started over now.
    /// Only for a deliberate choice in Mandala (`Vault::set_life`).
    pub fn restart(&self, life: Life, now: DateTime<Utc>) -> Grain {
        Grain { life, started: Some(now), dissolves: life.duration().map(|d| now + d), ..self.clone() }
    }

    pub fn remaining(&self, now: DateTime<Utc>) -> Option<Duration> {
        self.dissolves.map(|d| (d - now).max(Duration::zero()))
    }

    /// 1.0 when its clock starts, 0.0 when it dissolves. A breath is always 1.0.
    pub fn fraction_left(&self, now: DateTime<Utc>) -> f64 {
        match self.dissolves {
            None => 1.0,
            Some(end) => {
                let total = (end - self.start()).num_seconds().max(1) as f64;
                ((end - now).num_seconds() as f64 / total).clamp(0.0, 1.0)
            }
        }
    }

    pub fn has_run_out(&self, now: DateTime<Utc>) -> bool {
        self.dissolves.is_some_and(|d| d <= now)
    }
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Clock {
    /// Incremented at every arrival.
    pub visit: u64,
    pub last_open: Option<DateTime<Utc>>,
    pub last_close: Option<DateTime<Utc>>,
    /// Keyed by the note's path relative to the vault.
    pub grains: BTreeMap<String, Grain>,
}

impl Clock {
    pub fn load(path: &Path) -> Result<Clock> {
        match std::fs::read(path) {
            Ok(bytes) => Ok(serde_json::from_slice(&bytes)?),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Clock::default()),
            Err(e) => Err(e.into()),
        }
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        write_atomic(path, &serde_json::to_vec_pretty(self)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn t(h: i64) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 10, 31, 6, 0, 0).unwrap() + Duration::hours(h)
    }

    #[test]
    fn a_sun_lasts_a_day() {
        let g = Grain::new(Life::Sun, t(0), 1, None);
        assert_eq!(g.dissolves, Some(t(24)));
        assert!(!g.has_run_out(t(23)));
        assert!(g.has_run_out(t(24)));
        assert!((g.fraction_left(t(12)) - 0.5).abs() < 1e-9);
    }

    #[test]
    fn lifespans_shorten_but_never_extend() {
        let moon = Grain::new(Life::Full, t(0), 1, None);
        let shorter = moon.relife(Life::Sun);
        assert_eq!(shorter.dissolves, Some(t(24)));
        let back = shorter.relife(Life::Full);
        assert_eq!(back.dissolves, Some(t(24)), "moving back to a moon must not extend it");
    }

    #[test]
    fn a_breath_has_no_clock() {
        let b = Grain::new(Life::Breath, t(0), 1, None);
        assert_eq!(b.dissolves, None);
        assert!(!b.has_run_out(t(10_000)));
        assert_eq!(b.fraction_left(t(5)), 1.0);
    }

    #[test]
    fn a_missing_clock_is_empty() {
        let dir = tempfile::tempdir().unwrap();
        let c = Clock::load(&dir.path().join("life.json")).unwrap();
        assert_eq!(c.visit, 0);
        assert!(c.grains.is_empty());
    }
}
