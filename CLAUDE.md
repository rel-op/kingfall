# Kingfall

A pixel-art battle chess game in plain JavaScript on a 2D canvas. No build tools, no framework: `index.html`
loads the files in `js/` as ordinary scripts. It runs from a file on disk and from the hosted copy.

## Before every push

Pushing to `main` is the release. GitHub Pages republishes https://rel-op.github.io/kingfall/ within a minute.

1. **Run `node tools/make-sw.mjs`** if anything under `index.html`, `manifest.webmanifest`, `js/` or `assets/`
   changed. It rewrites `sw.js` with the list of game files and a version made from their contents. Commit the
   new `sw.js` with the change.
2. Then push.

Why it matters: `sw.js` is what tells a player's device there is a new version. A changed `sw.js` makes the
device save the whole new set of files, then the title menu shows NEW VERSION: RESTART. Skip the step and a
device only refreshes the files it happened to use, so players can end up with old and new files mixed, and
they get no notice.

It is safe to run when nothing changed: the version stays the same.

## Checking a change

There is no test suite to run in one go. Use the ones that cover what you touched (full list in `README.md`):

```bash
node tools/drive.mjs "index.html?game&manual" tests/soak.json      # a whole random game; needs "?game&manual"
node tools/drive.mjs "serve:index.html" tests/app.json             # offline copy and install parts
node tools/drive.mjs "serve:index.html" tests/update.json          # a pretend new version: notice, restart
node tools/drive.mjs "serve:index.html" tests/arena.json           # fourth arena, music hand-over
MOBILE=844x390 node tools/drive.mjs "serve:index.html" tests/touch.json   # a phone-sized game played by touch
```

`tools/drive.mjs` drives the game in headless Chrome and can take screenshots. Look at a screenshot before
calling a visual change done.

## Other steps that are easy to miss

- After generating music: `node tools/trim-music.mjs` (cuts trailing silence, writes each track's length).
- After changing sound effects: `node tools/pack-audio.mjs`.
- After changing art in `art/raw`: `uv run tools/process_art.py` (`bg` as an argument rebuilds backdrops only,
  which also cuts the koi out of the sakura backdrop).

## Rules for this repository

- It is public. Never commit keys, personal email addresses or paths that contain a home folder. The audio key
  is passed as `ELEVENLABS_API_KEY` in the environment and is never written to a file.
- Commit messages: one plain line, no attribution or tool lines.
