//! Search: every note, and what is settling (so a note let go today can be
//! found and restored). A plain scan; a lean vault needs nothing more yet.

use crate::vault::Vault;
use anyhow::Result;
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct Hit {
    pub rel: String,
    pub title: String,
    /// The first line that matched, or the title.
    pub line: String,
    /// Set when the note is settling: the id to restore it with.
    pub settled: Option<String>,
}

impl Vault {
    pub fn search(&self, query: &str) -> Result<Vec<Hit>> {
        let q = query.trim().to_lowercase();
        if q.is_empty() {
            return Ok(Vec::new());
        }
        let mut hits = Vec::new();
        let carvings = self.carvings()?;
        for n in self.notes()? {
            let found = matching_line(&n.title, &self.read(&n.rel)?, &q)
                .or_else(|| carvings.get(&n.rel).filter(|c| c.text.to_lowercase().contains(&q)).map(|c| c.text.clone()));
            if let Some(line) = found {
                hits.push(Hit { rel: n.rel, title: n.title, line, settled: None });
            }
        }
        for s in self.settling()? {
            if let Some(line) = matching_line(&s.title, &self.settled_text(&s.id).unwrap_or_default(), &q) {
                hits.push(Hit { rel: s.rel, title: s.title, line, settled: Some(s.id) });
            }
        }
        Ok(hits)
    }
}

fn matching_line(title: &str, text: &str, q: &str) -> Option<String> {
    if let Some(line) = text.lines().find(|l| l.to_lowercase().contains(q)) {
        return Some(line.trim().to_string());
    }
    title.to_lowercase().contains(q).then(|| title.to_string())
}

#[cfg(test)]
mod tests {
    use crate::settle::Reason;
    use crate::vault::testing::*;
    use chrono::Utc;

    #[test]
    fn finds_notes_and_what_is_settling() {
        let f = arranged();
        put(&f.vault, "stone/a.md", "the bell sounded far away");
        put(&f.vault, "sand/sun/b.md", "a bell underwater");
        f.vault.settle("sand/sun/b.md", Reason::Swept, Utc::now()).unwrap();
        let hits = f.vault.search("BELL").unwrap();
        assert_eq!(hits.len(), 2);
        assert!(hits.iter().any(|h| h.settled.is_some() && h.line == "a bell underwater"));
        assert!(f.vault.search("  ").unwrap().is_empty());
    }
}
