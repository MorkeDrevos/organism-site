(() => {
  // CONFIG
  const API = "https://organism-backend.onrender.com"; // ← change if your backend URL differs
  const DECAY_PER_TICK = 0.01;    // ~1% per tick (visual)
  const TICK_MS = 10_000;         // decay tick
  const HEALTH_POLL_MS = 6_000;   // /health
  const TRADES_POLL_MS = 6_000;   // /trades
  const FLOW_WINDOW = 5 * 60 * 1000; // 5m window for net flow

  // DOM
  const canvas = document.getElementById("org-canvas");
  const ctx = canvas.getContext("2d");
  const feedBtn = document.getElementById("feedBtn");
  const sfxBtn = document.getElementById("sfxBtn");
  const tradeBtn = document.getElementById("tradeBtn");
  const stageBadge = document.getElementById("stageBadge");

  const statusWord = document.getElementById("status");
  const heartbeat = document.getElementById("heartbeat");
  const healthBar = document.getElementById("health-bar");
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

  // STATE
  let sfx = false;
  let health = 0.62;     // 0..1
  let mutation = 0.08;   // 0..1
  let stage = 1;

  let lastPrice = 0;     // usd
  let lastTs = 0;

  let flows = [];        // {ts, dir:+1|-1, usd}

  // ---------- Helpers
  const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
  const setHealth = (v) => {
    health = clamp(v);
    healthBar.style.width = `${Math.round(health*100)}%`;
    healthPct.textContent = `${Math.round(health*100)}%`;
  };
  const setMutation = (v) => {
    mutation = clamp(v);
    mutBar.style.width = `${Math.round(mutation*100)}%`;
    mutPct.textContent = `${Math.round(mutation*100)}%`;
  };
  const setStage = (n) => {
    stage = n;
    stageNum.textContent = String(n);
    stageBadge.textContent = n === 1 ? "Stage 1 · The Cell" : `Stage ${n}`;
  };
  const fmtUSD = (n) => n ? `$${n.toFixed(4)}` : "$—";
  const fmtUSDc = (n) => n ? `$${n.toFixed(2)}` : "$—";
  const pad2 = (x) => String(x).padStart(2,"0");
  const fmtTs = (ts) => {
    const d = new Date(ts);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  };

  // ---------- Canvas organism (mysterious “womb” glow)
  const W = canvas.width, H = canvas.height, Cx=W/2, Cy=H/2;
  let t0 = performance.now();
  function drawOrganism(now){
    const t = (now - t0)/1000;

    ctx.clearRect(0,0,W,H);

    // Pulsing nucleus
    const baseR = 58 + 26*Math.sin(t*1.2);
    const hue = 150 + 30*(health-0.5); // greener on health
    const gradN = ctx.createRadialGradient(Cx, Cy, 0, Cx, Cy, baseR);
    gradN.addColorStop(0, `hsla(${hue},70%,70%,.85)`);
    gradN.addColorStop(1, `hsla(${hue},70%,35%,0)`);
    ctx.fillStyle = gradN;
    ctx.beginPath(); ctx.arc(Cx, Cy, baseR, 0, Math.PI*2); ctx.fill();

    // Concentric rings drifting (womb feel)
    for(let i=1;i<=5;i++){
      const r = 110 + i*40 + 8*Math.sin(t*0.9 + i);
      ctx.strokeStyle = `rgba(140, 200, 170, ${0.08 - i*0.008})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(Cx, Cy, r, 0, Math.PI*2); ctx.stroke();
    }

    // drifting specks
    for(let i=0;i<18;i++){
      const a = t*0.3 + i*0.7, r = 190 + (i%5)*22 + 8*Math.sin(t*.8+i);
      const x =
