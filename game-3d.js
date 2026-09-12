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
  const CREW_COLUMNS=20,CREW_ROWS=12;
  function crewVolume(u,v){
    const dome=(x,y,rx,ry,depth)=>depth*Math.sqrt(Math.max(0,1-((u-x)/rx)**2-((v-y)/ry)**2));
    const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
    const barrel=23*Math.sqrt(Math.max(0,1-((v-.70)/.165)**2))*smooth((u-.205)/.045)*(1-smooth((u-.77)/.025));
    const cone=Math.max(0,Math.min(1,(.985-u)/.215));
    const nose=u>=.77?23*cone*Math.sqrt(Math.max(0,1-((v-.685)/Math.max(.001,.145*cone))**2)):0;
    // Different volumes for each head and torso, a cylindrical hull and a tapered
    // nose. Fins, tie and exhaust keep a thin edge instead of becoming thick slabs.
    return Math.max(1.5,barrel,nose,dome(.414,.19,.095,.18,13),dome(.653,.20,.125,.18,14),
      dome(.39,.40,.10,.19,12),dome(.615,.44,.13,.20,14));
  }
  const crewDepthGrid=Array.from({length:CREW_ROWS+1},(_,y)=>Array.from({length:CREW_COLUMNS+1},(_,x)=>crewVolume(x/CREW_COLUMNS,y/CREW_ROWS)));
  function crewSurfaceDepth(u,v){
    const x=Math.min(CREW_COLUMNS-1,Math.floor(u*CREW_COLUMNS)),y=Math.min(CREW_ROWS-1,Math.floor(v*CREW_ROWS));
    const U=u*CREW_COLUMNS-x,V=v*CREW_ROWS-y;
    const a=crewDepthGrid[y][x],b=crewDepthGrid[y][x+1],c=crewDepthGrid[y+1][x+1],d=crewDepthGrid[y+1][x];
    // Use the same triangle interpolation as the front mesh to join its edge.
    return U>=V?a*(1-U)+b*(U-V)+c*V:a*(1-V)+c*U+d*(V-U);
  }
  function crewPoint(image,altitude,axis,[u,v],fraction,taper){
    const depth=crewSurfaceDepth(u,v)*fraction,h=200*image.height/image.width;
    return [axis[0]*(u-.5)*200*taper-axis[2]*depth,altitude-4+(1-v)*h*taper,axis[2]*(u-.5)*200*taper+axis[0]*depth];
  }
  // Trace the opaque outline once, then bridge it with real side surfaces.
  // This avoids copying eyes, clothing and outlines onto every depth slice.
  function buildCrewHull({data,width,height}={}){
    if(!data||!width||!height)return [];
    const solid=(x,y)=>x>=0&&y>=0&&x<width&&y<height&&data[(y*width+x)*4+3]>=96;
    const edges=[],outgoing=new Map(),key=(x,y)=>y*(width+1)+x;
    const add=(x,y,X,Y,dir)=>{
      const edge={a:[x,y],b:[X,Y],dir,used:false};edges.push(edge);
      const id=key(x,y);if(!outgoing.has(id))outgoing.set(id,[]);outgoing.get(id).push(edge);
    };
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(solid(x,y)){
      if(!solid(x,y-1))add(x,y,x+1,y,0);
      if(!solid(x+1,y))add(x+1,y,x+1,y+1,1);
      if(!solid(x,y+1))add(x+1,y+1,x,y+1,2);
      if(!solid(x-1,y))add(x,y+1,x,y,3);
    }
    const simplify=points=>{
      if(points.length<=2)return points;
      const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
      let max=.65*.65,index=0;
      for(let i=1;i<points.length-1;i++){
        const p=points[i],t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0;
        const d=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;
        if(d>max){max=d;index=i;}
      }
      return index?[...simplify(points.slice(0,index+1)).slice(0,-1),...simplify(points.slice(index))]:[a,b];
    };
    const hull=[];
    for(const first of edges){
      if(first.used)continue;
      const loop=[];let edge=first;
      while(edge&&!edge.used){
        edge.used=true;loop.push(edge.a);
        if(edge.b[0]===first.a[0]&&edge.b[1]===first.a[1])break;
        const candidates=(outgoing.get(key(...edge.b))||[]).filter(e=>!e.used);
        // At diagonal contacts, keep each solid island on the right of its loop.
        const priority=e=>[1,0,3,2].indexOf((e.dir-edge.dir+4)%4);
        candidates.sort((a,b)=>priority(a)-priority(b));edge=candidates[0];
      }
      const area=loop.reduce((sum,a,i)=>{const b=loop[(i+1)%loop.length];return sum+a[0]*b[1]-b[0]*a[1];},0)/2;
      if(Math.abs(area)<4)continue;
      let split=1;
      for(let i=2;i<loop.length;i++)if(Math.hypot(...sub(loop[i],loop[0]))>Math.hypot(...sub(loop[split],loop[0])))split=i;
      const points=[...simplify(loop.slice(0,split+1)).slice(0,-1),...simplify([...loop.slice(split),loop[0]]).slice(0,-1)];
      const colors=points.map((a,i)=>{
        const b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1;
        const x=Math.round((a[0]+b[0])/2-dy/length*2),y=Math.round((a[1]+b[1])/2+dx/length*2);
        const rgb=[0,0,0];let weight=0;
        for(let Y=y-1;Y<=y+1;Y++)for(let X=x-1;X<=x+1;X++)if(solid(X,Y)){
          const at=(Y*width+X)*4;for(let c=0;c<3;c++)rgb[c]+=data[at+c];weight++;
        }
        return weight?rgb.map(n=>n/weight):[45,57,62];
      });
      hull.push({points:points.map(([x,y])=>[x/width,y/height]),colors:colors.map((rgb,i)=>{
        const prev=colors[(i+colors.length-1)%colors.length],next=colors[(i+1)%colors.length];
        return '#'+rgb.map((n,c)=>Math.round(n*.6+prev[c]*.2+next[c]*.2).toString(16).padStart(2,'0')).join('');
      })});
    }
    return hull;
  }
  class Camera {
    constructor(width,height,blend=0){
      this.width=width;this.height=height;
      this.eye=mix([-140,290,800],[-430,255,250],blend);
      const target=mix([330,25,0],[420,15,0],blend);
      this.forward=unit(sub(target,this.eye));this.right=unit(cross(this.forward,[0,1,0]));
      // Leave room for the forward-facing crew's near end throughout a chase jump.
      this.up=cross(this.right,this.forward);this.focal=Math.min(width*.95,height*(1.45-.15*blend));
    }
    camera(point){const p=sub(point,this.eye);return [dot(p,this.right),dot(p,this.up),dot(p,this.forward)];}
    screen(p){return [this.width*.66+p[0]*this.focal/p[2],this.height*.55-p[1]*this.focal/p[2]];}
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
    constructor(ctx,obstacleSprites=null){this.ctx=ctx;this.obstacleSprites=obstacleSprites;this.faces=[];}
    textureTriangle(image,vertices,uv){
      const points=vertices.map(v=>this.camera.project(v));
      if(points.some(p=>!p))return;
      this.faces.push({image,points:points.map(p=>p.point),uv,depth:points.reduce((n,p)=>n+p.depth,0)/3});
    }
    spritePanel(image,{x=0,y=0,w,h,axis,depth,columns=4,rows=2,taper=1,surface=null}){
      const normal=[-axis[2],0,axis[0]];
      const vertex=surface||((u,v)=>[x+axis[0]*(u-.5)*w*taper+normal[0]*depth,y+(1-v)*h*taper,axis[2]*(u-.5)*w*taper+normal[2]*depth]);
      // Subdivision keeps the original faces undistorted across a perspective plane.
      for(let col=0;col<columns;col++)for(let row=0;row<rows;row++){
        const u=col/columns,v=row/rows,U=(col+1)/columns,V=(row+1)/rows;
        const a=vertex(u,v),b=vertex(U,v),c=vertex(U,V),d=vertex(u,V);
        const A=[u*image.width,v*image.height],B=[U*image.width,v*image.height],C=[U*image.width,V*image.height],D=[u*image.width,V*image.height];
        this.textureTriangle(image,[a,b,c],[A,B,C]);this.textureTriangle(image,[a,c,d],[A,C,D]);
      }
    }
    crewPanel(image,altitude,axis){
      this.spritePanel(image,{axis,columns:CREW_COLUMNS,rows:CREW_ROWS,surface:(u,v)=>crewPoint(image,altitude,axis,[u,v],1,.965)});
    }
    crewSides(altitude,axis){
      const vertex=(uv,[fraction,taper])=>crewPoint(this.crewImage,altitude,axis,uv,fraction,taper);
      const rings=[[-1,.965],[-.65,1],[.65,1],[1,.965]],light=unit([-.35,.85,.55]);
      for(const loop of this.crewHull||[])for(let i=0;i<loop.points.length;i++){
        const a=loop.points[i],b=loop.points[(i+1)%loop.points.length];
        for(let j=0;j<rings.length-1;j++){
          const A=vertex(a,rings[j]),B=vertex(b,rings[j]),C=vertex(b,rings[j+1]),D=vertex(a,rings[j+1]);
          const outward=unit(cross(sub(D,A),sub(B,A))),center=A.map((n,k)=>(n+B[k]+C[k]+D[k])/4);
          if(dot(outward,sub(this.camera.eye,center))<=0)continue;
          const factor=.72+Math.max(0,dot(outward,light))*.3;
          this.face([A,D,C,B],shade(loop.colors[i],factor));
        }
      }
    }
    paintTexture(face){
      const c=this.ctx,[a,b,d]=face.points,[A,B,D]=face.uv;
      const sx=B[0]-A[0],sy=B[1]-A[1],tx=D[0]-A[0],ty=D[1]-A[1],det=sx*ty-tx*sy;
      if(Math.abs(det)<1e-8)return;
      const ux=b[0]-a[0],uy=b[1]-a[1],vx=d[0]-a[0],vy=d[1]-a[1];
      const m0=(ux*ty-vx*sy)/det,m1=(uy*ty-vy*sy)/det;
      const m2=(vx*sx-ux*tx)/det,m3=(vy*sx-uy*tx)/det;
      c.save();c.beginPath();
      // A subpixel overlap hides hairline cracks between adjacent textured triangles.
      const center=[(a[0]+b[0]+d[0])/3,(a[1]+b[1]+d[1])/3];
      for(let i=0;i<3;i++){
        const p=face.points[i],dx=p[0]-center[0],dy=p[1]-center[1],length=Math.hypot(dx,dy)||1;
        const x=p[0]+dx/length*.35,y=p[1]+dy/length*.35;i?c.lineTo(x,y):c.moveTo(x,y);
      }
      c.closePath();c.clip();c.transform(m0,m1,m2,m3,a[0]-m0*A[0]-m2*A[1],a[1]-m1*A[0]-m3*A[1]);
      c.imageSmoothingEnabled=false;c.drawImage(face.image,0,0);c.restore();
    }
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
        if(face.image){this.paintTexture(face);continue;}
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
      if(this.crewImage){
        // Ease out the angled view's camera-facing tilt as we move behind the crew,
        // so the rocket and riders point down the route in chase view.
        const axis=unit(mix([1,0,0],this.camera.right,.30*(1-this.viewBlend)));
        const normal=[-axis[2],0,axis[0]];
        this.face([[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[axis[0]*u*77+normal[0]*v*25,.35,axis[2]*u*77+normal[2]*v*25]),this.shadowColor);
        this.crewSides(altitude,axis);
        this.crewPanel(this.crewImage,altitude,axis);
        return;
      }
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
      if(o.type==='low_jet'){
        this.shadow(o.x-origin+o.width/2,0,o.width*.9,34);
        this.jet(o.x-origin,o.altitude||0,0,o.width,o.height);return;
      }
      if(!this.obstacleSprites)return;
      const sprite=this.obstacleSprites.get(o,this.time),w=o.width,h=o.height;
      const x=o.x-origin+w/2,y=o.altitude||0;
      const directional=/rover|cart|booster_section/.test(o.type);
      const round=/ufo|moon_rock|red_basalt/.test(o.type);
      // Vehicles follow the route more closely; signs, machines and saucers
      // keep a wider face so their classic silhouettes stay easy to identify.
      const facing=directional?.30-.18*this.viewBlend:.40-.06*this.viewBlend;
      const axis=unit(mix([1,0,0],this.camera.right,facing)),normal=[-axis[2],0,axis[0]];
      const thickness=round?Math.min(w*.55,28):directional?Math.min(w*.38,24):Math.min(w*.45,20);
      this.face([[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[x+axis[0]*u*w*.46+normal[0]*v*thickness*.65,.35,axis[2]*u*w*.46+normal[2]*v*thickness*.65]),this.shadowColor);
      for(let i=0;i<6;i++){
        const depth=thickness*(i/6-.5),taper=1-.04*Math.pow(depth/(thickness/2),2);
        this.spritePanel(sprite.side,{x,y,w,h,axis,depth,taper});
      }
      this.spritePanel(sprite.image,{x,y,w,h,axis,depth:thickness/2,taper:.96});
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
    render({width,height,palette,game,distance,time,blend=0,menu=false,reduced=false,crewImage=null,crewHull=null}){
      this.width=width;this.height=height;this.camera=new Camera(width,height,blend);
      this.viewBlend=blend;this.crewImage=crewImage;this.crewHull=crewHull;
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
  const api={Camera,Scene3D,VIEWS,buildCrewHull};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Rocket3D=api;
})(typeof globalThis!=='undefined'?globalThis:this);
