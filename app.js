/* THE ORGANISM — void-jelly from the dark between stars
   — nucleus + iris, breathing membrane, iridescent shell
   — chromatophores, parallax motes, procedural tendrils
*/

const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });
let W=0, H=0, DPR=1;
function resize(){
  DPR = Math.min(2, window.devicePixelRatio||1);
  W = canvas.width  = Math.floor(innerWidth * DPR);
  H = canvas.height = Math.floor(innerHeight * DPR);
  canvas.style.width  = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
}
resize(); addEventListener("resize", resize);

/* ---------- Palette (cool neon on deep black) ---------- */
const PAL = {
  space: "#0a0b14",
  hazeA: "rgba(110,150,210,0.10)",
  hazeB: "rgba(200,120,255,0.08)",
  iris:  "rgba(235,250,255,0.95)",
  irisCore: "rgba(255,255,255,0.9)",
  membraneA: "rgba(120,200,230,0.24)",
  membraneB: "rgba(255,120,215,0.26)",
  shellA: "rgba(130,210,255,0.65)",
  shellB: "rgba(255,121,211,0.65)",
  mote:  "rgba(210,220,255,0.75)"
};

/* ---------- Simple 2D noise (value noise) ---------- */
function nseed(s){ // tiny LCG
  s = Math.imul(s^0x85ebca6b, 0xc2b2ae35)>>>0;
  return ()=> (s = Math.imul(s^0x27d4eb2f, 0x165667b1)>>>0) / 0xffffffff;
}
const rand = nseed(0xA57CE11);
const perm = new Uint8Array(512); // for hash
for (let i=0;i<256;i++) perm[i]=i;
for (let i=255;i>0;i--){ const j=(rand()* (i+1))|0; [perm[i],perm[j]]=[perm[j],perm[i]]; }
for (let i=0;i<256;i++) perm[256+i]=perm[i];

function hash(x,y){ return perm[(x+perm[y&255])&255]; }
function lerp(a,b,t){ return a + (b-a)*t; }
function smoothstep(t){ return t*t*(3-2*t); }
function vnoise(x, y){
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi,      yf = y - yi;
  const tl = hash(xi, yi) / 255, tr = hash(xi+1, yi)/255;
  const bl = hash(xi, yi+1)/255, br = hash(xi+1, yi+1)/255;
  const u = smoothstep(xf), v = smoothstep(yf);
  return lerp(lerp(tl,tr,u), lerp(bl,br,u), v);
}

/* fbm for organic shapes */
function fbm(x,y,oct=4){
  let amp=0.5, freq=1.0, sum=0, norm=0;
  for (let i=0;i<oct;i++){
    sum += vnoise(x*freq, y*freq)*amp;
    norm += amp;
    amp *= 0.5; freq *= 2.0;
  }
  return sum/norm;
}

/* ---------- World state ---------- */
let t0 = performance.now();
let health   = 0.62;   // 0..1 (affects brightness, vigor)
let mutation = 0.18;   // 0..1 (adds traits over time)
const CENTER = ()=>({ x: W*0.5, y: H*0.56 });

/* ---------- Star motes ---------- */
const MOTES = Array.from({length: 72}, ()=>({
  x: rand(), y: rand(),
  z: 0.4 + rand()*0.8,
  r: 0.6 + rand()*1.6,
  p: rand()*6.283
}));

function drawMotes(t){
  ctx.save();
  for (const m of MOTES){
    const x = m.x*W + Math.sin(t*0.07 + m.p)*15*m.z;
    const y = m.y*H + Math.cos(t*0.05 + m.p)*18*m.z;
    ctx.globalAlpha = 0.2 + 0.8*Math.abs(Math.sin(t*0.4 + m.p));
    ctx.fillStyle = PAL.mote;
    ctx.beginPath(); ctx.arc(x,y,m.r*DPR,0,6.283); ctx.fill();
  }
  ctx.restore();
}

/* ---------- Creature: iris + core ---------- */
function drawIris(t, cx, cy){
  const breathe = 0.85 + 0.15*Math.sin(t*1.3);
  const rCore = 24*DPR * (0.9 + 0.2*Math.sin(t*2.1));
  const rIris = 58*DPR * breathe;

  // soft bloom
  const g = ctx.createRadialGradient(cx,cy,0,cx,cy,rIris*2.2);
  g.addColorStop(0, PAL.iris);
  g.addColorStop(0.45, "rgba(180,220,255,0.25)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx,cy,rIris*2.2,0,6.283); ctx.fill();

  // iris ring with faint specular
  ctx.lineWidth = 2.0*DPR; ctx.strokeStyle = "rgba(200,230,255,0.65)";
  ctx.globalAlpha = 0.6 + 0.2*Math.sin(t*3.1);
  ctx.beginPath(); ctx.arc(cx,cy,rIris,0,6.283); ctx.stroke();

  // core
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAL.irisCore;
  ctx.beginPath(); ctx.arc(cx,cy,rCore,0,6.283); ctx.fill();
}

/* ---------- Membrane (undulating) ---------- */
function drawMembrane(t, cx, cy){
  const baseR = 105 * DPR;
  const ringCount = 5;
  for (let k=0;k<ringCount;k++){
    const r = baseR + k*16*DPR;
    const amp = 8*DPR * (0.45 + 0.55*mutation);
    ctx.beginPath();
    const steps = 90;
    for (let i=0;i<=steps;i++){
      const a = (i/steps)*Math.PI*2;
      const nx = Math.cos(a)*0.8 + 12.3;
      const ny = Math.sin(a)*0.8 - 7.1;
      const n = fbm(nx + t*0.2, ny - t*0.18, 3);
      const rr = r + (n-0.5)*amp;
      const x = cx + Math.cos(a)*rr;
      const y = cy + Math.sin(a)*rr;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    const magMix = 0.4 + 0.6*Math.max(0,Math.sin(t*0.9 + k));
    ctx.strokeStyle = mixRGBA(PAL.membraneA, PAL.membraneB, magMix);
    ctx.lineWidth = (k===ringCount-1 ? 2.2 : 1.4) * DPR;
    ctx.globalAlpha = 0.55 - k*0.08;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ---------- Iridescent shell “skin” ---------- */
function drawShell(t, cx, cy){
  const r = 150*DPR;
  const g = ctx.createRadialGradient(cx,cy, r*0.6, cx,cy, r*1.35);
  g.addColorStop(0.00, "rgba(0,0,0,0)");
  g.addColorStop(0.45, "rgba(120,220,255,0.10)");
  g.addColorStop(0.75, "rgba(255,120,210,0.10)");
  g.addColorStop(1.00, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx,cy,r*1.35,0,6.283); ctx.fill();

  // thin iridescent rim
  ctx.lineWidth = 2*DPR;
  ctx.strokeStyle = "rgba(127,235,255,0.35)";
  ctx.beginPath(); ctx.arc(cx,cy,r,0,6.283); ctx.stroke();
  ctx.strokeStyle = "rgba(255,121,211,0.38)";
  ctx.lineWidth = 1.3*DPR;
  ctx.beginPath(); ctx.arc(cx,cy,r*0.97,0,6.283); ctx.stroke();
}

/* ---------- Chromatophores (flash spots) ---------- */
const SPOTS = Array.from({length: 18}, ()=>({a: rand()*6.283, r: 110*DPR + rand()*40*DPR, p: rand()*6.283}));
function drawSpots(t, cx, cy){
  ctx.save();
  for (const s of SPOTS){
    const x = cx + Math.cos(s.a)*s.r;
    const y = cy + Math.sin(s.a)*s.r;
    const pulse = 0.25 + 0.75*Math.max(0,Math.sin(t*1.8 + s.p));
    const R = 10*DPR*(0.6 + 0.7*Math.sin(t*0.7 + s.p));
    const g = ctx.createRadialGradient(x,y,0,x,y,R);
    g.addColorStop(0, "rgba(255,255,255,"+(0.35*pulse).toFixed(3)+")");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x,y,R,0,6.283); ctx.fill();
  }
  ctx.restore();
}

/* ---------- Single organic tendril ---------- */
const Tendril = (()=> {
  const cfg = { baseR: 165*DPR, len: 200*DPR };
  let seed = rand()*1000;
  return {
    draw(t, cx, cy){
      const ang = t*0.35 + seed;
      const ax = cx + Math.cos(ang)*cfg.baseR;
      const ay = cy + Math.sin(ang)*cfg.baseR;

      // wobbling middle
      const sway = 26*DPR * Math.sin(t*0.8 + seed*2.3);
      const mx = (ax+cx)/2 + Math.cos(ang+Math.PI/2)*sway;
      const my = (ay+cy)/2 + Math.sin(ang+Math.PI/2)*sway;

      ctx.save();
      // gradient stroke along tendril
      const grad = ctx.createLinearGradient(ax,ay,cx,cy);
      grad.addColorStop(0, PAL.shellB);
      grad.addColorStop(1, PAL.shellA);
      ctx.strokeStyle = grad;
      const vigor = 0.9 + 0.6*Math.sin(t*1.7);
      ctx.lineWidth = (2.6*DPR) * (0.6 + 0.8*health*vigor);
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      // curve towards the organism’s rim then inward slightly
      const rimPull = 0.35 + 0.25*Math.sin(t*0.6);
      const bx = lerp(mx, cx, rimPull), by = lerp(my, cy, rimPull);
      ctx.quadraticCurveTo(bx, by, cx, cy);
      ctx.stroke();

      // bright tip glow
      const tip = ctx.createRadialGradient(cx,cy,0, cx,cy, 14*DPR);
      tip.addColorStop(0, "rgba(255,255,255,0.40)");
      tip.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = tip;
      ctx.beginPath(); ctx.arc(cx,cy,14*DPR,0,6.283); ctx.fill();

      ctx.restore();
    }
  }
})();

/* ---------- Background vignette / nebula ribs ---------- */
function drawNebula(t){
  // subtle magenta curtain from sides
  const gradL = ctx.createLinearGradient(0,0, W*0.25,0);
  gradL.addColorStop(0, PAL.hazeB); gradL.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradL; ctx.fillRect(0,0,W,H);

  const gradR = ctx.createLinearGradient(W,0, W*0.75,0);
  gradR.addColorStop(0, PAL.hazeB); gradR.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradR; ctx.fillRect(W*0.75,0,W*0.25,H);

  // faint echo rings for depth
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "rgba(150,180,230,0.5)";
  ctx.lineWidth = 1*DPR;
  const {x:cx, y:cy} = CENTER();
  for (let r=220*DPR; r<Math.max(W,H); r+=140*DPR){
    ctx.beginPath(); ctx.arc(cx,cy,r + Math.sin(t*0.3 + r*0.002)*6*DPR, 0, 6.283); ctx.stroke();
  }
  ctx.restore();
}

/* ---------- Frame loop ---------- */
function frame(){
  requestAnimationFrame(frame);
  const t = (performance.now() - t0)/1000;

  // clear space
  ctx.fillStyle = PAL.space;
  ctx.fillRect(0,0,W,H);

  drawNebula(t);
  drawMotes(t);

  const {x:cx, y:cy} = CENTER();
  drawShell(t, cx, cy);      // outer skin & iridescent rim
  drawSpots(t, cx, cy);      // flashing chromatophores
  drawMembrane(t, cx, cy);   // breathing rings
  Tendril.draw(t, cx, cy);   // single organic tether
  drawIris(t, cx, cy);       // core + iris last (brightest)
}
frame();

/* ---------- Utility: mix two rgba strings 0..1 ---------- */
function mixRGBA(a,b,t){
  const pa = rgbaToArr(a), pb = rgbaToArr(b);
  const c = [0,0,0,0];
  for (let i=0;i<4;i++) c[i]=pa[i]+(pb[i]-pa[i])*t;
  return `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${+c[3].toFixed(3)})`;
}
function rgbaToArr(s){
  // expects "rgba(r,g,b,a)" or "rgb(r,g,b)"
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if(!m) return [255,255,255,1];
  const p = m[1].split(",").map(v=>+v.trim());
  if (p.length===3) p.push(1);
  return p;
}

/* ---------- (Optional) drive health/mutation over time ---------- */
/* feel free to wire to your backend later; this is just life-sim */
setInterval(()=>{
  // mutation wanders slowly
  mutation = clamp(mutation + (Math.random()-.5)*0.02, 0, 1);
  // health gently trends up/down with a heartbeat beat
  const beat = 0.02*Math.sin(performance.now()*0.003);
  health = clamp(health + (Math.random()-.5)*0.015 + beat, 0.1, 0.98);
}, 1200);

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
