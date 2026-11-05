//! Combining two notes into one: drag a note onto another, see them woven,
//! change anything, combine. The note dropped on keeps its place, lifespan
//! and name, and gets the text. The dragged note settles for a day, as
//! anything let go, so it can be restored.
//!
//! `weave` lines the two notes up: lines they share appear once, and lines
//! only one has stay where they were, in order. Where both have their own
//! lines in the same place, the note dropped on comes first.

use crate::lifespan::{place_of, Place};
use crate::settle::{Reason, Settled};
use crate::vault::Vault;
use anyhow::{bail, Result};
use chrono::{DateTime, Utc};
use serde::Serialize;

/// Where a woven line came from.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum From {
    Both,
    /// The note dropped on.
    Into,
    /// The note dragged.
    Dragged,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Line {
    pub text: String,
    pub from: From,
}

/// Above this many line pairs the lining-up is skipped, and the dragged
/// note's own lines follow the other's (still each line once).
const MAX_CELLS: usize = 4_000_000;

/// The two notes woven into one, line by line.
pub fn weave(into: &str, dragged: &str) -> Vec<Line> {
    let a: Vec<&str> = into.lines().collect();
    let b: Vec<&str> = dragged.lines().collect();
    let line = |text: &str, from| Line { text: text.to_string(), from };
    if a.len() * b.len() > MAX_CELLS {
        let mut out: Vec<Line> = a.iter().map(|l| line(l, From::Into)).collect();
        let seen: std::collections::HashSet<&str> = a.iter().copied().collect();
        out.extend(b.iter().filter(|l| !seen.contains(*l)).map(|l| line(l, From::Dragged)));
        return out;
    }
    // Longest common lines, from the end, so the walk below goes forward.
    let (n, m) = (a.len(), b.len());
    let mut lcs = vec![0u32; (n + 1) * (m + 1)];
    let at = |i: usize, j: usize| i * (m + 1) + j;
    for i in (0..n).rev() {
        for j in (0..m).rev() {
            lcs[at(i, j)] = if a[i] == b[j] { lcs[at(i + 1, j + 1)] + 1 } else { lcs[at(i + 1, j)].max(lcs[at(i, j + 1)]) };
        }
    }
    let mut out = Vec::with_capacity(n.max(m));
    let (mut i, mut j) = (0, 0);
    // Lines only one note has, gathered until the next shared line, so the
    // note dropped on comes first in each place.
    let mut mine: Vec<Line> = Vec::new();
    let mut theirs: Vec<Line> = Vec::new();
    let flush = |out: &mut Vec<Line>, mine: &mut Vec<Line>, theirs: &mut Vec<Line>| {
        out.append(mine);
        out.append(theirs);
    };
    while i < n || j < m {
        if i < n && j < m && a[i] == b[j] {
            flush(&mut out, &mut mine, &mut theirs);
            out.push(line(a[i], From::Both));
            i += 1;
            j += 1;
        } else if j >= m || (i < n && lcs[at(i + 1, j)] >= lcs[at(i, j + 1)]) {
            mine.push(line(a[i], From::Into));
            i += 1;
        } else {
            theirs.push(line(b[j], From::Dragged));
            j += 1;
        }
    }
    flush(&mut out, &mut mine, &mut theirs);
    out
}

/// The woven text, as one note.
pub fn woven_text(lines: &[Line], into: &str) -> String {
    let mut text = lines.iter().map(|l| l.text.as_str()).collect::<Vec<_>>().join("\n");
    if into.ends_with('\n') || into.is_empty() {
        text.push('\n');
    }
    text
}

impl Vault {
    /// Combine `dragged` into `into`: `into` gets `text`, and `dragged`
    /// settles for a day. A carving goes with the text if `into` has none.
    pub fn combine(&self, into: &str, dragged: &str, text: &str, now: DateTime<Utc>) -> Result<Settled> {
        if into == dragged {
            bail!("a note cannot be combined with itself");
        }
        for rel in [into, dragged] {
            if place_of(rel) == Place::Elsewhere || !self.path(rel)?.is_file() {
                bail!("{rel} is not a note in the mandala");
            }
        }
        self.write(into, text)?;
        if let Some(c) = self.carving(dragged)? {
            if self.carving(into)?.is_none() && place_of(into) == Place::Stone {
                self.carve(into, &c.text, now)?;
            }
        }
        let settled = self.settle(dragged, Reason::Combined, now)?;
        let mut clock = self.load_clock()?;
        clock.grains.remove(dragged);
        self.save_clock(&clock)?;
        Ok(settled)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault::testing::*;

    fn text(lines: &[Line]) -> Vec<&str> {
        lines.iter().map(|l| l.text.as_str()).collect()
    }

    #[test]
    fn shared_lines_once_and_each_notes_own_in_place() {
        let into = "# Walking\n\nSlow.\nThen slower.\nHome.";
        let dragged = "# Walking\n\nBarefoot.\nSlow.\nHome.\nTea.";
        let w = weave(into, dragged);
        assert_eq!(text(&w), vec!["# Walking", "", "Barefoot.", "Slow.", "Then slower.", "Home.", "Tea."]);
        assert_eq!(w[0].from, From::Both);
        assert_eq!(w[2].from, From::Dragged);
        assert_eq!(w[4].from, From::Into);
    }

    #[test]
    fn in_the_same_place_the_note_dropped_on_comes_first() {
        let w = weave("a\nmine\nz", "a\ntheirs\nz");
        assert_eq!(text(&w), vec!["a", "mine", "theirs", "z"]);
    }

    #[test]
    fn the_same_note_weaves_to_itself_and_empty_takes_the_other() {
        let n = "one\ntwo\n";
        assert_eq!(woven_text(&weave(n, n), n), n);
        assert_eq!(text(&weave("", "x\ny")), vec!["x", "y"]);
    }

    #[test]
    fn combining_writes_into_one_and_lets_the_other_rest() {
        let f = arranged();
        put(&f.vault, "stone/Walking.md", "# Walking\n\nSlow.\n");
        put(&f.vault, "sand/sun/Barefoot.md", "# Barefoot\n\nOn the deck.\n");
        f.vault.refresh(Utc::now()).unwrap();
        f.vault.carve("stone/Walking.md", "", Utc::now()).unwrap();

        let s = f.vault.combine("stone/Walking.md", "sand/sun/Barefoot.md", "# Walking\n\nSlow.\nOn the deck.\n", Utc::now()).unwrap();
        assert_eq!(f.vault.read("stone/Walking.md").unwrap(), "# Walking\n\nSlow.\nOn the deck.\n");
        assert!(!f.vault.path("sand/sun/Barefoot.md").unwrap().exists());
        assert!(!f.vault.load_clock().unwrap().grains.contains_key("sand/sun/Barefoot.md"));
        f.vault.restore(&s.id, Utc::now()).unwrap();
        assert!(f.vault.path("sand/sun/Barefoot.md").unwrap().exists(), "restorable for a day");
        assert!(f.vault.combine("stone/Walking.md", "stone/Walking.md", "x", Utc::now()).is_err());
    }
}
