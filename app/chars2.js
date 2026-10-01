/* Characters, second generation: outlined cartoon style with cel shading, built from parts that each move on their
   own. One skeleton for everyone (poses, blending, legs, arms, wind); each character brings its head, clothes,
   hands, what it holds and its signature move.

   Drawing happens in the rider's local space (seat at 0,0, the head around y = -38, facing right):
   - CHARS[id].draw(c, mood, t, state): stateless, for previews (same contract as art.js + optional state);
   - CHARS[id].rig.draw(c, mood, t, state, dt): blends poses when the state changes, so the character moves into a
     new pose instead of jumping.
   mood 0..1 = excitement. state: 'pad' (waiting to launch) | 'fly' | 'scared' (engine stalls) | 'win' (cashed out) |
   'chute' (hangs from the parachute; the canopy is drawn by the game) | 'fall' (tumbling after a crash).
   Needs art.js (clamp, lerp, rr). */
(()=>{
const OL='#140a26';                                     // one outline colour for every part
const TAU=Math.PI*2,sm=x=>x*x*(3-2*x);
const STATES=['pad','fly','scared','win','chute','fall'];
const hash=(a,b)=>{const s=Math.sin(a*127.1+b*311.7)*43758.5453;return s-Math.floor(s)};   // steady pseudo-random

/* ---------------- poses: every number the drawing needs, per state ---------------- */
function poseOf(st,m,t){
  const sway=(a,k)=>Math.sin(t*6+a)*1.6*(.5+k);
  const p={bob:Math.sin(t*9)*(.4+m)*.9,shiver:0,wind:m,tilt:-.04+Math.sin(t*4.5)*.04*m,lag:Math.sin(t*9-.7)*(.4+m)*.7,
    shades:sm(clamp((m-.5)/.3,0,1)),open:clamp((m-.4)/.4,0,1),brow:m>.6?-1:0,look:.9,heat:m,
    bfa:.1,ffa:.05};
  const up=clamp((m-.45)/.4,0,1),pump=Math.sin(t*14)*3*up;
  if(st==='fly'||st==='pad'){
    const calm=st==='pad';if(calm){p.bob=Math.sin(t*2.2)*.5;p.wind=.05;p.lag=Math.sin(t*2.2-.7)*.4;p.tilt=Math.sin(t*1.3)*.06;p.look=Math.sin(t*.9)>.6?-.8:.9;p.shades=0;p.open=0;p.heat=0}
    const u=calm?0:up;
    p.be=[lerp(-11,-17,u),lerp(-11,-29,u)];p.bh=[lerp(-6,-20,u),lerp(-4,-47,u)+(calm?0:pump)];
    p.fe=[12,-11];p.fh=[16.5,-5.5];
    p.bk=[4,4];p.bf=[2,14+sway(0,p.wind)];p.fk=[10,3];p.ff=[9,13+sway(1.7,p.wind)];
  }else if(st==='scared'){
    Object.assign(p,{shiver:Math.sin(t*63)*.7,wind:1,tilt:-.12,shades:0,open:0,brow:-2,look:-.6,heat:0});
    p.be=[4,-10];p.bh=[12,-5];p.fe=[12,-11];p.fh=[16.5,-5.5];
    p.bk=[4,-1];p.bf=[2,11+sway(0,1)];p.fk=[10,-2];p.ff=[9,10+sway(1.7,1)];
  }else if(st==='win'){
    Object.assign(p,{wind:.6,tilt:.1+Math.sin(t*12)*.05,shades:1,open:1,brow:-1,heat:1});
    p.be=[-17,-29];p.bh=[-19+Math.sin(t*12)*2,-50+Math.cos(t*12)*1.5];p.fe=[16,-28];p.fh=[21+Math.sin(t*12+1)*2,-49+Math.cos(t*12+1)*1.5];
    const kick=Math.sin(t*10)*2.5;p.bk=[4,4];p.bf=[2+kick,14+sway(0,.6)];p.fk=[10,3];p.ff=[9-kick,13+sway(1.7,.6)];
  }else if(st==='chute'){                                  // hanging: hands on the straps, legs swinging loose
    const sw=Math.sin(t*2.4);
    Object.assign(p,{bob:Math.sin(t*2.4)*.8,wind:.35,tilt:.06+sw*.05,lag:Math.sin(t*2.4-.8)*.6,shades:1,open:.55+Math.sin(t*3)*.15,brow:-1,heat:.5});
    p.be=[-12,-35];p.bh=[-8,-53];p.fe=[13,-35];p.fh=[9,-53];
    p.bk=[-1,7+sw];p.bf=[-3+sw*2,17];p.fk=[6,7-sw];p.ff=[6-sw*2,17];p.bfa=.5;p.ffa=.45;
  }else{                                                   // fall: flailing
    const f=(a,b)=>Math.sin(t*a+b);
    Object.assign(p,{wind:1,tilt:f(7,0)*.25,shades:-1,open:1,brow:-2,look:0,heat:0});
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
/** A two-segment limb: outline stroke under a colour stroke, so joints stay round. With `low`, the forearm has another
    colour (short sleeves). */
function limb(c,a,b,d,w,col,low){
  c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(d[0],d[1]);
  c.strokeStyle=OL;c.lineWidth=w+3;c.stroke();c.lineWidth=w;
  if(low){c.strokeStyle=low;c.beginPath();c.moveTo(b[0],b[1]);c.lineTo(d[0],d[1]);c.stroke();          // bare forearm
    c.strokeStyle=col;c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();return}           // sleeve to the elbow
  c.strokeStyle=col;c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(d[0],d[1]);c.stroke();
}
function shoe(c,x,y,a,S){
  c.save();c.translate(x,y);c.rotate(a);
  part(c,()=>{c.moveTo(-3,-2.6);c.quadraticCurveTo(5.5,-4,6.5,.8);c.lineTo(6.5,1.6);c.lineTo(-3.4,1.6);c.closePath()},S.shoe,S.shoeSh||'#cfd0e6',()=>c.rect(-4,0,12,3),1.4);
  c.fillStyle=S.sole;c.fillRect(-3,1.1,9.2,1.1);c.restore();
}
/** A ribbon along a centreline, tapering from w0 to w1 (ties, hood strings). */
function ribbon(c,pts,w0,w1,fill,shade){
  const L=[],R=[];
  pts.forEach((p,i)=>{const q=pts[Math.min(i+1,pts.length-1)],o=pts[Math.max(i-1,0)],dx=q[0]-o[0],dy=q[1]-o[1],n=Math.hypot(dx,dy)||1,w=lerp(w0,w1,i/(pts.length-1))/2;
    L.push([p[0]-dy/n*w,p[1]+dx/n*w]);R.push([p[0]+dy/n*w,p[1]-dx/n*w])});
  const path=()=>{c.moveTo(L[0][0],L[0][1]);L.forEach(p=>c.lineTo(p[0],p[1]));const e=pts[pts.length-1];c.lineTo(e[0]-1,e[1]+1.5);for(let i=R.length-1;i>=0;i--)c.lineTo(R[i][0],R[i][1]);c.closePath()};
  part(c,path,fill,shade,()=>{c.moveTo(L[0][0],L[0][1]);L.forEach(p=>c.lineTo(p[0],p[1]));for(let i=pts.length-1;i>=0;i--)c.lineTo(pts[i][0],pts[i][1]);c.closePath()},1.3);
}
const dot=(c,x,y,r,col)=>{c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,TAU);c.fill()};
const line=(c,w,col,...pts)=>{c.strokeStyle=col;c.lineWidth=w;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)c.lineTo(pts[i],pts[i+1]);c.stroke()};
function star(c,x,y,s,col){c.fillStyle=col;c.beginPath();c.moveTo(x,y-s);c.lineTo(x+s*.3,y-s*.3);c.lineTo(x+s,y);c.lineTo(x+s*.3,y+s*.3);c.lineTo(x,y+s);c.lineTo(x-s*.3,y+s*.3);c.lineTo(x-s,y);c.lineTo(x-s*.3,y-s*.3);c.fill()}

/* ---------------- faces: shared eyes, brows and mouths ---------------- */
/** Two eyes at E = [[x,y,r],[x,y,r]]: blink, widen when scared, pupils follow p.look; brows above (angry tilts them). */
function eyes(c,p,t,F,E,o={}){
  const blink=!F.scared&&!F.fall&&((t+(o.seed||0))%3.4)<.13,wide=F.scared||F.fall?1.35:1;
  E.forEach(([x,y,r])=>{
    if(blink){line(c,1.3,OL,x-r,y,x,y+1.2,x+r,y);return}
    part(c,()=>c.ellipse(x,y,r*.85*wide,r*1.15*wide,0,0,TAU),o.white||'#fff',null,null,1.2);
    if(o.iris&&!F.scared&&!F.fall)dot(c,x+p.look*.8,y+.3,r*.62,o.iris);
    dot(c,x+p.look*.8,y+.3,F.scared||F.fall?r*.4:r*.55,OL);dot(c,x+p.look*.8+.45,y-.45,r*.2,'#fff')});
  const br=p.brow+(o.browY||0);
  E.forEach(([x,y,r],i)=>{const tilt=(o.angry?(i?1.6:-1.6):0)+(F.scared?(i?-1.2:1):0);
    line(c,o.browW||1.4,o.browCol||OL,x-r*.9,y-r*1.55+br+(i?0:-tilt*.5),x+r*.9,y-r*1.55+br+(i?tilt*.5:0))});
}
/** The mouth around (x,y) at scale s: closed smile, open grin (teeth + tongue) as excitement grows, "O" when scared. */
function mouth(c,p,t,F,x,y,s){
  c.save();c.translate(x,y);c.scale(s,s);c.translate(-7,-8);c.lineCap='round';
  if(F.scared||F.fall){const o=F.fall?2.8:2+Math.sin(t*30)*.4;part(c,()=>c.ellipse(7,9.5,o*.8,o,0,0,TAU),'#5a1020',null,null,1.2)}
  else if(p.open<.08&&!F.win){line(c,1.4,OL,3,7.6,7,9.8,11,7.4)}
  else{const d=2.5+p.open*3.2,lips=()=>{c.moveTo(1.8,7);c.quadraticCurveTo(7,8.2,12.2,6.4);c.quadraticCurveTo(10.5,7+d*1.3,6.5,7.6+d);c.quadraticCurveTo(2.5,7.6+d*.8,1.8,7);c.closePath()};
    part(c,lips,'#5a1020',null,null,1.3);
    c.save();c.beginPath();lips();c.clip();c.fillStyle='#fff';c.fillRect(1,5,12,2.9);c.fillStyle='#ff7a93';c.beginPath();c.ellipse(6.5,8+d,3.4,2.2,0,0,TAU);c.fill();c.restore()}
  c.restore();
}
function sweat(c,t,F,x,y){if(!F.scared)return;const k=(t*1.4)%1;c.globalAlpha=1-k;
  part(c,()=>{c.moveTo(x,y+k*8);c.quadraticCurveTo(x-2.4,y+5+k*8,x,y+6+k*8);c.quadraticCurveTo(x+2.4,y+5+k*8,x,y+k*8)},'#8fd8ff',null,null,1);c.globalAlpha=1}
/** A human head: skin ball, ear, nose; hair and the rest are drawn by the character. */
function humanHead(c,S){
  part(c,()=>c.ellipse(0,0,12.2,13.2,0,0,TAU),S.skin,S.skinSh,()=>c.ellipse(-7,6,10,11,0,0,TAU),1.7);
  part(c,()=>c.ellipse(-9,1.5,2.4,3.2,-.15,0,TAU),S.skin,S.skinSh,()=>c.ellipse(-9.6,2.4,1.8,2.6,0,0,TAU),1.3);   // the ear, towards the back
  part(c,()=>{c.moveTo(10.6,-1.5);c.quadraticCurveTo(14.6,2.2,11.2,3.6);c.closePath()},S.skin,null,null,1.2);
}

/* ---------------- torsos ---------------- */
function jacketTail(c,t,w,col){const tail=w*4+Math.sin(t*24)*1.2*w;
  part(c,()=>{c.moveTo(-8,-8);c.quadraticCurveTo(-12-tail,-4+Math.sin(t*20)*1.5*w,-11-tail*1.2,1);c.lineTo(-7,0);c.closePath()},col,null,null,1.3)}
function blazer(c,S){
  part(c,()=>rr(c,-9.5,-25,19,25.5,7),S.top,S.topSh,()=>c.rect(-11,-27,7,30),1.6);
  c.fillStyle=S.topLt;c.globalAlpha=.55;c.beginPath();c.ellipse(5,-20,2.2,4,-.3,0,TAU);c.fill();c.globalAlpha=1;
  part(c,()=>{c.moveTo(-4,-25);c.lineTo(0,-14.5);c.lineTo(4,-25);c.closePath()},S.shirt||'#f6f5ff',null,null,1.2);
  c.strokeStyle=OL;c.lineWidth=.9;[-9,-4].forEach(y=>{dot(c,1.5,y,1.1,S.button||'#ffd23f');c.beginPath();c.arc(1.5,y,1.1,0,TAU);c.stroke()});
}
function tie(c,t,w,col,sh){const tw=t*(22+w*12),tl=4+w*4.5;
  const pts=[0,1,2,3,4].map(i=>{const k=i/4;return[-k*tl*1.3+Math.sin(tw-k*3)*k*1.4*w,-21.5+k*(10-w*4.5)+Math.sin(tw*.8-k*2.5)*k*1.8*w]});
  ribbon(c,pts,4.6,3.2,col,sh);
  part(c,()=>{c.moveTo(-1.8,-24.2);c.lineTo(1.8,-24.2);c.lineTo(1.3,-20.8);c.lineTo(-1.3,-20.8);c.closePath()},col,null,null,1.1)}
function bowtie(c,t,w,col,sh){const f=Math.sin(t*(20+w*10))*.8*w;
  part(c,()=>{c.moveTo(0,-23);c.lineTo(-5,-26+f);c.lineTo(-5,-20+f);c.closePath();c.moveTo(0,-23);c.lineTo(5,-26-f*.5);c.lineTo(5,-20-f*.5);c.closePath()},col,sh,()=>c.rect(-6,-23,12,4),1.2);
  part(c,()=>c.arc(0,-23,1.4,0,TAU),sh,null,null,1)}
/** A plain top (tee or hoodie body). */
function plainTop(c,S){part(c,()=>rr(c,-9.5,-25,19,25.5,7),S.top,S.topSh,()=>c.rect(-11,-27,7,30),1.6)}
function hoodStrings(c,t,w,col){[-2.5,2.5].forEach((x,i)=>{const s=Math.sin(t*(16+w*10)+i)*1.6*w;line(c,2.4,OL,x,-23,x-1+s,-15);line(c,1.2,col,x,-23,x-1+s,-15);dot(c,x-1+s,-14.6,1,col)})}
function btcBadge(c,x,y,r,glow){if(glow){c.globalAlpha=.35*glow;dot(c,x,y,r*2.2,'#f7931a');c.globalAlpha=1}
  part(c,()=>c.arc(x,y,r,0,TAU),'#f7931a',null,null,1.1);c.fillStyle='#fff';c.font=`900 ${r*1.5}px Arial,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText('₿',x,y+.2)}

/* ---------------- the characters ---------------- */
const SHOES={shoe:'#f6f5ff',sole:'#2bff88'};
const C={};

/* Bear in shades (common): the bear the game was built around. */
C.bear={ru:'Медведь в очках',en:'Bear in shades',drop:'shades',
  S:{top:'#27306a',topSh:'#171d44',topLt:'#3b4a98',legs:'#27306a',legsSh:'#171d44',hand:'#d08f58',handSh:'#a0643a',...SHOES},
  torso(c,p,t,F,S){jacketTail(c,t,p.wind,S.topSh);blazer(c,S);tie(c,t,p.wind,'#ff3e5f','#c21f45')},
  head(c,p,t,F){
    const fur='#a0643a',furSh='#6f4122',ew=Math.sin(t*(12+p.wind*10))*.12*(.3+p.wind);
    [[-9,-10.5,-.35-ew],[9,-11.5,.3+ew]].forEach(([x,y,a])=>{c.save();c.translate(x,y);c.rotate(a);
      part(c,()=>c.arc(0,0,5.4,0,TAU),fur,furSh,()=>c.arc(-2,2,5.4,0,TAU),1.5);dot(c,.3,.4,2.7,'#eaa57a');c.restore()});
    part(c,()=>c.arc(0,0,13.6,0,TAU),fur,furSh,()=>c.arc(-8,6,12,0,TAU),1.7);
    c.fillStyle='rgba(255,236,210,.28)';c.beginPath();c.ellipse(5,-8.5,4,1.9,-.5,0,TAU);c.fill();
    const w=p.wind,tf=Math.sin(t*(18+w*14))*1.4*(.3+w);
    part(c,()=>{c.moveTo(-3,-12.8);c.quadraticCurveTo(-7-w*3,-17+tf,-11-w*4,-15.5+tf);c.quadraticCurveTo(-6,-14.5,-5.5,-12.4);
      c.quadraticCurveTo(-3,-18+tf*.6,-6.5-w*2,-19.5+tf*.8);c.quadraticCurveTo(-1,-18,0,-13.4);c.closePath()},fur,null,null,1.3);
    part(c,()=>c.ellipse(5.5,5,8.4,6.4,0,0,TAU),'#f3c992','#d9a46a',()=>c.ellipse(3,9,9,4,0,0,TAU),1.4);
    part(c,()=>c.ellipse(10.6,1.6,3.3,2.4,-.1,0,TAU),'#2a1512',null,null,1.1);dot(c,11.4,.8,.7,'rgba(255,255,255,.7)');
    if(p.shades<.95)eyes(c,p,t,F,[[.5,-3,2.6],[8,-3.4,2.9]]);
    mouth(c,p,t,F,7,8,1);sweat(c,t,F,-10,-6);
    if(p.shades>-.3){const s=clamp(p.shades,0,1),sy=lerp(-11.5,-4.2,s),sa=lerp(-.22,0,s);   // shades: forehead -> eyes
      c.save();c.translate(4.3,sy);c.rotate(sa);line(c,1.6,OL,-1.5,0,1.2,0);
      [-5.3,5.3].forEach(x=>{part(c,()=>rr(c,x-4.6,-2.9,9.2,6,2.4),'#0b1320',null,null,1.5);
        c.strokeStyle='#2bff88';c.lineWidth=.9;rr(c,x-3.9,-2.2,7.8,4.6,1.9);c.stroke();line(c,1,'rgba(255,255,255,.55)',x-2.4,1.2,x+.6,-1.4)});
      c.restore()}
  }};

/* Bull with a nose ring (common): gold chain, the ring swings, steam from the nostrils as it heats up. */
C.bull={ru:'Бык с кольцом',en:'Bull with a ring',drop:'horn',
  S:{top:'#1b1b26',topSh:'#0f0f17',topLt:'#34344a',legs:'#1b1b26',legsSh:'#0f0f17',hand:'#3a2418',handSh:'#22140d',shoe:'#1d1d22',shoeSh:'#0e0e12',sole:'#ffd23f'},
  torso(c,p,t,F,S){jacketTail(c,t,p.wind,S.topSh);blazer(c,{...S,button:'#ffd23f'});
    c.strokeStyle='#ffd23f';c.lineWidth=1.6;c.setLineDash([1.6,1.2]);c.beginPath();c.arc(0,-24,7.5,.35,Math.PI-.35);c.stroke();c.setLineDash([]);dot(c,0,-16.5,1.8,'#ffd23f')},
  head(c,p,t,F){
    const hide='#6b4129',hideSh='#4b2b1a',horn='#f1e6c8';
    part(c,()=>{c.moveTo(-5,-9);c.quadraticCurveTo(-15,-9,-14,-21);c.quadraticCurveTo(-11,-14,-1,-11.5);c.closePath()},horn,'#cdbf99',()=>c.rect(-16,-16,8,8),1.4);
    part(c,()=>{c.moveTo(4,-11);c.quadraticCurveTo(14,-12,14.5,-23);c.quadraticCurveTo(10,-15,8.5,-9.5);c.closePath()},horn,'#cdbf99',()=>c.rect(8,-18,8,8),1.4);
    const ew=Math.sin(t*(10+p.wind*8))*.15*(.3+p.wind);
    c.save();c.translate(-12,-4);c.rotate(-.5-ew);part(c,()=>c.ellipse(0,0,5,2.6,0,0,TAU),hide,hideSh,()=>c.rect(-6,0,12,4),1.3);c.restore();
    part(c,()=>c.ellipse(0,-1,12.5,13,0,0,TAU),hide,hideSh,()=>c.ellipse(-7,5,10,11,0,0,TAU),1.7);
    line(c,1.4,'rgba(255,255,255,.18)',2,-11,6,-12.5);
    part(c,()=>c.ellipse(6.5,5.5,9.5,6.8,0,0,TAU),'#d49b75','#b97f5a',()=>c.ellipse(4,10,10,4,0,0,TAU),1.4);
    dot(c,3.6,4.2,1.5,'#3a1f14');dot(c,10,4,1.5,'#3a1f14');
    const sw=Math.sin(t*(9+p.wind*6))*.35*(.3+p.wind)+(F.fall?Math.sin(t*20)*.6:0);   // the ring swings with the flight
    c.save();c.translate(6.8,5.4);c.rotate(sw);line(c,3,OL,-3,0,-3,1.5);c.beginPath();c.arc(0,2.6,3,0,Math.PI);c.lineWidth=3;c.strokeStyle=OL;c.stroke();
    c.beginPath();c.arc(0,2.6,3,0,Math.PI);c.lineWidth=1.5;c.strokeStyle='#ffd23f';c.stroke();c.restore();
    eyes(c,p,t,F,[[-1,-4.5,2.4],[7,-4.8,2.6]],{angry:!F.scared});
    mouth(c,p,t,F,6.5,10.5,.7);sweat(c,t,F,-11,-6);
    if(p.heat>.45&&!F.scared&&!F.fall)for(let i=0;i<3;i++){const k=((t*2.2)+i/3)%1;c.globalAlpha=(1-k)*.75;   // steam
      dot(c,2-k*14,5-k*3-Math.sin(k*6)*1.5,1.2+k*3.2,'#f2f0ff');dot(c,9-k*12,5-k*4,1+k*2.6,'#f2f0ff')}c.globalAlpha=1;
  }};

/* Whale in a bow tie (common): the spout gushes higher the higher the multiplier. */
C.whale={ru:'Кит в бабочке',en:'Whale in a bow tie',drop:'none',
  S:{top:'#1f2a52',topSh:'#141b38',topLt:'#33427d',legs:'#1f2a52',legsSh:'#141b38',hand:'#3f8bf0',handSh:'#2458c9',...SHOES,
    handShape:'fin'},
  torso(c,p,t,F,S){jacketTail(c,t,p.wind,S.topSh);blazer(c,{...S,shirt:'#f6f5ff'});bowtie(c,t,p.wind,'#ff3e5f','#c21f45')},
  head(c,p,t,F){
    const blue='#3f8bf0',sh='#2458c9';
    const h=(F.fall?2:4+p.heat*12)+Math.sin(t*14)*1.5;                    // the spout
    if(!F.scared){for(let i=0;i<9;i++){const k=((t*1.8)+i/9)%1,side=i%3-1;const x=-1+side*k*6,y=-14-Math.sin(k*Math.PI)*h-k*2;c.globalAlpha=.9*(1-k*.6);
      dot(c,x,y,1.4-k*.5,'#8fd8ff')}c.globalAlpha=1;line(c,2,'#8fd8ff',-1,-12.5,-1,-14-h*.7)}
    part(c,()=>c.ellipse(2,-1,14,13,0,0,TAU),blue,sh,()=>c.ellipse(-6,6,12,10,0,0,TAU),1.7);
    part(c,()=>{c.moveTo(-4,6);c.quadraticCurveTo(5,12.5,15.6,2);c.quadraticCurveTo(8,9.5,-4,6)},'#cfe3ff',null,null,1.1);
    for(let i=0;i<3;i++)line(c,.8,'rgba(36,88,201,.55)',2+i*3,8.4-i*.3,4+i*3,6.2-i*.4);
    line(c,1.2,'rgba(255,255,255,.35)',-3,-10,3,-12);
    eyes(c,p,t,F,[[4,-3,2.3],[10.5,-3.4,2.5]],{seed:1.1});
    dot(c,12,2.6,1.9,'rgba(255,90,150,.35)');
    mouth(c,p,t,F,8.2,6.3,.85);sweat(c,t,F,-10,-7);
  }};

/* Basic cryptan (common): a guy in a ₿ hoodie, hair everywhere. */
C.cryptan={ru:'Базовый криптан',en:'Basic cryptan',drop:'none',
  S:{top:'#2bbf7a',topSh:'#1d8a57',legs:'#2a3b6b',legsSh:'#1c2850',hand:'#f2c39b',handSh:'#d79e74',skin:'#f2c39b',skinSh:'#d79e74',...SHOES},
  torso(c,p,t,F,S){
    part(c,()=>{c.moveTo(-9,-24);c.quadraticCurveTo(-13,-30,-5,-29);c.lineTo(4,-26);c.closePath()},S.topSh,null,null,1.3);   // the hood, down
    plainTop(c,S);part(c,()=>rr(c,-5,-11,11,6,2.5),S.topSh,null,null,1);btcBadge(c,1,-17,3.1,0);hoodStrings(c,t,p.wind,'#f6f5ff')},
  head(c,p,t,F,S){
    humanHead(c,S);const w=p.wind,hw=Math.sin(t*(16+w*12))*1.5*(.3+w);
    part(c,()=>{c.moveTo(-12,2);c.quadraticCurveTo(-15,-12,-4,-15);c.quadraticCurveTo(3,-18,9,-12);c.quadraticCurveTo(13,-9,11,-6);c.quadraticCurveTo(6,-10,3,-7);
      c.quadraticCurveTo(0,-11,-4,-7);c.quadraticCurveTo(-7,-7,-8,-2);c.closePath()},'#3b2a20','#2a1d15',()=>c.rect(-16,-5,10,8),1.5);
    for(let i=0;i<3;i++)part(c,()=>{c.moveTo(-4+i*4,-14);c.quadraticCurveTo(-8+i*4-w*3,-19+hw,-11+i*3-w*4,-18+hw);c.quadraticCurveTo(-7+i*4,-16,-1+i*4,-14.6);c.closePath()},'#3b2a20',null,null,1.2);
    eyes(c,p,t,F,[[2.4,-2,2.2],[8.6,-2.3,2.3]],{iris:'#5a3b26',seed:.7,browW:1.6,browCol:'#2a1d15'});
    mouth(c,p,t,F,7.5,6.6,.75);sweat(c,t,F,-10,-5);
  }};

/* Kim Jong Un (rare): Mao suit, flat-top, a remote with a big red button he presses as the multiplier climbs. */
C.kim={ru:'Ким Чен Ын',en:'Kim Jong Un',drop:'none',
  S:{top:'#3c3f37',topSh:'#262823',legs:'#3c3f37',legsSh:'#262823',hand:'#f3d0a8',handSh:'#d9ae82',skin:'#f3d0a8',skinSh:'#d9ae82',shoe:'#18181c',shoeSh:'#0c0c0f',sole:'#2b2b33'},
  pose(p,st,m,t){if(st==='fly'||st==='pad'){const press=m>.35||st==='pad'?(Math.sin(t*7)>.55?1:0):0;
    p.be=[6,-12];p.bh=[14.5,-10.5+press*1.6];p.press=press;p.fh=[16.5,-5]}},
  torso(c,p,t,F,S){plainTop(c,S);
    part(c,()=>rr(c,-5,-26.5,10,3.4,1.2),S.top,S.topSh,()=>c.rect(-6,-25,12,2),1.2);                 // band collar
    for(let y=-21;y<=-3;y+=6){dot(c,0,y,1.1,'#c9b26b')}line(c,.9,OL,0,-23,0,-1);
    [[-6.5,-17],[3.5,-17],[-6.5,-7],[3.5,-7]].forEach(([x,y])=>{c.strokeStyle=S.topSh;c.lineWidth=1;c.strokeRect(x,y,4,3.6)})},
  head(c,p,t,F,S){
    humanHead(c,S);
    part(c,()=>{c.moveTo(-12.5,-2);c.quadraticCurveTo(-13.5,-13,-6,-15.6);c.lineTo(8,-15.6);c.quadraticCurveTo(12,-14,11.5,-8);c.quadraticCurveTo(4,-11.5,-4,-10);
      c.quadraticCurveTo(-8,-9,-8.5,-3);c.closePath()},'#141418','#000',()=>c.rect(-15,-8,9,8),1.5);
    c.fillStyle='rgba(20,20,24,.35)';c.beginPath();c.ellipse(-8.5,-1,3.4,4.6,0,0,TAU);c.fill();         // shaved sides
    dot(c,10.5,3.5,2.2,'rgba(255,120,120,.25)');
    eyes(c,p,t,F,[[2.6,-2.2,1.9],[8.6,-2.4,2]],{seed:.4,browW:2,browCol:'#141418',angry:p.heat>.6&&!F.scared});
    mouth(c,p,t,F,7.6,6.6,.72);sweat(c,t,F,-10,-5);
  },
  front(c,p,t,F){const [x,y]=p.fh;if(F.fall)return;                                                   // the remote
    c.save();c.translate(x+2,y-1.5);part(c,()=>rr(c,-5,-3,10,6.5,1.6),'#2c2f38','#1c1e25',()=>c.rect(-6,1,12,4),1.3);
    const on=(p.press||0)>.5||F.scared;if(on){c.globalAlpha=.5;dot(c,0,-3.2,6,'#ff2b4a');c.globalAlpha=1}
    part(c,()=>c.ellipse(0,-3.4,3.4,on?1.5:2.6,0,Math.PI,TAU),on?'#ff5a6e':'#e8203c',null,null,1.2);c.restore()}};

/* Crying Wojak (rare): cashed out too early - and cries harder when he wins. */
C.wojak={ru:'Плачущий Wojak',en:'Crying Wojak',drop:'none',
  S:{top:'#8b90a3',topSh:'#6c7085',legs:'#3d4258',legsSh:'#2a2e40',hand:'#f4efe6',handSh:'#d9d1c4',skin:'#f4efe6',skinSh:'#d9d1c4',...SHOES},
  torso(c,p,t,F,S){plainTop(c,S);c.fillStyle='#e8203c';c.font='900 4.6px Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('SOLD',.5,-15)},
  head(c,p,t,F,S){
    humanHead(c,S);
    line(c,1,'rgba(0,0,0,.25)',-2,-11,4,-12);
    const cry=F.win?1:F.scared||F.fall?.8:.45+p.heat*.3;
    // sad shut eyes and brows pulled up in the middle
    [[2.4,-2.2],[8.8,-2.5]].forEach(([x,y],i)=>{line(c,1.4,OL,x-2.2,y+.6,x,y-.6,x+2.2,y+.6);line(c,1.4,OL,x-2.4,y-4.2+(i?-1.2:0),x+2.4,y-4.2+(i?0:-1.2))});
    for(const x of [2.4,8.8]){const flow=4+cry*7;c.globalAlpha=.85;line(c,1.6,'#5fb8ff',x,-1,x-.6,-1+flow);c.globalAlpha=1;   // tears
      for(let i=0;i<2;i++){const k=((t*(1.5+cry))+i*.5+x)%1;dot(c,x-.6-k*2,-1+flow+k*7,1.1,'#5fb8ff')}}
    if(F.win||F.scared||F.fall){part(c,()=>c.ellipse(7.4,6.8,3,2+Math.sin(t*22)*.5,0,0,TAU),'#5a1020',null,null,1.2)}
    else{c.strokeStyle=OL;c.lineWidth=1.3;c.beginPath();for(let i=0;i<=6;i++){const x=4+i,y=7.4+Math.sin(t*18+i)*.45-(i>0&&i<6?.7:0);/* trembling frown */i?c.lineTo(x,y):c.moveTo(x,y)}c.stroke()}
  }};

/* Hamster tapper (rare): business suit, briefcase, never stops tapping. */
C.hamster={ru:'Хомяк-тапальщик',en:'Hamster tapper',drop:'none',
  S:{top:'#4a4f63',topSh:'#33374a',topLt:'#62688a',legs:'#4a4f63',legsSh:'#33374a',hand:'#f0a95a',handSh:'#c67c33',...SHOES},
  pose(p,st,m,t){if(st==='fly'||st==='pad'){const tap=Math.max(0,Math.sin(t*18));p.fh=[16.5,-7.5+tap*2.6];p.tap=tap;
    if(m<.45||st==='pad'){p.be=[-10,-9];p.bh=[-9,-2]}}},
  torso(c,p,t,F,S){jacketTail(c,t,p.wind,S.topSh);blazer(c,S);tie(c,t,p.wind,'#3b7bff','#2453c4')},
  back(c,p,t,F){if(F.fall)return;const [x,y]=p.bh,sw=Math.sin(t*5)*.18;                               // briefcase
    c.save();c.translate(x,y+2);c.rotate(sw);line(c,1.4,OL,-2,0,-2,-1.6,2,-1.6,2,0);
    part(c,()=>rr(c,-6,0,12,8,1.6),'#7a4a24','#5a3519',()=>c.rect(-7,4,14,5),1.3);dot(c,0,2.4,.9,'#ffd23f');c.restore()},
  head(c,p,t,F){
    const fur='#f0a95a',furSh='#c67c33';
    [[-7,-11.5],[6,-12.5]].forEach(([x,y])=>{part(c,()=>c.arc(x,y,3.6,0,TAU),fur,furSh,()=>c.arc(x-1.5,y+1.5,3.6,0,TAU),1.4);dot(c,x+.3,y+.3,1.7,'#ffb0a8')});
    part(c,()=>c.ellipse(0,0,12.8,12.6,0,0,TAU),fur,furSh,()=>c.ellipse(-8,6,10,10,0,0,TAU),1.7);
    const puff=1+Math.sin(t*3)*.04;
    part(c,()=>{c.ellipse(1,6.5,6.2*puff,5.4*puff,0,0,TAU);c.moveTo(16.8,5.5);c.ellipse(10.8,5.5,6*puff,5.2*puff,0,0,TAU)},'#fff1dc','#ecd2ad',()=>c.rect(-6,8,24,6),1.3);
    part(c,()=>rr(c,6.4,6.6,3.4,3.4,.8),'#fff',null,null,1);line(c,.7,OL,8.1,6.8,8.1,9.8);
    part(c,()=>c.ellipse(8.4,3.4,1.9,1.4,0,0,TAU),'#ff8a9a',null,null,1);
    [[3,4.6,-5,3],[3,6.4,-5.5,7],[13,4.6,18.5,3],[13,6.4,18.5,7]].forEach(([a,b,x,y])=>line(c,.6,'rgba(20,10,38,.6)',a,b,x,y));
    eyes(c,p,t,F,[[1.8,-2.5,2.6],[8.4,-2.8,2.7]],{seed:2.2});
    if(F.scared||F.fall)mouth(c,p,t,F,8,12,.55);
    sweat(c,t,F,-11,-5);
  },
  front(c,p,t,F){if(!p.tap||F.fall||F.scared)return;const k=(t*1.6)%1;c.globalAlpha=1-k;                       // +1 per tap
    c.fillStyle='#ffd23f';c.font='900 5px Arial,sans-serif';c.textAlign='center';c.fillText('+1',22+k*3,-14-k*10);c.globalAlpha=1}};

/* Pavel Durov (epic): all in black, paper planes take off when he gets going. */
C.durov={ru:'Павел Дуров',en:'Pavel Durov',drop:'none',
  S:{top:'#17171d',topSh:'#0b0b0f',legs:'#17171d',legsSh:'#0b0b0f',hand:'#eed3bd',handSh:'#d4b096',skin:'#eed3bd',skinSh:'#d4b096',sleeveLow:'#eed3bd',shoe:'#f6f5ff',sole:'#29a9eb'},
  torso(c,p,t,F,S){plainTop(c,S);
    c.save();c.translate(1,-15);c.fillStyle='#fff';c.beginPath();c.moveTo(-4,0);c.lineTo(4.5,-3.5);c.lineTo(1.5,3.6);c.lineTo(.2,1);c.closePath();c.fill();
    c.fillStyle='#cfe8ff';c.beginPath();c.moveTo(.2,1);c.lineTo(4.5,-3.5);c.lineTo(.9,2.6);c.closePath();c.fill();c.restore()},
  head(c,p,t,F,S){
    humanHead(c,S);
    part(c,()=>{c.moveTo(-12.4,0);c.quadraticCurveTo(-13.4,-12,-3,-14.4);c.quadraticCurveTo(7,-15.6,11.6,-8.5);c.quadraticCurveTo(6,-10.8,1,-9.6);
      c.quadraticCurveTo(-5,-9,-8,-3);c.closePath()},'#2a211d','#1a1411',()=>c.rect(-15,-6,9,8),1.4);
    c.fillStyle='rgba(60,50,45,.16)';c.beginPath();c.ellipse(6,8,7,4.5,0,0,TAU);c.fill();                // stubble
    eyes(c,p,t,F,[[2.6,-2.3,2.1],[8.8,-2.6,2.2]],{iris:'#3d6f9e',seed:.9,browCol:'#2a211d'});
    if(!F.scared&&!F.fall&&p.open<.3){line(c,1.3,OL,4.8,7.4,8,8.2,10.6,6.6)}else mouth(c,p,t,F,7.6,6.6,.72);   // a calm half-smile
    sweat(c,t,F,-10,-5);
  },
  front(c,p,t,F){if(F.fall||F.scared||p.heat<.5)return;                                                  // paper planes
    for(let i=0;i<2;i++){const k=((t*.8)+i*.5)%1,x=18+k*26,y=-30-k*24+Math.sin(k*9+i)*3;c.globalAlpha=1-k*.6;
      c.save();c.translate(x,y);c.rotate(-.5);c.fillStyle='#fff';c.strokeStyle=OL;c.lineWidth=.9;c.beginPath();c.moveTo(-4,0);c.lineTo(5,-3);c.lineTo(1.5,3.5);c.closePath();c.fill();c.stroke();c.restore()}
    c.globalAlpha=1}};

/* Elon Musk (epic): black "TO THE MARS" tee and a flamethrower that fires as the rocket speeds up. */
C.musk={ru:'Илон Маск',en:'Elon Musk',drop:'none',
  S:{top:'#141418',topSh:'#09090c',legs:'#262a38',legsSh:'#181b26',hand:'#f1cfb0',handSh:'#d6a888',skin:'#f1cfb0',skinSh:'#d6a888',sleeveLow:'#f1cfb0',shoe:'#1b1b20',shoeSh:'#0c0c0f',sole:'#e8203c'},
  pose(p,st){if(st==='fly'||st==='pad')p.fh=[17,-8]},
  torso(c,p,t,F,S){plainTop(c,S);dot(c,5.5,-19,2,'#e0533a');
    c.fillStyle='#fff';c.font='900 3.1px Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('TO THE',-.5,-16.6);c.fillText('MARS',-.5,-12.8)},
  head(c,p,t,F,S){
    humanHead(c,S);const w=p.wind,hw=Math.sin(t*(14+w*10))*1.2*(.3+w);
    part(c,()=>{c.moveTo(-12.6,1);c.quadraticCurveTo(-14,-12,-4,-14.8);c.quadraticCurveTo(6,-17,12,-10+hw*.3);c.quadraticCurveTo(13.5,-6,10.5,-6.5);
      c.quadraticCurveTo(6,-10,0,-9);c.quadraticCurveTo(-6,-8.5,-8.4,-2);c.closePath()},'#3a2a22','#251a15',()=>c.rect(-15,-6,9,8),1.4);
    eyes(c,p,t,F,[[2.6,-2.3,2.1],[8.8,-2.6,2.2]],{iris:'#5e7d4a',seed:1.7,browCol:'#2a1d18'});
    mouth(c,p,t,F,7.6,6.6,.72);sweat(c,t,F,-10,-5);
  },
  front(c,p,t,F){if(F.fall)return;const [x,y]=p.fh;                                                      // flamethrower
    c.save();c.translate(x,y);c.rotate(-.25);
    part(c,()=>{rr(c,-6,-2.6,15,5.2,1.6);c.rect(9,-1.6,5,3.2)},'#4b4f5c','#30333d',()=>c.rect(-7,0,24,4),1.3);
    part(c,()=>rr(c,-4,2,3.4,5,1),'#30333d',null,null,1);
    const fire=(F.win?1:clamp((p.heat-.45)/.3,0,1));
    if(fire>0&&!F.scared){for(let i=0;i<7;i++){const k=((t*5)+i/7)%1,len=(10+fire*16)*k;c.globalAlpha=(1-k)*.95;
      dot(c,15+len,Math.sin(t*30+i)*k*2.2,(1.4+k*3.8)*fire,['#fff3b0','#ffd23f','#ff7a1a','#ff3e5f'][Math.min(3,Math.floor(k*4))])}c.globalAlpha=1}
    c.restore()}};

/* Satoshi Nakamoto (legendary): a hooded anonym with a glitching pixel face and a glowing ₿. */
C.satoshi={ru:'Сатоши Накамото',en:'Satoshi Nakamoto',drop:'none',
  S:{top:'#2a2c38',topSh:'#1a1b24',legs:'#1e2029',legsSh:'#121319',hand:'#3a3d4c',handSh:'#262833',...SHOES,sole:'#f7931a'},
  torso(c,p,t,F,S){plainTop(c,S);part(c,()=>rr(c,-5,-11,11,6,2.5),S.topSh,null,null,1);
    btcBadge(c,1,-17,3.3,.5+Math.sin(t*3)*.5);hoodStrings(c,t,p.wind,'#8a8fa3')},
  head(c,p,t,F){
    const hood='#2a2c38',hoodSh='#1a1b24',w=p.wind;
    part(c,()=>{c.moveTo(-14,8);c.quadraticCurveTo(-17,-10,-6-w*3,-18+Math.sin(t*12)*.8*w);c.quadraticCurveTo(6,-18,13,-8);c.quadraticCurveTo(16,2,11,12);c.quadraticCurveTo(0,15,-14,8);c.closePath()},hood,hoodSh,()=>c.rect(-18,-2,12,16),1.7);
    const face=()=>c.ellipse(5,1.5,8.2,9.6,0,0,TAU);
    part(c,face,'#06060b',null,null,1.4);
    c.save();c.beginPath();face();c.clip();
    const fr=Math.floor(t*14),glitch=hash(fr,7)>.82?(hash(fr,9)-.5)*4:0;                             // the glitch face
    for(let gx=0;gx<9;gx++)for(let gy=0;gy<10;gy++){const v=hash(gx*13+gy,fr%40);if(v<.72)continue;
      const off=gy>3&&gy<6?glitch:0;c.fillStyle=v>.95?'#ff3ea5':v>.88?'#29e6ff':'#2bff88';c.globalAlpha=.25+v*.5;c.fillRect(-3+gx*2+off,-8+gy*2,1.8,1.8)}
    c.globalAlpha=1;const col=F.scared||F.fall?'#ff3b6b':F.win?'#ffd23f':'#2bff88',blink=!F.scared&&(t%3.1)<.12;
    if(!blink)[[2,-1.5],[8,-1.5]].forEach(([x,y])=>{c.fillStyle=col;c.fillRect(x-1.5+glitch*.5,y-1.5,3,F.scared?4:3)});
    c.fillStyle=col;const mw=F.scared||F.fall?3:4+p.open*3;c.fillRect(5-mw/2+glitch,5.2,mw,F.scared||F.fall||p.open>.3?2.6:1.3);
    c.restore();
  }};

/* ---------------- one renderer for all ---------------- */
function hand(c,x,y,r,S){
  if(S.handShape==='fin'){part(c,()=>c.ellipse(x,y,r*1.25,r*.8,-.6,0,TAU),S.hand,S.handSh,()=>c.ellipse(x-1,y+1,r,r*.6,-.6,0,TAU),1.3);return}
  part(c,()=>c.arc(x,y,r,0,TAU),S.hand,S.handSh,()=>c.arc(x-1.2,y+1.2,r,0,TAU),1.4)}
// face: which expression set wins (the dominant state), the pose supplies the amounts
function render(c,p,t,face,X){
  const S=X.S,F={scared:face==='scared',fall:face==='fall',win:face==='win'||face==='chute',chute:face==='chute'};
  c.save();c.translate(p.shiver,p.bob);
  limb(c,[-3,-2],p.bk,p.bf,5.2,S.legsSh);shoe(c,p.bf[0],p.bf[1],p.bfa,S);                            // back leg
  limb(c,[-6,-19],p.be,p.bh,4.6,S.topSh,S.sleeveLow&&S.handSh);hand(c,p.bh[0],p.bh[1],3.3,S);            // back arm
  if(X.back)X.back(c,p,t,F);
  X.torso(c,p,t,F,S);
  limb(c,[4,-2],p.fk,p.ff,5.4,S.legs);shoe(c,p.ff[0],p.ff[1],p.ffa,S);                                 // front leg
  c.save();c.translate(1,-37+p.lag-p.bob*.3);c.rotate(p.tilt);X.head(c,p,t,F,S);c.restore();            // head, a beat behind
  limb(c,[6,-19],p.fe,p.fh,4.8,S.top,S.sleeveLow);hand(c,p.fh[0],p.fh[1],3.5,S);                        // front arm
  if(X.front)X.front(c,p,t,F);
  if(face==='win')for(let i=0;i<3;i++){const k=(t*1.3+i/3)%1;star(c,[-20,20,0][i],[-52,-50,-62][i]-k*6,(1-Math.abs(k*2-1))*3.2,['#ffd23f','#2bff88','#29e6ff'][i])}
  c.restore();
}
function poseFor(X,st,m,t){const p=poseOf(st,m,t);if(X.pose)X.pose(p,st,m,t);return p}

/* ---------------- characters drawn from an image kit ----------------
   A kit is a set of transparent images made by an image generator (art/<id>/: four heads, torso, upper arm, forearm
   with an open hand and with a fist, thigh, lower leg with the shoe, a prop) plus the points where the parts join.
   The skeleton is the same as above: arms and legs are placed by two-bone IK from the pose's hand and foot targets
   (each kit has its own proportions), the head swaps expressions with the moment of the round. Until the images
   have loaded, the character is drawn with the vector version. */
const ART=(document.currentScript&&document.currentScript.src||'').replace(/[^/]*(\?.*)?$/,'')+'art/';
const KIT_FILES=['head-calm','head-hype','head-scared','head-win','torso','arm-upper','arm-open','arm-fist','leg-upper','leg-lower','item'];
function loadKit(K,id){
  K.img={};K.ready=false;let n=0;const files=KIT_FILES.filter(f=>f!=='item'||K.item);
  files.forEach(f=>{const im=new Image();im.decoding='async';im.onload=()=>{if(++n===files.length){K.ready=true;window.dispatchEvent(new CustomEvent('cr:kit',{detail:id}))}};im.src=ART+id+'/'+f+'.webp';K.img[f]=im});
}
/** Draw image part `im` so that its points a and b (px) land on skeleton points A and B; `w` = units per px across the
    part; `trim` = px cut off at each end along the axis (the hollow joint openings). */
function seg(c,im,a,b,A,B,w,trim){
  const dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy)||1e-3,ix=b[0]-a[0],iy=b[1]-a[1],il=Math.hypot(ix,iy);
  c.save();c.translate(A[0],A[1]);c.rotate(Math.atan2(dy,dx));c.scale(L/il,w);
  if(trim){c.beginPath();c.rect(trim[0],-1e4,il-trim[0]-trim[1],2e4);c.clip()}
  c.rotate(-Math.atan2(iy,ix));c.translate(-a[0],-a[1]);c.drawImage(im,0,0);c.restore();
}
/** Two-bone IK: elbow/knee for a limb from S towards target H with segment lengths l1, l2, bent to the side of hint. */
function ik(S,H,l1,l2,hint){
  let dx=H[0]-S[0],dy=H[1]-S[1],d=Math.hypot(dx,dy)||1e-6;const max=(l1+l2)*.995,min=Math.abs(l1-l2)+.5;
  if(d>max||d<min){const k=d>max?max/d:min/d;H=[S[0]+dx*k,S[1]+dy*k];dx=H[0]-S[0];dy=H[1]-S[1];d=Math.hypot(dx,dy)}
  const a=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-a*a)),mx=S[0]+dx*a/d,my=S[1]+dy*a/d;
  const e1=[mx-dy*h/d,my+dx*h/d],e2=[mx+dy*h/d,my-dx*h/d],D=e=>(e[0]-hint[0])**2+(e[1]-hint[1])**2;
  return{E:D(e1)<=D(e2)?e1:e2,H};
}
function renderKit(c,p,t,face,X){
  const K=X.K,I=K.img,F={scared:face==='scared',fall:face==='fall',win:face==='win'||face==='chute',chute:face==='chute'};
  const off=(P,from,to)=>[P[0]+to[0]-from[0],P[1]+to[1]-from[1]];   // move a pose point with the shoulder/hip it hangs from
  c.save();c.translate(p.shiver,p.bob);if(K.scale)c.scale(K.scale,K.scale);
  const arm=(sh,dsh,el,hd,open)=>{const r=ik(sh,off(hd,dsh,sh),K.arm.l1,K.arm.l2,off(el,dsh,sh)),H=r.H;
    const fa=open?K.arm.open:K.arm.fist;seg(c,I[open?'arm-open':'arm-fist'],fa.a,fa.b,r.E,H,K.arm.w,[fa.trim,0]);
    seg(c,I['arm-upper'],K.arm.up.a,K.arm.up.b,sh,r.E,K.arm.w,K.arm.up.trim)};
  const leg=(hip,dh,kn,ft)=>{const r=ik(hip,off(ft,dh,hip),K.leg.l1,K.leg.l2,off(kn,dh,hip));
    seg(c,I['leg-lower'],K.leg.low.a,K.leg.low.b,r.E,r.H,K.leg.w,[K.leg.low.trim,0]);
    seg(c,I['leg-upper'],K.leg.up.a,K.leg.up.b,hip,r.E,K.leg.w,K.leg.up.trim)};
  const open=F.win||F.fall;
  leg(K.hipB,[-3,-2],p.bk,p.bf);arm(K.shB,[-6,-19],p.be,p.bh,open);
  seg(c,I.torso,K.torso.a,K.torso.b,K.torso.A,K.torso.B,K.torso.w);
  leg(K.hipF,[4,-2],p.fk,p.ff);
  const ex=F.scared||F.fall?'head-scared':F.win?'head-win':p.heat>.55?'head-hype':'head-calm',hd=I[ex],hk=K.head;
  c.save();c.translate(hk.at[0],hk.at[1]+p.lag-p.bob*.3);c.rotate(p.tilt);c.scale(hk.s,hk.s);c.drawImage(hd,-hk.n[0],-hk.n[1]);c.restore();
  if(X.prop&&!F.fall&&!F.chute)X.prop(c,p,t,F,K);            // on the parachute both hands hold the straps
  arm(K.shF,[6,-19],p.fe,p.fh,open||F.chute);
  if(face==='win')for(let i=0;i<3;i++){const k=(t*1.3+i/3)%1;star(c,[-22,22,0][i],[-58,-56,-66][i]-k*6,(1-Math.abs(k*2-1))*3.2,['#ffd23f','#2bff88','#29e6ff'][i])}
  c.restore();
}
const pick=(X,c,p,t,face)=>X.K&&X.K.ready?renderKit(c,p,t,face,X):render(c,p,t,face,X);

/** A character that remembers its pose: state changes blend over ~0.25 s (shades ~0.4 s). */
function makeRig(X){
  const w={fly:1};let sh=null,face='fly';
  return{draw(c,mood,t,st,dt){
    st=STATES.includes(st)?st:'fly';const m=clamp(mood,0,1);dt=clamp(dt||0,0,.1);
    const a=1-Math.exp(-dt*11);
    for(const s of STATES)w[s]=(w[s]||0)+((s===st?1:0)-(w[s]||0))*a;
    const sum=STATES.reduce((q,s)=>q+w[s],0)||1,p=mix(STATES.filter(s=>w[s]>.002).map(s=>[poseFor(X,s,m,t),w[s]/sum]));
    sh=sh===null?p.shades:sh+(p.shades-sh)*(1-Math.exp(-dt*7));p.shades=sh;
    face=STATES.reduce((b,s)=>w[s]>w[b]?s:b,st);
    pick(X,c,p,t,face)}};
}
const stateless=X=>(c,mood,t,st)=>{st=STATES.includes(st)?st:'fly';pick(X,c,poseFor(X,st,clamp(mood,0,1),t),t,st)};

/* Kits: where the parts join (px in the half-size images of art/<id>/), how big they are (units per px) and the
   limb lengths. Measured on the images made with the kit brief. */
C.musk.K={
  torso:{a:[150,15],b:[150,232],A:[.5,-24],B:[0,-1],w:.084},
  shB:[-10,-13.5],shF:[10,-13.5],hipB:[-4.5,-2],hipF:[4.5,-2],
  head:{n:[117,280],s:.116,at:[.5,-23]},
  arm:{l1:10.5,l2:11,w:.1,up:{a:[28,20],b:[80,178],trim:[16,14]},open:{a:[28,22],b:[90,165],trim:16},fist:{a:[22,22],b:[65,168],trim:16}},
  leg:{l1:10,l2:12,w:.09,up:{a:[23,22],b:[55,235],trim:[16,12]},low:{a:[48,15],b:[65,220],trim:14}},
  item:true,scale:1.15,chute:{y:-106,l:[-11.5,-41.5],r:[11.5,-41.5]},thumb:.7};
C.musk.prop=(c,p,t,F,K)=>{const [x,y]=p.fh;c.save();c.translate(x,y);c.rotate(-.12);   // the flamethrower, grip in the hand
  c.save();c.scale(.08,.08);c.drawImage(K.img.item,-88,-130);c.restore();
  const fire=F.win?1:clamp((p.heat-.45)/.3,0,1);
  if(fire>0&&!F.scared){for(let i=0;i<8;i++){const k=((t*5)+i/8)%1,len=(10+fire*18)*k;c.globalAlpha=(1-k)*.95;
    dot(c,22.5+len,-5+Math.sin(t*30+i)*k*2.4,(1.6+k*4)*fire,['#fff3b0','#ffd23f','#ff7a1a','#ff3e5f'][Math.min(3,Math.floor(k*4))])}c.globalAlpha=1}
  c.restore()};

// register: replaces the old flat bear, bull, whale and the test Elon; adds the rest
// (CHARS is a top-level const in art.js, so it is not on window)
if(typeof CHARS!=='undefined')for(const id in C){const X=C[id];if(X.K)loadKit(X.K,id);
  CHARS[id]={ru:X.ru,en:X.en,draw:stateless(X),rig:makeRig(X),drop:X.drop,chute:X.K?X.K.chute:{y:-86,l:[-8,-54],r:[9,-54]},thumb:X.K?X.K.thumb:.8,gen2:true}}
window.drawBear2=stateless(C.bear);window.makeBear2=()=>makeRig(C.bear);   // the mock-up page uses these
})();
