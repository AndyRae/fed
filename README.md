# Five Safes Archipelago

**An explorable 3D world that teaches how the Five Safes TES weave performs
federated analysis across Trusted Research Environments (TREs).**

The geography and motion represent the real Five Safes TES protocol; the
timings are deliberately scaled so people can watch the choreography happen.
It is a model, not an emulator: no real TES tasks execute in the browser and
no real data exists anywhere in the application.

> **Status:** early build. The simulation core, both flagship tours, and the
> HUD/tour UI work end to end. Picking/inspector (click any entity to see its
> technical detail) and live ferry/crate motion synced to a running tour are
> not built yet — see `SIMPLIFICATIONS.md`.

## Run it

**Prerequisites:** Node.js 20 or newer, and a browser with WebGL2.

This repo pins Node 24 via a `.node-version` file. If you use
[fnm](https://github.com/Schniz/fnm) or nvm with shell auto-switching enabled
(`fnm env --use-on-cd`, or nvm's equivalent), `cd`-ing into this directory
picks the right version automatically. Otherwise, check manually:

```bash
node -v   # must print v20 or higher
```

Then:

```bash
npm install
npm run dev
```

Vite will print a local URL (typically `http://localhost:5173`) — open it in
your browser. You should see an island (or more — see `main.ts`'s
`DEMO_TRES`) and a mainland, with ferries and crates animating in the
background, and a live activity panel in the bottom-left corner tallying
the whole funnel. Use the two buttons in the top-right to start a guided
tour; while touring, use `←`/`→`/Space to step, Escape to exit back to
free-roam, and click **Technical detail** on any narration card to expand
the technical register.

## Other scripts

```bash
npm test         # run the test suite once
npm run test:watch
npm run typecheck
npm run build     # typecheck + production build to dist/
npm run preview   # serve the production build locally
```

## If `npm run dev` doesn't start

- **Wrong Node version.** Run `node -v`. If it's below 20 (Node 18 is a
  common macOS/Homebrew default), switch first: `fnm use 24` or `nvm use 20`
  (or newer), then retry. If you have fnm or nvm's shell hook installed but
  it still isn't picking up `.node-version`, open a new terminal tab/window
  in this directory rather than reusing an old one — the hook only fires on
  `cd`.
- **Dependencies not installed.** Run `npm install` first; `npm run dev`
  assumes `node_modules/` already exists.
- **Port already in use.** Vite defaults to `5173` and will pick the next
  free port automatically, printing whichever URL it actually bound —
  check the terminal output rather than assuming `5173`. To force a port:
  `npm run dev -- --port 5183`.
- **Blank page in the browser.** Open the browser's dev console. This app
  requires WebGL2; an old browser or a machine with GPU access disabled
  (some CI containers, some remote-desktop setups) will fail silently
  otherwise.

If none of that explains it, please share the exact error text (terminal
output, or the browser console) so it can be diagnosed properly.

## Project layout

```
src/
  core/     shared contracts, event bus, registry, theme, utilities
  sim/      pure TypeScript model of the Five Safes TES protocol
  world/    three.js geometry and real-world layout, one module per zone
  engine/   renderer, camera rig, ferry/flow animation
  ui/       HUD, tour player, narration panel
```

See `CLAUDE.md` for the full architecture, honesty rules, and world
metaphor this project is built against, and `SIMPLIFICATIONS.md` for the
material departures from the real Five Safes TES protocol this model makes.
