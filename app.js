/********* CONFIG *********/
const TOKEN_MINT   = "YOUR_CA_HERE";
const OPEN_SWAP_URL = "https://jup.ag/swap/SOL-" + TOKEN_MINT;

/* Quick knobs (tune freely) */
const PARAMS = {
  rings: { count: 7, gap: 36, width: 2, glow: 18, drift: 0.05 },
  nucleus: { rCore: 28, rOuter: 60, pulse: 0.05, glowCore: 30, glowOuter: 60 },
  tether: { width: 6, length: 210, sway: 38, wobble: 0.9, tipGlow: 22 },
  motes: { n: 54, speed: 0.28, twinkle: 0.22, min: 0.5, max: 1.7, parallax: 0.04 },
  fog: { rippleAmp: 0.18, rippleFreq: 0.7, alpha: 0.08 },
  heartbeat: { bpmMin: 42, bpmMax: 92 },  // mapped by health
};

/********* DOM *********/
const canvas   = document.getElementById("org-canvas");
const ctx      = canvas.getContext("2d", { alpha: true });
const priceEl  = document.getElementById("priceChip");
const timeEl   = document.getElementById("updatedChip");
const feedBtn  = document.getElementById("feedBtn");
const tradeBtn = document.getElementById("tradeBtn");
tradeBtn.href = OPEN_SWAP_URL;

/********* DPI / size *********/
function fit() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth  = window.innerWidth;
  const h = canvas.clientHeight = window.innerHeight;
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", fit);
fit();

/********* Palette: deep space (aqua/magenta) *********/
const C = {
  bgEdge:      "#000",                       // final falloff
  bgNear:      "#070a11",                    // center haze
  haze:        "rgba(140,0,120,0.10)",       // womb haze wash
  ringA:       "rgba(130,246,255,0.18)",
  ringB:       "rgba(255,120,210,0.16)",
  ringGlowA:   "rgba(130,246,255,0.28)",
  ringGlowB:   "rgba(255,120,210,0.24)",
  nucleusCore: "rgba(255,255,255,0.88)",
  nucleusOut:  "rgba(135,255,255,0.35)",
  tether:      "rgba(255,120,210,0.78)",
  mote:        "rgba(190,220,255,0.92)",
};

/********* State *********/
let t = 0;
let health = 0.56;   // 0..1
let mutation = 0.08; // 0..1
let flow = 0.5;      // -1..1 (visual drift)

/* Motes */
const motes = Array.from({length: PARAMS.motes.n}, () => ({
  x: Math.random()*canvas.clientWidth,
  y: Math.random()*canvas.clientHeight,
  z: Math.random(), // parallax layer 0..1
  dx:(Math.random()-0.5)*PARAMS.motes.speed,
  dy:(Math.random()-0.5)*PARAMS.motes.speed,
  r: Math.random()*(PARAMS.motes.max-PARAMS.motes.min)+PARAMS.motes.min,
}));

/********* Utils *********/
const clamp = (v, a=0, b=1)=>Math.min(b, Math.max(a, v));
const lerp = (a,b,u)=>a+(b-a)*u;
const map  = (x,a,b,c,d)=> c+(d-c)*((x-a)/(b-a));
const PI2  = Math.PI*2;
const RND  = (min,max)=>min+Math.random()*(max-min);
function nowHHMMSS(){
  const d=new Date(), p=n=>String(n).padStart(2,"0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* tiny 2D noise (cheap) */
function hash2(x,y){ 
  return Math.sin(x*127.1 + y*311.7)*43758.5453 % 1; 
}
function noise2(x,y){
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x-xi, yf = y-yi;
  const s = hash2(xi,yi),   t0=hash2(xi+1,yi);
  const u = hash2(xi,yi+1), v = hash2(xi+1,yi+1);
  const sx = xf*xf*(3-2*xf), sy = yf*yf*(3-2*yf);
  const a = s + sx*(t0-s);
  const b = u + sx*(v-u);
  return a + sy*(b-a);
}

/********* Drawing *********/
function drawBgFog(w,h){
  // radial base
  const g = ctx.createRadialGradient(w*0.5, h*0.62, Math.min(w,h)*0.15, w*0.5, h*0.62, Math.max(w,h)*0.95);
  g.addColorStop(0, C.bgNear);
  g.addColorStop(1, C.bgEdge);
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);

  // soft magenta haze wash
  ctx.fillStyle = C.haze;
  ctx.fillRect(0,0,w,h);

  // caustic ripple band (subtle)
  const amp = PARAMS.fog.rippleAmp * (0.6 + mutation*0.7);
  const freq = PARAMS.fog.rippleFreq;
  ctx.globalAlpha = PARAMS.fog.alpha;
  for(let y=0;y<h;y+=2){
    const u = y/h;
    const offset = Math.sin((u*10 + t*freq))*amp*200;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(w*0.1+offset, y, w*0.8, 1);
  }
  ctx.globalAlpha = 1;
}

function drawEchoRings(cx, cy){
  const baseR = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.19;
  const beat  = 1 + Math.sin(t * map(health,0,1,1.6,2.4)) * (0.015 + health*0.04) + mutation*0.05;
  const R = baseR * beat;

  ctx.lineWidth = PARAMS.rings.width;
  for(let i=0;i<PARAMS.rings.count;i++){
    const r = R + i*PARAMS.rings.gap + Math.sin(t*0.7 + i)*PARAMS.rings.drift*40;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, PI2);
    const isA = i%2===0;
    ctx.strokeStyle = isA ? C.ringA : C.ringB;
    ctx.shadowColor = isA ? C.ringGlowA : C.ringGlowB;
    ctx.shadowBlur = PARAMS.rings.glow * (0.8 + mutation*0.6);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function drawNucleus(cx, cy){
  const wob = 1 + Math.sin(t*2.1)*PARAMS.nucleus.pulse + health*0.05;
  const rOut = PARAMS.nucleus.rOuter * wob;
  const rCore= PARAMS.nucleus.rCore  * wob;

  // outer glow
  ctx.beginPath();
  ctx.arc(cx, cy, rOut, 0, PI2);
  ctx.fillStyle = C.nucleusOut;
  ctx.shadowColor = C.nucleusOut;
  ctx.shadowBlur = PARAMS.nucleus.glowOuter * (0.8 + mutation*0.5);
  ctx.fill();

  // core
  ctx.beginPath();
  ctx.arc(cx, cy, rCore, 0, PI2);
  ctx.fillStyle = C.nucleusCore;
  ctx.shadowColor = C.nucleusCore;
  ctx.shadowBlur = PARAMS.nucleus.glowCore;
  ctx.fill();

  // specular glint
  const ang = t*0.6;
  const gx = cx + Math.cos(ang)*rCore*0.5;
  const gy = cy + Math.sin(ang)*rCore*0.5;
  const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, rCore*0.9);
  grad.addColorStop(0, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, rCore*0.95, 0, PI2); ctx.fill();
  ctx.shadowBlur = 0;
}

function drawTether(cx, cy){
  const len = PARAMS.tether.length + Math.sin(t*0.55)*20;
  const phase = t*PARAMS.tether.wobble;
  const ax = cx - Math.cos(phase)*len;
  const ay = cy - Math.sin(phase)*len;

  const c1 = { x: lerp(ax, cx, 0.45), y: ay + Math.cos(t*0.9)*PARAMS.tether.sway };
  const c2 = { x: lerp(ax, cx, 0.85), y: cy + Math.sin(t*1.1)*PARAMS.tether.sway*0.6 };

  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, cx, cy);
  ctx.strokeStyle = C.tether;
  ctx.lineWidth = PARAMS.tether.width;
  ctx.lineCap = "round";
  ctx.shadowColor = C.tether;
  ctx.shadowBlur = PARAMS.tether.tipGlow;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawMotes(w,h){
  for(const m of motes){
    // parallax drift from flow
    m.x += m.dx + (flow-0.5)*PARAMS.motes.parallax*(m.z-0.5);
    m.y += m.dy + (flow-0.5)*PARAMS.motes.parallax*(0.5-m.z);

    if(m.x < -10) m.x = w+10; else if(m.x > w+10) m.x = -10;
    if(m.y < -10) m.y = h+10; else if(m.y > h+10) m.y = -10;

    const tw = 0.55 + Math.sin((m.x+m.y+t)*0.5)*PARAMS.motes.twinkle;
    ctx.globalAlpha = clamp(0.25 + tw*0.45, 0, 1);
    ctx.fillStyle = C.mote;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r*(0.7+0.6*m.z), 0, PI2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function draw(){
  t += 0.016;

  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0,0,w,h);

  drawBgFog(w,h);

  // creature anchor slightly below center
  const cx = w*0.52, cy = h*0.60;
  drawEchoRings(cx, cy);
  drawTether(cx, cy);
  drawNucleus(cx, cy);
  drawMotes(w,h);

  requestAnimationFrame(draw);
}

/********* Sim (stub until backend) *********/
function heartbeatHz(){
  const bpm = lerp(PARAMS.heartbeat.bpmMin, PARAMS.heartbeat.bpmMax, clamp(health,0,1));
  return bpm/60; // Hz
}
function tickClock(){ timeEl.textContent = "Updated " + nowHHMMSS(); }
function simVitals(){
  // health breathes with heartbeat, mutation creeps
  const hb = Math.sin(t * heartbeatHz() * PI2) * 0.002;
  health   = clamp(health + hb + (Math.random()-0.5)*0.004, 0, 1);
  mutation = clamp(mutation + (Math.random()-0.5)*0.003, 0, 1);
  // flow drifts slowly
  flow = clamp(flow + (Math.random()-0.5)*0.02, 0, 1);
}
function simPrice(){
  const p = 0.01 + Math.sin(Date.now()/8000)*0.002;
  priceEl.textContent = `$${p.toFixed(2)}`;
}

/********* Actions *********/
feedBtn.addEventListener("click", (ev)=>{
  ev.preventDefault();
  // “feeding” bumps health and flow, nudges mutation slightly
  health   = clamp(health + 0.07, 0, 1);
  flow     = clamp(flow + 0.08, 0, 1);
  mutation = clamp(mutation + 0.012, 0, 1);
});

/********* Boot *********/
(function boot(){
  tickClock(); simVitals(); simPrice();
  setInterval(tickClock, 1000);
  setInterval(simVitals, 4000);
  setInterval(simPrice, 6000);
  requestAnimationFrame(draw);
})();
