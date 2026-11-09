<p align="center"><img src="docs/logo.gif" width="160" alt="Mandala: sand drifting out from a breathing stone lotus"></p>

<h1 align="center">Mandala</h1>

<p align="center"><em>Notes dissolve into sand<br>Until you set them in stone</em></p>

Mandala is a desktop app for macOS. A Windows preview is also available, not yet tested on Windows.

Every new note is **sand**. It lasts a breath, a sun, or a quarter, half or full moon, and then it is swept. To keep a note, you **set it in stone**, deliberately, with a held press and a reason.

Mandala works on a folder of plain markdown on your computer, such as an Obsidian vault. Notes can come in from anywhere: Obsidian on your phone, another editor, or any sync tool. Your notes stay plain files, with no frontmatter and nothing hidden in them.

- **No accounts.**
- **No subscriptions.**
- **No network.**
- **No AI.**

## Download

Get the latest version from [Releases](https://github.com/dylanpieper/mandala/releases).

- **macOS** (Apple silicon and Intel): open the DMG and drag Mandala to Applications.
  The app is not signed yet. At first open, go to System Settings, then Privacy & Security, and choose Open Anyway.
- **Windows**: run the `setup.exe`.
  The installer is not signed yet. If Windows warns you, choose More info, then Run anyway.

At first open, Mandala asks for your vault, and you choose which folders become stone. Mandala takes a snapshot of the vault first. To try Mandala on a copy, see [Working on Mandala](https://dylanpieper.github.io/mandala/docs/working/).

## Build from source

You need Rust (tested with 1.99) and Node 20 or later (tested with 23). On macOS, you also need the Xcode command line tools. On Windows, you need the Microsoft C++ Build Tools and WebView2.

```
npm install
npm run app
```

## Learn more

- [The website](https://dylanpieper.github.io/mandala/): the downloads and the docs, from how Mandala works to how it is built.
- [Change log](https://github.com/dylanpieper/mandala/blob/main/CHANGELOG.md): what changed in each version.
- [AGENTS.md](https://github.com/dylanpieper/mandala/blob/main/AGENTS.md): the rules for coding agents working on Mandala.
- [License](https://github.com/dylanpieper/mandala/blob/main/LICENSE): MIT.
