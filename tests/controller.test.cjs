const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const core = require('../game-core.js');
const artwork = require('../game-art.js');

// Exercise real controller events with a minimal DOM/canvas adapter, without a browser dependency.
function setup({ storageFails=false, imageFails=false, imagePending=false, engine=core, rect={width:1200,height:570} }={}) {
  const nodes = new Map(), frameQueue=[], windowEvents={}, documentEvents={}, store={};
  const ctx = new Proxy({}, {get:(object,key)=>object[key] ?? (()=>{}),set:(object,key,value)=>(object[key]=value,true)});
  let time=0, imageDraws=0, activeElement, image, onResize;
  const transforms=[],composites=[];
  ctx.scale=(...args)=>{assert.ok(args.every(Number.isFinite));transforms.push(args);};
  ctx.drawImage=source=>{imageDraws++;if(source?.tagName==='CANVAS')composites.push({alpha:ctx.globalAlpha,width:source.width,height:source.height});};
  function element(id='',tag='DIV') {
    return {id,tagName:tag,hidden:false,disabled:false,inert:false,textContent:'',innerHTML:'',className:'',dataset:{},style:{},attributes:{},events:{},children:[],
      addEventListener(type,listener){(this.events[type] ||= []).push(listener);},
      setAttribute(key,value){this.attributes[key]=value;},
      replaceChildren(...children){this.children=children;},
      getBoundingClientRect(){return rect;},getContext(){return ctx;},
      focus(){activeElement=this;},setPointerCapture(){},
      closest(selector){return this.tagName==='BUTTON'&&selector.includes('button')?this:null;},
      querySelectorAll(){return id==='pauseScreen'?[nodes.get('resumeButton'),nodes.get('pauseMenuButton')]:[nodes.get('retryButton'),nodes.get('menuButton')];}
    };
  }
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  for(const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"/g)) nodes.set(match[2],element(match[2],match[1].toUpperCase()));
  const document={getElementById:id=>{assert.ok(nodes.has(id),'Missing HTML id: '+id);return nodes.get(id);},createElement:tag=>element('',tag.toUpperCase()),createTextNode:text=>({textContent:text}),
    addEventListener:(type,listener)=>(documentEvents[type] ||= []).push(listener),hidden:false,get activeElement(){return activeElement;}};
  const window={RocketRunner:engine,RocketArtwork:artwork,devicePixelRatio:1,matchMedia:()=>({matches:false}),addEventListener:(type,listener)=>(windowEvents[type] ||= []).push(listener)};
  const sandbox={window,document,performance:{now:()=>time},localStorage:{getItem:key=>{if(storageFails)throw Error('blocked');return store[key];},setItem:(key,value)=>{if(storageFails)throw Error('blocked');store[key]=value;}},
    Image:class{constructor(){image=this;}naturalWidth=1536;naturalHeight=1024;set src(_){if(!imagePending)imageFails?this.onerror():this.onload();}},ResizeObserver:class{constructor(callback){onResize=callback;}observe(){onResize();}},requestAnimationFrame:callback=>frameQueue.push(callback),Math,Set,Number,String,Object,Date};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../game.js'),'utf8'),sandbox);
  function dispatch(target,type,props={}) {
    const event={target:target===window?nodes.get('stage'):target,preventDefault(){},repeat:false,...props};
    for(const listener of (target===window?windowEvents:target===document?documentEvents:target.events)[type]||[])listener(event);
  }
  function frames(count) {for(let i=0;i<count;i++){time+=1000/60;assert.equal(frameQueue.length,1,'exactly one animation loop');frameQueue.shift()(time);}}
  return {nodes,window,document,dispatch,frames,store,frameQueue,transforms,composites,resize(next){rect=next;onResize();},loadImage(){image.onload();},get imageDraws(){return imageDraws;}};
}

test('menu, both scenes, playing, pause, resume, and repeated restarts use one animation loop',()=>{
  const app=setup(),get=id=>app.nodes.get(id),click=id=>app.dispatch(get(id),'click');
  assert.equal(get('startButton').disabled,false);assert.equal(get('gameContainer').dataset.scene,'moon');
  click('marsButton');assert.equal(get('gameContainer').dataset.scene,'mars');assert.equal(get('marsButton').attributes['aria-pressed'],'true');
  click('startButton');app.frames(90);assert.equal(get('scenePicker').hidden,true);assert.equal(get('startScreen').hidden,true);
  click('pauseButton');const score=get('score').textContent;app.frames(120);assert.equal(get('score').textContent,score);assert.equal(get('pauseScreen').hidden,false);
  click('resumeButton');app.frames(60);assert.notEqual(get('score').textContent,score);
  for(let i=0;i<5;i++){click('startButton');app.frames(5);}
  assert.equal(app.frameQueue.length,1);assert.ok(app.imageDraws>200);
});

test('a crash shows the results, saves best, and retry resets the run without reload',()=>{
  const app=setup(),get=id=>app.nodes.get(id);
  app.dispatch(get('startButton'),'click');app.frames(600);
  assert.equal(get('gameOver').hidden,false);assert.ok(Number(get('finalScore').textContent)>0);
  assert.equal(app.store.trumpElonHighScore,String(Number(get('finalScore').textContent)));
  app.dispatch(get('retryButton'),'click');assert.equal(get('gameOver').hidden,true);assert.equal(get('score').textContent,'00000');app.frames(10);
});

test('blocked storage cannot prevent loading, playing, results, or retry',()=>{
  const app=setup({storageFails:true});app.dispatch(app.nodes.get('startButton'),'click');app.frames(600);
  assert.equal(app.nodes.get('gameOver').hidden,false);
  app.dispatch(app.nodes.get('retryButton'),'click');app.frames(10);assert.equal(app.nodes.get('startScreen').hidden,true);
});

test('losing focus pauses and a missing sprite still allows launch and retry',()=>{
  const app=setup();app.dispatch(app.nodes.get('startButton'),'click');app.frames(20);app.dispatch(app.window,'blur');
  assert.equal(app.nodes.get('pauseScreen').hidden,false);
  const unavailable=setup({imageFails:true});assert.equal(unavailable.nodes.get('assetError').hidden,false);
  unavailable.dispatch(unavailable.nodes.get('startButton'),'click');assert.equal(unavailable.nodes.get('startScreen').hidden,true);
  unavailable.frames(600);assert.equal(unavailable.nodes.get('gameOver').hidden,false);
  unavailable.dispatch(unavailable.nodes.get('retryButton'),'click');unavailable.frames(5);
  assert.equal(unavailable.nodes.get('gameOver').hidden,true);
});

test('a pending crew download cannot block play and can finish during a run',()=>{
  const app=setup({imagePending:true}),get=id=>app.nodes.get(id);
  app.dispatch(get('startButton'),'click');app.frames(90);
  assert.equal(get('startScreen').hidden,true);assert.ok(Number(get('score').textContent)>0);assert.equal(app.imageDraws,0);
  app.loadImage();app.frames(5);assert.ok(app.imageDraws>0);assert.equal(get('gameOver').hidden,true);
});

test('separate visitors can choose maps, play, pause and save without affecting each other',()=>{
  const clients=Array.from({length:4},()=>setup());
  const choices=['moonButton','marsButton','areaButton','spacexButton'];
  clients.forEach((app,i)=>{app.dispatch(app.nodes.get(choices[i]),'click');app.dispatch(app.nodes.get('startButton'),'click');app.frames(90);});
  const scores=clients.map(app=>app.nodes.get('score').textContent);
  clients[0].dispatch(clients[0].nodes.get('pauseButton'),'click');
  clients.forEach(app=>app.frames(30));
  assert.equal(clients[0].nodes.get('score').textContent,scores[0]);
  clients.slice(1).forEach((app,i)=>assert.notEqual(app.nodes.get('score').textContent,scores[i+1]));
  clients[1].frames(600);assert.ok(clients[1].store.trumpElonHighScore);
  assert.equal(clients[2].store.trumpElonHighScore,undefined);assert.equal(clients[2].nodes.get('gameOver').hidden,true);
});

test('phone resizing preserves the run and keeps at least 390 vertical world units',()=>{
  const app=setup(),get=id=>app.nodes.get(id);
  app.dispatch(get('startButton'),'click');app.frames(5);
  for(const rect of [{width:298,height:268},{width:370,height:366},{width:818,height:266},{width:714,height:196},{width:1000,height:475}]){
    app.resize(rect);app.transforms.length=0;app.frames(1);
    assert.equal(get('gameCanvas').width,rect.width);assert.equal(get('gameCanvas').height,rect.height);
    const scale=app.transforms[0][0];assert.ok(rect.height/scale>=390-1e-8);
    assert.equal(get('startScreen').hidden,true);
  }
  app.resize({width:0,height:0});app.frames(1);assert.equal(get('gameCanvas').width,1000);
});

test('keyboard and touch jumps both lift the riders and preserve the horizontal sprite',()=>{
  const app=setup();app.dispatch(app.nodes.get('startButton'),'click');
  app.dispatch(app.window,'keydown',{code:'Space'});app.frames(20);app.dispatch(app.window,'keyup',{code:'Space'});
  app.frames(65);app.dispatch(app.nodes.get('stage'),'pointerdown',{pointerType:'touch',pointerId:2});app.frames(20);
  app.dispatch(app.window,'pointercancel',{pointerId:2});app.frames(30);
  assert.equal(app.nodes.get('gameOver').hidden,true);assert.ok(app.imageDraws>100);
});

test('all five sectors render, select exclusively, and remain selected on launch',()=>{
  const app=setup();
  for(const [button,scene] of [['moonButton','moon'],['marsButton','mars'],['areaButton','area51'],['lockheedButton','lockheed'],['spacexButton','spacex']]) {
    app.dispatch(app.nodes.get(button),'click');app.frames(2);
    assert.equal(app.nodes.get('gameContainer').dataset.scene,scene);
    const selected=[...app.nodes.values()].filter(node=>node.id.endsWith('Button')&&node.id!=='soundButton'&&node.attributes['aria-pressed']==='true');
    assert.equal(selected.length,1);
  }
  app.dispatch(app.nodes.get('startButton'),'click');app.frames(5);
  assert.equal(app.nodes.get('gameContainer').dataset.scene,'spacex');
});

test('sector arrival fades scenery gradually, pauses cleanly and keeps its announcement readable',()=>{
  let runner;
  class ControlledRunner extends core.Runner {constructor(){super();runner=this;}}
  const app=setup({engine:{...core,Runner:ControlledRunner}});
  app.dispatch(app.nodes.get('startButton'),'click');runner.spawnIn=Infinity;runner.distance=7199;
  app.frames(3);
  assert.equal(app.nodes.get('gameContainer').dataset.scene,'moon');
  assert.match(app.nodes.get('milestone').textContent,/MARS/);
  assert.equal(app.nodes.get('gameContainer').dataset.transition,'crossfade');
  assert.ok(app.composites.at(-1).alpha<.05);
  app.frames(70);assert.equal(app.nodes.get('gameContainer').dataset.scene,'mars');
  const alpha=app.composites.at(-1).alpha;assert.ok(alpha>.5&&alpha<.8);
  app.dispatch(app.nodes.get('pauseButton'),'click');app.frames(90);
  assert.equal(app.composites.at(-1).alpha,alpha);
  app.resize({width:370,height:366});app.frames(1);
  assert.equal(app.composites.at(-1).width,370);assert.equal(app.composites.at(-1).height,366);
  app.dispatch(app.nodes.get('resumeButton'),'click');app.frames(65);
  assert.equal(app.nodes.get('gameContainer').dataset.transition,'settling');
  app.frames(65);assert.equal(app.nodes.get('gameContainer').dataset.transition,'');
  assert.equal(app.nodes.get('milestone').textContent,'');
  assert.equal(app.nodes.get('nextSector').textContent,'NEXT: AREA 51');
  const mixed=app.composites.filter(c=>c.alpha>.01&&c.alpha<.99);
  assert.ok(mixed.length>60,'crossfade must be gradual, not a one-frame replacement');
});

test('each map launches with matching hazards and a themed crash message',()=>{
  for(const [button,sector,quip] of [['moonButton','moon',/moon/],['marsButton','mars',/Mars/],['areaButton','area51',/never happened/],['lockheedButton','lockheed',/classified/],['spacexButton','spacex',/parking/]]){
    let runner;
    class ControlledRunner extends core.Runner {constructor(){super(()=>0);runner=this;}}
    const app=setup({engine:{...core,Runner:ControlledRunner}});
    app.dispatch(app.nodes.get(button),'click');app.dispatch(app.nodes.get('startButton'),'click');app.frames(600);
    assert.equal(runner.collision.sector,sector);assert.equal(app.nodes.get('gameOver').hidden,false);
    assert.match(app.nodes.get('resultMessage').textContent,quip);
  }
});

test('the route indicator reflects progress, the chosen start, and an endless sector change',()=>{
  let runner;
  class ControlledRunner extends core.Runner {constructor(){super();runner=this;}}
  const app=setup({engine:{...core,Runner:ControlledRunner}}),get=id=>app.nodes.get(id);
  app.dispatch(get('spacexButton'),'click');assert.equal(get('nextSector').textContent,'NEXT: MOON');
  app.dispatch(get('startButton'),'click');runner.spawnIn=Infinity;runner.distance=3599;
  app.frames(3);assert.ok(Number(get('routeProgress').attributes['aria-valuenow'])>=300);
  runner.completedSectors=4;runner.score=2999;runner.level=10;runner.distance=35999;app.frames(3);
  assert.equal(get('gameContainer').dataset.scene,'lockheed');
  assert.equal(get('nextSector').textContent,'ARRIVING: STARBASE');
  assert.equal(get('routeProgress').attributes['aria-valuenow'],'600');
  app.frames(140);
  assert.equal(get('gameContainer').dataset.scene,'spacex');
  assert.match(get('milestone').textContent,/STARBASE/);
  app.frames(60);assert.equal(get('nextSector').textContent,'NEXT: MOON');
  assert.ok(Number(get('routeProgress').attributes['aria-valuenow'])<150);
});
