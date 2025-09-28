/***** CONFIG *****/
const API = "https://organism-backend.onrender.com";  // ← your backend base

/***** DOM *****/
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

const statusWord = document.getElementById("status");
const heartbeat  = document.getElementById("heartbeat");
const healthBar  = document.getElementById("healthBar");
const healthPct  = document.getElementById("healthPct");
const mutBar     = document.getElementById("mutBar");
const mutPct     = document.getElementById("mutPct");
const stageNum   = document.getElementById("stageNum");
const decayRate  = document.getElementById("decayRate");
const priceLabel = document.getElementById("priceLabel");
const updatedLabel = document.getElementById("updatedLabel");
const flowBar    = document.getElementById("flowBar");
const flowNeedle = document.getElementById("flowNeedle");
const flowLabel  = document.getElementById("flowLabel");
const tradesBody = document.getElementById("trades-body");
const sfxBtn     = document.getElementById("sfxBtn");
const feedBtn    = document.getElementById("feedBtn");

/***** helpers *****/
const clamp = (v, a, b)=> Math.max(a, Math.min(b, v));
const lerp  = (a,b,t)=> a + (b-a)*t;
const fmtUSD = n => (isNaN(n) || n==null) ? "$—" : `$${Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:6})}`;
const fmtTime = ts => {
  const d = new Date(ts);
  let hh = String(d.getHours()).padStart(2,"0");
  let mm = String(d.getMinutes()).padStart(2,"0");
  let ss = String(d.getSeconds()).padStart(2,"0");
  return `${hh}:${mm}:${ss}`;
};

/***** organism state *****/
let HEALTH = 0.54;    // 0..1
let MUT    = 0.00;    // 0..1
let STAGE  = 1;
let PRICE  = 0;
let FLOW   = 0;       // -1..+1 over a window
let sfx = false;

/***** canvas sizing *****/
function resizeCanvas(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/***** womb / organism draw loop *****/
let t0 = performance.now();
function drawOrganism(){
  const now = performance.now(); const t = (now - t0)/1000;
  const W = canvas.width, H = canvas.height;

  // clear (fade to keep softness)
  ctx.clearRect(0,0,W,H);

  // background deep vignettes
  const gradBg = ctx.createRadialGradient(W*0.65, H*0.38, 80, W*0.50, H*0.40, Math.max(W,H)*0.9);
  gradBg.addColorStop(0, "rgba(14,24,32,0.55)");
  gradBg.addColorStop(1, "rgba(8,12,18,0)");
  ctx.fillStyle = gradBg; ctx.fillRect(0,0,W,H);

  // concentric fluid rings
  ctx.save();
  ctx.translate(W*0.62, H*0.45);
  const hue = 190; // teal/blue
  for(let i=0;i<8;i++){
    const r = 60 + i*36 + Math.sin(t*0.6 + i)*2;
    ctx.strokeStyle = `hsla(${hue}, 40%, ${20+i*3}%, ${0.12 - i*0.01})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
  }

  // motes drifting
  for(let i=0;i<26;i++){
    const rr = 140 + (i*6);
    const ang = (i*0.47) + (t*0.08 + i*0.13);
    const x = Math.cos(ang)*rr, y = Math.sin(ang)*rr;
    const s = 1 + (i%3);
    ctx.fillStyle = `hsla(${hue}, 60%, 70%, .12)`;
    ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI*2); ctx.fill();
  }

  // pulsing nucleus (health-driven)
  const base = 50 + 40*HEALTH;
  const pulse = base + 6*Math.sin(t*2.2) + 3*Math.sin(t*3.7);
  const coreGrad = ctx.createRadialGradient(0,0,0, 0,0,pulse);
  coreGrad.addColorStop(0,  `hsla(${hue}, 80%, ${65+HEALTH*15}%, .95)`);
  coreGrad.addColorStop(1,  `hsla(${hue}, 60%, 18%, .0)`);
  ctx.fillStyle = coreGrad;
  ctx.beginPath(); ctx.arc(0,0,pulse,0,Math.PI*2); ctx.fill();

  ctx.restore();
  requestAnimationFrame(drawOrganism);
}
requestAnimationFrame(drawOrganism);

/***** web audio (womb whoosh) *****/
let AC=null, gMain=null, noiseNode=null, lfo=null;
function initAudio(){
  if(AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();

  // pink-ish noise
  const bufSize = 2**14;
  const node = AC.createScriptProcessor(bufSize,1,1);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  node.onaudioprocess = e=>{
    const out = e.outputBuffer.getChannelData(0);
    for(let i=0;i<out.length;i++){
      const white = Math.random()*2-1;
      b0 = 0.99886*b0 + white*0.0555179;
      b1 = 0.99332*b1 + white*0.0750759;
      b2 = 0.96900*b2 + white*0.1538520;
      b3 = 0.86650*b3 + white*0.3104856;
      b4 = 0.55000*b4 + white*0.5329522;
      b5 = -0.7616*b5 - white*0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white*0.5362;
      b6 = white*0.115926;
      out[i] = pink*0.04;
    }
  };

  const bp = AC.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 120; bp.Q.value = 0.6;

  const lfoOsc = AC.createOscillator(); lfoOsc.frequency.value = 0.12;
  const lfoGain = AC.createGain(); lfoGain.gain.value = 80;
  lfoOsc.connect(lfoGain).connect(bp.frequency);

  gMain = AC.createGain(); gMain.gain.value = 0.0;

  node.connect(bp).connect(gMain).connect(AC.destination);
  lfoOsc.start();
  noiseNode = node; lfo = lfoOsc;
}

sfxBtn.addEventListener("click", ()=>{
  sfx = !sfx;
  sfxBtn.textContent = sfx ? "🔊 SFX On" : "🔇 SFX Off";
  if(sfx){
    initAudio();
    // ramp up gently
    const tgt = 0.22 + 0.18*HEALTH;
    gMain.gain.cancelScheduledValues(AC.currentTime);
    gMain.gain.linearRampToValueAtTime(tgt, AC.currentTime + 0.6);
  }else if(AC){
    gMain.gain.cancelScheduledValues(AC.currentTime);
    gMain.gain.linearRampToValueAtTime(0.0, AC.currentTime + 0.4);
  }
});

/***** health/mutation small driver *****/
function setHealth(v){ HEALTH = clamp(v,0,1); healthBar.style.width = `${Math.round(HEALTH*100)}%`; healthPct.textContent = `${Math.round(HEALTH*100)}%`; }
function setMutation(v){ MUT = clamp(v,0,1); mutBar.style.width = `${Math.round(MUT*100)}%`; mutPct.textContent = `${Math.round(MUT*100)}%`; }
function setStage(n){ STAGE = n; stageNum.textContent = String(n); document.getElementById("stageBadge")?.textContent = `Stage ${n} · The Cell`; }

/***** pollers *****/
const POLL_HEALTH_MS = 6000;
const POLL_TRADES_MS = 6000;
decayRate.textContent = "1% / 10m";

let lastPrice = 0;
let windowBuys = 0, windowSells = 0; // USD sums over rolling window
const WINDOW_SEC = 300;              // 5m
const tradeWindow = [];

async function pollHealth(){
  try{
    const r = await fetch(`${API}/health`);
    const j = await r.json();
    const price = Number(j.price)||0; lastPrice = price; PRICE = price;

    priceLabel.textContent = fmtUSD(price);
    updatedLabel.textContent = fmtTime(Number(j.timestamp)||Date.now());

    // nudge health a touch towards price motion via flow
    const net = (windowBuys - windowSells);
    const dir = Math.sign(net);
    const delta = clamp(dir*0.004, -0.02, 0.02); // tiny
    setHealth( HEALTH*0.985 + (HEALTH+delta)*0.015 );

    // flow needle (−1..1)
    const denom = Math.max(10, (windowBuys + windowSells));
    const f = clamp(net/denom, -1, 1);
    FLOW = lerp(FLOW, f, 0.25);
    flowNeedle.style.left = `${50 + FLOW*48}%`;
    flowLabel.textContent = FLOW>0.08 ? "Feeding" : (FLOW<-0.08 ? "Starving" : "Neutral");

    if(sfx && AC){ // react volume to health
      const tgt = 0.22 + 0.18*HEALTH;
      gMain.gain.linearRampToValueAtTime(tgt, AC.currentTime + 0.2);
    }
  }catch(e){
    console.error("health fetch:", e);
  }
}

function normalizeTrades(arr){
  // Accept either our simple shape or Jupiter-like
  // Expected out: [{ time: ms, type: "feed"|"starve", valueUsd: number, priceUsd: number }]
  const out = [];
  for(const it of (arr||[])){
    if("time" in it && "type" in it){
      out.push({ time: Number(it.time), type: String(it.type).toLowerCase(), valueUsd: Number(it.valueUsd)||0, priceUsd: Number(it.priceUsd)||0 });
    }else if(("side" in it) && ("price" in it)){
      // Jupiter-like adapter: amount is token count, price is price per token USD
      const val = (Number(it.price)||0) * (Number(it.amount)||0);
      out.push({ time: Number(it.ts)||Date.now(), type: String(it.side).toLowerCase()=="buy" ? "feed":"starve", valueUsd: val, priceUsd: Number(it.price)||0 });
    }
  }
  return out.sort((a,b)=> b.time - a.time).slice(0,10);
}

function renderTrades(rows){
  tradesBody.innerHTML = "";
  let buys=0, sells=0;

  for(const r of rows){
    const tr = document.createElement("tr");
    const tType = r.type==='feed' ? 'type-feed' : 'type-starve';
    tr.innerHTML = `
      <td class="left">${fmtTime(r.time)}</td>
      <td class="left ${tType}">${r.type==='feed'?'Feed':'Starve'}</td>
      <td class="left">${fmtUSD(r.valueUsd)}</td>
      <td class="left">${fmtUSD(r.priceUsd)}</td>
    `;
    tradesBody.appendChild(tr);

    if(r.type==='feed') buys += r.valueUsd; else sells += r.valueUsd;
  }

  // Maintain 5m window for flow
  const now = Date.now();
  tradeWindow.push({ts: now, buys, sells});
  while(tradeWindow.length && (now - tradeWindow[0].ts) > WINDOW_SEC*1000) tradeWindow.shift();
  windowBuys = tradeWindow.reduce((s,x)=>s+x.buys,0);
  windowSells = tradeWindow.reduce((s,x)=>s+x.sells,0);
}

async function pollTrades(){
  try{
    const r = await fetch(`${API}/trades`);
    const j = await r.json();
    const rows = normalizeTrades(j.trades || j || []);
    renderTrades(rows);
  }catch(e){
    console.error("trades fetch:", e);
    // if backend returns nothing, keep old rows (no crash)
  }
}

/***** Buttons *****/
feedBtn.addEventListener("click",(ev)=>{
  ev.preventDefault();
  // micro “feel”
  setHealth( clamp(HEALTH + 0.04, 0, 1) );
});

/***** Boot *****/
setHealth(HEALTH); setMutation(MUT);
pollHealth();  pollTrades();
setInterval(pollHealth,  POLL_HEALTH_MS);
setInterval(pollTrades,  POLL_TRADES_MS);
