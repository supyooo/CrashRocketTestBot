/* Crash Rocket game art: characters, rockets, backdrops. Shared by the app and the brand kit. */
const rnd=(a,b)=>a+Math.random()*(b-a),lerp=(a,b,t)=>a+(b-a)*t,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const easeBack=t=>{const c=1.70158;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}

/* =====================================================================
   Characters — drawn upright, origin at the seat, ~52 units tall
   mood 0..1 (calm → ecstatic), t = time
   ===================================================================== */
function suit(c,col,mood,t,tieCol,lapel){
  c.fillStyle=col;rr(c,-11,-24,22,25,7);c.fill();
  if(lapel){c.fillStyle='#f4f4f8';c.beginPath();c.moveTo(-5,-24);c.lineTo(0,-13);c.lineTo(5,-24);c.fill()}
  if(!tieCol)return;
  c.save();c.translate(0,-21.5);c.rotate(.25+mood*1.05+Math.sin(t*26)*.14*(.3+mood));
  c.fillStyle=tieCol;c.beginPath();c.moveTo(-1.8,0);c.lineTo(1.8,0);c.lineTo(2.9,9);c.lineTo(0,12.5);c.lineTo(-2.9,9);c.closePath();c.fill();c.restore();
}
function arms(c,col,paw,mood,t){
  c.lineCap='round';c.lineWidth=6;c.strokeStyle=col;
  c.beginPath();c.moveTo(8,-18);c.lineTo(15,-7);c.stroke();c.fillStyle=paw;c.beginPath();c.arc(15,-6,3.6,0,6.283);c.fill();
  const up=clamp((mood-.45)/.4,0,1),wave=Math.sin(t*14)*.35*up;
  const ex=lerp(-13,-17,up),ey=lerp(-6,-38,up)+wave*6;
  c.strokeStyle=col;c.beginPath();c.moveTo(-8,-18);c.lineTo(ex,ey);c.stroke();c.fillStyle=paw;c.beginPath();c.arc(ex,ey-1,3.6,0,6.283);c.fill();
}
function mouth(c,x,y,mood){
  if(mood<.3){c.strokeStyle='#1b1010';c.lineWidth=1.3;c.beginPath();c.arc(x,y-1,2.8,.25,2.9);c.stroke();return}
  c.fillStyle='#3a0d12';c.beginPath();c.ellipse(x,y,2.4+mood*1.8,1.1+mood*2.6,0,0,6.283);c.fill();
  c.fillStyle='#ff7a9a';c.beginPath();c.ellipse(x,y+mood*1.4,1.6+mood,1+mood*.8,0,0,Math.PI);c.fill();
}
function shades(c,x,y,rim){c.fillStyle='#0b1a14';c.strokeStyle=rim;c.lineWidth=1.3;rr(c,x-10,y,8.5,5.5,2);c.fill();c.stroke();rr(c,x+1.5,y,8.5,5.5,2);c.fill();c.stroke();
  c.beginPath();c.moveTo(x-1.5,y+2);c.lineTo(x+1.5,y+2);c.stroke();c.fillStyle='rgba(255,255,255,.55)';c.fillRect(x-8,y+1,2.4,1.2);c.fillRect(x+3.5,y+1,2.4,1.2)}
function drawBear(c,mood,t){
  suit(c,'#1c2447',mood,t,'#e8364f',true);arms(c,'#1c2447','#8a5a33',mood,t);
  const hb=Math.sin(t*9)*mood*1.2;c.save();c.translate(0,hb);
  const ew=Math.sin(t*22)*mood*.25;
  [[-9,-45,-ew],[9,-45,ew]].forEach(([x,y,r])=>{c.save();c.translate(x,y);c.rotate(r);c.fillStyle='#8a5a33';c.beginPath();c.arc(0,0,5.2,0,6.283);c.fill();c.fillStyle='#c9925f';c.beginPath();c.arc(0,0,2.6,0,6.283);c.fill();c.restore()});
  c.fillStyle='#8a5a33';c.beginPath();c.arc(0,-35,12.5,0,6.283);c.fill();
  c.fillStyle='#e0b27f';c.beginPath();c.ellipse(2,-30,7.2,5.6,0,0,6.283);c.fill();
  c.fillStyle='#1b1010';c.beginPath();c.ellipse(3,-33,2.7,1.9,0,0,6.283);c.fill();
  mouth(c,3,-28.6,mood);shades(c,0,-41.5,'#2bff88');c.restore();
}
function drawBull(c,mood,t){
  suit(c,'#15151f',mood,t,'#2bff88',true);
  c.strokeStyle='#ffd23f';c.lineWidth=1.6;c.setLineDash([2,1.5]);c.beginPath();c.arc(0,-24,7,.3,Math.PI-.3);c.stroke();c.setLineDash([]);
  arms(c,'#15151f','#5b3a29',mood,t);
  const hb=Math.sin(t*9)*mood*1.2;c.save();c.translate(0,hb);
  c.strokeStyle='#f1e6c8';c.lineCap='round';c.lineWidth=4.2;
  c.beginPath();c.moveTo(-8,-43);c.quadraticCurveTo(-19,-44,-18,-56);c.stroke();c.beginPath();c.moveTo(8,-43);c.quadraticCurveTo(19,-44,18,-56);c.stroke();
  c.fillStyle='#5b3a29';[[-13,-38,-.5],[13,-38,.5]].forEach(([x,y,r])=>{c.beginPath();c.ellipse(x,y,5,2.6,r,0,6.283);c.fill()});
  c.beginPath();c.ellipse(0,-35,12,12.5,0,0,6.283);c.fill();
  c.fillStyle='#fff';c.beginPath();c.ellipse(-4.5,-38,2.8,2.4,0,0,6.283);c.ellipse(4.5,-38,2.8,2.4,0,0,6.283);c.fill();
  c.fillStyle='#1b1010';c.beginPath();c.arc(-3.8,-37.6,1.3,0,6.283);c.arc(5.2,-37.6,1.3,0,6.283);c.fill();
  c.strokeStyle='#1b1010';c.lineWidth=1.8;c.beginPath();c.moveTo(-8,-43);c.lineTo(-2,-40.5);c.moveTo(8,-43);c.lineTo(2,-40.5);c.stroke();
  c.fillStyle='#d49b75';c.beginPath();c.ellipse(1,-28.5,8.5,6,0,0,6.283);c.fill();
  c.fillStyle='#3a1f14';c.beginPath();c.ellipse(-2.5,-29.5,1.5,1.1,0,0,6.283);c.ellipse(4.5,-29.5,1.5,1.1,0,0,6.283);c.fill();
  c.strokeStyle='#ffd23f';c.lineWidth=1.6;c.beginPath();c.arc(1,-25.5,3,0,Math.PI);c.stroke();
  if(mood>.35){c.fillStyle='rgba(255,255,255,.7)';for(let i=0;i<2;i++){const k=((t*2.4)+i*.5)%1;c.globalAlpha=(1-k)*.8;c.beginPath();c.arc(-8-k*9,-28+k*3,1.5+k*3,0,6.283);c.fill()}c.globalAlpha=1}
  c.restore();
}
function drawWhale(c,mood,t){
  const hb=Math.sin(t*9)*mood*1.2;c.save();c.translate(0,hb);
  c.fillStyle='#2f6fe0';c.save();c.translate(-13,-8);c.rotate(-.5+Math.sin(t*10)*.15*(.3+mood));c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-9,-4,-14,-14);c.quadraticCurveTo(-8,-12,-5,-9);c.quadraticCurveTo(-5,-16,-2,-20);c.quadraticCurveTo(2,-10,3,-3);c.closePath();c.fill();c.restore();
  const g=c.createLinearGradient(0,-40,0,0);g.addColorStop(0,'#4f94ff');g.addColorStop(1,'#2458c9');c.fillStyle=g;
  c.beginPath();c.moveTo(-15,0);c.bezierCurveTo(-19,-22,-10,-40,4,-40);c.bezierCurveTo(16,-40,19,-24,17,-8);c.quadraticCurveTo(16,0,8,0);c.closePath();c.fill();
  c.fillStyle='#cfe3ff';c.beginPath();c.moveTo(-4,0);c.bezierCurveTo(-4,-10,4,-18,16,-18);c.quadraticCurveTo(17,-6,8,0);c.closePath();c.fill();
  c.strokeStyle='rgba(36,88,201,.45)';c.lineWidth=.9;for(let i=0;i<3;i++){c.beginPath();c.moveTo(0+i*3,-2);c.quadraticCurveTo(6+i*2,-9,15,-12+i*2);c.stroke()}
  c.fillStyle='#e8364f';c.beginPath();c.moveTo(3,-19);c.lineTo(-1,-22);c.lineTo(-1,-16);c.closePath();c.moveTo(3,-19);c.lineTo(7,-22);c.lineTo(7,-16);c.closePath();c.fill();c.beginPath();c.arc(3,-19,1.4,0,6.283);c.fill();
  c.save();c.translate(13,-10);c.rotate(.6+Math.sin(t*12)*.2*mood);c.fillStyle='#2458c9';c.beginPath();c.ellipse(0,0,6,3,0,0,6.283);c.fill();c.restore();
  c.fillStyle='#0b1a14';c.strokeStyle='#29e6ff';c.lineWidth=1.3;rr(c,-2,-33,18,6,3);c.fill();c.stroke();c.fillStyle='rgba(255,255,255,.55)';c.fillRect(1,-32,3,1.4);
  if(mood<.3){c.strokeStyle='#123a86';c.lineWidth=1.4;c.beginPath();c.moveTo(4,-24);c.quadraticCurveTo(10,-21,16,-24);c.stroke()}
  else{c.fillStyle='#10245a';c.beginPath();c.moveTo(4,-24.5);c.quadraticCurveTo(10,-19+mood*-1-mood*3,16.5,-24.5);c.quadraticCurveTo(10,-23,4,-24.5);c.fill()}
  if(mood>.3){c.strokeStyle='#8fd8ff';c.lineWidth=1.6;c.lineCap='round';const h=6+mood*10+Math.sin(t*18)*2;
    for(const s of[-1,0,1]){c.beginPath();c.moveTo(3,-40);c.quadraticCurveTo(3+s*3,-40-h,3+s*(5+mood*4),-40-h*.6);c.stroke()}
    c.fillStyle='#8fd8ff';for(let i=0;i<3;i++){const k=(t*1.8+i/3)%1;c.globalAlpha=1-k;c.beginPath();c.arc(3+(i-1)*(6+k*6),-40-h*.6+k*10,1.5,0,6.283);c.fill()}c.globalAlpha=1}
  c.restore();
}
/* ---- meme riders for testing (caricatures; not for the paid shop) ---- */
function drawTrump(c,mood,t){
  suit(c,'#1f2a4a',mood,t,'#d6202a',true);arms(c,'#1f2a4a','#f0a868',mood,t);
  const hb=Math.sin(t*9)*mood*1.2;c.save();c.translate(0,hb);
  c.fillStyle='#e99858';c.beginPath();c.arc(-11.6,-34,3,0,6.283);c.arc(11.6,-34,3,0,6.283);c.fill();
  c.fillStyle='#f2a35e';c.beginPath();c.ellipse(0,-34,11.6,12.4,0,0,6.283);c.fill();
  c.fillStyle='#f7d6b4';c.beginPath();c.ellipse(-4.6,-36.6,3.4,2.1,0,0,6.283);c.ellipse(4.6,-36.6,3.4,2.1,0,0,6.283);c.fill();
  c.strokeStyle='#3a2418';c.lineWidth=1.3;c.lineCap='round';c.beginPath();c.moveTo(-6.2,-36.6);c.quadraticCurveTo(-4.6,-37.6,-3,-36.6);c.moveTo(3,-36.6);c.quadraticCurveTo(4.6,-37.6,6.2,-36.6);c.stroke();
  c.strokeStyle='#e7c46e';c.lineWidth=1.8;c.beginPath();c.moveTo(-7,-40);c.lineTo(-2.5,-40.4);c.moveTo(2.5,-40.4);c.lineTo(7,-40);c.stroke();
  c.fillStyle='#df8a4c';c.beginPath();c.ellipse(0,-32.2,2.2,2.6,0,0,6.283);c.fill();
  if(mood<.3){c.fillStyle='#8a3a2a';c.beginPath();c.ellipse(0,-27.6,2.3,1.9,0,0,6.283);c.fill()}
  else{c.fillStyle='#5a1a14';c.beginPath();c.ellipse(0,-27.4,3+mood*2,1.6+mood*2.4,0,0,6.283);c.fill();c.fillStyle='#fff';c.fillRect(-2.4-mood,-28.8-mood*.8,4.8+mood*2,1.3)}
  const fl=Math.sin(t*20)*mood*1.6;
  c.fillStyle='#f3cf63';c.beginPath();c.moveTo(-12.4,-37);c.quadraticCurveTo(-14.5,-50,-2,-51.5+fl*.4);c.quadraticCurveTo(11,-51.5,14.5,-44+fl);c.quadraticCurveTo(16.5,-40.5,13.5,-38.5);
  c.quadraticCurveTo(12,-43,6,-43.5);c.quadraticCurveTo(-3,-44,-8,-41.5);c.quadraticCurveTo(-11,-40,-12.4,-37);c.closePath();c.fill();
  c.strokeStyle='#d9a93a';c.lineWidth=1;c.beginPath();c.moveTo(-9,-45);c.quadraticCurveTo(0,-49.5,11,-45+fl*.6);c.moveTo(-6,-42.8);c.quadraticCurveTo(3,-46.5,13,-41.5+fl*.8);c.stroke();
  c.restore();
}
function drawMusk(c,mood,t){
  suit(c,'#15151c',mood,t,null,false);c.fillStyle='#2b2b36';c.beginPath();c.moveTo(-5,-24);c.lineTo(0,-16);c.lineTo(5,-24);c.fill();
  arms(c,'#15151c','#f2c9a8',mood,t);
  const hb=Math.sin(t*9)*mood*1.2;c.save();c.translate(0,hb);
  c.fillStyle='#e8b896';c.beginPath();c.arc(-11,-34,2.9,0,6.283);c.arc(11,-34,2.9,0,6.283);c.fill();
  c.fillStyle='#f2c9a8';c.beginPath();c.ellipse(0,-35,10.8,11.5,0,0,6.283);c.fill();rr(c,-9.4,-36,18.8,13.2,6.5);c.fill();
  c.fillStyle='#3a2a22';c.beginPath();c.moveTo(-11,-37);c.quadraticCurveTo(-11.5,-48,-2,-49);c.quadraticCurveTo(9,-49.5,11,-40);c.lineTo(11,-37.5);
  c.quadraticCurveTo(9,-43,5,-43.2);c.quadraticCurveTo(0,-41.8,-4,-43.6);c.quadraticCurveTo(-9,-43,-11,-37);c.closePath();c.fill();
  c.strokeStyle='#2a1c14';c.lineWidth=1.7;c.lineCap='round';c.beginPath();c.moveTo(-7.2,-39.4);c.lineTo(-2.6,-39.8);c.moveTo(2.6,-39.8);c.lineTo(7.2,-39.4);c.stroke();
  c.fillStyle='#2a1c14';c.beginPath();c.arc(-4.8,-36.2,1.3,0,6.283);c.arc(4.8,-36.2,1.3,0,6.283);c.fill();
  c.strokeStyle='#d9a482';c.lineWidth=1.1;c.beginPath();c.moveTo(0,-35);c.lineTo(-.8,-31.4);c.lineTo(.8,-31.2);c.stroke();
  if(mood<.3){c.strokeStyle='#6a2f25';c.lineWidth=1.4;c.beginPath();c.moveTo(-3.5,-27.6);c.quadraticCurveTo(1,-26.2,4.5,-28.8);c.stroke()}
  else{c.fillStyle='#4a1510';c.beginPath();c.moveTo(-4.5,-28.5);c.quadraticCurveTo(0,-24-mood*3,4.5,-28.5);c.closePath();c.fill();c.fillStyle='#fff';c.fillRect(-3.6,-28.6,7.2,1.3)}
  c.restore();
}
function drawSahur(c,mood,t){
  const hb=Math.sin(t*9)*mood*1.2;c.save();c.translate(0,hb);
  const up=clamp((mood-.45)/.4,0,1),ex=lerp(-15,-18,up),ey=lerp(-12,-36,up)+Math.sin(t*14)*2*up;
  c.strokeStyle='#6e4520';c.lineWidth=2.4;c.beginPath();c.moveTo(-10,-24);c.lineTo(ex,ey);c.stroke();
  const g=c.createLinearGradient(-12,0,12,0);g.addColorStop(0,'#7e5128');g.addColorStop(.45,'#b8834a');g.addColorStop(1,'#80522a');c.fillStyle=g;rr(c,-12,-52,24,53,8);c.fill();
  c.strokeStyle='rgba(90,55,25,.55)';c.lineWidth=.9;for(const x of[-7,-1,6]){c.beginPath();c.moveTo(x,-47);c.quadraticCurveTo(x+1.5,-30,x-.5,-4);c.stroke()}
  c.fillStyle='#dcaa6c';c.beginPath();c.ellipse(0,-51.5,11,3.4,0,0,6.283);c.fill();c.strokeStyle='#a8742f';c.lineWidth=.8;c.beginPath();c.ellipse(0,-51.5,6.5,1.9,0,0,6.283);c.ellipse(0,-51.5,2.8,.8,0,0,6.283);c.stroke();
  c.fillStyle='#fff';c.beginPath();c.arc(-4.6,-38,3.8,0,6.283);c.arc(4.6,-38,3.8,0,6.283);c.fill();
  const lx=mood*.8;c.fillStyle='#1b1010';c.beginPath();c.arc(-4.2+lx,-37.6,1.9,0,6.283);c.arc(5+lx,-37.6,1.9,0,6.283);c.fill();
  c.strokeStyle='#3a2210';c.lineWidth=2;c.lineCap='round';c.beginPath();c.moveTo(-8.4,-43.6);c.lineTo(-2,-42);c.moveTo(8.4,-43.6);c.lineTo(2,-42);c.stroke();
  if(mood<.3){c.strokeStyle='#3a2210';c.lineWidth=1.5;c.beginPath();c.moveTo(-3.5,-30);c.lineTo(3.5,-30);c.stroke()}
  else{c.fillStyle='#3a0d12';c.beginPath();c.ellipse(0,-30,3+mood*1.5,1.4+mood*2.6,0,0,6.283);c.fill()}
  c.lineCap='round';c.lineWidth=2.4;c.strokeStyle='#6e4520';
  const sw=-.7+Math.sin(t*12)*.7*mood;
  c.beginPath();c.moveTo(10,-24);c.lineTo(17,-15);c.stroke();
  c.save();c.translate(17,-15);c.rotate(sw);c.fillStyle='#d6a25e';c.beginPath();c.moveTo(-1.2,0);c.lineTo(1.2,0);c.lineTo(3.2,-20);c.quadraticCurveTo(0,-24,-3.2,-20);c.closePath();c.fill();
  c.strokeStyle='#a8742f';c.lineWidth=.8;c.stroke();c.restore();
  c.restore();
}
const CHARS={
  bear:{ru:'Медведь',en:'Bear',draw:drawBear,drop:'shades'},
  bull:{ru:'Бык',en:'Bull',draw:drawBull,drop:'horn'},
  whale:{ru:'Кит',en:'Whale',draw:drawWhale,drop:'shades'},
  trump:{ru:'Трамп',en:'Trump',draw:drawTrump,drop:'hair'},
  musk:{ru:'Илон',en:'Elon',draw:drawMusk,drop:'none'},
  sahur:{ru:'Тунг Тунг Сахур',en:'Tung Tung Sahur',draw:drawSahur,drop:'bat'}
};

/* =====================================================================
   Rockets — local +x is the nose. Rider seat + nozzle x.
   ===================================================================== */
function drawCandle(c){
  c.fillStyle='#7b3cff';c.beginPath();c.moveTo(-46,-12);c.lineTo(-63,-28);c.lineTo(-30,-12);c.fill();c.beginPath();c.moveTo(-46,12);c.lineTo(-63,28);c.lineTo(-30,12);c.fill();
  c.fillStyle='#2a2f45';c.fillRect(-57,-8,8,16);
  const g=c.createLinearGradient(0,-12,0,12);g.addColorStop(0,'#7dffbe');g.addColorStop(.5,'#16c865');g.addColorStop(1,'#06793a');c.fillStyle=g;rr(c,-50,-12,92,24,6);c.fill();
  c.strokeStyle='rgba(200,255,225,.55)';c.lineWidth=1;c.stroke();
  c.fillStyle='#1eea78';c.beginPath();c.moveTo(41,-12);c.quadraticCurveTo(58,-6,66,0);c.quadraticCurveTo(58,6,41,12);c.fill();
  c.strokeStyle='#b9ffd9';c.lineWidth=1.6;c.beginPath();c.moveTo(66,0);c.lineTo(78,0);c.stroke();
  c.fillStyle='rgba(255,255,255,.35)';rr(c,-44,-8.5,78,3,1.5);c.fill();
  c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=1.6;c.beginPath();c.moveTo(-36,6);c.lineTo(-24,1);c.lineTo(-16,4);c.lineTo(-2,-3);c.lineTo(8,0);c.lineTo(22,-6);c.stroke();
}
function drawShort(c){
  c.fillStyle='#2a2f45';c.beginPath();c.moveTo(-46,-12);c.lineTo(-63,-28);c.lineTo(-30,-12);c.fill();c.beginPath();c.moveTo(-46,12);c.lineTo(-63,28);c.lineTo(-30,12);c.fill();
  c.fillStyle='#1a1d2e';c.fillRect(-57,-8,8,16);
  const g=c.createLinearGradient(0,-12,0,12);g.addColorStop(0,'#ff9aac');g.addColorStop(.5,'#ff2d55');g.addColorStop(1,'#8a0a24');c.fillStyle=g;rr(c,-50,-12,92,24,6);c.fill();
  c.strokeStyle='rgba(255,210,220,.55)';c.lineWidth=1;c.stroke();
  c.fillStyle='#ff4d6d';c.beginPath();c.moveTo(41,-12);c.quadraticCurveTo(58,-6,66,0);c.quadraticCurveTo(58,6,41,12);c.fill();
  c.strokeStyle='#ffc2cd';c.lineWidth=1.6;c.beginPath();c.moveTo(66,0);c.lineTo(78,0);c.stroke();
  c.fillStyle='rgba(255,255,255,.3)';rr(c,-44,-8.5,78,3,1.5);c.fill();
  c.strokeStyle='rgba(255,255,255,.8)';c.lineWidth=1.6;c.beginPath();c.moveTo(-36,-6);c.lineTo(-24,-1);c.lineTo(-16,-4);c.lineTo(-2,3);c.lineTo(8,0);c.lineTo(22,6);c.stroke();
}
function retroBody(c){c.beginPath();c.moveTo(-50,-14);c.lineTo(28,-14);c.quadraticCurveTo(62,-11,72,0);c.quadraticCurveTo(62,11,28,14);c.lineTo(-50,14);c.quadraticCurveTo(-55,0,-50,-14);c.closePath()}
function drawRetro(c){
  c.fillStyle='#ff3b5c';c.strokeStyle='#ff9ac4';c.lineWidth=1;
  c.beginPath();c.moveTo(-38,-13);c.lineTo(-62,-34);c.lineTo(-54,-13);c.closePath();c.fill();c.stroke();
  c.beginPath();c.moveTo(-38,13);c.lineTo(-62,34);c.lineTo(-54,13);c.closePath();c.fill();c.stroke();
  c.fillStyle='#2a2f45';c.fillRect(-59,-9,9,18);c.fillStyle='#3d4460';c.fillRect(-61,-10,3,20);
  const g=c.createLinearGradient(0,-14,0,14);g.addColorStop(0,'#ffffff');g.addColorStop(.45,'#d2d8e8');g.addColorStop(1,'#6f7896');c.fillStyle=g;retroBody(c);c.fill();
  c.save();retroBody(c);c.clip();c.fillStyle='#ff3b5c';c.fillRect(38,-20,40,40);c.fillStyle='#ff3ea5';c.fillRect(-32,-20,5,40);c.fillRect(-24,-20,2,40);
  c.fillStyle='rgba(255,255,255,.55)';c.fillRect(-48,-10,84,2.4);c.restore();
  c.strokeStyle='#ff3ea5';c.lineWidth=1.3;retroBody(c);c.stroke();
  [[2,0,6.5],[18,0,5]].forEach(([x,y,r])=>{const pg=c.createRadialGradient(x-2,y-2,1,x,y,r);pg.addColorStop(0,'#c8fbff');pg.addColorStop(1,'#1aa6c9');c.fillStyle=pg;c.beginPath();c.arc(x,y,r,0,6.283);c.fill();c.strokeStyle='#2a2f45';c.lineWidth=2;c.stroke()});
}
const ROCKETS={
  candle:{ru:'Зелёная свеча',en:'Green Candle',draw:drawCandle,seat:[-12,-11],tail:-58,trail:'rainbow'},
  retro:{ru:'Ретро-шаттл',en:'Retro Shuttle',draw:drawRetro,seat:[-16,-13],tail:-61,trail:'fire'},
  short:{ru:'Свеча «Шорт»',en:'Short Candle',draw:drawShort,seat:[-12,-11],tail:-58,trail:'fire'}
};
function drawFlame(c,kind,power,t,x){
  if(power<=0)return;const L=(22+power*26)*(1+Math.sin(t*50)*.08+Math.random()*.12),W=7+power*3;
  c.save();c.globalCompositeOperation='lighter';
  const g=c.createLinearGradient(x,0,x-L,0);
  if(kind==='fire'){g.addColorStop(0,'#fffbe6');g.addColorStop(.25,'#ffd23f');g.addColorStop(.6,'#ff6a1a');g.addColorStop(1,'rgba(255,40,40,0)')}
  else{g.addColorStop(0,'#fffbe6');g.addColorStop(.3,'#ffd23f');g.addColorStop(.7,'#ff3ea5');g.addColorStop(1,'rgba(41,230,255,0)')}
  c.fillStyle=g;c.beginPath();c.moveTo(x,-W);c.quadraticCurveTo(x-L*.4,-W*1.1,x-L,0);c.quadraticCurveTo(x-L*.4,W*1.1,x,W);c.closePath();c.fill();
  c.fillStyle='rgba(255,255,255,.8)';c.beginPath();c.ellipse(x-4,0,6,W*.45,0,0,6.283);c.fill();c.restore();
}

/* =====================================================================
   Backgrounds (each is a factory so thumbnails get their own instance)
   E = {w,h,sc,dt,t,alt,dAlt,sp,I,phase,m,rx,ry,tx,ty,gy,crashT}
   ===================================================================== */
function candleFeed(){let v=.45,dump=0;return{
  next(){const o=v;let c=o+(dump>0?rnd(-.16,-.04):rnd(-.05,.075));if(dump>0)dump--;if(c>.92)c-=.1;if(c<.06)c=.06+Math.random()*.05;v=c;return{o,c,hi:Math.max(o,c)+rnd(.005,.04),lo:Math.min(o,c)-rnd(.005,.04)}},
  crash(){dump=4}}}
function drawCandles(c,arr,off,top,bot,alpha,step){c.globalAlpha=alpha;arr.forEach((k,i)=>{const x=i*step-off,Y=v=>bot-v*(bot-top),up=k.c>=k.o;c.strokeStyle=c.fillStyle=up?'#2bff88':'#ff3e7a';
  c.lineWidth=1;c.beginPath();c.moveTo(x+step/4,Y(k.hi));c.lineTo(x+step/4,Y(k.lo));c.stroke();const y1=Y(Math.max(k.o,k.c)),y2=Y(Math.min(k.o,k.c));c.fillRect(x,y1,step/2,Math.max(2,y2-y1))});c.globalAlpha=1}

function makeSynth(){
  let w,h,stars=[],city=[],candles=[],feed=candleFeed(),cOff=0,gOff=0;
  return{smoke:'#5d3f86',
    resize(W,H){w=W;h=H;stars=Array.from({length:80},()=>({x:rnd(0,w),y:rnd(0,h),r:rnd(.3,1.4),t:rnd(0,6)}));
      city=[];let x=-6;while(x<w+30){const bw=rnd(12,34);city.push({x,w:bw,h:rnd(.04,.2)*h,win:Array.from({length:6},()=>Math.random()<.4)});x+=bw+rnd(1,4)}
      candles=[];for(let i=0;i<Math.ceil(w/14)+3;i++)candles.push(feed.next())},
    crash(){feed.crash()},
    draw(c,E){const{t,dt,sp,gy}=E;
      const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#090320');g.addColorStop(.55,'#260a4d');g.addColorStop(1,'#5b1269');c.fillStyle=g;c.fillRect(-20,-20,w+40,h+40);
      c.fillStyle='#fff';for(const s of stars){s.y+=sp*14*dt*s.r;if(s.y>h)s.y-=h;c.globalAlpha=.35+.35*Math.sin(t*2+s.t);c.fillRect(s.x,s.y,s.r,s.r)}c.globalAlpha=1;
      cOff+=dt*(E.phase==='fly'?40*sp:10);while(cOff>=14){cOff-=14;candles.shift();candles.push(feed.next())}
      drawCandles(c,candles,cOff,h*.1,gy-h*.06,.42,14);
      if(gy<h+10){
        const sr=w*.26,sx=w*.5,sy=gy-h*.01;c.save();c.beginPath();for(let i=0;i<9;i++){const y0=sy-sr+i*sr/7.2,hh=sr/7.2-i*1.4;c.rect(sx-sr,y0,sr*2,Math.max(1,hh))}c.clip();
        const sg=c.createLinearGradient(0,sy-sr,0,sy);sg.addColorStop(0,'#ffd23f');sg.addColorStop(1,'#ff3ea5');c.fillStyle=sg;c.beginPath();c.arc(sx,sy,sr,Math.PI,0);c.fill();c.restore();
        city.forEach(b=>{c.fillStyle='#16072e';c.fillRect(b.x,gy-b.h,b.w,b.h);c.fillStyle='rgba(41,230,255,.5)';b.win.forEach((on,i)=>{if(on)c.fillRect(b.x+3+(i%2)*(b.w/2),gy-b.h+5+Math.floor(i/2)*9,2,3)})});
        const fg=c.createLinearGradient(0,gy,0,h);fg.addColorStop(0,'#2a0a4a');fg.addColorStop(1,'#0c0320');c.fillStyle=fg;c.fillRect(0,gy,w,h-gy+40);
        gOff=(gOff+dt*(E.phase==='fly'?1.2*sp:.25))%1;c.strokeStyle='#ff3ea5';
        for(let k=0;k<12;k++){const z=(k+gOff)/12,y=gy+(h-gy+60)*z*z;c.globalAlpha=.15+.75*z;c.lineWidth=1+z*1.5;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}
        c.globalAlpha=.55;c.lineWidth=1.2;for(let i=-10;i<=10;i++){c.beginPath();c.moveTo(w/2+i*w*.045,gy);c.lineTo(w/2+i*w*.42,h+60);c.stroke()}c.globalAlpha=1;
        c.fillStyle='rgba(255,62,165,.7)';c.fillRect(0,gy-1,w,2);}
    }};
}

function makeMoon(){
  let w,h,layers=[],neb=null,craters=[],sats=[];
  return{smoke:'#4a5570',
    resize(W,H){w=W;h=H;
      layers=[[.2,.5,110],[.5,.9,50],[1,1.4,20]].map(([s,r,n])=>({s,r,st:Array.from({length:n},()=>({x:rnd(0,w),y:rnd(0,h),t:rnd(0,6)}))}));
      craters=Array.from({length:9},()=>({a:rnd(0,6.283),d:rnd(0,.75),r:rnd(.07,.2)}));
      neb=document.createElement('canvas');const d=Math.min(2,window.devicePixelRatio||1);neb.width=Math.max(1,Math.round(w*d));neb.height=Math.max(1,Math.round(h*d));const n=neb.getContext('2d');n.scale(d,d);
      const bg=n.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#03020c');bg.addColorStop(1,'#0b0a2a');n.fillStyle=bg;n.fillRect(0,0,w,h);
      [[w*.1,h*.3,w*.8,'rgba(138,92,255,.28)'],[w*.95,h*.7,w*.9,'rgba(255,62,165,.18)'],[w*.6,h*.05,w*.6,'rgba(41,230,255,.12)']].forEach(([x,y,r,col])=>{const g=n.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');n.fillStyle=g;n.fillRect(0,0,w,h)})},
    crash(){},
    draw(c,E){const{t,dt,sp,gy,m}=E;const fly=E.phase==='fly';
      c.drawImage(neb,0,0,w,h);
      for(const L of layers){c.fillStyle='#e6ecff';for(const s of L.st){s.y+=(fly?80*sp:5)*L.s*dt;s.x-=(fly?30*sp:0)*L.s*dt;if(s.y>h){s.y=0;s.x=rnd(0,w*1.2)}if(s.x<0)s.x+=w;
        c.globalAlpha=(.4+.6*Math.abs(Math.sin(t*.8+s.t)))*(L.s<.3?.6:1);if(fly&&L.s===1&&sp>1.5){c.save();c.translate(s.x,s.y);c.rotate(.4);c.fillRect(0,0,L.r,L.r*(1+sp*4));c.restore()}else c.fillRect(s.x,s.y,L.r,L.r)}}c.globalAlpha=1;
      // the moon grows as the multiplier climbs
      const k=Math.pow(clamp(Math.log(Math.max(1,E.moonM))/Math.log(40),0,1),.75),R=lerp(16,w*.62,k),mx=lerp(w*.78,w*.7,k),my=lerp(h*.2,h*.08+R*.4,k);
      const gl=c.createRadialGradient(mx,my,R*.8,mx,my,R*1.6);gl.addColorStop(0,'rgba(255,240,210,.25)');gl.addColorStop(1,'rgba(255,240,210,0)');c.fillStyle=gl;c.beginPath();c.arc(mx,my,R*1.6,0,6.283);c.fill();
      const mg=c.createRadialGradient(mx-R*.35,my-R*.35,R*.1,mx,my,R);mg.addColorStop(0,'#fbf6e8');mg.addColorStop(.7,'#d9d2bd');mg.addColorStop(1,'#a59d88');c.fillStyle=mg;c.beginPath();c.arc(mx,my,R,0,6.283);c.fill();
      c.save();c.beginPath();c.arc(mx,my,R,0,6.283);c.clip();c.fillStyle='rgba(120,110,95,.35)';craters.forEach(q=>{c.beginPath();c.arc(mx+Math.cos(q.a)*q.d*R,my+Math.sin(q.a)*q.d*R,q.r*R,0,6.283);c.fill()});
      const sh=c.createLinearGradient(mx-R,my,mx+R,my);sh.addColorStop(0,'rgba(10,8,40,0)');sh.addColorStop(.7,'rgba(10,8,40,.1)');sh.addColorStop(1,'rgba(10,8,40,.55)');c.fillStyle=sh;c.fillRect(mx-R,my-R,R*2,R*2);c.restore();
      if(fly&&E.I>.35&&Math.random()<.01*sp)sats.push({x:w+20,y:rnd(h*.2,h*.7),v:rnd(80,160)*sp});
      for(let i=sats.length-1;i>=0;i--){const s=sats[i];s.x-=s.v*dt;s.y+=s.v*.35*dt;if(s.x<-40){sats.splice(i,1);continue}
        c.save();c.translate(s.x,s.y);c.rotate(.3);c.fillStyle='#8a92b8';c.fillRect(-3,-3,6,6);c.fillStyle='#29e6ff';c.fillRect(-13,-1.5,8,3);c.fillRect(5,-1.5,8,3);c.fillStyle=Math.sin(t*10)>0?'#ff3b6b':'#401020';c.fillRect(-1,-5,2,2);c.restore()}
      if(gy<h+60){const Re=w*1.6,cy=gy+Re-h*.02;
        const eg=c.createRadialGradient(w*.35,cy-Re,Re*.05,w*.5,cy,Re);eg.addColorStop(0,'#1f5fd1');eg.addColorStop(.35,'#123a8a');eg.addColorStop(1,'#050a22');c.fillStyle=eg;c.beginPath();c.arc(w/2,cy,Re,0,6.283);c.fill();
        c.save();c.shadowColor='#29e6ff';c.shadowBlur=22;c.strokeStyle='rgba(120,220,255,.9)';c.lineWidth=2;c.beginPath();c.arc(w/2,cy,Re,Math.PI*1.15,Math.PI*1.85);c.stroke();c.restore();
        c.fillStyle='rgba(255,210,63,.9)';for(let i=0;i<14;i++){const x=w*.12+i*w*.055;if(Math.sin(i*7.3)>0)c.fillRect(x,gy+6+Math.sin(i)*2,1.6,1.6)}}
    }};
}

function makeExch(){
  let w,h,cols=[],trail=[],feed=candleFeed(),candles=[],cOff=0,tape=0,hot=false;
  const TICK=['BTC ▲ 2.41%','TON ▲ 6.18%','ETH ▼ 0.82%','SOL ▲ 4.02%','DOGE ▲ 12.5%','NOT ▼ 3.30%','PEPE ▲ 21.7%','XRP ▲ 1.14%'];
  const tapeStr=TICK.join('     ')+'     ';
  return{smoke:'#2d4a3c',
    resize(W,H){w=W;h=H;cols=[];const n=Math.floor(w/70);for(let i=0;i<n;i++)cols.push({x:i*70+10,off:rnd(0,20),rows:Array.from({length:40},()=>({p:rnd(0.5,99).toFixed(2),q:rnd(1,999).toFixed(0),up:Math.random()<.55}))});
      candles=[];for(let i=0;i<Math.ceil(w/22)+3;i++)candles.push(feed.next())},
    crash(){feed.crash();hot=true},
    reset(){trail=[];hot=false},
    draw(c,E){const{t,dt,sp,gy}=E;const fly=E.phase==='fly';
      c.fillStyle='#040b08';c.fillRect(-20,-20,w+40,h+40);
      c.strokeStyle='rgba(43,255,136,.06)';c.lineWidth=1;const go=(t*sp*20)%32;
      for(let y=-32+go;y<h;y+=32){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}for(let x=0;x<w;x+=32){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke()}
      c.font='500 9px JetBrains Mono,monospace';c.textBaseline='top';
      cols.forEach(col=>{col.off+=dt*(fly?50*sp:6);const rowH=13;const st=Math.floor(col.off/rowH);for(let r=0;r<Math.ceil(h/rowH)+1;r++){const row=col.rows[(r-st+4000)%col.rows.length];const y=r*rowH+(col.off%rowH)-rowH;
        c.fillStyle=row.up?'rgba(43,255,136,.16)':'rgba(255,62,122,.16)';c.fillText(row.p,col.x,y);c.fillStyle='rgba(200,220,210,.08)';c.fillText(row.q,col.x+34,y)}});
      cOff+=dt*(fly?30*sp:8);while(cOff>=22){cOff-=22;candles.shift();candles.push(feed.next())}
      drawCandles(c,candles,cOff,h*.14,gy-h*.04,.35,22);
      // the rocket draws the chart behind itself
      if(fly){trail.forEach(p=>p[1]+=E.dAlt);trail.push([E.tx,E.ty]);if(trail.length>400)trail.shift()}else if(E.phase==='crash'){trail.forEach(p=>p[1]+=E.dAlt)}
      if(trail.length>1){const col=hot?'#ff3e7a':'#2bff88';c.save();c.beginPath();trail.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
        c.lineTo(trail[trail.length-1][0],h+10);c.lineTo(trail[0][0],h+10);c.closePath();const ag=c.createLinearGradient(0,E.ry,0,h);ag.addColorStop(0,hot?'rgba(255,62,122,.25)':'rgba(43,255,136,.22)');ag.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=ag;c.fill();
        c.beginPath();trail.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=col;c.lineWidth=2.5;c.shadowColor=col;c.shadowBlur=10;c.stroke();c.restore()}
      if(gy<h+30){c.fillStyle='#07130e';c.fillRect(0,gy,w,h-gy+40);c.fillStyle='rgba(43,255,136,.5)';c.fillRect(0,gy,w,1.5);
        for(let i=0;i<4;i++){const mx=w*.08+i*w*.24,mw=w*.18,mh=mw*.6;c.fillStyle='#0c1f17';rr(c,mx,gy+10,mw,mh,3);c.fill();c.strokeStyle='rgba(43,255,136,.35)';c.lineWidth=1;c.stroke();
          c.strokeStyle=i%2?'rgba(255,62,122,.8)':'rgba(43,255,136,.8)';c.beginPath();for(let j=0;j<=8;j++){const xx=mx+4+j*(mw-8)/8,yy=gy+10+mh*.7-(Math.sin(j*1.3+i+t*.8)*.25+j*.05*(i%2?-1:1)+.3)*mh*.5;j?c.lineTo(xx,yy):c.moveTo(xx,yy)}c.stroke()}}
      // ticker tape
      tape+=dt*(fly?60+30*sp:30);c.fillStyle='rgba(4,11,8,.85)';c.fillRect(0,h-22,w,22);c.fillStyle='rgba(43,255,136,.25)';c.fillRect(0,h-22,w,1);
      c.font='700 10.5px JetBrains Mono,monospace';c.textBaseline='middle';const tw=c.measureText(tapeStr).width;let x=-(tape%tw);
      while(x<w){let xx=x;TICK.forEach(s=>{c.fillStyle=s.includes('▲')?'#2bff88':'#ff3e7a';c.fillText(s,xx,h-11);xx+=c.measureText(s+'     ').width});x+=tw}
    }};
}
const BGS={synth:{ru:'Синтвейв-закат',en:'Synthwave Sunset',make:makeSynth},moon:{ru:'Курс на Луну',en:'To the Moon',make:makeMoon},exch:{ru:'Биржа',en:'Exchange',make:makeExch}};

/* =====================================================================
   Altitude zones for the synthwave flight:
   city → clouds (2x) → stratosphere (5x) → open space (10x) → moon flyby (25x) → warp (50x)
   E.lvl is the smoothed ln(multiplier); it eases back to 0 between rounds.
   ===================================================================== */
const ZONES=[{m:2,key:'clouds'},{m:5,key:'strato'},{m:10,key:'space'},{m:25,key:'moon'},{m:50,key:'warp'}];
function sstep(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)}
function band(x,a0,a1,b0,b1){return sstep(Math.log(a0),Math.log(a1),x)*(1-sstep(Math.log(b0),Math.log(b1),x))}
function mixHex(a,b,t){const A=[1,3,5].map(i=>parseInt(a.substr(i,2),16)),B=[1,3,5].map(i=>parseInt(b.substr(i,2),16));return`rgb(${A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(',')})`}
function puff(c,x,y,s,col){c.fillStyle=col;c.beginPath();[[0,0,26],[24,-10,22],[46,2,20],[-22,4,18],[16,10,24],[-40,10,14],[62,10,14]].forEach(([dx,dy,r])=>{c.moveTo(x+(dx+r)*s,y+dy*s);c.arc(x+dx*s,y+dy*s,r*s,0,6.283)});c.fill()}
function makeZones(){
  let w=1,h=1,clouds=[],stars=[],wall=null,planet=null,moon=null,warp=[],sweep=null,craters=[];
  const SKY=[[2,'#3b0f63','#c2378a'],[5,'#140a4a','#3b1f86'],[10,'#050318','#140a3a'],[25,'#03020c','#0c0622'],[50,'#020109','#12052a']];
  function sky(lm){if(lm<=Math.log(SKY[0][0]))return[SKY[0][1],SKY[0][2]];
    for(let i=0;i<SKY.length-1;i++){const a=SKY[i],b=SKY[i+1];if(lm<=Math.log(b[0])){const k=(lm-Math.log(a[0]))/(Math.log(b[0])-Math.log(a[0]));return[mixHex(a[1],b[1],k),mixHex(a[2],b[2],k)]}}
    const L=SKY[SKY.length-1];return[L[1],L[2]]}
  return{
    resize(W,H){w=W;h=H;clouds=Array.from({length:12},()=>({x:rnd(-60,w),y:rnd(-h,h),s:rnd(.6,1.4),L:rnd(.5,1.4)}));
      stars=Array.from({length:120},()=>({x:rnd(0,w),y:rnd(0,h),r:rnd(.5,1.6),z:rnd(.2,1),tw:rnd(0,6)}));craters=Array.from({length:10},()=>({a:rnd(0,6.283),d:rnd(0,.75),r:rnd(.06,.18)}))},
    enter(key){if(key==='clouds')wall={y:-h*.6};else if(key==='space')planet={x:w*.24,y:-w*.3,r:w*.15};else if(key==='moon')moon={x:w*.74,y:-w*.5,r:w*.42};sweep={t:0}},
    reset(){wall=planet=moon=sweep=null;warp=[]},
    draw(c,E){const lm=E.lvl,{t,dt,sp}=E,fly=E.phase==='fly';
      const A=sstep(Math.log(1.5),Math.log(2.2),lm);
      for(const cl of clouds){cl.y+=(fly?90*sp:6)*cl.L*dt;if(cl.y>h+80){cl.y=rnd(-180,-60);cl.x=rnd(-60,w)}}
      if(A<=.001)return;
      const[a,b]=sky(lm);c.globalAlpha=A;const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,a);g.addColorStop(1,b);c.fillStyle=g;c.fillRect(-20,-20,w+40,h+40);c.globalAlpha=1;
      // stars
      const sa=sstep(Math.log(3.5),Math.log(7),lm);if(sa>0){c.fillStyle='#fff';for(const s of stars){s.y+=(fly?40*sp:4)*s.z*dt;if(s.y>h){s.y=-2;s.x=rnd(0,w)}
        c.globalAlpha=sa*(.4+.6*Math.abs(Math.sin(t+s.tw)));if(fly&&sp>2.2&&s.z>.75)c.fillRect(s.x,s.y,1.2,2+sp*3*s.z);else c.fillRect(s.x,s.y,s.r,s.r)}c.globalAlpha=1}
      // stratosphere: curve of the Earth below and an aurora
      const st=band(lm,4.2,5.5,11,16);if(st>0){const off=clamp((lm-Math.log(5))/(Math.log(12)-Math.log(5)),0,1),R=w*2.2,cy=h+R-h*.2+off*h*.3;
        c.globalAlpha=st;const eg=c.createRadialGradient(w/2,cy,R*.92,w/2,cy,R);eg.addColorStop(0,'#0b1446');eg.addColorStop(1,'#1d3fa0');c.fillStyle=eg;c.beginPath();c.arc(w/2,cy,R,0,6.283);c.fill();
        c.save();c.shadowColor='#29e6ff';c.shadowBlur=24;c.strokeStyle='rgba(120,220,255,.9)';c.lineWidth=3;c.beginPath();c.arc(w/2,cy,R,Math.PI*1.15,Math.PI*1.85);c.stroke();c.restore();
        c.globalCompositeOperation='lighter';const cols=['43,255,136','41,230,255','255,62,165'];
        for(let r=0;r<3;r++){c.strokeStyle=`rgba(${cols[r]},${.16*st})`;c.lineWidth=28-r*7;c.beginPath();for(let x=-20;x<=w+20;x+=12){const y=h*(.2+r*.07)+Math.sin(x*.012+t*(.6+r*.2)+r)*18+Math.sin(x*.03-t)*6;x===-20?c.moveTo(x,y):c.lineTo(x,y)}c.stroke()}
        c.globalCompositeOperation='source-over';c.globalAlpha=1}
      // clouds
      const ca=band(lm,1.7,2.3,4.5,7);if(ca>0){for(const cl of clouds){const near=cl.L>1;c.globalAlpha=ca*(near?.9:.55);puff(c,cl.x,cl.y+6*cl.s,cl.s,near?'#7a2a98':'#4a1d74');puff(c,cl.x,cl.y,cl.s,near?'#f28bd2':'#a452c8')}c.globalAlpha=1}
      // open space: nebula and a ringed planet drifting past
      const sp2=band(lm,9,11,26,40);if(sp2>0){const ng=c.createRadialGradient(w*.3,h*.35,0,w*.3,h*.35,w*.8);ng.addColorStop(0,`rgba(138,92,255,${.3*sp2})`);ng.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=ng;c.fillRect(0,0,w,h);
        if(planet){planet.y+=(fly?24*sp:3)*dt;const p=planet;c.globalAlpha=sp2;c.save();c.translate(p.x,p.y);c.rotate(-.35);
          c.strokeStyle='rgba(255,208,160,.75)';c.lineWidth=p.r*.13;c.beginPath();c.ellipse(0,0,p.r*1.9,p.r*.42,0,Math.PI,0);c.stroke();
          const pg=c.createRadialGradient(-p.r*.35,-p.r*.4,p.r*.1,0,0,p.r);pg.addColorStop(0,'#ffb27a');pg.addColorStop(.6,'#c2378a');pg.addColorStop(1,'#3b1466');c.fillStyle=pg;c.beginPath();c.arc(0,0,p.r,0,6.283);c.fill();
          c.beginPath();c.ellipse(0,0,p.r*1.9,p.r*.42,0,0,Math.PI);c.stroke();c.restore();c.globalAlpha=1}}
      // moon flyby
      const ma=band(lm,22,27,55,80);if(moon&&ma>0){moon.y+=(fly?34*sp:3)*dt;const m=moon;c.globalAlpha=ma;
        const gl=c.createRadialGradient(m.x,m.y,m.r*.8,m.x,m.y,m.r*1.5);gl.addColorStop(0,'rgba(255,240,210,.22)');gl.addColorStop(1,'rgba(255,240,210,0)');c.fillStyle=gl;c.beginPath();c.arc(m.x,m.y,m.r*1.5,0,6.283);c.fill();
        const mg=c.createRadialGradient(m.x-m.r*.35,m.y-m.r*.35,m.r*.1,m.x,m.y,m.r);mg.addColorStop(0,'#fbf6e8');mg.addColorStop(.7,'#d9d2bd');mg.addColorStop(1,'#a59d88');c.fillStyle=mg;c.beginPath();c.arc(m.x,m.y,m.r,0,6.283);c.fill();
        c.fillStyle='rgba(120,110,95,.35)';craters.forEach(q=>{c.beginPath();c.arc(m.x+Math.cos(q.a)*q.d*m.r,m.y+Math.sin(q.a)*q.d*m.r,q.r*m.r,0,6.283);c.fill()});c.globalAlpha=1}
      // warp speed: streaks rushing out of the vanishing point
      const wa=sstep(Math.log(42),Math.log(55),lm);if(wa>0){const vx=w*.62,vy=h*.3;if(fly)for(let i=0;i<5;i++)warp.push({a:rnd(0,6.283),d:rnd(5,40),v:rnd(260,520)});
        c.globalCompositeOperation='lighter';c.lineWidth=2;for(let i=warp.length-1;i>=0;i--){const q=warp[i];q.d+=q.v*dt*(1+q.d/120);if(q.d>w*1.2){warp.splice(i,1);continue}
          const ca_=Math.cos(q.a),sa_=Math.sin(q.a),L=8+q.d*.25;c.strokeStyle=`hsla(${(t*140+q.a*57)%360},100%,70%,${wa*clamp(q.d/80,0,1)})`;c.beginPath();c.moveTo(vx+ca_*q.d,vy+sa_*q.d);c.lineTo(vx+ca_*(q.d+L),vy+sa_*(q.d+L));c.stroke()}
        c.globalCompositeOperation='source-over'}},
    // things that pass in front of the rocket
    drawFront(c,E){const{dt}=E;
      if(wall){wall.y+=1100*dt;const y=wall.y;for(let row=0;row<3;row++)for(let x=-40;x<w+60;x+=48){c.globalAlpha=.95;puff(c,x+(row%2)*24,y+row*46,1.25,row===1?'#f7a6dc':'#e07bc6')}c.globalAlpha=1;if(y>h+200)wall=null}
      if(sweep){sweep.t+=dt;const q=sweep.t/.6;if(q>=1)sweep=null;else{const y=-h*.2+q*h*1.4,g=c.createLinearGradient(0,y-60,0,y+60);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,`rgba(255,240,255,${.35*(1-q)})`);g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,y-60,w,120)}}}
  };
}

/* =====================================================================
   Cosmetic slots beyond rider/rocket/backdrop: exhaust trail, parachute, cash-out emote
   ===================================================================== */
const TRAILS={
  rainbow:{ru:'Радуга',en:'Rainbow'},
  fire:{ru:'Огонь',en:'Fire'},
  dollar:{ru:'Доллары',en:'Dollars'},
  pixel:{ru:'Пиксели',en:'Pixels'}
};
// one exhaust particle for a trail style; i cycles colours, t is time
function trailParticle(kind,i,t){
  if(kind==='fire')return{c:['#fff2b0','#ffd23f','#ff9f1c','#ff5a1a'][i%4],shape:'dot',smoke:true};
  if(kind==='dollar')return{c:i%3?'#2bff88':'#b9ffd9',shape:'glyph',glyph:'$'};
  if(kind==='pixel')return{c:['#29e6ff','#ff3ea5','#ffd23f'][i%3],shape:'sq'};
  return{c:['#2bff88','#ffd23f','#ff3ea5','#29e6ff'][Math.floor((t*8+i)%4)],shape:'dot'};
}
// static trail for previews, drawn behind a rocket tail at (x,y) heading ang
function drawTrailPreview(c,kind,x,y,ang,s,len,t){const dx=Math.cos(ang),dy=Math.sin(ang);c.save();
  for(let i=0;i<len;i++){const d=(18+i*5.4)*s,wob=Math.sin(i*.45+t*6)*i*.2*s,px=x-dx*d-dy*wob,py=y-dy*d+dx*wob,a=1-i/len,p=trailParticle(kind,i,t+i*.02);
    c.globalAlpha=a*.9;c.fillStyle=p.c;const r=Math.max(1,9.5-i*.17)*s;
    if(p.shape==='glyph'){if(i%3)continue;c.font=`900 ${Math.round(r*2)}px Unbounded,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(p.glyph,px,py)}
    else if(p.shape==='sq'){if(i%2)continue;c.fillRect(px-r*.8,py-r*.8,r*1.6,r*1.6)}
    else{c.globalCompositeOperation='lighter';c.beginPath();c.arc(px,py,r,0,6.283);c.fill();c.globalCompositeOperation='source-over'}}
  c.restore()}

const CHUTES={
  rainbow:{ru:'Радужный',en:'Rainbow',cols:['#ff3ea5','#ffd23f','#2bff88','#29e6ff','#8a5cff','#ff3ea5','#ffd23f'],rim:'#ffffff'},
  bag:{ru:'Мешок денег',en:'Money Bag',cols:['#2bff88','#16c865','#2bff88','#16c865','#2bff88','#16c865','#2bff88'],rim:'#b9ffd9',sign:'$'},
  gold:{ru:'Золотой',en:'Golden',cols:['#fff0a8','#ffc21a','#ffe27a','#e0a300','#ffe27a','#ffc21a','#fff0a8'],rim:'#fff3c4',shine:1}
};
// canopy dome of radius 28 centred at (0,0), opening downwards
function drawCanopy(c,id){const ch=CHUTES[id]||CHUTES.rainbow,n=ch.cols.length;
  for(let i=0;i<n;i++){c.fillStyle=ch.cols[i];c.beginPath();c.moveTo(0,0);c.arc(0,0,28,Math.PI+i*Math.PI/n,Math.PI+(i+1)*Math.PI/n);c.closePath();c.fill()}
  c.fillStyle='rgba(255,255,255,.25)';c.beginPath();c.ellipse(-8,-18,10,4,-.4,0,6.283);c.fill();
  if(ch.shine){c.fillStyle='rgba(255,255,255,.55)';c.beginPath();c.arc(10,-20,2.4,0,6.283);c.arc(-16,-10,1.6,0,6.283);c.fill()}
  if(ch.sign){c.fillStyle='#0b3d22';c.font='900 16px Unbounded,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(ch.sign,0,-13)}
  c.strokeStyle=ch.rim;c.lineWidth=1.2;c.beginPath();c.arc(0,0,28,Math.PI,0);c.stroke()}

const EMOTES={
  cheer:{ru:'Ликование',en:'Cheer'},
  fireworks:{ru:'Салют',en:'Fireworks'},
  money:{ru:'Денежный дождь',en:'Money Rain'}
};
