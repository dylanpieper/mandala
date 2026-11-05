//! The mandala view's picture of the vault: stone as petals (one per folder
//! of `stone/`), sand as grains with the life they have left, the links
//! between them, and settling notes as dust with how far they have settled.
//!
//! Only what to draw is decided here. Where each thing sits on screen is the
//! window's (`src/lib/mandala.ts`).

use crate::links::{links, target_name};
use crate::lifespan::{Life, Place};
use crate::order::sort_by_order;
use crate::settle::{Reason, SETTLE_FOR_HOURS};
use crate::vault::{title_of, Vault};
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::collections::{BTreeSet, HashMap};

#[derive(Clone, Debug, Serialize)]
pub struct Mandala {
    /// Stone directly in `stone/`, not in a folder: the seeds at the centre.
    pub seeds: Vec<Stone>,
    /// One petal per folder of `stone/`, sorted, empty ones included.
    pub petals: Vec<Petal>,
    pub grains: Vec<SandGrain>,
    /// Each link once, from the note that writes it to the note it names.
    pub links: Vec<Link>,
    pub dust: Vec<Dust>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Stone {
    pub rel: String,
    pub title: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct Petal {
    pub folder: String,
    pub notes: Vec<Stone>,
}

#[derive(Clone, Debug, Serialize)]
pub struct SandGrain {
    pub rel: String,
    pub title: String,
    pub life: Life,
    pub written: DateTime<Utc>,
    pub dissolves: Option<DateTime<Utc>>,
    /// 1.0 when its clock starts, 0.0 when it runs out. A breath is always 1.0.
    pub fraction_left: f64,
}

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize)]
pub struct Link {
    pub from: String,
    pub to: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct Dust {
    pub id: String,
    pub title: String,
    pub reason: Reason,
    pub at: DateTime<Utc>,
    /// 0.0 when it has just settled, 1.0 when its day is over and it can be purged.
    pub settled: f64,
}

impl Vault {
    pub fn mandala(&self, now: DateTime<Utc>) -> Result<Mandala> {
        let clock = self.refresh(now)?;
        let order = self.order()?;
        let notes = self.notes()?;

        let mut seeds = Vec::new();
        let mut petals: Vec<Petal> =
            self.stone_folders()?.into_iter().map(|folder| Petal { folder, notes: Vec::new() }).collect();
        for n in notes.iter().filter(|n| n.place == Place::Stone) {
            let stone = Stone { rel: n.rel.clone(), title: n.title.clone() };
            let parts: Vec<&str> = n.rel.split('/').collect();
            match petals.iter_mut().find(|p| parts.len() > 2 && p.folder == parts[1]) {
                Some(p) => p.notes.push(stone),
                None => seeds.push(stone),
            }
        }
        sort_by_order(&mut seeds, &order, |s| &s.rel);
        for p in &mut petals {
            sort_by_order(&mut p.notes, &order, |s| &s.rel);
        }

        let grains = clock
            .grains
            .iter()
            .map(|(rel, g)| SandGrain {
                rel: rel.clone(),
                title: title_of(rel),
                life: g.life,
                written: g.written,
                dissolves: g.dissolves,
                fraction_left: g.fraction_left(now),
            })
            .collect();

        // Links between notes that are drawn (stone and sand). A name that
        // more than one note shares goes to the first by path, as the list is sorted.
        let drawn: Vec<&str> =
            notes.iter().filter(|n| n.place != Place::Elsewhere).map(|n| n.rel.as_str()).collect();
        let mut by_name: HashMap<String, &str> = HashMap::new();
        let mut by_path: HashMap<String, &str> = HashMap::new();
        for rel in &drawn {
            by_name.entry(title_of(rel).to_lowercase()).or_insert(rel);
            by_path.insert(rel.strip_suffix(".md").unwrap_or(rel).to_lowercase(), rel);
        }
        let mut found = BTreeSet::new();
        for from in &drawn {
            let Ok(text) = self.read(from) else { continue };
            for link in links(&text) {
                let path = link.strip_suffix(".md").unwrap_or(&link).to_lowercase();
                let to = by_path.get(&path).or_else(|| by_name.get(&target_name(&link)));
                if let Some(&to) = to {
                    if to != *from {
                        found.insert(Link { from: from.to_string(), to: to.to_string() });
                    }
                }
            }
        }

        let day = (SETTLE_FOR_HOURS * 3600) as f64;
        let dust = self
            .settling()?
            .into_iter()
            .map(|s| Dust {
                settled: ((now - s.at).num_seconds() as f64 / day).clamp(0.0, 1.0),
                id: s.id,
                title: s.title,
                reason: s.reason,
                at: s.at,
            })
            .collect();

        Ok(Mandala { seeds, petals, grains, links: found.into_iter().collect(), dust })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault::testing::*;
    use chrono::Duration;

    #[test]
    fn stone_becomes_petals_and_seeds() {
        let f = arranged();
        put(&f.vault, "stone/Practice/a.md", "a");
        put(&f.vault, "stone/Practice/b.md", "b");
        put(&f.vault, "stone/Reading/c.md", "c");
        put(&f.vault, "stone/Inbox.md", "i");
        std::fs::create_dir_all(f.vault.root().join("stone/Empty")).unwrap();
        f.vault.set_order(&["stone/Practice/b.md".into()]).unwrap();

        let m = f.vault.mandala(Utc::now()).unwrap();
        let folders: Vec<_> = m.petals.iter().map(|p| p.folder.as_str()).collect();
        assert_eq!(folders, ["Empty", "Practice", "Reading"], "an empty folder is still a petal");
        let practice: Vec<_> = m.petals[1].notes.iter().map(|n| n.title.as_str()).collect();
        assert_eq!(practice, ["b", "a"], "the person's order holds in a petal");
        assert_eq!(m.seeds.len(), 1);
        assert_eq!(m.seeds[0].title, "Inbox");
    }

    #[test]
    fn sand_carries_its_life_left() {
        let f = arranged();
        let then = Utc::now() - Duration::hours(12);
        f.vault.new_sand("Half a day", Life::Sun, then).unwrap();
        f.vault.new_sand("Breath", Life::Breath, then).unwrap();
        let m = f.vault.mandala(Utc::now()).unwrap();
        let sun = m.grains.iter().find(|g| g.life == Life::Sun).unwrap();
        assert!((sun.fraction_left - 0.5).abs() < 0.01);
        let breath = m.grains.iter().find(|g| g.life == Life::Breath).unwrap();
        assert_eq!(breath.fraction_left, 1.0);
    }

    #[test]
    fn links_resolve_by_path_or_name_once_each() {
        let f = arranged();
        put(&f.vault, "stone/Practice/Impermanence.md", "See [[Ryokan]] and [[stone/Reading/Ryokan|again]].");
        put(&f.vault, "stone/Reading/Ryokan.md", "Back to [[Impermanence]], and [[Ryokan]] itself.");
        put(&f.vault, "sand/sun/Morning.md", "[[impermanence]] and [[Nowhere]] and [[Elsewhere]]");
        put(&f.vault, "Elsewhere.md", "[[Ryokan]]");

        let m = f.vault.mandala(Utc::now()).unwrap();
        let pairs: Vec<_> = m.links.iter().map(|l| (l.from.as_str(), l.to.as_str())).collect();
        assert_eq!(
            pairs,
            [
                ("sand/sun/Morning.md", "stone/Practice/Impermanence.md"),
                ("stone/Practice/Impermanence.md", "stone/Reading/Ryokan.md"),
                ("stone/Reading/Ryokan.md", "stone/Practice/Impermanence.md"),
            ],
            "no self-links, no repeats, nothing to notes outside stone and sand"
        );
    }

    #[test]
    fn settling_notes_are_dust_that_settles_over_a_day() {
        let f = arranged();
        put(&f.vault, "sand/sun/a.md", "a");
        let then = Utc::now() - Duration::hours(6);
        f.vault.settle("sand/sun/a.md", Reason::Swept, then).unwrap();
        let m = f.vault.mandala(Utc::now()).unwrap();
        assert_eq!(m.dust.len(), 1);
        assert_eq!(m.dust[0].title, "a");
        assert!((m.dust[0].settled - 0.25).abs() < 0.01);
        assert!(m.grains.is_empty());
    }
}
