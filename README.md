# Rocket Run — Trump & Elon

A horizontal, one-button desert runner inspired by the Chrome offline dinosaur game. Both riders stay seated on the same right-facing rocket throughout the run.

## Play

[Play the public web copy](https://whitehouse-rocket-run-tboy450.tboy450.chatgpt.site/), open `index.html` directly, or run `npm run dev` and visit the printed local address. The game and its font use local assets and have no runtime dependencies.

- **Space / Up / W / tap:** jump.
- **Hold:** jump higher. Release for a shorter jump.
- **P / Escape:** pause or resume.
- Losing window focus automatically pauses the game.
- Use **Fly Again** after a crash. Personal best is stored on the current device.
- Sound is optional and starts muted.
- Phone menus scroll normally, map buttons have larger tap targets, and landscape play fits around browser bars and screen cutouts. Rotate at any time; the run stays intact.
- A built-in pixel crew lets you launch even while the full artwork is loading. If that download fails, use **Retry artwork** in the menu.

## Five selectable sectors

| Sector | Background references | Four themed obstacles |
| --- | --- | --- |
| The Moon / Nevada | Gold lander, flag, surface rover, film camera, lights, TAKE 1969 board | Moon rock, film camera, lunar rover, studio light |
| Mars / Arizona | Layered canyons, two moons, habitats, solar arrays, rover, RED FILTER: ON sign | Red basalt, sample canister, Mars rover, relay mast |
| Area 51 | Searchlight, radar dish, hangars, surveillance vehicle, UFO, weather-balloon parking | Classified crate, parked UFO, alien, checkpoint barrier |
| Lockheed Martin / Skunk Works | Parked jets, hangars, control tower, spinning engine test rig, secret parking | Tool chest, jet engine, radar cart, equipment cart |
| SpaceX / Starbase | Coastal horizon, Starfactory, boosters, catch tower, crane, tanks, rapid-unscheduled-parking sign | Booster section, fuel tank, rocket engine, robot cart |

Choose a starting sector in the menu. Every 600 points queues the next sector, cycling through all five even after difficulty caps at level 10. New obstacles stop spawning while the current ones clear and the rocket finishes its jump. The scenery then dissolves over 2.2 seconds, followed by a 0.8-second arrival breather. Spawning resumes after another half second, with new hazards entering from the far edge. Flight and scoring continue throughout; pausing freezes the transition too.

The route indicator shows clearing, travel and arrival status. The welcome caption appears only once the obstacle lane is clear. Cleared hazards give +10 feedback, every fifth clear gets a small celebration, and crash messages vary by sector.

These are fictional game sets and satirical captions, not representations of actual facility layouts or scientific claims. All backgrounds and obstacles are original canvas pixel art, and none of the background props have collisions.

Background props now sit on a continuous rear ground surface, with contact shadows. Small groups vary in scale, spacing and depth, with occasional open desert stretches. Their positions are deterministic, so scenery scrolls smoothly without rearranging between frames.

## Public access

The hosted copy is public. Each visitor's game runs independently in their browser; there is no shared player slot or game server session. The localhost address only works on the machine running the development server and should not be sent to other players.

On September 8, 2026, four simultaneous anonymous HTTP clients loaded the public page and all six required resources successfully (28 successful responses, no sign-in redirects). Sites reported public access and no recent error logs. This checks asset delivery, not real-device behavior or a hosting capacity guarantee. Some responses took several seconds; artwork loading no longer blocks launch.

## Development

Requires Node 18 or newer for development commands; no package installation is needed.

```sh
npm run dev
npm test
npm run build
```

The static build goes to `dist/`. Hosting metadata is in `.openai/hosting.json`.

- `game-core.js`: fixed-step physics, themed obstacle catalogs, collision, scoring, spacing, progression.
- `game-art.js`: five background sets, twenty obstacle sprites, and map-specific captions.
- `game.js`: rendering orchestration, keyboard/touch input, audio, menus, local best, score feedback.
- `tests/`: deterministic simulation tests and controller tests using a minimal DOM adapter.
- `assets/rocket-duo.png`: generated player artwork; provenance and prompt in `assets/ARTWORK.md`.
- `SUBMISSION.md`: official contact route, research links, and an unsent submission inquiry.

## Validation

Automated checks cover all twenty obstacles' clearability at minimum/maximum speed, distinct valid obstacle drawings, stable varied scenery, variable jumps, consistent simulation at 30/60/144 Hz, pause/restart behavior, storage and image failures, independent visitors, phone-sized canvas changes, keyboard/touch handlers, all five menu choices, crash captions, and progression beyond level 10. Transition checks cover waiting for obstacles and landing, gradual compositing, pause/resize during a fade, and safe hazard resumption on every map at both minimum and maximum speed. Controller tests are not real-browser visual or accessibility testing.

## Credits and status

Independent arcade project. Not affiliated with or endorsed by Google, the White House, SpaceX, or Lockheed Martin. Barlow Condensed is bundled under the SIL Open Font License; see `assets/fonts/OFL.txt`.
