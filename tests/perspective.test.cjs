const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Camera,Scene3D}=require('../game-3d.js');
const {Runner,OBSTACLES,RULES}=require('../game-core.js');
const {SCENES}=require('../game-art.js');

test('both 3D cameras and their intermediate positions preserve the full crew jump on phone and desktop aspect ratios',()=>{
  for(const [width,height] of [[1200,570],[800,790],[800,570],[1420,390]])for(const blend of [0,.25,.5,.75,1]){
    const camera=new Camera(width,height,blend);
    for(const x of [-83,98])for(const y of [0,112,276]){
      const p=camera.project([x,y,0]);assert.ok(p);
      assert.ok(p.point[0]>0&&p.point[0]<width,JSON.stringify({width,height,blend,x,y,p}));
      assert.ok(p.point[1]>0&&p.point[1]<height,JSON.stringify({width,height,blend,x,y,p}));
    }
    const near=camera.project([100,30,0]),far=camera.project([1200,30,0]);
    assert.ok(far.scale<near.scale);assert.ok(far.depth>near.depth);
  }
  assert.notDeepEqual(new Camera(1200,570,0).project([400,20,0]).point,new Camera(1200,570,1).project([400,20,0]).point);
});

test('near-plane clipping produces finite polygons instead of inverted geometry',()=>{
  const camera=new Camera(1200,570,1);
  const face=camera.polygon([[-900,0,-75],[4000,0,-75],[4000,0,75],[-900,0,75]]);
  assert.ok(face);assert.ok(face.depth>=20);
  assert.ok(face.points.flat().every(Number.isFinite));
  assert.equal(camera.project([-10000,0,0]),null);
});

test('all 3D map themes and every hazard render finite geometry without mutating gameplay',()=>{
  const paletteSignatures=[new Set(),new Set()];
  for(const palette of SCENES)for(const blend of [0,1]){
    const game=new Runner();game.start();game.player.y=RULES.ground-120;
    game.obstacles=OBSTACLES.map((o,i)=>({...o,x:380+i*125,y:RULES.ground-o.height-(o.altitude||0),sector:palette.id}));
    const before=JSON.stringify(game),colors=new Set();let paths=0;
    const context=new Proxy({},{get:(o,key)=>o[key]??((...args)=>{
      for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),key+' has a non-finite coordinate');
      if(key==='fill'){paths++;colors.add(o.fillStyle);}
    }),set:(o,key,value)=>(o[key]=value,true)});
    const renderer=new Scene3D(context);
    renderer.render({width:1200,height:570,palette,game,distance:1250,time:12,blend});
    assert.ok(paths>150);assert.ok(paths<3000,'keep geometry bounded for phone rendering');
    assert.equal(JSON.stringify(game),before);assert.equal(renderer.faces.length,0);
    paletteSignatures[blend].add([...colors].sort().join(','));
  }
  paletteSignatures.forEach(signatures=>assert.equal(signatures.size,5));
});
