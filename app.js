/***** CONFIG *****/
const API = "https://organism-backend.onrender.com"; // <-- set to your Render backend
const POLL_HEALTH_MS = 6000;
const POLL_TRADES_MS = 6000;

/***** DOM *****/
const canvas = document.getElementById("org-canvas");
const ctx    = canvas.getContext("2d", { alpha:true });

const statusWord   = document.getElementById("status");
const heartbeatEl  = document.getElementById("heartbeat");
const healthBar    = document.getElementById("healthBar");
const healthPct    = document.getElementById("healthPct");
const mutBar       = document.getElementById("mutBar");
const mutPct       = document.getElementById("mutPct");
const stageNum     = document.getElementById("stageNum");
const stageBadge   = document.getElementById("stageBadge");
const decayRate    = document.getElementById("decayRate");
const priceLabel   = document.getElementById("priceLabel");
const updatedLabel = document.getElementById("updatedLabel");
const flowBar      = document.getElementById("flowBar");
const flowNeedle   = document.getElementById("flowNeedle");
const flowLabel    = document.getElementById("flowLabel");
const sfxBtn       = document.getElementById("sfxBtn");
const feedBtn      = document.getElementById("feedBtn");
const tradesBody   = document.getElementById("trades-body");

/***** helpers *****/
const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
const fmt = (n, d=2) => Number(n).toFixed(d);
const fmtUSD = (n) => "$" + Number(n).toFixed(4);
const pad2 = (n) => String(n).padStart(2,"0");
const nowStr = () => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

/***** state *****/
let W=0,H=0, t0=performance.now();
let HEALTH = 0.54;
let MUT    = 0.00;
let STAGE  = 1;
let lastPrice = 0;
let flowTarget = 0;   // -1..+1 from recent USD flows (buys minus sells)
let AC = null, gain = null; // audio

/***** canvas setup *****/
function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function drawWomb() {
  const t = (performance.now()-t0)/1000;
  ctx.clearRect(0,0,W,H);

  // vignette
  const gradV = ctx.createRadialGradient(W*0.5, H*0.1, H*0.2, W*0.5, H*0.1, Math.max(W,H));
  gradV.addColorStop(0, "rgba(20,35,50,.3)");
  gradV.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradV;
  ctx.fillRect(0,0,W,H);

  // concentric drift rings
  ctx.save();
  ctx.translate(W*0.52, H*0.58);
  const hue = 190;
  for(let i=0;i<6;i++){
    const r = 110 + i*74 + Math.sin(t*0.4+i)*6;
    ctx.beginPath();
    ctx.arc(0,0,r,0,Math.PI*2);
    ctx.strokeStyle = `rgba(25,60,85,${0.18 - i*0.02})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // nucleus
  const base = 68 + 26*Math.sin(t*1.2);
  const grad = ctx.createRadialGradient(0,0, base*0.1, 0,0, base);
  grad.addColorStop(0, `hsla(${hue},70%,70%,.85)`);
  grad.addColorStop(1, `hsla(${hue},70%,30%,.2)`);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0,0, base, 0, Math.PI*2); ctx.fill();

  // motes
  for(let i=0;i<24;i++){
    const a = i/24 * Math.PI*2 + t*0.2 + i*0.3;
    const r = base + 34 + 24*Math.sin(t*0.8+i);
    const x = Math.cos(a)*r, y = Math.sin(a)*r;
    ctx.fillStyle = `rgba(180,220,255,${0.10+0.08*Math.sin(t*2+i)})`;
    ctx.beginPath(); ctx.arc(x,y, 2.0+Math.sin(t*2+i)*0.6, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  requestAnimationFrame(drawWomb);
}
requestAnimationFrame(drawWomb);

/***** audio (womb hum) *****/
function initAudio(){
  if (AC) return;
  AC = new (window.AudioContext||window.webkitAudioContext)();
  const osc = AC.createOscillator();
  gain = AC.createGain();
  osc.type = "sine";
  osc.frequency.value = 48;  // low hum
  gain.gain.value = 0.0;
  osc.connect(gain).connect(AC.destination);
  osc.start();
}
function sfxOn(){ if(!AC){ initAudio(); } gain.gain.cancelScheduledValues(AC.currentTime); gain.gain.linearRampToValueAtTime(.08, AC.currentTime+.25); }
function sfxOff(){ if(!AC) return; gain.gain.cancelScheduledValues(AC.currentTime); gain.gain.linearRampToValueAtTime(.0, AC.currentTime+.25); }

/***** vitals + layout setters *****/
function setHealth(v){
  HEALTH = clamp(v,0,1);
  healthBar.style.width = (HEALTH*100).toFixed(0)+"%";
  healthPct.textContent = (HEALTH*100).toFixed(0)+"%";
}
function setMutation(v){
  MUT = clamp(v,0,1);
  mutBar.style.width = (MUT*100).toFixed(0)+"%";
  mutPct.textContent = (MUT*100).toFixed(0)+"%";
}
function setStage(n){
  STAGE = n;
  stageNum.textContent = String(n);
  stageBadge.textContent = `Stage ${n} · ${n===1?"The Cell":"—"}`;
}
function setFlow(x){ // x in [-1,1]
  const pct = (clamp((x+1)/2)*100);
  flowNeedle.style.left = pct+"%";
  flowLabel.textContent = x>0.07?"Feeding":(x<-0.07?"Starving":"Neutral");
}

/***** backend polling *****/
async function fetchPrice(){
  const r = await fetch(`${API}/health`, { cache:"no-cache" });
  const j = await r.json();
  const price = Number(j.price||0);
  lastPrice = price;
  priceLabel.textContent = price>0 ? `$${price.toFixed(4)}` : "$—";
  updatedLabel.textContent = nowStr();
  return price;
}
async function fetchTrades(){
  const r = await fetch(`${API}/trades`, { cache:"no-cache" });
  const j = await r.json();
  // j may be either {ok:true,trades:[...]} or raw array. Normalize:
  const arr = Array.isArray(j) ? j : (j.trades || []);
  // Map to our shape: time, type ("feed"/"starve"), valueUsd, priceUsd
  const rows = arr.map(x => {
    // Try common field names; fall back to our simulator names
    const side = (x.side || x.type || "").toString().toUpperCase();
    const type = side==="BUY" ? "feed" : side==="SELL" ? "starve" : (x.type||"feed");
    const priceUsd = x.priceUsd ?? x.price ?? 0;
    const valueUsd = x.valueUsd ?? ( (x.amount && x.price) ? x.amount*x.price : 0 );
    const ts = x.ts || x.time || Date.now();
    return { time: ts, type, valueUsd, priceUsd };
  });

  // render
  tradesBody.innerHTML = "";
  let buys=0, sells=0;
  rows.slice(0,10).forEach(r => {
    if (r.type==="feed") buys += r.valueUsd||0;
    if (r.type==="starve") sells += r.valueUsd||0;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="left">${fmtTime(r.time)}</td>
      <td class="left ${r.type==="feed"?"type-feed":"type-starve"}">${cap(r.type)}</td>
      <td class="left">${fmtMoney(r.valueUsd)}</td>
      <td class="left">${fmtUSD(r.priceUsd||0)}</td>
    `;
    tradesBody.appendChild(tr);
  });

  // set flow target [-1..1]
  const net = (buys - sells) / Math.max(1, buys + sells);
  flowTarget = clamp(net, -1, 1);
}

function fmtMoney(v){
  if (!v || v<=0) return "$0.00";
  if (v < 10) return "$" + v.toFixed(2);
  if (v < 1000) return "$" + v.toFixed(2);
  return "$" + v.toLocaleString(undefined,{maximumFractionDigits:0});
}
function cap(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function fmtTime(ts){
  const d = new Date(Number(ts));
  if (isNaN(d)) return nowStr();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/***** tiny life logic *****/
function tickDecay(){
  // decay 1% / 10m ≈ 0.001 per 60s → per 10s tick ≈ 0.000167; we’ll be playful:
  setHealth(HEALTH - 0.005);
}
// glide flow towards target; nudge health
setInterval(() => {
  const needle = parseFloat(flowNeedle.style.left||"50");
  const cur = (needle/100)*2 - 1;
  const next = cur + (flowTarget - cur)*0.2;
  setFlow(next);
  // small health nudge
  const delta = 0.02 * next;
  setHealth(HEALTH + delta);
}, 1500);

/***** Buttons *****/
sfxBtn.addEventListener("click", () => {
  if (!AC) { initAudio(); sfxOn(); sfxBtn.textContent = "🔊 SFX On"; }
  else { if (gain.gain.value>0.01){ sfxOff(); sfxBtn.textContent="🔇 SFX Off"; } else { sfxOn(); sfxBtn.textContent="🔊 SFX On"; } }
});
feedBtn.addEventListener("click", (ev) => {
  ev.preventDefault();
  // micro nudge to “feed”
  setHealth( clamp(HEALTH + 0.04, 0, 1) );
});

/***** Boot *****/
decayRate.textContent = "1% / 10m";
setHealth(HEALTH); setMutation(MUT);
pollHealth();  pollTrades();
setInterval(tickDecay, 10_000);
setInterval(pollHealth, POLL_HEALTH_MS);
setInterval(pollTrades, POLL_TRADES_MS);

/***** pollers *****/
async function pollHealth(){ try{ await fetchPrice(); }catch(e){ console.error("price fetch:", e); } }
async function pollTrades(){ try{ await fetchTrades(); }catch(e){ console.error("trades fetch:", e); } }
