/* Canvas scene, accessible menus, and one shared animation loop. */
(() => {
  'use strict';
  const { Runner, RULES } = window.RocketRunner;
  const game = new Runner();
  const $ = id => document.getElementById(id);
  const canvas = $('gameCanvas'), ctx = canvas.getContext('2d'), stage = $('stage');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let state = 'menu', ready = false, lastTime = null, accumulator = 0, sceneTime = 0, sceneDistance = 0;
  let best = 0, audio = null, sound = false, particles = [], particleClock = 0, milestoneUntil = 0;
  let gameOverAt = 0, width = 1200, height = 570, dpr = 1;
  let selectedScene = 0, shownScene = -1;
  const scenes = [
    { id: 'moon', title: 'THE MOON*', joke: '*a.k.a. the Nevada desert.', announcement: 'NEXT STOP: THE MOON. DEFINITELY NOT NEVADA.',
      sky: '#f8f8f1', dust: '#ecedde', ridge: '#e0e5d6', ridgeShadow: '#d5ddc9', ground: '#959f81', speck: '#cbd1bb', rock: '#adb69a', sun: '#f0e8c8', cactus: '#afb99a' },
    { id: 'mars', title: 'MARS*', joke: '*Arizona, with the saturation turned up.', announcement: 'WELCOME TO MARS. ARIZONA SENDS ITS REGARDS.',
      sky: '#faf0df', dust: '#edc7a5', ridge: '#dfa785', ridgeShadow: '#d19573', ground: '#ad7152', speck: '#cf9e7b', rock: '#b57d58', sun: '#eac5a3', cactus: '#c28b64' },
    { id: 'area51', title: 'AREA 51', joke: 'Just a weather balloon. Keep moving.', announcement: 'AREA 51 — YOU SAW ABSOLUTELY NOTHING.',
      sky: '#232d3c', dust: '#3a454b', ridge: '#303d4b', ridgeShadow: '#263443', ground: '#8a9b7d', speck: '#566461', rock: '#7d8b76', sun: '#acbba0', cactus: '#626e64' },
    { id: 'lockheed', title: 'LOCKHEED MARTIN / SKUNK WORKS', joke: 'Even the cacti signed NDAs.', announcement: 'SKUNK WORKS — THIS RUN IS CLASSIFIED.',
      sky: '#eaf0ef', dust: '#d9d8ca', ridge: '#bdcacc', ridgeShadow: '#a8b9bd', ground: '#7d8d8e', speck: '#b4b8a9', rock: '#9ca69b', sun: '#d1dedd', cactus: '#98a79c' },
    { id: 'spacex', title: 'SPACEX / STARBASE', joke: 'Some assembly required. Rapid disassembly included.', announcement: 'STARBASE — PLEASE KEEP ALL ROCKET PARTS.',
      sky: '#edf5f4', dust: '#e6dfc9', ridge: '#c8dedd', ridgeShadow: '#accdcd', ground: '#8aada1', speck: '#c3c5ad', rock: '#a6b39a', sun: '#f0deb2', cactus: '#9bbdaa' }
  ];
  const sceneButtons = ['moonButton','marsButton','areaButton','lockheedButton','spacexButton'];
  const currentSceneIndex = () => (selectedScene + Math.floor((game.level - 1) / 2)) % scenes.length;
  const currentScene = () => scenes[state === 'menu' ? selectedScene : currentSceneIndex()];
  const activeJumpInputs = new Set();
  try { best = Math.max(0, Math.floor(Number(localStorage.getItem('trumpElonHighScore')) || 0)); } catch (_) {}
  if (!Number.isFinite(best)) best = 0;
  const pad = value => String(value).padStart(5, '0');
  $('highScore').textContent = pad(best);

  const crew = new Image();
  crew.onload = () => {
    ready = true; $('startButton').disabled = false;
    $('startButton').innerHTML = 'LET’S FLY <span aria-hidden="true">↗</span>';
  };
  crew.onerror = () => { $('assetError').hidden = false; $('startButton').textContent = 'CREW UNAVAILABLE'; };
  crew.src = 'assets/rocket-duo.png';

  function resize() {
    const rect = stage.getBoundingClientRect();
    width = rect.width; height = rect.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  function tone(kind) {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const now = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
      const notes = { jump: [340, 660, .13], land: [110, 75, .05], pass: [720, 1000, .08],
        level: [620, 1250, .27], crash: [150, 38, .28], start: [260, 720, .2] };
      const [from, to, duration] = notes[kind] || notes.jump;
      osc.type = kind === 'crash' ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(from, now); osc.frequency.exponentialRampToValueAtTime(to, now + duration);
      gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.045, now + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      osc.connect(gain); gain.connect(audio.destination); osc.start(now); osc.stop(now + duration + .01);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    } catch (_) { /* Sound is optional; unsupported audio must not stop the run. */ }
  }
  function setState(next) {
    state = next; $('gameContainer').className = 'game-shell is-' + state;
    $('startScreen').hidden = state !== 'menu'; $('crewLabel').hidden = state !== 'menu';
    $('scenePicker').hidden = state !== 'menu';
    $('pauseScreen').hidden = state !== 'paused'; $('gameOver').hidden = state !== 'over';
    $('pauseButton').disabled = !['playing', 'paused'].includes(state);
    $('pauseButton').innerHTML = state === 'paused' ? 'RESUME <span aria-hidden="true">▶</span>' : 'PAUSE <span aria-hidden="true">Ⅱ</span>';
    $('pauseButton').setAttribute('aria-label', state === 'paused' ? 'Resume game' : 'Pause game');
    $('flightStatus').textContent = {menu: 'READY FOR TAKEOFF', playing: 'FLIGHT IN PROGRESS', paused: 'FLIGHT ON HOLD', over: 'CREW RECOVERED'}[state];
    $('runHint').hidden = state !== 'playing' || game.time > 6;
    // Keep only the active panel's controls available to keyboard and screen readers.
    $('startScreen').inert = state !== 'menu'; $('pauseScreen').inert = state !== 'paused'; $('gameOver').inert = state !== 'over';
  }
  function updateHUD() {
    $('score').textContent = pad(game.score); $('highScore').textContent = pad(best);
    $('level').textContent = 'LEVEL ' + String(game.level).padStart(2, '0');
    const nextScene = state === 'menu' ? selectedScene : currentSceneIndex();
    if (nextScene !== shownScene) {
      shownScene = nextScene;
      const scene = scenes[nextScene];
      $('gameContainer').dataset.scene = scene.id;
      $('sectorLabel').replaceChildren(document.createTextNode(scene.title), Object.assign(document.createElement('small'), {textContent:scene.joke}));
    }
    $('speedLabel').textContent = state === 'menu' ? 'BOUND FOR SOMEWHERE ↗' : Math.round(game.speed / RULES.initialSpeed * 100) + '% CRUISING SPEED →';
  }
  function start() {
    if (!ready) return;
    game.start(); activeJumpInputs.clear(); particles = []; particleClock = 0;
    accumulator = 0; lastTime = null; sceneDistance = 0; milestoneUntil = 0;
    $('milestone').textContent = ''; setState('playing'); updateHUD(); tone('start'); stage.focus({preventScroll:true});
  }
  function pause() {
    if (state === 'playing') {
      game.state = 'paused'; activeJumpInputs.clear(); game.releaseJump(); accumulator = 0;
      setState('paused'); $('resumeButton').focus({preventScroll:true});
    } else if (state === 'paused') {
      game.state = 'playing'; accumulator = 0; lastTime = null; setState('playing'); stage.focus({preventScroll:true});
    }
  }
  function menu() {
    game.reset(); activeJumpInputs.clear(); accumulator = 0; particles = [];
    $('milestone').textContent = ''; setState('menu'); updateHUD(); $('startButton').focus({preventScroll:true});
  }
  function burst(x, y, count, color) {
    if (reducedMotion) return;
    for (let i = 0; i < count; i++) particles.push({x,y,vx:-80-Math.random()*130,vy:(Math.random()-.55)*120,life:.3+Math.random()*.3,color,size:2+Math.random()*3});
  }
  function endRun() {
    gameOverAt = performance.now();
    const record = game.score > best; best = Math.max(best, game.score);
    try { localStorage.setItem('trumpElonHighScore', String(best)); } catch (_) {}
    activeJumpInputs.clear(); game.releaseJump();
    $('resultEyebrow').textContent = record ? 'A NEW PERSONAL BEST' : 'A SLIGHT DETOUR';
    $('finalScore').textContent = pad(game.score); $('finalBest').textContent = pad(best); $('levelReached').textContent = game.level;
    $('milestone').textContent = ''; setState('over'); updateHUD();
    burst(game.player.x + 160, game.player.y - 25, 22, '#e9502f');
    $('retryButton').focus({preventScroll:true});
  }
  function jump(input) {
    if (activeJumpInputs.has(input)) return;
    activeJumpInputs.add(input);
    if (game.pressJump()) { tone('jump'); burst(game.player.x + 60, RULES.ground - 10, 8, '#c9b48c'); }
  }
  function release(input) {
    activeJumpInputs.delete(input);
    if (!activeJumpInputs.size) game.releaseJump();
  }
  $('startButton').addEventListener('click', start);
  $('retryButton').addEventListener('click', start);
  $('resumeButton').addEventListener('click', pause);
  $('pauseButton').addEventListener('click', pause);
  $('menuButton').addEventListener('click', menu);
  $('pauseMenuButton').addEventListener('click', menu);
  function chooseScene(index) {
    if (state !== 'menu') return;
    selectedScene = index;
    sceneButtons.forEach((id,buttonIndex) => $(id).setAttribute('aria-pressed', String(index === buttonIndex)));
    updateHUD();
  }
  sceneButtons.forEach((id,index) => $(id).addEventListener('click', () => chooseScene(index)));
  $('soundButton').addEventListener('click', () => {
    sound = !sound; $('soundValue').textContent = sound ? 'ON' : 'OFF';
    $('soundButton').setAttribute('aria-pressed', String(sound));
    $('soundButton').setAttribute('aria-label', sound ? 'Turn sound off' : 'Turn sound on'); tone('pass');
  });
  window.addEventListener('keydown', event => {
    const isJump = ['Space', 'ArrowUp', 'KeyW'].includes(event.code);
    if (event.code === 'Tab' && (state === 'paused' || state === 'over')) {
      const panel = state === 'paused' ? $('pauseScreen') : $('gameOver');
      const buttons = [...panel.querySelectorAll('button')], first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      return;
    }
    if (event.code === 'KeyP' || event.code === 'Escape') {
      event.preventDefault(); if (!event.repeat) pause(); return;
    }
    if (!isJump || event.altKey || event.ctrlKey || event.metaKey) return;
    // Let native buttons handle Space. Gameplay shortcuts apply to the field and page.
    if (event.target.closest?.('button, a, input, textarea, select')) return;
    event.preventDefault(); if (event.repeat) return;
    if (state === 'menu' || (state === 'over' && performance.now() - gameOverAt > 400)) start();
    else if (state === 'paused') pause();
    else if (state === 'playing') jump(event.code);
  });
  window.addEventListener('keyup', event => { if (['Space','ArrowUp','KeyW'].includes(event.code)) release(event.code); });
  stage.addEventListener('pointerdown', event => {
    if (event.target.closest('button') || state !== 'playing' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); stage.setPointerCapture(event.pointerId); jump('pointer-' + event.pointerId);
  });
  const releasePointer = event => release('pointer-' + event.pointerId);
  window.addEventListener('pointerup', releasePointer);
  window.addEventListener('pointercancel', releasePointer);
  stage.addEventListener('lostpointercapture', releasePointer);
  window.addEventListener('blur', () => { if (state === 'playing') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });

  function pixelCloud(x,y,s,alpha) {
    ctx.save(); ctx.translate(Math.round(x),Math.round(y)); ctx.scale(s,s); ctx.globalAlpha=alpha;
    ctx.fillStyle='#e2e7dc'; ctx.fillRect(0,10,84,14); ctx.fillRect(15,2,30,12); ctx.fillRect(38,-5,27,19); ctx.fillRect(68,6,9,12);
    ctx.fillStyle='#f8f8f1'; ctx.fillRect(5,10,69,7); ctx.fillRect(19,5,25,9); ctx.fillRect(43,-1,17,15);
    ctx.restore();
  }
  function cactus(x,y,w,h,decorative=false) {
    const u = w / 29;
    ctx.save(); ctx.translate(Math.round(x),Math.round(y)); ctx.scale(u,h/53);
    const dark = currentScene().id === 'area51';
    const fill = decorative ? currentScene().cactus : dark ? '#99ac7d' : '#55634b', edge = decorative ? currentScene().cactus : dark ? '#d4dfb8' : '#303e31';
    ctx.fillStyle=edge;
    ctx.fillRect(10,3,10,50);ctx.fillRect(12,0,6,4);ctx.fillRect(0,15,7,20);ctx.fillRect(4,29,12,8);ctx.fillRect(23,9,6,19);ctx.fillRect(17,23,11,7);
    ctx.fillStyle=fill;
    ctx.fillRect(12,5,6,46);ctx.fillRect(2,17,3,15);ctx.fillRect(5,31,8,3);ctx.fillRect(25,11,2,14);ctx.fillRect(19,25,7,3);
    ctx.fillStyle=decorative?currentScene().cactus:dark?'#dae4b1':'#8b9a64';ctx.fillRect(13,6,2,40);ctx.fillRect(2,17,2,11);ctx.fillRect(25,12,1,10);
    if(!decorative){ctx.fillStyle='#d8c598';ctx.fillRect(15,12,2,2);ctx.fillRect(11,24,2,2);ctx.fillRect(17,39,2,2);}
    ctx.restore();
  }
  function rock(o) {
    ctx.save();ctx.translate(Math.round(o.x),Math.round(o.y));ctx.fillStyle='#625d4e';
    ctx.beginPath();ctx.moveTo(0,35);ctx.lineTo(0,20);ctx.lineTo(8,20);ctx.lineTo(8,9);ctx.lineTo(16,9);ctx.lineTo(16,3);ctx.lineTo(32,3);ctx.lineTo(32,10);ctx.lineTo(39,10);ctx.lineTo(39,22);ctx.lineTo(44,22);ctx.lineTo(44,35);ctx.closePath();ctx.fill();
    ctx.fillStyle='#a99b7f';ctx.fillRect(9,20,27,12);ctx.fillRect(17,10,14,20);ctx.fillStyle='#cab997';ctx.fillRect(18,11,10,4);ctx.fillRect(10,21,6,4);ctx.fillStyle='#7d725e';ctx.fillRect(28,22,7,9);ctx.fillRect(17,29,5,3);ctx.restore();
  }
  function facilityScenery(viewWidth,ground,palette) {
    const restricted=palette.id==='area51', aerospace=palette.id==='lockheed', launch=palette.id==='spacex';
    if(!restricted&&!aerospace&&!launch)return;
    const shift=((sceneDistance*.15)%(viewWidth+600));
    const x=((viewWidth*.57-shift+viewWidth+600)%(viewWidth+600))-150;
    ctx.save();ctx.translate(Math.round(x),Math.round(ground));
    // These are deliberately fictional pixel sets, with no real facility layouts.
    const body=restricted?'#58666a':launch?'#acc6c6':'#9bafb4';
    const shade=restricted?'#3e4d55':launch?'#86aaa9':'#80969e';
    ctx.fillStyle=body;ctx.fillRect(0,-74,200,74);ctx.fillRect(12,-87,176,13);ctx.fillRect(24,-94,152,7);
    ctx.fillStyle=shade;ctx.fillRect(17,-61,64,61);ctx.fillRect(102,-61,80,61);
    ctx.fillStyle=body;for(let i=0;i<8;i++)ctx.fillRect(18,-56+i*7,162,2);
    ctx.fillStyle=restricted?'#a1b69c':'#dbe5df';ctx.fillRect(24,-77,14,5);ctx.fillRect(44,-77,14,5);ctx.fillRect(155,-77,16,5);
    if(restricted){
      ctx.fillStyle='#82947c';ctx.fillRect(236,-135,4,135);ctx.fillRect(220,-143,36,4);ctx.fillRect(224,-156,28,4);ctx.fillRect(218,-153,5,12);ctx.fillRect(253,-153,5,12);ctx.fillRect(225,-147,27,3);
      ctx.fillStyle='#a3b788';ctx.fillRect(234,-162,8,4);
      for(let i=-100;i<400;i+=25){ctx.fillStyle='#708479';ctx.fillRect(i,-26,2,26);ctx.fillRect(i,-20,25,1);ctx.fillRect(i,-7,25,1);}
      const hover=reducedMotion?0:Math.sin(sceneTime*1.7)*4;
      ctx.fillStyle='#829e8b';ctx.fillRect(105,-190+hover,61,8);ctx.fillRect(96,-187+hover,79,3);ctx.fillRect(119,-203+hover,32,13);ctx.fillRect(127,-209+hover,16,6);
      ctx.fillStyle='#cce2ac';ctx.fillRect(120,-201+hover,28,6);ctx.fillRect(110,-186+hover,6,2);ctx.fillRect(132,-186+hover,6,2);ctx.fillRect(154,-186+hover,6,2);
    }
    if(aerospace){
      ctx.fillStyle='#778c93';ctx.fillRect(234,-119,18,119);ctx.fillRect(217,-136,54,17);ctx.fillRect(224,-143,40,7);
      ctx.fillStyle='#cbd9d8';ctx.fillRect(223,-131,43,8);
      ctx.fillStyle='#71858c';ctx.fillRect(-103,-10,111,7);ctx.fillRect(-82,-19,45,9);ctx.fillRect(-62,-28,15,12);ctx.fillRect(-99,-25,7,18);ctx.fillRect(-29,-14,26,5);
      ctx.fillStyle='#b6c6c6';ctx.fillRect(-62,-24,11,7);
    }
    if(launch){
      ctx.fillStyle='#7e9fa2';ctx.fillRect(240,-181,8,181);ctx.fillRect(284,-181,8,181);ctx.fillRect(237,-186,58,8);
      for(let i=0;i<8;i++){ctx.fillRect(246,-172+i*21,42,4);ctx.fillRect(252+(i%2)*17,-166+i*21,5,15);}
      ctx.fillStyle='#b4cbcb';ctx.fillRect(245,-161,40,5);ctx.fillRect(280,-165,61,7);ctx.fillRect(334,-162,4,55);
      ctx.fillStyle='#a5c1bf';ctx.fillRect(-96,-42,22,42);ctx.fillRect(-100,-37,30,32);ctx.fillRect(-54,-34,21,34);ctx.fillRect(-58,-28,29,22);
      ctx.fillStyle='#d1e0d8';ctx.fillRect(-91,-32,4,23);ctx.fillRect(-50,-25,4,18);
    }
    ctx.restore();
  }
  function background(viewWidth,viewHeight,ground) {
    const palette=currentScene(), mars=palette.id==='mars', night=palette.id==='area51';
    ctx.fillStyle=palette.sky;ctx.fillRect(0,0,viewWidth,viewHeight);
    // Quiet pixel texture and distant, slowly scrolling scenery echo the offline runner.
    ctx.fillStyle=night?'#d3dfca':'#dce2d4';
    for(let i=0;i<30;i++){
      const x=((i*173+47-sceneDistance*.025)%(viewWidth+80)+viewWidth+80)%(viewWidth+80)-40;
      const y=58+(i*79)%Math.max(100,ground-170);
      ctx.globalAlpha=night?.75:.45;ctx.fillRect(Math.round(x),Math.round(y),2,2);
      if(night&&i%4===0){ctx.fillRect(Math.round(x)-2,Math.round(y)+1,6,1);ctx.fillRect(Math.round(x)+1,Math.round(y)-2,1,6);}
    }
    ctx.globalAlpha=1;
    const sunX=viewWidth*.79,sunY=Math.min(ground*.4,165);
    ctx.fillStyle=palette.sun;ctx.fillRect(sunX-30,sunY-38,60,76);ctx.fillRect(sunX-38,sunY-28,76,56);ctx.fillRect(sunX-23,sunY-44,46,88);ctx.fillRect(sunX-44,sunY-20,88,40);
    if(mars){ctx.fillStyle='#dfbca2';ctx.fillRect(sunX-124,sunY-36,14,22);ctx.fillRect(sunX-128,sunY-31,22,12);ctx.fillRect(sunX+91,sunY+12,10,16);ctx.fillRect(sunX+88,sunY+16,16,8);}
    for(let i=0;i<(night?0:5);i++){
      const x=((i*310+80-sceneDistance*.06)%(viewWidth+220)+viewWidth+220)%(viewWidth+220)-110;
      pixelCloud(x,90+(i*57)%150,.7+(i%3)*.3,.68);
    }
    ctx.fillStyle=palette.ridge;
    for(let i=0;i<6;i++){
      const x=((i*370-sceneDistance*.12)%(viewWidth+500)+viewWidth+500)%(viewWidth+500)-250;
      const h=mars?85+(i%3)*32:35+(i%3)*18;
      ctx.beginPath();ctx.moveTo(x,ground);ctx.lineTo(x,ground-10);ctx.lineTo(x+35,ground-10);ctx.lineTo(x+35,ground-h*.5);ctx.lineTo(x+65,ground-h*.5);ctx.lineTo(x+65,ground-h);ctx.lineTo(x+130,ground-h);ctx.lineTo(x+130,ground-h*.7);ctx.lineTo(x+154,ground-h*.7);ctx.lineTo(x+154,ground-15);ctx.lineTo(x+210,ground-15);ctx.lineTo(x+210,ground);ctx.closePath();ctx.fill();
      if(mars){ctx.fillStyle=palette.ridgeShadow;ctx.fillRect(x+65,ground-h+13,65,5);ctx.fillRect(x+35,ground-h*.5+9,119,3);ctx.fillRect(x+110,ground-h+18,20,h-18);ctx.fillStyle=palette.ridge;}
    }
    ctx.fillStyle=palette.dust;ctx.fillRect(0,ground,viewWidth,viewHeight-ground);
    ctx.fillStyle=palette.ground;ctx.fillRect(0,Math.round(ground),viewWidth,2);
    ctx.fillStyle=palette.speck;ctx.fillRect(0,Math.round(ground)+4,viewWidth,1);
    for(let i=0;i<4;i++){
      const x=((i*405+240-sceneDistance*.2)%(viewWidth+300)+viewWidth+300)%(viewWidth+300)-150;
      cactus(x,ground-32,17,31,true);
    }
    facilityScenery(viewWidth,ground,palette);
    for(let i=0;i<66;i++){
      const x=((i*73+17-sceneDistance)%(viewWidth+100)+viewWidth+100)%(viewWidth+100)-50;
      const y=ground+12+(i*17)%70;
      ctx.fillStyle=i%3===0?palette.rock:palette.speck;ctx.fillRect(Math.round(x),Math.round(y),i%4===0?10:4,2);
    }
  }
  function drawCrew(x,bottom,w,bob=0) {
    if(!ready)return;
    const h=w*crew.naturalHeight/crew.naturalWidth;
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(crew,Math.round(x),Math.round(bottom-h+bob),w,h);
  }
  function draw() {
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(state==='menu'){
      const scale=width/1200, viewHeight=height/scale;
      ctx.save();ctx.scale(scale,scale);
      const ground=viewHeight-80; background(1200,viewHeight,ground);
      ctx.restore();
      const mobile=width<590 && height>400;
      const rocketWidth=mobile?width*.47:width*.39;
      const rocketX=mobile?width*.49:width*.535;
      const rocketBottom=mobile?height-165:height*.66;
      const bob=reducedMotion?0:Math.sin(sceneTime*2.5)*3;
      ctx.fillStyle='#ced1c0';ctx.globalAlpha=.5;ctx.beginPath();ctx.ellipse(rocketX+rocketWidth*.58,height-80*scale-6,rocketWidth*.30,5,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
      drawCrew(rocketX,rocketBottom,rocketWidth,bob);
      // Short motion ticks make the rightward direction clear without tilting the rocket.
      ctx.strokeStyle='#bfc6b0';ctx.lineWidth=1;
      for(let i=0;i<3;i++){const x=rocketX-15-(i%2)*18;const y=rocketBottom-rocketWidth*.19-i*15;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-20-i*8,y);ctx.stroke();}
      return;
    }
    const viewWidth=width<620?800:1200, scale=width/viewWidth;
    const viewHeight=height/scale, ground=viewHeight-85;
    ctx.save();ctx.scale(scale,scale);
    background(viewWidth,viewHeight,ground);
    ctx.save();ctx.translate(0,ground-RULES.ground);
    for(const o of game.obstacles){
      if(o.type==='rock')rock(o);
      else if(o.type==='double'){cactus(o.x,o.y+8,28,o.height-8);cactus(o.x+34,o.y,30,o.height);}
      else cactus(o.x,o.y,o.width,o.height);
    }
    const p=game.player;
    const altitude=RULES.ground-p.y;
    ctx.globalAlpha=Math.max(.1,.25-altitude*.0008);ctx.fillStyle='#596447';ctx.beginPath();ctx.ellipse(p.x+108,RULES.ground-1,Math.max(24,75-altitude*.15),4,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    for(const part of particles){ctx.globalAlpha=Math.min(1,part.life*2);ctx.fillStyle=part.color;ctx.fillRect(part.x,part.y,part.size,part.size);}
    ctx.globalAlpha=1;
    drawCrew(p.x,p.y-4,RULES.playerWidth,(p.airborne||reducedMotion||state!=='playing')?0:Math.sin(sceneTime*13)*1.2);
    ctx.restore();ctx.restore();
  }
  function frame(timestamp) {
    const delta=lastTime===null?0:Math.min((timestamp-lastTime)/1000,.05);lastTime=timestamp;
    if(state!=='paused'){sceneTime+=delta;}
    if(state==='menu'&&!reducedMotion)sceneDistance+=delta*28;
    if(state==='playing'){
      accumulator+=delta;
      while(accumulator>=RULES.step){
        const events=game.update(RULES.step);accumulator-=RULES.step;
        for(const event of events){
          tone(event);
          if(event==='land')burst(game.player.x+70,RULES.ground-3,5,'#aeb497');
          if(event==='level'){
            const sceneChanged=currentSceneIndex()!==shownScene;
            milestoneUntil=sceneTime+(sceneChanged?3:1.8);
            $('milestone').textContent=sceneChanged?currentScene().announcement:'LEVEL '+String(game.level).padStart(2,'0')+' — KEEP FLYING';
          }
          if(event==='crash'){endRun();accumulator=0;break;}
        }
        if(state!=='playing')break;
      }
      sceneDistance=game.distance;
      particleClock+=delta;
      if(particleClock>.035){particleClock=0;burst(game.player.x+24,game.player.y-37,1,'#e9a44b');}
      $('runHint').hidden=state!=='playing'||game.time>6;
      if(sceneTime>milestoneUntil)$('milestone').textContent='';
      updateHUD();
    }
    if(state!=='paused'){
      particles=particles.filter(p=>p.life>0);
      for(const p of particles){p.x+=p.vx*delta;p.y+=p.vy*delta;p.life-=delta;}
    }
    draw();
    requestAnimationFrame(frame);
  }
  setState('menu');updateHUD();requestAnimationFrame(frame);
})();
