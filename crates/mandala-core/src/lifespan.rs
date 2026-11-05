//! Lifespans, and where a note sits.
//!
//! The folder is the lifespan: `sand/breath/`, `sand/sun/`,
//! `sand/moon/quarter|half|full/`. A note anywhere under `stone/` is kept.
//! Anything else is `Elsewhere` and is never swept.

use chrono::Duration;
use serde::{Deserialize, Serialize};

/// One synodic month, new moon to new moon: 29.53 days.
pub const SYNODIC_MONTH_SECS: i64 = 2_551_443;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Life {
    /// Until the end of the visit in which Mandala first sees it.
    Breath,
    /// 24 hours.
    Sun,
    /// A quarter of a moon, about 7.4 days.
    Quarter,
    /// Half a moon, about 14.8 days.
    Half,
    /// A full moon, 29.5 days.
    Full,
}

impl Life {
    pub const ALL: [Life; 5] = [Life::Breath, Life::Sun, Life::Quarter, Life::Half, Life::Full];

    /// Shortest first: a breath (ends with the visit), a sun, then the moons.
    pub fn rank(self) -> usize {
        Life::ALL.iter().position(|l| *l == self).unwrap_or(0)
    }

    /// How long it lasts from when it was written. A breath has no clock.
    pub fn duration(self) -> Option<Duration> {
        match self {
            Life::Breath => None,
            Life::Sun => Some(Duration::hours(24)),
            Life::Quarter => Some(Duration::seconds(SYNODIC_MONTH_SECS / 4)),
            Life::Half => Some(Duration::seconds(SYNODIC_MONTH_SECS / 2)),
            Life::Full => Some(Duration::seconds(SYNODIC_MONTH_SECS)),
        }
    }

    /// The folder, relative to the vault, that gives a note this lifespan.
    pub fn folder(self) -> &'static str {
        match self {
            Life::Breath => "sand/breath",
            Life::Sun => "sand/sun",
            Life::Quarter => "sand/moon/quarter",
            Life::Half => "sand/moon/half",
            Life::Full => "sand/moon/full",
        }
    }

    /// As the window says it: "a sun", "a quarter moon".
    pub fn label(self) -> &'static str {
        match self {
            Life::Breath => "a breath",
            Life::Sun => "a sun",
            Life::Quarter => "a quarter moon",
            Life::Half => "a half moon",
            Life::Full => "a full moon",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "life", rename_all = "lowercase")]
pub enum Place {
    Stone,
    Sand(Life),
    Elsewhere,
}

/// Where a note sits, from its path relative to the vault (`/` separators).
///
/// A note directly in `sand/`, or in a folder under it that names no
/// lifespan, is a sun: the default. One directly in `sand/moon/` is a full moon.
pub fn place_of(rel: &str) -> Place {
    let parts: Vec<&str> = rel.split('/').collect();
    if parts.len() < 2 {
        return Place::Elsewhere;
    }
    match parts.as_slice() {
        ["stone", ..] => Place::Stone,
        ["sand", "breath", _, ..] => Place::Sand(Life::Breath),
        ["sand", "sun", _, ..] => Place::Sand(Life::Sun),
        ["sand", "moon", "quarter", _, ..] => Place::Sand(Life::Quarter),
        ["sand", "moon", "half", _, ..] => Place::Sand(Life::Half),
        ["sand", "moon", _, ..] => Place::Sand(Life::Full),
        ["sand", ..] => Place::Sand(Life::Sun),
        _ => Place::Elsewhere,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folders_name_lifespans() {
        assert_eq!(place_of("stone/Practice/Impermanence.md"), Place::Stone);
        assert_eq!(place_of("sand/breath/x.md"), Place::Sand(Life::Breath));
        assert_eq!(place_of("sand/sun/x.md"), Place::Sand(Life::Sun));
        assert_eq!(place_of("sand/moon/quarter/x.md"), Place::Sand(Life::Quarter));
        assert_eq!(place_of("sand/moon/half/x.md"), Place::Sand(Life::Half));
        assert_eq!(place_of("sand/moon/full/x.md"), Place::Sand(Life::Full));
    }

    #[test]
    fn loose_sand_has_defaults() {
        assert_eq!(place_of("sand/x.md"), Place::Sand(Life::Sun));
        assert_eq!(place_of("sand/ideas/x.md"), Place::Sand(Life::Sun));
        assert_eq!(place_of("sand/moon/x.md"), Place::Sand(Life::Full));
    }

    #[test]
    fn everything_else_is_never_swept() {
        assert_eq!(place_of("Inbox.md"), Place::Elsewhere);
        assert_eq!(place_of("attachments/x.md"), Place::Elsewhere);
        assert_eq!(place_of("stone.md"), Place::Elsewhere);
    }

    #[test]
    fn moons_divide_the_month() {
        let full = Life::Full.duration().unwrap().num_seconds();
        assert_eq!(Life::Half.duration().unwrap().num_seconds(), full / 2);
        assert_eq!(Life::Quarter.duration().unwrap().num_seconds(), full / 4);
        assert!(Life::Breath.duration().is_none());
        for life in Life::ALL {
            assert_eq!(place_of(&format!("{}/n.md", life.folder())), Place::Sand(life));
        }
    }
}
