/***** CONFIG *****/
// If you have real endpoints, set API to your backend base and switch SIM to false.
const API = "";         // e.g. "https://organism-backend.onrender.com"
const SIM = true;       // simulation mode on/off

/***** DOM *****/
const canvas = document.getElementById("org-canvas");
const ctx     = canvas.getContext("2d", { alpha:true });

const statusWord   = document.getElementById("status");
const heartbeat    = document.getElementById("heartbeat");
const healthBar    = document.getElementById("healthBar");
const healthPct    = document.getElementById("healthPct");
const mutBar       = document.getElementById("mutBar");
const mutPct       = document.getElementById("mutPct");
const stageNum     = document.getElementById("stageNum");
const decayRate    = document.getElementById("decayRate");
const priceLabel   = document.getElementById("priceLabel");
const updatedLabel = document.getElementById("updatedLabel");
const flowBarEl    = document.getElementById("flowBar");
const flowLabelEl  = document.getElementById("flowLabel");
const tradesBody   = document.getElementById("trades-body");
const sfxBtn       = document.getElementById("sfxBtn");
const feedBtn      = document.getElementById("feedBtn");
const tradeBtn     = document.getElementById("tradeBtn");
const stageBadge   = document.getElementById("stageBadge");

/***** helpers *****/
const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
const fmtUSD = (n) => (n==null || isNaN(n)) ? "$—" : `$${n.toFixed(2)}`;
const pad2 = (n) => String(n).padStart(2,'0');
const hhmmss = (tsMs) => {
  const d = tsMs ? new Date(tsMs) : new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

/***** Canvas sizing *****/
function resizeCanvas(){
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/***** Animation state (womb visuals) *****/
let t = 0;
const motes = Array.from({ length: 26 }, () => ({
  x: Math.random(), y: Math.random(),
  dx: (Math.random() - 0.5)*0.002,
  dy: (Math.random() - 0.5)*0.002,
  r: 0.7 + Math.random()*1.4
}));

// Audio (optional)
let AC=null, gain=null;
function initAudio(){
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  const master = AC.createGain();
  master.gain.value = 0.12;

  // Womb noise: pink-ish
  const noise = AC.createScriptProcessor(2048, 1, 1);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  noise.onaudioprocess = e=>{
    const out = e.outputBuffer.getChannelData(0);
    for (let i=0;i<out.length;i++){
      const white = Math.random()*2-1;
      b0 = 0.99886*b0 + white*0.0555179;
      b1 = 0.99332*b1 + white*0.0750759;
      b2 = 0.96900*b2 + white*0.1538520;
      b3 = 0.86650*b3 + white*0.3104856;
      b4 = 0.55000*b4 + white*0.5329522;
      b5 = -0.7616*b5 - white*0.0168980;
      out[i] = (b0+b1+b2+b3+b4+b5+b6*0.5362)*0.11;
      b6 = white*0.115926;
    }
  };

  // Low heartbeat thump
  const thump = AC.createOscillator();
  thump.type = 'sine'; thump.frequency.value = 38;
  const thumpGain = AC.createGain(); thumpGain.gain.value = 0.0;
  thump.connect(thumpGain).connect(master); thump.start();

  // heartbeat envelope
  setInterval(()=>{
    if (!gain) return;
    thumpGain.gain.cancelScheduledValues(AC.currentTime);
    thumpGain.gain.setValueAtTime(0.0, AC.currentTime);
    thumpGain.gain.linearRampToValueAtTime(0.35, AC.currentTime+0.02);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime+0.35);
  }, 900);

  noise.connect(master);
  gain = master;
  gain.connect(AC.destination);
}

sfxBtn.addEventListener("click", ()=>{
  if (!AC){ initAudio(); sfxBtn.textContent = "🔊 SFX On"; }
  else {
    if (gain.gain.value > 0.001){ gain.gain.value = 0.0; sfxBtn.textContent = "🔇 SFX Off"; }
    else { gain.gain.value = 0.12; sfxBtn.textContent = "🔊 SFX On"; }
  }
});

/***** Draw loop (womb) *****/
function drawOrganism(){
  t += 0.01;
  const W = canvas.width, H = canvas.height;
  const cx = W/2, cy = H*0.58; // sit a bit lower
  ctx.clearRect(0,0,W,H);

  // Soft fluid haze (warm)
  const base = 62 + 26*Math.sin(t*0.9 + 1.7);
  let grad = ctx.createRadialGradient(cx,cy, base*0.4, cx,cy, Math.max(W,H)*0.55);
  grad.addColorStop(0, 'rgba(255,160,120,0.28)');
  grad.addColorStop(0.45, 'rgba(210,70,50,0.10)');
  grad.addColorStop(1, 'rgba(10,5,8,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,W,H);

  // Ripple rings w/ slight drift
  ctx.lineWidth = 1.2;
  for (let i=0;i<9;i++){
    const r = 85 + i*70 + 10*Math.sin(t*0.55 + i*0.7);
    ctx.strokeStyle = 'rgba(64,32,40,0.45)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.stroke();
  }

  // Umbilical-like tether
  const anchorX = cx - 180 + 60*Math.sin(t*0.6);
  const anchorY = cy - 140 + 22*Math.cos(t*0.32);
  const endX    = cx + 12*Math.cos(t*0.7);
  const endY    = cy + 12*Math.sin(t*0.8);
  ctx.lineWidth = 7.5;
  const tg = ctx.createLinearGradient(anchorX,anchorY,endX,endY);
  tg.addColorStop(0, 'rgba(255,160,120,0.35)');
  tg.addColorStop(1, 'rgba(255,120,140,0.85)');
  ctx.strokeStyle = tg;
  ctx.beginPath();
  ctx.moveTo(anchorX, anchorY);
  const c1x = (anchorX+endX)/2 + 60*Math.sin(t*0.5);
  const c1y = (anchorY+endY)/2 + 40*Math.cos(t*0.6);
  ctx.quadraticCurveTo(c1x, c1y, endX, endY);
  ctx.stroke();

  // Pulsing nucleus
  const coreR = 42 + 7*Math.sin(t*1.25);
  const core  = ctx.createRadialGradient(cx,cy, coreR*0.12, cx,cy, coreR);
  core.addColorStop(0, 'rgba(255,235,230,0.95)');
  core.addColorStop(0.55, 'rgba(255,190,165,0.80)');
  core.addColorStop(1, 'rgba(255,120,120,0.55)');
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(cx,cy, coreR, 0, Math.PI*2); ctx.fill();

  // Floating motes
  for (let m of motes){
    m.x += m.dx * (0.6 + 0.5*Math.sin(t*0.7));
    m.y += m.dy * (0.6 + 0.5*Math.cos(t*0.6+0.3));
    if (m.x<0) m.x=1; if (m.x>1) m.x=0;
    if (m.y<0) m.y=1; if (m.y>1) m.y=0;

    const mx = m.x * W, my = m.y * H;
    ctx.beginPath();
    ctx.arc(mx,my, m.r, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,220,210,0.22)';
    ctx.fill();
  }

  requestAnimationFrame(drawOrganism);
}
requestAnimationFrame(drawOrganism);

/***** UI binders *****/
function setHealth(pct){ pct = clamp(pct,0,1); healthBar.style.width = (pct*100).toFixed(0)+'%'; healthPct.textContent=(pct*100).toFixed(0)+'%'; }
function setMutation(pct){ pct = clamp(pct,0,1); mutBar.style.width    = (pct*100).toFixed(0)+'%'; mutPct.textContent=(pct*100).toFixed(0)+'%'; }
function setStage(n){ stageNum.textContent = String(n); stageBadge.textContent = n===1 ? "Stage 1 · The Cell" : `Stage ${n}`; }
function setFlow(v){ // v in [-1,1]
  const pct = ((clamp(v,-1,1)+1)/2)*100; flowBarEl.style.width = pct.toFixed(0)+'%';
  flowBarEl.style.background = v>=0 ? "linear-gradient(90deg,#4cffb5,#34e5b0)" : "linear-gradient(90deg,#ff847a,#ffb2a1)";
  flowLabelEl.textContent = v> 0.05 ? "Feeding" : v < -0.05 ? "Starving" : "Neutral";
}

/***** Trades table (time, type, valueUsd, priceUsd) *****/
function addTradeRow({ time, type, valueUsd, priceUsd }){
  const tr = document.createElement('tr');
  const isFeed = (String(type).toLowerCase()==='feed');
  const typeCell = `<span class="${isFeed?'type-feed':'type-starve'}">${isFeed?'Feed':'Starve'}</span>`;
  tr.innerHTML = `
    <td>${time}</td>
    <td>${typeCell}</td>
    <td>${fmtUSD(valueUsd)}</td>
    <td>${fmtUSD(priceUsd)}</td>
  `;
  tradesBody.prepend(tr);
  // keep to ~12
  while (tradesBody.children.length > 12) tradesBody.lastChild.remove();
}

/***** Simulation (fallback) *****/
let HEALTH=0.54, MUT=0.06, STAGE=1, FLOW=0, DECAY=0.01; // health 54%, mut 6%
function simTick(){
  // nudge flow back to center
  FLOW *= 0.94;
  // tiny living drift to health
  HEALTH = clamp( HEALTH + FLOW*0.015 - DECAY*0.002 );
  setHealth(HEALTH);
  setMutation(MUT);
  setFlow(FLOW);
  decayRate.textContent = `${(DECAY*100).toFixed(0)}%`;
  updatedLabel.textContent = hhmmss();
}
function simTrades(){
  // random "feed/starve"
  const feed = Math.random() < 0.5;
  const value = 6 + Math.random()*26;
  const price = 0.01; // for now
  const tstr = hhmmss();
  addTradeRow({ time:tstr, type: feed?'Feed':'Starve', valueUsd:value, priceUsd:price });
  FLOW += feed ? +0.12 : -0.12;
  FLOW = clamp(FLOW,-1,1);
}

/***** Real polling (if you have a backend) *****/
// Expecting:
// GET `${API}/health` -> { price:number, timestamp:number(ms|iso) }
// GET `${API}/trades` -> [{ time:"HH:MM:SS", type:"Feed"|"Starve", valueUsd:number, priceUsd:number }, ...]
async function pollHealth(){
  if (SIM){ priceLabel.textContent = fmtUSD(0.01); updatedLabel.textContent = hhmmss(); return; }
  try{
    const r = await fetch(`${API}/health`, { headers:{ accept:'application/json' }});
    const j = await r.json();
    if (typeof j.price === 'number') priceLabel.textContent = fmtUSD(j.price);
    updatedLabel.textContent = j.timestamp ? hhmmss(j.timestamp) : hhmmss();
  }catch(e){ /* ignore */ }
}
async function pollTrades(){
  if (SIM) return; // in sim we call simTrades instead
  try{
    const r = await fetch(`${API}/trades`, { headers:{ accept:'application/json' }});
    const arr = await r.json();
    if (Array.isArray(arr)){
      // render newest last -> then we prepend so table top is latest
      for (let item of arr.slice(-5)){
        addTradeRow(item);
      }
    }
  }catch(e){ /* ignore */ }
}

/***** Buttons *****/
feedBtn.addEventListener("click", (ev)=>{
  ev.preventDefault();
  // micro health nudge
  HEALTH = clamp( HEALTH + 0.04, 0, 1 );
  FLOW   = clamp( FLOW + 0.15, -1, 1 );
  simTick();
});

/***** Boot *****/
statusWord.textContent = "Alive";
heartbeat.textContent  = "Stable";
setStage(STAGE);
setHealth(HEALTH); setMutation(MUT); setFlow(FLOW);
priceLabel.textContent = fmtUSD(0.01);
updatedLabel.textContent = "--:--:--";

// schedulers
setInterval(simTick, 1000);
if (SIM){
  setInterval(simTrades, 3000);
}else{
  setInterval(pollHealth,  6000);
  setInterval(pollTrades, 6000);
}
