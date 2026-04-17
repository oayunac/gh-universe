# GitHub Universe

A pure frontend visualization of GitHub repositories as stars and planets.

- **owner = star** — brightness reflects combined popularity of that owner's repos in your universe.
- **repo = planet** — orbits its owner-star; brightness reflects star count.

Zoom out to see your universe. Click a star to enter its system and watch its planets orbit.

## Features

- Manually add repos by `owner/repo` or a GitHub URL.
- Import repositories starred by any public GitHub username, and review before confirming.
- Local persistence via `localStorage` — your universe survives refreshes.
- Deterministic, hash-based layout so the same owner and repo appear in the same place across sessions.
- Log-compressed brightness encoding for calm visuals.
- Two-tier view: universe (stars only) and system (orbits + planets) revealed by zoom/click.

## Stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + TypeScript
- [react-three-fiber](https://docs.pmnd.rs/react-three-fiber) on top of [three.js](https://threejs.org/)
- [Zustand](https://zustand-demo.pmnd.rs/) for state
- No backend, no auth, public GitHub API only

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default `http://localhost:5173`).

Other scripts:

```bash
npm run build      # typecheck + production bundle
npm run preview    # preview the production bundle locally
npm run typecheck  # TypeScript only
```

## Project structure

```
src/
  App.tsx                  # app shell and scene switching
  main.tsx                 # React entry
  styles/globals.css       # all styling
  api/github.ts            # public GitHub API client
  store/useUniverseStore.ts# Zustand store (state + actions + persistence)
  types/
    github.ts              # raw GitHub API types
    universe.ts            # app-level normalized types
  utils/
    brightness.ts          # log-compressed brightness mapping
    hash.ts                # FNV-1a + mulberry32 for deterministic layout
    layout.ts              # star and planet position helpers
    normalize.ts           # raw -> app model, group by owner
    parseRepoInput.ts      # `owner/repo` + URL parser
    storage.ts             # localStorage wrapper
  components/
    ControlPanel.tsx       # left sidebar container
    RepoInput.tsx          # manual repo input
    StarredImport.tsx      # username -> starred import + review
    RepoList.tsx           # current universe contents
    InfoCard.tsx           # hover details in system view
  scene/
    UniverseScene.tsx      # universe view (stars only)
    StarSystemScene.tsx    # system view (orbits + planets)
    StarNode.tsx           # owner-star
    PlanetNode.tsx         # repo-planet
    OrbitRing.tsx          # orbit line
    BackgroundStars.tsx    # ambient starfield
```

## How it works

- **Data flow**: manual add or import → fetch raw GitHub data → normalize into `Repo` → persist to `localStorage` → group by owner into `OwnerSystem[]` → feed the scenes.
- **Rendering**: a single `<Canvas>` swaps between `UniverseScene` (zoomed out, stars only) and `StarSystemScene` (zoomed in on one owner, with orbits and planets). Clicking empty space returns to the universe.
- **Layout**: owner position and planet orbit parameters are derived from the string hash of their identifiers, so the universe is stable across sessions.
- **Brightness**: `log10(stars + 1)` normalized into a minimum-floor range so low-star repos remain faintly visible but popular ones don't dominate.

## Rate limits

The public GitHub API allows ~60 unauthenticated requests per hour per IP. Adding repos or importing a user's starred list will return a clear error when the limit is hit — wait until the reset time shown in the message.

## Extension ideas

- Orbit zoom controls (mouse wheel / pinch) in addition to click-to-focus.
- Color encoding by primary `language` or recency of `pushed_at`.
- Tag a repo with a custom category that appears as a planet ring.
- Persist multiple named universes and switch between them.
- Export/import your universe as JSON.
- Optional PAT input to raise the GitHub rate limit locally.
