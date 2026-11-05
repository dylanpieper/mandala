# Release

How to make a version of Mandala.
Tested on macOS 26 with Tauri CLI 2.12.4, Node 23 and cargo-xwin 0.23.1.
The Windows build is made on a Mac. It has not run on Windows yet.

## The icon

The logo and the app icon come from one script, so they always match.

1. Change the drawing in `scripts/logo.mjs`.
   Then run `node scripts/logo.mjs`.
   It writes `docs/logo.svg` and `src-tauri/icons/source.svg`.
2. Make a 1024 px PNG from the SVG. On macOS:
   `sips -s format png src-tauri/icons/source.svg --out src-tauri/icons/source.png`.
3. Make every size: `npx tauri icon src-tauri/icons/source.png -o src-tauri/icons`.
4. Move the `android/` and `ios/` folders that it makes to the Trash.
   Mandala is a desktop app.
5. Make the README's moving logo: `node scripts/logo.mjs --gif`.
   - It writes `docs/logo.gif`: an 8-second loop at 15 frames a second, 320 px, on the icon's dark tile.
   - It needs macOS, because `sips` draws the frames.
   - It needs ffmpeg (tested with 8.0.1) to join the frames.

`sips` draws an SVG `transform="rotate()"` wrongly.
So the script turns the petal points itself.

## A version

1. Set the same version in `package.json`, `Cargo.toml` (`[workspace.package]`) and `src-tauri/tauri.conf.json`.
2. In `CHANGELOG.md`, move the items under "unreleased" to the new version, with the date.
3. Run every check in `AGENTS.md` (Checks).
4. Build for macOS and for Windows (below).
5. Tag the version, for example `v0.1.0`, and push the tag.
6. Make a GitHub release from the tag.
   - Attach the DMG and the Windows `setup.exe`.
   - Use the version's changelog section as the notes.
   - Mark a preview as a pre-release.
   - Say that the builds are not signed.
7. Publish the site (below).

## macOS

One app for Apple silicon and Intel Macs:

```
npx tauri build --target universal-apple-darwin
```

The DMG is in `target/universal-apple-darwin/release/bundle/dmg/`.
The app is in `target/universal-apple-darwin/release/bundle/macos/`.

## Windows, built on a Mac

You need cargo-xwin, the Windows target for Rust, and llvm and nsis from Homebrew.
Install them once:

```
cargo install --locked cargo-xwin
rustup target add x86_64-pc-windows-msvc
brew install llvm nsis
```

Then build the installer:

```
npx tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis
```

The installer is `target/x86_64-pc-windows-msvc/release/bundle/nsis/Mandala_<version>_x64-setup.exe`.

- The linker shows many `LNK4099` warnings about missing `.pdb` files. They are harmless.
- `--bundles nsis` is necessary, because `tauri.conf.json` lists only the Mac bundles.
- Wine and Whisky cannot run the app, because it needs WebView2.
  Test it in a Windows virtual machine.

## The site

`.github/workflows/pages.yml` builds the site and publishes it to GitHub Pages.

- It runs on a push to `main` that changes `site/`, `src/` or `CHANGELOG.md`.
- You can also run it by hand from the Actions tab.
- In the repository's Settings, under Pages, set the source to "GitHub Actions".

## Not done yet

- **Signing and notarization (macOS).**
  These need an Apple Developer ID certificate and an app-specific password from the owner.
  Until then, the app opens only after Open Anyway in System Settings, under Privacy & Security.
- **Signing (Windows).**
  This needs a code-signing certificate.
  Until then, Windows SmartScreen warns before the installer runs.
- **Testing on Windows.**
  The installer is built, but it has not run on a Windows machine yet.
- **Updates.**
  An updater needs the network, which Mandala otherwise never uses. Not decided.
