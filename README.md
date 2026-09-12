# Rocket Run — Trump & Elon

A one-button desert runner inspired by the Chrome offline dinosaur game, with a classic horizontal view and two 3D perspectives. Both riders stay seated on the same rocket throughout the run.

## Play

[Play the public web copy](https://whitehouse-rocket-run-tboy450.tboy450.chatgpt.site/), open `index.html` directly, or run `npm run dev` and visit the printed local address. The game and its font use local assets and have no runtime dependencies.

- **Space / Up / W / tap:** jump.
- **Hold:** jump higher. Release for a shorter jump.
- **P / Escape:** pause or resume.
- **C / View:** cycle through 3D Angle, 3D Chase and Classic. The menu, toolbar and pause screen include touch-friendly View buttons. Your choice saves on this device.
- Losing window focus automatically pauses the game.
- Use **Fly Again** after a crash. Personal best is stored on the current device.
- Sound is optional and starts muted.
- Phone menus scroll normally, map buttons have larger tap targets, and landscape play fits around browser bars and screen cutouts. Rotate at any time; the run stays intact.
- A built-in pixel crew lets you launch even while the full artwork is loading. If that download fails, use **Retry artwork** in the menu.

## Camera perspectives

The default 3D Angle view shows a horizontal rocket with depth, shaded geometry and ground shadows. 3D Chase looks down the route from behind the crew. Both 3D views reuse the original detailed crew PNG on a single curved, perspective-mapped front with connected, shaded side walls and beveled edges, preserving the original hair, outfits, rocket proportions and teal window. The surface has separate rounded volumes for both heads and torsos, a cylindrical rocket body, a tapered nose and thin fins. The angled view tilts the artwork slightly toward the camera; that tilt eases away when switching to chase, aligning the rocket and riders with the route ahead. A small alpha outline is traced once from the image, retaining holes and separate shapes; side colors are sampled from nearby artwork and blended along the contour. This is a 2.5D model within the 3D world; the simpler geometric crew remains available while the image loads. Classic retains the original side-on pixel artwork. On touchscreens, a quick double-tap in the play area cycles views: the first tap jumps immediately and the second changes the camera without another jump input. Holds, drags, cancelled touches and menu buttons do not trigger the gesture. Desktop players can press C during a jump; switching cameras preserves position, velocity, obstacles, score and pause state. Reduced-motion mode switches cameras immediately.

The 21 non-jet foreground hazards reuse the classic obstacle drawing code on small cached textures with shaded depth layers and ground shadows. Low-flying jets retain the original solid 3D model, aligned with their flight direction. Vehicles turn more toward the route in chase view; other shapes keep a wider face for readability. Wheels, engine fans and saucer lights retain their animations at 12 texture updates per second, while static designs are drawn once. Both scene renderers share the cache, and obstacle positions, dimensions, flight heights and collisions still come from the same simulation.

Inspired by the perspective concept in [3D Dino Run](https://www.y8.com/games/3d_dino_run), the background uses original low-poly landers, habitats, hangars, jets, saucers and Starbase towers. The renderer projects actual 3D coordinates onto Canvas 2D, clips the near plane and sorts surfaces and textured triangles by depth. The original image file stays unchanged; shaded textures exist only in memory. It needs no WebGL library, remote model downloads or additional network dependencies. Camera framing is checked numerically across phone and desktop aspect ratios. An earlier character revision was inspected in both 3D views in a 370-pixel-wide browser preview; the latest rounded crew was checked in the local chase view, and automated checks cover the geometry, obstacles and gestures. Physical-phone performance testing remains to be done.

## Desktop shortcut

On Windows, run `scripts/install-desktop-shortcut.ps1` to add **Rocket Run** to your desktop. It opens the public game in your default browser and uses the included White House rocket badge. Logo files and the generation prompt are in `assets/desktop/README.md`.

## Five selectable sectors

| Sector | Classic background references | Four ground obstacles |
| --- | --- | --- |
| The Moon / Nevada | Gold lander, flag, surface rover, film camera, lights, TAKE 1969 board | Moon rock, film camera, lunar rover, studio light |
| Mars / Arizona | Layered canyons, two moons, habitats, solar arrays, rover, RED FILTER: ON sign | Red basalt, sample canister, Mars rover, relay mast |
| Area 51 | Searchlight, radar dish, hangars, surveillance vehicle, UFO, weather-balloon parking | Classified crate, parked UFO, alien, checkpoint barrier |
| Lockheed Martin / Skunk Works | Parked jets, hangars, control tower, spinning engine test rig, secret parking | Tool chest, jet engine, radar cart, equipment cart |
| SpaceX / Starbase | Coastal horizon, Starfactory, boosters, catch tower, crane, tanks, rapid-unscheduled-parking sign | Booster section, fuel tank, rocket engine, robot cart |

Low-flying UFOs join the Moon and Mars routes; jets patrol Skunk Works; both appear around Area 51 and Starbase. They enter after the initial warm-up and must be jumped. Aircraft move faster than ground hazards, start farther away to compensate, and have visible ground shadows. They share collision and jump physics across all views.

Choose a starting sector in the menu. Each map is one level. Finishing every level increases speed by 15% during the clear arrival transition: level 1 runs at 100%, level 2 at 115%, level 3 at 132.25%, and so on. Fly through all five maps to complete a circuit and return to your starting map; the boost continues on every map.

Obstacle spacing, spawn distance ahead of the rocket, and map length use that same multiplier. Level 1 is 600 in-game metres, level 2 is 690 metres and level 3 is 793.5. Faster levels retain the same map travel time and time between hazards; jump physics and obstacle sizes stay the same. Bonus points do not shorten maps, and transition travel does not count against the next map's distance. Swept collision detection prevents fast hazards from skipping through the crew between simulation steps.

At the end of each map, new obstacles stop spawning while the current ones clear and the rocket finishes its jump. The scenery then dissolves over 2.2 seconds, followed by a 0.8-second arrival breather. Spawning resumes after another half second, with new hazards entering from ahead. Flight and scoring continue throughout; pausing freezes the transition too. Each speed boost takes effect after the map's fade, when no old hazards remain.

The route indicator shows distance remaining, clearing, travel and arrival status. The level counter and speed readout track progression, with a circuit-complete announcement every fifth map. Welcome captions appear only once the obstacle lane is clear. Cleared hazards give +10 feedback, every fifth clear gets a small celebration, and crash messages vary by sector.

These are fictional game sets and satirical captions, not representations of actual facility layouts or scientific claims. Backgrounds and obstacles use original pixel art or low-poly geometry, and none of the background props have collisions.

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
- `game-art.js`: five background sets, twenty ground sprites, two flying hazards, and map-specific captions.
- `game-3d.js`: perspective cameras, software 3D projection, models and themed environments.
- `game.js`: rendering orchestration, keyboard/touch input, audio, menus, local best, score feedback.
- `tests/`: deterministic simulation tests and controller tests using a minimal DOM adapter.
- `assets/rocket-duo.png`: generated player artwork; provenance and prompt in `assets/ARTWORK.md`.
- `SUBMISSION.md`: official contact route, research links, and an unsent submission inquiry.

## Validation

47 automated checks cover all 22 hazards' clearability on levels 1, 2, 6 and 12; continuous collisions at high speed; three full circuits from every start; proportional speed, spacing and distance; keyboard/touch controls and quick double-tap camera gestures; pause/restart; image/storage failures; and independent visitors. Perspective checks cover camera switching mid-jump, all 3D map/hazard geometry, near-plane clipping, full-crew jump framing across aspect ratios, the single crew texture and its canvas transforms, outline tracing and connected side walls, original obstacle textures and animation caching, smooth obstacle rotation with correct altitude and bounded thickness, and pause/resize/camera changes during a scene fade. Controller tests are not real-browser visual or accessibility testing.

## Credits and status

Independent arcade project. Not affiliated with or endorsed by Google, the White House, SpaceX, or Lockheed Martin. Barlow Condensed is bundled under the SIL Open Font License; see `assets/fonts/OFL.txt`.
