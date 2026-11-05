//! `[[wikilinks]]` and backlinks, as Obsidian reads them.

use crate::vault::{Note, Vault};
use anyhow::Result;
use regex::Regex;
use std::sync::LazyLock;

static LINK: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"!?\[\[([^\]\|#\^]+)").unwrap());

/// The targets of every `[[link]]` and `![[embed]]` in a text, as written.
pub fn links(text: &str) -> Vec<String> {
    LINK.captures_iter(text).map(|c| c[1].trim().to_string()).collect()
}

/// The name a link points at: its last path segment, without `.md`.
pub fn target_name(link: &str) -> String {
    let last = link.rsplit('/').next().unwrap_or(link);
    last.strip_suffix(".md").unwrap_or(last).to_lowercase()
}

impl Vault {
    /// Notes that link to the note titled `title`.
    pub fn backlinks(&self, title: &str) -> Result<Vec<Note>> {
        let want = title.to_lowercase();
        let mut out = Vec::new();
        for n in self.notes()? {
            if n.title.to_lowercase() == want {
                continue;
            }
            if links(&self.read(&n.rel)?).iter().any(|l| target_name(l) == want) {
                out.push(n);
            }
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault::testing::*;

    #[test]
    fn reads_links_like_obsidian() {
        let t = "See [[Impermanence]], [[stone/Reading/Ryokan|Ryōkan]], [[Note#Heading]] and ![[map.png]].";
        assert_eq!(links(t), vec!["Impermanence", "stone/Reading/Ryokan", "Note", "map.png"]);
        assert_eq!(target_name("stone/Reading/Ryokan"), "ryokan");
    }

    #[test]
    fn finds_backlinks_by_name() {
        let f = arranged();
        put(&f.vault, "stone/Practice/Impermanence.md", "# Impermanence");
        put(&f.vault, "sand/sun/Morning pages.md", "Thinking about [[impermanence]] again.");
        put(&f.vault, "stone/Other.md", "nothing");
        let back = f.vault.backlinks("Impermanence").unwrap();
        assert_eq!(back.len(), 1);
        assert_eq!(back[0].title, "Morning pages");
    }
}
