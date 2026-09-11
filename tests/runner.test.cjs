const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Runner, RULES, OBSTACLES, FLYING_OBSTACLES, SECTOR_FLYERS, SECTOR_IDS, SECTOR_OBSTACLES } = require('../game-core.js');
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

test('every ground and flying obstacle has a forgiving jump window on levels 1, 2, 6 and 12', () => {
  for (const completedLevels of [0, 1, 5, 11]) {
    for (const kind of OBSTACLES) {
      let successes = 0;
      for (let lead = .10; lead < .75; lead += .01) {
        const game = new Runner(); game.start(); game.spawnIn = Infinity;
        game.completedSectors = completedLevels;
        game.obstacles = [{ ...kind, x: game.player.x+163+game.speed*(kind.flySpeed||1)*lead, y: RULES.ground-kind.height-(kind.altitude||0), passed:false }];
        game.pressJump(); advance(game, 1.5);
        if (game.state === 'playing' && game.passed === 1) successes++;
      }
      assert.ok(successes >= 10, kind.type + ' on level ' + (completedLevels+1) + ' has only ' + successes + ' viable 10ms timings');
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
  game.start(); assert.equal(game.score, 0); assert.equal(game.circuit, 1);
  assert.equal(game.obstacles.length, 0); assert.equal(game.speed, RULES.initialSpeed);
});

test('three full circuits from every starting map preserve map duration and boost after every level', () => {
  for (let start=0; start<SECTOR_IDS.length; start++) {
    const game = new Runner(); game.start(start); game.spawnIn = Infinity;
    let previousSpeed=game.speed, previousLength=game.sectorLength;
    for(let sector=0; sector<15; sector++) {
      const speed=game.speed, length=game.sectorLength, started=game.time;
      assert.equal(game.sectorIndex,(start+sector)%SECTOR_IDS.length);
      if(sector>0){
        assert.ok(Math.abs(speed/previousSpeed-1.15)<1e-10);
        assert.ok(Math.abs(length/previousLength-1.15)<1e-10);
      } else {assert.equal(speed,previousSpeed);assert.equal(length,previousLength);}
      for(let step=0;step<3600&&!game.transition;step++)game.update(RULES.step);
      assert.equal(game.transition?.phase,'crossfade');
      assert.ok(Math.abs(game.time-started-RULES.sectorLength/RULES.initialSpeed)<=RULES.step+1e-8);
      assert.equal(game.speed,speed,'no speed increase during a map or as its fade starts');
      const events=advance(game,RULES.sectorFade+RULES.sectorRest+.025);
      assert.equal(game.completedSectors,sector+1);assert.equal(game.transition,null);
      assert.equal(events.filter(e=>e==='circuit').length,(sector+1)%5===0?1:0);
      assert.equal(events.filter(e=>e==='level').length,1);
      assert.equal(game.level,sector+2);
      assert.equal(game.completedCircuits,Math.floor((sector+1)/5));
      // Start the measurement at the actual arrival, excluding test stepping overshoot.
      game.distance=game.sectorStartDistance;
      previousSpeed=speed;previousLength=length;
    }
    game.start(start);
    assert.equal(game.circuit,1);assert.equal(game.speed,RULES.initialSpeed);
    assert.equal(game.sectorStartDistance,0);assert.equal(game.sectorProgress,0);
  }
});

test('bonus points do not shorten maps and transition travel does not consume the next map', () => {
  const game=new Runner();game.start();game.spawnIn=Infinity;game.passed=1000;
  advance(game,5);assert.ok(game.score>600);assert.equal(game.transition,null);
  assert.equal(game.sectorLength,RULES.sectorLength);assert.equal(game.speed,RULES.initialSpeed);
  game.distance=game.sectorLength-1;game.update(RULES.step);
  advance(game,RULES.sectorFade+RULES.sectorRest+.05);
  assert.equal(game.transition,null);assert.ok(game.sectorStartDistance>RULES.sectorLength);
  assert.ok(game.sectorDistance<game.speed*.06);assert.ok(game.sectorProgress<.01);
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

test('spawn lead and actual hazard spacing scale by the same rate as speed and map length', () => {
  for(let sector=0;sector<SECTOR_IDS.length;sector++)for(const roll of [0,.26,.51,.99]){
    let base;
    for(const completedLevels of [0,1,2,5,11]){
      const game=new Runner(()=>roll);game.start((sector+5-completedLevels%5)%5);game.time=9;
      game.completedSectors=completedLevels;game.spawn();
      const first=game.obstacles[0],lead=first.x-(game.player.x+163),interval=game.spawnIn;
      const contactDuration=(128+first.width)/(game.speed*(first.flySpeed||1));
      assert.ok(interval-contactDuration>=1.45-1e-10);
      game.spawnIn=Infinity;advance(game,interval);game.spawn();
      assert.equal(game.state,'playing');assert.equal(game.obstacles.length,2);
      const gap=game.obstacles[1].x-first.x;
      if(!base)base={speed:game.speed,length:game.sectorLength,lead,gap,interval};
      const factor=game.speed/base.speed;
      assert.ok(Math.abs(lead/base.lead-factor)<1e-10);
      assert.ok(Math.abs(gap/base.gap-factor)<1e-10);
      assert.ok(Math.abs(game.sectorLength/base.length-factor)<1e-10);
      assert.equal(interval,base.interval);
      assert.ok(Math.abs(lead/game.speed-base.lead/base.speed)<1e-10);
    }
  }
});

test('each map retains its four ground designs and introduces themed aircraft after the warm-up', () => {
  for (let sector=0; sector<SECTOR_IDS.length; sector++) {
    const seen=new Set();
    const count=4+SECTOR_FLYERS[SECTOR_IDS[sector]].length;
    for(const roll of Array.from({length:count},(_,i)=>(i+.5)/count)) {
      const game=new Runner(()=>roll);game.start(sector);game.time=9;game.spawn();
      const obstacle=game.obstacles[0];seen.add(obstacle.type);
      assert.equal(obstacle.sector,SECTOR_IDS[sector]);
      assert.ok([...SECTOR_OBSTACLES[game.sectorId],...SECTOR_FLYERS[game.sectorId].map(i=>FLYING_OBSTACLES[i])].some(kind=>kind.type===obstacle.type));
    }
    assert.equal(seen.size,count);
    const warmup=new Runner(()=>.99);warmup.start(sector);warmup.spawn();assert.equal(warmup.obstacles[0].altitude,undefined);
  }
});

test('a threshold waits for old obstacles and a landing, without spawning or cancelling a jump', () => {
  const game=new Runner(()=>0);game.start(4);game.distance=7199;game.score=599;game.spawnIn=0;
  const kind=SECTOR_OBSTACLES.spacex[0];
  const old={...kind,sector:'spacex',x:50,y:RULES.ground-kind.height,passed:true};
  game.obstacles=[old];game.pressJump();
  const events=game.update(RULES.step);
  assert.ok(events.includes('approach'));assert.ok(!events.includes('transition'));
  assert.equal(game.transition.phase,'clearing');assert.equal(game.sectorId,'spacex');
  assert.equal(game.obstacles.length,1);assert.equal(game.obstacles[0],old);assert.equal(old.sector,'spacex');
  assert.ok(game.player.airborne);assert.ok(game.player.vy<0);
  advance(game,.5);assert.equal(game.obstacles.length,0);assert.ok(game.player.airborne);
  assert.equal(game.transition.phase,'clearing');
  assert.ok(advance(game,.5).includes('transition'));assert.equal(game.transition.phase,'crossfade');
  assert.equal(game.player.airborne,false);assert.equal(game.sectorId,'spacex');
});

test('each map gets a full fade and a clear arrival before its new hazards return on later circuits',()=>{
  for(let sector=0;sector<5;sector++)for(const completedCircuits of [0,1,2]){
    const game=new Runner(()=>0);game.start(sector);game.completedSectors=completedCircuits*5;
    game.distance=game.sectorLength-1;game.spawnIn=0;
    const events=game.update(RULES.step);assert.ok(events.includes('transition'));
    assert.equal(game.sectorIndex,sector);assert.equal(game.transitionProgress,0);
    advance(game,RULES.sectorFade-.1);assert.equal(game.sectorIndex,sector);assert.equal(game.obstacles.length,0);
    game.spawn();assert.equal(game.obstacles.length,0,'even an explicit spawn cannot interrupt a fade');
    const arrival=advance(game,.12);assert.equal(arrival.filter(e=>e==='sector').length,1);
    assert.equal(game.sectorIndex,(sector+1)%5);assert.equal(game.transition.phase,'settling');
    advance(game,RULES.sectorRest-.05);assert.equal(game.obstacles.length,0);
    advance(game,.05);assert.equal(game.transition,null);assert.equal(game.obstacles.length,0);
    advance(game,RULES.sectorSpawnDelay-.05);assert.equal(game.obstacles.length,0);
    advance(game,.1);assert.equal(game.obstacles.length,1);assert.equal(game.obstacles[0].sector,SECTOR_IDS[(sector+1)%5]);
    assert.ok(game.obstacles[0].x>RULES.width-80,'new hazards enter from the far edge');
  }
});

test('all transition phases freeze on pause and reset on a new launch',()=>{
  for(const phase of ['clearing','crossfade','settling']){
    const game=new Runner();game.start(3);game.transition={from:3,to:4,phase,elapsed:.4};
    game.state='paused';const snapshot=JSON.stringify(game);advance(game,5);assert.equal(JSON.stringify(game),snapshot);
    game.start(2);assert.equal(game.transition,null);assert.equal(game.completedSectors,0);assert.equal(game.sectorId,'area51');
  }
});

test('old hazards remain dangerous while the next sector is queued',()=>{
  const game=new Runner(()=>0);game.start();game.spawn();game.spawnIn=0;
  game.distance=7199;game.score=599;game.update(RULES.step);
  assert.equal(game.transition.phase,'clearing');
  game.obstacles[0].x=game.player.x+65;
  assert.ok(game.update(RULES.step).includes('crash'));assert.equal(game.sectorId,'moon');
  assert.equal(game.transition.phase,'clearing');assert.equal(game.collision.sector,'moon');
});

test('collisions report the actual themed obstacle for the result message', () => {
  const game=new Runner(()=>0);game.start(3);game.spawn();game.spawnIn=Infinity;
  const obstacle=game.obstacles[0];obstacle.x=game.player.x+65;
  game.update(RULES.step);
  assert.equal(game.state,'over');assert.equal(game.collision.type,'tool_chest');
  assert.equal(game.collision.sector,'lockheed');assert.equal(game.collision.label,'Tool chest');
});

test('a level boost waits for the last hazard, landing and full fade; pause cannot trigger it', () => {
  const game=new Runner(()=>0);game.start();game.completedSectors=4;
  game.distance=game.sectorLength-1;game.spawnIn=0;
  const initial=game.speed;
  const kind=SECTOR_OBSTACLES.spacex[0];
  game.obstacles=[{...kind,sector:'spacex',x:50,y:RULES.ground-kind.height,passed:true}];
  game.pressJump();advance(game,.5);
  assert.equal(game.transition.phase,'clearing');assert.equal(game.speed,initial);
  assert.ok(game.player.airborne);advance(game,.5);
  assert.equal(game.transition.phase,'crossfade');assert.equal(game.circuit,1);
  game.state='paused';advance(game,20);assert.equal(game.circuit,1);
  game.state='playing';advance(game,RULES.sectorFade-.3);
  assert.equal(game.circuit,1);assert.equal(game.obstacles.length,0);
  const events=advance(game,.35);
  assert.equal(events.filter(e=>e==='circuit').length,1);
  assert.equal(game.circuit,2);assert.ok(Math.abs(game.speed/initial-1.15)<1e-10);
  assert.equal(game.sectorId,'moon');assert.equal(game.transition.phase,'settling');
});

test('low aircraft collide without a jump, fly faster than scenery, and retain safe entry timing',()=>{
  for(const kind of FLYING_OBSTACLES){
    const game=new Runner();game.start();game.spawnIn=Infinity;
    game.obstacles=[{...kind,sector:'area51',x:1000,y:RULES.ground-kind.height-kind.altitude,passed:false}];
    advance(game,.1);assert.ok(Math.abs(game.obstacles[0].x-(1000-game.speed*kind.flySpeed*.1))<1e-8);
    const events=advance(game,3);assert.ok(events.includes('crash'));assert.equal(game.collision.type,kind.type);
  }
  for(let level=0;level<12;level++)for(let sector=0;sector<5;sector++){
    const game=new Runner(()=>.99);game.start(sector);game.completedSectors=level;game.time=9;game.spawn();
    const o=game.obstacles[0];assert.ok(o.altitude>0);
    assert.ok(Math.abs((o.x-game.player.x-163)/(game.speed*o.flySpeed)-(RULES.width+35-RULES.playerX-163)/RULES.initialSpeed)<1e-10);
  }
});

test('very fast hazards cannot tunnel through the crew between simulation steps',()=>{
  for(const kind of [OBSTACLES[0],...FLYING_OBSTACLES])for(const airborne of [false,true]){
    const game=new Runner();game.start();game.completedSectors=39;game.spawnIn=Infinity;
    if(airborne){game.player.y=RULES.ground-160;game.player.airborne=true;game.held=true;}
    game.obstacles=[{...kind,x:game.player.x+205,y:RULES.ground-kind.height-(kind.altitude||0),passed:false}];
    const events=game.update(RULES.step);
    assert.equal(events.includes('crash'),!airborne);
    if(airborne)assert.equal(game.passed,1);
  }
});
