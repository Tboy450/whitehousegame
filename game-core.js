/* Deterministic runner simulation. Rendering and input live in game.js. */
(function (root) {
  'use strict';
  const RULES = Object.freeze({ width: 1200, height: 570, ground: 464, playerX: 154,
    playerWidth: 200, playerHeight: 112, gravity: 1850, jumpVelocity: -780,
    initialSpeed: 330, maxSpeed: 680, step: 1 / 120 });
  const OBSTACLES = Object.freeze([
    { type: 'cactus', width: 29, height: 53 },
    { type: 'rock', width: 44, height: 35 },
    { type: 'double', width: 64, height: 48 },
    { type: 'tall', width: 34, height: 67 }
  ]);
  function intersects(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }
  class Runner {
    constructor(random = Math.random) { this.random = random; this.reset(); }
    reset() {
      this.state = 'ready'; this.time = 0; this.distance = 0; this.score = 0; this.passed = 0;
      this.level = 1; this.speed = RULES.initialSpeed; this.obstacles = [];
      this.spawnIn = 2.1; this.jumpBuffer = 0; this.held = false;
      this.player = { x: RULES.playerX, y: RULES.ground, vy: 0, airborne: false, jumpTime: 0, cut: false };
    }
    start() { this.reset(); this.state = 'playing'; }
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
      const available = this.level < 2 ? 2 : OBSTACLES.length;
      const kind = OBSTACLES[Math.min(available - 1, Math.floor(this.random() * available))];
      this.obstacles.push({ ...kind, x: RULES.width + 35, y: RULES.ground - kind.height, passed: false });
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
      this.spawnIn -= dt;
      if (this.spawnIn <= 0) this.spawn();
      for (const obstacle of this.obstacles) {
        obstacle.x -= this.speed * dt;
        const box = { x: obstacle.x + 4, y: obstacle.y + 4, width: obstacle.width - 8, height: obstacle.height - 4 };
        if (this.hitboxes().some(body => intersects(body, box))) { this.state = 'over'; events.push('crash'); return events; }
        if (!obstacle.passed && obstacle.x + obstacle.width < p.x + 35) { obstacle.passed = true; this.passed++; events.push('pass'); }
      }
      this.obstacles = this.obstacles.filter(o => o.x + o.width > -40);
      this.score = Math.floor(this.distance / 12) + this.passed * 10;
      const nextLevel = Math.min(10, 1 + Math.floor(this.score / 300));
      if (nextLevel > this.level) { this.level = nextLevel; events.push('level'); }
      this.speed = Math.min(RULES.maxSpeed, RULES.initialSpeed + this.time * 2.3);
      return events;
    }
  }
  const api = { Runner, RULES, OBSTACLES, intersects };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RocketRunner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
