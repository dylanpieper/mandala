//! Arranging an existing Obsidian vault as a mandala, in place: everything
//! already written becomes stone, and the sand folders are made.

use crate::fsx::{copy_tree, move_file, write_atomic};
use crate::lifespan::Life;
use crate::vault::{Vault, DOT};
use anyhow::{bail, Result};
use serde::Serialize;
use std::fs;
use std::path::Path;

/// Folders left where they are: attachments are found by name from anywhere.
pub const LEFT_IN_PLACE: &[&str] = &["attachments", "Attachments", "assets", "files"];

#[derive(Clone, Debug, Serialize)]
pub struct Plan {
    /// Top-level names moved under `stone/`.
    pub moves: Vec<String>,
    pub left_in_place: Vec<String>,
    /// Top-level names the person chose to leave outside, as `Elsewhere`:
    /// never swept, and Obsidian sees them as before.
    pub elsewhere: Vec<String>,
    /// Notes in each of `moves`, in the same order.
    pub notes_in: Vec<usize>,
    pub notes: usize,
    /// `[[Folder/Note]]` links whose path must gain `stone/`.
    pub links_to_rewrite: usize,
}

impl Vault {
    pub fn arrange_plan(&self) -> Result<Plan> {
        let mut moves = Vec::new();
        let mut left = Vec::new();
        for entry in fs::read_dir(self.root())? {
            let name = entry?.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') || name == "stone" || name == "sand" {
                continue;
            }
            if LEFT_IN_PLACE.contains(&name.as_str()) {
                left.push(name);
            } else {
                moves.push(name);
            }
        }
        moves.sort();
        left.sort();
        self.plan_for(moves, left, Vec::new())
    }

    /// The plan with only `chosen` moved into `stone/`; every other top-level
    /// name stays where it is, as `Elsewhere`.
    pub fn arrange_plan_only(&self, chosen: &[String]) -> Result<Plan> {
        let all = self.arrange_plan()?;
        let (moves, elsewhere) = all.moves.into_iter().partition(|m| chosen.contains(m));
        self.plan_for(moves, all.left_in_place, elsewhere)
    }

    fn plan_for(&self, moves: Vec<String>, left: Vec<String>, elsewhere: Vec<String>) -> Result<Plan> {
        let notes = self.notes()?;
        let inside = |m: &str| notes.iter().filter(|n| n.rel == m || n.rel.starts_with(&format!("{m}/"))).count();
        let notes_in: Vec<usize> = moves.iter().map(|m| inside(m)).collect();
        let dirs = moved_dirs(self.root(), &moves);
        let mut links = 0;
        for n in &notes {
            links += rewrite_links(&self.read(&n.rel)?, &dirs).1;
        }
        Ok(Plan { notes: notes_in.iter().sum(), notes_in, moves, left_in_place: left, elsewhere, links_to_rewrite: links })
    }

    /// Carry out a plan. With `snapshot`, the whole vault is copied there first.
    pub fn arrange(&self, plan: &Plan, snapshot: Option<&Path>, obsidian_new_notes_to_sand: bool) -> Result<()> {
        if let Some(to) = snapshot {
            if to.starts_with(self.root()) {
                bail!("the snapshot must be outside the vault");
            }
            copy_tree(self.root(), to)?;
        }
        let dirs = moved_dirs(self.root(), &plan.moves);
        for life in Life::ALL {
            fs::create_dir_all(self.root().join(life.folder()))?;
        }
        fs::create_dir_all(self.root().join("stone"))?;
        fs::create_dir_all(self.root().join(DOT))?;
        for name in &plan.moves {
            move_file(&self.root().join(name), &self.root().join("stone").join(name))?;
        }
        for n in self.notes()? {
            let text = self.read(&n.rel)?;
            let (new, count) = rewrite_links(&text, &dirs);
            if count > 0 {
                write_atomic(&self.path(&n.rel)?, new.as_bytes())?;
            }
        }
        if obsidian_new_notes_to_sand {
            self.point_obsidian_at_sand()?;
        }
        Ok(())
    }

    /// Obsidian's "Default location for new notes" → `sand/sun`.
    pub fn point_obsidian_at_sand(&self) -> Result<()> {
        let dir = self.root().join(".obsidian");
        if !dir.is_dir() {
            return Ok(());
        }
        let path = dir.join("app.json");
        let mut app: serde_json::Value = match fs::read(&path) {
            Ok(b) => serde_json::from_slice(&b).unwrap_or_else(|_| serde_json::json!({})),
            Err(_) => serde_json::json!({}),
        };
        if let Some(obj) = app.as_object_mut() {
            obj.insert("newFileLocation".into(), "folder".into());
            obj.insert("newFileFolderPath".into(), Life::Sun.folder().into());
        }
        write_atomic(&path, &serde_json::to_vec_pretty(&app)?)
    }
}

fn moved_dirs(root: &Path, moves: &[String]) -> Vec<String> {
    moves.iter().filter(|m| root.join(m).is_dir() || root.join("stone").join(m).is_dir()).cloned().collect()
}

/// `[[Practice/Note]]` → `[[stone/Practice/Note]]` for each moved folder.
/// Plain `[[Note]]` links need nothing: Obsidian finds them by name.
fn rewrite_links(text: &str, dirs: &[String]) -> (String, usize) {
    let mut out = text.to_string();
    let mut count = 0;
    for d in dirs {
        let from = format!("[[{d}/");
        let to = format!("[[stone/{d}/");
        count += out.matches(&from).count();
        out = out.replace(&from, &to);
    }
    (out, count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault::testing::put;

    fn plain_vault() -> (tempfile::TempDir, tempfile::TempDir, Vault) {
        let root = tempfile::tempdir().unwrap();
        let state = tempfile::tempdir().unwrap();
        let v = Vault::open(root.path(), state.path()).unwrap();
        (root, state, v)
    }

    #[test]
    fn everything_written_becomes_stone() {
        let (_r, _s, v) = plain_vault();
        put(&v, "Practice/Impermanence.md", "See [[Reading/Ryokan]] and [[Inbox]].");
        put(&v, "Reading/Ryokan.md", "The moon at my window.");
        put(&v, "Inbox.md", "inbox");
        put(&v, "attachments/x.md", "");
        put(&v, ".obsidian/app.json", "{\"spellcheck\": true}");
        assert!(!v.is_arranged());

        let plan = v.arrange_plan().unwrap();
        assert_eq!(plan.moves, vec!["Inbox.md", "Practice", "Reading"]);
        assert_eq!(plan.left_in_place, vec!["attachments"]);
        assert_eq!(plan.notes, 3);
        assert_eq!(plan.links_to_rewrite, 1);

        let snap = tempfile::tempdir().unwrap();
        v.arrange(&plan, Some(&snap.path().join("before")), true).unwrap();
        assert!(v.is_arranged());
        assert_eq!(v.read("stone/Practice/Impermanence.md").unwrap(), "See [[stone/Reading/Ryokan]] and [[Inbox]].");
        assert!(v.path("stone/Inbox.md").unwrap().exists());
        assert!(v.path("attachments/x.md").unwrap().exists());
        assert!(v.root().join("sand/moon/quarter").is_dir());
        assert!(snap.path().join("before/Practice/Impermanence.md").exists(), "snapshot taken first");

        let app: serde_json::Value =
            serde_json::from_slice(&fs::read(v.root().join(".obsidian/app.json")).unwrap()).unwrap();
        assert_eq!(app["newFileFolderPath"], "sand/sun");
        assert_eq!(app["spellcheck"], true, "other Obsidian settings are kept");
    }

    #[test]
    fn only_chosen_folders_become_stone_the_rest_stay_elsewhere() {
        let (_r, _s, v) = plain_vault();
        put(&v, "Practice/Impermanence.md", "See [[Reading/Ryokan]] and [[Work/Plan]].");
        put(&v, "Reading/Ryokan.md", "The moon at my window.");
        put(&v, "Work/Plan.md", "plan");
        put(&v, "Work/Notes.md", "notes");

        let plan = v.arrange_plan_only(&["Practice".into(), "Reading".into()]).unwrap();
        assert_eq!(plan.moves, vec!["Practice", "Reading"]);
        assert_eq!(plan.elsewhere, vec!["Work"]);
        assert_eq!(plan.notes_in, vec![1, 1]);
        assert_eq!(plan.notes, 2);
        assert_eq!(plan.links_to_rewrite, 1, "only links into moved folders change");

        v.arrange(&plan, None, false).unwrap();
        assert!(v.path("stone/Practice/Impermanence.md").unwrap().exists());
        assert!(v.path("Work/Plan.md").unwrap().exists(), "left where it was");
        assert_eq!(v.read("stone/Practice/Impermanence.md").unwrap(), "See [[stone/Reading/Ryokan]] and [[Work/Plan]].");
        let place = crate::lifespan::place_of("Work/Plan.md");
        assert_eq!(place, crate::lifespan::Place::Elsewhere, "never swept");
    }

    #[test]
    fn a_snapshot_inside_the_vault_is_refused() {
        let (_r, _s, v) = plain_vault();
        let plan = v.arrange_plan().unwrap();
        assert!(v.arrange(&plan, Some(&v.root().join("snap")), false).is_err());
    }
}
