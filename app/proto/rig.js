/* Boomy bear, third generation (prototype): a skeleton with the painted picture laid over it in parts.

   The picture (app/art/bear/rig/, cut by hand from the generator's sitting bear) is three layers: the raised arm
   (behind), the body without the head, and four heads. Each layer is a mesh; every vertex follows the bones near it,
   so a limb bends as a soft thing instead of turning as a stiff cut-out. The poses are the working game's
   (app/chars2.js poseOf): the same numbers for the arm, the legs, the bob, the lean and the head, per state, blended
   when the state changes. Two more pictures, hanging and falling, are skins of their own with their own bones.

   Variants, to compare:
     'parts'   every vertex belongs to one bone: stiff cut-out parts, as in the first kits;
     'mesh'    soft weights: the picture bends at the joints;
     'spring'  soft weights, and every bone reaches its pose through a spring of its own (follow-through, overlap),
               the ears and the fist trail behind, the chest breathes.

   BearRig.load(base).then(kit=>{const r=BearRig.create(kit,'spring'); r.update(dt,t,{state,mood,glad}); r.render()})
   states: 'pad' | 'fly' | 'scared' | 'chute' | 'fall'; mood 0..1 (excitement); glad = just cashed out, still riding.
   render() draws into the rig's own WebGL canvas and returns {canvas, ax, ay, s}: the anchor (the seat; the hands on
   the parachute; the middle when falling) in canvas px, and canvas px per picture px. */
(()=>{
const TAU=Math.PI*2,clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,sm=t=>t*t*(3-2*t);
const U=11.5;                                   // picture px per unit of the game's rig (the sitting bear is ~52 units tall)

/* ---------------- skins: bones in picture px. seg: the bone's line, s: how far its pull reaches ---------------- */
const SIT={w:407,h:600,anchor:[222,424],
  bones:[
    {n:'root',p:[222,424]},
    {n:'hips',par:'root',p:[170,415],tip:[300,415],s:46},
    {n:'chest',par:'root',p:[235,385],tip:[238,255],s:74},
    {n:'armR',par:'chest',p:[332,290],tip:[362,352],s:26},
    {n:'foreR',par:'armR',p:[362,352],tip:[322,392],s:26},
    {n:'thighL',par:'root',p:[215,408],tip:[196,442],s:36},
    {n:'shinL',par:'thighL',p:[190,470],tip:[160,560],s:34},
    {n:'thighR',par:'root',p:[300,408],tip:[334,442],s:36},
    {n:'shinR',par:'thighR',p:[338,475],tip:[348,560],s:32},
    {n:'armL',par:'chest',p:[140,258],tip:[92,182],s:30},
    {n:'foreL',par:'armL',p:[92,182],tip:[60,122],s:26},
    {n:'fistL',par:'foreL',p:[60,122],tip:[52,55],s:30},
    {n:'head',par:'chest',p:[238,228],tip:[215,120],s:90},
    {n:'earL',par:'head',p:[152,98],tip:[140,52],s:20},
    {n:'earR',par:'head',p:[262,48],tip:[270,24],s:15}],
  layers:[
    {img:'arm',bones:['armL','foreL','fistL']},
    {img:'body',bones:['root','hips','chest','armR','foreR','thighL','shinL','thighR','shinR']},
    {img:'head',bones:['head','earL','earR'],faces:{calm:[113,23],hype:[110,26],scared:[112,20],win:[113,20]}}]};
const HANG={w:473,h:749,anchor:[211,88],
  bones:[
    {n:'root',p:[211,88]},
    {n:'arms',par:'root',p:[46,90],tip:[376,88],s:60},
    {n:'chest',par:'root',p:[236,225],tip:[245,385],s:85},
    {n:'head',par:'chest',p:[240,300],tip:[226,170],s:72},
    {n:'hips',par:'chest',p:[250,430],tip:[256,515],s:70},
    {n:'legL',par:'hips',p:[205,525],tip:[178,690],s:44},
    {n:'legR',par:'hips',p:[312,525],tip:[398,682],s:44}],
  layers:[{img:'hang',bones:['root','arms','chest','head','hips','legL','legR']}]};
const FALL={w:569,h:678,anchor:[283,400],
  bones:[
    {n:'root',p:[283,400]},
    {n:'torso',par:'root',p:[205,335],tip:[335,470],s:74},
    {n:'head',par:'root',p:[250,275],tip:[213,170],s:70},
    {n:'armL',par:'root',p:[158,332],tip:[66,290],s:44},
    {n:'armR',par:'root',p:[380,205],tip:[428,62],s:44},
    {n:'legR',par:'root',p:[420,442],tip:[512,410],s:50},
    {n:'legL',par:'root',p:[300,505],tip:[352,630],s:54}],
  layers:[{img:'fall',bones:['root','torso','head','armL','armR','legR','legL']}]};
const SKINS={sit:SIT,hang:HANG,fall:FALL};
const FILES=['body','arm','head-calm','head-hype','head-scared','head-win','hang','fall'];

/* ---------------- the working game's poses (app/chars2.js), kept number for number ---------------- */
function poseOf(st,m,t){
  const sway=(a,k)=>Math.sin(t*6+a)*1.6*(.5+k);
  const p={bob:Math.sin(t*9)*(.4+m)*.9,shiver:0,wind:m,tilt:-.04+Math.sin(t*4.5)*.04*m,lag:Math.sin(t*9-.7)*(.4+m)*.7,heat:m,scare:0};
  const up=clamp((m-.45)/.4,0,1),pump=Math.sin(t*14)*3*up;
  if(st==='scared'){Object.assign(p,{shiver:Math.sin(t*63)*.7,wind:1,tilt:-.12,heat:0,scare:1});
    p.be=[4,-10];p.bh=[12,-5];p.bk=[4,-1];p.bf=[2,11+sway(0,1)];p.fk=[10,-2];p.ff=[9,10+sway(1.7,1)]}
  else{const calm=st==='pad';if(calm){p.bob=Math.sin(t*2.2)*.5;p.wind=.05;p.lag=Math.sin(t*2.2-.7)*.4;p.tilt=Math.sin(t*1.3)*.06;p.heat=0}
    const u=calm?0:up;
    p.be=[lerp(-11,-17,u),lerp(-11,-29,u)];p.bh=[lerp(-6,-20,u),lerp(-4,-47,u)+(calm?0:pump)];
    p.bk=[4,4];p.bf=[2,14+sway(0,p.wind)];p.fk=[10,3];p.ff=[9,13+sway(1.7,p.wind)]}
  return p}
function mixPose(list){const o={};for(const [p,w] of list)for(const k in p){const v=p[k];if(Array.isArray(v)){const q=o[k]||(o[k]=[0,0]);q[0]+=v[0]*w;q[1]+=v[1]*w}else o[k]=(o[k]||0)+v*w}return o}
const SH=[-6,-19],REF={be:[-17,-29],bh:[-20,-47]};      // the back arm's shoulder; the pose the picture was painted in
const ang=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0]),wrap=a=>{a%=TAU;return a>Math.PI?a-TAU:a<-Math.PI?a+TAU:a};
const RU=ang(SH,REF.be),RF=ang(REF.be,REF.bh);

/* ---------------- 2x3 matrices ---------------- */
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function local(b,q){const c=Math.cos(q.r),s=Math.sin(q.r),sx=q.sx,sy=q.sy,px=b.p[0],py=b.p[1];   // T(p+t) R S T(-p)
  const a=c*sx,bb=s*sx,cc=-s*sy,d=c*sy;return[a,bb,cc,d,px+q.tx-(a*px+cc*py),py+q.ty-(bb*px+d*py)]}
function distSeg(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy,u=L?clamp(((x-a[0])*dx+(y-a[1])*dy)/L,0,1):0;return Math.hypot(x-a[0]-dx*u,y-a[1]-dy*u)}

/* ---------------- loading ---------------- */
function load(base){return Promise.all(FILES.map(f=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>res([f,im]);im.onerror=rej;im.src=base+f+'.webp'}))).then(a=>({img:Object.fromEntries(a)}))}

/** A grid mesh over the opaque part of an image. ox, oy: where the image sits in the skin. */
function buildMesh(im,ox,oy,step){
  const w=im.width,h=im.height,c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);
  const A=g.getImageData(0,0,w,h).data,nx=Math.ceil(w/step),ny=Math.ceil(h/step),id=new Int32Array((nx+1)*(ny+1)).fill(-1),xy=[],uv=[],idx=[];
  const solid=(i,j)=>{const x1=Math.min(w,(i+1)*step),y1=Math.min(h,(j+1)*step);for(let y=j*step;y<y1;y+=2)for(let x=i*step;x<x1;x+=2)if(A[(y*w+x)*4+3]>6)return true;return false};
  const vert=(i,j)=>{const k=j*(nx+1)+i;if(id[k]<0){id[k]=xy.length/2;const x=Math.min(w,i*step),y=Math.min(h,j*step);xy.push(x+ox,y+oy);uv.push(x/w,y/h)}return id[k]};
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)if(solid(i,j)){const a=vert(i,j),b=vert(i+1,j),d=vert(i,j+1),e=vert(i+1,j+1);idx.push(a,b,d,b,e,d)}
  return{xy:new Float32Array(xy),uv:new Float32Array(uv),idx:new Uint16Array(idx)}}

/** Weights of a mesh's vertices to its bones: a bone pulls hardest along its own line. hard: one bone per vertex. */
function weigh(mesh,bones,hard){const n=mesh.xy.length/2,k=bones.length,W=new Float32Array(n*k);
  for(let v=0;v<n;v++){const x=mesh.xy[v*2],y=mesh.xy[v*2+1];let sum=0,best=0,bw=-1;
    for(let i=0;i<k;i++){const b=bones[i];let w;
      if(!b.tip)w=.02;else{const d=distSeg(x,y,b.p,b.tip)/b.s;w=Math.exp(-d*d)}
      W[v*k+i]=w;sum+=w;if(w>bw){bw=w;best=i}}
    for(let i=0;i<k;i++)W[v*k+i]=hard?(i===best?1:0):W[v*k+i]/sum}
  return W}

/* ---------------- WebGL ---------------- */
const VS='attribute vec2 p;attribute vec2 u;uniform vec2 r;uniform vec2 o;varying vec2 v;void main(){v=u;vec2 c=(p+o)/r*2.-1.;gl_Position=vec4(c.x,-c.y,0.,1.);}';
const FS='precision mediump float;varying vec2 v;uniform sampler2D t;uniform float a;void main(){gl_FragColor=texture2D(t,v)*a;}';
const CW=760,CH=1060,MX=150,MY=160;                 // the rig's canvas, in picture px, and the margin around the skin
function makeGL(q){const cv=document.createElement('canvas');cv.width=Math.round(CW*q);cv.height=Math.round(CH*q);
  const gl=cv.getContext('webgl',{premultipliedAlpha:true,alpha:true,antialias:true});if(!gl)return null;
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o},pr=gl.createProgram();
  gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);gl.useProgram(pr);
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  const L={p:gl.getAttribLocation(pr,'p'),u:gl.getAttribLocation(pr,'u'),r:gl.getUniformLocation(pr,'r'),o:gl.getUniformLocation(pr,'o'),a:gl.getUniformLocation(pr,'a')};
  gl.enableVertexAttribArray(L.p);gl.enableVertexAttribArray(L.u);gl.uniform2f(L.r,CW,CH);gl.uniform2f(L.o,MX,MY);
  return{cv,gl,L}}
function texture(gl,im){   // power-of-two copy, so it can have mipmaps (the bear is drawn at half its picture size)
  const pot=v=>{let p=64;while(p<v)p*=2;return p},c=document.createElement('canvas');c.width=pot(im.width);c.height=pot(im.height);c.getContext('2d').drawImage(im,0,0,c.width,c.height);
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t}

/* ---------------- a rig ---------------- */
function create(kit,variant,opt){
  variant=variant||'spring';const hard=variant==='parts',springy=variant==='spring',G=makeGL((opt&&opt.q)||1);if(!G)return null;const gl=G.gl;
  // meshes and weights of every skin
  const skins={};
  for(const id in SKINS){const S=SKINS[id],bi=Object.fromEntries(S.bones.map((b,i)=>[b.n,i])),parts=[];
    for(const Ly of S.layers){const bones=Ly.bones.map(n=>S.bones[bi[n]]),bidx=Ly.bones.map(n=>bi[n]);
      const one=(im,ox,oy,face)=>{const m=buildMesh(im,ox,oy,hard?26:18);m.W=weigh(m,bones,hard);m.bidx=bidx;m.out=new Float32Array(m.xy.length);m.face=face;
        m.tex=texture(gl,im);m.bp=gl.createBuffer();m.bu=gl.createBuffer();m.bi=gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER,m.bu);gl.bufferData(gl.ARRAY_BUFFER,m.uv,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.bi);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,m.idx,gl.STATIC_DRAW);return m};
      if(Ly.faces)for(const f in Ly.faces)parts.push(one(kit.img['head-'+f],Ly.faces[f][0],Ly.faces[f][1],f));else parts.push(one(kit.img[Ly.img],0,0,null))}
    skins[id]={S,bi,parts,q:S.bones.map(()=>({r:0,sx:1,sy:1,tx:0,ty:0,v:0,vx:0,vy:0})),M:S.bones.map(()=>[1,0,0,1,0,0])}}
  const STATES=['pad','fly','scared'],w={pad:1,fly:0,scared:0};
  let skin='sit',face='calm',facePrev='calm',faceT=1,jig={earL:{x:0,v:0},earR:{x:0,v:0},fist:{x:0,v:0}},lastHead=0,lastHeadV=0;
  // a bone's angle goes to its target at once, or through its spring
  function to(q,r,k,z,dt){if(!springy||!k){q.r=r;return}for(let i=0,n=dt>.02?2:1,h=dt/n;i<n;i++){q.v+=(-2*z*k*q.v-k*k*(q.r-r))*h;q.r+=q.v*h}}
  function sp(o,target,k,z,dt){for(let i=0,n=dt>.02?2:1,h=dt/n;i<n;i++){o.v+=(-2*z*k*o.v-k*k*(o.x-target))*h;o.x+=o.v*h}}

  function update(dt,t,inp){dt=clamp(dt,0,.05);const st=inp.state||'fly',m=clamp(inp.mood||0,0,1);
    skin=st==='chute'?'hang':st==='fall'?'fall':'sit';const K=skins[skin],Q=n=>K.q[K.bi[n]];
    if(skin==='sit'){
      // the game's poses, blended over a quarter of a second when the state changes
      const a=hard?1:1-Math.exp(-dt*11);for(const s of STATES)w[s]+=((s===st?1:0)-w[s])*a;
      const sum=w.pad+w.fly+w.scared||1,p=mixPose(STATES.filter(s=>w[s]>.002).map(s=>[poseOf(s,m,t),w[s]/sum]));
      const glad=inp.glad&&st==='fly',sc=p.scare;
      // the whole figure: bob, shiver, lean; a hop and a squash when glad (chars2 renderKit)
      const lean=lerp(glad?.06+Math.sin(t*12)*.05:-.02-p.heat*.06+Math.sin(t*4.5)*.03*p.heat,-.14,sc);
      const hop=glad?-Math.abs(Math.sin(t*9))*3:0,sq=glad?1+Math.sin(t*18)*.025:1,R=Q('root'),C=Q('chest');
      R.tx=p.shiver*U;R.ty=(p.bob*.8+hop)*U;R.sx=2-sq;R.sy=sq;to(R,lean*.45,16,.6,dt);to(C,lean*.55,12,.5,dt);
      // breathing: the chest swells slowly on the pad, faster in flight
      const br=springy?Math.sin(t*(st==='pad'?2.1:5))*(st==='pad'?.014:.008):0;C.sx=1+br*.6;C.sy=1+br;
      // the raised arm: shoulder and elbow turn by as much as the game's arm turns away from the painted pose
      const du=wrap(ang(SH,p.be)-RU),df=wrap(ang(p.be,p.bh)-RF-du);
      to(Q('armL'),du,13,.5,dt);to(Q('foreL'),df,10,.42,dt);
      // the legs swing from the knee with the wind
      to(Q('shinL'),(p.bf[1]-14)*.045+(p.bk[1]-4)*.03,11,.4,dt);to(Q('shinR'),(p.ff[1]-13)*.045+(p.fk[1]-3)*.03,11,.4,dt);
      to(Q('armR'),Math.sin(t*4.5)*.03*p.heat-sc*.05,10,.5,dt);to(Q('foreR'),Math.sin(t*4.5+1)*.04*p.heat,9,.45,dt);
      // the head: a beat behind the body, tilting; the face of the moment
      const H=Q('head');H.ty=p.lag*.8*U;to(H,p.tilt*1.2-sc*.1,12,.38,dt);
      const f=sc>.5?'scared':glad?'win':p.heat>.55?'hype':'calm';
      if(f!==face){facePrev=face;face=f;faceT=hard?1:0}faceT=Math.min(1,faceT+dt/.14);
      const pop=springy&&faceT<1?Math.sin(faceT*Math.PI)*.07:0;H.sx=1+pop;H.sy=1-pop*.6+ (springy?Math.sin(t*9)*.006*(.4+m):0);
      // trailing bits: the ears and the fist lag behind what carries them
      if(springy){const hv=(H.r+H.ty*.01-lastHead)/Math.max(dt,.001),ha=(hv-lastHeadV)/Math.max(dt,.001);lastHead=H.r+H.ty*.01;lastHeadV=hv;
        sp(jig.earL,clamp(-hv*.35-ha*.004,-.5,.5),22,.28,dt);sp(jig.earR,clamp(-hv*.3-ha*.004,-.5,.5),25,.28,dt);
        sp(jig.fist,clamp(-(Q('foreL').v+Q('armL').v)*.07,-.6,.6),18,.3,dt);
        Q('earL').r=jig.earL.x;Q('earR').r=jig.earR.x;Q('fistL').r=jig.fist.x}
      else{Q('earL').r=Q('earR').r=Q('fistL').r=0}
    }else if(skin==='hang'){
      // the pendulum under the canopy: each part further down swings a little later (the game's chute pose)
      const A=.09+(inp.swing||0),s=ph=>Math.sin(t*2.4-ph);
      Q('root').r=inp.sway!==undefined?inp.sway:s(0)*A;Q('root').ty=Math.sin(t*2.4)*.8*U*.3;
      to(Q('chest'),s(.55)*A*.5,7,.35,dt);to(Q('hips'),s(1)*A*.7,6,.3,dt);to(Q('head'),s(.4)*A*.6+.04,9,.4,dt);
      to(Q('legL'),s(1.5)*A*1.3+Math.sin(t*3.1)*.04,5.5,.25,dt);to(Q('legR'),s(1.8)*A*1.1-Math.sin(t*3.1+1)*.04,5.5,.25,dt)
    }else{
      // falling: arms and legs flail, each at its own rate (the game's fall pose)
      const f=(a,b)=>Math.sin(t*a+b);
      to(Q('head'),f(7,0)*.2,14,.4,dt);to(Q('armL'),f(17,0)*.34,20,.4,dt);to(Q('armR'),f(16,3)*.3,20,.4,dt);
      to(Q('legR'),f(18,0)*.26,18,.4,dt);to(Q('legL'),f(19,1)*.28,18,.4,dt);Q('torso').sy=1+f(15,1)*.012}
    // world matrices, parents first
    const S=K.S;for(let i=0;i<S.bones.length;i++){const b=S.bones[i],L=local(b,K.q[i]);K.M[i]=b.par?mul(K.M[K.bi[b.par]],L):L}}

  function skinMesh(K,m){const n=m.xy.length/2,k=m.bidx.length,M=m.bidx.map(i=>K.M[i]);
    for(let v=0;v<n;v++){const x=m.xy[v*2],y=m.xy[v*2+1];let ox=0,oy=0;
      for(let i=0;i<k;i++){const wv=m.W[v*k+i];if(wv<.003)continue;const A=M[i];ox+=wv*(A[0]*x+A[2]*y+A[4]);oy+=wv*(A[1]*x+A[3]*y+A[5])}
      m.out[v*2]=ox;m.out[v*2+1]=oy}}
  function drawMesh(m,alpha){const L=G.L;gl.bindTexture(gl.TEXTURE_2D,m.tex);gl.uniform1f(L.a,alpha);
    gl.bindBuffer(gl.ARRAY_BUFFER,m.bp);gl.bufferData(gl.ARRAY_BUFFER,m.out,gl.DYNAMIC_DRAW);gl.vertexAttribPointer(L.p,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,m.bu);gl.vertexAttribPointer(L.u,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.bi);gl.drawElements(gl.TRIANGLES,m.idx.length,gl.UNSIGNED_SHORT,0)}
  function render(){const K=skins[skin];gl.viewport(0,0,G.cv.width,G.cv.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    for(const m of K.parts){if(m.face){if(m.face===face){skinMesh(K,m);if(faceT<1){const o=K.parts.find(x=>x.face===facePrev);skinMesh(K,o);drawMesh(o,1)}drawMesh(m,faceT<1?faceT:1)}continue}
      skinMesh(K,m);drawMesh(m,1)}
    const q=G.cv.width/CW,a=K.S.anchor;return{canvas:G.cv,ax:(a[0]+MX)*q,ay:(a[1]+MY)*q,s:q,skin}}
  /** The bones as lines, in canvas px (for the lab's overlay). */
  function bones(){const K=skins[skin],q=G.cv.width/CW,out=[];K.S.bones.forEach((b,i)=>{if(!b.tip)return;const A=K.M[i],P=(x,y)=>[(A[0]*x+A[2]*y+A[4]+MX)*q,(A[1]*x+A[3]*y+A[5]+MY)*q];out.push([P(b.p[0],b.p[1]),P(b.tip[0],b.tip[1])])});return out}
  return{update,render,bones,variant}}

window.BearRig={load,create,U};
})();
