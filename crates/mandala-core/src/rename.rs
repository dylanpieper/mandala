//! A note's file name follows its first heading, while the two agree.
//!
//! When the person leaves a note whose name matched its heading when it was
//! opened, and the heading has changed, the file is renamed to match, and
//! every link to it is rewritten, as Obsidian does when it renames. A name
//! that differs from the heading (renamed on the phone, or chosen on purpose)
//! is the person's, and is never changed.
//!
//! The sync stays whole: nothing is renamed while sync is still bringing
//! notes down, while a linking note was changed in the last minute (the phone
//! may be mid-edit), while an `Elsewhere` note links to it (Mandala does not
//! write there), or while a link could mean two notes. A journal in the state
//! folder lets an interrupted rename finish at the next open.

use crate::fsx::{file_stem_for, rel_of, unique_path, write_atomic};
use crate::lifespan::{place_of, Place};
use crate::vault::Vault;
use anyhow::{bail, Context, Result};
use chrono::{DateTime, Duration, Utc};
use regex::{Captures, Regex};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::LazyLock;

/// A rename that was made: the note's old and new paths, and the notes whose links changed.
#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct Renamed {
    pub from: String,
    pub to: String,
    pub linked: Vec<String>,
}

/// Why a rename waits for the next time the note is left.
#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(tag = "kind", content = "rel", rename_all = "lowercase")]
pub enum Held {
    /// Sync is still bringing notes down.
    Syncing,
    /// A note that links here changed in the last minute.
    Busy(String),
    /// A note outside the mandala links here; Mandala does not write there.
    Elsewhere(String),
    /// Another note has the same name, and a link could mean either.
    Ambiguous(String),
}

/// What leaving a note did to its name.
#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Follow {
    /// The name already matches the heading, or there is no heading.
    Same,
    /// The name did not match the heading when the note was opened: it is the person's.
    Unlinked,
    Renamed(Renamed),
    Held { held: Held },
}

/// A rename begun and not yet finished, kept in the state folder.
#[derive(Serialize, Deserialize)]
struct Journal {
    from: String,
    to: String,
}

/// How recently a linking note may have changed before a rename waits.
const BUSY_SECONDS: i64 = 60;

/// The first `# heading` of a note, with its markdown marks taken out.
pub fn heading_of(text: &str) -> Option<String> {
    static MARKS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\[\[([^\]|]*\|)?([^\]]*)\]\]|\[([^\]]*)\]\([^)]*\)|[*_~`]").unwrap());
    let line = text.lines().find(|l| !l.trim().is_empty())?;
    let h = line.strip_prefix("# ")?.trim();
    let plain = MARKS.replace_all(h, |c: &Captures| c.get(2).or(c.get(3)).map(|m| m.as_str().to_string()).unwrap_or_default());
    let plain = plain.trim();
    (!plain.is_empty()).then(|| plain.to_string())
}

/// A heading made safe as a file name that Obsidian can link to.
pub fn stem_for_heading(heading: &str) -> String {
    let cleaned: String = heading.chars().filter(|c| !matches!(c, '[' | ']' | '#' | '^' | '|')).collect();
    file_stem_for(&cleaned.split_whitespace().collect::<Vec<_>>().join(" "))
}

fn stem_of(rel: &str) -> &str {
    let name = rel.rsplit('/').next().unwrap_or(rel);
    name.strip_suffix(".md").unwrap_or(name)
}

/// A name without the ` (1)`, ` (2)`… that sets it apart from another note's.
fn base_of(stem: &str) -> &str {
    static NTH: LazyLock<Regex> = LazyLock::new(|| Regex::new(r" \(\d+\)$").unwrap());
    NTH.find(stem).map(|m| &stem[..m.start()]).unwrap_or(stem)
}

/// Whether a file name matches a heading's name: the same, or the same with a ` (n)`.
fn matches_heading(stem: &str, heading_stem: &str) -> bool {
    stem == heading_stem || base_of(stem) == heading_stem
}

fn dir_of(rel: &str) -> &str {
    rel.rsplit_once('/').map(|(d, _)| d).unwrap_or("")
}

/// Whether a link's path (no `.md`) means the note at `rel`, as Obsidian
/// resolves it: the whole path, or its end (`Name`, `Folder/Name`).
fn points_at(link: &str, rel: &str) -> bool {
    let link = link.trim().trim_start_matches('/').to_lowercase();
    let link = link.strip_suffix(".md").unwrap_or(&link);
    let here = rel.strip_suffix(".md").unwrap_or(rel).to_lowercase();
    !link.is_empty() && (here == link || here.ends_with(&format!("/{link}")))
}

static WIKI: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(!?)\[\[([^\]\|#\^\n]+)((?:[#\^|][^\]\n]*)?)\]\]").unwrap());
static MDLINK: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(\]\()([^)\s]+?\.md)(\))").unwrap());

/// Every link in `text` that means the note at `rel`, with the folder of the
/// note that holds it (`from_dir`), for markdown links, which are relative.
fn md_target(path: &str, from_dir: &str) -> String {
    let decoded = path.replace("%20", " ");
    if let Some(abs) = decoded.strip_prefix('/') {
        return abs.to_string();
    }
    let mut parts: Vec<&str> = if from_dir.is_empty() { Vec::new() } else { from_dir.split('/').collect() };
    for seg in decoded.split('/') {
        match seg {
            "." | "" => {}
            ".." => {
                parts.pop();
            }
            s => parts.push(s),
        }
    }
    parts.join("/")
}

/// Run `f` over the lines of `text` that are not inside fenced code.
fn outside_code(text: &str, mut f: impl FnMut(&str) -> String) -> String {
    let mut fenced = false;
    let mut out = String::with_capacity(text.len());
    for (i, line) in text.split('\n').enumerate() {
        if i > 0 {
            out.push('\n');
        }
        if line.trim_start().starts_with("```") || line.trim_start().starts_with("~~~") {
            fenced = !fenced;
            out.push_str(line);
        } else if fenced {
            out.push_str(line);
        } else {
            out.push_str(&f(line));
        }
    }
    out
}

/// Links in `text` (a note in `from_dir`) that mean the note at `rel`, rewritten
/// to `new_stem`. Alias, heading, block, path form and `.md` are kept.
pub fn relink(text: &str, from_dir: &str, rel: &str, new_stem: &str) -> (String, usize) {
    let mut count = 0;
    let out = outside_code(text, |line| {
        let line = WIKI.replace_all(line, |c: &Captures| {
            let target = &c[2];
            if !points_at(target, rel) {
                return c[0].to_string();
            }
            count += 1;
            let ext = if target.trim().to_lowercase().ends_with(".md") { ".md" } else { "" };
            let prefix = target.trim().rsplit_once('/').map(|(p, _)| format!("{p}/")).unwrap_or_default();
            format!("{}[[{prefix}{new_stem}{ext}{}]]", &c[1], &c[3])
        });
        MDLINK
            .replace_all(&line, |c: &Captures| {
                let path = &c[2];
                if path.contains("://") || !points_at(&md_target(path, from_dir), rel) {
                    return c[0].to_string();
                }
                count += 1;
                let prefix = path.rsplit_once('/').map(|(p, _)| format!("{p}/")).unwrap_or_default();
                format!("{}{prefix}{}.md{}", &c[1], new_stem.replace(' ', "%20"), &c[3])
            })
            .into_owned()
    });
    (out, count)
}

/// Every link target in `text`, outside fenced code (wikilinks, and markdown links to `.md` files).
fn targets(text: &str, from_dir: &str) -> Vec<String> {
    let mut out = Vec::new();
    outside_code(text, |line| {
        out.extend(WIKI.captures_iter(line).map(|c| c[2].to_string()));
        out.extend(MDLINK.captures_iter(line).filter(|c| !c[2].contains("://")).map(|c| md_target(&c[2], from_dir)));
        line.to_string()
    });
    out
}

impl Vault {
    fn journal_path(&self) -> std::path::PathBuf {
        self.state_dir().join("renaming.json")
    }

    /// Leaving a note: if its name matched its heading when it was opened
    /// (`opened`, its text then), follow the heading it has now.
    pub fn follow_heading(&self, rel: &str, opened: &str, now: DateTime<Utc>) -> Result<Follow> {
        if !matches!(place_of(rel), Place::Stone | Place::Sand(_)) {
            return Ok(Follow::Unlinked);
        }
        let current = stem_of(rel);
        let was = heading_of(opened).map(|h| stem_for_heading(&h));
        if !was.is_some_and(|w| matches_heading(current, &w)) {
            return Ok(Follow::Unlinked);
        }
        let Some(heading) = heading_of(&self.read(rel)?) else { return Ok(Follow::Same) };
        let want = stem_for_heading(&heading);
        if matches_heading(current, &want) {
            return Ok(Follow::Same);
        }
        if let Some(why) = self.rename_held(rel, now)? {
            return Ok(Follow::Held { held: why });
        }
        Ok(Follow::Renamed(self.rename_note(rel, &want)?))
    }

    /// Rename a note to a title typed for it: a note with no heading, whose
    /// file name is its title (as Obsidian shows it). No heading is written.
    /// It waits as `follow_heading` does.
    pub fn rename_to(&self, rel: &str, title: &str, now: DateTime<Utc>) -> Result<Follow> {
        if !matches!(place_of(rel), Place::Stone | Place::Sand(_)) {
            return Ok(Follow::Unlinked);
        }
        let want = stem_for_heading(title);
        if title.trim().is_empty() || matches_heading(stem_of(rel), &want) {
            return Ok(Follow::Same);
        }
        if let Some(why) = self.rename_held(rel, now)? {
            return Ok(Follow::Held { held: why });
        }
        Ok(Follow::Renamed(self.rename_note(rel, &want)?))
    }

    /// Why renaming the note at `rel` must wait, if it must.
    fn rename_held(&self, rel: &str, now: DateTime<Utc>) -> Result<Option<Held>> {
        if self.pending_downloads() > 0 {
            return Ok(Some(Held::Syncing));
        }
        let name = stem_of(rel).to_lowercase();
        let others: Vec<String> = self.notes()?.into_iter().map(|n| n.rel).filter(|r| r != rel && stem_of(r).to_lowercase() == name).collect();
        for n in self.notes()? {
            if n.rel == rel {
                continue;
            }
            let text = self.read(&n.rel)?;
            let links = targets(&text, dir_of(&n.rel));
            if !links.iter().any(|l| points_at(l, rel)) {
                continue;
            }
            if n.place == Place::Elsewhere {
                return Ok(Some(Held::Elsewhere(n.rel)));
            }
            // Changed in the last minute, and not by Mandala (its own saves are
            // what it last saw): an edit from elsewhere, perhaps still syncing.
            if now - n.modified < Duration::seconds(BUSY_SECONDS) && fs::read_to_string(self.base_path(&n.rel)).ok().as_deref() != Some(text.as_str()) {
                return Ok(Some(Held::Busy(n.rel)));
            }
            if links.iter().any(|l| points_at(l, rel) && others.iter().any(|o| points_at(l, o))) {
                return Ok(Some(Held::Ambiguous(n.rel)));
            }
        }
        Ok(None)
    }

    /// A name for `stem` that no other note in the vault has (Obsidian finds
    /// `[[Name]]` anywhere), in the folder of `rel`.
    fn free_name(&self, rel: &str, stem: &str) -> Result<String> {
        let taken: Vec<String> = self.notes()?.into_iter().filter(|n| n.rel != rel).map(|n| stem_of(&n.rel).to_lowercase()).collect();
        let dir = self.path(dir_of(rel))?;
        let free = |s: &str| !taken.contains(&s.to_lowercase());
        // Only the case changes: the same file, so no other name is needed.
        if stem.eq_ignore_ascii_case(stem_of(rel)) && free(stem) {
            return Ok(stem.to_string());
        }
        let mut n = 0;
        loop {
            let s = if n == 0 { stem.to_string() } else { format!("{stem} ({n})") };
            let path = unique_path(&dir, &s, "md");
            let got = path.file_stem().map(|x| x.to_string_lossy().into_owned()).unwrap_or_default();
            if got == s && free(&s) {
                return Ok(s);
            }
            n += 1;
        }
    }

    /// Rename the note at `rel` to `stem` in its own folder, and rewrite
    /// every link to it. Also how a rename is undone.
    pub fn rename_note(&self, rel: &str, stem: &str) -> Result<Renamed> {
        if !matches!(place_of(rel), Place::Stone | Place::Sand(_)) {
            bail!("{rel} is outside the mandala");
        }
        let stem = self.free_name(rel, &stem_for_heading(stem))?;
        let dir = dir_of(rel);
        let to = if dir.is_empty() { format!("{stem}.md") } else { format!("{dir}/{stem}.md") };
        if to == rel {
            return Ok(Renamed { from: rel.into(), to, linked: Vec::new() });
        }
        // First the journal, so an interrupted rename can be finished.
        write_atomic(&self.journal_path(), &serde_json::to_vec(&Journal { from: rel.into(), to: to.clone() })?)?;
        let from_path = self.path(rel)?;
        let to_path = self.path(&to)?;
        if to.eq_ignore_ascii_case(rel) {
            // Only the case changes: through a passing name, so a disk that ignores case takes it.
            let passing = from_path.with_extension("renaming");
            fs::rename(&from_path, &passing)?;
            fs::rename(&passing, &to_path)?;
        } else {
            fs::rename(&from_path, &to_path).with_context(|| format!("renaming {rel}"))?;
        }
        rel_of(self.root(), &to_path).context("renamed outside vault")?;
        self.reorder_moved(rel, &to)?;
        self.carry_carving(rel, &to)?;
        self.remember(&to, &self.read(&to)?)?;
        let linked = self.relink_all(rel, &to)?;
        let _ = fs::remove_file(self.journal_path());
        Ok(Renamed { from: rel.into(), to, linked })
    }

    /// Rewrite every link to the note that was at `from` (now at `to`). Safe to run twice.
    fn relink_all(&self, from: &str, to: &str) -> Result<Vec<String>> {
        let stem = stem_of(to).to_string();
        let mut linked = Vec::new();
        for n in self.notes()? {
            if n.place == Place::Elsewhere {
                continue;
            }
            let text = self.read(&n.rel)?;
            let (out, count) = relink(&text, dir_of(&n.rel), from, &stem);
            if count > 0 && out != text {
                write_atomic(&self.path(&n.rel)?, out.as_bytes())?;
                self.remember(&n.rel, &out)?;
                linked.push(n.rel);
            }
        }
        Ok(linked)
    }

    /// At open: finish a rename that was interrupted.
    pub fn finish_renames(&self) -> Result<()> {
        let Ok(bytes) = fs::read(self.journal_path()) else { return Ok(()) };
        let j: Journal = serde_json::from_slice(&bytes)?;
        if Path::new(&self.path(&j.to)?).exists() {
            self.reorder_moved(&j.from, &j.to)?;
            self.carry_carving(&j.from, &j.to)?;
            self.relink_all(&j.from, &j.to)?;
        }
        let _ = fs::remove_file(self.journal_path());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault::testing::*;
    use chrono::Utc;

    /// Make every note look old enough that a rename does not wait for it.
    fn settle_times(f: &Fixture) {
        let old = std::time::SystemTime::now() - std::time::Duration::from_secs(600);
        for n in f.vault.notes().unwrap() {
            let file = fs::File::options().write(true).open(f.vault.path(&n.rel).unwrap()).unwrap();
            file.set_modified(old).unwrap();
        }
    }

    #[test]
    fn reads_the_heading_without_marks() {
        assert_eq!(heading_of("# A **bold** [[Note|walk]] by [the sea](x.md)\n\ntext").as_deref(), Some("A bold walk by the sea"));
        assert_eq!(heading_of("no heading"), None);
        // A cleared title over a woven note's second heading: no heading, so no rename to it.
        assert_eq!(heading_of("# \n\n# B\ntext"), None);
        assert_eq!(stem_for_heading("Rain: on #roofs [and] |more|"), "Rain- on roofs and more");
    }

    #[test]
    fn rewrites_every_link_form_and_keeps_the_rest() {
        let rel = "stone/Reading/Old.md";
        let text = "[[Old]] [[old|alias]] [[Old#Part]] [[Reading/Old]] ![[Old]] [[stone/Reading/Old.md]] [x](Old.md) [y](../Reading/Old.md) [[Older]] [[Other/Old]]";
        let (out, n) = relink(text, "stone/Reading", rel, "New name");
        assert_eq!(n, 8);
        assert_eq!(
            out,
            "[[New name]] [[New name|alias]] [[New name#Part]] [[Reading/New name]] ![[New name]] [[stone/Reading/New name.md]] [x](New%20name.md) [y](../Reading/New%20name.md) [[Older]] [[Other/Old]]"
        );
    }

    #[test]
    fn leaves_links_in_fenced_code_alone() {
        let (out, n) = relink("```\n[[Old]]\n```\n[[Old]]", "", "stone/Old.md", "New");
        assert_eq!(n, 1);
        assert_eq!(out, "```\n[[Old]]\n```\n[[New]]");
    }

    #[test]
    fn follows_the_heading_and_rewrites_links() {
        let f = arranged();
        put(&f.vault, "sand/sun/2026-11-03.md", "# 2026-11-03\n\n");
        put(&f.vault, "stone/Index.md", "See [[2026-11-03]].");
        settle_times(&f);
        let opened = f.vault.read("sand/sun/2026-11-03.md").unwrap();
        f.vault.write("sand/sun/2026-11-03.md", "# A walk by the sea\n\nwaves").unwrap();
        let Follow::Renamed(r) = f.vault.follow_heading("sand/sun/2026-11-03.md", &opened, Utc::now()).unwrap() else { panic!() };
        assert_eq!(r.to, "sand/sun/A walk by the sea.md");
        assert_eq!(r.linked, vec!["stone/Index.md"]);
        assert_eq!(f.vault.read("stone/Index.md").unwrap(), "See [[A walk by the sea]].");
        assert!(!f.vault.path("sand/sun/2026-11-03.md").unwrap().exists());
    }

    #[test]
    fn a_name_that_differs_from_the_heading_is_left_alone() {
        let f = arranged();
        // Renamed on the phone: the name no longer matches the heading.
        put(&f.vault, "stone/My own name.md", "# The heading\n");
        let opened = f.vault.read("stone/My own name.md").unwrap();
        f.vault.write("stone/My own name.md", "# Another heading\n").unwrap();
        assert_eq!(f.vault.follow_heading("stone/My own name.md", &opened, Utc::now()).unwrap(), Follow::Unlinked);
        assert!(f.vault.path("stone/My own name.md").unwrap().exists());
    }

    #[test]
    fn never_takes_a_name_another_note_has() {
        let f = arranged();
        put(&f.vault, "stone/Rain.md", "# Rain\n");
        put(&f.vault, "stone/Elsewhere folder/x.md", "");
        put(&f.vault, "sand/sun/Draft.md", "# Draft\n");
        settle_times(&f);
        let opened = f.vault.read("sand/sun/Draft.md").unwrap();
        f.vault.write("sand/sun/Draft.md", "# Rain\n").unwrap();
        let Follow::Renamed(r) = f.vault.follow_heading("sand/sun/Draft.md", &opened, Utc::now()).unwrap() else { panic!() };
        assert_eq!(r.to, "sand/sun/Rain (1).md");

        // A third note headed "Rain" becomes "Rain (2)".
        put(&f.vault, "stone/Third.md", "# Third\n");
        settle_times(&f);
        let opened = f.vault.read("stone/Third.md").unwrap();
        f.vault.write("stone/Third.md", "# Rain\n").unwrap();
        let Follow::Renamed(r) = f.vault.follow_heading("stone/Third.md", &opened, Utc::now()).unwrap() else { panic!() };
        assert_eq!(r.to, "stone/Rain (2).md");

        // "Rain (1)" still follows its heading: the (1) is not the person's choice.
        let opened = f.vault.read("sand/sun/Rain (1).md").unwrap();
        assert_eq!(f.vault.follow_heading("sand/sun/Rain (1).md", &opened, Utc::now()).unwrap(), Follow::Same);
        f.vault.write("sand/sun/Rain (1).md", "# Drizzle\n").unwrap();
        let Follow::Renamed(r) = f.vault.follow_heading("sand/sun/Rain (1).md", &opened, Utc::now()).unwrap() else { panic!() };
        assert_eq!(r.to, "sand/sun/Drizzle.md");
    }

    #[test]
    fn waits_while_a_linking_note_just_changed_or_lies_elsewhere() {
        let f = arranged();
        put(&f.vault, "stone/Old.md", "# Old\n");
        put(&f.vault, "stone/Fresh.md", "[[Old]]");
        let opened = f.vault.read("stone/Old.md").unwrap();
        f.vault.write("stone/Old.md", "# New\n").unwrap();
        // Fresh.md was written a moment ago.
        assert_eq!(f.vault.follow_heading("stone/Old.md", &opened, Utc::now()).unwrap(), Follow::Held { held: Held::Busy("stone/Fresh.md".into()) });

        settle_times(&f);
        put(&f.vault, "Outside/Map.md", "[[Old]]");
        settle_times(&f);
        assert_eq!(f.vault.follow_heading("stone/Old.md", &opened, Utc::now()).unwrap(), Follow::Held { held: Held::Elsewhere("Outside/Map.md".into()) });
    }

    #[test]
    fn a_note_with_no_heading_is_renamed_by_its_title_and_gets_no_heading() {
        let f = arranged();
        // Written in Obsidian on the phone: its file name is its title.
        put(&f.vault, "sand/sun/Groceries.md", "- oat milk\n");
        put(&f.vault, "stone/Index.md", "[[Groceries]]");
        settle_times(&f);
        let Follow::Renamed(r) = f.vault.rename_to("sand/sun/Groceries.md", "Shopping list", Utc::now()).unwrap() else { panic!() };
        assert_eq!(r.to, "sand/sun/Shopping list.md");
        assert_eq!(f.vault.read("sand/sun/Shopping list.md").unwrap(), "- oat milk\n");
        assert_eq!(f.vault.read("stone/Index.md").unwrap(), "[[Shopping list]]");
        // The same name, or one that waits, changes nothing.
        assert_eq!(f.vault.rename_to("sand/sun/Shopping list.md", "Shopping list", Utc::now()).unwrap(), Follow::Same);
        put(&f.vault, "Outside/Map.md", "[[Shopping list]]");
        settle_times(&f);
        assert!(matches!(f.vault.rename_to("sand/sun/Shopping list.md", "List", Utc::now()).unwrap(), Follow::Held { .. }));
    }

    #[test]
    fn a_link_just_written_in_mandala_does_not_make_it_wait() {
        let f = arranged();
        put(&f.vault, "stone/Old.md", "# Old\n");
        // Written a moment ago, but by Mandala: it is no edit from elsewhere.
        f.vault.write("stone/Index.md", "See [[Old]].").unwrap();
        let opened = f.vault.read("stone/Old.md").unwrap();
        f.vault.write("stone/Old.md", "# New\n").unwrap();
        let Follow::Renamed(r) = f.vault.follow_heading("stone/Old.md", &opened, Utc::now()).unwrap() else { panic!() };
        assert_eq!(r.to, "stone/New.md");
        assert_eq!(f.vault.read("stone/Index.md").unwrap(), "See [[New]].");
    }

    #[test]
    fn waits_when_a_link_could_mean_two_notes() {
        let f = arranged();
        put(&f.vault, "stone/A/Old.md", "# Old\n");
        put(&f.vault, "stone/B/Old.md", "# Old\n");
        put(&f.vault, "stone/Index.md", "[[Old]]");
        settle_times(&f);
        let opened = f.vault.read("stone/A/Old.md").unwrap();
        f.vault.write("stone/A/Old.md", "# New\n").unwrap();
        assert!(matches!(f.vault.follow_heading("stone/A/Old.md", &opened, Utc::now()).unwrap(), Follow::Held { held: Held::Ambiguous(_) }));
    }

    #[test]
    fn keeps_the_clock_the_carving_and_the_order() {
        let f = arranged();
        put(&f.vault, "sand/moon/full/Seed.md", "# Seed\n");
        put(&f.vault, "stone/Kept.md", "# Kept\n");
        let now = Utc::now();
        let before = f.vault.refresh(now).unwrap().grains["sand/moon/full/Seed.md"].clone();
        f.vault.carve("stone/Kept.md", "because", now).unwrap();
        f.vault.set_order(&["stone/Kept.md".into()]).unwrap();
        settle_times(&f);

        f.vault.rename_note("sand/moon/full/Seed.md", "Sprout").unwrap();
        let after = f.vault.refresh(now).unwrap().grains["sand/moon/full/Sprout.md"].clone();
        assert_eq!(after.written, before.written);
        assert_eq!(after.dissolves, before.dissolves);

        f.vault.rename_note("stone/Kept.md", "Held").unwrap();
        assert_eq!(f.vault.carving("stone/Held.md").unwrap().unwrap().text, "because");
        assert_eq!(f.vault.order().unwrap(), vec!["stone/Held.md"]);
    }

    #[test]
    fn a_change_of_case_only_is_kept() {
        let f = arranged();
        put(&f.vault, "stone/rain.md", "# rain\n");
        settle_times(&f);
        let r = f.vault.rename_note("stone/rain.md", "Rain").unwrap();
        assert_eq!(r.to, "stone/Rain.md");
        let names: Vec<String> = f.vault.notes().unwrap().into_iter().map(|n| n.rel).collect();
        assert_eq!(names, vec!["stone/Rain.md"]);
    }

    #[test]
    fn undo_is_a_rename_back_and_the_note_is_then_left_alone() {
        let f = arranged();
        put(&f.vault, "stone/Old.md", "# Old\n");
        put(&f.vault, "stone/Index.md", "[[Old]]");
        settle_times(&f);
        let opened = f.vault.read("stone/Old.md").unwrap();
        f.vault.write("stone/Old.md", "# New\n").unwrap();
        let Follow::Renamed(r) = f.vault.follow_heading("stone/Old.md", &opened, Utc::now()).unwrap() else { panic!() };
        settle_times(&f);
        let back = f.vault.rename_note(&r.to, "Old").unwrap();
        assert_eq!(back.to, "stone/Old.md");
        assert_eq!(f.vault.read("stone/Index.md").unwrap(), "[[Old]]");
        // Its heading (New) and name (Old) now differ: the name is the person's.
        let opened = f.vault.read("stone/Old.md").unwrap();
        assert_eq!(f.vault.follow_heading("stone/Old.md", &opened, Utc::now()).unwrap(), Follow::Unlinked);
    }

    #[test]
    fn an_interrupted_rename_is_finished_at_the_next_open() {
        let f = arranged();
        put(&f.vault, "stone/Old.md", "# Old\n");
        put(&f.vault, "stone/Index.md", "[[Old]]");
        // As if Mandala stopped after the move, before the links.
        fs::rename(f.vault.path("stone/Old.md").unwrap(), f.vault.path("stone/New.md").unwrap()).unwrap();
        write_atomic(&f.vault.journal_path(), br#"{"from":"stone/Old.md","to":"stone/New.md"}"#).unwrap();
        f.vault.finish_renames().unwrap();
        assert_eq!(f.vault.read("stone/Index.md").unwrap(), "[[New]]");
        assert!(!f.vault.journal_path().exists());
    }

    #[test]
    fn speaks_the_shape_the_window_reads() {
        let r = Follow::Renamed(Renamed { from: "a.md".into(), to: "b.md".into(), linked: vec![] });
        assert_eq!(serde_json::to_string(&r).unwrap(), r#"{"kind":"renamed","from":"a.md","to":"b.md","linked":[]}"#);
        let h = Follow::Held { held: Held::Busy("c.md".into()) };
        assert_eq!(serde_json::to_string(&h).unwrap(), r#"{"kind":"held","held":{"kind":"busy","rel":"c.md"}}"#);
        assert_eq!(serde_json::to_string(&Follow::Held { held: Held::Syncing }).unwrap(), r#"{"kind":"held","held":{"kind":"syncing"}}"#);
    }
}
