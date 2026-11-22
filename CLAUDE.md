# CLAUDE.md — Ghoststroc

Project instructions. Read fully before writing code. Decisions in §2 were made
by the human in a design interview (2026-11-21) — build to them; don't quietly
substitute alternatives. The earlier 2D/turn-based spec is superseded (it lives
in git history before commit `77be038`'s successor).

## 1. What this is

**Ghoststroc** is a real-time, third-person, low-poly 3D mining game in the
browser. You ride the lift down into a dark maze, find copper, iron and gold,
and carry them back up to a bright, colourful surface town where you sell them
and buy better gear.

**The sentence:** *Two lamps. Red shows the rock. Cyan shows what will hold you
— and where the gold is. Only one can burn at a time.*

## 2. Settled decisions

| # | Decision | Value |
|---|---|---|
| 1 | Camera | Third-person follow camera, angled down, rotatable in 90° steps (Q/E). |
| 2 | Time | Real time. Fixed 60 Hz simulation step; render every frame. 60 fps target. |
| 3 | Core pressure | **Battery is the clock.** It drains continuously (faster deeper) and each lamp flash costs a chunk. At zero you have a few seconds of darkness, then you faint and lose what you carry. |
| 4 | Extra difficulty | **Tremors only** (for now): every ~70–110 s the mine rumbles (3 s warning) and some tunnels collapse while a few new passages open. Never weight, creatures or random-per-trip mazes unless asked. |
| 5 | Lamps (L1) | **Red** lights rock: walls, copper, iron. **Cyan** lights support and gold: solid floor glows, hollow floor stays black, gold veins appear. A dim red helmet lamp is always on near the player. Only one lamp at a time; pressing the other switches. |
| 6 | Lamp timing | Press → coloured rings radiate outward for **2 s** → lamp is active for **12 s** (fades in briefly, fades out over its last 2 s). |
| 7 | Hollow floor | Looks identical to floor under red/helmet light. Standing on it cracks it; after 0.8 s you fall to the next depth (battery cost). Falling from the deepest level = faint. |
| 8 | Materials | Copper, iron, gold. **Steel** is crafted at the town smelter: 2 iron → 1 steel (+fee). Steel sells high and is required for higher gear tiers. |
| 9 | Mazes | Three fixed maze maps (depth 1–3), generated from fixed seeds, larger and harsher each depth. Depth 1 is mostly copper; gold only at depth 2+. A ladder in depths 1–2 leads deeper and unlocks that depth on the lift. |
| 10 | Map | Press M. Uncharted areas are covered by drifting dark cloud. The path you walk is only **charted when you reach a checkpoint** (or the lift). Each maze has **4–5 checkpoints, always shown** even under cloud. The map has a compass. Tremors make charted areas go stale. |
| 11 | Town | Walkable, bright: green grass, blue sky, clouds, pond, trees. Buildings: Assay Office (sell), Smelter (iron→steel), Outfitter (gear), Mine Head (lift). |
| 12 | Art | Placeholder low-poly models built from primitives in code. The human will supply their own designs later — keep model construction isolated in `src/render/` so it can be swapped. |
| 13 | Platform | Browser, TypeScript strict, Vite, three.js. |

## 3. The lamp channel trick

Lamp light colour is literally an RGB channel. Mine materials are authored so
each lamp reflects only what it should:

- red-only albedo (walls, copper, iron, hollow floor) → visible under red, black under cyan
- G/B albedo (gold) → black under red, visible under cyan
- solid floor has all channels → visible under both; hollow floor has red only

So under red, hollow and solid floor look identical; under cyan, hollow is a
black gap. Keep these albedos channel-pure (`src/render/palette.ts`) — adding
green to a wall or red to gold breaks the mechanic.

## 4. Layout

```
src/
  main.ts            bootstrap, loop, mode switching, input
  sim/               PURE: no DOM, no three, no Math.random, no Date.now
    tuning.ts        every tunable number (EYE-TUNED ones marked)
    rng.ts maze.ts movement.ts lamp.ts tremor.ts run.ts town.ts economy.ts save.ts
  render/            three.js only: views, miner model, effects, camera
  ui/                DOM HUD, map overlay, shop panels
  audio/             Web Audio oscillator sfx (no sample files)
test/                vitest, headless, against sim/
```

`sim/` is deterministic given seeds + input sequence. Tests prove: maze
connectivity (every solid floor reachable from the lift without crossing
hollow), checkpoint count, lamp timing, hollow fall timing, charting, tremors
never disconnecting lift/checkpoints/ladder/player, economy rules, save
migration, determinism.

## 5. Rules

1. Never claim something looks or feels good — you can't see it. Verify
   numerically, screenshot if a browser tool is available, then ask for a look.
2. Never put DOM/three/wall-clock time/`Math.random` in `sim/`.
3. Never silently retune a constant: name it, old → new, and why.
4. Never ship a save-schema change without a migration (`sim/save.ts`).
5. No AI-generated images or audio. Placeholder art is code primitives; sound
   is synthesised.
6. Keep lamp albedos channel-pure (§3).

## 6. Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build
```

Commit after every code-changing prompt and push to `origin main`
(github.com/ishaan-cherukuri/ghoststroc). Run the tests first.
