/***** CONFIG *****/
const API = "https://organism-backend.onrender.com"; // unchanged

/***** DOM *****/
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

/***** HUD refs (unchanged ids) *****/
const statusWord   = document.getElementById("status");
const heartbeat    = document.getElementById("heartbeat");
const netBar       = document.getElementById("flowBar");
const healthBar    = document.getElementById("healthBar");
const mutBar       = document.getElementById("mutBar");
const healthPct    = document.getElementById("healthPct");
const mutPct       = document.getElementById("mutPct");
const stageNum     = document.getElementById("stageNum");
const decayRate    = document.getElementById("decayRate");
const priceLabel   = document.getElementById("priceLabel");
const updatedLabel = document.getElementById("updatedLabel");
const tradesBody   = document.getElementById("trades-body");
const sfxBtn       = document.getElementById("sfxBtn");
const feedBtn      = document.getElementById("feedBtn");

/***** helpers *****/
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const lerp  = (a,b,t)=>a+(b-a)*t;
const fmtUSD = n => n==null ? "$—" : `$${Number(n).toFixed(4)}`;
const two = n => String(n).padStart(2,"0");
const hhmmss = () => {
  const d = new Date();
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
};

/***** state (ui) *****/
let HEALTH = 0.54;        // 0..1 visual health
let MUT    = 0.06;        // 0..1 mutation
let STAGE  = 1;
let FLOW   = 0;           // -1..1 net flow
decayRate.textContent = "1% / 10m";

/***** audio (optional) *****/
let AC = null, gain=null;
async function initAudio(){
  if(AC) return;
  AC = new (window.AudioContext||window.webkitAudioContext)();
  const osc = AC.createOscillator();
  gain = AC.createGain();
  gain.gain.value = 0.0;
  osc.type = "sine";
  osc.frequency.value = 19;        // very low “room” hum
  osc.connect(gain).connect(AC.destination);
  osc.start();
}
sfxBtn.addEventListener("click", async ()=>{
  if(!AC){ await initAudio(); sfxBtn.textContent="SFX On"; return; }
  if(gain.gain.value<=0.001){ gain.gain.linearRampToValueAtTime(0.06, AC.currentTime+0.4); sfxBtn.textContent="SFX On"; }
  else { gain.gain.linearRampToValueAtTime(0.0, AC.currentTime+0.4); sfxBtn.textContent="SFX Off"; }
});

/***** layout sizing: make creature higher, esp. on mobile *****/
function isMobile(){ return window.innerWidth <= 980; }
function resizeCanvas(){
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/***** organism visuals *****/
const motes = [];
const MAX_MOTES = 24;
const TAU = Math.PI*2;
let t0 = performance.now();

/* seed motes with irregular drift */
function seedMotes(){
  motes.length = 0;
  for(let i=0;i<MAX_MOTES;i++){
    motes.push({
      r: 0.20 + Math.random()*0.45,          // relative orbit radius
      a: Math.random()*TAU,                  // angle
      // speeds are irregular (slower overall)
      w1: (0.02 + Math.random()*0.04) * (Math.random()<.5?1:-1),
      w2: (0.003 + Math.random()*0.010),
      phase: Math.random()*TAU,
      size: 1.2 + Math.random()*1.6
    });
  }
}
seedMotes();

/** draw concentric rings with ripple distortion */
function ringPath(cx, cy, R, amp, t, k1=3, k2=7){
  // Sample points around the circle; ripple the radius
  ctx.beginPath();
  const steps = 160;
  for(let i=0;i<=steps;i++){
    const ang = (i/steps)*TAU;
    const ripple = amp * Math.sin(ang*k1 + t*0.5) + 0.6*amp * Math.sin(ang*k2 - t*0.22);
    const r = R + ripple;
    const x = cx + r*Math.cos(ang);
    const y = cy + r*Math.sin(ang);
    (i===0)? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  }
  ctx.closePath();
}

function drawOrganism(now){
  const t = (now - t0)/1000;

  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  // center higher (mobile slightly higher)
  const cx = W*0.50;
  const cy = H * (isMobile()? 0.36 : 0.42);
  const R  = Math.min(W,H)*0.42;

  // ---- Background – deep womb tint + vignette
  // radial glow (amniotic fluid look)
  let g = ctx.createRadialGradient(cx,cy, R*0.05, cx,cy, R*1.10);
  g.addColorStop(0.00, "rgba(100,180,200,0.16)");
  g.addColorStop(0.35, "rgba(60,110,130,0.10)");
  g.addColorStop(0.75, "rgba(20,30,40,0.06)");
  g.addColorStop(1.00, "rgba(10,15,22,0.00)");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);

  // very soft vignette
  let vg = ctx.createRadialGradient(cx,cy, R*0.6, cx,cy, R*1.35);
  vg.addColorStop(0.0, "rgba(0,0,0,0.00)");
  vg.addColorStop(1.0, "rgba(0,0,0,0.22)");
  ctx.fillStyle = vg;
  ctx.fillRect(0,0,W,H);

  // ---- Concentric rings with subtle fluid ripple (slower)
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(180,210,220,0.10)";
  const rings = 5;
  for(let i=0;i<rings;i++){
    const base = (0.22 + 0.18*i)*R;
    const amp = 3 + i*1.5;            // ripple amplitude in px
    ringPath(cx, cy, base, amp, t);
    ctx.stroke();
  }

  // ---- Motes (irregular slow drift; tiny parallax)
  for(const m of motes){
    const ang = m.a + m.w1*t + Math.sin(m.phase + t*m.w2)*0.4;
    const rr  = m.r * R * (0.98 + 0.02*Math.sin(t*0.3 + m.phase));
    const x = cx + rr*Math.cos(ang);
    const y = cy + rr*Math.sin(ang);
    ctx.beginPath();
    ctx.fillStyle = "rgba(200,230,240,0.18)";
    ctx.arc(x,y, m.size, 0, TAU);
    ctx.fill();
  }

  // ---- Nucleus pulse (slower, more organic)
  const base = R*0.08;
  const pulse = 1 + 0.18*Math.sin(t*0.65) + 0.06*Math.sin(t*0.19 + 1.3);
  const rad = base * (0.80 + HEALTH*0.6) * pulse;
  const hue = 190 - 20*HEALTH; // cooler when weak, warmer when strong
  let ng = ctx.createRadialGradient(cx,cy, rad*0.1, cx,cy, rad*1.25);
  ng.addColorStop(0.0, `hsla(${hue},60%,70%,0.85)`);
  ng.addColorStop(0.6, `hsla(${hue},60%,55%,0.28)`);
  ng.addColorStop(1.0, `hsla(${hue},60%,45%,0.00)`);
  ctx.fillStyle = ng;
  ctx.beginPath();
  ctx.arc(cx,cy, rad, 0, TAU);
  ctx.fill();

  requestAnimationFrame(drawOrganism);
}
requestAnimationFrame(drawOrganism);

/***** HUD logic (unchanged, truncated to essentials) *****/
function setHealth(p){ HEALTH = clamp(p,0,1); healthPct.textContent = `${Math.round(HEALTH*100)}%`; healthBar.style.width = `${HEALTH*100}%`; }
function setMutation(p){ MUT = clamp(p,0,1); mutPct.textContent = `${Math.round(MUT*100)}%`; mutBar.style.width = `${MUT*100}%`; }
function setFlow(v){ FLOW = clamp(v,-1,1); const pos = (FLOW*0.5+0.5)*100; netBar.style.width = `${pos}%`; }
function setStage(n){ STAGE = n|0; stageNum.textContent = STAGE; }

feedBtn.addEventListener("click",(ev)=>{
  ev.preventDefault();
  // micro nudge to "feed" feeling
  setHealth( clamp(HEALTH + 0.04, 0, 1) );
});

/***** Polling (use your existing endpoints) *****/
const POLL_HEALTH_MS = 6000;
const POLL_TRADES_MS = 6000;
const DECAY_TICK_MS  = 10000;

async function pollHealth(){
  try{
    const r = await fetch(`${API}/health`);
    const j = await r.json();
    if(typeof j.price === "number") priceLabel.textContent = fmtUSD(j.price);
    updatedLabel.textContent = hhmmss();
  }catch(e){}
}

async function pollTrades(){
  try{
    const r = await fetch(`${API}/trades`);
    const arr = await r.json();
    renderTrades(arr);
    // compute net flow (simple): buys add, sells subtract
    let net=0;
    for(const t of arr.slice(0,12)){
      const type = (t.side||t.type||"").toLowerCase();
      const valueUsd = t.valueUsd ?? (t.price * (t.amount||0));
      if(!valueUsd) continue;
      net += type==="buy"||type==="feed" ? valueUsd : -valueUsd;
    }
    // smooth into -1..1 range
    const target = clamp(net/100, -1, 1); // scale to taste
    // small easing
    setFlow( lerp(FLOW, target, 0.12) );
    // nudge health slightly by fresh inflow
    try{ setHealth( clamp(HEALTH + target*0.02, 0, 1) ); }catch{}
  }catch(e){}
}

function renderTrades(list=[]){
  tradesBody.innerHTML = "";
  for(const t of list.slice(0,10)){
    const time = t.ts ? new Date(t.ts).toISOString().slice(11,19) : hhmmss();
    const type = (t.type || t.side || "").toString().toLowerCase();
    const price = t.priceUsd ?? t.price ?? null;
    const value = t.valueUsd ?? ( (t.price||0) * (t.amount||0) );
    const tr = document.createElement("tr");
    const cls = type==="buy"||type==="feed" ? "type-feed" : "type-starve";
    tr.innerHTML = `
      <td class="left">${time}</td>
      <td class="${cls}">${type==="buy"?"Feed":"Starve"}</td>
      <td>${value?("$"+value.toFixed(2)):"$—"}</td>
      <td>${fmtUSD(price)}</td>
    `;
    tradesBody.appendChild(tr);
  }
}

/***** decay + schedules *****/
function setVitals(){
  healthBar.style.width = `${HEALTH*100}%`;
  healthPct.textContent = `${Math.round(HEALTH*100)}%`;
  mutBar.style.width = `${MUT*100}%`;
  mutPct.textContent = `${Math.round(MUT*100)}%`;
}
function tickDecay(){ setHealth( HEALTH - 0.01 ); }

setVitals();
pollHealth(); pollTrades();
setInterval(tickDecay,  DECAY_TICK_MS);
setInterval(pollHealth, POLL_HEALTH_MS);
setInterval(pollTrades, POLL_TRADES_MS);
