//! The person's own order of stone notes in the rail, set by dragging. (Sand is
//! always soonest-to-leave first, so it has no hand-made order.)
//!
//! Kept in `.mandala/order.json` (a list of paths) so it travels with the
//! vault, and never written into notes. A note not in the list keeps its
//! default place after the ordered ones. A move (`move_into`) carries the
//! note's place to its new path; a path that is gone is simply skipped.

use crate::fsx::write_atomic;
use crate::vault::{Vault, DOT};
use anyhow::Result;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;

impl Vault {
    fn order_path(&self) -> PathBuf {
        self.root().join(DOT).join("order.json")
    }

    /// The saved order, first to last. Empty if none was ever set.
    pub fn order(&self) -> Result<Vec<String>> {
        match fs::read(self.order_path()) {
            Ok(bytes) => Ok(serde_json::from_slice(&bytes).unwrap_or_default()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
            Err(e) => Err(e.into()),
        }
    }

    /// Save a new order. Every path must be inside the vault; repeats are dropped.
    pub fn set_order(&self, rels: &[String]) -> Result<()> {
        let mut seen = HashSet::new();
        let mut clean = Vec::new();
        for rel in rels {
            self.path(rel)?;
            if seen.insert(rel.as_str()) {
                clean.push(rel.clone());
            }
        }
        fs::create_dir_all(self.root().join(DOT))?;
        write_atomic(&self.order_path(), &serde_json::to_vec_pretty(&clean)?)
    }

    /// After a move: the note keeps its place under its new path.
    pub(crate) fn reorder_moved(&self, from: &str, to: &str) -> Result<()> {
        let mut order = self.order()?;
        let Some(i) = order.iter().position(|r| r == from) else { return Ok(()) };
        order[i] = to.to_string();
        self.set_order(&order)
    }
}

/// Sort `items` by `order`, stably: ordered ones first in that order, the
/// rest after, as they were.
pub fn sort_by_order<T>(items: &mut [T], order: &[String], rel: impl Fn(&T) -> &str) {
    let rank: HashMap<&str, usize> = order.iter().enumerate().map(|(i, r)| (r.as_str(), i)).collect();
    items.sort_by_key(|t| rank.get(rel(t)).copied().unwrap_or(usize::MAX));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lifespan::Life;
    use crate::vault::testing::*;
    use chrono::Utc;

    #[test]
    fn sorts_by_the_saved_order_and_keeps_the_rest_after() {
        let mut items = vec!["a", "b", "c", "d"];
        sort_by_order(&mut items, &["c".into(), "a".into(), "gone".into()], |s| s);
        assert_eq!(items, vec!["c", "a", "b", "d"]);
    }

    #[test]
    fn order_is_saved_and_refuses_paths_outside_the_vault() {
        let f = arranged();
        assert!(f.vault.order().unwrap().is_empty());
        f.vault.set_order(&["stone/b.md".into(), "stone/a.md".into(), "stone/b.md".into()]).unwrap();
        assert_eq!(f.vault.order().unwrap(), vec!["stone/b.md", "stone/a.md"]);
        assert!(f.vault.set_order(&["../x.md".into()]).is_err());
    }

    #[test]
    fn a_moved_note_keeps_its_place() {
        let f = arranged();
        let rel = f.vault.new_sand("Note", Life::Sun, Utc::now()).unwrap();
        put(&f.vault, "sand/sun/Other.md", "o");
        f.vault.set_order(&["sand/sun/Other.md".into(), rel.clone()]).unwrap();
        let to = f.vault.set_life(&rel, Life::Breath, Utc::now()).unwrap();
        assert_eq!(f.vault.order().unwrap(), vec!["sand/sun/Other.md".to_string(), to]);
    }
}
