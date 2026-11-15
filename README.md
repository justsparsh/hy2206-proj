# A Hard Autumn

A short browser game for a class on the history of China. You govern a Chinese province through a drought, judged by a standard of good rule taken from Mencius. See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the design and [RESEARCH.md](RESEARCH.md) for the sources.

## Run

Requires Node 20.10 or later.

```
npm install
npm run dev        # play at the address Vite prints
npm test           # engine and content tests, including 600 simulated runs
npm run build      # static build in dist/
node scripts/sim.mjs   # balance statistics for several play styles
```

The build is a static site and can be hosted on any static host.

## Layout

- `src/engine/` game logic (no React): state, conditions, effects, turn flow, debrief.
- `src/content/` events, charges (the specific wrongs Lin can raise), facts and sources.
- `src/ui/` React components.
- `docs/` plan and the written arc.

## Status

Arc 1 only (eight turns). Balance is tuned by simulation, not yet by human playtests. Several source passages are still unverified; see `RESEARCH.md` and the source tags in `src/content/charges.js`.

## Dev note

`npm audit` reports advisories in the dev tooling (Vite 5 and Vitest 2, chosen for Node 20.10 compatibility). They affect the dev server only, not the built game.
