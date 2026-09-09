/* Deterministic runner simulation. Rendering and input live in game.js. */
(function (root) {
  'use strict';
  const RULES = Object.freeze({ width: 1200, height: 570, ground: 464, playerX: 154,
    playerWidth: 200, playerHeight: 112, gravity: 1850, jumpVelocity: -780,
    initialSpeed: 330, maxSpeed: 680, step: 1 / 120,
    sectorFade: 2.2, sectorRest: .8, sectorSpawnDelay: .5 });
  const SECTOR_IDS = Object.freeze(['moon', 'mars', 'area51', 'lockheed', 'spacex']);
  const SECTOR_OBSTACLES = Object.freeze({
    moon: [
      { type: 'moon_rock', label: 'Moon rock', width: 44, height: 35 },
      { type: 'film_camera', label: 'Film camera', width: 34, height: 57 },
      { type: 'lunar_rover', label: 'Lunar rover', width: 64, height: 43 },
      { type: 'studio_light', label: 'Studio light', width: 32, height: 65 }
    ],
    mars: [
      { type: 'red_basalt', label: 'Red basalt', width: 42, height: 39 },
      { type: 'sample_canister', label: 'Sample canister', width: 32, height: 53 },
      { type: 'mars_rover', label: 'Mars rover', width: 64, height: 47 },
      { type: 'relay_mast', label: 'Relay mast', width: 34, height: 65 }
    ],
    area51: [
      { type: 'secret_crate', label: 'Classified crate', width: 40, height: 43 },
      { type: 'parked_ufo', label: 'Parked UFO', width: 60, height: 37 },
      { type: 'alien', label: 'Lost alien', width: 32, height: 62 },
      { type: 'checkpoint', label: 'Checkpoint barrier', width: 64, height: 47 }
    ],
    lockheed: [
      { type: 'tool_chest', label: 'Tool chest', width: 44, height: 39 },
      { type: 'jet_engine', label: 'Jet engine', width: 50, height: 53 },
      { type: 'radar_cart', label: 'Radar cart', width: 35, height: 63 },
      { type: 'equipment_cart', label: 'Equipment cart', width: 64, height: 44 }
    ],
    spacex: [
      { type: 'booster_section', label: 'Booster section', width: 62, height: 39 },
      { type: 'fuel_tank', label: 'Fuel tank', width: 34, height: 53 },
      { type: 'rocket_engine', label: 'Rocket engine', width: 40, height: 62 },
      { type: 'robot_cart', label: 'Robot cart', width: 58, height: 47 }
    ]
  });
  for (const list of Object.values(SECTOR_OBSTACLES)) {
    list.forEach(Object.freeze); Object.freeze(list);
  }
  const OBSTACLES = Object.freeze(Object.values(SECTOR_OBSTACLES).flat());
  function intersects(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }
  class Runner {
    constructor(random = Math.random) { this.random = random; this.reset(); }
    reset() {
      this.state = 'ready'; this.time = 0; this.distance = 0; this.score = 0; this.passed = 0;
      this.level = 1; this.speed = RULES.initialSpeed; this.obstacles = [];
      this.startSector = 0; this.completedSectors = 0; this.transition = null; this.collision = null;
      this.spawnIn = 2.1; this.jumpBuffer = 0; this.held = false;
      this.player = { x: RULES.playerX, y: RULES.ground, vy: 0, airborne: false, jumpTime: 0, cut: false };
    }
    start(sectorIndex = 0) {
      this.reset();
      this.startSector = Number.isInteger(sectorIndex) && sectorIndex >= 0 && sectorIndex < SECTOR_IDS.length ? sectorIndex : 0;
      this.state = 'playing';
    }
    get sectorIndex() { return (this.startSector + this.completedSectors) % SECTOR_IDS.length; }
    get sectorId() { return SECTOR_IDS[this.sectorIndex]; }
    get nextSectorScore() { return (this.completedSectors + 1) * 600; }
    get transitionProgress() { return this.transition?.phase === 'crossfade' ? Math.min(1, this.transition.elapsed / RULES.sectorFade) : 0; }
    pressJump() {
      if (this.state !== 'playing') return false;
      this.held = true; this.jumpBuffer = .13;
      if (!this.player.airborne) return this.jump();
      return false;
    }
    releaseJump() { this.held = false; }
    jump() {
      this.player.vy = RULES.jumpVelocity; this.player.airborne = true;
      this.player.jumpTime = 0; this.player.cut = false; this.jumpBuffer = 0; return true;
    }
    hitboxes() {
      const p = this.player;
      // Forgiving body/crew boxes exclude the flame, nose tip, and transparent sprite corners.
      return [
        { x: p.x + 35, y: p.y - 37, width: 128, height: 26 },
        { x: p.x + 60, y: p.y - 92, width: 69, height: 57 }
      ];
    }
    spawn() {
      if (this.transition) return;
      const choices = SECTOR_OBSTACLES[this.sectorId];
      const available = this.time < 8 ? 2 : choices.length;
      const kind = choices[Math.min(available - 1, Math.floor(this.random() * available))];
      // Obstacles retain their original art when a sector changes while they are on screen.
      this.obstacles.push({ ...kind, sector: this.sectorId, x: RULES.width + 35, y: RULES.ground - kind.height, passed: false });
      // At every speed there is room to land, react, and jump again.
      this.spawnIn = 1.45 + this.random() * .65 + (kind.width + 128) / this.speed;
    }
    update(dt) {
      if (this.state !== 'playing') return [];
      const events = [];
      this.time += dt; this.distance += this.speed * dt; this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
      const p = this.player;
      if (p.airborne) {
        p.jumpTime += dt;
        if (!this.held && !p.cut && p.jumpTime >= .12 && p.vy < -310) { p.vy *= .55; p.cut = true; }
        p.vy += RULES.gravity * dt; p.y += p.vy * dt;
        if (p.y >= RULES.ground) {
          p.y = RULES.ground; p.vy = 0; p.airborne = false; events.push('land');
          if (this.jumpBuffer > 0) { this.jump(); events.push('jump'); }
        }
      }
      for (const obstacle of this.obstacles) {
        obstacle.x -= this.speed * dt;
        const box = { x: obstacle.x + 4, y: obstacle.y + 4, width: obstacle.width - 8, height: obstacle.height - 4 };
        if (this.hitboxes().some(body => intersects(body, box))) {
          this.state = 'over'; this.collision = { type: obstacle.type, label: obstacle.label, sector: obstacle.sector };
          events.push('crash'); return events;
        }
        if (!obstacle.passed && obstacle.x + obstacle.width < p.x + 35) { obstacle.passed = true; this.passed++; events.push('pass'); }
      }
      this.obstacles = this.obstacles.filter(o => o.x + o.width > -40);
      this.score = Math.floor(this.distance / 12) + this.passed * 10;
      const nextLevel = Math.min(10, 1 + Math.floor(this.score / 300));
      if (nextLevel > this.level) { this.level = nextLevel; events.push('level'); }
      // Finish the old obstacle lane before changing scenery, without cancelling a jump.
      if (!this.transition && this.score >= this.nextSectorScore) {
        this.transition = { from: this.sectorIndex, to: (this.sectorIndex + 1) % SECTOR_IDS.length, phase: 'clearing', elapsed: 0 };
        events.push('approach');
      }
      const transition = this.transition;
      if (transition) {
        if (transition.phase === 'clearing') {
          if (!this.obstacles.length && !p.airborne) {
            transition.phase = 'crossfade'; transition.elapsed = 0; events.push('transition');
          }
        } else if (transition.phase === 'crossfade') {
          transition.elapsed += dt;
          if (transition.elapsed >= RULES.sectorFade) {
            this.completedSectors++; transition.phase = 'settling'; transition.elapsed = 0; events.push('sector');
          }
        } else {
          transition.elapsed += dt;
          if (transition.elapsed >= RULES.sectorRest) {
            this.transition = null;
            // Preserve an explicitly disabled spawner (used by deterministic simulations).
            if (Number.isFinite(this.spawnIn)) this.spawnIn = RULES.sectorSpawnDelay;
          }
        }
      } else {
        this.spawnIn -= dt;
        if (this.spawnIn <= 0) this.spawn();
      }
      this.speed = Math.min(RULES.maxSpeed, RULES.initialSpeed + this.time * 2.3);
      return events;
    }
  }
  const api = { Runner, RULES, OBSTACLES, SECTOR_IDS, SECTOR_OBSTACLES, intersects };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RocketRunner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
