/************ Setup ************/
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

/************ Palette (dark space + womb glow) ************/
const PAL = {
  space:    "#0b0e16",
  nebulaA:  "rgba(150, 20, 200, 0.06)",
  nebulaB:  "rgba(20, 180, 255, 0.05)",
  womb     : "rgba(240, 80, 120, 0.06)",     // very subtle red haze
  skin     : "rgba(255, 205, 200, 0.55)",    // soft warm light on skin
  rim      : "rgba(255, 255, 255, 0.55)",    // specular
  subRim   : "rgba(255, 120, 180, 0.25)",    // subsurface scattering tint
  eye      : "#0f1120",
  eyeGlow  : "rgba(200, 240, 255, 0.7)",
  magenta  : "#de5bd7",
  aqua     : "#6bd7ff",
  cord     : "rgba(255, 180, 160, 0.8)",
  cordHalo : "rgba(255, 180, 160, 0.25)",
};

/************ Knobs ************/
const K = {
  breatheHz: 0.08,           // breathing speed
  blinkHz:   0.035,          // eyelid close/open
  pulseHz:   0.9,            // heart pulse used for glints
  swayHz:    0.02,           // gentle whole-body sway
  baseScale: 1.1,            // overall size
  grain:     0.075,          // membrane wobble strength
};

/************ Helpers ************/
const TAU = Math.PI * 2;
const clamp = (v, lo=0, hi=1) => Math.max(lo, Math.min(hi, v));
const lerp  = (a,b,t) => a + (b-a)*t;
const ease  = t => 0.5 - 0.5*Math.cos(Math.PI*t);

/************ Drawing primitives ************/
function ringGradient(cx, cy, r0, r1, c0, c1) {
  const g = ctx.createRadialGradient(cx,cy,r0, cx,cy,r1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

function bezierCircleish(cx, cy, r, wobble, t) {
  // builds a slightly organic blobby path (closed)
  const k = 0.552284749831; // circle control constant
  const w = wobble * (Math.sin(t*1.7)+Math.cos(t*1.23))*0.5;
  const r1 = r * (1 + w*0.6);
  const r2 = r * (1 - w*0.4);

  ctx.beginPath();
  ctx.moveTo(cx + r1, cy);
  ctx.bezierCurveTo(cx + r1, cy + k*r1, cx + k*r1, cy + r1, cx, cy + r1);
  ctx.bezierCurveTo(cx - k*r2, cy + r2, cx - r2, cy + k*r2, cx - r2, cy);
  ctx.bezierCurveTo(cx - r2, cy - k*r2, cx - k*r1, cy - r1, cx, cy - r1);
  ctx.bezierCurveTo(cx + k*r1, cy - r1, cx + r1, cy - k*r1, cx + r1, cy);
  ctx.closePath();
}

function pill(x,y,w,h, r){
  r = Math.min(r, h/2, w/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y, x+w,y+h, r);
  ctx.arcTo(x+w,y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y,   r);
  ctx.arcTo(x, y,   x+w, y, r);
  ctx.closePath();
}

/************ Creature ************/
function drawUmbilical(cx, cy, t, scale){
  // Gently wavering cord leaving belly to left/top edge
  const len = 280*scale;
  const sway = Math.sin(t*K.swayHz*TAU)*50*scale;

  const ax = cx - 18*scale;
  const ay = cy + 12*scale;
  const bx = ax - len*0.45;
  const by = ay - len*0.35 + sway*0.25;
  const cx2= ax - len*0.9;
  const cy2= ay - len*0.1 + sway;

  // halo
  ctx.lineWidth = 14*scale;
  ctx.strokeStyle = PAL.cordHalo;
  ctx.beginPath();
  ctx.moveTo(ax,ay);
  ctx.quadraticCurveTo(bx,by, cx2,cy2);
  ctx.stroke();

  // cord
  ctx.lineWidth = 6*scale;
  ctx.strokeStyle = PAL.cord;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ax,ay);
  ctx.quadraticCurveTo(bx,by, cx2,cy2);
  ctx.stroke();

  // glowing tip
  ctx.fillStyle = PAL.cord;
  ctx.beginPath();
  ctx.arc(ax,ay, 5*scale, 0, TAU);
  ctx.fill();
}

function drawEye(cx, cy, r, t){
  // iris + pupil + specular blink
  const breathe = 0.06*Math.sin(t*K.breatheHz*TAU);
  const irisR = r*(0.38 + breathe);
  const pupilR = r*0.18;

  // iris glow
  ctx.fillStyle = ringGradient(cx,cy, irisR*0.3, irisR*1.25, "rgba(180,220,255,0.9)","rgba(80,140,200,0.05)");
  ctx.beginPath(); ctx.arc(cx,cy, irisR, 0, TAU); ctx.fill();

  // pupil
  ctx.fillStyle = PAL.eye;
  ctx.beginPath(); ctx.arc(cx,cy, pupilR, 0, TAU); ctx.fill();

  // specular glint (heart-synced)
  const gl = 0.45 + 0.35*Math.max(0, Math.sin(t*K.pulseHz*TAU));
  ctx.fillStyle = `rgba(255,255,255,${0.65*gl})`;
  pill(cx - pupilR*0.6, cy - pupilR*0.9, pupilR*0.9, pupilR*0.6, pupilR*0.3);
  ctx.fill();
}

function drawLimbBud(ax, ay, dir, t, scale){
  // Little translucent flipper that opens/closes
  const open = 0.35 + 0.25*ease((Math.sin(t*0.8 + dir*1.7)+1)/2);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(dir);
  ctx.fillStyle = "rgba(200,240,255,0.10)";
  ctx.strokeStyle = "rgba(200,240,255,0.25)";
  ctx.lineWidth = 2*scale;
  ctx.beginPath();
  ctx.moveTo(0,0);
  ctx.quadraticCurveTo(40*scale*open, -12*scale, 60*scale*open, 0);
  ctx.quadraticCurveTo(40*scale*open, 18*scale, 0, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawBody(cx, cy, t, scale){
  // “Embryo” silhouette: big head, neck, torso curl
  const breathe = 1 + 0.035*Math.sin(t*K.breatheHz*TAU);
  const headR = 60*scale*breathe;
  const torsoR= 44*scale*breathe;

  // soft nebula / uterus haze
  const g = ctx.createRadialGradient(cx,cy, 20*scale, cx,cy, 420*scale);
  g.addColorStop(0.0, PAL.nebulaB);
  g.addColorStop(0.45, PAL.womb);
  g.addColorStop(1.0, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx,cy, 420*scale, 0, TAU); ctx.fill();

  // membrane halo
  bezierCircleish(cx, cy, torsoR*2.0, K.grain, t);
  ctx.strokeStyle = "rgba(120,210,255,0.08)";
  ctx.lineWidth = 22*scale;
  ctx.stroke();

  // torso (subsurface)
  bezierCircleish(cx, cy+8*scale, torsoR*1.2, K.grain*0.8, t+0.3);
  ctx.fillStyle = PAL.skin;
  ctx.fill();

  // head (large bulb)
  bezierCircleish(cx, cy - 32*scale, headR*1.05, K.grain*0.7, t);
  ctx.fillStyle = PAL.skin;
  ctx.fill();

  // rim lights
  ctx.lineWidth = 2*scale;
  ctx.strokeStyle = PAL.rim;
  bezierCircleish(cx, cy-32*scale, headR*1.05, K.grain*0.7, t);
  ctx.stroke();
  ctx.strokeStyle = PAL.subRim;
  bezierCircleish(cx, cy+8*scale, torsoR*1.2, K.grain*0.8, t+0.3);
  ctx.stroke();

  // faint “veins” (sine squiggle under skin)
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = "rgba(150,210,255,0.35)";
  ctx.lineWidth = 1.25*scale;
  ctx.beginPath();
  for(let a=-Math.PI*0.7; a<=Math.PI*0.7; a+=0.2){
    const rr = torsoR*0.9 + 4*Math.sin(t*0.9 + a*5);
    const x = cx + rr*Math.cos(a);
    const y = cy+8*scale + rr*Math.sin(a);
    if(a === -Math.PI*0.7) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();
  ctx.restore();

  // limb buds (2 arms, 2 legs: abstract fins)
  drawLimbBud(cx+torsoR*0.6, cy,  Math.PI*0.07, t, scale);
  drawLimbBud(cx+torsoR*0.45, cy+torsoR*0.4,  Math.PI*0.45, t+0.3, scale);
  drawLimbBud(cx-torsoR*0.5,  cy+torsoR*0.2, -Math.PI*0.65, t+0.6, scale);
  drawLimbBud(cx-torsoR*0.4,  cy-0.1*torsoR, -Math.PI*0.25, t+0.9, scale);

  // eye (gives it instant “alive” feel)
  drawEye(cx, cy - 26*scale, headR*0.9, t);
}

function drawMembrane(cx, cy, t, scale){
  // rippled echo rings around body
  const baseR = 100*scale;
  for(let i=0;i<6;i++){
    const r = baseR + i*26*scale + 4*scale*Math.sin(t*0.8 + i*0.9);
    ctx.beginPath(); ctx.arc(cx,cy, r, 0, TAU);
    ctx.strokeStyle = `rgba(120,200,255,${0.10 - i*0.012})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawBackground(t){
  // starfield + vignette
  ctx.fillStyle = PAL.space;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // vignette curtains
  const vg = ctx.createRadialGradient(canvas.width*0.5, canvas.height*0.6, canvas.height*0.25,
                                      canvas.width*0.5, canvas.height*0.6, canvas.height*0.9);
  vg.addColorStop(0,"rgba(0,0,0,0)");
  vg.addColorStop(1,"rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // sparse stars
  ctx.fillStyle = "rgba(220,240,255,0.7)";
  const seed = 32;
  for(let i=0;i<seed;i++){
    const x = (i*179 + Math.sin(t*0.05+i)*9999) % canvas.width;
    const y = (i*97  + Math.cos(t*0.04+i*2)*7777) % canvas.height;
    const s = 0.6 + 0.6*Math.max(0, Math.sin(t*0.6 + i));
    ctx.globalAlpha = 0.25 + 0.55*s;
    ctx.fillRect(x, y, 1.25, 1.25);
  }
  ctx.globalAlpha = 1;
}

/************ Main loop ************/
let t0 = performance.now();
function draw(){
  const now = performance.now();
  const t = (now - t0) / 1000; // seconds

  drawBackground(t);

  const cx = canvas.width*0.5;
  const cy = canvas.height*0.58;
  const scale = Math.min(canvas.width, canvas.height)/900 * K.baseScale;

  // subtle parallax drift
  ctx.save();
  const drift = Math.sin(t*K.swayHz*TAU)*8*scale;
  ctx.translate(drift, -drift*0.6);

  // echo membrane first (behind)
  drawMembrane(cx, cy, t, scale);

  // umbilical
  drawUmbilical(cx, cy+10*scale, t, scale);

  // the organism
  drawBody(cx, cy, t, scale);

  ctx.restore();

  requestAnimationFrame(draw);
}
draw();
