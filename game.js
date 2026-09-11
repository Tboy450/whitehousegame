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
  let scorePopups = [];
  let gameOverAt = 0, width = 1200, height = 570, dpr = 1;
  let selectedScene = 0, shownScene = -1;
  let shownHUD = '';
  const { Art, SCENES: scenes } = window.RocketArtwork;
  const art = new Art(ctx);
  const transitionCanvas = document.createElement('canvas');
  const transitionContext = transitionCanvas.getContext('2d');
  const transitionArt = new Art(transitionContext);
  const sceneButtons = ['moonButton','marsButton','areaButton','lockheedButton','spacexButton'];
  const currentSceneIndex = () => game.transitionProgress >= .5 ? game.transition.to : game.sectorIndex;
  const currentScene = () => scenes[state === 'menu' ? selectedScene : currentSceneIndex()];
  const activeJumpInputs = new Set();
  try { best = Math.max(0, Math.floor(Number(localStorage.getItem('trumpElonHighScore')) || 0)); } catch (_) {}
  if (!Number.isFinite(best)) best = 0;
  const pad = value => String(value).padStart(5, '0');
  $('highScore').textContent = pad(best);

  const crew = new Image();
  crew.onload = () => {
    ready = true; $('assetError').hidden = true;
  };
  crew.onerror = () => { $('assetError').hidden = false; };
  crew.fetchPriority = 'high';
  crew.decoding = 'async';
  crew.src = 'assets/rocket-duo.png';
  $('retryArtwork').addEventListener('click', () => { crew.src = 'assets/rocket-duo.png?retry=' + Date.now(); });

  function resize() {
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
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
    shownHUD = '';
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
    // Avoid rewriting score, progress and accessibility attributes on every paint.
    const phase = game.transition?.phase || '';
    const routeLength = Math.round(game.sectorLength / 12);
    const routePoint = state === 'menu' ? 0 : phase ? routeLength : Math.floor(game.sectorProgress * routeLength);
    const hudKey = [state,game.score,best,game.circuit,selectedScene,currentSceneIndex(),phase,routePoint].join(':');
    if (hudKey === shownHUD) return;
    shownHUD = hudKey;
    $('score').textContent = pad(game.score); $('highScore').textContent = pad(best);
    $('circuit').textContent = 'CIRCUIT ' + String(game.circuit).padStart(2, '0');
    const nextScene = state === 'menu' ? selectedScene : currentSceneIndex();
    if (nextScene !== shownScene) {
      shownScene = nextScene;
      const scene = scenes[nextScene];
      $('gameContainer').dataset.scene = scene.id;
      $('sectorLabel').replaceChildren(document.createTextNode(scene.title), Object.assign(document.createElement('small'), {textContent:scene.joke}));
    }
    $('speedLabel').textContent = state === 'menu' ? 'BOUND FOR SOMEWHERE ↗' : Math.round(game.speed / RULES.initialSpeed * 100) + '% CRUISING SPEED →';
    const destination = ['MOON','MARS','AREA 51','SKUNK WORKS','STARBASE'][state === 'menu' ? (selectedScene + 1) % scenes.length : game.transition?.to ?? (game.sectorIndex + 1) % scenes.length];
    const arriving = state !== 'menu' && phase;
    $('gameContainer').dataset.transition = arriving || '';
    if (state === 'playing') $('flightStatus').textContent = {clearing:'SECTOR AHEAD',crossfade:'SCENERY CHANGE',settling:'AIRSPACE CLEAR'}[phase] || 'FLIGHT IN PROGRESS';
    $('nextSector').textContent = (arriving ? 'ARRIVING: ' : 'NEXT: ') + destination;
    $('routeRemaining').textContent = arriving ? {clearing:'CLEARING',crossfade:'EN ROUTE',settling:'ARRIVED'}[phase] : (routeLength - routePoint) + ' M';
    $('routeFill').style.width = (routePoint / routeLength * 100) + '%';
    $('routeProgress').setAttribute('aria-valuemax', String(routeLength));
    $('routeProgress').setAttribute('aria-valuenow', String(routePoint));
    $('routeProgress').setAttribute('aria-valuetext', arriving ? 'Arriving at ' + destination + '. ' + (phase === 'clearing' ? 'Clear the last obstacles.' : 'Airspace clear.') : (routeLength - routePoint) + ' metres to ' + destination);
  }
  function start() {
    game.start(selectedScene); activeJumpInputs.clear(); particles = []; scorePopups = []; particleClock = 0;
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
    game.reset(); activeJumpInputs.clear(); accumulator = 0; particles = []; scorePopups = [];
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
    const crashScene = scenes.find(scene => scene.id === game.collision?.sector) || currentScene();
    $('resultMessage').textContent = crashScene.crashes[game.passed % crashScene.crashes.length];
    $('finalScore').textContent = pad(game.score); $('finalBest').textContent = pad(best); $('circuitReached').textContent = game.circuit;
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

  function background(viewWidth,viewHeight,ground) {
    const scene = {index:state === 'menu' ? selectedScene : game.sectorIndex,
      width:viewWidth,height:viewHeight,ground,distance:sceneDistance,time:sceneTime,reduced:reducedMotion};
    art.background(scene);
    if (state === 'menu' || game.transition?.phase !== 'crossfade') return;
    // Composite a complete scene: individual art helpers manage their own opacity.
    if (transitionCanvas.width !== canvas.width || transitionCanvas.height !== canvas.height) {
      transitionCanvas.width = canvas.width; transitionCanvas.height = canvas.height;
    }
    transitionContext.setTransform(canvas.width/viewWidth,0,0,canvas.height/viewHeight,0,0);
    transitionArt.background({...scene,index:game.transition.to});
    const t = game.transitionProgress;
    ctx.save();ctx.globalAlpha = t*t*(3-2*t);
    ctx.drawImage(transitionCanvas,0,0,viewWidth,viewHeight);ctx.restore();
  }
  function drawCrew(x,bottom,w,bob=0) {
    if(!ready){ art.reserveCrew(x,bottom+bob,w); return; }
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
      const mobile=width<620 && height>400;
      const rocketWidth=mobile?width*.48:width*.39;
      const rocketX=mobile?width*.51:width*.535;
      const rocketBottom=mobile?230:height*.61;
      const bob=reducedMotion?0:Math.sin(sceneTime*2.5)*3;
      ctx.fillStyle='#ced1c0';ctx.globalAlpha=.5;ctx.beginPath();ctx.ellipse(rocketX+rocketWidth*.58,height-80*scale-6,rocketWidth*.30,5,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
      drawCrew(rocketX,rocketBottom,rocketWidth,bob);
      // Short motion ticks make the rightward direction clear without tilting the rocket.
      ctx.strokeStyle='#bfc6b0';ctx.lineWidth=1;
      for(let i=0;i<3;i++){const x=rocketX-15-(i%2)*18;const y=rocketBottom-rocketWidth*.19-i*15;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-20-i*8,y);ctx.stroke();}
      return;
    }
    // Short landscape viewports must still show the full jump arc and both riders.
    const viewWidth=Math.max(width<620?800:1200,width*390/height), scale=width/viewWidth;
    const viewHeight=height/scale, ground=viewHeight-85;
    ctx.save();ctx.scale(scale,scale);
    background(viewWidth,viewHeight,ground);
    ctx.save();ctx.translate(0,ground-RULES.ground);
    for(const obstacle of game.obstacles) art.obstacle(obstacle,sceneTime);
    const p=game.player;
    const altitude=RULES.ground-p.y;
    ctx.globalAlpha=Math.max(.1,.25-altitude*.0008);ctx.fillStyle='#596447';ctx.beginPath();ctx.ellipse(p.x+108,RULES.ground-1,Math.max(24,75-altitude*.15),4,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    for(const part of particles){ctx.globalAlpha=Math.min(1,part.life*2);ctx.fillStyle=part.color;ctx.fillRect(part.x,part.y,part.size,part.size);}
    ctx.globalAlpha=1;
    drawCrew(p.x,p.y-4,RULES.playerWidth,(p.airborne||reducedMotion||state!=='playing')?0:Math.sin(sceneTime*13)*1.2);
    for(const popup of scorePopups){
      ctx.globalAlpha=Math.min(1,popup.life*2);ctx.fillStyle=currentScene().id==='area51'?'#d9eab2':'#a64928';
      ctx.font='bold 16px "Courier New", monospace';ctx.textAlign='center';ctx.fillText(popup.text,popup.x,popup.y);
    }
    ctx.globalAlpha=1;
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
          if(['land','jump','pass','crash'].includes(event)) tone(event);
          if(event==='transition'||event==='circuit') tone('level');
          if(event==='land')burst(game.player.x+70,RULES.ground-3,5,'#aeb497');
          if(event==='pass'){
            scorePopups.push({x:game.player.x+100,y:game.player.y-151,life:.8,text:game.passed%5===0?game.passed+' CLEARED!':'+10'});
            burst(game.player.x+40,game.player.y-50,4,currentScene().id==='area51'?'#c5df9e':'#d99648');
          }
          if(event==='approach') $('milestone').textContent='';
          if(event==='transition'){
            milestoneUntil=Infinity;
            $('milestone').textContent=game.transition.completesCircuit
              ? 'CIRCUIT '+String(game.circuit).padStart(2,'0')+' COMPLETE\nSPEED +15% · LONGER SECTORS & GAPS'
              : scenes[game.transition.to].announcement+'\nAIRSPACE CLEAR — ENJOY THE VIEW';
          }
          if(event==='sector'){
            milestoneUntil=sceneTime+RULES.sectorRest;
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
      scorePopups=scorePopups.filter(p=>p.life>0);
      for(const popup of scorePopups){popup.life-=delta;if(!reducedMotion)popup.y-=delta*25;}
    }
    draw();
    requestAnimationFrame(frame);
  }
  setState('menu');updateHUD();requestAnimationFrame(frame);
})();
