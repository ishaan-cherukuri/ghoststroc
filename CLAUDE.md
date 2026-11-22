# CLAUDE.md — Ghoststroc

Project instructions. Read this fully before writing any code. Design decisions
in §2 are settled — do not relitigate them or quietly substitute alternatives.
Where this file conflicts with a general instinct about how games are built,
this file wins.

---

## 1. What this is

**Ghoststroc** is a small turn-based pixel roguelite played in a browser. You
descend a collapsed mine carrying two lamps that each reveal a different half of
the truth about the ground in front of you, and you can never have both lit at
once.

**The sentence:** *Two lamps. One shows what's there, the other shows what's
holding it up. You never get to see both at the same time.*

### 1.1 Why this design

The core verb is **perception**, not combat or dodging. Nearly every roguelite is
about build choices or reflexes; this one is about fusing two incomplete images
and holding one of them in memory while you look at the other. That is the whole
hook, and every other system exists to serve it.

Structural model taken deliberately from PokéRogue: no account, instant start,
`localStorage` save, procedural runs, permadeath, and a persistent catalogue so a
run that kills you in ninety seconds still advanced something. Steal the
structure; invent everything else (see §4.1).

### 1.2 What success looks like at each stage

Stage 1 answers whether the mechanic works at all. Everything after is ordinary
roguelite construction. Do not build systems on top of an unvalidated core — see
§8.

---

## 2. Settled design decisions

These were decided and approved. Build to them.

| # | Decision | Value |
|---|---|---|
| 1 | Time model | **Turn-based.** Player acts, then the world ticks once. No real-time movement. |
| 2 | Lamps | **Discrete flashes with fade.** Not held beams. A flash lights its channel for a fixed number of turns, then decays to nothing. |
| 3 | Combat | **None in v1.** Creatures are moving hazards to avoid, never enemies to fight. |
| 4 | Run structure | **Extraction loop.** Each floor holds ore. After clearing it, choose to descend for richer seams or ride the lift out and bank what you carry. Death forfeits carried ore but keeps Survey Log entries. |
| 5 | Resolution | **320×192 logical canvas, 16px tiles, 20×12 tile grid**, integer-scaled ×4 to 1280×768. Never non-integer scale. |
| 6 | Name | **Ghoststroc.** Use this spelling everywhere — title, package name, repo, UI. It is intentional. |

Rationale for the two that look arbitrary:

- **Turn-based** because the fusion mechanic needs time to read. Real-time would
  convert a perceptual puzzle into a reflex test, wreck balance, and make the
  planned dichoptic fork (§10.2) unusable.
- **Flash-and-fade** because two permanently-lit layers reduce the mechanic to a
  static overlay, solvable at a glance. Fading forces the player to hold one
  channel in working memory while reading the other, which turns a perception
  puzzle into perception *plus* memory. This is the single most important
  mechanical decision in the project.

---

## 3. The core mechanic — exact specification

### 3.1 The two channels

Two independent information layers, each revealed by its own lamp.

- **RED channel — MATTER.** Where there is physical material: floor surfaces,
  walls, ore seams, creature bodies.
- **CYAN channel — SUPPORT.** Where the ground is structurally sound: bedrock
  beneath, load-bearing rock, and (as distinct glyphs) active threats such as gas
  vents.

Channels are **red and cyan specifically, not red and blue.** This is
non-negotiable: red/cyan is the anaglyph pair, which makes the dichoptic fork in
§10.2 a render-target change rather than a palette rewrite. Red and cyan are also
additive complements, so an overlap reads as near-white, which gives the player a
clean visual rule: *walk on the bright stuff.*

### 3.2 Walkability truth table

This is the game. Implement exactly this.

| Red (matter) | Cyan (support) | Tile meaning | Result of stepping on it |
|---|---|---|---|
| yes | yes | Sound floor | Safe |
| yes | no | Floor over a hollow | Holds for one turn, then collapses and you fall |
| no | yes | Open pit, bedrock far below | You fall immediately, take damage |
| no | no | Solid rock | Impassable, blocks movement |

The player's job every turn is an AND across two images they cannot see
simultaneously. Everything else is dressing.

Overlays on top of the base truth table:

| Overlay | Channel | Behaviour |
|---|---|---|
| Ore seam | Red, bright | Mine from an orthogonally adjacent tile; costs a turn |
| Gas vent | Cyan, animated glyph | Damages if you end a turn adjacent or on it |
| Stair down | Red | Descend to next floor |
| Extraction lift | Red | End run, bank carried ore |
| Creature | Red (body) + Cyan (predicted next tile) | Moving hazard; see §7.5 |

The creature case is the mechanic applied to time rather than space: red shows
where it *is*, cyan shows where it *will be*. Same fusion, different axis.

### 3.3 Flash and fade

- Each lamp has independent charges. A flash lights that channel across the whole
  visible grid.
- **Default fade: full brightness for 2 turns, then 3 turns of linear decay to
  zero.** So one flash is legible for roughly 5 turns. These numbers are starting
  values to be tuned by ear — in this case, by eye — and must live in one named
  constants block.
- Brightness drives which palette ramp step a tile renders at. A tile at decay
  step 0 uses the bright ramp; at the last step before dark it is barely
  distinguishable. The player must act before legibility is gone.
- **Both channels may be lit simultaneously in principle, but the fuel economy
  must make it rarely affordable.** Do not hard-block it; make it expensive. The
  tension comes from the player choosing to be partially blind, not from the game
  forbidding sight.

### 3.4 What must never happen

- No minimap, no persistent revealed-tile memory, no "remembered" dimmed tiles
  after a fade. The memory lives in the player's head. A UI that remembers for
  them destroys the mechanic, and it is the single most likely well-intentioned
  regression. Do not add it, even as an accessibility option — §10.1 lists what
  accessibility means here instead.
- No tile that announces its own walkability directly. All walkability is
  inferred from the two channels.

---

## 4. Hard constraints

### 4.1 Intellectual property

PokéRogue works partly because it uses sprites and UI lifted from official
Pokémon games. **We copy none of that.** Every creature, tile, glyph, name and
sound in Ghoststroc is original. No recognisable character, no franchise
creature, no borrowed sprite sheet, no fan-game framing, no asset packs with
unclear licensing. Creature designs should read as subterranean fauna of our own
invention — the kind of thing that lives in rock.

If a design starts resembling a known character, change it. The structural
borrowing (run loop, catalogue, localStorage, no-account start) is fine and
intended; visual or nominal borrowing is not.

### 4.2 No generated images, ever

All art is **hand-authored palette data written as code** (§5). No image
generation, no diffusion models, no AI-generated sprite sheets, no AI-generated
audio, no AI-generated text that ships to the player.

This is both an aesthetic decision and a practical one. Generated pixel art is
inconsistent at this scale and would taint the project's disclosure position: as
built, the honest itch.io disclosure is *AI-generated: code* and nothing else.
Keep it that way. If a sprite is needed, write the palette indices.

### 4.3 No medical or therapeutic claims

Applies to the base game and especially to the dichoptic fork in §10.2. Nothing
in UI copy, README, store page, code comments or outreach drafts may claim the
game treats, improves, corrects, trains away or diagnoses any condition.
Permitted framing: "a dichoptic game built to the parameters used in amblyopia
research." See §10.2 for the full evidence picture and why restraint here is
accurate rather than merely cautious.

---

## 5. Art pipeline — read before writing any sprite

The reason this project is buildable at all: at 16×16, a sprite is 256 palette
indices. That is data, not imagery.

### 5.1 How sprites are written

Author every sprite as an array of strings, one string per row, one character per
pixel, mapped through a shared character table. Readable in a diff, editable by
hand, diffable in git.

```ts
// '.' = transparent, '#' = index 1, etc. See CHAR_MAP in src/art/palette.ts
export const TILE_FLOOR_SOUND = [
  '################',
  '#..............#',
  '#.##..##..##...#',
  // ... 16 rows total, 16 chars each
] as const;
```

Enforce in a test that every sprite is exactly 16 rows of exactly 16 characters
and uses only characters present in `CHAR_MAP`. A malformed sprite should fail CI,
not render as garbage.

### 5.2 Palette

Sixteen colours, organised by channel. Do not add colours without updating this
table and the rationale.

| Index | Char | Hex | Role |
|---|---|---|---|
| 0 | `.` | — | Transparent |
| 1 | `k` | `#0b0a10` | Unlit / void black |
| 2 | `d` | `#1a1726` | Dark rock, barely-there structure |
| 3 | `r` | `#4a1526` | Red ramp — faded |
| 4 | `R` | `#a8243c` | Red ramp — mid |
| 5 | `X` | `#f2556b` | Red ramp — bright |
| 6 | `c` | `#0f3a42` | Cyan ramp — faded |
| 7 | `C` | `#1d8c99` | Cyan ramp — mid |
| 8 | `Y` | `#5fe3e8` | Cyan ramp — bright |
| 9 | `w` | `#8a95a8` | Overlap — faded (both channels dim) |
| 10 | `W` | `#f4f6fb` | Overlap — bright. **Safe floor reads as this.** |
| 11 | `o` | `#7a5a22` | Ore — faded |
| 12 | `O` | `#e8b04b` | Ore — bright |
| 13 | `h` | `#ff8a3c` | Hazard accent (gas, collapse warning) |
| 14 | `u` | `#cfd6e4` | UI text / player |
| 15 | `U` | `#5a6376` | UI dim / disabled |

**The player sprite renders into both channels always**, appearing in overlap
white. In the dichoptic fork this means the player is visible to both eyes, which
is required for fusion. Distinguish the player by silhouette, never by colour
alone.

### 5.3 Rendering

- Draw to an offscreen 320×192 canvas at 1:1.
- Blit to the visible canvas scaled ×4 with `ctx.imageSmoothingEnabled = false`.
- That is the entire pixel-art look. No shaders, no filters, no bloom.
- Channel brightness is applied by **selecting a ramp step**, not by alpha
  blending or global filters. A tile knows its channel and its decay step and
  looks up the appropriate palette index. This keeps every frame exactly
  on-palette, which matters for legibility and for the dichoptic fork.

### 5.4 Asset budget

Roughly 50 sprites total, about 12,800 palette indices. All of it hand-authored.

| Group | Count |
|---|---|
| Terrain tiles (4 truth-table states × 2 variants) | 8 |
| Overlays (ore ×3, gas, stair, lift, rubble) | 7 |
| Player (4 facings × 2 frames) | 8 |
| Creatures (3 species × 2 frames) | 6 |
| UI (lamp icons, fuel pips, ore counters, log glyphs) | ~12 |
| Font (subset: digits, A–Z, a few symbols, 8×8) | 1 sheet |

### 5.5 Audio

Synthesise with Web Audio — short square/triangle blips for flash, step, mine,
collapse and fall. No sample files, no generated audio. A dozen lines of
oscillator code is enough and keeps the project asset-free.

---

## 6. Tech stack and layout

TypeScript, strict mode, Canvas 2D, Vite. No game engine required. Phaser is
acceptable if it earns its weight later, but start without it — this game needs a
tilemap, a turn loop and a blitter.

```
ghoststroc/
├── CLAUDE.md
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.ts                 # bootstrap, canvas setup, input binding
│   ├── art/
│   │   ├── palette.ts          # PALETTE, CHAR_MAP — single source of truth
│   │   ├── tiles.ts            # terrain + overlay sprite data
│   │   ├── actors.ts           # player + creature sprite data
│   │   ├── ui.ts               # icons, font sheet
│   │   └── render.ts           # blitter, ramp selection, scaling
│   ├── sim/
│   │   ├── types.ts            # Tile, Channel, TileTruth, Actor
│   │   ├── grid.ts             # floor representation, truth-table queries
│   │   ├── turn.ts             # turn loop and ordering
│   │   ├── lamps.ts            # charges, flash, decay
│   │   ├── movement.ts         # player movement, collapse, falling
│   │   ├── creatures.ts        # movement AI + next-tile prediction
│   │   ├── ore.ts              # mining, carry weight
│   │   └── generate.ts         # procedural floor generation
│   ├── meta/
│   │   ├── run.ts              # descend / extract / death
│   │   ├── surveyLog.ts        # persistent catalogue
│   │   └── save.ts             # localStorage, versioned schema
│   └── ui/
│       ├── hud.ts
│       └── a11y.ts             # §10.1
├── test/                       # vitest
└── public/
```

Keep `sim/` free of any rendering or DOM reference. The simulation must be
testable headlessly and deterministic given a seed — that is what makes the whole
thing verifiable without eyes (§9).

---

## 7. Systems

### 7.1 Turn loop

1. Read player input; resolve exactly one player action (move, flash, mine, wait,
   descend, extract).
2. Decay both channels by one step.
3. Tick creatures; recompute predicted next tiles.
4. Resolve environment: collapses, falls, gas damage.
5. Check run-end conditions.

Deterministic given `(seed, action sequence)`. No wall-clock time anywhere in
`sim/`.

### 7.2 Lamps and fuel

- Two independent charge counters, shown as pips in the HUD.
- Charges refill only on descending a floor and from occasional pickups. They do
  not regenerate over turns — otherwise waiting becomes the optimal play and the
  tension evaporates.
- Flashing a channel already lit refreshes it to full brightness and consumes a
  charge. Allowed, usually a mistake, never blocked.

### 7.3 Movement and consequences

- Four-directional, one tile per turn.
- Stepping onto red-only (floor over hollow): the tile holds this turn, shows a
  hazard-accent crack, and collapses at the start of the next turn if the player
  is still on it. Gives one turn to react — the design wants tension, not gotchas.
- Stepping onto cyan-only (open pit): immediate fall, damage, and you land on the
  floor below at a corresponding position. Falling is a legitimate if costly route
  downward.
- Stepping into no-channel rock: move is rejected and costs no turn.

### 7.4 Ore and extraction

- Ore seams are mined from an adjacent tile, one turn each, yielding carried ore.
- Carry weight is capped; exceeding it is impossible rather than penalised.
- The lift banks carried ore and ends the run successfully. Stairs descend and
  refill lamp charges. Deeper floors hold richer seams and more hollow ground.
- Death forfeits carried ore. Survey Log entries persist regardless. This
  asymmetry is the retention mechanism; do not weaken it by letting death keep ore
  or by letting extraction preserve more than ore.

### 7.5 Creatures

Three species in v1, no combat. Each is a moving hazard with a **deterministic,
learnable** movement rule — the player should be able to predict them once they
understand the species, because prediction is the fun.

- Red channel shows the body at its current tile.
- Cyan channel shows its predicted next tile.
- Contact damages the player and knocks them back one tile.

Suggested rules: one patrols a fixed loop; one moves toward the player only when
a channel is lit (it hunts light); one is stationary but expands into adjacent
tiles on a fixed period. Keep them readable. No randomness in their rules beyond
the floor seed.

### 7.6 Procedural generation

- Seeded. Same seed produces the identical floor, always.
- Generate the truth-table grid first, then validate: there must exist a path from
  entry to stairs using only sound floor. **Reject and regenerate any floor that
  fails this check.** Assert it in tests.
- Difficulty scales by increasing the proportion of hollow and pit tiles and the
  creature count, not by reducing lamp charges below usability.
- Biomes: at least three, each with a distinct hazard mix and tile variant set, so
  descending feels like somewhere new.

### 7.7 Survey Log

Persistent across runs in `localStorage`. Records each rock type, ore type,
creature and hazard first encountered, with the floor depth where it was seen.
Shown on the title screen. This is the "every failed run was productive" lever —
it must be visible within the first thirty seconds of a new player's first death.

Version the save schema from day one and write a migration path. A breaking save
format change that wipes a player's log is an avoidable self-inflicted wound.

---

## 8. Build stages and gates

Do not proceed past a gate without explicit confirmation from the human.

| Stage | Deliverable | Gate |
|---|---|---|
| **1** | **Fusion legibility prototype.** One static hand-built room. Keyboard flashes each channel. Adjustable fade duration and palette via on-screen controls. No procgen, no ore, no creatures, no run loop. ~200 lines. | **Can the human read the safe path at a glance from two alternating, fading channels? Is holding one channel in memory interesting rather than merely annoying? If no, stop and tune palette and timing — do not build further.** |
| **2** | Playable single floor: movement, collapse, falling, mining, stairs. | Is a floor fun to clear? |
| **3** | Run loop: descend/extract, death, Survey Log, save. | Does a death make the human want another run? |
| **4** | Creatures, three biomes, difficulty curve, audio. | Is depth 5 meaningfully harder than depth 1 without being unfair? |
| **5** | Accessibility pass (§10.1), title screen, itch.io build. | Release. |

Stage 1 is the entire project's risk in two hundred lines. Build it first and
build nothing else until it passes.

---

## 9. Testing

The simulation is deterministic and headless, so most of the game is verifiable
without looking at it. Exploit that.

Required:

1. **Sprite integrity** — every sprite is 16 rows × 16 chars, all characters in
   `CHAR_MAP`.
2. **Palette integrity** — exactly 16 entries, all valid hex, indices contiguous.
3. **Truth table** — each of the four channel combinations produces the specified
   walkability result. Table-driven test.
4. **Generation solvability** — for 1,000 seeds, every generated floor has a
   sound-floor path from entry to stairs.
5. **Determinism** — identical `(seed, action sequence)` yields an identical final
   game state. Hash and compare.
6. **Decay** — a flash is legible for the specified number of turns and reaches
   exactly zero after the specified decay, with no off-by-one.
7. **Creature predictability** — each species' predicted next tile matches where
   it actually moves, for every species, over 100 turns. A wrong prediction is a
   lie to the player and the worst possible bug in this game.
8. **Save migration** — an old-schema save loads without losing Survey Log
   entries.
9. **Collapse timing** — stepping on red-only grants exactly one turn before
   collapse.

Run the suite before every commit.

---

## 10. Accessibility and planned variants

### 10.1 Base accessibility

- **Full keyboard control**, remappable and persisted. No mouse-only actions.
- **Never convey information by colour alone.** Every channel state must also
  differ in glyph or pattern — the terrain tiles for sound floor, hollow floor,
  pit and rock must be distinguishable in greyscale. Verify by screenshotting with
  saturation zeroed. This matters for colourblind players and it is also what
  makes the dichoptic fork coherent.
- **Palette swap support**: ship at least a deuteranopia-safe and a
  protanopia-safe alternate palette. Because all colour flows through one
  `PALETTE` table, this is a data change, not a code change — keep it that way.
- **Integer scale toggle** (×2 / ×4 / ×6). Pixel art at large scale is one of the
  most low-vision-friendly visual styles available; chunky high-contrast forms with
  no fine detail lose nothing when magnified. This is close to free and widens the
  audience substantially.
- Respect `prefers-reduced-motion` — reduce flash animation, never reduce
  information.
- Turn-based means no timing pressure anywhere. Preserve that; do not add timed
  sequences.

What accessibility does **not** mean here: a memory aid. The fade is the game
(§3.4). If a player wants more time, expose fade duration as a difficulty setting
with its own Survey Log marking, rather than adding a tile-memory overlay.

### 10.2 Planned fork: Ghoststroc Binocular (dichoptic)

**Do not build this until stage 5 of the base game ships.** Documented here so
the base architecture stays compatible.

The change: render the red channel to one eye and the cyan channel to the other,
viewed through red/cyan anaglyph glasses. The mental fusion the base game already
demands becomes literal binocular fusion. This is the architecture used by
dichoptic amblyopia research games. The therapeutic parameter is a **contrast
offset**: the weaker eye receives the high-contrast, information-critical channel
while the fellow eye's channel is attenuated, so the player cannot suppress the
weak eye without losing the game.

Architectural requirements this imposes on the base game, all already specified:
channels are red and cyan (§3.1); all colour flows through one palette table
(§5.2); brightness is ramp selection rather than filtering (§5.3); the player
renders to both channels (§5.2); information is never colour-only (§10.1).

**The evidence, stated honestly, because it governs how this is presented.**
Results are mixed. Gold-standard patching yields roughly 0.1 logMAR improvement
after about 120 hours. Positive findings: dichoptic iPad play outperformed sham
play in preschool children; one supervised dichoptic gaming study reported
treatment efficiency of 1.25 logMAR per 100 h versus 0.08 for occlusion. Null
findings: no benefit in children aged 7–12 with prior treatment, and no
significant difference versus a placebo game in 115 participants aged 7–55.
Reviews describe available efficacy results for these treatments as highly
variable.

**Therefore the position is not "this works."** It is: the research games were
custom-built and are largely unreleased, and there is no free, open-source,
web-based dichoptic game with clinician-adjustable contrast offset that an
orthoptist can simply hand to a family. Build that instrument; claim nothing about
outcomes. Route paediatric use through clinicians, keep any self-serve data
collection 18+, and state the anaglyph crosstalk limitation openly rather than
hiding it.

---

## 11. What Claude Code must NOT do

1. **Never claim the fusion reads well, looks good, or feels right.** You cannot
   see the output. You can verify the palette entries are distinct in hex and that
   ramp selection is correct; you cannot verify that two alternating fading
   channels resolve into a legible path on a human's monitor. Report what you
   verified numerically, then ask for a look.
2. **Never mark a stage gate as passed.** Only the human can.
3. **Never generate images or audio.** Hand-author palette data and synthesise
   audio with oscillators (§4.2, §5.5).
4. **Never add recognisable third-party characters, creatures, names or sprites**
   (§4.1).
5. **Never add a tile-memory overlay, minimap, or persistent revealed-tile
   display** (§3.4). This is the most likely well-intentioned regression in the
   project.
6. **Never make a therapeutic or medical claim** (§4.3, §10.2).
7. **Never let a creature's predicted next tile disagree with its actual move.**
8. **Never put rendering or DOM access inside `sim/`**, and never put wall-clock
   time in the simulation.
9. **Never use non-integer canvas scaling** or enable image smoothing.
10. **Never add a colour outside `PALETTE`**, and never apply global filters or
    alpha to fake brightness.
11. **Never silently retune a constant.** If a playtest implies a change, name the
    constant, the old value, the new value, and the reason.
12. **Never ship a save-schema change without a migration.**

### 11.1 How to request a look

When a change needs human eyes:

1. State what you changed and which constants moved.
2. Give the exact command to run it.
3. Give a numbered list of specific things to look at, each with a concrete
   question — "flash red only, wait 3 turns, then flash cyan: can you still
   remember where the sound floor was?" — not "does it look good?"
4. State what observation would mean the change was an improvement and what would
   mean revert.

Then stop and wait.

---

## 12. Conventions and commands

- TypeScript strict, no `any`. Vitest for tests.
- One named constants block per module. Every eye-tuned number carries a comment
  saying it is eye-tuned and expected to change.
- `sim/` is pure: no DOM, no `Date.now()`, no `Math.random()` — pass a seeded RNG.
- Commit messages describe the player-visible or perceptual consequence, not just
  the code change.
- Run the test suite before every commit.

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build
```

**You cannot open `index.html` as a `file://` URL** — JavaScript modules are
blocked by CORS there. It must be served over `http://localhost`. `npm run dev`
handles this.

---

## 13. Reference

| Quantity | Value |
|---|---|
| Logical canvas | 320 × 192 px |
| Tile size | 16 × 16 px |
| Visible grid | 20 × 12 tiles |
| Display scale | ×4 → 1280 × 768 (integer only) |
| Palette size | 16 colours |
| Flash full brightness | 2 turns |
| Flash decay | 3 turns, linear to zero |
| Total legible window per flash | ~5 turns |
| Creature species (v1) | 3 |
| Biomes (v1) | 3 |
| Approx. sprite count | ~50 |
| Approx. palette indices authored | ~12,800 |

| Term | Meaning |
|---|---|
| **Channel** | One of the two information layers: red (matter) or cyan (support) |
| **Flash** | One discrete lamp activation, lighting a channel for a fixed window |
| **Decay** | The per-turn reduction of a channel's brightness after a flash |
| **Truth table** | The four-way mapping of channel presence to walkability (§3.2) |
| **Hollow** | Red-only tile: floor with nothing supporting it |
| **Pit** | Cyan-only tile: bedrock with no floor above it |
| **Extraction** | Ending a run voluntarily via the lift, banking carried ore |
| **Survey Log** | The persistent cross-run catalogue of everything encountered |
| **Dichoptic** | Presenting different images to each eye; the planned fork (§10.2) |
| **Anaglyph** | Red/cyan filter glasses, the cheap way to achieve dichoptic display |
