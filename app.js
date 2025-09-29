/******** CONFIG ********/
const TOKEN_MINT = "YOUR_CA_HERE"; // set your CA for the swap link

/******** DOM ********/
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha:true });

const priceLabel = document.getElementById("priceLabel");
const priceFoot  = document.getElementById("priceFoot");
const updatedEl  = document.getElementById("updatedLabel");
const clockEl    = document.getElementById("clock");
const stageChip  = document.getElementById("stageChip");
const lifeChip   = document.getElementById("lifeChipFoot");

const feedBtn  = document.getElementById("feedBtn");
const tradeBtn = document.getElementById("tradeBtn");

const healthBar = document.getElementById("healthBar");
const mutBar    = document.getElementById("mutBar");
const healthPct = document.getElementById("healthPct");
const mutPct    = document.getElementById("mutPct");

const flowBar   = document.getElementById("flowBar");

const sigBiolume = document.getElementById("sigil-biolume");
const sigEcho    = document.getElementById("sigil-echo");
const sigTether  = document.getElementById("sigil-tether");

const ticker = document.getElementById("ticker");

/******** Helpers ********/
const clamp = (v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const HHMMSS = ()=>{ const d=new Date(); const p=n=>String(n).padStart(2,"0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };

/******** State ********/
let W=0,H=0,t=0;
let HEALTH=.55, MUT=.08, FLOW=.55, PRICE=.01, STAGE=1;
let motes=[];

const TRAITS = {
  biolume:false, // rings brighter
  echo:false,    // echo pulse
  tether:false   // draw tether cord
};

/******** Layout ********/
function resize(){ canvas.width=W=innerWidth; canvas.height=H=innerHeight; }
addEventListener("resize", resize); resize();

/******** Canvas ********/
function draw(){
  t+=0.016;

  // bg gradient
  const g = ctx.createRadialGradient(W*.5,H*.65,20, W*.5,H*.35, Math.max(W,H));
  g.addColorStop(0,"rgba(40,50,80,.16)"); g.addColorStop(1,"rgba(5,6,10,1)");
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  // rings
  const cx=W*.5, cy=H*.62;
  const ringAlphaBase = TRAITS.biolume ? .12 : .07;
  ctx.save();
  ctx.strokeStyle=`rgba(110,242,222,${ringAlphaBase + MUT*0.1})`;
  for(let i=1;i<=10;i++){
    const r=(Math.min(W,H)*.56)*(i/10);
    const wobble= Math.sin(t*.7+i)*.4;
    ctx.lineWidth=1+wobble;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();

  // nucleus + echo
  const R=44+Math.sin(t*1.5)*3+HEALTH*8;
  const glow=ctx.createRadialGradient(cx,cy,R*.2, cx,cy,R*1.7);
  glow.addColorStop(0,"rgba(230,250,255,.95)");
  glow.addColorStop(1,"rgba(110,242,222,.08)");
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(cx,cy,R*1.7,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(230,250,255,.98)"; ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fill();

  if (TRAITS.echo){
    ctx.strokeStyle="rgba(255,102,204,.35)";
    ctx.lineWidth=2;
    const echoR = R*1.2 + (Math.sin(t*2)+1)*22;
    ctx.beginPath(); ctx.arc(cx,cy,echoR,0,Math.PI*2); ctx.stroke();
  }

  // tether
  if (TRAITS.tether){
    ctx.strokeStyle="rgba(110,242,222,.45)"; ctx.lineWidth=6; ctx.lineCap="round";
    ctx.beginPath();
    const c1x=cx-90,  c1y=cy-15+Math.sin(t*.8)*18;
    const c2x=cx-180, c2y=cy-35+Math.cos(t*.6)*16;
    ctx.moveTo(cx,cy); ctx.bezierCurveTo(c1x,c1y,c2x,c2y, cx-260, cy-60); ctx.stroke();
  }

  // motes
  const targetMotes = 32;
  if(motes.length<targetMotes){
    for(let i=motes.length;i<targetMotes;i++){
      motes.push({x:Math.random()*W,y:Math.random()*H,dx:(Math.random()-.5)*.35,dy:(Math.random()-.5)*.35,r:1+Math.random()*1.6});
    }
  }
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

/******** UI ********/
function setStage(n){ STAGE=n; stageChip.textContent=String(n); }
function setHealth(p){ HEALTH=clamp(p); const pc=Math.round(HEALTH*100);
  healthPct.textContent=pc+"%"; healthBar.style.width=pc+"%"; }
function setMutation(p){ MUT=clamp(p); const pc=Math.round(MUT*100);
  mutPct.textContent=pc+"%"; mutBar.style.width=pc+"%"; }
function setFlow(p){ FLOW=clamp(p); flowBar.style.width=(FLOW*100)+"%"; }
function setPrice(n){ PRICE=n; priceLabel.textContent=n.toFixed(2); priceFoot.textContent=n.toFixed(2); }
function tickClock(){ updatedEl.textContent=HHMMSS(); clockEl.textContent=HHMMSS(); }

/******** Ticker ********/
function pushTicker(text, mag=false){
  const line = document.createElement("div");
  line.className = "line" + (mag? " mag": "");
  line.innerHTML = `<span class="dot">•</span>${text}<span class="dot">•</span>`;
  ticker.appendChild(line);
  // trim old children
  while (ticker.children.length > 6) ticker.removeChild(ticker.firstChild);
}

/******** Traits unlock ********/
function evalTraits(){
  const before = {...TRAITS};
  TRAITS.biolume = MUT >= .05 || TRAITS.biolume;
  TRAITS.echo    = HEALTH >= .5 || TRAITS.echo;
  TRAITS.tether  = HEALTH >= .42 || TRAITS.tether;

  // UI badges
  sigBiolume.classList.toggle("active", TRAITS.biolume);
  sigEcho.classList.toggle("active", TRAITS.echo);
  sigTether.classList.toggle("active", TRAITS.tether);

  if (TRAITS.biolume && !before.biolume) pushTicker("Trait unlocked: Biolume Rings");
  if (TRAITS.echo    && !before.echo)    pushTicker("Trait unlocked: Echo Pulse", true);
  if (TRAITS.tether  && !before.tether)  pushTicker("Trait unlocked: Tether Cord");
}

/******** Sim (replace with your API later) ********/
function simVitals(){
  const tgt = 0.55 + (FLOW-0.5)*0.25;
  setHealth(clamp(HEALTH + (tgt-HEALTH)*0.035 + (Math.random()-.5)*0.01));
  setMutation(clamp(MUT + (Math.random()-.5)*0.008,0,0.4));
  evalTraits();
}
function simPrice(){
  const drift=(Math.random()-.5)*0.02; setPrice(Math.max(0.01, PRICE+drift));
}

/******** Buttons ********/
feedBtn.addEventListener("click",(e)=>{
  e.preventDefault();
  setFlow(clamp(FLOW+.06)); setHealth(clamp(HEALTH+.02));
  pushTicker("Fed nutrients");
});

/******** Boot ********/
function boot(){
  setStage(1); setHealth(HEALTH); setMutation(MUT); setFlow(.55); setPrice(.01);
  lifeChip.textContent="alive";
  tradeBtn.href=`https://jup.ag/swap/SOL-${TOKEN_MINT}`;

  pushTicker("Specimen initialized");
  tickClock(); evalTraits();

  setInterval(tickClock, 1000);
  setInterval(simVitals, 4000);
  setInterval(simPrice, 6000);

  // flavor pings
  setInterval(()=>{
    if (MUT > .12 && Math.random()>.6) pushTicker("Echo ripples through membrane", true);
    if (HEALTH > .6 && Math.random()>.7)  pushTicker("Core brightens");
  }, 9000);
}
boot();
