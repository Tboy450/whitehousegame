const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Art,SCENES}=require('../game-art.js');
const {Runner,SECTOR_IDS}=require('../game-core.js');

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
  for(let scene=0;scene<5;scene++)for(const roll of [0,.26,.51,.99]){
    const runner=new Runner(()=>roll);runner.start(scene);runner.time=9;runner.spawn();
    const ctx=context(),art=new Art(ctx);art.obstacle(runner.obstacles[0],12.5);
    assert.equal(ctx.stack,0);assert.ok(ctx.commands.length>10);
    signatures.add(JSON.stringify(ctx.commands));
  }
  assert.equal(signatures.size,20);
});

test('all maps render their own background references across a parallax wrap',()=>{
  assert.deepEqual(SCENES.map(scene=>scene.id),SECTOR_IDS);
  const references=['TAKE 1969','RED FILTER: ON','PARKING ONLY','SKUNK WORKS','STARFACTORY'];
  for(let index=0;index<5;index++)for(const width of [800,1200])for(const distance of [0,7640,7690]){
    const ctx=context(),art=new Art(ctx);
    art.background({index,width,height:570,ground:480,distance,time:30,reduced:false});
    assert.equal(ctx.stack,0);assert.ok(ctx.labels.includes(references[index]));
  }
});
