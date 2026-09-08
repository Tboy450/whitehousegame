# Rocket Run — Trump & Elon

A horizontal, one-button desert runner inspired by the Chrome offline dinosaur game. Both riders stay seated on the same right-facing rocket throughout the run.

## Play

Open `index.html` directly, or run `npm run dev` and visit the printed local address. The game and its font use local assets and have no runtime dependencies.

- **Space / Up / W / tap:** jump.
- **Hold:** jump higher. Release for a shorter jump.
- **P / Escape:** pause or resume.
- Losing window focus automatically pauses the game.
- Use **Fly Again** after a crash. Personal best is stored on the current device.
- Sound is optional and starts muted.

## Five selectable sectors

| Sector | In-game location caption | Scenery |
| --- | --- | --- |
| The Moon* | *a.k.a. the Nevada desert. | Pale desert, low mesas |
| Mars* | *Arizona, with the saturation turned up. | Red sand, layered buttes, two moons |
| Area 51 | Just a weather balloon. Keep moving. | Night sky, hangars, radar, a floating saucer |
| Lockheed Martin / Skunk Works | Even the cacti signed NDAs. | Airfield, hangars, control tower |
| SpaceX / Starbase | Some assembly required. Rapid disassembly included. | Coastal desert, assembly buildings, tower and tanks |

Choose a starting sector in the menu. Scenery advances every two levels, and wraps through all five. These are fictional game sets and satirical captions, not representations of actual facility layouts or scientific claims.

## Development

Requires Node 18 or newer for development commands; no package installation is needed.

```sh
npm run dev
npm test
npm run build
```

The static build goes to `dist/`. Hosting metadata is in `.openai/hosting.json`.

- `game-core.js`: fixed-step physics, collision, scoring, spacing, progression.
- `game.js`: canvas scenery, keyboard/touch input, audio, menus, local best.
- `tests/`: deterministic simulation tests and controller tests using a minimal DOM adapter.
- `assets/rocket-duo.png`: generated player artwork; provenance and prompt in `assets/ARTWORK.md`.
- `SUBMISSION.md`: official contact route, research links, and an unsent submission inquiry.

## Validation

Automated checks cover obstacle clearability at minimum/maximum speed, variable jumps, consistent simulation at 30/60/144 Hz, pause/restart behavior, storage failures, keyboard/touch handlers, all five menu choices, and sector progression. Controller tests are not real-browser visual or accessibility testing.

## Credits and status

Independent arcade project. Not affiliated with or endorsed by Google, the White House, SpaceX, or Lockheed Martin. Barlow Condensed is bundled under the SIL Open Font License; see `assets/fonts/OFL.txt`.
