/***** CONFIG (you can later swap simulator with real fetchers) *****/
const MAX_TRADES = 4;     // show only 4 most recent
const DECAY_TXT = "1% / 10m";

/***** DOM *****/
const canvas   = document.getElementById('org-canvas');
const ctx      = canvas.getContext('2d', { alpha:true });

const priceLabel   = document.getElementById('priceLabel');
const updatedLabel = document.getElementById('updatedLabel');
const flowBarTop   = document.getElementById('flowBar');
const flowLabelTop = document.getElementById('flowLabel');

const needle   = document.getElementById('needle');
const flowTiny = document.getElementById('flowTiny');

const healthPct = document.getElementById('healthPct');
const mutPct    = document.getElementById('mutPct');
const healthRing= document.getElementById('healthRing');
const mutRing   = document.getElementById('mutRing');

const healthBar = document.getElementById('healthBar');
const mutBar    = document.getElementById('mutBar');
const healthNum = document.getElementById('healthNum');
const mutNum    = document.getElementById('mutNum');

const decayText = document.getElementById('decayText');
const stageText = document.getElementById('stageText');
const stageSmall= document.getElementById('stageSmall');
const stageNum  = document.getElementById('stageNum');

const tradesBody = document.getElementById('trades-body');

const feedBtn    = document.getElementById('feedBtn');
const sfxBtn     = document.getElementById('sfxBtn');

/***** State *****/
let W=0, H=0, t=0;
let HEALTH=0.45, MUT=0.07, FLOW=0.0;   // 0..1, -1..+1 for FLOW
let STAGE=1;

/***** Resize *****/
function resizeCanvas(){
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/***** Helpers *****/
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const lerp  = (a,b,k)=>a+(b-a)*k;
function nowHHMMSS(){
  const d=new Date();
  const p=n=>String(n).padStart(2,'0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/***** Womb draw *****/
const motes = Array.from({length:28},()=>({
  x: Math.random()*W,
  y: Math.random()*H,
  dx:(Math.random()-.5)*0.3,
  dy:(Math.random()-.5)*0.3,
  r: 0.6 + Math.random()*1.6
}));
let tetherPhase = 0;

function drawOrganism(){
  t += 0.01;

  ctx.clearRect(0,0,W,H);

  // Deep vignette
  const gbg = ctx.createRadialGradient(W*0.5,H*0.6, H*0.05,  W*0.5,H*0.6, H*0.9);
  gbg.addColorStop(0,   'rgba(10,14,22,0.95)');
  gbg.addColorStop(0.65,'rgba(8,10,16,0.70)');
  gbg.addColorStop(1,   'rgba(5,7,10,1)');
  ctx.fillStyle=gbg; ctx.fillRect(0,0,W,H);

  // Concentric rings
  ctx.strokeStyle='rgba(120,180,255,0.08)';
  ctx.lineWidth=1.1;
  const cx=W*0.5, cy=H*0.62; // a bit low
  for(let i=1;i<=9;i++){
    ctx.beginPath();
    ctx.arc(cx,cy, i*80, 0, Math.PI*2);
    ctx.stroke();
  }

  // Haze glow center
  const glow = ctx.createRadialGradient(cx,cy, 10, cx,cy, 220);
  glow.addColorStop(0,'rgba(210,230,255,0.85)');
  glow.addColorStop(0.4,'rgba(160,200,255,0.35)');
  glow.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=glow;
  ctx.beginPath(); ctx.arc(cx,cy, 220, 0, Math.PI*2); ctx.fill();

  // Nucleus
  const R = 40 + 16*Math.sin(t*1.4);
  const nuc = ctx.createRadialGradient(cx,cy, 2, cx,cy, R);
  nuc.addColorStop(0,'rgba(255,255,255,0.95)');
  nuc.addColorStop(1,'rgba(180,210,255,0.15)');
  ctx.fillStyle=nuc;
  ctx.beginPath(); ctx.arc(cx,cy, R, 0, Math.PI*2); ctx.fill();

  // Umbilical tether
  tetherPhase += 0.012;
  const anchorX = cx - 220;
  const anchorY = cy - 120;
  const ctrlX   = cx - 140;
  const ctrlY   = cy - 40 + Math.sin(tetherPhase)*30;
  ctx.strokeStyle='rgba(255,220,240,0.35)';
  ctx.lineWidth=6; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(anchorX,anchorY);
  ctx.quadraticCurveTo(ctrlX,ctrlY, cx,cy);
  ctx.stroke();

  // Floating motes
  for(const m of motes){
    m.x += m.dx; m.y += m.dy;
    if(m.x<0) m.x=W; if(m.x>W) m.x=0;
    if(m.y<0) m.y=H; if(m.y>H) m.y=0;
    ctx.fillStyle='rgba(200,220,255,0.22)';
    ctx.beginPath(); ctx.arc(m.x,m.y, m.r, 0, Math.PI*2); ctx.fill();
  }

  requestAnimationFrame(drawOrganism);
}

/***** UI setters *****/
function setHealth(p){ // p: 0..1
  HEALTH = clamp(p,0,1);
  const pct = Math.round(HEALTH*100);
  healthPct.textContent = pct+'%';
  healthBar.style.width = pct+'%';
  healthNum.textContent = pct+'%';
  // ring arc in degrees
  healthRing.style.setProperty('--val', 360*HEALTH);
}

function setMutation(p){ // p:0..1
  MUT = clamp(p,0,1);
  const pct = Math.round(MUT*100);
  mutPct.textContent = pct+'%';
  mutBar.style.width = pct+'%';
  mutNum.textContent = pct+'%';
  mutRing.style.setProperty('--val', 360*MUT);
}

function setFlow(v){ // v:-1..+1
  FLOW = clamp(v,-1,1);
  const w = Math.round((FLOW*0.5+0.5)*100);
  flowBarTop.style.width = w+'%';
  needle.style.width = w+'%';
  const label = FLOW>0.05 ? 'Feeding' : FLOW<-0.05 ? 'Starving' : 'Neutral';
  flowLabelTop.textContent = label;
  flowTiny.textContent = label;
}

function setStage(n){
  STAGE = n;
  stageNum.textContent = n;
  stageSmall.textContent = n;
  stageText.textContent = n;
}
function setDecayText(s){
  decayText.textContent = s;
  document.getElementById('decayRate').textContent = s;
}

/***** Trades (minimal list) *****/
function renderTrades(items){
  // items: [{time:"HH:MM:SS", type:"Feed"|"Starve", valueUsd:Number, priceUsd:Number}, ...]
  tradesBody.innerHTML = '';
  const subset = items.slice(0,MAX_TRADES);
  for(const it of subset){
    const row = document.createElement('div');
    row.className='row';
    row.innerHTML = `
      <div class="t">${it.time}</div>
      <div class="type ${it.type==='Starve'?'starve':''}">${it.type}</div>
      <div class="v">$${Number(it.valueUsd).toFixed(2)}</div>
      <div class="p">$${Number(it.priceUsd).toFixed(2)}</div>
    `;
    tradesBody.appendChild(row);
  }
}

/***** Simulator (replace with real fetch later) *****/
const simTrades = [];
function simTradesTick(){
  const buy = Math.random() < 0.5;
  const amt = 5 + Math.random()*40;
  const price = 0.01;
  simTrades.unshift({
    time: nowHHMMSS(),
    type: buy? 'Feed':'Starve',
    valueUsd: amt,
    priceUsd: price
  });
  renderTrades(simTrades);
  // nudge flow & health
  const delta = (buy? +1 : -1) * (amt/100);
  setFlow( clamp(FLOW*0.8 + delta*0.4, -1, 1) );
  setHealth( clamp(HEALTH + delta*0.02, 0, 1) );
  setMutation( clamp(MUT + (Math.random()-0.5)*0.01, 0, 1) );
}

function updateTopClock(){
  updatedLabel.textContent = nowHHMMSS();
}

/***** Buttons *****/
feedBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  setHealth( clamp(HEALTH + 0.04, 0, 1) );
  setFlow( clamp(FLOW+0.15, -1, 1) );
});

/***** Boot *****/
function boot(){
  setStage(1);
  setDecayText(DECAY_TXT);
  setHealth(0.48);
  setMutation(0.07);
  priceLabel.textContent = '$0.01';
  updateTopClock();

  drawOrganism();

  // schedules
  setInterval(updateTopClock, 6000);
  setInterval(simTradesTick, 4000);

  // gentle flow settling
  setInterval(()=>{
    const tgt = 0.55 + (FLOW-0.5)*0.2;
    const next = HEALTH + (tgt-HEALTH)*0.04;
    setHealth( clamp(next,0,1) );
  }, 4000);
}

boot();
