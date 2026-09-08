const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const core = require('../game-core.js');

// Exercise real controller events with a minimal DOM/canvas adapter, without a browser dependency.
function setup({ storageFails=false, imageFails=false, engine=core }={}) {
  const nodes = new Map(), frameQueue=[], windowEvents={}, documentEvents={}, store={};
  const ctx = new Proxy({}, {get:(object,key)=>object[key] ?? (()=>{}),set:(object,key,value)=>(object[key]=value,true)});
  let time=0, imageDraws=0, activeElement;
  ctx.drawImage=()=>imageDraws++;
  function element(id='',tag='DIV') {
    return {id,tagName:tag,hidden:false,disabled:false,inert:false,textContent:'',innerHTML:'',className:'',dataset:{},attributes:{},events:{},children:[],
      addEventListener(type,listener){(this.events[type] ||= []).push(listener);},
      setAttribute(key,value){this.attributes[key]=value;},
      replaceChildren(...children){this.children=children;},
      getBoundingClientRect(){return {width:1200,height:570};},getContext(){return ctx;},
      focus(){activeElement=this;},setPointerCapture(){},
      closest(selector){return this.tagName==='BUTTON'&&selector.includes('button')?this:null;},
      querySelectorAll(){return id==='pauseScreen'?[nodes.get('resumeButton'),nodes.get('pauseMenuButton')]:[nodes.get('retryButton'),nodes.get('menuButton')];}
    };
  }
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  for(const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"/g)) nodes.set(match[2],element(match[2],match[1].toUpperCase()));
  const document={getElementById:id=>{assert.ok(nodes.has(id),'Missing HTML id: '+id);return nodes.get(id);},createElement:tag=>element('',tag.toUpperCase()),createTextNode:text=>({textContent:text}),
    addEventListener:(type,listener)=>(documentEvents[type] ||= []).push(listener),hidden:false,get activeElement(){return activeElement;}};
  const window={RocketRunner:engine,devicePixelRatio:1,matchMedia:()=>({matches:false}),addEventListener:(type,listener)=>(windowEvents[type] ||= []).push(listener)};
  const sandbox={window,document,performance:{now:()=>time},localStorage:{getItem:key=>{if(storageFails)throw Error('blocked');return store[key];},setItem:(key,value)=>{if(storageFails)throw Error('blocked');store[key]=value;}},
    Image:class{naturalWidth=1536;naturalHeight=1024;set src(_){imageFails?this.onerror():this.onload();}},ResizeObserver:class{constructor(callback){this.callback=callback;}observe(){this.callback();}},requestAnimationFrame:callback=>frameQueue.push(callback),Math,Set,Number,String,Object};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../game.js'),'utf8'),sandbox);
  function dispatch(target,type,props={}) {
    const event={target:target===window?nodes.get('stage'):target,preventDefault(){},repeat:false,...props};
    for(const listener of (target===window?windowEvents:target===document?documentEvents:target.events)[type]||[])listener(event);
  }
  function frames(count) {for(let i=0;i<count;i++){time+=1000/60;assert.equal(frameQueue.length,1,'exactly one animation loop');frameQueue.shift()(time);}}
  return {nodes,window,document,dispatch,frames,store,frameQueue,get imageDraws(){return imageDraws;}};
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

test('losing focus pauses and a missing sprite shows a recoverable error',()=>{
  const app=setup();app.dispatch(app.nodes.get('startButton'),'click');app.frames(20);app.dispatch(app.window,'blur');
  assert.equal(app.nodes.get('pauseScreen').hidden,false);
  const unavailable=setup({imageFails:true});assert.equal(unavailable.nodes.get('assetError').hidden,false);
  unavailable.dispatch(unavailable.nodes.get('startButton'),'click');assert.equal(unavailable.nodes.get('startScreen').hidden,false);
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

test('level advancement rotates sector scenery and announces the change',()=>{
  let runner;
  class ControlledRunner extends core.Runner {constructor(){super();runner=this;}}
  const app=setup({engine:{...core,Runner:ControlledRunner}});
  app.dispatch(app.nodes.get('startButton'),'click');runner.spawnIn=Infinity;runner.distance=7199;
  app.frames(3);
  assert.equal(app.nodes.get('gameContainer').dataset.scene,'mars');
  assert.match(app.nodes.get('milestone').textContent,/MARS/);
});
