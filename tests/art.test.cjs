const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Art,SCENES,ObstacleSprites}=require('../game-art.js');
const {Runner,SECTOR_IDS,OBSTACLES}=require('../game-core.js');

function context() {
  const commands=[],labels=[];
  let stack=0;
  const geometry=(name,args)=>{
    for(const argument of args)assert.ok(Number.isFinite(argument),name+' received an invalid coordinate');
    commands.push([name,...args]);
  };
  return {commands,labels,get stack(){return stack;},
    save(){stack++;},restore(){stack--;assert.ok(stack>=0);},
    translate(...args){geometry('translate',args);},scale(...args){geometry('scale',args);},
    fillRect(...args){geometry('fillRect',args);assert.ok(args[2]>=0&&args[3]>=0);},
    moveTo(...args){geometry('moveTo',args);},lineTo(...args){geometry('lineTo',args);},
    beginPath(){},closePath(){},fill(){},stroke(){},
    fillText(label,...args){labels.push(label);geometry('fillText',args);}
  };
}

test('every engine-spawned obstacle has valid, distinct foreground artwork',()=>{
  const signatures=new Set();
  for(const kind of OBSTACLES){
    const ctx=context(),art=new Art(ctx);art.obstacle({...kind,sector:'moon',x:900,y:464-kind.height-(kind.altitude||0)},12.5);
    assert.equal(ctx.stack,0);assert.ok(ctx.commands.length>10);
    signatures.add(JSON.stringify(ctx.commands));
  }
  assert.equal(signatures.size,22);
});

test('all maps retain their references while scenery changes throughout the route',()=>{
  assert.deepEqual(SCENES.map(scene=>scene.id),SECTOR_IDS);
  const references=['TAKE 1969','RED FILTER: ON','PARKING ONLY','SKUNK WORKS','STARFACTORY'];
  for(let index=0;index<5;index++)for(const width of [800,1200]){
    const labels=new Set();
    for(const distance of [0,2000,4000,6000,7640,7690,10000,16000]){
      const ctx=context(),art=new Art(ctx);
      art.background({index,width,height:570,ground:480,distance,time:30,reduced:false});
      assert.equal(ctx.stack,0);ctx.labels.forEach(label=>labels.add(label));
    }
    assert.ok(labels.has(references[index]));
  }
});

test('scenery has stable positions, varied spacing and bases inside the rear ground plane',()=>{
  function sample(index,distance){
    const ctx=context(),art=new Art(ctx),props=[],originalTranslate=ctx.translate;
    let x=0,y=0,scale=1;
    ctx.translate=(px,py)=>{x=px;y=py;originalTranslate(px,py);};
    ctx.scale=(sx)=>{scale=sx;};
    art.landmark=(id,variant)=>props.push({id,variant,x,y,scale});
    art.landmarks(SCENES[index].id,2400,480,distance,SCENES[index],5,true);
    return props;
  }
  for(let index=0;index<5;index++){
    const a=sample(index,0),b=sample(index,40);
    assert.deepEqual(a,sample(index,0));
    assert.ok(new Set(a.map(p=>p.scale)).size>3);
    assert.ok(new Set(a.slice(1).map((p,i)=>p.x-a[i].x)).size>3);
    a.forEach((p,i)=>{
      assert.ok(p.y>=480-36&&p.y<=480-7,'prop base is inside the continuous ground apron');
      assert.equal(p.variant,b[i].variant);assert.equal(p.scale,b[i].scale);
      assert.ok(Math.abs((p.x-b[i].x)-40*.19)<=1,'parallax motion must not reseed a prop');
    });
  }
});

test('reserve crew draws valid geometry without any external image',()=>{
  const ctx=context(),art=new Art(ctx);art.reserveCrew(154,464,200);
  assert.equal(ctx.stack,0);assert.ok(ctx.commands.length>40);
});

test('perspective obstacle textures reuse classic art, cache by palette and repaint only animation frames',()=>{
  const canvases=[];
  const sprites=new ObstacleSprites(()=>{
    const c=context();c.clearRect=(...args)=>c.commands.push(['clearRect',...args]);
    const fillRect=c.fillRect;c.fillRect=(...args)=>{fillRect(...args);c.commands.push(['color',c.fillStyle]);};
    c.fill=()=>c.commands.push(['fill',c.fillStyle]);
    c.drawImage=source=>c.commands.push(['drawImage',source]);
    const canvas={getContext:()=>c};canvases.push(canvas);return canvas;
  });
  const signatures=new Set();
  for(const kind of OBSTACLES){
    const o={...kind,x:500,y:300,sector:'moon'},before=JSON.stringify(o);
    const sprite=sprites.get(o,0),commands=sprite.ctx.commands;
    assert.equal(sprite.image.width,128);assert.equal(sprite.side.width,128);
    signatures.add(JSON.stringify(commands));
    const draws=commands.length;
    assert.equal(sprites.get({...o,x:200},.02),sprite);assert.equal(commands.length,draws);
    sprites.get(o,1);
    const animated=/rover|cart|chest|ufo|low_jet|jet_engine/.test(o.type);
    assert.equal(commands.length>draws,animated);
    assert.equal(sprite.ctx.stack,0);assert.equal(sprite.sideContext.globalCompositeOperation,'source-over');
    assert.equal(sprites.get({...o,sector:'mars'},1),sprite);
    assert.notEqual(sprites.get({...o,sector:'area51'},1),sprite);
    assert.equal(JSON.stringify(o),before);
  }
  assert.equal(signatures.size,OBSTACLES.length);
  assert.equal(sprites.cache.size,OBSTACLES.length*2);assert.equal(canvases.length,OBSTACLES.length*4);
});
