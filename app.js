/******** CONFIG ********/
const TOKEN_MINT = "YOUR_CA_HERE";   // your CA once ready

/******** DOM ********/
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha:true });

const priceLabel = document.getElementById("priceLabel");
const priceFoot  = document.getElementById("priceFoot");
const updated    = document.getElementById("updatedLabel");
const clockEl    = document.getElementById("clock");

const feedBtn  = document.getElementById("feedBtn");
const tradeBtn = document.getElementById("tradeBtn");

const healthBar = document.getElementById("healthBar");
const mutBar    = document.getElementById("mutBar");
const healthPct = document.getElementById("healthPct");
const mutPct    = document.getElementById("mutPct");

const flowBar   = document.getElementById("flowBar");
const stageChip = document.getElementById("stageChip");
const lifeChipFoot = document.getElementById("lifeChipFoot");

const evoList    = document.getElementById("evoList");
const traitsGrid = document.getElementById("traitsGrid");

/******** Helpers ********/
const clamp = (v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const nowHHMMSS = ()=>{ const d=new Date(); const p=n=>String(n).padStart(2,"0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };

/******** State ********/
let W=0,H=0,t=0;
let HEALTH=.55, MUT=.08, FLOW=.55, PRICE=.01, STAGE=1;
let motes=[];

const TRAITS = [
  { id:"biolume", name:"Biolume Rings",  group:"aqua", unlocked:false, rule:s=>s.MUT>=.05 },
  { id:"echo",    name:"Echo Pulse",     group:"aqua", unlocked:false, rule:s=>s.HEALTH>=.48 },
  { id:"eyes",    name:"Eye-sparks",     group:"mag",  unlocked:false, rule:s=>s.MUT>=.10 },
  { id:"shell",   name:"Shell Sheen",    group:"aqua", unlocked:false, rule:s=>s.HEALTH>=.62 },
  { id:"tether",  name:"Tether Cord",    group:"aqua", unlocked:false, rule:s=>s.HEALTH>=.42 },
  { id:"motes",   name:"Drifting Motes", group:"mag",  unlocked:false, rule:s=>s.MUT>=.16 },
];

/******** Canvas ********/
function resize(){ canvas.width=W=innerWidth; canvas.height=H=innerHeight; }
addEventListener("resize", resize); resize();

function draw(){
  t+=0.016;

  // background
  const g = ctx.createRadialGradient(W*.5,H*.65,20, W*.5,H*.35, Math.max(W,H));
  g.addColorStop(0,"rgba(40,50,80,.18)"); g.addColorStop(1,"rgba(5,6,10,1)");
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  // rings
  const ringAlpha = 0.08 + MUT*0.12;
  ctx.save();
  ctx.strokeStyle=`rgba(110,242,222,${ringAlpha})`;
  for(let i=1;i<=10;i++){
    const r=(Math.min(W,H)*.56)*(i/10);
    ctx.lineWidth=1+Math.sin(t*.7+i)*.4;
    ctx.beginPath(); ctx.arc(W*.5,H*.62,r,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();

  // nucleus
  const cx=W*.5, cy=H*.62, R=44+Math.sin(t*1.5)*3+HEALTH*8;
  const glow=ctx.createRadialGradient(cx,cy,R*.2, cx,cy,R*1.7);
  glow.addColorStop(0,"rgba(230,250,255,.95)");
  glow.addColorStop(1,"rgba(110,242,222,.08)");
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(cx,cy,R*1.7,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(230,250,255,.98)"; ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fill();

  // tether
  if (isUnlocked("tether")){
    ctx.strokeStyle="rgba(110,242,222,.45)"; ctx.lineWidth=6; ctx.lineCap="round";
    ctx.beginPath();
    const c1x=cx-90, c1y=cy-15+Math.sin(t*.8)*18;
    const c2x=cx-180, c2y=cy-35+Math.cos(t*.6)*16;
    ctx.moveTo(cx,cy); ctx.bezierCurveTo(c1x,c1y,c2x,c2y, cx-260, cy-60); ctx.stroke();
  }

  // eye-sparks
  if (isUnlocked("eyes")){
    ctx.fillStyle="rgba(255,102,204,.65)";
    ctx.beginPath(); ctx.arc(cx+R*.5, cy-R*.2, 3+Math.sin(t*7)*1.5, 0, Math.PI*2); ctx.fill();
  }

  // motes
  const targetMotes = isUnlocked("motes") ? 44 : 26;
  if(motes.length<targetMotes){
    for(let i=motes.length;i<targetMotes;i++){
      motes.push({x:Math.random()*W,y:Math.random()*H,dx:(Math.random()-.5)*.35,dy:(Math.random()-.5)*.35,r:1+Math.random()*1.6});
    }
  }else if(motes.length>targetMotes){ motes.length = targetMotes; }
  ctx.fillStyle="rgba(220,235,255,.22)";
  for(const m of motes){
    m.x+=m.dx+Math.sin(t*.05+m.y*.001)*.07;
    m.y+=m.dy+Math.cos(t*.05+m.x*.001)*.07;
    if(m.x<0||m.x>W) m.dx*=-1;
    if(m.y<0||m.y>H) m.dy*=-1;
    ctx.beginPath(); ctx.arc(m.x,m.y,m.r,0,Math.PI*2); ctx.fill();
  }

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

/******** UI setters ********/
function setStage(n){ STAGE=n; stageChip.textContent=String(n); }
function setHealth(p){ HEALTH=clamp(p); const pc=Math.round(HEALTH*100);
  healthPct.textContent=pc+"%"; healthBar.style.width=pc+"%"; }
function setMutation(p){ MUT=clamp(p); const pc=Math.round(MUT*100);
  mutPct.textContent=pc+"%"; mutBar.style.width=pc+"%"; }
function setFlow(p){ FLOW=clamp(p); flowBar.style.width=(FLOW*100)+"%"; }
function setPrice(n){ PRICE=n; priceLabel.textContent=n.toFixed(2); priceFoot.textContent=n.toFixed(2); }
function tickClock(){ updated.textContent=nowHHMMSS(); clockEl.textContent=nowHHMMSS(); }

/******** Evolution Log ********/
function logEvent(txt, mag=false){
  const li=document.createElement("li");
  const dot=document.createElement("span");
  dot.className="dot"+(mag?" mag":"");
  const copy=document.createElement("div"); copy.textContent=txt;
  const ts=document.createElement("span"); ts.className="mini"; ts.textContent=nowHHMMSS();
  li.append(dot,copy,ts);
  evoList.insertBefore(li, evoList.firstChild);
  while(evoList.children.length>6) evoList.removeChild(evoList.lastChild);
}

/******** Traits ********/
function isUnlocked(id){ const t=TRAITS.find(x=>x.id===id); return !!t && t.unlocked; }
function renderTraits(){
  traitsGrid.innerHTML="";
  TRAITS.forEach(tr=>{
    const cell=document.createElement("div");
    cell.className=`trait ${tr.group==="mag"?"mag":""} ${tr.unlocked?"unlocked":"locked"}`;
    cell.innerHTML = `<div class="ic"></div><div class="name">${tr.name}</div>`;
    traitsGrid.appendChild(cell);
  });
}
function evaluateTraits(){
  let newly=[];
  TRAITS.forEach(tr=>{
    const was = tr.unlocked;
    tr.unlocked = !!tr.rule({HEALTH,MUT,FLOW,STAGE});
    if(tr.unlocked && !was) newly.push(tr);
  });
  if(newly.length){
    newly.forEach(tr=>logEvent(`Trait unlocked: ${tr.name}`, tr.group==="mag"));
    renderTraits();
  }
}

/******** Sim (replace later with your API) ********/
function simVitals(){
  const tgt = 0.55 + (FLOW-0.5)*0.25;
  setHealth(clamp(HEALTH + (tgt-HEALTH)*0.035 + (Math.random()-.5)*0.01));
  setMutation(clamp(MUT + (Math.random()-.5)*0.008,0,0.4));
  evaluateTraits();
}
function simPrice(){ const drift=(Math.random()-.5)*0.02; setPrice(Math.max(0.01, PRICE+drift)); }
function heartbeat(){ /* could update a chip; left minimal */ }

/******** Buttons ********/
feedBtn.addEventListener("click",(e)=>{
  e.preventDefault();
  setFlow(clamp(FLOW+.06)); setHealth(clamp(HEALTH+.02));
  logEvent("Fed nutrients");
});

/******** Boot ********/
function boot(){
  setStage(1); setHealth(HEALTH); setMutation(MUT); setFlow(.55); setPrice(.01);
  lifeChipFoot.textContent="alive";
  tradeBtn.href=`https://jup.ag/swap/SOL-${TOKEN_MINT}`;
  tickClock(); renderTraits(); logEvent("Specimen initialized");

  setInterval(tickClock, 1000);
  setInterval(simVitals, 4000);
  setInterval(simPrice, 6000);
  setInterval(heartbeat, 2000);

  setInterval(()=>{
    if (MUT > .12 && Math.random()>.6) logEvent("Echoes ripple through membrane", true);
    if (HEALTH > .6 && Math.random()>.7)  logEvent("Core brightens");
  }, 9000);
}
boot();
