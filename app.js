/* THE ORGANISM — “void-jelly xenopod”
   One living creature: body + iris/pupil (blink), translucent fins,
   drifting subdermal veins, breathing gill vents, and a single umbilical tether.
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

/* ===== Palette ===== */
const PAL = {
  space: "#070914",
  hazeMag: "rgba(200,120,255,0.06)",
  hazeAqua:"rgba(120,200,255,0.06)",
  core:    "rgba(250,255,255,0.95)",
  iris:    "rgba(210,240,255,0.85)",
  skinA:   "rgba(120,210,235,0.30)",   // membrane fill
  skinB:   "rgba(255,120,215,0.28)",   // membrane tint
  rimA:    "rgba(135,235,255,0.45)",   // iridescent rim
  rimB:    "rgba(255,121,211,0.50)",
  finA:    "rgba(110,230,230,0.25)",   // translucent fins
  finB:    "rgba(255,140,230,0.22)",
  vein:    "rgba(180,220,255,0.08)",
  mote:    "rgba(210,220,255,0.75)",
  tetherA: "rgba(255,121,211,0.85)",
  tetherB: "rgba(120,230,255,0.85)"
};

/* ===== Tiny value noise / fbm for organic variance ===== */
function makeRand(seed=0xA53B9D1){ // tiny lcg
  let s = seed>>>0;
  return ()=>((s=Math.imul(s^0x27d4eb2f,0x165667b1))>>>0)/0xffffffff;
}
const rnd = makeRand();
const perm = new Uint8Array(512);
for (let i=0;i<256;i++) perm[i]=i;
for (let i=255;i>0;i--){ const j=(rnd()*(i+1))|0; [perm[i],perm[j]]=[perm[j],perm[i]]; }
for (let i=0;i<256;i++) perm[256+i]=perm[i];
const lerp=(a,b,t)=>a+(b-a)*t;
const sstep=t=>t*t*(3-2*t);
const hash=(x,y)=>perm[(x+perm[y&255])&255];
function vnoise(x,y){
  const xi=x|0, yi=y|0, xf=x-xi, yf=y-yi;
  const tl=hash(xi,yi)/255, tr=hash(xi+1,yi)/255;
  const bl=hash(xi,yi+1)/255, br=hash(xi+1,yi+1)/255;
  const u=sstep(xf), v=sstep(yf);
  return lerp( lerp(tl,tr,u), lerp(bl,br,u), v );
}
function fbm(x,y,oct=4){ let a=.5,f=1,s=0,n=0; for(let i=0;i<oct;i++){ s+=vnoise(x*f,y*f)*a; n+=a; a*=.5; f*=2; } return s/n; }

/* ===== World state ===== */
let t0 = performance.now();
let health   = 0.62;  // 0..1
let mutation = 0.35;  // 0..1 (unlocks fins/veins amplitude)
const center = ()=>({ x: W*0.5, y: H*0.56 });

/* ===== Stars ===== */
const MOTES = Array.from({length: 90}, ()=>({
  x: rnd(), y: rnd(), z: .35 + rnd()*1.1, r: .8 + rnd()*1.8, p: rnd()*6.283
}));
function drawStars(t){
  ctx.save();
  for (const m of MOTES){
    const x = m.x*W + Math.sin(t*.07+m.p)*14*m.z;
    const y = m.y*H + Math.cos(t*.05+m.p)*16*m.z;
    ctx.globalAlpha = .18 + .7*Math.abs(Math.sin(t*.38 + m.p));
    ctx.fillStyle = PAL.mote;
    ctx.beginPath(); ctx.arc(x,y,m.r*DPR,0,6.283); ctx.fill();
  }
  ctx.restore();
}

/* ===== Creature pieces ===== */

/* Eye (iris + pupil that blinks) */
function drawEye(t, cx, cy){
  const breathe = .85 + .15*Math.sin(t*1.2);
  const rIris = 52*DPR * breathe;
  const rCore = 22*DPR * (0.9 + 0.15*Math.sin(t*1.9));
  // iris bloom
  const g = ctx.createRadialGradient(cx,cy,0,cx,cy,rIris*1.9);
  g.addColorStop(0, PAL.iris);
  g.addColorStop(.5, "rgba(160,210,255,.22)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,rIris*1.9,0,6.283); ctx.fill();

  // iris ring
  ctx.globalAlpha=.7; ctx.lineWidth=2*DPR; ctx.strokeStyle="rgba(200,230,255,.7)";
  ctx.beginPath(); ctx.arc(cx,cy,rIris,0,6.283); ctx.stroke();
  ctx.globalAlpha=1;

  // core
  ctx.fillStyle=PAL.core; ctx.beginPath(); ctx.arc(cx,cy,rCore,0,6.283); ctx.fill();

  // pupil slit with blink
  const blink = Math.max(0,.1 + .9*Math.abs(Math.sin(t*0.6 + Math.sin(t*.17)*.7)));
  const slit = rCore * ( .15 + .5*blink );
  ctx.fillStyle="rgba(20,30,40,.85)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, slit, rCore*.82, 0, 0, 6.283);
  ctx.fill();
}

/* Body membrane (wobbly) */
function drawMembrane(t, cx, cy){
  const base = 100*DPR;
  const rings = 4;
  for(let k=0;k<rings;k++){
    const r = base + k*18*DPR;
    const amp = 8*DPR*(.4 + .8*mutation);
    ctx.beginPath();
    const steps=96;
    for(let i=0;i<=steps;i++){
      const a = (i/steps)*6.283;
      const n = fbm(Math.cos(a)*.9+12.1+t*.2, Math.sin(a)*.9-7.7-t*.16, 3);
      const rr = r + (n-.5)*amp;
      const x = cx + Math.cos(a)*rr;
      const y = cy + Math.sin(a)*rr;
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.strokeStyle = k%2?PAL.skinB:PAL.skinA;
    ctx.lineWidth = (k===rings-1?2.2:1.4)*DPR;
    ctx.globalAlpha = .55 - k*.1;
    ctx.stroke();
  }
  ctx.globalAlpha=1;
}

/* Iridescent rimmed shell around body */
function drawShell(cx, cy){
  const r=155*DPR;
  const g = ctx.createRadialGradient(cx,cy,r*.55, cx,cy,r*1.32);
  g.addColorStop(0,"rgba(0,0,0,0)");
  g.addColorStop(.6,"rgba(120,220,255,.10)");
  g.addColorStop(.9,"rgba(255,120,210,.10)");
  g.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,r*1.32,0,6.283); ctx.fill();

  ctx.lineWidth=2*DPR; ctx.strokeStyle=PAL.rimA; ctx.beginPath(); ctx.arc(cx,cy,r,0,6.283); ctx.stroke();
  ctx.lineWidth=1.4*DPR; ctx.strokeStyle=PAL.rimB; ctx.beginPath(); ctx.arc(cx,cy,r*.96,0,6.283); ctx.stroke();
}

/* Translucent fins (2–3) */
function drawFins(t, cx, cy){
  const fins = 3;
  for(let i=0;i<fins;i++){
    const a0 = 1.2 + i*1.9 + Math.sin(t*.35+i)*.15;
    const len = 120*DPR;
    const w   = 52*DPR*(.8+.4*Math.sin(t*.7+i));
    const x1 = cx + Math.cos(a0)*100*DPR;
    const y1 = cy + Math.sin(a0)*100*DPR;
    const x2 = x1 + Math.cos(a0-.8)*len;
    const y2 = y1 + Math.sin(a0-.8)*len;
    const x3 = x1 + Math.cos(a0+.8)*len;
    const y3 = y1 + Math.sin(a0+.8)*len;

    // gradient fin
    const g = ctx.createLinearGradient(x1,y1, (x2+x3)/2, (y2+y3)/2);
    g.addColorStop(0, PAL.finA);
    g.addColorStop(1, PAL.finB);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x1,y1);
    ctx.quadraticCurveTo(cx,cy,x2,y2);
    ctx.lineTo(x3,y3);
    ctx.quadraticCurveTo(cx,cy,x1,y1);
    ctx.closePath();
    ctx.fill();

    // fin edge shimmer
    ctx.globalAlpha=.35; ctx.strokeStyle="rgba(220,245,255,.25)";
    ctx.lineWidth=1*DPR; ctx.stroke(); ctx.globalAlpha=1;
  }
}

/* Veins under the skin */
function drawVeins(t, cx, cy){
  ctx.save();
  ctx.strokeStyle = PAL.vein;
  ctx.lineWidth = .9*DPR;
  ctx.globalAlpha = .9*(.2 + .8*mutation);
  const paths = 5;
  for(let p=0;p<paths;p++){
    const a = (p/paths)*6.283 + Math.sin(t*.3+p)*.4;
    const r0 = 40*DPR, r1 = 125*DPR;
    const x0 = cx + Math.cos(a)*r0, y0 = cy + Math.sin(a)*r0;
    const x1 = cx + Math.cos(a+.7)*r1, y1 = cy + Math.sin(a+.7)*r1;
    const xm = cx + Math.cos(a+.25)*90*DPR + Math.cos(t*.8+p)*20*DPR;
    const ym = cy + Math.sin(a+.25)*90*DPR + Math.sin(t*.7+p)*18*DPR;
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.quadraticCurveTo(xm,ym,x1,y1); ctx.stroke();
  }
  ctx.restore();
}

/* Gill vents (small ovals that “breathe”) */
function drawVents(t, cx, cy){
  const vents=4, baseR=110*DPR;
  for(let i=0;i<vents;i++){
    const a = 0.6 + i*.9;
    const x = cx + Math.cos(a)*baseR;
    const y = cy + Math.sin(a)*baseR;
    const open = .35 + .25*Math.sin(t*2 + i);
    ctx.fillStyle = "rgba(40,60,90,.7)";
    ctx.beginPath();
    ctx.ellipse(x,y, 10*DPR*open, 5*DPR, a, 0, 6.283);
    ctx.fill();
  }
}

/* Single umbilical tether */
const Tether = (()=> {
  let seed = rnd()*1000;
  return {
    draw(t,cx,cy){
      const baseR=170*DPR;
      const ang = t*.32 + seed;
      const ax = cx + Math.cos(ang)*baseR;
      const ay = cy + Math.sin(ang)*baseR;
      const sway = 30*DPR*Math.sin(t*.8 + seed*2.1);
      const mx = (ax+cx)/2 + Math.cos(ang+Math.PI/2)*sway;
      const my = (ay+cy)/2 + Math.sin(ang+Math.PI/2)*sway;

      const grad = ctx.createLinearGradient(ax,ay,cx,cy);
      grad.addColorStop(0, PAL.tetherB);
      grad.addColorStop(1, PAL.tetherA);
      ctx.lineCap="round";
      ctx.strokeStyle=grad;
      ctx.lineWidth = 2.8*DPR*(.6 + .8*health*(.7+.3*Math.sin(t*1.3)));
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(mx,my,cx,cy); ctx.stroke();

      // tip glow
      const tip = ctx.createRadialGradient(cx,cy,0, cx,cy, 16*DPR);
      tip.addColorStop(0,"rgba(255,255,255,.45)");
      tip.addColorStop(1,"rgba(255,255,255,0)");
      ctx.fillStyle=tip; ctx.beginPath(); ctx.arc(cx,cy,16*DPR,0,6.283); ctx.fill();
    }
  }
})();

/* Background curtains + echo rings */
function backdrop(t){
  // side curtains
  const L = ctx.createLinearGradient(0,0, W*.25,0);
  L.addColorStop(0, PAL.hazeMag); L.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=L; ctx.fillRect(0,0,W,H);
  const R = ctx.createLinearGradient(W,0, W*.75,0);
  R.addColorStop(0, PAL.hazeAqua); R.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=R; ctx.fillRect(W*.75,0, W*.25, H);

  // echo rings
  ctx.save();
  ctx.globalAlpha = .12;
  ctx.strokeStyle = "rgba(150,180,230,.45)";
  ctx.lineWidth = 1*DPR;
  const {x:cx,y:cy} = center();
  for(let r=240*DPR; r<Math.max(W,H); r+=140*DPR){
    ctx.beginPath(); ctx.arc(cx,cy, r + Math.sin(t*.33 + r*.002)*6*DPR, 0, 6.283); ctx.stroke();
  }
  ctx.restore();
}

/* ===== Main loop ===== */
function draw(){
  requestAnimationFrame(draw);
  const t=(performance.now()-t0)/1000;

  // space
  ctx.fillStyle = PAL.space; ctx.fillRect(0,0,W,H);

  backdrop(t);
  drawStars(t);

  const {x:cx,y:cy} = center();

  drawShell(cx,cy);
  drawFins(t,cx,cy);
  drawVeins(t,cx,cy);
  drawMembrane(t,cx,cy);
  Tether.draw(t,cx,cy);
  drawEye(t,cx,cy);
}
draw();

/* ===== Simulate life over time (replace with real data later) ===== */
setInterval(()=>{
  // Mutation wanders slowly; higher mutation => more fin sway / membrane noise
  mutation = clamp(mutation + (Math.random()-0.5)*0.02, 0, 1);
  // Health breath + slight noise (affects tether thickness/brightness)
  const beat = 0.02*Math.sin(performance.now()*0.003);
  health = clamp(health + (Math.random()-0.5)*0.014 + beat, 0.1, 0.98);
}, 1200);

function clamp(v,lo,hi){ return Math.max(lo, Math.min(hi,v)); }
