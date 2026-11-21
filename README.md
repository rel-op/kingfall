# KINGFALL

Pixel battle chess for one player against the computer, or two on one machine. Every piece is a stone chessman that
wakes into a warrior when you pick it up, and every capture is a short fighting-game duel
fought on the board.

![trailer](trailer.mp4)

## Play

**Play it now: https://rel-op.github.io/kingfall/**

Or download this folder and open `index.html` in a browser. Nothing to install, no server needed.

On a phone or tablet it needs a web address (any static host will do: the folder is the site). Hold the
phone sideways, tap a piece, then a square. From a web address it can also be installed as an app, which
opens full screen and works offline: Android, Chrome and Edge show INSTALL AS AN APP on the title menu;
on an iPhone or iPad the same item lists the steps (Share, then Add to Home Screen). It updates by
itself: a new version is downloaded while you play, and the title menu then shows NEW VERSION: RESTART.

| | Mouse | Gamepad | Keyboard |
|---|---|---|---|
| Move the cursor | point | stick or d-pad | arrows / WASD |
| Pick a piece, confirm | click | A | Enter / Space |
| Cancel | right click | B | Backspace / X |
| Toggle move hints | | X | H |
| Ask the coach for a tip (one player) | | Y | T |
| Menu | | Start | Esc |
| Full screen | | | F |

MENU and TIP buttons sit in the bottom-left corner for a finger, or a mouse with no keyboard to hand.

With two gamepads connected, pad 1 plays Sun and pad 2 plays Moon. With one, you pass it.
Press A or click during a fight to fast-forward it.

## What's in it

- Full chess rules: check, checkmate, stalemate, castling, en passant, promotion, and draws
  by repetition, fifty moves or bare material.
- Six pieces, each with a transformation, idle, run, hit and attack animation, and its own
  finishing routine: the pawn's dash-through thrust, the knight's double charge, the
  bishop's pillars of light, the rook golem's launcher and slam, the queen's blink-and-flurry,
  and the king's one-cut finish.
- Four arenas: Sakura Keep, Ember Forge, Frostmoon Abbey, Stormwall Keep. Each has two music themes; a game plays one three times, then the other. The backdrops move a little:
  banners and flags in the wind, brazier flames, the koi swimming round their pond, lava, candle and window light.
- One player: sixteen computer opponents, from the Stable Hand, who has just learned the moves, up to
  the Crown at full strength. Play either army.
- A coach for one-player games, off, tips only, or full. A tip shows first which piece to move, then
  where. The full coach also rings your pieces that are in danger, shows who is ahead, and stops you
  before a move that throws the game away, pointing at the reply it fears. After the game it gives
  your accuracy, counts slips, mistakes and blunders, and lets you replay the worst moments.
- Move hints (on or off), an optional chess clock, three save slots plus an autosave,
  take-back, a classic bottom-versus-top board view for purists, and three fight settings
  (full, quick, off).

## Art direction

Board and camera follow Battle Chess: armies left and right on a board in perspective, so
every piece is in profile and a fight needs no change of angle. Sprites take their cues from
SNK's The Last Blade and Samurai Shodown and from Blasphemous (large hi-bit sprites, real
anticipation and follow-through, smears, hit-stop, the held breath before a finishing cut).
The staging borrows from HD-2D games such as Octopath Traveler and Triangle Strategy: crisp
pixel figures on a lit stage, with glow, soft shadows and atmosphere done at full
resolution. Costumes are European medieval; the palette, focus lines, seal stamps and
finishing-blow timing are Japanese.

The Moon army is the Sun army recoloured, the classic fighting-game palette swap.

## How it was made

- `js/` is the whole game, plain JavaScript on a 2D canvas, no dependencies.
  `chess.js` is the rules, `fight.js` the takedown routines, `game.js` one match.
- `art/raw/` holds the source sheets, drawn by an image model on a green screen
  (prompts in `tools/art-jobs.json`). `tools/process_art.py` keys them, cuts the frames,
  scales each piece to one size, snaps it to a shared palette, closes the ink outline and
  packs `assets/sprites/`.
- Effects are sprites too (`assets/fx.png`, built by `tools/draw_fx.py`). The organic ones
  (slashes, hit sparks, bursts, the pillar of light, dust) were drawn by the image model as
  8-frame sheets on black and redrawn on the game's own pixel grid at each size needed; the
  geometric ones (glints, the king's hairline cut, sparks, rubble, focus lines, wide
  shockwaves) are drawn in code. Each is stored as light levels and coloured per army, so
  Sun and Moon share the same drawings.
- The computer opponent is the game's own engine (`js/engine.js`): alpha-beta search with a
  transposition table, null-move pruning and late-move reductions over the PeSTO piece-square
  evaluation by Ronald Friederich. It runs in a background worker built from the page itself, so it
  works when the game is opened as a file. The weaker opponents score every move a few plies deep
  and pick by score with randomness (`js/ai.js`), which reads as human mistakes rather than dice.
  The review uses Lichess's published winning-chance and accuracy formulas and its bands for an
  inaccuracy, mistake and blunder. The tip in two steps, the warning before a bad move and the
  replay of your mistakes follow what Lichess, Chess.com's coach and Lucas Chess do.
- The installable app is a manifest, four icons (`tools/make_icons.py`) and `sw.js`, which keeps a copy of
  every game file on the device and refreshes it in the background. `tools/make-sw.mjs` writes `sw.js`
  with the file list and a version made from the files' contents; run it after changing game files.
  A changed `sw.js` is what tells a device there is a new version: it saves the whole new set, then
  `js/app.js` raises the restart notice.
- Sound effects and music were generated with ElevenLabs (`tools/gen-audio.mjs`). The effects are
  levelled and packed by `tools/pack-audio.mjs`; `tools/trim-music.mjs` cuts the silence off the end
  of each music track without re-encoding it.
- The backdrop animations are listed per arena in the `LIFE` table in `js/view.js`, as boxes in backdrop
  pixels. Cloth and fire are the picture's own pixels, redrawn in thin strips pushed slightly out of line.
  The koi are the painted ones: `tools/process_art.py` cuts them out of the sakura backdrop into
  `assets/bg/sakura_koi.png` and repaints the water where they were; the game swims each round a loop.
- `tools/trailer.mjs` records the trailer by stepping the real game frame by frame in
  headless Chrome and mixing in each sound at the moment the game played it.

```bash
node tests/perft.js                       # rules check: move counts against known totals
node tests/engine.js                      # engine check: move counts, must-find moves, speed
node tests/ladder.js 30                   # each opponent against the one above, prints the scores
node tools/drive.mjs "index.html?game&manual" tests/soak.json   # plays a whole random game, fights included
node tools/drive.mjs "index.html?game&ai=4" '[{"wait":1500},{"evalFile":"tests/solo.js"}]'   # a whole one-player game
uv run tools/process_art.py               # rebuild sprites from art/raw
uv run tools/draw_fx.py --preview         # rebuild effect sprites, write out/fx-preview.png
node tools/pack-audio.mjs                 # rebuild assets/sfx.js
node tools/trim-music.mjs                 # after generating music: cut trailing silence
node tools/drive.mjs "serve:index.html" tests/arena.json   # the fourth arena, and one theme handing over to the other
uv run tools/make_icons.py                # rebuild the app icons
node tools/make-sw.mjs                    # rebuild sw.js (the offline file list) after changing game files
MOBILE=844x390 node tools/drive.mjs "serve:index.html" tests/touch.json   # a phone-sized game played by touch
MOBILE=844x390 node tools/drive.mjs "serve:index.html" tests/app.json     # install parts, then play with the server stopped
node tools/drive.mjs "serve:index.html" tests/update.json                 # a pretend new version: notice, restart, new files
node tools/trailer.mjs                    # re-record trailer.mp4
```

## Licence

MIT. See [LICENSE](LICENSE).
