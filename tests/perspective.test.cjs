const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Camera,Scene3D,buildCrewHull}=require('../game-3d.js');
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

test('the moving camera keeps the full jump framed and arrives at the exact Classic coordinates',()=>{
  for(const [width,height] of [[1200,570],[800,790],[800,570],[1420,390]])for(const blend of [0,.5,1])for(const side of [0,.1,.25,.5,.75,.9,1]){
    const camera=new Camera(width,height,blend,side);
    for(const x of [-100,100])for(const y of [0,140,302]){
      const point=camera.project([x,y,23]);assert.ok(point);
      assert.ok(point.point.every(Number.isFinite));
      assert.ok(point.point[0]>0&&point.point[0]<width&&point.point[1]>0&&point.point[1]<height,JSON.stringify({width,height,blend,side,x,y,point}));
    }
    if(side===1){
      for(const x of [-100,0,166,900])for(const y of [0,25,165])for(const z of [-28,0,28]){
        assert.deepEqual(camera.project([x,y,z]).point,[254+x,height-85-y]);
      }
    }
  }
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
    const image={width:128,height:128},side={width:128,height:128};let hazards=0;
    const renderer=new Scene3D(context,{get(){hazards++;return {image,side};}});
    renderer.render({width:1200,height:570,palette,game,distance:1250,time:12,blend});
    assert.ok(paths>150);assert.ok(paths<3000,'keep geometry bounded for phone rendering');
    assert.equal(hazards,OBSTACLES.length-1,'all hazards except the original 3D jet use the sprite provider');
    assert.equal(JSON.stringify(game),before);assert.equal(renderer.faces.length,0);
    paletteSignatures[blend].add([...colors].sort().join(','));
  }
  paletteSignatures.forEach(signatures=>assert.equal(signatures.size,5));
});

test('one original crew front and connected sides stay in frame throughout both cameras and a full jump',()=>{
  const image={width:1536,height:1024};
  const hull=[{points:[[0,0],[1,0],[1,1],[0,1]],colors:['#c6a87a','#bc714f','#54656c','#4a687a']}];
  for(const [width,height] of [[1200,570],[800,790],[800,570],[1420,390]])for(const blend of [0,.5,1])for(const side of [0,.5,.9,1])for(const altitude of [0,165]){
    const renderer=new Scene3D({});renderer.camera=new Camera(width,height,blend,side);
    renderer.viewBlend=blend;renderer.crewImage=image;renderer.crewHull=hull;renderer.shadowColor='#667766';
    renderer.width=width;renderer.height=height;renderer.rocket(altitude);
    const textured=renderer.faces.filter(f=>f.image);
    assert.equal(textured.length,480,'the detailed artwork appears on one curved front only');
    assert.ok(textured.every(f=>f.image===image));
    assert.ok(renderer.faces.filter(f=>!f.image).length>1,'solid side walls accompany the front');
    for(const face of renderer.faces)for(const [x,y] of face.points){
      assert.ok(Number.isFinite(x)&&Number.isFinite(y));
      assert.ok(x>0&&x<width&&y>0&&y<height,JSON.stringify({width,height,blend,altitude,x,y}));
    }
  }
});

test('crew outline tracing preserves holes and separate shapes while discarding transparent glow',()=>{
  const width=24,height=16,data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const body=x>=1&&x<13&&y>=1&&y<13,hole=x>=5&&x<9&&y>=5&&y<9,island=x>=18&&x<21&&y>=4&&y<7;
    data.set([180,130,90,(body&&!hole)||island?255:20],(y*width+x)*4);
  }
  const hull=buildCrewHull({data,width,height});assert.equal(hull.length,3);
  const areas=hull.map(loop=>{
    assert.equal(loop.points.length,loop.colors.length);assert.ok(loop.points.length>=4);
    assert.ok(loop.colors.every(color=>/^#[0-9a-f]{6}$/.test(color)));
    assert.ok(loop.points.flat().every(n=>n>=0&&n<=1));
    return loop.points.reduce((sum,a,i)=>{const b=loop.points[(i+1)%loop.points.length];return sum+a[0]*b[1]-b[0]*a[1];},0)/2;
  });
  assert.equal(areas.filter(a=>a<0).length,1,'holes have inward-facing walls');
  assert.ok(Math.abs(areas.reduce((a,b)=>a+b,0)*width*height-(144-16+9))<1e-8);
  assert.deepEqual(buildCrewHull(),[]);
});

test('crew side surfaces connect the back to the front bevel without repeated texture slices',()=>{
  const renderer=new Scene3D({});renderer.camera=new Camera(1200,570,1);
  renderer.crewImage={width:1536,height:1024};
  renderer.crewHull=[{points:[[0,0],[1,0],[1,1],[0,1]],colors:Array(4).fill('#bda879')}];
  const faces=[];renderer.face=(vertices,color)=>faces.push({vertices,color});
  renderer.crewSides(25,[1,0,0]);
  assert.ok(faces.length>0&&faces.length<=12);
  const depthPairs=new Set(faces.map(f=>[...new Set(f.vertices.map(p=>p[2]))].sort((a,b)=>a-b).join(',')));
  assert.ok(depthPairs.size>=2&&depthPairs.size<=3,'continuous middle and front bevel connect; hidden back faces may be culled');
  for(const face of faces){
    assert.ok(face.vertices.flat().every(Number.isFinite));
    assert.match(face.color,/^#[0-9a-f]{6}$/);
  }
  const frontDepth=Math.max(...faces.flatMap(f=>f.vertices.map(p=>p[2])));
  const frontEdges=faces.flatMap(f=>f.vertices.filter(p=>p[2]===frontDepth));
  assert.ok(frontEdges.every(p=>Math.abs(Math.abs(p[0])-100*.965)<1e-8));
});

test('all original obstacle sprites turn smoothly with the camera, retain height and keep depth within their lane',()=>{
  const image={width:128,height:128},side={width:128,height:128};
  for(const kind of OBSTACLES){
    let previousAxis;
    for(const blend of [0,.25,.5,.75,1]){
      const o={...kind,x:420,y:RULES.ground-kind.height-(kind.altitude||0),sector:'area51'};
      const before=JSON.stringify(o),renderer=new Scene3D({},{get:()=>({image,side})});
      renderer.camera=new Camera(1200,570,blend);renderer.viewBlend=blend;renderer.time=5;
      const panels=[],originalPanel=renderer.spritePanel.bind(renderer);
      renderer.spritePanel=(source,options)=>{panels.push({source,...options});originalPanel(source,options);};
      renderer.hazard(o,254);
      if(kind.type==='low_jet'){
        assert.equal(panels.length,0,'jets retain their solid 3D model');
        assert.ok(renderer.faces.length>20);assert.ok(renderer.faces.every(f=>!f.image));
        assert.ok(renderer.faces.flatMap(f=>f.points).flat().every(Number.isFinite));
        assert.equal(JSON.stringify(o),before);continue;
      }
      assert.equal(panels.length,7);assert.equal(panels.at(-1).source,image);
      assert.ok(panels.slice(0,-1).every(p=>p.source===side));
      const front=panels.at(-1);
      assert.equal(front.y,kind.altitude||0);assert.equal(front.h,kind.height);
      assert.equal(front.x,420-254+kind.width/2);
      assert.ok(front.axis[0]>.85,'artwork keeps a forward heading');
      if(previousAxis)assert.ok(Math.hypot(...front.axis.map((n,i)=>n-previousAxis[i]))<.25,'no abrupt turn while changing cameras');
      previousAxis=front.axis;
      const span=front.depth-panels[0].depth;assert.ok(span>=12&&span<=28,'visible thickness stays inside the route');
      assert.equal(renderer.faces.filter(f=>f.image).length,112);
      assert.ok(renderer.faces.flatMap(f=>f.points).flat().every(Number.isFinite));
      assert.equal(JSON.stringify(o),before);
    }
  }
});

test('perspective texturing uses finite transforms, preserves transparency and balances the canvas stack',()=>{
  const image={width:1536,height:1024};let stack=0,draws=0;
  const c={save(){stack++;},restore(){stack--;},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},
    transform(...args){assert.ok(args.every(Number.isFinite));},drawImage(source){assert.equal(source,image);draws++;}};
  const renderer=new Scene3D(c);renderer.camera=new Camera(1200,570,1);
  renderer.crewPanel(image,80,[.8,0,.6]);
  for(const face of renderer.faces)renderer.paintTexture(face);
  assert.equal(draws,480);assert.equal(stack,0);assert.equal(c.imageSmoothingEnabled,false);
});

test('scenery facades render after their own solid sides so boards cannot mask lettering',()=>{
  const image={width:412,height:164},sprite={image,width:206,height:82,left:-8,top:74,sourceWidth:190,
    hull:[{points:[[0,0],[1,0],[1,1],[0,1]],colors:Array(4).fill('#889977')}]};
  for(const blend of [0,.5,1])for(const side of [0,.5,1]){
    const renderer=new Scene3D({});renderer.scenerySprites={get:()=>sprite};
    renderer.camera=new Camera(1200,570,blend,side);renderer.viewBlend=blend;renderer.width=1200;renderer.height=570;
    renderer.shadowColor='#889977';renderer.time=1;
    renderer.landmark(400,-320,5,SCENES[0],.9);
    assert.equal(renderer.faces.length,1,'each prop has one compositing group');
    const group=renderer.faces[0].group,index=group.findIndex(f=>f.image);
    assert.ok(index>=1);assert.equal(group.filter(f=>f.image).length,36);
    assert.ok(group.slice(index).every(f=>f.image===image),'all of the caption paints over its own backing');
    assert.ok(group.flatMap(f=>f.points).flat().every(Number.isFinite));
    const painted=[];
    renderer.paintTexture=()=>painted.push('front');
    renderer.ctx=new Proxy({fill(){painted.push('side');}},{get:(o,key)=>o[key]??(()=>{}),set:(o,key,v)=>(o[key]=v,true)});
    renderer.flush();assert.equal(renderer.faces.length,0);
    assert.ok(painted.slice(painted.indexOf('front')).every(p=>p==='front'));
  }
});

test('Classic and both 3D views share the same scenery sequence, spacing and side-on ground positions',()=>{
  const {Art,sceneryLayout}=require('../game-art.js');
  const c=new Proxy({},{get:(o,key)=>o[key]??(()=>{}),set:(o,key,value)=>(o[key]=value,true)});
  for(const palette of SCENES)for(const distance of [0,2000,390/.19-.1,390/.19+.1,6000,16000]){
    const source=sceneryLayout(palette.id,distance,-800,4400),props=[],mountains=[],ridges=[];
    const renderer=new Scene3D(c);
    renderer.landmark=(x,z,variant,p,scale,elevation)=>props.push({x,z,variant,scale,elevation});
    renderer.mesa=(x,z,w,h,d)=>ridges.push({z,w,h,d});
    const tube=renderer.tube.bind(renderer);
    renderer.tube=(x,y,z,h,r,...rest)=>{if(z<-700)mountains.push({z,r});else tube(x,y,z,h,r,...rest);};
    const game=new Runner();game.start();
    renderer.render({width:1200,height:570,palette,game,distance,time:1,blend:1,side:1});
    assert.equal(props.length,source.filter(s=>s.visible).length);
    source.filter(s=>s.visible).forEach((s,i)=>{
      assert.equal(props[i].variant,s.variant);assert.equal(props[i].x,s.x-254);
      assert.equal(props[i].z,-s.depth);assert.equal(props[i].scale,s.size);assert.equal(props[i].elevation,s.elevation);
    });
    const art=new Art(c),classic=[];let at;
    c.translate=(x,y)=>{at={x,y};};art.landmark=(id,variant)=>classic.push({...at,variant});
    art.landmarks(palette.id,1200,485,distance,palette,1,true);
    const visible=sceneryLayout(palette.id,distance,0,1200).filter(s=>s.visible);
    assert.equal(classic.length,visible.length);
    visible.forEach((s,i)=>assert.deepEqual(classic[i],{x:Math.round(s.x),y:Math.round(485-s.elevation),variant:s.variant}));
    assert.ok(Math.max(...mountains.map(m=>m.z+m.r))<Math.min(...props.map(p=>p.z))-100);
    assert.ok(Math.max(...ridges.map(r=>r.z))<Math.min(...mountains.map(m=>m.z-m.r))-100);
  }
});

test('scenery contact shadows follow the turned facade, rear depth and raised Classic base',()=>{
  const sprite={image:{width:698,height:302},width:349,height:151,left:-8,top:143,sourceWidth:333,hull:[]};
  for(const blend of [0,.5,1])for(const side of [0,.5,1]){
    const renderer=new Scene3D({});renderer.scenerySprites={get:()=>sprite};
    renderer.camera=new Camera(1200,570,blend,side);renderer.viewBlend=blend;renderer.time=1;renderer.shadowColor='#888888';
    const polygons=[],front=[];renderer.face=(points)=>polygons.push(points);
    renderer.spritePanel=(image,{surface})=>{front.push(surface(8/349,143/151),surface(341/349,143/151));};
    const elevation=24*side;renderer.landmark(200,-320,0,SCENES[4],1.4,elevation);
    const shadow=polygons[0];assert.equal(shadow.length,4);
    assert.ok(shadow.every(p=>Math.abs(p[1]-(elevation+.2))<1e-8));
    const span=[front[1][0]-front[0][0],front[1][2]-front[0][2]],edge=[shadow[1][0]-shadow[0][0],shadow[1][2]-shadow[0][2]];
    assert.ok(Math.abs(span[0]*edge[1]-span[1]*edge[0])<1e-7,'shadow and facade have the same heading');
    const length=Math.hypot(...span),normal=[-span[1]/length,span[0]/length];
    const offsets=shadow.map(p=>(p[0]-front[0][0])*normal[0]+(p[2]-front[0][2])*normal[1]);
    assert.ok(Math.abs(Math.max(...offsets)-2.1)<1e-7,'only a narrow contact edge extends in front');
    assert.ok(Math.abs(Math.min(...offsets)-(-90*1.4*(1-side)-2.1))<1e-7,'the footprint extends behind the facade with the actual model depth');
  }
});
