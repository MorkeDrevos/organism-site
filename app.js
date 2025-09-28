/* ========= CONFIG ========= */
const API_BASE = "https://organism-backend.onrender.com"; // <-- change if needed
const POLL_HEALTH_MS = 6_000;
const POLL_TRADES_MS = 6_000;

/* ========= Canvas / Womb ========= */
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });
let W=0, H=0, t0=performance.now();

function resizeCanvas(){ W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener("resize", resizeCanvas); resizeCanvas();

function drawOrganism(now){
  const t = (now - t0) / 1000;
  ctx.clearRect(0,0,W,H);

  // center-top-ish to leave space for panels
  const cx = W*0.5, cy = H*0.42;

  // concentric womb rings
  for(let i=0;i<6;i++){
    const r = 120 + i*70 + Math.sin(t*0.6+i)*4;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle = `rgba(44,86,106,${0.22 - i*0.03})`;
    ctx.lineWidth = 1.2; ctx.stroke();
  }

  // drifting motes
  for(let i=0;i<28;i++){
    const a = i*0.22 + t*0.12, rr = 130 + (i%6)*52 + Math.sin(t*0.9+i)*6;
    const x = cx + Math.cos(a)*rr, y = cy + Math.sin(a)*rr*0.62;
    ctx.beginPath(); ctx.arc(x,y, 1.2 + (i%3)*0.6, 0, Math.PI*2);
    ctx.fillStyle = "rgba(160,220,220,.18)"; ctx.fill();
  }

  // pulsing nucleus (health mapped)
  const pulse = 1 + 0.06*Math.sin(t*4.0);
  const base = 58 + 34*Math.sin(t*1.8);
  const hue = 190 + 20*Math.sin(t*.2);
  const grd = ctx.createRadialGradient(cx,cy, base*0.1, cx,cy, base*1.15*pulse);
  grd.addColorStop(0, `hsla(${hue},75%,70%,.80)`);
  grd.addColorStop(1, `hsla(${hue},35%,12%,0)`);
  ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx,cy, base*1.2, 0, Math.PI*2); ctx.fill();

  requestAnimationFrame(drawOrganism);
}
requestAnimationFrame(drawOrganism);

/* ========= UI hooks ========= */
const priceLabel = document.getElementById("priceLabel");
const updatedLabel = document.getElementById("updatedLabel");
const flowBar = document.getElementById("flowBar");
const flowLabel = document.getElementById("flowLabel");
const healthBar = document.getElementById("healthBar");
const healthPct = document.getElementById("healthPct");
const mutBar = document.getElementById("mutBar");
const mutPct = document.getElementById("mutPct");
const stageNum = document.getElementById("stageNum");
const decayRate = document.getElementById("decayRate");
const tradesBody = document.getElementById("trades-body");
const sfxBtn = document.getElementById("sfxBtn");
const feedBtn = document.getElementById("feedBtn");
const tradeBtn = document.getElementById("tradeBtn");

/* ========= Helpers ========= */
const pad2 = n => String(n).padStart(2,"0");
const fmtUSD = n => isFinite(n) ? `$${n.toFixed(4)}`.replace(/(\.\d*[1-9])0+$/,"$1").replace(/\.0000$/,"$0.0000") : "$0";
const fmtTime = ts => { const d=new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };
function setHealth(v){ const p = Math.max(0,Math.min(1,v)); healthBar.style.width = `${Math.round(p*100)}%`; healthPct.textContent = `${Math.round(p*100)}%`; }
function setMutation(v){ const p = Math.max(0,Math.min(1,v)); mutBar.style.width = `${Math.round(p*100)}%`; mutPct.textContent = `${Math.round(p*100)}%`; }
function setFlow(value){ // value in [-1,1] where + is feeding
  const clamped = Math.max(-1, Math.min(1, value));
  const t = (clamped+1)/2; // 0..1
  flowBar.style.transform = `scaleX(${t})`;
  flowLabel.textContent = clamped>0.06 ? "Feeding" : clamped<-0.06 ? "Starving" : "Neutral";
}

/* ========= Pollers ========= */
let lastPrice = 0;
let feedWins = 0, starveWins = 0; // simple 5m flow proxy

async function pollHealth(){
  try{
    const r = await fetch(`${API_BASE}/health`);
    const j = await r.json(); // { status?, price, timestamp }
    lastPrice = Number(j.price) || 0;
    priceLabel.textContent = fmtUSD(lastPrice);
    updatedLabel.textContent = fmtTime(Number(j.timestamp) || Date.now());
  }catch(e){
    console.error("health error", e);
  }
}

async function pollTrades(){
  try{
    const r = await fetch(`${API_BASE}/trades`);
    const arr = await r.json();
    // Accept either normalized shape or Jupiter-like and adapt
    const rows = Array.isArray(arr) ? arr.slice(0,10).map(x=>{
      if ("valueUsd" in x && "priceUsd" in x) {
        return {
          time: x.time || x.ts || Date.now(),
          type: String(x.type||"").toLowerCase(),  // "feed" | "starve"
          valueUsd: Number(x.valueUsd)||0,
          priceUsd: Number(x.priceUsd)||0
        };
      } else {
        // Jupiter-ish: { side:"buy"/"sell", price, amount, ts }
        const side = (x.side||"").toLowerCase();
        const price = Number(x.price)||0;
        const amt = Number(x.amount)||0;
        return {
          time: x.time || x.ts || Date.now(),
          type: side === "buy" ? "feed" : "starve",
          valueUsd: price * amt,
          priceUsd: price
        };
      }
    }) : [];

    // net flow over recent window
    let buys=0, sells=0;
    tradesBody.innerHTML = "";
    rows.forEach(row=>{
      if (row.type==="feed") buys += row.valueUsd; else sells += row.valueUsd;

      const tr = document.createElement("tr");
      const typeClass = row.type === "feed" ? "type-feed" : "type-starve";
      tr.innerHTML = `
        <td>${fmtTime(row.time)}</td>
        <td class="${typeClass}">${row.type==='feed' ? 'Feed' : 'Starve'}</td>
        <td>${fmtUSD(row.valueUsd)}</td>
        <td>${fmtUSD(row.priceUsd)}</td>
      `;
      tradesBody.appendChild(tr);
    });

    const net = (buys - sells) / Math.max(1, buys + sells); // -1..+1
    setFlow(net);

    // gently nudge vitals based on flow + price drift (toy logic)
    const delta = 0.18*net + 0.02*Math.sign(lastPrice);
    HEALTH = Math.max(0, Math.min(1, HEALTH + delta*0.02));
    setHealth(HEALTH);

  }catch(e){
    console.error("trades error", e);
  }
}

/* ========= Toy vitals / decay driver ========= */
let HEALTH = 0.62, MUT = 0.06;
function tickDecay(){
  HEALTH = Math.max(0, HEALTH - 0.01);   // slow decay
  MUT = Math.max(0, Math.min(1, MUT + (Math.random()-0.48)*0.01));
  setHealth(HEALTH); setMutation(MUT);
}

/* ========= SFX (optional hum) ========= */
let AC=null, hum=null, fxOn=false;
function initAudio(){
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  hum = AC.createOscillator(); const g = AC.createGain();
  hum.type="sine"; hum.frequency.value = 42; g.gain.value = 0.0009; // very subtle
  hum.connect(g).connect(AC.destination); hum.start();
}
sfxBtn.addEventListener("click", async () => {
  try{
    if (!AC) initAudio();
    if (AC.state === "suspended") await AC.resume();
    fxOn = !fxOn;
    sfxBtn.textContent = fxOn ? "🎧 SFX On" : "🎧 SFX Off";
    // gate by output gain
    AC.destination.context.gain ? (AC.destination.context.gain.value = fxOn?1:0)
      : null;
  }catch(e){ console.warn(e); }
});

/* ========= Buttons ========= */
feedBtn.addEventListener("click", (e)=>{ e.preventDefault(); HEALTH = Math.min(1, HEALTH + 0.06); setHealth(HEALTH); });

/* If you want a prefilled Jupiter link, set it here */
tradeBtn.href = "#";

/* ========= Boot ========= */
decayRate.textContent = "1% / 10m";
setHealth(HEALTH); setMutation(MUT);
pollHealth(); pollTrades();
setInterval(tickDecay, 10_000);
setInterval(pollHealth, POLL_HEALTH_MS);
setInterval(pollTrades, POLL_TRADES_MS);
