const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Runner, RULES, OBSTACLES } = require('../game-core.js');
const advance = (game, seconds) => { const events = []; for (let i=0; i<Math.round(seconds/RULES.step); i++) events.push(...game.update(RULES.step)); return events; };

test('a missed jump ends the run and stops scoring', () => {
  const game = new Runner(() => 0); game.start();
  assert.ok(advance(game, 8).includes('crash'));
  assert.equal(game.state, 'over');
  const distance = game.distance;
  advance(game, 30); assert.equal(game.distance, distance);
});

test('tap and hold produce different jump heights and both land exactly', () => {
  function peak(hold) {
    const game = new Runner(); game.start(); game.spawnIn = Infinity; game.pressJump();
    if (!hold) game.releaseJump();
    let min = game.player.y;
    for (let i = 0; i < 150; i++) { game.update(RULES.step); min = Math.min(min, game.player.y); }
    assert.equal(game.player.y, RULES.ground); assert.equal(game.player.airborne, false);
    return RULES.ground-min;
  }
  assert.ok(peak(true) > peak(false) + 40);
});

test('every obstacle has a forgiving clearable timing window at minimum and maximum speed', () => {
  for (const speed of [RULES.initialSpeed, RULES.maxSpeed]) {
    for (const kind of OBSTACLES) {
      let successes = 0;
      for (let lead = .10; lead < .75; lead += .01) {
        const game = new Runner(); game.start(); game.spawnIn = Infinity;
        game.time = (speed-RULES.initialSpeed)/2.3; game.speed = speed;
        game.obstacles = [{ ...kind, x: game.player.x+163+speed*lead, y: RULES.ground-kind.height, passed:false }];
        game.pressJump(); advance(game, 1.5);
        if (game.state === 'playing' && game.passed === 1) successes++;
      }
      assert.ok(successes >= 10, kind.type + ' at ' + speed + ' has only ' + successes + ' viable 10ms timings');
    }
  }
});

test('holding jump cannot automatically bounce or double-jump', () => {
  const game = new Runner(); game.start(); game.spawnIn = Infinity; game.pressJump();
  advance(game, .2); const velocity = game.player.vy;
  assert.equal(game.pressJump(), false); assert.equal(game.player.vy, velocity);
  advance(game, 1.8); assert.equal(game.player.airborne, false);
});

test('pause freezes the world; restart restores a clean first run', () => {
  const game = new Runner(); game.start(); advance(game, 2.5);
  game.state = 'paused'; const snapshot = JSON.stringify(game);
  advance(game, 2); assert.equal(JSON.stringify(game), snapshot);
  game.start(); assert.equal(game.score, 0); assert.equal(game.level, 1);
  assert.equal(game.obstacles.length, 0); assert.equal(game.speed, RULES.initialSpeed);
});

test('difficulty changes once per threshold, with bounded speed', () => {
  const game = new Runner(); game.start(); game.spawnIn = Infinity;
  game.distance = 3595;
  const events = advance(game, .5);
  assert.equal(game.level, 2); assert.equal(events.filter(e=>e==='level').length, 1);
  advance(game, 400); assert.equal(game.level, 10); assert.equal(game.speed, RULES.maxSpeed);
});

test('fixed simulation steps give identical runs at 30, 60, and 144Hz', () => {
  const simulate = fps => {
    const game = new Runner(() => .2); game.start(); let accumulated=0;
    for(let frame=0;frame<fps*4;frame++) {
      accumulated += 1/fps;
      while(accumulated+1e-10 >= RULES.step) {game.update(RULES.step);accumulated-=RULES.step;}
    }
    return JSON.stringify(game);
  };
  assert.equal(simulate(30),simulate(60)); assert.equal(simulate(60),simulate(144));
});

test('obstacle scheduling always leaves time to land and react', () => {
  for(const speed of [RULES.initialSpeed,RULES.maxSpeed]) {
    const game = new Runner(() => 0);game.start();game.speed=speed;game.spawn();
    const contactDuration=(128+game.obstacles[0].width)/speed;
    assert.ok(game.spawnIn-contactDuration >= 1.4);
  }
});
