/* ====== CONFIG ====== */
const API = "https://organism-backend.onrender.com"; // <— your backend base
const POLL_HEALTH_MS = 6000;
const POLL_TRADES_MS = 6000;

/* ====== Canvas setup (fullscreen womb) ====== */
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

function resizeCanvas(){
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/* ====== Creature draw loop ====== */
let t0 = performance.now();
function drawOrganism(){
  const W = canvas.width, H = canvas.height;
  const t = (performance.now() - t0)/1000;
  const cx = W*0.5, cy = H*0.38; // a bit higher up

  ctx.clearRect(0,0,W,H);

  // faint vignette (subtle)
  const vg = ctx.createRadialGradient(cx, cy, Math.min(W,H)*0.15, cx, cy, Math.min(W,H)*0.9);
  vg.addColorStop(0, "rgba(20,40,50,0.15)");
  vg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vg;
  ctx.fillRect(0,0,W,H);

  // concentric rings drifting
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.02*Math.sin(t*0.2));
  for(let i=0;i<6;i++){
    const r = 110 + i*80 + 8*Math.sin(t*0.8 + i);
    ctx.beginPath();
    ctx.arc(0,0, r, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(130,165,185,${0.08 - i*0.01})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();

  // drifting motes
  for(let i=0;i<32;i++){
    const a = i*0.2 + t*0.15 + i;
    const rr = 160 + (i%6)*70;
    const x = cx + Math.cos(a)*rr*0.55;
    const y = cy + Math.sin(a*0.9)*rr*0.35;
    ctx.fillStyle = "rgba(190,220,220,0.12)";
    ctx.beginPath(); ctx.arc(x,y, 2 + (i%3)*0.5, 0, Math.PI*2); ctx.fill();
  }

  // pulsing nucleus (womby glow)
  const pulse = 1 + 0.1*Math.sin(t*3.5);
  const base = 72 + 28*Math.sin(t*1.6);
  const hue  = 160 + 20*Math.sin(t*0.4);

  const grd = ctx.createRadialGradient(cx, cy, base*0.1, cx, cy, base*1.3*pulse);
  grd.addColorStop(0, `hsla(${hue},75%,65%,0.9)`);
  grd.addColorStop(0.5, `hsla(${hue},55%,45%,0.25)`);
  grd.addColorStop(1, `hsla(${hue},35%,10%,0)`);

  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, base*1.4, 0, Math.PI*2);
  ctx.fill();

  requestAnimationFrame(drawOrganism);
}
drawOrganism();

/* ====== DOM refs ====== */
const priceLabel   = document.getElementById("priceLabel");
const updatedLabel = document.getElementById("updatedLabel");
const flowBar      = document.getElementById("flowBar");
const flowNeedle   = document.getElementById("flowNeedle");
const flowLabel    = document.getElementById("flowLabel");

const healthBar = document.getElementById("healthBar");
const healthPct = document.getElementById("healthPct");
const mutBar    = document.getElementById("mutBar");
const mutPct    = document.getElementById("mutPct");
const decayRate = document.getElementById("decayRate");
const stageNum  = document.getElementById("stageNum");
const stageBadge= document.getElementById("stageBadge");

const tradesBody = document.getElementById("trades-body");
const sfxBtn     = document.getElementById("sfxBtn");
const feedBtn    = document.getElementById("feedBtn");

/* ====== Helpers ====== */
const pad2 = n => String(n).padStart(2,"0");
function fmtUSD(n){ if(n==null||isNaN(n)) return "$—"; return "$"+Number(n).toFixed(4).replace(/(\d)(?=(\d{3})+\.)/g,'$1,'); }
function fmtMoney(n){ if(n==null||isNaN(n)) return "$—"; return "$"+Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function stTime(ts){
  const d = ts ? new Date(ts) : new Date(); 
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/* ====== State ====== */
let HEALTH = 0.53;
let MUT    = 0.06;
let FLOW   = 0;     // -1 .. +1
let SFX    = false;

/* ====== SFX (optional, click to start) ====== */
let AC, hum, lfo;
function initAudio(){
  if(AC) return;
  AC = new (window.AudioContext||window.webkitAudioContext)();
  hum = AC.createOscillator(); hum.type="sine"; hum.frequency.value=110;
  lfo = AC.createOscillator(); lfo.type="sine"; lfo.frequency.value=0.18;
  const lfoGain = AC.createGain(); lfoGain.gain.value=8;
  const out = AC.createGain(); out.gain.value=0.06;
  lfo.connect(lfoGain).connect(hum.frequency);
  hum.connect(out).connect(AC.destination);
  hum.start(); lfo.start();
}
sfxBtn.addEventListener("click",()=>{
  SFX = !SFX;
  if(SFX){ initAudio(); sfxBtn.innerHTML = "<span>🔊</span> SFX On"; AC.resume(); }
  else   { sfxBtn.innerHTML = "<span>🔇</span> SFX Off"; AC && AC.suspend(); }
});

/* ====== UI setters ====== */
function setHealth(v){
  HEALTH = Math.max(0, Math.min(1, v));
  healthBar.style.width = `${Math.round(HEALTH*100)}%`;
  healthPct.textContent = `${Math.round(HEALTH*100)}%`;
}
function setMutation(v){
  MUT = Math.max(0, Math.min(1, v));
  mutBar.style.width = `${Math.round(MUT*100)}%`;
  mutPct.textContent = `${Math.round(MUT*100)}%`;
}
function setFlow(x){
  FLOW = Math.max(-1, Math.min(1, x));
  const pct = (FLOW+1)/2; // 0..1
  flowNeedle.style.left = `${pct*100}%`;
  flowLabel.textContent = FLOW>0.05 ? "Feeding" : FLOW<-0.05 ? "Starving" : "Neutral";
}

/* ====== Poll backend ====== */
async function pollHealth(){
  try{
    const r = await fetch(`${API}/health`);
    const j = await r.json();
    const price = (typeof j.price==="number") ? j.price : 0;
    priceLabel.textContent   = fmtUSD(price);
    updatedLabel.textContent = stTime(j.timestamp||Date.now());
    // nudge health gently toward a target from price (demo mapping)
    const target = Math.max(0, Math.min(1, price*10)); // cheap mapping
    setHealth( HEALTH + (target-HEALTH)*0.08 );
  }catch(e){
    // keep UI up, ignore
  }
}

async function pollTrades(){
  try{
    const r = await fetch(`${API}/trades`);
    const j = await r.json();

    // expect either normalized: [{ time, type, valueUsd, priceUsd }]
    // or Jupiter-like: [{ side, price, amount, ts }]
    let rows = j;
    if(!Array.isArray(rows) && Array.isArray(j.trades)) rows = j.trades;

    // adapt if Jupiter shape
    rows = rows.map(it=>{
      if("type" in it) return it;
      return {
        time: it.ts ? (typeof it.ts==="number" ? it.ts : Date.parse(it.ts)) : Date.now(),
        type: String(it.side||"").toLowerCase()==="buy" ? "feed" : "starve",
        valueUsd: (Number(it.price||0) * Number(it.amount||0)) || 0,
        priceUsd: Number(it.price||0) || 0
      };
    });

    // last 8 newest (desc by time)
    rows.sort((a,b)=> (b.time||0)-(a.time||0));
    rows = rows.slice(0,8);

    // render
    tradesBody.innerHTML = "";
    let buys=0, sells=0;
    for(const it of rows){
      const tr = document.createElement("tr");
      const type = (it.type||"").toLowerCase()==="feed" ? "feed" : "starve";
      if(type==="feed") buys += (it.valueUsd||0); else sells += (it.valueUsd||0);

      tr.innerHTML = `
        <td class="left">${stTime(it.time)}</td>
        <td class="left ${type==="feed"?"type-feed":"type-starve"}">${type[0].toUpperCase()+type.slice(1)}</td>
        <td class="left">${fmtMoney(it.valueUsd||0)}</td>
        <td class="left">${fmtUSD(it.priceUsd||0)}</td>
      `;
      tradesBody.appendChild(tr);
    }

    // flow from recent trades
    const net = (buys - sells) / Math.max(1, buys + sells); // -1..+1
    setFlow(net);
    // small health nudge from net
    setHealth( HEALTH + net*0.06 );
  }catch(e){
    // ignore
  }
}

/* ====== Decay driver ====== */
function tickDecay(){
  setHealth(HEALTH - 0.01); // 1% every 10s (matches label)
  if(HEALTH < 0.08) setMutation(Math.min(1, MUT + 0.01));
}

/* ====== Buttons ====== */
feedBtn.addEventListener("click",(ev)=>{
  ev.preventDefault();
  // micro “feed” nudge
  setHealth(Math.min(1, HEALTH + 0.05));
});

/* ====== Boot ====== */
decayRate.textContent = "1% / 10m";
setHealth(HEALTH); setMutation(MUT);
pollHealth(); pollTrades();
setInterval(tickDecay, 10_000);
setInterval(pollHealth, POLL_HEALTH_MS);
setInterval(pollTrades, POLL_TRADES_MS);
