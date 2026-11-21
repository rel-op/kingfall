# KINGFALL

Pixel battle chess for two players on one machine. Every piece is a stone chessman that
wakes into a warrior when you pick it up, and every capture is a short fighting-game duel
fought on the board.

![trailer](trailer.mp4)

## Play

Open `index.html` in a browser. Nothing to install, no server needed.

| | Mouse | Gamepad | Keyboard |
|---|---|---|---|
| Move the cursor | point | stick or d-pad | arrows / WASD |
| Pick a piece, confirm | click | A | Enter / Space |
| Cancel | right click | B | Backspace / X |
| Toggle move hints | | X or Y | H |
| Menu | | Start | Esc |
| Full screen | | | F |

With two gamepads connected, pad 1 plays Sun and pad 2 plays Moon. With one, you pass it.
Press A or click during a fight to fast-forward it.

## What's in it

- Full chess rules: check, checkmate, stalemate, castling, en passant, promotion, and draws
  by repetition, fifty moves or bare material.
- Six pieces, each with a transformation, idle, run, hit and attack animation, and its own
  finishing routine: the pawn's dash-through thrust, the knight's double charge, the
  bishop's pillars of light, the rook golem's launcher and slam, the queen's blink-and-flurry,
  and the king's one-cut finish.
- Three arenas: Sakura Keep, Ember Forge, Frostmoon Abbey.
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
- Sound effects and music were generated with ElevenLabs (`tools/gen-audio.mjs`), then
  levelled and packed by `tools/pack-audio.mjs`.
- `tools/trailer.mjs` records the trailer by stepping the real game frame by frame in
  headless Chrome and mixing in each sound at the moment the game played it.

```bash
node tests/perft.js                       # rules check: move counts against known totals
uv run tools/process_art.py               # rebuild sprites from art/raw
node tools/pack-audio.mjs                 # rebuild assets/sfx.js
node tools/trailer.mjs                    # re-record trailer.mp4
```
