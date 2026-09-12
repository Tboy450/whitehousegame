/* Original canvas pixel scenery and sector-specific obstacle sprites.
   Background sets are decorative; only foreground obstacles have collisions. */
(function (root) {
  'use strict';
  const SCENES = [
    { id:'moon', title:'THE MOON*', joke:'*a.k.a. the Nevada desert.', announcement:'NEXT STOP: THE MOON. DEFINITELY NOT NEVADA.',
      sky:'#f8f8f1', dust:'#ecedde', ridge:'#e0e5d6', ridgeShadow:'#d5ddc9', ground:'#959f81', speck:'#cbd1bb', rock:'#adb69a', sun:'#f0e8c8', cactus:'#afb99a',
      crashes:['Cut! Reset the moon.','The camera adds ten pounds. And one collision.','The moon rock would like its close-up.'] },
    { id:'mars', title:'MARS*', joke:'*Arizona, with the saturation turned up.', announcement:'WELCOME TO MARS. ARIZONA SENDS ITS REGARDS.',
      sky:'#faf0df', dust:'#edc7a5', ridge:'#dfa785', ridgeShadow:'#d19573', ground:'#ad7152', speck:'#cf9e7b', rock:'#b57d58', sun:'#eac5a3', cactus:'#c28b64',
      crashes:['Your warranty does not cover Mars.','Good news: the red filter still works.','The rover has right of way. Apparently.'] },
    { id:'area51', title:'AREA 51', joke:'Just a weather balloon. Keep moving.', announcement:'AREA 51 — YOU SAW ABSOLUTELY NOTHING.',
      sky:'#232d3c', dust:'#3a454b', ridge:'#303d4b', ridgeShadow:'#263443', ground:'#8a9b7d', speck:'#566461', rock:'#7d8b76', sun:'#acbba0', cactus:'#626e64',
      crashes:['This flight never happened.','Your incident report has been redacted.','The weather balloon would like a word.'] },
    { id:'lockheed', title:'LOCKHEED MARTIN / SKUNK WORKS', joke:'Even the cacti signed NDAs.', announcement:'SKUNK WORKS — THIS RUN IS CLASSIFIED.',
      sky:'#eaf0ef', dust:'#d9d8ca', ridge:'#bdcacc', ridgeShadow:'#a8b9bd', ground:'#7d8d8e', speck:'#b4b8a9', rock:'#9ca69b', sun:'#d1dedd', cactus:'#98a79c',
      crashes:['Your landing clearance is classified.','Stealth mode did not hide that landing.','The toolbox has filed an incident report.'] },
    { id:'spacex', title:'SPACEX / STARBASE', joke:'Some assembly required. Rapid disassembly included.', announcement:'STARBASE — PLEASE KEEP ALL ROCKET PARTS.',
      sky:'#edf5f4', dust:'#e6dfc9', ridge:'#c8dedd', ridgeShadow:'#accdcd', ground:'#8aada1', speck:'#c3c5ad', rock:'#a6b39a', sun:'#f0deb2', cactus:'#9bbdaa',
      crashes:['Rapid unscheduled parking.','The landing was experimental. Very experimental.','Please collect all rocket parts before leaving.'] }
  ];
  const OBSTACLE_TYPES = Object.freeze([
    'moon_rock','film_camera','lunar_rover','studio_light',
    'red_basalt','sample_canister','mars_rover','relay_mast',
    'secret_crate','parked_ufo','alien','checkpoint',
    'tool_chest','jet_engine','radar_cart','equipment_cart',
    'booster_section','fuel_tank','rocket_engine','robot_cart','low_jet','low_ufo'
  ]);

  const LANDMARK_WIDTHS = {"moon":[72,205,90,142,140,153],"mars":[180,290,78,96,177,110],"area51":[192,160,261,119,177,164],"lockheed":[248,224,71,208,190,78],"spacex":[333,222,132,189,178,25]};
  function sceneryNoise(cell,salt) {
    let n=Math.imul(cell+1,374761393)^Math.imul(salt,668265263);
    n=Math.imul(n^(n>>>13),1274126177);
    return ((n^(n>>>16))>>>0)/4294967296;
  }

  class Art {
    constructor(ctx) { this.ctx = ctx; }
    rect(x,y,w,h,color) {
      if(color) this.ctx.fillStyle=color;
      this.ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
    }
    poly(points,color) {
      const c=this.ctx;c.fillStyle=color;c.beginPath();
      points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));
      c.closePath();c.fill();
    }
    line(points,color,width=2) {
      const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.beginPath();
      points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));c.stroke();
    }
    orb(x,y,r,color) {
      this.rect(x-r*.65,y-r,r*1.3,r*2,color);this.rect(x-r,y-r*.65,r*2,r*1.3);
      this.rect(x-r*.86,y-r*.86,r*1.72,r*1.72);
    }
    text(text,x,y,color,size=10,align='left') {
      const c=this.ctx;c.font='bold '+size+'px "Courier New", monospace';c.textAlign=align;c.textBaseline='alphabetic';c.fillStyle=color;c.fillText(text,Math.round(x),Math.round(y));
    }
    sign(x,y,lines,palette,{width=166,dark=false}={}) {
      const h=lines.length*13+14,ink=dark?'#b9cba9':'#6c7667',paper=dark?'#3b4d50':'#e1e3d7';
      this.rect(x+13,y,4,-y,palette.ground);this.rect(x+width-17,y,4,-y,palette.ground);
      this.rect(x,y-h,width,h,ink);this.rect(x+2,y-h+2,width-4,h-4,paper);
      lines.forEach((label,i)=>this.text(label,x+width/2,y-h+15+i*13,ink,10,'center'));
    }
    cloud(x,y,s,palette) {
      const c=this.ctx;c.save();c.translate(Math.round(x),Math.round(y));c.scale(s,s);
      this.rect(0,12,84,14,palette.ridge);this.rect(15,4,30,12);this.rect(38,-3,27,20);this.rect(68,8,9,12);
      this.rect(5,12,69,7,palette.sky);this.rect(19,7,25,9);this.rect(43,1,17,15);c.restore();
    }
    cactus(x,y,s,color) {
      const c=this.ctx;c.save();c.translate(Math.round(x),Math.round(y));c.scale(s,s);
      this.rect(11,-53,9,53,color);this.rect(13,-57,5,5);
      this.rect(0,-39,6,20);this.rect(4,-24,10,6);this.rect(25,-45,6,20);this.rect(17,-30,12,6);c.restore();
    }
    dish(x,y,s,body,highlight,time=0) {
      const c=this.ctx;c.save();c.translate(Math.round(x),Math.round(y));c.scale(s,s);
      this.rect(-3,-35,6,35,body);this.rect(-14,-3,28,3);
      this.poly([[-25,-62],[-18,-46],[0,-38],[19,-46],[26,-61],[16,-52],[-13,-52]],body);
      this.line([[-20,-58],[0,-41],[20,-58]],highlight,2);this.line([[0,-41],[8,-64]],body,2);
      this.rect(5,-67,6,4,highlight);if(Math.sin(time*2)>0)this.rect(-2,-28,4,3,highlight);c.restore();
    }
    rover(x,y,s,body,window,time=0) {
      const c=this.ctx;c.save();c.translate(Math.round(x),Math.round(y));c.scale(s,s);
      for(const wheel of [4,25,46]){this.orb(wheel,-7,7,'#606961');this.rect(wheel-3,-10,6,6,body);}
      this.line([[2,-17],[11,-6],[26,-20],[46,-7]],body,4);
      this.rect(5,-31,42,15,body);this.rect(12,-28,26,5,window);
      this.rect(31,-54,3,24,body);this.rect(24,-60,19,9,body);this.rect(34,-58,7,5,window);
      this.rect(7,-40,29,6,window);this.rect(18,-37,3,8,body);
      this.rect(49,-28,4,18,body);this.rect(49,-16,13,3);c.restore();
    }
    habitat(x,y,s,p) {
      const c=this.ctx;c.save();c.translate(Math.round(x),Math.round(y));c.scale(s,s);
      this.poly([[0,0],[0,-37],[10,-55],[28,-69],[64,-75],[103,-69],[122,-54],[132,-35],[132,0]],p.ridgeShadow);
      this.poly([[6,-4],[6,-33],[16,-49],[34,-61],[66,-67],[101,-62],[116,-49],[125,-31],[125,-4]],'#ead4b7');
      this.rect(18,-39,25,17,'#b49a80');this.rect(23,-35,15,8,'#c4dad1');
      this.rect(86,-39,25,17,'#b49a80');this.rect(91,-35,15,8,'#c4dad1');
      this.rect(55,-36,23,36,p.ridgeShadow);this.rect(61,-30,11,21,'#b9cabf');
      this.line([[65,-64],[65,-41]],p.ridgeShadow,2);
      this.line([[32,-59],[24,-45]],p.ridgeShadow,2);this.line([[99,-59],[108,-45]],p.ridgeShadow,2);c.restore();
    }
    solar(x,y,columns,body,panel) {
      for(let i=0;i<columns;i++){
        const bx=x+i*45;this.rect(bx+16,y-19,4,19,body);
        this.poly([[bx,y-32],[bx+33,y-32],[bx+41,y-13],[bx+7,y-13]],body);
        this.poly([[bx+4,y-29],[bx+30,y-29],[bx+35,y-17],[bx+9,y-17]],panel);
        this.line([[bx+14,y-29],[bx+19,y-17]],body,1);this.line([[bx+24,y-29],[bx+29,y-17]],body,1);
        this.line([[bx+7,y-23],[bx+32,y-23]],body,1);
      }
    }
    hangar(x,y,w,h,body,shade,name) {
      this.poly([[x,y],[x,y-h+15],[x+16,y-h],[x+w-16,y-h],[x+w,y-h+15],[x+w,y]],body);
      this.rect(x+10,y-h+23,w-20,h-23,shade);
      for(let i=0;i<Math.floor((h-24)/9);i++)this.rect(x+12,y-h+27+i*9,w-24,2,body);
      this.rect(x+13,y-h+8,36,5,shade);
      if(name)this.text(name,x+w*.5,y-h+16,shade,10,'center');
    }
    jet(x,y,s,color) {
      const c=this.ctx;c.save();c.translate(Math.round(x),Math.round(y));c.scale(s,s);
      this.poly([[0,-8],[29,-18],[72,-20],[96,-15],[147,-9],[171,-3],[115,0],[17,-1]],color);
      this.poly([[45,-15],[69,-46],[76,-44],[79,-14]],color);
      this.poly([[53,-6],[96,-28],[102,-25],[84,-3]],color);
      this.poly([[14,-10],[18,-33],[23,-33],[36,-10]],color);
      this.rect(91,-17,13,5,'#aabec0');this.rect(32,0,4,5,color);this.rect(112,0,4,5,color);c.restore();
    }
    saucer(x,y,s,time,body,light) {
      const c=this.ctx;c.save();c.translate(Math.round(x),Math.round(y));c.scale(s,s);
      this.rect(-21,-21,42,14,body);this.rect(-13,-29,26,8);this.rect(-8,-26,16,6,light);
      this.poly([[-46,-5],[-29,-15],[29,-15],[46,-5],[33,2],[-32,2]],body);
      this.rect(-34,-5,68,3,light);
      for(let i=0;i<5;i++)this.rect(-27+i*13,-1,5,3,Math.sin(time*3+i)>.2?light:body);
      c.restore();
    }
    launchTower(x,y,s,body,shade) {
      const c=this.ctx;c.save();c.translate(Math.round(x),Math.round(y));c.scale(s,s);
      this.rect(0,-190,8,190,body);this.rect(44,-190,8,190);this.rect(-4,-198,60,8);
      for(let i=0;i<9;i++){
        this.rect(7,-181+i*20,39,4,body);
        this.line([[8,-176+i*20],[42,-159+i*20]],shade,3);
      }
      this.rect(6,-160,81,8,shade);this.rect(78,-160,9,52,body);this.rect(9,-110,60,7,shade);c.restore();
    }
    booster(x,y,s,body,shade) {
      const c=this.ctx;c.save();c.translate(Math.round(x),Math.round(y));c.scale(s,s);
      this.rect(0,-159,31,159,shade);this.rect(4,-154,19,149,body);this.rect(5,-172,21,13,shade);this.rect(10,-180,11,8);
      for(let i=0;i<7;i++)this.rect(1,-142+i*20,29,2,shade);
      this.rect(-8,-140,9,13,shade);this.rect(31,-140,9,13);
      this.rect(5,-7,6,10,shade);this.rect(20,-7,6,10);c.restore();
    }

    landmark(id,variant,p,time,reduced) {
      const c=this.ctx;
      switch(id) {
        case 'moon':
          switch(variant) {
            case 0: {
              c.translate(-42,0);
              this.dish(72,0,1.2,p.ridgeShadow,p.sky,time);
              break;
            }
            case 1: {
              c.translate(-238,0);
              this.rect(270,-79,54,38,'#c8c4a6');this.rect(276,-103,41,28,'#d9dccb');
              this.poly([[278,-103],[285,-116],[309,-116],[317,-103]],'#c7cebd');
              this.rect(284,-98,25,13,'#98a694');this.rect(292,-109,13,7,'#edf0df');
              this.line([[279,-43],[254,0],[242,0]],'#adb398',5);this.line([[315,-43],[341,0],[351,0]],'#adb398',5);
              this.rect(266,-49,63,9,'#c1b58e');this.line([[293,-43],[293,0]],'#a8ad95',3);
              for(let y=-39;y<-6;y+=7)this.rect(290,y,12,2,'#a8ad95');
              this.rect(397,-87,3,87,p.ground);this.rect(400,-85,39,25,'#e2ded0');
              for(let stripe=0;stripe<4;stripe++)this.rect(400,-84+stripe*7,38,3,'#be9686');
              this.rect(400,-84,15,13,'#879daa');
              break;
            }
            case 2: {
              c.translate(-475,0);
              this.rover(475,0,1.2,'#b6beaa','#8eaaad');
              break;
            }
            case 3: {
              c.translate(-570,0);
              this.sign(570,-30,['LUNAR PARKING','NO EARTHLINGS'],p,{width:142});
              break;
            }
            case 4: {
              c.translate(-722,0);
              this.rect(831,-119,5,119,p.ground);this.line([[832,-25],[815,0]],p.ground,3);this.line([[833,-25],[854,0]],p.ground,3);
              this.rect(813,-145,39,28,'#a5ae99');this.rect(819,-140,25,17,'#e3d9b1');
              this.poly([[809,-144],[814,-137],[814,-122],[807,-117]],p.ridgeShadow);
              this.poly([[850,-143],[858,-151],[857,-115],[850,-123]],p.ridgeShadow);
              this.rect(725,-69,31,21,p.ridgeShadow);this.orb(733,-75,9,p.ground);this.orb(752,-74,8,p.ground);
              this.poly([[756,-65],[767,-70],[767,-45],[756,-50]],p.ground);
              this.line([[742,-48],[727,0]],p.ground,3);this.line([[742,-48],[758,0]],p.ground,3);
              break;
            }
            case 5: {
              c.translate(-906,0);
              this.sign(906,-32,['TAKE 1969','DEFINITELY SPACE'],p,{width:153});
              break;
            }
          }
          break;
        case 'mars':
          switch(variant) {
            case 0: {
              c.translate(-30,0);
              this.solar(30,0,4,'#bd9275','#8f9f9c');
              break;
            }
            case 1: {
              c.translate(-283,0);
              this.habitat(283,0,1.3,p);
              this.habitat(475,0,.72,p);this.rect(451,-27,25,14,p.ridgeShadow);
              break;
            }
            case 2: {
              c.translate(-582,0);
              this.dish(620,0,1.2,p.ridgeShadow,'#eddbb8',time);
              break;
            }
            case 3: {
              c.translate(-755,0);
              this.rover(755,0,1.35,'#d5b48c','#8babae');
              break;
            }
            case 4: {
              c.translate(-1010,0);
              this.sign(1010,-29,['RED FILTER: ON','ARIZONA: CLASSIFIED'],p,{width:177});
              break;
            }
            case 5: {
              c.translate(-1260,0);
              this.rect(1260,-46,30,46,'#bf9274');this.rect(1266,-39,18,18,'#dac5a2');
              this.rect(1290,-18,38,18,p.ridgeShadow);this.cactus(1345,0,.66,p.cactus);
              break;
            }
          }
          break;
        case 'area51':
          switch(variant) {
            case 0: {
              c.translate(-10,0);
              this.hangar(10,0,192,82,'#51626a','#3c4b56','HANGAR 51');
              break;
            }
            case 1: {
              c.translate(-206,0);
              this.dish(257,0,1.8,'#687e78','#bdd69e',time);
              c.save();c.globalAlpha=.06;
              const sweep=reduced?0:Math.sin(time*.6)*30;
              this.poly([[343,-30],[275+sweep,-200],[404+sweep,-200]],'#d5e7b4');c.restore();
              this.rect(339,-50,8,50,'#698077');this.rect(332,-58,22,12,'#82947c');
              break;
            }
            case 2: {
              c.translate(-415,0);
              this.hangar(415,0,261,103,'#56676b','#3d4c55','AUTHORIZED PERSONNEL');
              const bob=reduced?0:Math.sin(time*1.7)*5;
              this.saucer(565,-180+bob,1.1,time,'#7d998d','#c7e7a5');
              break;
            }
            case 3: {
              c.translate(-755,0);
              this.rect(755,-30,119,25,'#66786f');this.rect(781,-48,61,20,'#66786f');
              this.rect(785,-44,21,12,'#9baca0');this.rect(813,-44,21,12,'#9baca0');
              this.rect(765,-13,18,13,'#384b50');this.rect(846,-13,18,13,'#384b50');
              break;
            }
            case 4: {
              c.translate(-942,0);
              this.sign(942,-37,['WEATHER BALLOON','PARKING ONLY'],p,{width:177,dark:true});
              break;
            }
            case 5: {
              c.translate(-1173,0);
              this.sign(1173,-28,['YOU SAW NOTHING'],p,{width:164,dark:true});
              this.rect(1173,-99,4,99,'#698077');this.rect(1177,-99,20,14,'#82947c');
              break;
            }
          }
          break;
        case 'lockheed':
          switch(variant) {
            case 0: {
              c.translate(-20,0);
              this.hangar(20,0,248,106,'#a6b7b9','#80969e','SKUNK WORKS');
              this.jet(62,-5,.92,'#697d85');
              break;
            }
            case 1: {
              c.translate(-355,0);
              this.jet(355,-6.5,1.3,'#7e9299');
              break;
            }
            case 2: {
              c.translate(-601,0);
              this.rect(623,-128,28,128,'#a6b7b9');this.rect(606,-157,61,30,'#98aaaf');
              this.rect(601,-163,71,7,'#80969e');this.rect(613,-149,49,15,'#c7d9d7');
              this.rect(635,-182,3,19,'#80969e');this.line([[626,-182],[647,-182]],'#80969e',2);
              break;
            }
            case 3: {
              c.translate(-752,0);
              this.hangar(752,0,208,75,'#a6b7b9','#81969c','ENGINE TEST');
              this.orb(856,-38,27,'#cad5cf');this.orb(856,-38,20,'#879fa5');
              for(let i=0;i<5;i++){
              const angle=i*Math.PI*2/5+(reduced?0:time*.7);
              this.line([[856,-38],[856+Math.cos(angle)*17,-38+Math.sin(angle)*17]],'#b8c7c4',4);
              }
              break;
            }
            case 4: {
              c.translate(-1020,0);
              this.sign(1020,-32,['SECRET PARKING','EVEN THE CACTI SIGNED'],p,{width:190});
              // A tiny skunk on a crate is a visual pun, not a logo.
              this.rect(1147,-18,22,18,'#899a97');this.rect(1144,-32,19,11,'#7a8c89');
              this.rect(1154,-38,13,10,'#7a8c89');this.rect(1157,-36,4,10,'#d6ddd0');
              break;
            }
            case 5: {
              c.translate(-1263,0);
              this.dish(1300,0,1.2,'#9cafb0','#dce6dc',time);
              break;
            }
          }
          break;
        case 'spacex':
          switch(variant) {
            case 0: {
              c.translate(-15,0);
              this.hangar(15,0,333,125,'#bdd0ce','#8dacae','STARFACTORY');
              this.rect(40,-119,274,9,'#dbe4da');
              for(let i=0;i<4;i++)this.rect(54+i*67,-87,41,84,'#aac5c4');
              this.booster(120,-5,.57,'#d3dfd9','#a0b9ba');this.booster(225,-5,.57,'#d3dfd9','#a0b9ba');
              break;
            }
            case 1: {
              c.translate(-414,0);
              this.launchTower(518,0,1.02,'#9ebabc','#7fa3a6');
              this.booster(594,-1,1.05,'#d7e2dc','#a3bdbe');
              this.rect(423,-169,4,169,'#8dacae');this.rect(414,-175,125,5,'#9dbbbd');this.rect(530,-172,2,30,'#8dacae');
              break;
            }
            case 2: {
              c.translate(-742,0);
              this.rect(763,-70,36,68,'#b5cecc');this.rect(758,-58,46,45,'#b5cecc');this.rect(771,-59,5,44,'#dce6db');
              this.rect(822,-49,29,47,'#b5cecc');this.rect(817,-39,39,28,'#b5cecc');
              this.rect(742,-4,132,4,'#92b4b1');this.rect(790,-15,63,4,'#92b4b1');
              break;
            }
            case 3: {
              c.translate(-937,0);
              this.sign(937,-30,['RAPID UNSCHEDULED','PARKING'],p,{width:189});
              break;
            }
            case 4: {
              c.translate(-1190,0);
              this.sign(1190,-34,['RETURN ALL PARTS','RECEIPT OPTIONAL'],p,{width:178});
              break;
            }
            case 5: {
              c.translate(-1121,0);
              this.rect(1121,-17,21,17,'#9bb9b6');this.rect(1124,-27,14,10,'#b9d0c7');
              break;
            }
          }
          break;
      }
    }

    landmarks(id,width,ground,distance,p,time,reduced) {
      const c=this.ctx,scroll=distance*.19,cellWidth=390;
      const first=Math.floor(scroll/cellWidth)-1;
      for(let cell=first;cell*cellWidth-scroll<width;cell++) {
        if(cell<0)continue;
        const seed=cell+SCENES.findIndex(scene=>scene.id===id)*127;
        const variant=(cell*5+Math.floor(cell/6)*3)%6;
        const size=.72+sceneryNoise(seed,1)*.25;
        const footprint=LANDMARK_WIDTHS[id][variant]*size;
        const x=cell*cellWidth-scroll+16+sceneryNoise(seed,2)*(cellWidth-footprint-48);
        const y=ground-29+sceneryNoise(seed,3)*13;
        // Occasional open stretches break up the facilities; positions stay stable as they scroll.
        if(cell%9!==7) {
          c.save();c.translate(Math.round(x),Math.round(y));
          c.globalAlpha=.32;this.rect(-5,-2,footprint+10,3,p.ground);c.globalAlpha=1;
          c.scale(size,size);this.landmark(id,variant,p,time,reduced);c.restore();
        }
        if(sceneryNoise(seed,4)>.48) {
          const bx=cell*cellWidth-scroll+cellWidth-24,by=ground-12;
          this.cactus(bx,by,.28+sceneryNoise(seed,5)*.22,p.cactus);
          this.rect(bx-2,by-1,16,2,p.speck);
        }
      }
    }

    background({index,width,height,ground,distance,time,reduced=false}) {
      const c=this.ctx,p=SCENES[index],night=p.id==='area51',mars=p.id==='mars';
      c.save();this.rect(0,0,width,height,p.sky);
      for(let i=0;i<35;i++){
        const x=((i*173+47-distance*.025)%(width+80)+width+80)%(width+80)-40;
        const y=45+(i*79)%Math.max(100,ground-170);
        c.globalAlpha=night?.75:.45;this.rect(x,y,2,2,night?'#d3dfca':'#dce2d4');
        if(night&&i%4===0){this.rect(x-2,y+1,6,1);this.rect(x+1,y-2,1,6);}
      }
      c.globalAlpha=1;const sunX=width*.79,sunY=Math.min(ground*.38,146);
      this.orb(sunX,sunY,42,p.sun);
      if(mars){this.orb(sunX-119,sunY-25,12,'#dfbca2');this.orb(sunX+97,sunY+20,8,'#dfbca2');}
      for(let i=0;i<(night?0:5);i++){
        const x=((i*310+80-distance*.06)%(width+220)+width+220)%(width+220)-110;
        c.globalAlpha=.62;this.cloud(x,60+(i*57)%115,.6+(i%3)*.25,p);
      }
      c.globalAlpha=1;
      // Far horizon. Martian canyons and the coastal launch site have different silhouettes.
      if(p.id==='spacex'){
        this.rect(0,ground-28,width,29,'#d2e5df');this.rect(0,ground-23,width,2,'#bcd7d2');
        for(let i=0;i<12;i++)this.rect((i*147-distance*.1)%width,ground-18+(i%3)*5,63,1,'#b8d6d2');
      } else for(let i=0;i<6;i++){
        const x=((i*370-distance*.11)%(width+500)+width+500)%(width+500)-250;
        const h=mars?93+(i%3)*36:38+(i%3)*19;
        this.poly([[x,ground],[x,ground-10],[x+35,ground-10],[x+35,ground-h*.5],[x+65,ground-h*.5],[x+65,ground-h],[x+130,ground-h],[x+130,ground-h*.7],[x+154,ground-h*.7],[x+154,ground-15],[x+210,ground-15],[x+210,ground]],p.ridge);
        if(mars){this.rect(x+65,ground-h+13,65,5,p.ridgeShadow);this.rect(x+35,ground-h*.5+9,119,3);this.rect(x+110,ground-h+18,20,h-18);}
      }
      // A continuous rear apron sits beneath every prop, above the foreground track.
      this.rect(0,ground-36,width,height-ground+36,p.dust);
      this.landmarks(p.id,width,ground,distance,p,time,reduced);
      // A separate closer strip emphasizes forward speed without concealing hazards.
      if(night||p.id==='lockheed'){
        for(let i=0;i<Math.ceil(width/34)+2;i++){
          const x=i*34-(distance*.34)%34;
          this.rect(x,ground-42,2,35,p.ridgeShadow);this.rect(x,ground-36,34,1,p.ridgeShadow);this.rect(x,ground-18,34,1,p.ridgeShadow);
        }
      }
      this.rect(0,ground-7,width,7,p.dust);this.rect(0,ground,width,height-ground,p.dust);
      this.rect(0,ground,width,2,p.ground);this.rect(0,ground+4,width,1,p.speck);
      if(p.id==='lockheed'||p.id==='spacex'){
        for(let i=0;i<Math.ceil(width/92)+2;i++)this.rect(i*92-distance%92,ground+15,38,3,p.id==='lockheed'?'#f1ede1':'#d2c6a3');
      }
      for(let i=0;i<66;i++){
        const x=((i*73+17-distance)%(width+100)+width+100)%(width+100)-50;
        const y=ground+13+(i*17)%67;
        this.rect(x,y,i%4===0?10:4,2,i%3===0?p.rock:p.speck);
      }
      if(p.id==='moon'||mars)for(let i=0;i<4;i++){
        const x=((i*357+100-distance*.7)%(width+130)+width+130)%(width+130)-65;
        this.rect(x,ground+29+(i%2)*18,46,2,p.speck);this.rect(x+7,ground+26+(i%2)*18,31,2,p.speck);
      }
      c.restore();
    }

    reserveCrew(x,bottom,width) {
      // A small, dependency-free crew keeps the game playable during an image outage.
      const c=this.ctx;c.save();c.translate(x,bottom);c.scale(width/200,width/200);
      this.poly([[0,-42],[27,-51],[20,-40],[29,-31]],'#ef8c37');
      this.rect(25,-54,132,32,'#d8dedd');this.rect(35,-50,110,9,'#f8f5e9');
      this.poly([[157,-54],[193,-38],[157,-22]],'#e9502f');
      this.poly([[38,-54],[22,-71],[66,-54]],'#d25035');
      this.poly([[38,-22],[24,-9],[70,-22]],'#d25035');
      this.rect(90,-44,21,12,'#819d9e');this.rect(94,-42,13,7,'#c5e0dc');
      for(const [rx,shirt,skin,hair] of [[68,'#314c70','#e3ac82','#e8c974'],[117,'#343936','#eac2a2','#615047']]){
        this.rect(rx,-81,22,26,shirt);this.rect(rx+3,-59,22,7,'#36414b');this.rect(rx+21,-56,6,12,'#36414b');
        this.rect(rx+1,-104,22,23,skin);this.rect(rx-1,-109,24,9,hair);this.rect(rx+19,-96,6,7,skin);
        this.rect(rx+17,-99,3,3,'#363b38');this.rect(rx+12,-86,9,2,'#a77156');
        this.rect(rx+18,-76,17,7,skin);this.rect(rx+31,-75,4,13,'#7a8580');
      }
      this.rect(78,-79,4,15,'#d24a35');this.rect(118,-108,23,7,'#242c30');
      c.restore();
    }

    obstacle(o,time=0) {
      if(o.altitude){
        this.ctx.save();this.ctx.globalAlpha=.2;
        this.rect(o.x+8,o.y+o.height+o.altitude-2,o.width-16,3,'#29373d');this.ctx.restore();
      }
      const c=this.ctx;c.save();c.translate(Math.round(o.x),Math.round(o.y));c.scale(o.width/64,o.height/64);
      // All art fits a 64x64 local sprite. No bounce or rotation changes its collision position.
      const ink=o.sector==='area51'?'#c5dcaf':'#2c383c';
      const steel='#a7b6b5',light='#e1e6d4',shade='#617779',orange='#d87a45',green='#a4bf71',panel='#477e87';
      const r=(x,y,w,h,color)=>this.rect(x,y,w,h,color);
      const p=(points,color)=>this.poly(points,color);
      const wheel=(x,y,radius=7)=>{
        this.orb(x,y,radius,ink);this.orb(x,y,radius-3,steel);
        r(x-1,y-4,2,8,shade);if(Math.floor(time*9)%2)r(x-4,y-1,8,2,shade);
      };
      const outlineBox=(x,y,w,h,fill)=>{r(x,y,w,h,ink);r(x+3,y+3,w-6,h-6,fill);};
      switch(o.type){
        case 'low_jet':
          p([[1,36],[23,22],[41,22],[50,5],[57,5],[55,28],[63,30],[59,46],[39,48],[27,61],[18,60],[25,44]],ink);
          p([[4,35],[25,27],[52,28],[57,39],[36,42],[23,53],[29,38]],steel);
          r(24,23,16,9,panel);r(27,24,8,4,'#b9e5e6');r(53,30,7,10,shade);
          r(60,32,4,6,Math.sin(time*22)>0?'#ffd77a':'#e9743d');break;
        case 'low_ufo':
          p([[19,9],[26,2],[41,2],[48,12],[49,24],[61,33],[63,45],[53,58],[10,58],[1,45],[3,33],[17,24]],ink);
          p([[20,14],[28,6],[39,6],[44,14],[44,26],[20,26]],'#99d8c1');r(25,10,7,10,'#d9f7d2');
          p([[5,35],[18,26],[46,26],[59,35],[57,45],[49,52],[14,52],[6,44]],steel);
          r(9,36,46,6,shade);for(let i=0;i<4;i++)r(12+i*11,46,6,6,(i+Math.floor(time*6))%2?'#b9ed83':'#55766a');break;
        case 'moon_rock': case 'red_basalt': {
          const red=o.type==='red_basalt',base=red?'#b6653f':'#949b86',top=red?'#e5ac72':'#c4c9b1',shadow=red?'#7e432f':'#636f65';
          p([[1,62],[1,33],[10,33],[10,17],[23,17],[23,5],[45,5],[45,13],[55,13],[55,36],[63,36],[63,62]],ink);
          p([[5,58],[5,36],[14,36],[14,21],[26,21],[26,9],[42,9],[42,17],[51,17],[51,40],[59,40],[59,58]],base);
          r(27,11,12,8,top);r(16,23,14,7,top);r(38,32,9,7,shadow);r(18,44,8,6,shadow);r(47,48,10,9,shadow);break;
        }
        case 'film_camera':
          outlineBox(6,16,45,25,shade);this.orb(17,11,10,ink);this.orb(40,10,10,ink);
          this.orb(17,11,5,steel);this.orb(40,10,5,steel);
          p([[50,21],[61,15],[61,42],[50,35]],ink);r(53,23,5,11,panel);r(11,22,8,6,orange);
          r(28,40,7,11,ink);p([[28,45],[35,45],[54,62],[45,62],[32,51],[20,62],[10,62]],ink);r(29,44,3,14,steel);break;
        case 'lunar_rover': case 'mars_rover': {
          const mars=o.type==='mars_rover',body=mars?'#d39b59':light;
          wheel(9,55,8);wheel(32,55,8);wheel(55,55,8);
          outlineBox(4,31,54,17,body);r(13,35,17,5,panel);r(34,35,18,3,steel);
          r(40,9,4,24,ink);outlineBox(33,3,22,11,steel);r(45,6,6,5,panel);
          if(mars){outlineBox(2,17,33,11,panel);r(13,19,2,7,light);r(25,19,2,7,light);r(16,28,4,5,ink);}
          else{r(10,23,24,7,steel);r(10,15,4,13,ink);r(23,17,4,8,ink);}
          this.line([[8,47],[31,50],[54,47]],ink,3);break;
        }
        case 'studio_light':
          p([[6,4],[21,4],[21,28],[6,33]],ink);p([[44,4],[58,4],[58,33],[44,28]],ink);
          outlineBox(17,2,31,30,steel);r(22,7,21,20,'#e8ca6f');r(26,10,12,12,'#fff1b8');
          r(29,32,6,20,ink);p([[29,47],[35,47],[55,63],[44,63],[32,54],[20,63],[8,63]],ink);r(30,33,2,18,steel);break;
        case 'sample_canister': case 'fuel_tank': {
          const sample=o.type==='sample_canister';
          p([[11,63],[11,14],[18,5],[46,5],[53,14],[53,63]],ink);r(16,15,32,44,sample?'#c97d4e':steel);
          r(19,10,25,7,light);r(19,19,5,33,light);r(15,25,34,5,shade);r(15,50,34,4,shade);
          r(26,2,12,5,ink);r(28,28,14,14,sample?'#f0c871':'#ebc05e');
          p([[33,31],[30,37],[34,37],[31,41],[39,35],[35,35],[38,31]],ink);break;
        }
        case 'relay_mast':
          outlineBox(11,44,42,19,'#b16d4e');r(27,18,7,26,ink);
          p([[4,4],[14,2],[27,17],[50,5],[58,12],[39,29],[21,26]],ink);
          p([[10,7],[15,7],[28,22],[49,10],[50,13],[37,24],[23,22]],'#d1b396');
          r(40,0,4,17,ink);r(39,0,8,5,orange);r(17,49,10,8,panel);r(39,49,7,3,light);break;
        case 'secret_crate':
          outlineBox(3,5,58,57,'#5c7770');r(6,15,52,4,'#899d75');r(6,48,52,4,'#899d75');
          r(15,8,4,50,'#899d75');r(45,8,4,50,'#899d75');
          r(22,23,20,18,'#cad5a6');r(26,26,12,3,'#435951');r(25,32,14,3,'#435951');
          r(28,40,9,11,ink);r(31,43,3,5,'#455b51');break;
        case 'parked_ufo':
          p([[15,58],[20,47],[26,47],[24,62],[13,62]],ink);p([[41,47],[47,47],[52,62],[40,62]],ink);
          r(20,5,25,17,ink);r(15,15,36,14,ink);r(24,9,17,14,'#a5d6b0');r(25,11,6,8,'#d9f0ba');
          p([[3,31],[16,23],[48,23],[61,31],[63,43],[52,51],[12,51],[1,43]],ink);
          p([[6,34],[17,27],[47,27],[58,34],[58,40],[50,46],[14,46],[6,40]],'#7b9992');
          r(9,34,46,5,'#405952');for(let i=0;i<4;i++)r(13+i*11,40,5,3,i%2===Math.floor(time*3)%2?'#e3eaa4':'#78ba9d');break;
        case 'alien':
          p([[19,3],[45,3],[55,11],[55,27],[44,37],[42,47],[49,58],[48,63],[38,63],[32,52],[26,63],[16,63],[15,58],[22,47],[20,37],[9,27],[9,11]],ink);
          p([[22,7],[42,7],[50,14],[50,25],[40,33],[24,33],[14,25],[14,14]],green);
          p([[17,17],[26,20],[28,28],[21,27],[17,23]],'#233d39');p([[47,17],[38,20],[36,28],[43,27],[47,23]],'#233d39');
          r(26,36,12,14,'#7f9e69');r(27,30,9,2,'#405e48');
          this.line([[23,39],[10,48]],ink,4);this.line([[41,39],[54,48]],ink,4);
          r(10,43,6,9,green);r(49,43,6,9,green);r(21,53,5,8,green);r(38,53,5,8,green);break;
        case 'checkpoint':
          outlineBox(2,17,60,31,'#e4c981');r(7,48,7,15,ink);r(49,48,7,15,ink);
          for(let i=0;i<4;i++)p([[5+i*15,20],[12+i*15,20],[6+i*15,44],[3+i*15,44]],'#536554');
          outlineBox(23,3,18,15,'#d5905d');r(28,6,8,7,'#efc879');break;
        case 'tool_chest':
          wheel(12,57,6);wheel(51,57,6);outlineBox(3,11,58,42,'#627e87');r(8,17,48,4,steel);
          for(let row=0;row<3;row++){r(8,24+row*8,47,5,'#8ca2a7');r(28,25+row*8,11,2,light);}
          r(18,3,28,8,ink);r(23,6,18,5,steel);break;
        case 'jet_engine':
          r(7,46,7,16,ink);r(50,46,7,16,ink);r(6,57,52,6,ink);
          outlineBox(5,9,54,42,steel);this.orb(30,30,22,ink);this.orb(30,30,17,shade);this.orb(30,30,5,light);
          for(let i=0;i<7;i++){const a=i*Math.PI*2/7+time*1.3;this.line([[30,30],[30+Math.cos(a)*13,30+Math.sin(a)*13]],light,2);}
          r(55,19,7,21,shade);break;
        case 'radar_cart':
          wheel(15,58,5);wheel(49,58,5);outlineBox(8,42,48,13,steel);r(28,20,7,23,ink);
          p([[5,3],[15,4],[27,14],[46,4],[57,3],[52,18],[40,29],[25,29],[12,19]],ink);
          p([[10,8],[17,10],[28,20],[45,10],[51,8],[47,16],[38,24],[27,24],[16,17]],'#8faeaf');
          r(28,3,4,15,ink);r(27,1,7,5,orange);r(14,46,12,5,panel);break;
        case 'equipment_cart':
          wheel(12,58,5);wheel(52,58,5);outlineBox(2,33,58,19,steel);
          outlineBox(7,13,22,22,'#778991');outlineBox(33,19,23,15,'#a9ada2');
          r(38,9,3,11,ink);r(47,6,3,15,ink);r(12,18,12,6,panel);
          r(57,20,4,32,ink);r(52,18,10,4,ink);r(7,41,17,5,orange);break;
        case 'booster_section':
          p([[5,7],[53,7],[62,18],[62,50],[53,60],[5,60],[1,52],[1,15]],ink);
          r(7,11,43,44,steel);r(8,13,42,8,light);r(8,45,42,6,shade);
          r(16,11,4,44,shade);r(43,11,4,44,shade);
          p([[50,12],[58,21],[58,46],[51,54]],'#455d65');r(52,23,5,20,ink);
          r(26,27,12,10,'#e1d7ba');break;
        case 'rocket_engine':
          r(22,1,22,13,ink);r(26,4,14,7,steel);r(15,12,34,18,ink);r(20,15,24,12,steel);
          this.line([[17,10],[10,11],[10,36],[20,36]],ink,4);this.line([[45,13],[53,15],[53,34]],ink,4);
          p([[21,28],[43,28],[45,41],[59,60],[58,63],[6,63],[5,60],[19,41]],ink);
          p([[25,30],[39,30],[41,43],[52,58],[12,58],[23,43]],shade);
          r(27,32,5,15,steel);r(18,55,30,4,light);break;
        case 'robot_cart':
          wheel(10,58,5);wheel(52,58,5);outlineBox(2,35,60,17,'#ddbc6a');
          outlineBox(12,16,34,22,steel);r(17,21,24,9,'#415f66');r(20,23,5,4,'#b6e2ce');r(33,23,5,4,'#b6e2ce');
          r(26,6,4,12,ink);r(24,2,8,6,orange);
          this.line([[47,35],[54,24],[56,12]],ink,5);r(50,7,12,6,shade);r(49,4,3,10,ink);r(60,4,3,10,ink);
          r(9,40,45,3,'#816942');break;
        default: throw new Error('Missing obstacle artwork: '+o.type);
      }
      c.restore();
    }
  }

  // Reuse the classic artwork in perspective views. One small canvas pair per
  // design/palette is shared by both scenes; only animated designs are repainted.
  class ObstacleSprites {
    constructor(createCanvas){this.createCanvas=createCanvas;this.cache=new Map();}
    get(o,time=0){
      const key=o.type+':' +(o.sector==='area51'?'area51':'default');
      let sprite=this.cache.get(key);
      if(!sprite){
        const image=this.createCanvas(),side=this.createCanvas();
        image.width=image.height=side.width=side.height=128;
        const ctx=image.getContext('2d'),sideContext=side.getContext('2d');
        sprite={image,side,ctx,sideContext,art:new Art(ctx),frame:-1};this.cache.set(key,sprite);
      }
      const animated=/rover|cart|chest|ufo|low_jet|jet_engine/.test(o.type);
      const frame=animated?Math.floor(time*12):0;
      if(frame!==sprite.frame){
        sprite.ctx.clearRect(0,0,128,128);
        sprite.art.obstacle({...o,x:0,y:0,width:128,height:128,altitude:0},frame/12);
        const c=sprite.sideContext;c.clearRect(0,0,128,128);c.drawImage(sprite.image,0,0);
        c.globalCompositeOperation='source-atop';c.fillStyle='rgba(20,35,43,.38)';c.fillRect(0,0,128,128);c.globalCompositeOperation='source-over';
        sprite.frame=frame;
      }
      return sprite;
    }
  }

  const api={Art,SCENES,OBSTACLE_TYPES,ObstacleSprites};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.RocketArtwork=api;
})(typeof globalThis!=='undefined'?globalThis:this);
