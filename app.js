/*******************************
 * ORGANISM.ZERO — Creature pass
 * - Eye-like core (iris + pupil) that blinks
 * - Veins from the core, slight twitch
 * - Spine ridge (darker density path)
 * - Cilia (tiny hairs) along membrane
 * - Asymmetric pseudopods (tips glow)
 * - Parallax motes + deep neon palette
 *******************************/

/* ===== Tunables ===== */
const PALETTE = {
  space:   "#090914",
  haze:    "rgba(90,150,200,0.10)",   // ambient haze envelope
  bodyIn:  "rgba(140,210,230,0.12)",  // body gradient inner
  bodyOut: "rgba(60,90,130,0.10)",    // body gradient outer
  rimA:    "rgba(120,235,255,0.80)",  // aqua rim
  rimM:    "rgba(255,115,211,0.55)",  // magenta rim
  irisA:   "rgba(120,230,255,0.85)",  // iris glow
  irisB:   "rgba(130,200,255,0.25)",
  pupil:   "rgba(10,12,22,0.90)",
  glint:   "rgba(255,255,255,0.40)",
  vein:    "rgba(160,210,240,0.18)",
  cilia:   "rgba(190,230,255,0.35)",
  tip:     "rgba(127,233,255,0.90)",
  trail:   "rgba(255,140,220,0.45)",
  mote:    "rgba(200,220,255,0.65)"
};

const SPEED = {
  breathe: 0.8,   // core pulse
  sway:    0.55,  // organism drift
  blink:   0.06,  // blink chance controller
  tendril: 1.0,   // pseudopod wiggle
  ripples: 0.35
};

let HEALTH   = 0.56;  // controls size/brightness (0..1)
let MUTATION = 0.25;  // drives complexity (cilia count, pod count)

/* ===== Canvas ===== */
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

function resize() {
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
  canvas.width  = Math.floor(innerWidth  * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width  = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize); resize();

/* ===== Helpers ===== */
const TAU = Math.PI * 2;
const clamp = (v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp  = (a,b,t)=>a+(b-a)*t;

/* simple organic wobble (sum sines) */
function wobble(theta, t, amp=1){
  const k1 = Math.sin(theta*3 + t*1.10);
  const k2 = Math.sin(theta*5 - t*0.70 + 1.3);
  const k3 = Math.sin(theta*7 + t*0.33 + 0.6);
  return (k1*0.55 + k2*0.30 + k3*0.22) * amp;
}

/* ===== Scene state ===== */
const motes = Array.from({length: 100}, () => ({
  x: Math.random()*innerWidth,
  y: Math.random()*innerHeight,
  z: Math.random()*0.7 + 0.3,
  a: Math.random()*TAU
}));

/* blink state */
let blinkT = 0;       // >0 while blinking
let lastBlink = 0;

/* ===== Background & stars ===== */
function drawBackground(t){
  ctx.fillStyle = PALETTE.space;
  ctx.fillRect(0,0,innerWidth,innerHeight);

  // parallax motes
  ctx.save();
  for(const m of motes){
    m.a += 0.0018*m.z;
    m.x += Math.cos(m.a)*0.18*m.z;
    m.y += Math.sin(m.a*0.13)*0.16*m.z;

    if(m.x < -10) m.x = innerWidth+10;
    if(m.x > innerWidth+10) m.x = -10;
    if(m.y < -10) m.y = innerHeight+10;
    if(m.y > innerHeight+10) m.y = -10;

    ctx.globalAlpha = 0.25 + 0.5*m.z;
    ctx.fillStyle = PALETTE.mote;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 0.8 + 1.3*m.z, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // subtle cross-vignette (aqua left, magenta right)
  const L = ctx.createLinearGradient(0,0, Math.min(380, innerWidth*0.22),0);
  L.addColorStop(0, "rgba(0,180,255,0.06)");
  L.addColorStop(1, "rgba(0,180,255,0.00)");
  ctx.fillStyle = L; ctx.fillRect(0,0,innerWidth,innerHeight);

  const R = ctx.createLinearGradient(innerWidth,0, innerWidth-Math.min(380, innerWidth*0.22),0);
  R.addColorStop(0, "rgba(255,0,160,0.055)");
  R.addColorStop(1, "rgba(255,0,160,0.00)");
  ctx.fillStyle = R; ctx.fillRect(0,0,innerWidth,innerHeight);
}

/* ===== Creature ===== */
function drawCreature(t){
  // position with gentle sway
  const cx = innerWidth*0.5 + Math.sin(t*SPEED.sway*0.65)*6;
  const cy = innerHeight*0.58 + Math.cos(t*SPEED.sway*0.72)*5;

  // heartbeat
  const hb = 0.04*Math.sin(t*SPEED.breathe*TAU) + 0.02;

  // size from health
  const R = Math.min(innerWidth, innerHeight) * 0.15 * (0.88 + 0.28*HEALTH + hb);

  // membrane path (blobby)
  const pts = 160;
  const amp = 0.05 + MUTATION*0.35;
  const path = [];
  for(let i=0;i<=pts;i++){
    const a = i/pts*TAU;
    const r = R*(1 + wobble(a, t*0.85, amp));
    path.push([cx + Math.cos(a)*r, cy + Math.sin(a)*r]);
  }

  // haze envelope
  ctx.beginPath();
  path.forEach(([x,y],i)=> i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.closePath();
  ctx.fillStyle = PALETTE.haze;
  ctx.shadowColor = "rgba(100,200,255,0.20)";
  ctx.shadowBlur = 36;
  ctx.fill();
  ctx.shadowBlur = 0;

  // body fill (radial gradient)
  const g = ctx.createRadialGradient(cx,cy, R*0.12, cx,cy, R*1.02);
  g.addColorStop(0, PALETTE.bodyIn);
  g.addColorStop(1, PALETTE.bodyOut);
  ctx.fillStyle = g;
  ctx.beginPath();
  path.forEach(([x,y],i)=> i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.closePath();
  ctx.fill();

  // rim stroke (aqua->magenta), slightly irregular
  ctx.lineWidth = 2.5 + 1.5*Math.sin(t*0.7);
  const rim = ctx.createLinearGradient(cx-R,cy-R, cx+R,cy+R);
  rim.addColorStop(0, PALETTE.rimA);
  rim.addColorStop(1, PALETTE.rimM);
  ctx.strokeStyle = rim;
  ctx.globalAlpha = 0.9;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // SPINE ridge (dark density curve inside)
  const spineA = -0.35;                 // orientation
  ctx.beginPath();
  for(let i=0;i<=1;i+=0.02){
    const a = spineA + (i-0.5)*1.2;
    const r = R*0.9*(1 + 0.06*Math.sin(t + i*9));
    const x = cx + Math.cos(a)*r, y = cy + Math.sin(a)*r;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.strokeStyle = "rgba(12,16,28,0.45)";
  ctx.lineWidth = 4; ctx.stroke();

  // CILIA (tiny hairs)
  drawCilia(path, cx, cy, R, t);

  // VEINS (from core)
  drawVeins(cx, cy, R, t);

  // EYE core (iris + pupil + glint + blink)
  drawEye(cx, cy, R, t);

  // PSEUDOPODS
  drawPseudopods(cx, cy, R, t);
}

function drawCilia(path, cx, cy, R, t){
  const count = Math.floor( lerp(20, 90, clamp(MUTATION*1.2)) );
  ctx.strokeStyle = PALETTE.cilia;
  ctx.lineCap = "round";
  for(let i=0;i<count;i++){
    // sample a perimeter point
    const p = path[Math.floor(i*(path.length-1)/count)];
    if(!p) continue;
    const [x,y] = p;
    // outward normal (from center)
    const nx = (x-cx), ny=(y-cy);
    const nl = Math.hypot(nx,ny) || 1; const ux = nx/nl, uy=ny/nl;

    const len = 6 + 10*Math.random()*MUTATION;
    const wig = Math.sin(t*1.7 + i)*2.0;
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineWidth = 0.8 + 0.8*Math.random();
    ctx.lineTo(x + ux*(len+wig), y + uy*(len+wig));
    ctx.stroke();
  }
}

function drawVeins(cx, cy, R, t){
  const branches = 4 + Math.floor(MUTATION*6);
  ctx.strokeStyle = PALETTE.vein;
  ctx.lineCap = "round";
  for(let b=0;b<branches;b++){
    const baseA = (b/branches)*TAU + 0.6*Math.sin(t*0.7 + b);
    let px = cx, py = cy;
    ctx.beginPath(); ctx.moveTo(px,py);
    const segs = 6 + Math.floor(MUTATION*8);
    for(let s=1;s<=segs;s++){
      const a = baseA + wobble(s*0.5, t*0.9 + b, 0.25);
      const step = (R*0.12) * (0.7 + s/segs);
      px += Math.cos(a)*step;
      py += Math.sin(a)*step;
      ctx.lineWidth = lerp(3.2, 0.6, s/segs);
      ctx.lineTo(px,py);
    }
    ctx.stroke();
  }
}

function drawEye(cx, cy, R, t){
  // iris
  const rI = R*0.36;
  const gI = ctx.createRadialGradient(cx,cy, rI*0.2, cx,cy, rI*1.05);
  gI.addColorStop(0, PALETTE.irisA);
  gI.addColorStop(1, PALETTE.irisB);
  ctx.fillStyle = gI;
  ctx.beginPath(); ctx.arc(cx,cy, rI, 0, TAU); ctx.fill();

  // pupil with blinking (scale Y when blink)
  // random blink every ~6–10s
  if (t - lastBlink > 6 + Math.random()*4 && blinkT <= 0){
    blinkT = 0.35; lastBlink = t;
  }
  const blink = Math.max(0, blinkT);
  blinkT -= 0.016; // decay

  const rP = rI*0.42;
  const scaleY = 1 - 0.85 * Math.sin(Math.max(0, blink*5)) * (blink>0?1:0); // close then open
  ctx.save();
  ctx.translate(cx,cy);
  ctx.scale(1, scaleY);
  ctx.fillStyle = PALETTE.pupil;
  ctx.beginPath(); ctx.arc(0,0, rP, 0, TAU); ctx.fill();
  ctx.restore();

  // specular glint
  const gx = cx + Math.cos(t*1.2)*rI*0.35;
  const gy = cy + Math.sin(t*0.9)*rI*0.25;
  const gl = ctx.createRadialGradient(gx,gy, 0, gx,gy, rI*0.9);
  gl.addColorStop(0, PALETTE.glint);
  gl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalCompositeOperation="lighter";
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.arc(gx,gy, rI*0.9, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation="source-over";

  // echo rings
  for(let i=1;i<=3;i++){
    const rr = lerp(rI*1.12, R*0.9, i/3);
    ctx.beginPath();
    ctx.arc(cx, cy, rr + Math.sin(t*SPEED.ripples + i)*2.4, 0, TAU);
    ctx.strokeStyle = `rgba(180,140,255,${0.18 - i*0.05})`;
    ctx.lineWidth = 1.1; ctx.stroke();
  }
}

function drawPseudopods(cx, cy, R, t){
  const count = Math.floor( lerp(1, 6, clamp(MUTATION)) );
  for(let i=0;i<count;i++){
    const baseA = (i/count)*TAU + t*0.18;
    const ax = cx + Math.cos(baseA)*R, ay = cy + Math.sin(baseA)*R;

    const L  = R*(0.7 + 0.75*Math.sin(t*SPEED.tendril + i));
    const tipA = baseA + 0.6*Math.sin(t*0.9 + i);
    const tx = cx + Math.cos(tipA)*L;
    const ty = cy + Math.sin(tipA)*L;

    const mx = (ax+tx)/2 + Math.cos(t + i)*R*0.12;
    const my = (ay+ty)/2 + Math.sin(t*1.1 + i*0.7)*R*0.12;

    ctx.beginPath(); ctx.moveTo(ax,ay);
    ctx.quadraticCurveTo(mx,my, tx,ty);
    ctx.lineWidth = 2.5 + 1.2*Math.max(0, Math.sin(t*1.3 + i));
    ctx.strokeStyle = "rgba(255,115,211,0.65)";
    ctx.shadowColor = PALETTE.trail; ctx.shadowBlur = 10;
    ctx.stroke(); ctx.shadowBlur=0;

    // tip
    ctx.beginPath();
    ctx.arc(tx,ty, 2.3 + 0.8*Math.sin(t*1.8+i), 0, TAU);
    ctx.fillStyle = PALETTE.tip;
    ctx.fill();
  }
}

/* ===== Loop ===== */
let t0 = performance.now();
function draw(now){
  const t = (now - t0)/1000;
  drawBackground(t);
  drawCreature(t);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

/* ===== Minimal UI ===== */
document.getElementById("feedBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  HEALTH   = clamp(HEALTH   + 0.06, 0, 1);
  MUTATION = clamp(MUTATION + (Math.random()*0.08 - 0.01), 0, 1);
});
document.getElementById("tradeBtn")?.addEventListener("click", e=>{
  e.currentTarget.href = "#"; // wire your swap later
});
