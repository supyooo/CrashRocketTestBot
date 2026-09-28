/* Characters, second generation: outlined cartoon style with cel shading, built from parts (legs, arms, torso,
   head, ears, face, shades, tie) that each move on their own.

   Two ways to draw, both in the rider's local space (seat at 0,0, the head around y = -38, facing right):
   - drawBear2(c, mood, t, state): stateless, same contract as art.js characters (+ optional state);
   - makeBear2() -> rig; rig.draw(c, mood, t, state, dt): blends poses when the state changes, so the bear
     moves into a new pose instead of jumping (shades slide, arms swing up, the head turns).
   mood 0..1 = excitement. state: 'fly' | 'scared' (engine stalls) | 'win' (cashed out) | 'chute' (hangs from the
   parachute; the canopy itself is drawn by the game) | 'fall' (tumbling after a crash) | 'pad' (waiting to launch).
   Needs art.js (clamp, lerp, rr). */
(()=>{
const OL='#140a26';                                     // one outline colour for every part
const P={fur:'#a0643a',furSh:'#6f4122',furLt:'#d08f58',muz:'#f3c992',muzSh:'#d9a46a',ear:'#eaa57a',nose:'#2a1512',
  suit:'#27306a',suitSh:'#171d44',suitLt:'#3b4a98',shirt:'#f6f5ff',tie:'#ff3e5f',tieSh:'#c21f45',shoe:'#f6f5ff',sole:'#2bff88'};
const TAU=Math.PI*2,sm=x=>x*x*(3-2*x);
const STATES=['pad','fly','scared','win','chute','fall'];

/* ---------------- poses: every number the drawing needs, per state ---------------- */
function poseOf(st,m,t){
  const sway=(a,k)=>Math.sin(t*6+a)*1.6*(.5+k);
  const p={bob:Math.sin(t*9)*(.4+m)*.9,shiver:0,wind:m,tilt:-.04+Math.sin(t*4.5)*.04*m,lag:Math.sin(t*9-.7)*(.4+m)*.7,
    shades:sm(clamp((m-.5)/.3,0,1)),open:clamp((m-.4)/.4,0,1),brow:m>.6?-1:0,look:.9,
    bfa:.1,ffa:.05};
  const up=clamp((m-.45)/.4,0,1),pump=Math.sin(t*14)*3*up;
  if(st==='fly'||st==='pad'){
    const calm=st==='pad';if(calm){p.bob=Math.sin(t*2.2)*.5;p.wind=.05;p.lag=Math.sin(t*2.2-.7)*.4;p.tilt=Math.sin(t*1.3)*.06;p.look=Math.sin(t*.9)>.6?-.8:.9;p.shades=0;p.open=0}
    const u=calm?0:up;
    p.be=[lerp(-11,-17,u),lerp(-11,-29,u)];p.bh=[lerp(-6,-20,u),lerp(-4,-47,u)+(calm?0:pump)];
    p.fe=[12,-11];p.fh=[16.5,-5.5];
    p.bk=[4,4];p.bf=[2,14+sway(0,p.wind)];p.fk=[10,3];p.ff=[9,13+sway(1.7,p.wind)];
  }else if(st==='scared'){
    Object.assign(p,{shiver:Math.sin(t*63)*.7,wind:1,tilt:-.12,shades:0,open:0,brow:-2,look:-.6});
    p.be=[4,-10];p.bh=[12,-5];p.fe=[12,-11];p.fh=[16.5,-5.5];
    p.bk=[4,-1];p.bf=[2,11+sway(0,1)];p.fk=[10,-2];p.ff=[9,10+sway(1.7,1)];
  }else if(st==='win'){
    Object.assign(p,{wind:.6,tilt:.1+Math.sin(t*12)*.05,shades:1,open:1,brow:-1});
    p.be=[-17,-29];p.bh=[-19+Math.sin(t*12)*2,-50+Math.cos(t*12)*1.5];p.fe=[16,-28];p.fh=[21+Math.sin(t*12+1)*2,-49+Math.cos(t*12+1)*1.5];
    const kick=Math.sin(t*10)*2.5;p.bk=[4,4];p.bf=[2+kick,14+sway(0,.6)];p.fk=[10,3];p.ff=[9-kick,13+sway(1.7,.6)];
  }else if(st==='chute'){                                  // hanging: hands on the straps, legs swinging loose
    const sw=Math.sin(t*2.4);
    Object.assign(p,{bob:Math.sin(t*2.4)*.8,wind:.35,tilt:.06+sw*.05,lag:Math.sin(t*2.4-.8)*.6,shades:1,open:.55+Math.sin(t*3)*.15,brow:-1});
    p.be=[-12,-35];p.bh=[-8,-53];p.fe=[13,-35];p.fh=[9,-53];
    p.bk=[-1,7+sw];p.bf=[-3+sw*2,17];p.fk=[6,7-sw];p.ff=[6-sw*2,17];p.bfa=.5;p.ffa=.45;
  }else{                                                   // fall: flailing
    const f=(a,b)=>Math.sin(t*a+b);
    Object.assign(p,{wind:1,tilt:f(7,0)*.25,shades:-1,open:1,brow:-2,look:0});
    p.be=[-13+f(17,0)*3,-24+f(15,1)*5];p.bh=[-17+f(17,.5)*6,-34+f(15,2)*9];p.fe=[13+f(16,3)*3,-25+f(14,1)*5];p.fh=[18+f(16,2)*6,-35+f(13,0)*9];
    p.bk=[-6+f(19,1)*3,6];p.bf=[-10+f(19,2)*5,13+f(17,0)*3];p.fk=[9+f(18,0)*3,5];p.ff=[13+f(18,1)*5,12+f(16,2)*3];p.bfa=f(19,0);p.ffa=f(17,1);
  }
  return p;
}
/** Weighted mix of poses (weights sum to 1). */
function mix(list){
  const out={};
  for(const [p,w] of list)for(const k in p){const v=p[k];
    if(Array.isArray(v)){const o=out[k]||(out[k]=[0,0]);o[0]+=v[0]*w;o[1]+=v[1]*w}else out[k]=(out[k]||0)+v*w}
  return out;
}

/* ---------------- drawing helpers ---------------- */
/** Fill a path, shade part of it (clipped to the same path), then outline it. */
function part(c,path,fill,shade,shadeFn,lw){
  c.beginPath();path();c.fillStyle=fill;c.fill();
  if(shade){c.save();c.clip();c.fillStyle=shade;c.beginPath();shadeFn();c.fill();c.restore();c.beginPath();path()}
  c.lineJoin='round';c.lineWidth=lw||1.5;c.strokeStyle=OL;c.stroke();
}
/** A two-segment limb: outline stroke under a colour stroke, so joints stay round. */
function limb(c,a,b,d,w,col){
  c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(d[0],d[1]);
  c.strokeStyle=OL;c.lineWidth=w+3;c.stroke();c.strokeStyle=col;c.lineWidth=w;c.stroke();
}
function paw(c,x,y,r){part(c,()=>c.arc(x,y,r,0,TAU),P.furLt,P.fur,()=>c.arc(x-1.2,y+1.2,r,0,TAU),1.4)}
function shoe(c,x,y,a){
  c.save();c.translate(x,y);c.rotate(a);
  part(c,()=>{c.moveTo(-3,-2.6);c.quadraticCurveTo(5.5,-4,6.5,.8);c.lineTo(6.5,1.6);c.lineTo(-3.4,1.6);c.closePath()},P.shoe,'#cfd0e6',()=>c.rect(-4,0,12,3),1.4);
  c.fillStyle=P.sole;c.fillRect(-3,1.1,9.2,1.1);c.restore();
}
/** A ribbon along a centreline, tapering from w0 to w1 (the tie). */
function ribbon(c,pts,w0,w1,fill,shade){
  const L=[],R=[];
  pts.forEach((p,i)=>{const q=pts[Math.min(i+1,pts.length-1)],o=pts[Math.max(i-1,0)],dx=q[0]-o[0],dy=q[1]-o[1],n=Math.hypot(dx,dy)||1,w=lerp(w0,w1,i/(pts.length-1))/2;
    L.push([p[0]-dy/n*w,p[1]+dx/n*w]);R.push([p[0]+dy/n*w,p[1]-dx/n*w])});
  const path=()=>{c.moveTo(L[0][0],L[0][1]);L.forEach(p=>c.lineTo(p[0],p[1]));const e=pts[pts.length-1];c.lineTo(e[0]-1,e[1]+1.5);for(let i=R.length-1;i>=0;i--)c.lineTo(R[i][0],R[i][1]);c.closePath()};
  part(c,path,fill,shade,()=>{c.moveTo(L[0][0],L[0][1]);L.forEach(p=>c.lineTo(p[0],p[1]));for(let i=pts.length-1;i>=0;i--)c.lineTo(pts[i][0],pts[i][1]);c.closePath()},1.3);
}

/* ---------------- the bear, from a pose ---------------- */
// face: which expression set wins (the dominant state), the pose supplies the amounts
function render(c,p,t,face){
  const scared=face==='scared',fall=face==='fall',win=face==='win'||face==='chute',wind=p.wind;
  c.save();c.translate(p.shiver,p.bob);

  /* back leg and arm (behind the body) */
  limb(c,[-3,-2],p.bk,p.bf,5.2,P.suitSh);shoe(c,p.bf[0],p.bf[1],p.bfa);
  limb(c,[-6,-19],p.be,p.bh,4.6,P.suitSh);paw(c,p.bh[0],p.bh[1],3.3);

  /* jacket tail flapping in the wind */
  const tail=wind*4+Math.sin(t*24)*1.2*wind;
  part(c,()=>{c.moveTo(-8,-8);c.quadraticCurveTo(-12-tail,-4+Math.sin(t*20)*1.5*wind,-11-tail*1.2,1);c.lineTo(-7,0);c.closePath()},P.suitSh,null,null,1.3);

  /* torso */
  part(c,()=>rr(c,-9.5,-25,19,25.5,7),P.suit,P.suitSh,()=>c.rect(-11,-27,7,30),1.6);
  c.fillStyle=P.suitLt;c.globalAlpha=.55;c.beginPath();c.ellipse(5,-20,2.2,4,-.3,0,TAU);c.fill();c.globalAlpha=1;
  part(c,()=>{c.moveTo(-4,-25);c.lineTo(0,-14.5);c.lineTo(4,-25);c.closePath()},P.shirt,null,null,1.2);
  c.fillStyle='#ffd23f';c.strokeStyle=OL;c.lineWidth=.9;[-9,-4].forEach(y=>{c.beginPath();c.arc(1.5,y,1.1,0,TAU);c.fill();c.stroke()});
  // tie: the knot stays, the blade streams back with the wind
  const tw=t*(22+wind*12),tl=4+wind*4.5;
  const tie=[0,1,2,3,4].map(i=>{const k=i/4;return[-k*tl*1.3+Math.sin(tw-k*3)*k*1.4*wind,-21.5+k*(10-wind*4.5)+Math.sin(tw*.8-k*2.5)*k*1.8*wind]});
  ribbon(c,tie,4.6,3.2,P.tie,P.tieSh);
  part(c,()=>{c.moveTo(-1.8,-24.2);c.lineTo(1.8,-24.2);c.lineTo(1.3,-20.8);c.lineTo(-1.3,-20.8);c.closePath()},P.tie,null,null,1.1);

  /* front leg */
  limb(c,[4,-2],p.fk,p.ff,5.4,P.suit);shoe(c,p.ff[0],p.ff[1],p.ffa);

  /* head: follows the body a moment later */
  c.save();c.translate(1,-37+p.lag-p.bob*.3);c.rotate(p.tilt);
  const ew=Math.sin(t*(12+wind*10))*.12*(.3+wind);
  [[-9,-10.5,-.35-ew],[9,-11.5,.3+ew]].forEach(([x,y,a])=>{c.save();c.translate(x,y);c.rotate(a);
    part(c,()=>c.arc(0,0,5.4,0,TAU),P.fur,P.furSh,()=>c.arc(-2,2,5.4,0,TAU),1.5);c.fillStyle=P.ear;c.beginPath();c.arc(.3,.4,2.7,0,TAU);c.fill();c.restore()});
  part(c,()=>c.arc(0,0,13.6,0,TAU),P.fur,P.furSh,()=>c.arc(-8,6,12,0,TAU),1.7);
  c.fillStyle='rgba(255,236,210,.28)';c.beginPath();c.ellipse(5,-8.5,4,1.9,-.5,0,TAU);c.fill();
  // tuft of fur streaming back
  const tf=Math.sin(t*(18+wind*14))*1.4*(.3+wind);
  part(c,()=>{c.moveTo(-3,-12.8);c.quadraticCurveTo(-7-wind*3,-17+tf,-11-wind*4,-15.5+tf);c.quadraticCurveTo(-6,-14.5,-5.5,-12.4);
    c.quadraticCurveTo(-3,-18+tf*.6,-6.5-wind*2,-19.5+tf*.8);c.quadraticCurveTo(-1,-18,0,-13.4);c.closePath()},P.fur,null,null,1.3);
  // muzzle and nose
  part(c,()=>c.ellipse(5.5,5,8.4,6.4,0,0,TAU),P.muz,P.muzSh,()=>c.ellipse(3,9,9,4,0,0,TAU),1.4);
  part(c,()=>c.ellipse(10.6,1.6,3.3,2.4,-.1,0,TAU),P.nose,null,null,1.1);
  c.fillStyle='rgba(255,255,255,.7)';c.beginPath();c.ellipse(11.4,.8,1.1,.6,-.2,0,TAU);c.fill();

  // eyes (hidden once the shades are on them)
  const shades=p.shades,blink=!scared&&!fall&&(t%3.4)<.13;
  if(shades<.95){
    const wide=scared||fall?1.35:1;
    [[.5,-3,2.6],[8,-3.4,2.9]].forEach(([x,y,r])=>{
      if(blink){c.strokeStyle=OL;c.lineWidth=1.3;c.lineCap='round';c.beginPath();c.moveTo(x-r,y);c.quadraticCurveTo(x,y+1.6,x+r,y);c.stroke();return}
      part(c,()=>c.ellipse(x,y,r*.85*wide,r*1.15*wide,0,0,TAU),'#fff',null,null,1.2);
      c.fillStyle=OL;c.beginPath();c.arc(x+p.look,y+.3,(scared||fall?1:1.55),0,TAU);c.fill();
      c.fillStyle='#fff';c.beginPath();c.arc(x+p.look+.5,y-.5,.5,0,TAU);c.fill()});
    c.strokeStyle=OL;c.lineWidth=1.4;c.lineCap='round';const br=p.brow;
    c.beginPath();c.moveTo(-2,-8+br-(scared?1:0));c.lineTo(2.6,-8.4+br);c.moveTo(5.6,-8.8+br);c.lineTo(10.2,-8.6+br-(scared?1.2:0));c.stroke();
  }
  // mouth
  c.lineCap='round';
  if(scared||fall){const o=fall?2.8:2+Math.sin(t*30)*.4;part(c,()=>c.ellipse(6,9.5,o*.8,o,0,0,TAU),'#5a1020',null,null,1.2)}
  else if(p.open<.08&&!win){c.strokeStyle=OL;c.lineWidth=1.4;c.beginPath();c.moveTo(3,7.6);c.quadraticCurveTo(7,10.4,11,7.4);c.stroke()}
  else{const d=2.5+p.open*3.2,lips=()=>{c.moveTo(1.8,7);c.quadraticCurveTo(7,8.2,12.2,6.4);c.quadraticCurveTo(10.5,7+d*1.3,6.5,7.6+d);c.quadraticCurveTo(2.5,7.6+d*.8,1.8,7);c.closePath()};
    part(c,lips,'#5a1020',null,null,1.3);
    c.save();c.beginPath();lips();c.clip();c.fillStyle='#fff';c.fillRect(1,5,12,2.9);c.fillStyle='#ff7a93';c.beginPath();c.ellipse(6.5,8+d,3.4,2.2,0,0,TAU);c.fill();c.restore()}
  if(scared){const k=(t*1.4)%1;c.globalAlpha=1-k;part(c,()=>{c.moveTo(-10,-6+k*8);c.quadraticCurveTo(-12.4,-1+k*8,-10,0+k*8);c.quadraticCurveTo(-7.6,-1+k*8,-10,-6+k*8)},'#8fd8ff',null,null,1);c.globalAlpha=1}

  // shades: slide from the forehead down onto the eyes as the flight heats up (gone while tumbling)
  if(shades>-.3){
    const s=clamp(shades,0,1),sy=lerp(-11.5,-4.2,s),sa=lerp(-.22,0,s);
    c.save();c.translate(4.3,sy);c.rotate(sa);
    c.strokeStyle=OL;c.lineWidth=1.6;c.beginPath();c.moveTo(-1.5,0);c.lineTo(1.2,0);c.stroke();
    [-5.3,5.3].forEach(x=>{part(c,()=>rr(c,x-4.6,-2.9,9.2,6,2.4),'#0b1320',null,null,1.5);
      c.strokeStyle='#2bff88';c.lineWidth=.9;rr(c,x-3.9,-2.2,7.8,4.6,1.9);c.stroke();
      c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=1;c.beginPath();c.moveTo(x-2.4,1.2);c.lineTo(x+.6,-1.4);c.stroke()});
    c.restore();
  }
  c.restore();                                                     // head

  /* front arm (over everything: it holds the rocket or the strap) */
  limb(c,[6,-19],p.fe,p.fh,4.8,P.suit);paw(c,p.fh[0],p.fh[1],3.5);

  if(face==='win'){for(let i=0;i<3;i++){const k=(t*1.3+i/3)%1,x=[-20,20,0][i],y=[-52,-50,-62][i]-k*6,s=(1-Math.abs(k*2-1))*3.2;
    c.fillStyle=['#ffd23f','#2bff88','#29e6ff'][i];c.beginPath();c.moveTo(x,y-s);c.lineTo(x+s*.3,y-s*.3);c.lineTo(x+s,y);c.lineTo(x+s*.3,y+s*.3);c.lineTo(x,y+s);c.lineTo(x-s*.3,y+s*.3);c.lineTo(x-s,y);c.lineTo(x-s*.3,y-s*.3);c.fill()}}
  c.restore();
}

function drawBear2(c,mood,t,st){st=STATES.includes(st)?st:'fly';render(c,poseOf(st,clamp(mood,0,1),t),t,st)}

/** A bear that remembers its pose: state changes blend over ~0.25 s (arms, legs, head) and ~0.4 s (shades). */
function makeBear2(){
  const w={fly:1};let sh=null,face='fly';
  return{
    draw(c,mood,t,st,dt){
      st=STATES.includes(st)?st:'fly';const m=clamp(mood,0,1);dt=clamp(dt||0,0,.1);
      const a=1-Math.exp(-dt*11);                          // blend speed
      for(const s of STATES)w[s]=(w[s]||0)+((s===st?1:0)-(w[s]||0))*a;
      const sum=STATES.reduce((q,s)=>q+w[s],0)||1,list=STATES.filter(s=>w[s]>.002).map(s=>[poseOf(s,m,t),w[s]/sum]);
      const p=mix(list);
      sh=sh===null?p.shades:sh+(p.shades-sh)*(1-Math.exp(-dt*7));p.shades=sh;   // shades move a little slower
      face=STATES.reduce((b,s)=>w[s]>w[b]?s:b,st);
      render(c,p,t,face);
    }
  };
}
window.drawBear2=drawBear2;window.makeBear2=makeBear2;

// the game's bear becomes the new one: stateless draw for previews, a rig for the round,
// and where the parachute hangs (he is taller than the old bear, hands on the straps above his head)
// (CHARS is a top-level const in art.js, so it is not on window)
if(typeof CHARS!=='undefined'&&CHARS.bear)Object.assign(CHARS.bear,{draw:drawBear2,rig:makeBear2(),chute:{y:-86,l:[-8,-54],r:[9,-54]},thumb:.8});
})();
