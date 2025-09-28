/***** Theme toggle (Lab Lights) *****/
const THEME_KEY='organismTheme';
function applySavedTheme(){
  const s=localStorage.getItem(THEME_KEY);
  document.body.classList.toggle('theme-warm', s==='warm');
  document.body.classList.toggle('theme-cool', s!=='warm');
}
applySavedTheme();
document.getElementById('themeBtn').addEventListener('click',()=>{
  const warm=!document.body.classList.contains('theme-warm');
  document.body.classList.toggle('theme-warm',warm);
  document.body.classList.toggle('theme-cool',!warm);
  localStorage.setItem(THEME_KEY,warm?'warm':'cool');
});

/***** DOM refs *****/
const canvas=document.getElementById('org-canvas');
const ctx=canvas.getContext('2d',{alpha:true});
const priceLabel=document.getElementById('priceLabel');
const updatedLabel=document.getElementById('updatedLabel');
const flowBarTop=document.getElementById('flowBar');
const flowLabelTop=document.getElementById('flowLabel');
const needle=document.getElementById('needle');
const flowTiny=document.getElementById('flowTiny');
const healthPct=document.getElementById('healthPct');
const mutPct=document.getElementById('mutPct');
const healthRing=document.getElementById('healthRing');
const mutRing=document.getElementById('mutRing');
const healthBar=document.getElementById('healthBar');
const mutBar=document.getElementById('mutBar');
const healthNum=document.getElementById('healthNum');
const mutNum=document.getElementById('mutNum');
const decayText=document.getElementById('decayText');
const stageText=document.getElementById('stageText');
const stageSmall=document.getElementById('stageSmall');
const stageNum=document.getElementById('stageNum');
const tradesBody=document.getElementById('trades-body');
const feedBtn=document.getElementById('feedBtn');
const sfxBtn=document.getElementById('sfxBtn');

/***** State *****/
let W=0,H=0,t=0;
let HEALTH=.47,MUT=.06,FLOW=0,STAGE=1;

/***** Helpers *****/
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const nowHHMMSS=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;};
const cssVar = n => getComputedStyle(document.body).getPropertyValue(n).trim();

/***** Resize *****/
function resize(){ W=canvas.width=innerWidth; H=canvas.height=innerHeight; }
addEventListener('resize',resize); resize();

/***** Background organism (theme-aware) *****/
const motes=Array.from({length:26},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,dx:(Math.random()-.5)*.28,dy:(Math.random()-.5)*.28,r:.6+Math.random()*1.4}));
let tetherPhase=0;
function draw(){
  t+=.01;
  const hazeTint=cssVar('--hazeTint')||'rgba(60,140,160,.12)';
  const ringStroke=cssVar('--ringStroke')||'rgba(140,200,255,.10)';
  const tetherTint=cssVar('--tetherTint')||'rgba(95,243,209,.55)';

  ctx.clearRect(0,0,W,H);

  // vignette base
  const gbg=ctx.createRadialGradient(W*.5,H*.6,H*.06, W*.5,H*.6,H*.95);
  gbg.addColorStop(0,'rgba(12,16,24,.92)');
  gbg.addColorStop(.7,'rgba(6,8,12,.65)');
  gbg.addColorStop(1,'rgba(5,7,10,1)');
  ctx.fillStyle=gbg; ctx.fillRect(0,0,W,H);

  ctx.fillStyle=hazeTint; ctx.fillRect(0,0,W,H);

  // rings
  ctx.strokeStyle=ringStroke; ctx.lineWidth=1;
  const CX=W*.5,CY=H*.64;
  for(let i=1;i<=9;i++){ ctx.beginPath(); ctx.arc(CX,CY,i*78,0,Math.PI*2); ctx.stroke(); }

  // center glow + nucleus
  const glow=ctx.createRadialGradient(CX,CY,10,CX,CY,210);
  glow.addColorStop(0,'rgba(220,240,255,.80)');
  glow.addColorStop(.4,'rgba(160,200,255,.22)');
  glow.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(CX,CY,210,0,Math.PI*2); ctx.fill();

  const R=40+14*Math.sin(t*1.4);
  const nuc=ctx.createRadialGradient(CX,CY,2,CX,CY,R);
  nuc.addColorStop(0,'rgba(255,255,255,.96)');
  nuc.addColorStop(1,'rgba(180,210,255,.14)');
  ctx.fillStyle=nuc; ctx.beginPath(); ctx.arc(CX,CY,R,0,Math.PI*2); ctx.fill();

  // tether
  tetherPhase+=.012;
  const ax=CX-220, ay=CY-120, cx=CX-140, cy=CY-40+Math.sin(tetherPhase)*28;
  ctx.strokeStyle=tetherTint; ctx.lineWidth=6; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(cx,cy,CX,CY); ctx.stroke();

  // motes
  for(const m of motes){
    m.x+=m.dx; m.y+=m.dy;
    if(m.x<0)m.x=W; if(m.x>W)m.x=0; if(m.y<0)m.y=H; if(m.y>H)m.y=0;
    ctx.fillStyle='rgba(200,220,255,.20)'; ctx.beginPath(); ctx.arc(m.x,m.y,m.r,0,Math.PI*2); ctx.fill();
  }
  requestAnimationFrame(draw);
}

/***** UI setters *****/
function setHealth(p){ p=clamp(p,0,1); const pct=Math.round(p*100);
  healthPct.textContent=pct+'%'; healthBar.style.width=pct+'%'; healthNum.textContent=pct+'%';
  healthRing.style.setProperty('--val',360*p); HEALTH=p; }
function setMutation(p){ p=clamp(p,0,1); const pct=Math.round(p*100);
  mutPct.textContent=pct+'%'; mutBar.style.width=pct+'%'; mutNum.textContent=pct+'%';
  mutRing.style.setProperty('--val',360*p); MUT=p; }
function setFlow(v){ v=clamp(v,-1,1); const w=Math.round((v*.5+.5)*100);
  flowBarTop.style.width=w+'%'; needle.style.width=w+'%';
  const label=v>.05?'Feeding':v<-.05?'Starving':'Neutral';
  flowLabelTop.textContent=label; flowTiny.textContent=label; FLOW=v; }
function setStage(n){ STAGE=n; stageNum.textContent=n; stageSmall.textContent=n; stageText.textContent=n; }

/***** Trades (limit 3 newest) *****/
const MAX_TRADES=3;
function renderTrades(items){
  tradesBody.innerHTML='';
  for(const it of items.slice(0,MAX_TRADES)){
    const row=document.createElement('div'); row.className='row';
    row.innerHTML=`<div class="t">${it.time}</div>
                   <div class="type ${it.type==='Starve'?'starve':''}">${it.type}</div>
                   <div class="v">$${Number(it.valueUsd).toFixed(2)}</div>
                   <div class="p">$${Number(it.priceUsd).toFixed(2)}</div>`;
    tradesBody.appendChild(row);
  }
}

/***** Simulator (replace with real API later) *****/
const simTrades=[];
function simTick(){
  const buy=Math.random()<.5, amt=5+Math.random()*40, price=.01;
  simTrades.unshift({time:nowHHMMSS(), type:buy?'Feed':'Starve', valueUsd:amt, priceUsd:price});
  renderTrades(simTrades);
  const delta=(buy?+1:-1)*(amt/100);
  setFlow(clamp(FLOW*.8+delta*.45,-1,1));
  setHealth(clamp(HEALTH+delta*.02,0,1));
  setMutation(clamp(MUT+(Math.random()-.5)*.01,0,1));
}

/***** Buttons + SFX *****/
function updateClock(){ updatedLabel.textContent=nowHHMMSS(); }
feedBtn.addEventListener('click',e=>{ e.preventDefault(); setHealth(clamp(HEALTH+.04,0,1)); setFlow(clamp(FLOW+.15,-1,1)); });

let AC=null,gain=null;
function initAudio(){
  if(AC) return;
  AC=new (window.AudioContext||window.webkitAudioContext)();
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

/***** Boot *****/
function boot(){
  document.getElementById('decayRate').textContent='1% / 10m';
  decayText.textContent='1% / 10m';
  setStage(1); setHealth(HEALTH); setMutation(MUT); setFlow(0);
  priceLabel.textContent='$0.01'; updateClock();
  draw();
  setInterval(updateClock,6000);
  setInterval(simTick,4200);
  setInterval(()=>{ const tgt=.55+(FLOW-.5)*.2; setHealth(clamp(HEALTH+(tgt-HEALTH)*.04,0,1)); },4000);
}
boot();
