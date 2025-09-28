/********** Theme: Lab Lights toggle **********/
const THEME_KEY='organismTheme';
(function applySavedTheme(){
  const s=localStorage.getItem(THEME_KEY);
  document.body.classList.toggle('theme-warm', s==='warm'); // you can add warm vars later if wanted
})();
document.getElementById('themeBtn').addEventListener('click',()=>{
  const warm=!document.body.classList.contains('theme-warm');
  document.body.classList.toggle('theme-warm',warm);
  localStorage.setItem(THEME_KEY,warm?'warm':'cool');
});

/********** Canvas **********/
const canvas = document.getElementById('org-canvas');
const ctx = canvas.getContext('2d', { alpha:true });
function resize(){ canvas.width=innerWidth; canvas.height=innerHeight; }
addEventListener('resize', resize); resize();

const cssVar = n => getComputedStyle(document.body).getPropertyValue(n).trim();

/********** State **********/
let t=0;
let HEALTH=0.52;     // 0..1
let MUT=0.08;        // 0..1
let STAGE=1;         // 1..5
let FLOW=0.50;       // 0..1  (0 starve, 1 feed)
let priceUsd=0.01;

const DECAY_RATE = 0.001666;  // ~1% per 10 min = 0.001666 per minute * 60s loop => ~0.000277/s (we'll apply per tick)

const TRAIT_THRESH = [
  { key:'biolume',  pct:0.10, label:'Biolume',   tone:'ok'   },
  { key:'fronds',   pct:0.22, label:'Fronds',    tone:'ok'   },
  { key:'eye',      pct:0.32, label:'Eye Spots', tone:'warn' },
  { key:'echo',     pct:0.46, label:'Echo Pulse',tone:'warn' }
];
const STAGE_REQ = [0, 0.00, 0.18, 0.30, 0.44, 0.60]; // mutation thresholds per stage (index by STAGE)

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
const traitsRow=document.getElementById('traitsRow');
const tradePills=document.getElementById('tradePills');

/********** Helpers **********/
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const pct = x => Math.round(x*100);
const nowHHMMSS=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;}
const fmtUSD=v=>`$${Number(v).toFixed(2)}`;

/********** UI setters **********/
function setHealth(p){ HEALTH=clamp(p); healthBar.style.width=pct(HEALTH)+'%'; healthNum.textContent=pct(HEALTH)+'%'; }
function setMutation(p){ MUT=clamp(p); mutBar.style.width=pct(MUT)+'%'; mutNum.textContent=pct(MUT)+'%'; renderTraits(); }
function setStage(n){
  STAGE=n;
  stageNum.textContent=String(n);
  stageText.textContent = n===1 ? "Stage 1 · The Cell" : `Stage ${n}`;
}
function setFlow(p){
  FLOW=clamp(p);
  flowBar.style.width=pct(FLOW)+'%';
  flowLabel.textContent = FLOW>0.55?'Feeding':(FLOW<0.45?'Starving':'Neutral');
}
function setPrice(v){ priceUsd=v; priceLabel.textContent=fmtUSD(v); updatedLabel.textContent=nowHHMMSS(); }

/********** Traits badges **********/
function renderTraits(){
  traitsRow.innerHTML='';
  for(const tr of TRAIT_THRESH){
    if(MUT >= tr.pct){
      const el=document.createElement('div');
      el.className=`badge ${tr.tone}`;
      el.innerHTML=`<span class="dot"></span><span>${tr.label}</span>`;
      traitsRow.appendChild(el);
    }
  }
}

/********** Trades (compact ticker, 3 max) **********/
const trades=[]; // {t, type:'feed'|'starve', valueUsd, priceUsd}
function renderTrades(){
  tradePills.innerHTML='';
  trades.slice(-3).reverse().forEach(tr=>{
    const pill=document.createElement('div');
    pill.className=`pill ${tr.type}`;
    pill.innerHTML=`
      <span class="tag">${tr.type==='feed'?'Feed':'Starve'}</span>
      <span class="v mono">${fmtUSD(tr.valueUsd)}</span>
      <span class="t mono">${tr.t}</span>`;
    tradePills.appendChild(pill);
  });
}
function pushTrade(kind, v=10+Math.random()*30){
  trades.push({ t:nowHHMMSS(), type:kind, valueUsd:v, priceUsd:priceUsd });
  if(trades.length>60) trades.shift();
  renderTrades();
}

/********** Audio (optional) **********/
let AC=null,gain=null;
function initAudio(){
  if(AC) return;
  AC=new (window.AudioContext||window.webkitAudioContext)();
  // heartbeat + womb noise blend
  const o=AC.createOscillator(), g1=AC.createGain(); o.type='sine'; o.frequency.value=58; g1.gain.value=.018; o.connect(g1);
  const n=AC.createBufferSource(); const buf=AC.createBuffer(1, AC.sampleRate*2, AC.sampleRate);
  const ch=buf.getChannelData(0); for(let i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1)*.11;
  n.buffer=buf; n.loop=true; const g2=AC.createGain(); g2.gain.value=.028; n.connect(g2);
  gain=AC.createGain(); gain.gain.value=0; g1.connect(gain); g2.connect(gain); gain.connect(AC.destination);
  o.start(); n.start();
}
sfxBtn.addEventListener('click',()=>{
  if(!AC){ initAudio(); sfxBtn.textContent='🔊 SFX On'; gain.gain.linearRampToValueAtTime(.06, AC.currentTime+.35); }
  else if(gain.gain.value>0){ gain.gain.linearRampToValueAtTime(0, AC.currentTime+.2); sfxBtn.textContent='🔇 SFX Off'; }
  else { gain.gain.linearRampToValueAtTime(.06, AC.currentTime+.3); sfxBtn.textContent='🔊 SFX On'; }
});

/********** Canvas organism **********/
const motes=Array.from({length:32},()=>({
  x:Math.random()*innerWidth, y:Math.random()*innerHeight,
  dx:(Math.random()-.5)*.28, dy:(Math.random()-.5)*.28, r:.6+Math.random()*1.6
}));
let tetherPhase=0;

function drawOrganism(){
  t += 0.01;
  const W=canvas.width,H=canvas.height,CX=W*.5,CY=H*.62;

  // base vignette
  ctx.clearRect(0,0,W,H);
  const gbg=ctx.createRadialGradient(CX,CY,H*.06, CX,CY,H*.95);
  gbg.addColorStop(0,'rgba(12,16,24,.92)');
  gbg.addColorStop(.7,'rgba(6,8,12,.65)');
  gbg.addColorStop(1,'rgba(5,7,10,1)');
  ctx.fillStyle=gbg; ctx.fillRect(0,0,W,H);

  // subtle haze
  ctx.fillStyle=cssVar('--hazeTint')||'rgba(80,130,160,.12)';
  ctx.fillRect(0,0,W,H);

  // concentric rings
  ctx.strokeStyle=cssVar('--ringStroke')||'rgba(140,200,255,.12)';
  ctx.lineWidth=1;
  for(let i=1;i<=9;i++){ ctx.beginPath(); ctx.arc(CX,CY,i*78,0,Math.PI*2); ctx.stroke(); }

  // organism core glow
  const pulse=(Math.sin(t*1.35)+1)/2;
  const coreR = 46 + pulse*6 + HEALTH*14;
  const glow=ctx.createRadialGradient(CX,CY, coreR*.2, CX,CY, coreR*1.9);
  glow.addColorStop(0,'rgba(200,245,255,.95)');
  glow.addColorStop(.35,'rgba(170,230,255,.48)');
  glow.addColorStop(.9,'rgba(80,140,200,.02)');
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(CX,CY, coreR*1.9, 0, Math.PI*2); ctx.fill();

  // nutrient tether
  tetherPhase += 0.012;
  const ax=CX-220, ay=CY-120;
  const cx=CX-140, cy=CY-40+Math.sin(tetherPhase)*28;
  ctx.strokeStyle=cssVar('--tether')||'rgba(105,228,209,.6)'; ctx.lineWidth=6; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(cx,cy, CX,CY); ctx.stroke();

  // ==== Mutation visuals (unlocked by MUT) ====
  // 1) Biolume halo (>=10%)
  if(MUT>=0.10){
    ctx.globalCompositeOperation='screen';
    ctx.strokeStyle='rgba(120,255,240,.25)'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(CX,CY, coreR+18*Math.sin(t*.9+1.2)+28, 0, Math.PI*2); ctx.stroke();
    ctx.globalCompositeOperation='source-over';
  }
  // 2) Fronds (>=22%)
  if(MUT>=0.22){
    const arms = 5 + Math.floor(MUT*4);
    ctx.save(); ctx.translate(CX,CY); ctx.rotate(t*0.08);
    for(let i=0;i<arms;i++){
      const ang=i*(Math.PI*2/arms);
      const len=60+Math.sin(t*0.9+i)*16 + MUT*60;
      const sway=Math.sin(t*1.2+i)*12;
      ctx.strokeStyle='rgba(120,235,210,.45)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.quadraticCurveTo(Math.cos(ang)* (len*.3+sway), Math.sin(ang)*(len*.3-sway),
                           Math.cos(ang)*len, Math.sin(ang)*len);
      ctx.stroke();
    }
    ctx.restore();
  }
  // 3) Eye-spots (>=32%)
  if(MUT>=0.32){
    const spots = 3 + Math.floor(MUT*6);
    ctx.save(); ctx.translate(CX,CY);
    for(let i=0;i<spots;i++){
      const a=i*(Math.PI*2/spots)+t*0.3;
      const r=coreR+24+Math.sin(t*1.3+i)*8;
      const x=Math.cos(a)*r, y=Math.sin(a)*r;
      const gr=ctx.createRadialGradient(x,y,2,x,y,12);
      gr.addColorStop(0,'rgba(255,255,255,.9)');
      gr.addColorStop(1,'rgba(255,120,200,.1)');
      ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(x,y,12,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(255,120,200,.35)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(x,y,14,0,Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  }
  // 4) Echo rings (>=46%)
  if(MUT>=0.46){
    ctx.save(); ctx.translate(CX,CY);
    const ripples=3;
    for(let i=0;i<ripples;i++){
      const rr = coreR + 40 + (t*40 + i*35)%120;
      ctx.strokeStyle=`rgba(130,200,255,${0.25 - i*0.06})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(0,0, rr, 0, Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  }

  // motes
  ctx.fillStyle='rgba(200,220,255,.20)';
  for(const m of motes){
    m.x+=m.dx + (HEALTH-0.5)*0.05; m.y+=m.dy + (FLOW-0.5)*0.05;
    if(m.x<0)m.x=W; if(m.x>W)m.x=0; if(m.y<0)m.y=H; if(m.y>H)m.y=0;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI*2); ctx.fill();
  }

  requestAnimationFrame(drawOrganism);
}

/********** Decay + Stage Logic **********/
let timeAt80Start=null;
function tickStageAndDecay(dtSeconds){
  // health baseline decay
  const perSec = 0.01 / (10*60); // 1% per 10 minutes
  setHealth( clamp(HEALTH - perSec*dtSeconds) );

  // track time above 80%
  if(HEALTH>=0.80){
    if(!timeAt80Start) timeAt80Start=performance.now();
  }else{
    timeAt80Start=null;
  }

  // promote stage if conditions met
  const req = STAGE_REQ[STAGE] || 1;
  const aboveTime = timeAt80Start ? (performance.now()-timeAt80Start)/1000 : 0;
  if(HEALTH>=0.80 && MUT>=req && aboveTime>=90 && STAGE<5){ // 90s at 80%+
    setStage(STAGE+1);
    timeAt80Start=null;
    // tiny celebratory mutation bump
    setMutation( clamp(MUT + 0.04) );
    pushTrade('feed', 30+Math.random()*40);
  }
}

/********** Sim / Hooks **********/
function setPriceClock(){ setPrice( 0.01 + Math.sin(Date.now()/5000)*0.002 ); }
setInterval(setPriceClock, 6000);

function randomBlips(){
  const kind = Math.random()>.5?'feed':'starve';
  setFlow( clamp(FLOW + (kind==='feed'? +0.04 : -0.04)) );
  if(kind==='feed') setHealth( clamp(HEALTH + 0.01 + Math.random()*0.01) );
  else              setHealth( clamp(HEALTH - 0.008 - Math.random()*0.008) );
  // mutation wiggle
  setMutation( clamp(MUT + (Math.random()-0.5)*0.008) );
  pushTrade(kind, 8+Math.random()*28);
}
setInterval(randomBlips, 7000);

/********** Buttons **********/
feedBtn.addEventListener('click',(e)=>{
  e.preventDefault();
  setFlow(clamp(FLOW+0.12));
  setHealth(clamp(HEALTH+0.04));
  pushTrade('feed', 15+Math.random()*35);
});

/********** Clock + main loops **********/
function updateClock(){ updatedLabel.textContent = nowHHMMSS(); }
setInterval(updateClock, 6000);

let lastTs=performance.now();
function mainTick(ts){
  const dt = (ts-lastTs)/1000; lastTs=ts;
  tickStageAndDecay(dt);
  requestAnimationFrame(mainTick);
}

/********** Init **********/
function boot(){
  document.getElementById('decayText').textContent='1% / 10m';
  setStage(1); setHealth(HEALTH); setMutation(MUT); setFlow(FLOW); setPrice(priceUsd);
  renderTraits(); renderTrades(); updateClock();
  drawOrganism(); requestAnimationFrame(mainTick);
}
boot();

/********** Backend swap notes **********
- Replace randomBlips + setPriceClock with your real feed:
  • Price/clock: setPrice(latestUsd); updatedLabel = server clock.
  • Trades: map buys->'feed', sells->'starve', then pushTrade(kind, valueUsd).
  • Flow: compute short-window net buy/sell USD; normalize to 0..1, call setFlow().
*****************************************/
