/***** CONFIG *****/
const API = ""; // set your backend base (e.g. "https://organism-backend.onrender.com")

/***** DOM *****/
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

const statusEl = document.getElementById("status");
const heartbeatEl = document.getElementById("heartbeat");
const stageBadge = document.getElementById("stageBadge");

const healthBar = document.getElementById("healthBar");
const mutBar = document.getElementById("mutBar");
const healthPct = document.getElementById("healthPct");
const mutPct = document.getElementById("mutPct");
const stageNum = document.getElementById("stageNum");
const decayRate = document.getElementById("decayRate");

const priceLabel = document.getElementById("priceLabel");
const updatedLabel = document.getElementById("updatedLabel");
const flowBar = document.getElementById("flowBar");
const flowLabel = document.getElementById("flowLabel");

const tradesBody = document.getElementById("trades-body");
const sfxBtn = document.getElementById("sfxBtn");
const feedBtn = document.getElementById("feedBtn");
const tradeBtn = document.getElementById("tradeBtn");

/***** Helpers *****/
const clamp = (v,min,max) => Math.max(min, Math.min(max, v));
const fmt2 = (n) => (isNaN(n)? "0.00" : Number(n).toFixed(2));
const pad2 = (n) => String(n).padStart(2,"0");
const nowhhmmss = () => { const d=new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };

/***** Canvas sizing *****/
function resizeCanvas(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/***** Animation (womb) *****/
let t = 0; // time
let HEALTH = 0.54; // 0..1
let MUT = 0.06;    // 0..1
let STAGE = 1;

// motes
const motes = Array.from({length: 26}, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  dx: (Math.random()-0.5)*0.25,
  dy: (Math.random()-0.5)*0.25,
  r: 1.2 + Math.random()*1.6
}));

// tether cord anchor drifts along a slow circle
const tether = {
  r: () => Math.max(120, Math.min(canvas.width, canvas.height) * 0.26),
  anchorSpeed: 0.07,
  get x2(){ return canvas.width/2  + Math.cos(t * this.anchorSpeed) * this.r(); },
  get y2(){ return canvas.height/2 + Math.sin(t * this.anchorSpeed * 0.8) * this.r(); }
};

function drawOrganism(){
  const W = canvas.width, H = canvas.height;
  const cx = W/2, cy = H/2;
  t += 0.016;

  ctx.clearRect(0,0,W,H);

  // Fluid background haze
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W,H)*0.75);
  g.addColorStop(0,   "rgba(160, 110, 190, .20)");
  g.addColorStop(0.4, "rgba(40,  15,  40,  .25)");
  g.addColorStop(1,   "rgba(10,  12,  22,  .95)");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);

  // Ripple rings with soft drift
  const rings = 8;
  for (let i=0;i<rings;i++){
    const r = (i+1)*Math.min(W,H)*0.055 + Math.sin(t*0.25 + i)*4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.strokeStyle = "rgba(120,140,220, .06)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Nucleus — breathing glow
  const pulse = 0.9 + Math.sin(t*1.1)*0.1;
  const nucleusR = Math.min(W,H)*0.035 * (0.9 + HEALTH*0.4) * pulse;

  const ng = ctx.createRadialGradient(cx, cy, nucleusR*0.1, cx, cy, nucleusR*1.8);
  ng.addColorStop(0,   "rgba(120, 190, 255, 0.95)");
  ng.addColorStop(0.4, "rgba( 90, 160, 255, 0.45)");
  ng.addColorStop(1,   "rgba( 40,  40,  80, 0.00)");
  ctx.fillStyle = ng;
  ctx.beginPath(); ctx.arc(cx, cy, nucleusR*1.9, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle = "rgba(190, 220, 255, 0.85)";
  ctx.beginPath(); ctx.arc(cx, cy, nucleusR, 0, Math.PI*2); ctx.fill();

  // Umbilical cord — bezier with swaying control points
  const sway1x = cx + Math.sin(t * 0.8) * 60;
  const sway1y = cy + Math.cos(t * 0.6) * 40;
  const sway2x = tether.x2 + Math.sin(t * 0.5) * 50;
  const sway2y = tether.y2 + Math.cos(t * 0.4) * 60;

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(sway1x, sway1y, sway2x, sway2y, tether.x2, tether.y2);
  ctx.strokeStyle = "rgba(255, 150, 180, .35)";
  ctx.lineWidth = 7; ctx.lineCap="round"; ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(sway1x, sway1y, sway2x, sway2y, tether.x2, tether.y2);
  ctx.strokeStyle = "rgba(255, 210, 220, .80)";
  ctx.lineWidth = 2.2; ctx.stroke();

  // Anchor glow
  ctx.beginPath();
  ctx.arc(tether.x2, tether.y2, 6, 0, Math.PI*2);
  ctx.fillStyle = "rgba(255,190,210,.65)";
  ctx.fill();

  // Motes drifting
  for (let m of motes){
    m.x += m.dx + Math.sin(t*0.2 + m.y*0.002)*0.05;
    m.y += m.dy + Math.cos(t*0.18 + m.x*0.002)*0.05;
    if (m.x<0) m.x=W; if (m.x>W) m.x=0;
    if (m.y<0) m.y=H; if (m.y>H) m.y=0;

    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI*2);
    ctx.fillStyle = "rgba(200,220,255,.2)";
    ctx.fill();
  }

  requestAnimationFrame(drawOrganism);
}
drawOrganism();

/***** Audio (optional) *****/
let AC = null, noiseNode=null, gain=null;
function initAudio(){
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  const bufferSize = 2 * AC.sampleRate;
  const buffer = AC.createBuffer(1, bufferSize, AC.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i=0;i<bufferSize;i++){
    // pink-ish noise + slow heartbeat thump envelope
    const n = (Math.random()*2-1) * 0.4;
    const beat = 0.5 + 0.5*Math.sin(i/AC.sampleRate * 2*Math.PI * 1.0); // ~1Hz
    data[i] = n*0.15*beat;
  }
  noiseNode = AC.createBufferSource();
  noiseNode.buffer = buffer;
  noiseNode.loop = true;
  gain = AC.createGain();
  gain.gain.value = 0.0;
  noiseNode.connect(gain).connect(AC.destination);
  noiseNode.start();
}
function sfxOn(){ initAudio(); gain.gain.linearRampToValueAtTime(0.12, AC.currentTime + 0.3); sfxBtn.textContent="🔊 SFX On"; }
function sfxOff(){ if(!AC) return; gain.gain.linearRampToValueAtTime(0.0, AC.currentTime + 0.25); sfxBtn.textContent="🔇 SFX Off"; }

/***** UI Bindings *****/
function setHealth(v){ HEALTH = clamp(v,0,1); healthBar.style.width = `${Math.round(HEALTH*100)}%`; healthPct.textContent = `${Math.round(HEALTH*100)}%`; }
function setMutation(v){ MUT = clamp(v,0,1); mutBar.style.width = `${Math.round(MUT*100)}%`; mutPct.textContent = `${Math.round(MUT*100)}%`; }
function setStage(n){ STAGE = n|0; stageNum.textContent = String(n); stageBadge.textContent = `Stage ${n} · ${n===1?"The Cell":"—"}`; }
function setFlow(pct){ // -1..+1
  const w = clamp((pct+1)/2, 0, 1) * 100;
  flowBar.style.width = `${w}%`;
  if (pct>0.05){ flowLabel.textContent="Feeding"; flowLabel.classList.remove("warn"); flowLabel.classList.add("ok"); }
  else if (pct<-0.05){ flowLabel.textContent="Starving"; flowLabel.classList.remove("ok"); flowLabel.classList.add("warn"); }
  else { flowLabel.textContent="Neutral"; flowLabel.classList.remove("ok","warn"); }
}

/***** Trades rendering *****/
function renderTrades(rows){
  tradesBody.innerHTML = "";
  for (const r of rows){
    const tr = document.createElement("tr");
    const type = (String(r.type||"")).toLowerCase()==="buy" ? "feed" :
                 (String(r.type||"")).toLowerCase()==="sell" ? "starve" :
                 String(r.type||"");
    tr.innerHTML = `
      <td class="mono">${r.time || nowhhmmss()}</td>
      <td class="${type==='feed'?'type-feed':'type-starve'}">${type.charAt(0).toUpperCase()+type.slice(1)}</td>
      <td class="mono">$${fmt2(r.valueUsd)}</td>
      <td class="mono">$${fmt2(r.priceUsd)}</td>
    `;
    tradesBody.appendChild(tr);
  }
}

/***** Sim / Poll stubs (hook up your backend later) *****/
async function pollHealth(){
  try{
    // If API is set, fetch real price
    if (API){
      const res = await fetch(`${API}/health`);
      const j = await res.json(); // { price:number, timestamp:ms }
      priceLabel.textContent = `$${fmt2(j.price)}`;
      updatedLabel.textContent = nowhhmmss();
    } else {
      // Sim price
      const p = 0.005 + Math.abs(Math.sin(Date.now()/40000))*0.003;
      priceLabel.textContent = `$${fmt2(p)}`;
      updatedLabel.textContent = nowhhmmss();
    }
  }catch(e){ console.warn("price fetch:", e); }
}

async function pollTrades(){
  try{
    let rows;
    if (API){
      const res = await fetch(`${API}/trades`);
      rows = await res.json(); // normalize server to: [{time,type,valueUsd,priceUsd},...]
    } else {
      // Sim trades with small variety
      rows = Array.from({length:6}, (_,i) => {
        const buy = Math.random()>.5;
        return {
          time: nowhhmmss(),
          type: buy? "feed":"starve",
          valueUsd: 3 + Math.random()*30,
          priceUsd: 0.004 + Math.random()*0.004
        };
      });
    }
    renderTrades(rows);

    // Update net flow from rows (buys add, sells subtract)
    const net = rows.reduce((s,r)=> s + (r.type==='feed'? +r.valueUsd : (r.type==='starve'? -r.valueUsd : 0)), 0);
    const pct = clamp(net/60, -1, 1);
    setFlow(pct);

    // tiny nudge health to feel alive
    HEALTH = clamp(HEALTH + pct*0.006, 0, 1);
    setHealth(HEALTH);
  }catch(e){ console.warn("trades fetch:", e); }
}

/***** Buttons *****/
sfxBtn.addEventListener("click", () => {
  if (!AC){ sfxOn(); }
  else if (gain.gain.value < 0.05){ sfxOn(); } else { sfxOff(); }
});
feedBtn.addEventListener("click", (ev) => {
  ev.preventDefault();
  // micro feed
  setHealth( clamp(HEALTH + 0.04, 0, 1) );
});

/***** Boot *****/
decayRate.textContent = "1% / 10m";
setStage(1); setHealth(0.54); setMutation(0.06);
statusEl.textContent = "Alive"; statusEl.classList.add("ok");
heartbeatEl.textContent = "Stable";

pollHealth(); pollTrades();
setInterval(pollHealth, 10000);
setInterval(pollTrades, 6000);
