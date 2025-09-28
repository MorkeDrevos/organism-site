/***** CONFIG *****/
const API = "https://organism-backend.onrender.com"; // Render backend

/***** DOM *****/
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });
const statusWrd   = document.getElementById("status");
const heartbeat   = document.getElementById("heartbeat");
const healthBar   = document.getElementById("healthBar");
const healthPct   = document.getElementById("healthPct");
const mutBar      = document.getElementById("mutBar");
const mutPct      = document.getElementById("mutPct");
const decayRate   = document.getElementById("decayRate");
const stageNum    = document.getElementById("stageNum");
const stageBadge  = document.getElementById("stageBadge");
const priceLabel  = document.getElementById("priceLabel");
const updatedLabel= document.getElementById("updatedLabel");
const flowBar     = document.getElementById("flowBar");
const flowNeedle  = document.getElementById("flowNeedle");
const flowLabel   = document.getElementById("flowLabel");
const tradesBody  = document.getElementById("trades-body");
const sfxBtn      = document.getElementById("sfxBtn");
const feedBtn     = document.getElementById("feedBtn");

/***** helpers *****/
const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
const fmtUSD = n => (n==null||isNaN(n)) ? "$—" : `$${n.toFixed(4).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'')}`;
const pad2   = n => String(n).padStart(2,"0");
const nowHHMMSS = () => { const d=new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };

/***** canvas sizing *****/
function sizeCanvas(){
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", sizeCanvas);
sizeCanvas();

/***** draw creature (womb) *****/
let t0 = performance.now();
function drawOrganism(){
  const W = canvas.width, H = canvas.height;
  const t = (performance.now()-t0)/1000;

  ctx.clearRect(0,0,W,H);

  // vignette / fluid
  const g = ctx.createRadialGradient(0.65*W, 0.32*H, H*0.05, 0.65*W, 0.35*H, H*0.9);
  g.addColorStop(0, "rgba(10, 40, 55, .22)");
  g.addColorStop(1, "rgba(4, 10, 16, .95)");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);

  // concentric rings
  ctx.save();
  ctx.translate(0.6*W, 0.48*H);
  for(let i=1;i<=6;i++){
    ctx.beginPath();
    ctx.arc(0,0, i*44 + Math.sin(t*0.8+i)*2, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(140, 200, 205, ${0.02 + 0.045/(i)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // motes
  for(let i=0;i<30;i++){
    const a = i*0.21 + t*0.05;
    const r = 40 + i*9 + Math.sin(t*0.3+i)*2;
    const x = Math.cos(a)*r, y = Math.sin(a*1.2)*r*0.6;
    ctx.beginPath();
    ctx.arc(x,y, 1.2+0.8*Math.sin(t+i), 0, Math.PI*2);
    ctx.fillStyle = "rgba(200,240,255,.15)";
    ctx.fill();
  }

  // nucleus
  const puls = 48 + 5*Math.sin(t*2.1);
  const neb  = ctx.createRadialGradient(0,0, puls*0.2, 0,0, puls);
  neb.addColorStop(0, "rgba(160, 255, 215, .9)");
  neb.addColorStop(1, "rgba(90, 180, 170, .05)");
  ctx.fillStyle = neb;
  ctx.beginPath();
  ctx.arc(0,0, puls, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  requestAnimationFrame(drawOrganism);
}
requestAnimationFrame(drawOrganism);

/***** model *****/
let HEALTH = 0.55, MUT=0.06, STAGE=1;
let netWindow = []; // last 5 minutes of USD flow {ts, val}
const POLL_HEALTH_MS = 6000;
const POLL_TRADES_MS = 6000;

/***** API calls *****/
async function getJSON(url){
  const r = await fetch(url, { cache:"no-store" });
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function pollHealth(){
  try{
    const j = await getJSON(`${API}/health`);
    if (typeof j.price === "number") {
      priceLabel.textContent = fmtUSD(j.price);
    } else {
      priceLabel.textContent = "$—";
    }
    updatedLabel.textContent = nowHHMMSS();

    // nudge health a tiny bit by price drift (just keeps it “alive” visually)
    HEALTH = clamp(HEALTH + (Math.random()-0.5)*0.005);
    setVitals();
  }catch(e){
    console.error("health fetch:", e);
  }
}

async function pollTrades(){
  try{
    const arr = await getJSON(`${API}/trades`);
    // Accept either normalized or Jupiter-like and map
    const mapped = Array.isArray(arr) ? arr.map(mapTrade).filter(Boolean) : [];
    renderTrades(mapped.slice(0,10));
    updateFlow(mapped);
  }catch(e){
    console.error("trades fetch:", e);
  }
}

function mapTrade(x){
  // Normalized: { time, type:'feed'|'starve', valueUsd, priceUsd }
  if (x && "time" in x && "type" in x) return {
    time: x.time, type: x.type, valueUsd: +x.valueUsd || 0, priceUsd: +x.priceUsd || 0
  };

  // Jupiter-ish fallback: { side, price, amount, ts }
  if (x && (x.side||x.type)) {
    const type = (x.side||x.type||"").toString().toLowerCase()==="buy" ? "feed":"starve";
    const valueUsd = (+x.price||0) * (+x.amount||0);
    const priceUsd = +x.price || 0;
    const ts = x.ts ? new Date(+x.ts) : new Date();
    return { time: ts.toISOString(), type, valueUsd, priceUsd };
  }
  return null;
}

/***** renderers *****/
function setVitals(){
  healthBar.style.width = `${Math.round(HEALTH*100)}%`;
  healthPct.textContent = `${Math.round(HEALTH*100)}%`;
  mutBar.style.width = `${Math.round(MUT*100)}%`;
  mutPct.textContent = `${Math.round(MUT*100)}%`;
  stageNum.textContent = STAGE;
  stageBadge.textContent = `Stage ${STAGE} · The Cell`;
}

function renderTrades(rows){
  tradesBody.innerHTML = "";
  for(const r of rows){
    const tr = document.createElement("tr");
    const d = new Date(r.time);
    const hhmmss = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    const cls = r.type==="feed" ? "type-feed":"type-starve";
    tr.innerHTML = `
      <td>${hhmmss}</td>
      <td class="${cls}">${r.type[0].toUpperCase()+r.type.slice(1)}</td>
      <td>${fmtUSD(r.valueUsd)}</td>
      <td>${fmtUSD(r.priceUsd)}</td>
    `;
    tradesBody.appendChild(tr);
  }
}

function updateFlow(rows){
  const now = Date.now();
  for(const r of rows){
    const v = (r.type==="feed"?+r.valueUsd:-r.valueUsd) || 0;
    netWindow.push({ts: now, val:v});
  }
  // keep last 5m
  const cutoff = now - 5*60*1000;
  netWindow = netWindow.filter(x => x.ts >= cutoff);

  const sum = netWindow.reduce((a,b)=>a+b.val,0);
  // needle in [0..100%] bar space
  const pct = clamp(0.5 + (sum/200) , 0, 1); // scale
  flowNeedle.style.left = `${pct*100}%`;
  flowLabel.textContent = sum>3 ? "Feeding" : sum<-3 ? "Starving" : "Neutral";

  // tiny nudge to health so it feels alive
  HEALTH = clamp(HEALTH + clamp(sum,-5,5)*0.0005);
  setVitals();
}

/***** SFX (muted by default) *****/
let AC=null, gain=null;
function initAudio(){
  if (AC) return;
  AC = new (window.AudioContext||window.webkitAudioContext)();
  gain = AC.createGain(); gain.gain.value=.0; gain.connect(AC.destination);

  const o = AC.createOscillator(); o.type="sine"; o.frequency.value=36; o.connect(gain); o.start();
  const lfo = AC.createOscillator(); lfo.type="sine"; lfo.frequency.value=0.18;
  const lfoGain = AC.createGain(); lfoGain.gain.value=8;
  lfo.connect(lfoGain); lfoGain.connect(o.frequency); lfo.start();

  gain.gain.linearRampToValueAtTime(0.08, AC.currentTime+2);
}
sfxBtn.addEventListener("click", ()=>{
  if (!AC) { initAudio(); sfxBtn.textContent="🔊 SFX On"; }
  else {
    if (gain.gain.value>0) { gain.gain.value=0; sfxBtn.textContent="🔇 SFX Off"; }
    else { gain.gain.value=.08; sfxBtn.textContent="🔊 SFX On"; }
  }
});

/***** Buttons *****/
feedBtn.addEventListener("click", (ev)=>{
  ev.preventDefault();
  HEALTH = clamp( HEALTH + 0.04 );
  setVitals();
});

/***** Boot *****/
decayRate.textContent = "1% / 10m";
setVitals();
pollHealth();  pollTrades();
setInterval(pollHealth, POLL_HEALTH_MS);
setInterval(pollTrades, POLL_TRADES_MS);
