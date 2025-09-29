/********* Palette & knobs *********/
const PALETTE = {
  bgSpace:   "#0a0a14",
  haze:      "rgba(96,166,200,0.14)",    // ambient haze over creature
  nucleus:   "rgba(210,245,255,0.90)",   // bright core
  membrane:  "rgba(160,235,255,0.22)",   // amoeba body
  rimAqua:   "rgba(127,233,255,0.85)",
  rimMag:    "rgba(255,115,211,0.50)",
  motes:     "rgba(200,220,255,0.65)"
};

const SPEED = {
  breathe: 0.8,   // Hz of slow breathing
  ripple:  0.35,  // inner ripple band motion
  sway:    0.6,   // overall organism sway
  tendril: 0.9    // pseudopod wiggle
};

let HEALTH   = 0.55;  // 0..1
let MUTATION = 0.08;  // 0..1  (drives “weirdness”: wobble + pseudopods count)

/********* Canvas *********/
const canvas = document.getElementById('org-canvas');
const ctx = canvas.getContext('2d', { alpha: true });

function resize(){
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width  = Math.floor(innerWidth  * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width  = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener('resize', resize); resize();

/********* Tiny helpers *********/
const TAU = Math.PI*2;
const clamp = (v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp  = (a,b,t)=>a+(b-a)*t;

/* lightweight pseudo-noise: sum of sines for organic wobble */
function blobNoise(theta, t){
  // 3 layered sines, de-phased; MUTATION scales the amplitude
  const k1 = Math.sin(theta*3 + t*1.1);
  const k2 = Math.sin(theta*5 - t*0.7 + 1.7);
  const k3 = Math.sin(theta*7 + t*0.3 + 0.6);
  return (k1*0.6 + k2*0.3 + k3*0.2) * (0.05 + MUTATION*0.35);
}

/********* Scene state *********/
const motes = Array.from({length: 80}, () => ({
  x: Math.random()*innerWidth,
  y: Math.random()*innerHeight,
  z: Math.random()*0.6 + 0.4,           // parallax 0.4..1
  a: Math.random()*TAU
}));

/********* Drawing *********/
function drawBackground(t){
  // starry dots
  ctx.fillStyle = PALETTE.bgSpace;
  ctx.fillRect(0,0,innerWidth,innerHeight);

  ctx.save();
  ctx.globalAlpha = 0.6;
  for (const m of motes){
    m.a += 0.002*m.z;
    m.x += Math.cos(m.a)*0.15*m.z;
    m.y += Math.sin(m.a*0.9)*0.12*m.z;

    // wrap
    if (m.x < -10) m.x = innerWidth+10;
    if (m.x > innerWidth+10) m.x = -10;
    if (m.y < -10) m.y = innerHeight+10;
    if (m.y > innerHeight+10) m.y = -10;

    ctx.beginPath();
    ctx.fillStyle = PALETTE.motes;
    ctx.globalAlpha = 0.2 + 0.6*m.z;
    ctx.arc(m.x, m.y, 0.8 + 1.4*m.z, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // soft vignette left/right to suggest fluid volume
  const gradL = ctx.createLinearGradient(0,0, Math.min(360, innerWidth*0.2),0);
  gradL.addColorStop(0, "rgba(255,0,170,0.06)");
  gradL.addColorStop(1, "rgba(255,0,170,0.00)");
  ctx.fillStyle = gradL;
  ctx.fillRect(0,0,innerWidth,innerHeight);

  const gradR = ctx.createLinearGradient(innerWidth,0, innerWidth-Math.min(360, innerWidth*0.2),0);
  gradR.addColorStop(0, "rgba(0,180,255,0.06)");
  gradR.addColorStop(1, "rgba(0,180,255,0.00)");
  ctx.fillStyle = gradR;
  ctx.fillRect(0,0,innerWidth,innerHeight);
}

function drawAmoeba(t){
  const cx = innerWidth*0.5 + Math.sin(t*0.3)*6;   // gentle sway
  const cy = innerHeight*0.58 + Math.cos(t*0.27)*5;

  // heartbeat
  const hb = 0.04*Math.sin(t*SPEED.breathe*TAU) + 0.02;

  // base radius scales with HEALTH (but keep visually nice)
  const R = Math.min(innerWidth, innerHeight)*0.14 * (0.9 + 0.25*HEALTH + hb);

  // ---- membrane path (blobby circle) ----
  const pts = 180; // smooth
  ctx.save();

  // ambient haze below
  ctx.beginPath();
  for (let i=0;i<=pts;i++){
    const a = (i/pts)*TAU;
    const r = R * (1 + blobNoise(a, t*0.8));
    const x = cx + Math.cos(a)*r*1.25;  // haze slightly larger
    const y = cy + Math.sin(a)*r*1.25;
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
  ctx.fillStyle = PALETTE.haze;
  ctx.shadowColor = "rgba(100,200,255,0.2)";
  ctx.shadowBlur = 40;
  ctx.fill();
  ctx.shadowBlur = 0;

  // membrane fill
  ctx.beginPath();
  for (let i=0;i<=pts;i++){
    const a = (i/pts)*TAU;
    const r = R * (1 + blobNoise(a, t*0.8));
    const x = cx + Math.cos(a)*r;
    const y = cy + Math.sin(a)*r;
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();

  const gMem = ctx.createRadialGradient(cx, cy, R*0.1, cx, cy, R*1.0);
  gMem.addColorStop(0.00, "rgba(210,245,255,0.12)");
  gMem.addColorStop(0.65, "rgba(110,210,235,0.10)");
  gMem.addColorStop(1.00, "rgba(50,80,120,0.08)");
  ctx.fillStyle = gMem;
  ctx.fill();

  // aqua/magenta rim (irregular thickness)
  ctx.lineWidth = 3.0 + 2.0*Math.sin(t*0.7);
  const rim = ctx.createLinearGradient(cx-R, cy-R, cx+R, cy+R);
  rim.addColorStop(0, PALETTE.rimAqua);
  rim.addColorStop(1, PALETTE.rimMag);
  ctx.strokeStyle = rim;
  ctx.globalAlpha = 0.8;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // nucleus (core + bloom + specular glint)
  const rCore = R*0.38;
  const g = ctx.createRadialGradient(cx,cy, rCore*0.2, cx,cy, rCore*1.35);
  g.addColorStop(0, PALETTE.nucleus);
  g.addColorStop(1, "rgba(255,255,255,0.0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, rCore, 0, TAU);
  ctx.fill();

  // specular flicker (tiny moving highlight to feel moist)
  const glx = cx + Math.cos(t*1.2)*rCore*0.35;
  const gly = cy + Math.sin(t*0.9)*rCore*0.25;
  const gl = ctx.createRadialGradient(glx,gly, 0, glx,gly, rCore*0.9);
  gl.addColorStop(0, "rgba(255,255,255,0.35)");
  gl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.arc(glx, gly, rCore*0.9, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // inner echo rings (very soft)
  for (let i=1;i<=3;i++){
    const rr = lerp(rCore*1.1, R*0.9, i/3);
    ctx.beginPath();
    ctx.arc(cx, cy, rr + Math.sin(t*SPEED.ripple + i)*3, 0, TAU);
    ctx.strokeStyle = `rgba(180,140,255,${0.18 - i*0.045})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // pseudopods (mutation-controlled)
  drawPseudopods(cx, cy, R, t);

  ctx.restore();
}

function drawPseudopods(cx,cy,R,t){
  const count = Math.floor( lerp(1, 7, clamp(MUTATION*1.4)) );
  for (let i=0;i<count;i++){
    const baseA = (i/count)*TAU + t*0.2;     // anchor angle
    const rEdge = R * (1 + 0.02*Math.sin(t + i));
    const ax = cx + Math.cos(baseA)*rEdge;
    const ay = cy + Math.sin(baseA)*rEdge;

    // tip target sways around organism
    const L  = R * (0.8 + 0.8*Math.sin(t*SPEED.tendril + i*1.7));
    const tipA = baseA + 0.5*Math.sin(t*0.9 + i);
    const tx = cx + Math.cos(tipA)*L;
    const ty = cy + Math.sin(tipA)*L;

    // control points for organic curve
    const mx = (ax+tx)/2 + Math.cos(t + i)*R*0.12;
    const my = (ay+ty)/2 + Math.sin(t*1.1 + i*0.7)*R*0.12;

    ctx.beginPath();
    ctx.moveTo(ax,ay);
    ctx.quadraticCurveTo(mx,my, tx,ty);

    const w = 2.0 + 2.0*Math.max(0, Math.sin(t*1.3 + i));
    ctx.lineWidth = w;
    ctx.strokeStyle = `rgba(255,115,211,${0.65 - 0.08*i})`; // magenta trail
    ctx.shadowColor = "rgba(255,140,220,0.45)";
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // bright biolum tip
    ctx.beginPath();
    ctx.arc(tx,ty, 2.4 + 0.8*Math.sin(t*1.7+i), 0, TAU);
    ctx.fillStyle = "rgba(127,233,255,0.85)";
    ctx.fill();
  }
}

/********* Loop *********/
let start = performance.now();
function loop(now){
  const t = (now - start)/1000;

  drawBackground(t);
  drawAmoeba(t);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/********* Minimal interactions *********/
document.getElementById('feedBtn')?.addEventListener('click', (e)=>{
  e.preventDefault();
  // feeding bumps health a bit, mutation drifts slightly
  HEALTH = clamp(HEALTH + 0.06, 0, 1);
  MUTATION = clamp(MUTATION + (Math.random()*0.06 - 0.02), 0, 1);
});
document.getElementById('tradeBtn')?.addEventListener('click', (e)=>{
  // wire to your swap URL if you want
  e.currentTarget.href = "#";
});
