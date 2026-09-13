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
    constructor(width,height,blend=0,side=0){
      this.width=width;this.height=height;this.side=side;
      const eye=mix([-140,290,800],[-430,255,250],blend),aim=mix([330,25,0],[420,15,0],blend);
      const forward=unit(sub(aim,eye)),right=unit(cross(forward,[0,1,0])),up=cross(right,forward);
      const origin=eye.map(n=>-n),baseDepth=dot(origin,forward);
      const baseScale=Math.min(width*.95,height*(1.45-.15*blend))/baseDepth;
      this.eye=mix(eye,[0,140,1600],side);
      const target=mix(aim,[0,140,0],side);
      this.forward=unit(sub(target,this.eye));this.right=unit(cross(this.forward,[0,1,0]));
      this.up=cross(this.right,this.forward);
      const anchor=this.camera([0,0,0]);
      // Keep magnification and the crew's ground anchor steady as the lens flattens.
      // Interpolating raw focal lengths would zoom in midway and crop landscape jumps.
      this.focal=baseScale*anchor[2];
      const ground=mix([width*.66+dot(origin,right)*baseScale,height*.55-dot(origin,up)*baseScale],[254,height-85],side);
      this.offset=[ground[0]-anchor[0]*this.scaleAt(anchor[2]),ground[1]+anchor[1]*this.scaleAt(anchor[2])];
    }
    camera(point){const p=sub(point,this.eye);return [dot(p,this.right),dot(p,this.up),dot(p,this.forward)];}
    scaleAt(depth){return (1-this.side)*this.focal/depth+this.side;}
    screen(p){const scale=this.scaleAt(p[2]);return [this.offset[0]+p[0]*scale,this.offset[1]-p[1]*scale];}
    project(point){const p=this.camera(point);return p[2]<20?null:{point:this.screen(p),depth:p[2],scale:this.scaleAt(p[2])};}
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
    constructor(ctx,obstacleSprites=null){
      this.ctx=ctx;this.obstacleSprites=obstacleSprites;this.faces=[];this.model=null;
      this.signTextures=obstacleSprites?(obstacleSprites.signTextures||=new Map()):new Map();
    }
    modelPoint(p){return this.model?[p[0]*this.model.scale+this.model.x,p[1]*this.model.scale,p[2]*this.model.scale+this.model.z]:p;}
    textureTriangle(image,vertices,uv){
      const points=vertices.map(v=>this.camera.project(this.modelPoint(v)));
      if(points.some(p=>!p))return;
      this.faces.push({image,points:points.map(p=>p.point),uv,depth:points.reduce((n,p)=>n+p.depth,0)/3});
    }
    spritePanel(image,{x=0,y=0,w,h,axis=[1,0,0],depth,columns=4,rows=2,taper=1,surface=null}){
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
      const side=this.camera.side||0;
      this.spritePanel(image,{axis,columns:CREW_COLUMNS,rows:CREW_ROWS,surface:(u,v)=>crewPoint(image,altitude+8*side,axis,[u,v],1,.965+.035*side)});
    }
    crewSides(altitude,axis){
      const side=this.camera.side||0;
      const vertex=(uv,[fraction,taper])=>crewPoint(this.crewImage,altitude+8*side,axis,uv,fraction,taper+(1-taper)*side);
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
      const face=this.camera.polygon(vertices.map(v=>this.modelPoint(v)));if(!face)return;
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
        const a=i*Math.PI/4;return axis==='x'?[x+at,y+Math.cos(a)*r,z+Math.sin(a)*r]:axis==='y'?[x+Math.cos(a)*r,y+at,z+Math.sin(a)*r]:[x+Math.cos(a)*r,y+Math.sin(a)*r,z+at];
      });
      const a=ring(0,radius),b=ring(length,endRadius);
      for(let i=0;i<8;i++)this.face([a[i],a[(i+1)%8],b[(i+1)%8],b[i]],shade(color,.76+Math.max(0,Math.cos(i*Math.PI/4))*.3));
      this.face(a,shade(color,.65));this.face(b,shade(color,1.06));
    }
    shadow(x,z,w,d){this.face([[x-w/2,.35,z-d/2],[x+w/2,.35,z-d/2],[x+w/2,.35,z+d/2],[x-w/2,.35,z+d/2]],this.shadowColor);}
    label(text,x,y,z,size=13,color='#273a40'){
      const p=this.camera.project(this.modelPoint([x,y,z]));if(!p||p.scale<.3)return;
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
        const axis=unit(mix([1,0,0],this.camera.right,.30*(1-this.viewBlend)*(1-this.camera.side)));
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
      const facing=(directional?.30-.18*this.viewBlend:.40-.06*this.viewBlend)*(1-this.camera.side);
      const axis=unit(mix([1,0,0],this.camera.right,facing)),normal=[-axis[2],0,axis[0]];
      const thickness=round?Math.min(w*.55,28):directional?Math.min(w*.38,24):Math.min(w*.45,20);
      this.face([[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[x+axis[0]*u*w*.46+normal[0]*v*thickness*.65,.35,axis[2]*u*w*.46+normal[2]*v*thickness*.65]),this.shadowColor);
      for(let i=0;i<6;i++){
        const depth=thickness*(i/6-.5),taper=1-.04*Math.pow(depth/(thickness/2),2);
        this.spritePanel(sprite.side,{x,y,w,h,axis,depth,taper});
      }
      this.spritePanel(sprite.image,{x,y,w,h,axis,depth:thickness/2,taper:.96+.04*this.camera.side});
    }
    beam(a,b,width,color){
      const direction=unit(sub(b,a)),across=unit(cross(direction,Math.abs(direction[1])>.9?[1,0,0]:[0,1,0]));
      for(const axis of [across,cross(direction,across)]){
        const shift=(p,n)=>p.map((v,i)=>v+axis[i]*width*n/2);
        this.face([shift(a,-1),shift(a,1),shift(b,1),shift(b,-1)],color);
      }
    }
    placard(lines,x,y,z,w,h,p){
      const ink=p.id==='area51'?'#c7d9b3':'#52625d',paper=p.id==='area51'?'#354a4b':'#e3e4d6';
      const key=p.id+':'+lines.join('|');let image=this.signTextures.get(key);
      if(!image&&this.obstacleSprites?.createCanvas){
        image=this.obstacleSprites.createCanvas();image.width=384;image.height=96;
        const c=image.getContext('2d');c.fillStyle=ink;c.fillRect(0,0,384,96);
        c.fillStyle=paper;c.fillRect(3,3,378,90);c.fillStyle=ink;c.textAlign='center';
        c.font='bold '+(lines.length>1?24:30)+'px "Courier New", monospace';
        lines.forEach((line,i)=>c.fillText(line,192,lines.length>1?37+i*33:58,366));
        this.signTextures.set(key,image);
      }
      if(image)this.spritePanel(image,{columns:4,rows:2,surface:(u,v)=>[x+(u-.5)*w,y+(1-v)*h,z]});
      else lines.forEach((line,i)=>this.label(line,x,y+h*(.7-i*.35),z,11,ink));
    }
    sign(x,z,text,p){
      const lines=Array.isArray(text)?text:[text],w=190;
      this.box(x-w*.38,0,z,4,62,4,p.ground);this.box(x+w*.36,0,z,4,62,4,p.ground);
      this.box(x-w/2,45,z-2,w,48,5,p.ground);
      this.placard(lines,x,45,z+3.2,w,48,p);
    }
    hangar(x,z,w,h,name,p){
      const body=p.id==='area51'?'#56676b':p.id==='spacex'?'#bdd0ce':'#a6b7b9',door=shade(body,.72),d=94;
      this.shadow(x+w/2,z,w+16,d+16);this.box(x,0,z-d/2,w,h-14,d,body);
      this.face([[x,h-14,z+d/2],[x+16,h,z+d/2],[x+w-16,h,z+d/2],[x+w,h-14,z+d/2]],body);
      this.face([[x+16,h,z-d/2],[x+w-16,h,z-d/2],[x+w-16,h,z+d/2],[x+16,h,z+d/2]],shade(body,1.12));
      this.face([[x,0,z+d/2+.2],[x+w,0,z+d/2+.2],[x+w,h-26,z+d/2+.2],[x,h-26,z+d/2+.2]],door);
      for(let y=8;y<h-30;y+=13)this.face([[x+8,y,z+d/2+.4],[x+w-8,y,z+d/2+.4],[x+w-8,y+2,z+d/2+.4],[x+8,y+2,z+d/2+.4]],body);
      this.placard([name],x+w/2,h-24,z+d/2+.6,w*.88,19,p);
    }
    dish(x,z,p){
      this.shadow(x,z,66,44);this.box(x-4,0,z-4,8,45,8,p.ground);
      const bowl=[[-32,71],[-23,52],[0,43],[24,52],[33,71],[20,60],[0,53],[-20,60]];
      this.face(bowl.map(([dx,y])=>[x+dx,y,z+6]),p.ground);
      this.face(bowl.map(([dx,y])=>[x+dx,y,z-8]),p.ridgeShadow);
      this.beam([x,52,z+5],[x+10,80,z+13],3,p.ground);this.box(x+7,77,z+10,7,5,6,p.sun);
    }
    rover(x,z,p){
      this.shadow(x+35,z,90,48);
      for(const dx of [0,29,58])for(const dz of [-19,19])this.box(x+dx,0,z+dz-5,16,16,10,'#596b68');
      this.box(x+3,15,z-18,69,22,36,p.id==='mars'?'#d5b48c':'#b6beaa');
      this.box(x+9,32,z-21,43,4,42,'#8cabae');this.box(x+50,36,z-2,4,36,4,p.ground);
      this.box(x+43,66,z-7,21,13,15,p.ground);this.box(x+45,70,z+8,13,5,1,'#b9d4cc');
    }
    solar(x,z,p){
      for(let i=0;i<3;i++){
        const at=x+i*50;this.box(at+19,0,z,4,29,4,p.ground);
        this.face([[at,38,z-18],[at+44,38,z-18],[at+44,22,z+23],[at,22,z+23]],'#739193');
        for(const u of [0,.33,.67,1])this.beam([at+u*44,38.3,z-18],[at+u*44,22.3,z+23],1.5,p.sun);
        this.beam([at,30.3,z+2],[at+44,30.3,z+2],1.5,p.sun);
      }
    }
    booster(x,z,h,p){
      this.tube(x,3,z,h,17,'#d3dfd9','y');this.tube(x,h+3,z,24,17,'#b3c9c6','y',7);
      for(let y=22;y<h;y+=24)this.tube(x,y,z,2,17.5,'#94b0b2','y');
      for(const dx of [-19,14])this.box(x+dx,h-20,z-8,5,13,16,p.ground);
      this.box(x-16,0,z-15,32,4,30,p.ground);
    }
    landmark(x,z,variant,p,scale=1){
      this.model={x,z,scale};
      try{
        const steel='#96acaf',dark='#536f78',v=((variant%6)+6)%6;
        this.shadow(40,0,180,96);
        if(p.id==='moon'){
          if(v===0)this.dish(25,0,p);
          if(v===1){
            this.box(0,47,-25,60,35,50,'#c1b58e');this.box(9,82,-20,42,26,40,'#d9dccb');
            this.tube(30,108,0,14,24,'#c7cebd','y',17);this.box(17,88,20.3,26,13,1,'#879faa');
            for(const dx of [-16,76])for(const dz of [-39,39]){
              this.beam([dx,3,dz],[dx<0?7:53,48,dz*.5],4,p.ground);this.box(dx-9,0,dz-6,18,3,12,p.ground);
            }
            for(let y=5;y<47;y+=7)this.beam([24,y,30],[37,y,30],2,p.ground);
            this.beam([24,0,32],[24,48,25],2,p.ground);this.beam([37,0,32],[37,48,25],2,p.ground);
            this.box(116,0,0,3,93,3,steel);this.box(119,68,0,46,25,2,'#e2ded0');
            for(let j=0;j<4;j++)this.box(119,69+j*6,2,45,2.5,.5,'#be9686');this.box(119,81,2.6,17,12,.5,'#879daa');
          }
          if(v===2)this.rover(0,0,p);
          if(v===3)this.sign(45,0,['LUNAR PARKING','NO EARTHLINGS'],p);
          if(v===4){
            this.box(0,58,-10,40,24,21,dark);this.tube(40,69,0,15,9,p.ground);
            for(const dx of [7,31])this.tube(dx,88,-9,20,12,p.ground,'z');
            for(const dx of [-12,45])this.beam([dx,0,12],[20,58,0],3,p.ground);
            this.beam([20,0,-23],[20,58,0],3,p.ground);
            this.box(120,0,0,4,122,4,p.ground);this.box(101,119,-5,42,29,14,p.ground);this.box(106,124,9.2,32,19,1,'#e3d9b1');
            for(const dx of [105,137])this.beam([122,30,2],[dx,0,16],3,p.ground);
          }
          if(v===5)this.sign(45,0,['TAKE 1969','DEFINITELY SPACE'],p);
        }else if(p.id==='mars'){
          if(v===0)this.solar(0,0,p);
          if(v===1){
            this.box(0,0,-35,132,37,70,'#ead4b7');this.tube(66,37,0,31,66,'#ead4b7','y',44);this.tube(66,68,0,10,44,'#d4b291','y',14);
            this.box(53,0,36,27,39,3,p.ground);this.box(60,5,39.2,13,25,1,'#b9cabf');
            for(const dx of [16,92])this.box(dx,24,36.5,23,14,1,'#a9c4bd');this.solar(163,-12,p);
          }
          if(v===2)this.dish(30,0,p);
          if(v===3)this.rover(0,0,p);
          if(v===4)this.sign(45,0,['RED FILTER: ON','ARIZONA: CLASSIFIED'],p);
          if(v===5){this.box(0,0,-12,34,49,26,'#bf9274');this.box(6,24,14,22,18,1,'#dac5a2');this.box(39,0,-8,40,18,21,p.ridgeShadow);}
        }else if(p.id==='area51'){
          if(v===0)this.hangar(-40,0,192,90,'HANGAR 51',p);
          if(v===1){
            this.dish(0,0,p);this.box(115,0,0,6,60,6,p.ground);this.box(107,58,-4,23,14,14,'#82947c');
            const sweep=Math.sin(this.time*.6)*28;
            this.face([[118,69,7],[45+sweep,195,-70],[185+sweep,195,-70]],'#455452');
          }
          if(v===2){this.hangar(-35,-20,215,99,'AUTHORIZED PERSONNEL',p);this.ufo(27,145+Math.sin(this.time*1.7)*4,-16,100,39);}
          if(v===3){
            this.box(0,15,-23,119,25,46,'#66786f');this.box(26,40,-21,61,20,42,'#66786f');
            for(const dx of [30,62])this.box(dx,44,21,23,12,1,'#9baca0');
            for(const dx of [10,94])for(const dz of [-26,21])this.box(dx,0,dz,18,20,9,'#384b50');
          }
          if(v===4){this.ufo(-18,9,-15,83,33);this.sign(151,15,['WEATHER BALLOON','PARKING ONLY'],p);}
          if(v===5){this.sign(45,0,['YOU SAW NOTHING'],p);this.box(-57,0,-8,4,109,4,p.ground);this.box(-53,99,-12,23,14,12,'#82947c');}
        }else if(p.id==='lockheed'){
          if(v===0){this.hangar(-40,-20,230,112,'SKUNK WORKS',p);this.jet(0,8,60,133,34,80);}
          if(v===1){
            this.jet(-20,8,0,189,42,104);
            for(const dx of [13,121])this.box(dx,0,-4,5,13,8,dark);
          }
          if(v===2){
            this.box(0,0,-16,28,128,32,steel);this.box(-20,128,-29,70,30,58,steel);
            this.box(-14,136,29,58,14,1,'#c7d9d7');this.box(-26,158,-34,82,6,68,dark);
            this.box(12,164,-1,3,24,3,dark);this.beam([2,187,0],[27,187,0],2,dark);
          }
          if(v===3){
            this.hangar(-40,-25,196,85,'ENGINE TEST',p);this.box(33,0,47,12,21,24,dark);
            this.tube(22,42,58,48,24,'#cad5cf');this.tube(20,42,58,3,18,dark);
            for(let i=0;i<5;i++){
              const a=i*Math.PI*2/5+this.time*.7;
              this.beam([19.5,42,58],[19.5,42+Math.cos(a)*16,58+Math.sin(a)*16],3,steel);
            }
          }
          if(v===4){this.sign(45,0,['SECRET PARKING','EVEN THE CACTI SIGNED'],p);this.box(151,0,4,25,20,25,steel);this.box(149,20,5,26,12,14,dark);this.box(160,23,10,5,12,5,'#d6ddd0');}
          if(v===5)this.dish(25,0,p);
        }else{
          if(v===0){this.hangar(-45,-25,280,134,'STARFACTORY',p);this.booster(40,36,74,p);this.booster(145,36,74,p);}
          if(v===1){
            for(const dx of [0,46])this.box(dx,0,-20,8,214,40,dark);
            for(let y=12;y<212;y+=24){this.box(7,y,-19,40,4,38,steel);this.beam([8,y+4,22],[46,y+24,22],3,steel);}
            this.box(-4,214,-24,63,7,48,steel);this.box(8,172,8,100,8,14,dark);this.box(98,123,8,8,56,14,steel);
            this.booster(130,0,175,p);this.box(-84,0,-27,5,172,5,steel);this.box(-104,172,-28,114,5,7,steel);this.beam([-9,173,-24],[-9,131,-24],2,p.ground);
          }
          if(v===2){
            this.box(-12,0,-35,156,4,71,p.ground);
            for(const [dx,h,r] of [[22,75,24],[97,54,20]]){this.tube(dx,4,0,h,r,'#b5cecc','y');this.tube(dx,h+4,0,8,r,'#dce6db','y',r*.7);}
            this.box(24,12,24,78,4,5,steel);
          }
          if(v===3)this.sign(45,0,['RAPID UNSCHEDULED','PARKING'],p);
          if(v===4){this.sign(45,0,['RETURN ALL PARTS','RECEIPT OPTIONAL'],p);this.box(157,0,-9,28,17,24,steel);this.tube(170,17,0,10,10,dark,'y',5);}
          if(v===5){this.box(0,0,-15,33,23,31,steel);this.box(6,23,-8,21,14,17,'#b9d0c7');}
        }
      }finally{this.model=null;}
    }
    mesa(x,z,w,h,d,p){
      const outline=[[0,0],[0,h*.3],[w*.13,h*.3],[w*.13,h*.67],[w*.29,h*.67],[w*.29,h],[w*.66,h],[w*.66,h*.78],[w*.84,h*.78],[w*.84,h*.25],[w,h*.25],[w,0]];
      this.face(outline.map(([dx,y])=>[x+dx,y,z]),p.ridge);
      for(let i=0;i<outline.length-1;i++){
        const [a,b]=[outline[i],outline[i+1]];
        this.face([[x+a[0],a[1],z],[x+b[0],b[1],z],[x+b[0],b[1],z-d],[x+a[0],a[1],z-d]],a[1]===b[1]?p.ridge:p.ridgeShadow);
      }
      // Horizontal seams echo Classic's block-cut canyon ridges.
      for(const y of [.69,.83])this.face([[x+w*.29,h*y,z+.2],[x+w*.66,h*y,z+.2],[x+w*.66,h*y+4,z+.2],[x+w*.29,h*y+4,z+.2]],p.ridgeShadow);
    }
    render({width,height,palette,game,distance,time,blend=0,side=0,menu=false,reduced=false,crewImage=null,crewHull=null}){
      this.width=width;this.height=height;this.camera=new Camera(width,height,blend,side);
      this.viewBlend=blend;this.crewImage=crewImage;this.crewHull=crewHull;
      this.time=reduced?0:time;this.shadowColor=shade(palette.dust,.78);this.faces.length=0;
      const c=this.ctx,p=palette;c.fillStyle=p.sky;c.fillRect(0,0,width,height);
      // A low horizon keeps both the full jump arc and approaching traffic visible.
      c.fillStyle=p.sun;c.beginPath();c.arc(width*.84,height*.17,Math.min(29,height*.06),0,Math.PI*2);c.fill();
      c.fillStyle=p.ridge;c.beginPath();c.moveTo(0,height*.43);
      for(let i=0;i<=16;i++){const y=height*(.37+noise(i+13)*.055);c.lineTo(i*width/16,y);c.lineTo((i+1)*width/16,y);}
      c.lineTo(width,height);c.lineTo(0,height);c.fill();
      this.face([[-4500,-1,-4000],[12000,-1,-4000],[12000,-1,1800],[-4500,-1,1800]],p.dust);this.flush();
      if(p.id==='spacex'){
        this.face([[-4500,-.7,-1900],[12000,-.7,-1900],[12000,-.7,-750],[-4500,-.7,-750]],p.ridgeShadow);this.flush();
      }
      this.face([[-750,0,-75],[6000,0,-75],[6000,0,75],[-750,0,75]],shade(p.dust,.9));this.flush();
      const offset=distance%150;
      for(let x=-600-offset;x<4000;x+=150){
        for(const z of [-76,73])this.box(x,.2,z,65,.4,3,p.ground);
      }
      this.flush();
      // Distant block-cut ridges, then mountains, then the Classic-themed sets.
      // All three layers use world coordinates, so camera changes preserve parallax.
      const ridgeCell=Math.floor(distance/1250),ridgeScroll=distance%1250;
      for(let i=-4;i<10;i++){
        const n=ridgeCell+i;
        this.mesa(i*1250-ridgeScroll,-2200-noise(n+47)*350,850+noise(n+5)*320,330+noise(n+11)*220,350,p);
      }
      const mountainCell=Math.floor(distance/850),mountainScroll=distance%850;
      for(let i=-4;i<12;i++){
        const n=mountainCell+i;
        this.tube(i*850-mountainScroll+noise(n)*190,0,-1080-noise(n+18)*370,170+noise(n+32)*180,165+noise(n+71)*140,p.ridgeShadow,'y',30+noise(n+9)*45);
      }
      const cell=Math.floor(distance/520),scroll=distance%520;
      for(let i=-2;i<9;i++){
        const n=cell+i,x=i*520-scroll+noise(n)*120;
        const z=-260-noise(n+80)*160;
        if((n%7+7)%7!==5)this.landmark(x,z,n,p,.8+noise(n+22)*.28);
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
