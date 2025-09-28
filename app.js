/***** CONFIG *****/
// Optional: set your swap link here
document.getElementById('tradeBtn').href = "#";

/***** DOM *****/
const canvas = document.getElementById('org-canvas');
const ctx     = canvas.getContext('2d', { alpha:true });

const statusEl      = document.getElementById('status');
const heartbeatEl   = document.getElementById('heartbeat');
const stageBadge    = document.getElementById('stageBadge');

const healthBar     = document.getElementById('healthBar');
const mutBar        = document.getElementById('mutBar');
const healthPct     = document.getElementById('healthPct');
const mutPct        = document.getElementById('mutPct');
const stageNum      = document.getElementById('stageNum');
const decayRate     = document.getElementById('decayRate');

const priceLabel    = document.getElementById('priceLabel');
const updatedLabel  = document.getElementById('updatedLabel');

const flowBar       = document.getElementById('flowBar');
const flowLabel     = document.getElementById('flowLabel');

const tradesBody    = document.getElementById('trades-body');

const sfxBtn        = document.getElementById('sfxBtn');
const feedBtn       = document.getElementById('feedBtn');

/***** State *****/
let W=0,H=0, DPR=Math.max(1, window.devicePixelRatio || 1);

// organism “life” stats
let HEALTH = 0.54;     // 54%
let MUT    = 0.06;     // 6%
let STAGE  = 1;
let FLOW   = 0;        // net flow meter (-1 .. +1)

// animation
let t = 0;
const motes = Array.from({length:26}, ()=>({
  x: Math.random(), y: Math.random(),
  r: 1 + Math.random()*2,
  dx: (Math.random()-0.5) * 0.003,
  dy: (Math.random()-0.5) * 0.003
}));

// SFX
let AC=null, master=null, heartbeat=null, noise=null;

/***** Utils *****/
const clamp = (v, a=0, b=1)=> Math.min(b, Math.max(a, v));
const fmt = n => `$${n.toFixed(2)}`;
const pad2 = n => String(n).padStart(2,'0');
const clock = ()=>{
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

/***** Resize *****/
function resizeCanvas(){
  W = canvas.width  = Math.floor(window.innerWidth * DPR);
  H = canvas.height = Math.floor(window.innerHeight * DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/***** WOMB AUDIO (toggle) *****/
function initAudio(){
  if (AC) return;
  AC = new (window.AudioContext||window.webkitAudioContext)();
  master = AC.createGain(); master.gain.value = 0.0; master.connect(AC.destination);

  // Heartbeat: low thump (two quick hits every ~1s)
  heartbeat = AC.createOscillator();
  heartbeat.type = 'sine';
  const hbGain = AC.createGain(); hbGain.gain.value = 0.0;
  heartbeat.connect(hbGain).connect(master);
  heartbeat.start();

  // Pink-ish noise (fluid room tone)
  const b = AC.createBuffer(1, AC.sampleRate*2, AC.sampleRate);
  const d = b.getChannelData(0);
  for(let i=0;i<d.length;i++){
    // very gentle noise
    d[i] = (Math.random()*2-1) * 0.02;
  }
  const source = AC.createBufferSource();
  source.buffer = b; source.loop = true;
  noise = AC.createGain(); noise.gain.value = 0.0;
  source.connect(noise).connect(master); source.start();

  // LFO to create heartbeat pattern
  function tickBeat(){
    const now = AC.currentTime;
    const beat = ()=> {
      hbGain.gain.cancelScheduledValues(now);
      hbGain.gain.setValueAtTime(0.0, now);
      hbGain.gain.linearRampToValueAtTime(0.5, now+0.02);
      hbGain.gain.linearRampToValueAtTime(0.0, now+0.18);
    };
    beat();
    // second quick beat
    setTimeout(beat, 180);
    // schedule next
    setTimeout(tickBeat, 1000);
  }
  tickBeat();

  // bring up master + noise gently
  master.gain.linearRampToValueAtTime(0.5, AC.currentTime + 0.4);
  noise.gain.linearRampToValueAtTime(0.25, AC.currentTime + 0.6);
}
sfxBtn.addEventListener('click', async ()=>{
  if (!AC){
    initAudio();
    try{ await AC.resume(); }catch{}
    sfxBtn.textContent = '🔊 SFX On';
  } else {
    // toggle by master gain
    if (master.gain.value > 0){
      master.gain.linearRampToValueAtTime(0.0, AC.currentTime + 0.2);
      sfxBtn.textContent = '🔇 SFX Off';
    } else {
      master.gain.linearRampToValueAtTime(0.5, AC.currentTime + 0.2);
      sfxBtn.textContent = '🔊 SFX On';
    }
  }
});

/***** Creature draw (warm palette, ripples, haze, tether) *****/
function drawOrganism(){
  t += 0.01;

  ctx.clearRect(0,0,W,H);

  const cx = W/2, cy = H/2 + 40; // slightly lower
  const base = 62 + 26*Math.sin(t*0.9 + 1.7);
  const hueCore = [255, 210, 180]; // warm core tint

  // Fluid haze background (radial, warm)
  let grad = ctx.createRadialGradient(cx,cy, base*0.4, cx,cy, Math.max(W,H)*0.55);
  grad.addColorStop(0, 'rgba(255,160,120,0.30)');
  grad.addColorStop(0.4, 'rgba(200,70,60,0.10)');
  grad.addColorStop(1, 'rgba(10,5,8,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,W,H);

  // Concentric ripple rings (drifting)
  ctx.lineWidth = 1.2;
  for (let i=0;i<8;i++){
    const r = 80 + i*60 + 8*Math.sin(t*0.6 + i*0.7);
    ctx.strokeStyle = 'rgba(64,32,40,0.45)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.stroke();
  }

  // Tether cord (umbilical-like)
  const anchorX = cx - 160 + 60*Math.sin(t*0.6);
  const anchorY = cy - 120 + 20*Math.cos(t*0.3);
  const endX = cx + 12*Math.cos(t*0.7);
  const endY = cy + 12*Math.sin(t*0.8);

  ctx.lineWidth = 7.5;
  const tetherGrad = ctx.createLinearGradient(anchorX,anchorY,endX,endY);
  tetherGrad.addColorStop(0, 'rgba(255,160,120,0.35)');
  tetherGrad.addColorStop(1, 'rgba(255,120,140,0.85)');
  ctx.strokeStyle = tetherGrad;
  ctx.beginPath();
  ctx.moveTo(anchorX, anchorY);
  const c1x = (anchorX+endX)/2 + 60*Math.sin(t*0.5);
  const c1y = (anchorY+endY)/2 + 40*Math.cos(t*0.6);
  ctx.quadraticCurveTo(c1x, c1y, endX, endY);
  ctx.stroke();

  // Pulsing nucleus (the creature)
  const coreR = 40 + 6*Math.sin(t*1.3);
  const core = ctx.createRadialGradient(cx,cy, coreR*0.1, cx,cy, coreR);
  core.addColorStop(0, 'rgba(255,230,220,0.95)');
  core.addColorStop(0.55, 'rgba(255,180,150,0.80)');
  core.addColorStop(1, 'rgba(255,120,120,0.55)');
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(cx,cy, coreR, 0, Math.PI*2); ctx.fill();

  // Motes (irregular drift, amniotic)
  for (let m of motes){
    m.x += m.dx * (0.6 + 0.5*Math.sin(t*0.7));
    m.y += m.dy * (0.6 + 0.5*Math.cos(t*0.6+0.3));
    if (m.x<0) m.x=1; if (m.x>1) m.x=0;
    if (m.y<0) m.y=1; if (m.y>1) m.y=0;

    const mx = m.x * W, my = m.y * H;
    ctx.beginPath();
    ctx.arc(mx,my, m.r, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,220,210,0.25)';
    ctx.fill();
  }

  requestAnimationFrame(drawOrganism);
}
drawOrganism();

/***** UI bindings *****/
function setHealth(v){
  HEALTH = clamp(v);
  healthBar.style.width = `${Math.round(HEALTH*100)}%`;
  healthPct.textContent = `${Math.round(HEALTH*100)}%`;
}
function setMutation(v){
  MUT = clamp(v);
  mutBar.style.width = `${Math.round(MUT*100)}%`;
  mutPct.textContent = `${Math.round(MUT*100)}%`;
}
function setStage(n){
  STAGE = n;
  stageNum.textContent = String(n);
  stageBadge.textContent = `Stage ${n} · ${n===1 ? 'The Cell' : '—'}`;
}
function setFlow(net){
  // net in [-1, 1]
  FLOW = clamp(net, -1, 1);
  const pct = Math.round((FLOW*0.5 + 0.5) * 100); // map -1..1 -> 0..100
  flowBar.style.width = `${pct}%`;
  flowLabel.textContent = FLOW > 0.05 ? 'Feeding' : (FLOW < -0.05 ? 'Starving' : 'Neutral');
}

/***** Trades rendering (Time, Type, Value USD, Price USD) *****/
function addTradeRow({time,type,valueUsd,priceUsd}){
  const tr = document.createElement('tr');
  tr.className = 'row';
  const typeClass = type.toLowerCase()==='feed' ? 'type-feed' : 'type-starve';
  tr.innerHTML = `
    <td>${time}</td>
    <td class="${typeClass}">${type}</td>
    <td>${fmt(valueUsd)}</td>
    <td>${fmt(priceUsd)}</td>
  `;
  tradesBody.prepend(tr);
  // keep last 12
  while (tradesBody.children.length > 12) tradesBody.removeChild(tradesBody.lastChild);
}

/***** Polling (stubs / simulator) *****/
function simTrades(){
  // simulate a trade every 3–7s
  const isBuy  = Math.random() > 0.5;
  const amount = 100 + Math.random()*5000;
  const price  = 0.006 + Math.random()*0.004;
  const value  = amount * price;
  const type   = isBuy ? 'Feed' : 'Starve';
  const now = clock();

  addTradeRow({ time: "HH:MM:SS", type: "Feed"|"Starve", valueUsd: Number, priceUsd: Number });
  // nudge net flow
  const delta = (isBuy ? 1 : -1) * Math.min(1, value/50_000);
  setFlow( clamp(FLOW + delta*0.2, -1, 1) );
  // tiny health drift
  try{
    const hDelta = 0.02 * delta;
    setHealth( clamp(HEALTH + hDelta, 0, 1) );
  }catch{}
  // schedule next
  setTimeout(simTrades, 3000 + Math.random()*4000);
}

/***** Price & “last updated” (sim) *****/
function pollHealth(){
  // simulate health + mutation gentle decay/oscillation
  setHealth( clamp(HEALTH + (Math.sin(Date.now()/40000)*0.002), 0, 1) );
  setMutation( clamp(MUT + (Math.cos(Date.now()/50000)*0.001), 0, 1) );

  // fake price & updated label
  const price = 0.01; // plug real quote here if you wire a backend
  priceLabel.textContent = fmt(price);
  updatedLabel.textContent = clock();
}

/***** Buttons *****/
feedBtn.addEventListener('click',(ev)=>{
  ev.preventDefault();
  // micro “feed” nudge
  setHealth( clamp(HEALTH + 0.04, 0, 1) );
  setFlow( clamp(FLOW + 0.15, -1, 1) );
});

/***** Boot *****/
decayRate.textContent = `1% / 10m`;
setHealth(HEALTH); setMutation(MUT); setStage(STAGE);
pollHealth(); simTrades();
setInterval(pollHealth, 6_000);

// Fluid haze background
ctx.fillStyle = grad;
ctx.fillRect(0,0,W,H);
