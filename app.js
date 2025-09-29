/* THE ORGANISM — recognizable alien:
   head (with blinking eyes), torso, two arms, two legs, single umbilical tether,
   soft fins & glow, drifting stars. Pure Canvas.
*/

const C = document.getElementById("org-canvas");
const ctx = C.getContext("2d", { alpha:true });

let DPR=1, W=0, H=0;
function resize(){
  DPR = Math.min(2, devicePixelRatio||1);
  W = C.width  = Math.floor(innerWidth * DPR);
  H = C.height = Math.floor(innerHeight * DPR);
  C.style.width  = innerWidth + "px";
  C.style.height = innerHeight + "px";
}
resize(); addEventListener("resize", resize);

const PAL = {
  space: "#070914",
  star:  "rgba(210,220,255,.75)",
  core:  "rgba(250,255,255,.95)",
  skin:  "rgba(140,220,245,.20)",
  rimA:  "rgba(135,235,255,0.45)",
  rimB:  "rgba(255,121,211,0.50)",
  finA:  "rgba(110,230,230,0.20)",
  finB:  "rgba(255,140,230,0.18)",
  vein:  "rgba(180,220,255,0.08)",
  tetherA:"rgba(255,121,211,0.95)",
  tetherB:"rgba(120,230,255,0.95)",
  iris:  "rgba(210,240,255,0.9)",
  sclera:"rgba(245,255,255,0.95)",
  pupil: "rgba(20,30,40,.9)",
  hazeM: "rgba(200,120,255,0.06)",
  hazeA: "rgba(120,200,255,0.06)",
};

const rnd = (s=>()=> (s = (s*1664525+1013904223)>>>0, s/0xffffffff) )(0xA53B9D1);
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* stars */
const STARS = Array.from({length: 90}, ()=>({
  x:rnd(), y:rnd(), z:.35+rnd()*1.1, r:.8+rnd()*1.8, p:rnd()*6.283
}));

/* life stats that can tie into your backend later */
let health   = 0.68;  // 0..1 (affects glow + tether thickness)
let mutation = 0.42;  // 0..1 (affects fins/veins amplitude)
const center = ()=>({ x: W*0.5, y: H*0.58 });

/* helpers */
const S = Math.sin, Cc = Math.cos; const TAU=6.283;

/* -------- backdrop -------- */
function backdrop(t){
  ctx.fillStyle = PAL.space; ctx.fillRect(0,0,W,H);

  // nebula curtains
  const L = ctx.createLinearGradient(0,0, W*.22,0);
  L.addColorStop(0, PAL.hazeM); L.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=L; ctx.fillRect(0,0,W,H);
  const R = ctx.createLinearGradient(W,0, W*.78,0);
  R.addColorStop(0, PAL.hazeA); R.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=R; ctx.fillRect(W*.78,0, W*.22, H);

  // echo rings
  const {x:cx,y:cy}=center();
  ctx.save();
  ctx.globalAlpha=.10;
  ctx.strokeStyle="rgba(150,180,230,.45)";
  ctx.lineWidth=1*DPR;
  for(let r=220*DPR;r<Math.max(W,H);r+=130*DPR){
    ctx.beginPath(); ctx.arc(cx,cy, r + S(t*.33 + r*.002)*6*DPR, 0, TAU); ctx.stroke();
  }
  ctx.restore();

  // stars
  for(const m of STARS){
    const x = m.x*W + Math.sin(t*.07+m.p)*14*m.z;
    const y = m.y*H + Math.cos(t*.05+m.p)*16*m.z;
    ctx.globalAlpha = .18 + .7*Math.abs(Math.sin(t*.38 + m.p));
    ctx.fillStyle = PAL.star;
    ctx.beginPath(); ctx.arc(x,y,m.r*DPR,0,TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* -------- creature geometry --------
   We draw a stylized biped:
   - Torso (rounded capsule), Head (rounded), Eyes (blink), Arms & Legs (bezier limbs).
   - Semi-translucent fins on back, faint veins, single umbilical tether.
*/
function drawCreature(t){
  const {x:cx, y:cy} = center();

  // subtle body hover
  const hoverY = 10*DPR * Math.sin(t*0.9);
  const tilt   = 0.05*Math.sin(t*0.7);

  // sizes
  const torsoW = 150*DPR, torsoH = 210*DPR;
  const headR  = 48*DPR;

  ctx.save();
  ctx.translate(cx, cy+hoverY);
  ctx.rotate(tilt);

  /* dorsal fins */
  drawFin(-Math.PI*0.9, 120, 180, t);
  drawFin( Math.PI*0.2,  140, 150, t);
  drawFin( Math.PI*0.7,  110, 160, t);

  /* torso (capsule) */
  const grd = ctx.createLinearGradient(-torsoW*.3,-torsoH*.4, torsoW*.4, torsoH*.6);
  grd.addColorStop(0, "rgba(120,220,245,.18)");
  grd.addColorStop(1, "rgba(255,120,210,.16)");
  roundedCapsule(-torsoW/2, -torsoH/2, torsoW, torsoH, 40*DPR, grd, PAL.rimA);

  // faint veins across torso
  drawVeinsField(t, -torsoW/2, -torsoH/2, torsoW, torsoH);

  /* head */
  ctx.save();
  ctx.translate(0, -torsoH/2 - headR*0.5);
  drawHead(t, headR);
  ctx.restore();

  /* arms */
  const armLen = 120*DPR;
  limbBezier(-torsoW*0.45, -torsoH*0.2, -armLen, 40*DPR, t, 0, true);   // left arm
  limbBezier( torsoW*0.45, -torsoH*0.25,  armLen, 60*DPR, t, 1, true);  // right arm

  /* legs */
  const legLen = 140*DPR;
  limbBezier(-torsoW*0.25,  torsoH*0.35, -legLen, 70*DPR, t, 2, false);
  limbBezier( torsoW*0.25,  torsoH*0.35,  legLen, 70*DPR, t, 3, false);

  ctx.restore();

  /* umbilical tether attaches near navel */
  const attachX = cx + Math.cos(t*0.6)*6*DPR;
  const attachY = cy + hoverY + torsoH*0.05 + Math.sin(t*0.9)*4*DPR;
  drawTether(t, attachX, attachY);
}

/* rounded capsule helper */
function roundedCapsule(x,y,w,h,r, fill, rim){
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  const rr = Math.min(r, Math.min(w,h)/2);
  // top semicircle
  ctx.moveTo(x, y+rr);
  ctx.quadraticCurveTo(x, y, x+rr, y);
  ctx.lineTo(x+w-rr, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+rr);
  ctx.lineTo(x+w, y+h-rr);
  ctx.quadraticCurveTo(x+w, y+h, x+w-rr, y+h);
  ctx.lineTo(x+rr, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-rr);
  ctx.closePath();
  ctx.fill();

  // rim
  ctx.globalAlpha=.7; ctx.strokeStyle=rim; ctx.lineWidth=2*DPR;
  ctx.stroke(); ctx.globalAlpha=1;
  ctx.restore();
}

/* dorsal fin (kite-like) */
function drawFin(angle, span, len, t){
  ctx.save();
  ctx.rotate(angle + 0.05*Math.sin(t*0.8 + angle));
  const g = ctx.createLinearGradient(0,0, 0, len*DPR);
  g.addColorStop(0, PAL.finA);
  g.addColorStop(1, PAL.finB);
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.moveTo(0, 40*DPR);
  ctx.lineTo(-span*0.4*DPR, len*DPR);
  ctx.lineTo( span*0.4*DPR, len*DPR);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* veins field inside a rect */
function drawVeinsField(t, x,y,w,h){
  ctx.save();
  ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  ctx.strokeStyle = PAL.vein; ctx.lineWidth = .9*DPR;
  const paths = 6;
  for(let i=0;i<paths;i++){
    const px = x + (i+0.2)/(paths-0.2)*w + Math.sin(t*.8+i)*8*DPR;
    const y0 = y + h*0.1 + 10*DPR*Math.sin(t*.7+i);
    const y1 = y + h*0.9 + 10*DPR*Math.cos(t*.6+i);
    const xm = px + 30*DPR*Math.sin(t*.9+i);
    ctx.beginPath(); ctx.moveTo(px, y0); ctx.quadraticCurveTo(xm, (y0+y1)/2, px, y1); ctx.stroke();
  }
  ctx.restore();
}

/* head + eyes (blink) */
function drawHead(t, r){
  // glow
  const g = ctx.createRadialGradient(0,0, r*0.2, 0,0, r*1.6);
  g.addColorStop(0, PAL.sclera);
  g.addColorStop(1, "rgba(160,210,255,.12)");
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,r*1.2,0,TAU); ctx.fill();

  ctx.fillStyle="rgba(120,220,245,.22)"; ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.fill();
  ctx.lineWidth=2*DPR; ctx.strokeStyle=PAL.rimA; ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.stroke();

  // eyes (two) with blink
  const sep = r*0.6;
  const blink = clamp(Math.abs(Math.sin(t*1.2))*1.1, 0.15, 1); // 0.15..1
  drawEye(-sep*0.5, -r*0.05, r*0.30, blink);
  drawEye( sep*0.5, -r*0.05, r*0.30, blink*0.9);
}

/* single eye */
function drawEye(x,y, R, blink){
  ctx.save(); ctx.translate(x,y);
  // iris ring
  ctx.globalAlpha=.9; ctx.strokeStyle="rgba(200,230,255,.8)"; ctx.lineWidth=1.6*DPR;
  ctx.beginPath(); ctx.arc(0,0,R,0,TAU); ctx.stroke(); ctx.globalAlpha=1;
  // sclera
  ctx.fillStyle=PAL.sclera; ctx.beginPath(); ctx.arc(0,0,R*0.75,0,TAU); ctx.fill();
  // pupil ellipse (blink compresses)
  const ry = R*0.45*blink, rx = R*0.22;
  ctx.fillStyle=PAL.pupil;
  ctx.beginPath(); ctx.ellipse(0,0, rx, ry, 0, 0, TAU); ctx.fill();
  // catchlight
  ctx.fillStyle="rgba(255,255,255,.6)";
  ctx.beginPath(); ctx.arc(-rx*0.7, -ry*0.6, 2.2*DPR, 0, TAU); ctx.fill();
  ctx.restore();
}

/* limbs (arms/legs) as bezier with gentle sway */
function limbBezier(px, py, len, arc, t, index, isArm){
  ctx.save();
  const sway = (isArm? 0.4:0.25) * Math.sin(t*(isArm?1.2:.9) + index);
  const thickness = (isArm? 5.5:7.5)*DPR * (0.6 + 0.6*health);
  const colA = `rgba(160,230,255,${isArm?.28:.24})`.replace('?.28', isArm?'.28':'.24'); // just for readability

  const mx = px + (len/2) + arc*Math.sin(t*0.8+index);
  const my = py + (isArm?-40:60)*DPR + arc*0.4*Math.cos(t*0.7+index) + sway*20*DPR;

  ctx.lineCap="round";
  const grad = ctx.createLinearGradient(px,py, px+len, py);
  grad.addColorStop(0, "rgba(120,220,245,.55)");
  grad.addColorStop(1, "rgba(255,120,210,.65)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(px,py);
  ctx.quadraticCurveTo(mx,my, px+len, py + (isArm? 20*DPR : 60*DPR));
  ctx.stroke();

  // claw/foot tip glow
  const tipx = px+len, tipy = py + (isArm? 20*DPR : 60*DPR);
  const tip = ctx.createRadialGradient(tipx,tipy,0, tipx,tipy, 10*DPR);
  tip.addColorStop(0,"rgba(255,255,255,.35)");
  tip.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=tip; ctx.beginPath(); ctx.arc(tipx,tipy,10*DPR,0,TAU); ctx.fill();

  ctx.restore();
}

/* single umbilical tether */
function drawTether(t, x, y){
  const baseR=220*DPR;
  const ang = t*.32 + 1.8;
  const ax = x + Math.cos(ang)*baseR;
  const ay = y + Math.sin(ang)*baseR;
  const sway = 30*DPR*Math.sin(t*.8 + 2.1);
  const mx = (ax+x)/2 + sway;
  const my = (ay+y)/2 - sway*0.6;

  const grad = ctx.createLinearGradient(ax,ay,x,y);
  grad.addColorStop(0, PAL.tetherB);
  grad.addColorStop(1, PAL.tetherA);
  ctx.lineCap="round";
  ctx.strokeStyle=grad;
  ctx.lineWidth = 3.2*DPR*(.6 + .9*health*(.7+.3*Math.sin(t*1.3)));
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(mx,my,x,y); ctx.stroke();

  // tip glow
  const tip = ctx.createRadialGradient(x,y,0, x,y, 18*DPR);
  tip.addColorStop(0,"rgba(255,255,255,.45)");
  tip.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=tip; ctx.beginPath(); ctx.arc(x,y,18*DPR,0,TAU); ctx.fill();
}

/* -------- main loop -------- */
let t0 = performance.now();
function frame(){
  requestAnimationFrame(frame);
  const t=(performance.now()-t0)/1000;

  backdrop(t);
  drawCreature(t);
}
frame();

/* -------- simple life sim (replace later) -------- */
setInterval(()=>{
  // mutation wanders
  mutation = clamp(mutation + (Math.random()-0.5)*0.02, 0, 1);
  // health breath + slight noise
  const beat = 0.02*Math.sin(performance.now()*0.003);
  health = clamp(health + (Math.random()-0.5)*0.012 + beat, 0.15, 0.98);
}, 1200);
