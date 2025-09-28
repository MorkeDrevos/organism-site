/********** canvas + hud **********/
const canvas = document.getElementById('org-canvas');
const ctx = canvas.getContext('2d', { alpha: true });

function resize(){ canvas.width=innerWidth; canvas.height=innerHeight; }
addEventListener('resize', resize); resize();

/********** organism sim **********/
let t=0, HEALTH=.47, MUT=.06, STAGE=1, FLOW=.5, priceUsd=0.01;

const motes = Array.from({length:36}).map(()=>({
  x: Math.random()*canvas.width,
  y: Math.random()*canvas.height,
  d: 0.1+Math.random()*0.35,
  r: 0.5+Math.random()*1.8,
}));

function draw(){
  t+=0.01;
  const W=canvas.width,H=canvas.height,CX=W/2,CY=H*0.62;
  ctx.clearRect(0,0,W,H);

  // rings
  ctx.save(); ctx.translate(CX,CY);
  for(let i=1;i<=8;i++){
    const R=i*110;
    ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2);
    ctx.strokeStyle=`rgba(160,210,255,${0.05 - i*0.004})`;
    ctx.lineWidth=1; ctx.stroke();
  }

  // glowing nucleus
  const pulse=(Math.sin(t*1.35)+1)/2;
  const baseR=46+pulse*6+HEALTH*12;
  const g=ctx.createRadialGradient(0,0,baseR*.2,0,0,baseR*1.8);
  g.addColorStop(0,"rgba(200,245,255,.95)");
  g.addColorStop(.35,"rgba(170,230,255,.55)");
  g.addColorStop(.9,"rgba(80,140,200,.02)");
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,baseR*1.8,0,Math.PI*2); ctx.fill();

  // tether
  const phase=t*0.9;
  const ax=-210, ay=-60;
  const bx=-120+Math.sin(phase)*40, by=-140+Math.cos(phase*.7)*30;
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(bx,by,0,0);
  ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--tether')||'rgba(105,228,209,.6)';
  ctx.lineWidth=6; ctx.lineCap='round'; ctx.stroke();

  // motes
  ctx.fillStyle="rgba(200,220,255,.22)";
  for(const m of motes){
    m.x += (Math.sin(t*0.37 + m.y*0.001)*0.2 + (HEALTH-0.5)*0.1) * m.d;
    m.y += (Math.cos(t*0.29 + m.x*0.0015)*0.2 + (FLOW-0.5)*0.1) * m.d;
    if(m.x<0) m.x=W; if(m.x>W) m.x=0; if(m.y<0) m.y=H; if(m.y>H) m.y=0;
    ctx.beginPath(); ctx.arc(m.x-CX, m.y-CY, m.r, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

/********** DOM **********/
const healthBar=document.getElementById('healthBar');
const healthNum=document.getElementById('healthNum');
const mutBar=document.getElementById('mutBar');
const mutNum=document.getElementById('mutNum');
const stageNum=document.getElementById('stageNum');
const stageText=document.getElementById('stageText');
const decayText=document.getElementById('decayText');

const priceLabel=document.getElementById('priceLabel');
const updatedLabel=document.getElementById('updatedLabel');

const flowBar=document.getElementById('flowBar');
const flowLabel=document.getElementById('flowLabel');

const feedBtn=document.getElementById('feedBtn');
const sfxBtn=document.getElementById('sfxBtn');
const tradeBtn=document.getElementById('tradeBtn');

const tradePills=document.getElementById('tradePills');

/********** helpers **********/
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const pct=(x)=>Math.round(x*100);
const nowHHMMSS=()=>{const d=new Date(),p2=n=>String(n).padStart(2,'0');return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;}
const fmtUSD=(v)=>`$${Number(v).toFixed(2)}`;

/********** UI setters **********/
function setHealth(p){HEALTH=clamp(p);healthBar.style.width=`${pct(HEALTH)}%`;healthNum.textContent=`${pct(HEALTH)}%`;}
function setMutation(p){MUT=clamp(p);mutBar.style.width=`${pct(MUT)}%`;mutNum.textContent=`${pct(MUT)}%`;}
function setStage(n){STAGE=n;stageNum.textContent=String(n);stageText.textContent=n===1?"Stage 1 · The Cell":`Stage ${n}`;}
function setFlow(p){FLOW=clamp(p);flowBar.style.width=`${pct(FLOW)}%`;flowLabel.textContent=FLOW>0.55?"Feeding":(FLOW<0.45?"Starving":"Neutral");}
function setPrice(v){priceUsd=v;priceLabel.textContent=`$${v.toFixed(2)}`;updatedLabel.textContent=nowHHMMSS();}

/********** Trades as compact ticker (max 3) **********/
const trades=[]; // {t:"HH:MM:SS", type:"feed"|"starve", valueUsd:number, priceUsd:number}

function renderTrades(){
  tradePills.innerHTML="";
  trades.slice(-3).reverse().forEach(tr=>{
    const pill=document.createElement('div');
    pill.className=`pill ${tr.type}`;
    pill.innerHTML=`
      <span class="tag">${tr.type==='feed'?'Feed':'Starve'}</span>
      <span class="v mono">${fmtUSD(tr.valueUsd)}</span>
      <span class="t mono">${tr.t}</span>
    `;
    tradePills.appendChild(pill);
  });
}

/********** SFX (optional) **********/
let AC=null,gain;
function initAudio(){
  AC=new (window.AudioContext||window.webkitAudioContext)();
  const o1=AC.createOscillator(), o2=AC.createOscillator();
  gain=AC.createGain(); gain.gain.value=0;
  o1.type='sine'; o2.type='triangle'; o1.frequency.value=40; o2.frequency.value=82;
  const lfo=AC.createOscillator(), lg=AC.createGain(); lfo.frequency.value=.85; lg.gain.value=.35;
  lfo.connect(lg); lg.connect(gain.gain);
  o1.connect(gain); o2.connect(gain); gain.connect(AC.destination);
  o1.start(); o2.start(); lfo.start();
}
sfxBtn.addEventListener('click', ()=>{
  if(!AC){ initAudio(); sfxBtn.textContent='🔊 SFX On'; gain.gain.setTargetAtTime(.07,AC.currentTime,.6); }
  else if(gain.gain.value>0){ gain.gain.setTargetAtTime(0,AC.currentTime,.4); sfxBtn.textContent='🔇 SFX Off'; }
  else { gain.gain.setTargetAtTime(.07,AC.currentTime,.6); sfxBtn.textContent='🔊 SFX On'; }
});

/********** Interactions **********/
feedBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  setHealth(clamp(HEALTH+0.04));
  setFlow(clamp(FLOW+0.12));
  pushTrade('feed'); renderTrades();
});

/********** Sim **********/
function pushTrade(kind){
  const v=10+Math.random()*30;
  trades.push({ t:nowHHMMSS(), type:kind, valueUsd:v, priceUsd:priceUsd });
  if(trades.length>24) trades.shift();
}

// init
setStage(1); setHealth(.47); setMutation(.06); setFlow(.5); setPrice(.01);
renderTrades();

// price clock
setInterval(()=> setPrice( 0.01 + Math.sin(Date.now()/5000)*0.002 ), 6000);

// gentle “alive” drift
setInterval(()=>{
  const tgt=.55+(FLOW-.5)*.2;
  setHealth(clamp(HEALTH+(tgt-HEALTH)*.04));
}, 4000);

// random trade blips
setInterval(()=>{
  const kind=Math.random()>.5?'feed':'starve';
  setFlow( clamp(FLOW+(kind==='feed'?+0.03:-0.03)) );
  if(kind==='starve') setHealth(clamp(HEALTH-0.02));
  pushTrade(kind); renderTrades();
}, 8000);

/********** Backend hooks (swap the sim above when ready) **********
// GET /health -> { price, timestamp } then call setPrice(price) & updatedLabel
// GET /trades -> [{ time, type, valueUsd, priceUsd }] then map to pills:
trades.length=0; items.forEach(it=> trades.push({
  t: it.time, type: it.type.toLowerCase()==='buy'?'feed':'starve',
  valueUsd: it.valueUsd, priceUsd: it.priceUsd
})); renderTrades();
*******************************************************************/
