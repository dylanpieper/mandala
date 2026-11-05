//! Mandala's core: everything that happens to notes, with no window.
//!
//! The vault is an Obsidian vault on disk (usually in iCloud). Mandala edits it
//! in place. `stone/` holds what was kept, `sand/` holds what will dissolve, and
//! the folder a sand note sits in is its lifespan. Mandala's own state lives in
//! `.mandala/` inside the vault (hidden from Obsidian) and, for things that must
//! not sync, in a state directory outside iCloud.
//!
//! Read `site/docs/vault.md` before changing anything here.

pub mod arrange;
pub mod attach;
pub mod carve;
pub mod clock;
pub mod combine;
pub mod copies;
mod fsx;
pub mod keep;
pub mod lifespan;
pub mod links;
pub mod mandala;
pub mod order;
pub mod rename;
pub mod search;
pub mod settle;
pub mod vault;
pub mod visit;

pub use clock::{Clock, Grain};
pub use lifespan::{place_of, Life, Place};
pub use settle::{Reason, Settled};
pub use vault::{Note, Vault};
pub use visit::{Arrival, NoteRef};
