/********* CONFIG (edit URLs/labels later) *********/
const TOKEN_MINT = "YOUR_CA_HERE";  // (only used to build the swap link)
const OPEN_SWAP_URL = "https://jup.ag/swap/SOL-" + TOKEN_MINT;

/********* DOM *********/
const canvas   = document.getElementById("org-canvas");
const ctx      = canvas.getContext("2d", { alpha: true });
const priceEl  = document.getElementById("priceChip");
const timeEl   = document.getElementById("updatedChip");
const feedBtn  = document.getElementById("feedBtn");
const tradeBtn = document.getElementById("tradeBtn");

/********* Sizing *********/
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

/********* Palette (dark neon) *********/
const paletteDark = {
  bgFog1: "rgba(10,18,28,0.75)",
  bgFog2: "rgba(0,0,0,0.85)",
  haze:   "rgba(120,0,120,0.10)",
  ringA:  "rgba(130,246,255,0.16)",
  ringB:  "rgba(255,140,220,0.13)",
  nucleusOuter: "rgba(135,255,255,0.35)",
  nucleusCore:  "rgba(255,255,255,0.85)",
  tether: "rgba(255,120,210,0.75)",
  mote:   "rgba(180,220,255,0.85)"
};
const paletteWarm = {
  bgFog1:"rgba(70,20,18,0.6)", bgFog2:"rgba(0,0,0,0.75)",
  haze:"rgba(255,140,200,0.08)",
  ringA:"rgba(255,200,120,0.12)", ringB:"rgba(255,90,160,0.12)",
  nucleusOuter:"rgba(255,240,210,0.32)", nucleusCore:"rgba(255,255,255,0.92)",
  tether:"rgba(255,210,140,0.75)", mote:"rgba(255,240,230,0.9)"
};

// pick by body class
const useWarm = document.body.classList.contains("warm");
const C = useWarm ? paletteWarm : paletteDark;

/********* Creature state *********/
let t = 0;
let health = 0.55;  // 0..1
let mutation = 0.08; // 0..1
let flow = 0.5;     // -1..1 visual drift

// motes
const motes = Array.from({length: 42}, () => ({
  x: Math.random()*canvas.clientWidth,
  y: Math.random()*canvas.clientHeight,
  dx:(Math.random()-0.5)*0.25,
  dy:(Math.random()-0.5)*0.25,
  r: Math.random()*1.3+0.4
}));

/********* Helpers *********/
const clamp = (v, a=0, b=1)=>Math.min(b, Math.max(a, v));
const lerp = (a,b,t)=>a+(b-a)*t;
function nowHHMMSS(){
  const d=new Date();
  const p=n=>n.toString().padStart(2,"0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/********* Drawing *********/
function drawBgFog(w,h){
  const g = ctx.createRadialGradient(w*0.5, h*0.62, Math.min(w,h)*0.2, w*0.5, h*0.62, Math.max(w,h)*0.9);
  g.addColorStop(0, C.bgFog1);
  g.addColorStop(1, C.bgFog2);
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);
  // subtle womb haze overlay
  ctx.fillStyle = C.haze;
  ctx.fillRect(0,0,w,h);
}

function drawEchoRings(cx, cy){
  const baseR = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.18;
  const beat  = 1 + Math.sin(t*1.8)*0.02 + mutation*0.08;
  const R = baseR * beat;

  for(let i=0;i<6;i++){
    const r = R + i*36;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.strokeStyle = i%2 ? C.ringA : C.ringB;
    ctx.lineWidth = 2;
    ctx.shadowColor = i%2 ? "rgba(130,246,255,0.28)" : "rgba(255,120,210,0.22)";
    ctx.shadowBlur = 18;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function drawNucleus(cx, cy){
  const wob = 1 + Math.sin(t*2.2)*0.04 + health*0.06;
  const outer = 56*wob;
  // outer glow
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI*2);
  ctx.fillStyle = C.nucleusOuter;
  ctx.shadowColor = C.nucleusOuter;
  ctx.shadowBlur = 60;
  ctx.fill();

  // core
  ctx.beginPath();
  ctx.arc(cx, cy, 28*wob, 0, Math.PI*2);
  ctx.fillStyle = C.nucleusCore;
  ctx.shadowColor = C.nucleusCore;
  ctx.shadowBlur = 30;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawTether(cx, cy){
  const phase = t*0.9;
  const len = 190 + Math.sin(t*0.7)*30;
  const a = { x: cx - Math.cos(phase)*len, y: cy - Math.sin(phase)*len };
  const c1 = { x: lerp(a.x, cx, 0.55), y: a.y + Math.cos(t)*40 };
  const c2 = { x: lerp(a.x, cx, 0.85), y: cy + Math.sin(t*1.1)*30 };

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, cx, cy);
  ctx.strokeStyle = C.tether;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.shadowColor = C.tether;
  ctx.shadowBlur = 22;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawMotes(w,h){
  ctx.fillStyle = C.mote;
  for(const m of motes){
    m.x += m.dx; m.y += m.dy;
    // wrap
    if(m.x < -10) m.x = w+10; else if(m.x > w+10) m.x = -10;
    if(m.y < -10) m.y = h+10; else if(m.y > h+10) m.y = -10;

    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI*2);
    ctx.globalAlpha = 0.35 + Math.sin((m.x+m.y+t)*0.4)*0.2;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function draw(){
  t += 0.016;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0,0,w,h);

  drawBgFog(w,h);

  const cx = w*0.52, cy = h*0.60;
  drawEchoRings(cx, cy);
  drawTether(cx, cy);
  drawNucleus(cx, cy);
  drawMotes(w,h);

  requestAnimationFrame(draw);
}

/********* Sim (stub) *********/
function tickClock(){
  timeEl.textContent = "Updated " + nowHHMMSS();
}
function simVitals(){
  // tiny drifting
  health = clamp(health + (Math.random()-0.5)*0.006, 0, 1);
  mutation = clamp(mutation + (Math.random()-0.5)*0.004, 0, 1);
}
function simPrice(){
  const p = 0.01 + Math.sin(Date.now()/8000)*0.002;
  priceEl.textContent = `$${p.toFixed(2)}`;
}

/********* Actions *********/
feedBtn.addEventListener("click", (ev)=>{
  ev.preventDefault();
  // give a little “life” nudge
  health = clamp(health + 0.06, 0, 1);
  mutation = clamp(mutation + 0.015, 0, 1);
});
tradeBtn.href = OPEN_SWAP_URL;

/********* Boot *********/
(function boot(){
  tickClock(); simVitals(); simPrice();
  setInterval(tickClock, 1000);
  setInterval(simVitals, 4000);
  setInterval(simPrice, 6000);
  requestAnimationFrame(draw);
})();
