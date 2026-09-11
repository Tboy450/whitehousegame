/* Small software 3D renderer: world-space meshes, perspective projection and depth sorting.
   The same Runner simulation drives every camera; changing views never moves a collider. */
(function(root){
  'use strict';
  const VIEWS=Object.freeze([
    {id:'angle',label:'3D ANGLE'}, {id:'chase',label:'3D CHASE'}, {id:'classic',label:'CLASSIC'}
  ]);
  const sub=(a,b)=>a.map((n,i)=>n-b[i]);
  const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const shade=(hex,factor)=>'#'+hex.slice(1).match(/../g).map(v=>Math.min(255,Math.round(parseInt(v,16)*factor)).toString(16).padStart(2,'0')).join('');
  function noise(n){const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);}
  class Camera {
    constructor(width,height,blend=0){
      this.width=width;this.height=height;
      this.eye=mix([-140,290,800],[-430,255,250],blend);
      const target=mix([330,25,0],[420,15,0],blend);
      this.forward=unit(sub(target,this.eye));this.right=unit(cross(this.forward,[0,1,0]));
      this.up=cross(this.right,this.forward);this.focal=Math.min(width*.95,height*1.45);
    }
    camera(point){const p=sub(point,this.eye);return [dot(p,this.right),dot(p,this.up),dot(p,this.forward)];}
    screen(p){return [this.width*.60+p[0]*this.focal/p[2],this.height*.53-p[1]*this.focal/p[2]];}
    project(point){const p=this.camera(point);return p[2]<20?null:{point:this.screen(p),depth:p[2],scale:this.focal/p[2]};}
    polygon(vertices){
      const input=vertices.map(p=>this.camera(p)),out=[];
      for(let i=0;i<input.length;i++){
        const a=input[i],b=input[(i+1)%input.length],inside=a[2]>=20,next=b[2]>=20;
        if(inside)out.push(a);
        if(inside!==next)out.push(mix(a,b,(20-a[2])/(b[2]-a[2])));
      }
      return out.length<3?null:{points:out.map(p=>this.screen(p)),depth:out.reduce((n,p)=>n+p[2],0)/out.length};
    }
  }
  class Scene3D {
    constructor(ctx){this.ctx=ctx;this.faces=[];}
    face(vertices,color){
      const face=this.camera.polygon(vertices);if(!face)return;
      if(face.points.every(p=>p[0]<-100)||face.points.every(p=>p[0]>this.width+100)||face.points.every(p=>p[1]<-100)||face.points.every(p=>p[1]>this.height+100))return;
      this.faces.push({...face,color});
    }
    box(x,y,z,w,h,d,color){
      const a=[x,y,z],b=[x+w,y,z],c=[x+w,y+h,z],e=[x,y+h,z];
      const A=[x,y,z+d],B=[x+w,y,z+d],C=[x+w,y+h,z+d],E=[x,y+h,z+d];
      this.face([a,b,c,e],shade(color,.72));this.face([A,E,C,B],color);
      this.face([a,A,B,b],shade(color,.6));this.face([e,c,C,E],shade(color,1.17));
      this.face([a,e,E,A],shade(color,.85));this.face([b,B,C,c],shade(color,.94));
    }
    tube(x,y,z,length,radius,color,axis='x',endRadius=radius){
      const ring=(at,r)=>Array.from({length:8},(_,i)=>{
        const a=i*Math.PI/4;return axis==='x'?[x+at,y+Math.cos(a)*r,z+Math.sin(a)*r]:[x+Math.cos(a)*r,y+at,z+Math.sin(a)*r];
      });
      const a=ring(0,radius),b=ring(length,endRadius);
      for(let i=0;i<8;i++)this.face([a[i],a[(i+1)%8],b[(i+1)%8],b[i]],shade(color,.76+Math.max(0,Math.cos(i*Math.PI/4))*.3));
      this.face(a,shade(color,.65));this.face(b,shade(color,1.06));
    }
    shadow(x,z,w,d){this.face([[x-w/2,.35,z-d/2],[x+w/2,.35,z-d/2],[x+w/2,.35,z+d/2],[x-w/2,.35,z+d/2]],this.shadowColor);}
    label(text,x,y,z,size=13,color='#273a40'){
      const p=this.camera.project([x,y,z]);if(!p||p.scale<.3)return;
      this.faces.push({label:text,point:p.point,depth:p.depth-.2,size:Math.max(7,Math.min(18,size*p.scale)),color});
    }
    flush(){
      const c=this.ctx;this.faces.sort((a,b)=>b.depth-a.depth);
      for(const face of this.faces){
        c.fillStyle=face.color;
        if(face.label){c.font='bold '+face.size+'px "Courier New", monospace';c.textAlign='center';c.fillText(face.label,...face.point);continue;}
        c.beginPath();face.points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fill();
      }
      this.faces.length=0;
    }
    jet(x,y,z,w=70,h=25,d=54){
      const hull='#748d99';
      this.tube(x+8,y+h*.42,z,w-16,h*.18,hull);
      this.tube(x+8,y+h*.42,z,-10,h*.18,'#a7bec8','x',0);
      this.box(x+w*.34,y+h*.53,z-6,w*.25,h*.25,12,'#275d73');
      for(const side of [-1,1]){
        this.face([[x+w*.28,y+h*.4,z],[x+w*.74,y+h*.4,z+side*d/2],[x+w*.82,y+h*.4,z+side*d/2],[x+w*.67,y+h*.4,z]],'#9eb1b5');
        this.face([[x+w*.73,y+h*.5,z+side*5],[x+w*.90,y+h,z+side*9],[x+w*.95,y+h*.5,z+side*9]],'#506773');
      }
      this.tube(x+w-8,y+h*.42,z,7,h*.13,'#ee8740','x',2);
    }
    ufo(x,y,z,w=58,h=27){
      this.tube(x+w/2,y+h*.2,z,h*.28,w*.48,'#769c96','y',w*.32);
      this.tube(x+w/2,y+h*.48,z,h*.42,w*.22,'#a7e4c9','y',w*.12);
      for(let i=0;i<6;i++){
        const a=i*Math.PI/3;this.box(x+w/2+Math.cos(a)*w*.33-2,y+h*.22,z+Math.sin(a)*w*.33-2,4,4,4,(i+Math.floor(this.time*5))%2?'#d9f7a3':'#62a88b');
      }
    }
    rider(x,y,z,trump){
      const skin=trump?'#eeb387':'#edc6a1',suit=trump?'#293d67':'#303c42';
      this.box(x-10,y,z-12,21,25,24,suit);
      this.box(x-7,y+26,z-10,21,22,21,skin);
      this.box(x-9,y+44,z-11,25,8,23,trump?'#edc55e':'#433d39');
      if(trump){this.box(x+8,y+39,z-12,10,9,24,'#e5b74b');this.box(x+12,y+5,z-3,2,17,6,'#df4d3c');}
      else{this.box(x+11,y+8,z-4,2,10,8,'#dce3df');}
      this.box(x+13,y+32,z+6,2,3,3,'#29333d');
      this.box(x+14,y+28,z-2,5,5,7,skin);
      for(const side of [-1,1]){
        this.box(x-5,y-13,z+side*17-5,31,13,10,suit);
        this.box(x+18,y-24,z+side*17-5,10,20,10,suit);
        this.box(x+17,y-28,z+side*17-5,17,6,11,'#26353d');
        this.box(x+4,y+8,z+side*17-4,26,9,8,suit);
        this.box(x+24,y+6,z+side*17-4,8,8,8,skin);
      }
    }
    rocket(altitude){
      const y=altitude+27;
      this.shadow(0,0,168,40);
      this.tube(-72,y,0,135,18,'#eee9d8');
      this.tube(63,y,0,35,18,'#e66042','x',0);
      this.tube(-83,y,0,11,12,'#4c626a');
      this.tube(-83,y,0,-(27+Math.sin(this.time*27)*8),10,'#f6b952','x',0);
      this.box(-65,y+13,-14,16,5,28,'#cc4b3b');
      for(const side of [-1,1])this.face([[-70,y,side*10],[-84,y-15,side*32],[-36,y-10,side*16]],'#cf513e');
      this.box(10,y-4,17,35,8,1,'#314d75');
      this.rider(9,y+27,0,true);this.rider(-40,y+27,0,false);
    }
    hazard(o,origin){
      const x=o.x-origin,w=o.width,h=o.height,y=o.altitude||0,z=-18;
      this.shadow(x+w/2,0,w*.9,34);
      if(o.type==='low_jet'){this.jet(x,y,0,w,h);return;}
      if(o.type==='low_ufo'||o.type==='parked_ufo'){this.ufo(x,y,0,w,h);return;}
      const rock=o.type==='moon_rock'||o.type==='red_basalt';
      if(rock){this.tube(x+w/2,0,0,h,w*.52,o.type==='red_basalt'?'#b46b47':'#a3ad92','y',w*.22);return;}
      if(o.type==='alien'){
        this.box(x+w*.35,0,-6,w*.3,h*.5,12,'#709a79');
        this.box(x+w*.12,h*.5,-13,w*.76,h*.47,26,'#a8c997');
        this.box(x+w*.18,h*.67,13,7,9,1,'#243c3e');this.box(x+w*.61,h*.67,13,7,9,1,'#243c3e');return;
      }
      if(/tank|canister|engine|booster/.test(o.type)){
        const horizontal=/jet_engine|booster/.test(o.type);
        if(horizontal)this.tube(x,h*.5,0,w,h*.45,'#a5b7b6');
        else this.tube(x+w/2,0,0,h,w*.42,'#acbabb','y',o.type==='rocket_engine'?w*.2:w*.42);
        this.box(x+w*.2,h*.4,19,w*.5,7,2,'#e5b65e');return;
      }
      if(/camera|light|radar|mast/.test(o.type)){
        this.box(x+w*.42,0,-4,w*.16,h*.65,8,'#526b75');
        this.box(x,0,-19,w,5,38,'#617b83');
        this.box(x+2,h*.55,z,w-4,h*.4,28,o.type==='studio_light'?'#f6d17d':'#78979f');
        this.box(x+w*.25,h*.64,11,w*.48,h*.22,3,'#2f5a6b');
        if(o.type==='film_camera')for(const dx of [.25,.7])this.tube(x+w*dx,h*.91,0,8,8,'#435764','y');return;
      }
      const cart=/rover|cart|chest/.test(o.type);
      this.box(x,cart?9:0,z,w,h-(cart?14:0),36,o.type==='secret_crate'?'#657e66':o.type==='checkpoint'?'#e7c57a':'#b7bfad');
      this.box(x+5,h*.48,19,w-10,9,2,'#416d7a');
      if(cart){
        for(const dx of [.18,.82])for(const dz of [-23,18])this.box(x+w*dx-6,0,dz,12,13,6,'#354751');
        if(/rover|robot/.test(o.type)){this.box(x+w*.7,h*.7,-3,3,h*.27,6,'#4b6270');this.box(x+w*.62,h-7,-8,w*.25,7,16,'#e2d2a5');}
      }
    }
    sign(x,z,text,p){
      this.box(x-48,0,z,4,60,4,p.ground);this.box(x+44,0,z,4,60,4,p.ground);
      this.box(x-59,48,z-2,118,33,5,'#e4ddc0');this.label(text,x,59,z+4,11);
    }
    landmark(x,z,variant,p){
      const white='#ece8d8',steel='#96acaf',dark='#476773';
      if(p.id==='moon'){
        if(variant%2===0){
          this.tube(x,18,z,38,28,'#c4a267','y',17);
          for(const dx of [-28,24])this.box(x+dx,0,z-23,5,29,47,'#6b7774');
          this.box(x+55,0,z,3,90,3,steel);this.box(x+58,66,z,43,24,2,'#ece7d1');
          for(let j=0;j<4;j++)this.box(x+59,68+j*5,z+2,40,2,1,'#c75e4c');
          this.sign(x+150,z,'TAKE 1969',p);
        }else{this.box(x,0,z,12,63,12,dark);this.box(x-16,55,z-12,44,25,31,dark);this.sign(x+125,z,'NEVADA STUDIOS',p);}
      }else if(p.id==='mars'){
        this.tube(x,0,z,60,53,'#d4b291','y',37);this.box(x-14,0,z+47,28,31,4,dark);
        this.box(x+85,18,z-22,94,5,48,'#365a78');this.box(x+125,0,z-4,6,19,8,steel);
        this.sign(x+210,z,'RED FILTER: ON',p);
      }else if(p.id==='area51'){
        this.box(x-50,0,z-40,150,65,92,'#596d77');this.box(x-30,0,z+52,104,45,3,'#2b424d');
        this.ufo(x+145,3,z+10,83,42);this.sign(x+50,z+60,'WEATHER BALLOONS',p);
      }else if(p.id==='lockheed'){
        this.box(x-40,0,z-45,180,66,104,steel);this.box(x-20,0,z+60,132,48,2,dark);
        this.jet(x+170,5,z+20,106,36,96);this.sign(x+48,z+66,'SKUNK WORKS',p);
      }else{
        this.box(x-40,0,z-50,180,55,105,white);this.sign(x+45,z+57,'STARFACTORY',p);
        this.tube(x+175,0,z,150,17,steel,'y',12);this.tube(x+175,150,z,35,12,white,'y',0);
        this.box(x+230,0,z-18,12,210,12,dark);this.box(x+204,170,z-14,40,9,9,dark);
      }
    }
    render({width,height,palette,game,distance,time,blend=0,menu=false,reduced=false}){
      this.width=width;this.height=height;this.camera=new Camera(width,height,blend);
      this.time=reduced?0:time;this.shadowColor=shade(palette.dust,.78);this.faces.length=0;
      const c=this.ctx,p=palette;c.fillStyle=p.sky;c.fillRect(0,0,width,height);
      // A low horizon keeps both the full jump arc and approaching traffic visible.
      c.fillStyle=p.sun;c.beginPath();c.arc(width*.84,height*.17,Math.min(29,height*.06),0,Math.PI*2);c.fill();
      c.fillStyle=p.ridge;c.beginPath();c.moveTo(0,height*.43);
      for(let i=0;i<=16;i++)c.lineTo(i*width/16,height*(.32+noise(i+13)*.09));
      c.lineTo(width,height);c.lineTo(0,height);c.fill();
      this.face([[-900,-1,-1600],[6500,-1,-1600],[6500,-1,1800],[-900,-1,1800]],p.dust);this.flush();
      this.face([[-750,0,-75],[6000,0,-75],[6000,0,75],[-750,0,75]],shade(p.dust,.9));this.flush();
      const offset=distance%150;
      for(let x=-600-offset;x<4000;x+=150){
        for(const z of [-76,73])this.box(x,.2,z,65,.4,3,p.ground);
      }
      this.flush();
      const cell=Math.floor(distance/440),scroll=distance%440;
      for(let i=-2;i<9;i++){
        const n=cell+i,x=i*440-scroll+noise(n)*140;
        const z=-230-noise(n+80)*210;
        if((n%3+3)%3!==1)this.landmark(x,z,n,p);
        this.tube(x+250,0,z-180,75+noise(n+18)*70,80+noise(n+32)*55,p.ridgeShadow,'y',25);
        for(let j=0;j<2;j++){
          const rx=x+j*117,rz=110+noise(n+j+93)*190;
          this.tube(rx,0,rz,6+noise(n+j)*9,8+noise(n+j+9)*8,p.rock,'y',3);
        }
      }
      const origin=game.player.x+100;
      for(const o of game.obstacles)this.hazard(o,origin);
      this.rocket(menu?Math.sin(time*2)*2:464-game.player.y);
      this.flush();
    }
  }
  const api={Camera,Scene3D,VIEWS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Rocket3D=api;
})(typeof globalThis!=='undefined'?globalThis:this);
