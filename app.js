/* THE ORGANISM — frontend renderer
   - Pulls price and trades from backend
   - Health decays slowly; trades nudge health (feed/starve)
   - Trades table shows Price (USD) and Value (USD)
*/

(() => {
  const cfg = window.__CONFIG__ || {};
  const API = cfg.apiBase || "";

  // DOM
  const canvas = document.getElementById("organism");
  const ctx = canvas.getContext("2d");
  const feedBtn = document.getElementById("feedBtn");
  const tradeBtn = document.getElementById("tradeBtn");
  const sfxBtn = document.getElementById("sfxBtn");

  const statusWord = document.getElementById("status");
  const heartbeat = document.getElementById("heartbeat");
  const healthBar = document.getElementById("healthBar");
  const mutBar = document.getElementById("mutBar");
  const decayRate = document.getElementById("decayRate");
  const stageNum = document.getElementById("stageNum");
  const priceEl = document.getElementById("price");
  const tsEl = document.getElementById("timestamp");
  const flowBar = document.getElementById("flowBar");
  const flowWord = document.getElementById("flowWord");
  const tradesBox = document.getElementById("trades");
  const stageBadge = document.getElementById("stageBadge");

  // swap link
  if (cfg.jupiterSwapUrl) tradeBtn.href = cfg.jupiterSwapUrl;

  // State
  let alive = true;
  let health = 0.40;   // 0..1
  let mutation = 0.00; // 0..1
  let targetGlow = 0.6; // driven by price/trades
  let sfx = false;

  // Flow buffer (last 5m)
  const FLOW_WINDOW_MS = 5 * 60 * 1000;
  const flow = []; // {t, side, valueUsd}

  // Decay
  const DECAY_PER_TICK = 0.0015; // 0.15% per sec ≈ 1%/10m
  decayRate.textContent = "1% / 10m";

  // ---------- Canvas organism ----------
  function drawOrganism() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);

    // background faint glow
    const grad = ctx.createRadialGradient(w/2,h/2,10, w/2,h/2,180);
    const g = Math.max(0.15, Math.min(1, targetGlow));
    grad.addColorStop(0, `rgba(130, 255, 210, ${0.85*g})`);
    grad.addColorStop(1, `rgba(30, 60, 80, 0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(w/2, h/2, 180, 0, Math.PI*2);
    ctx.fill();

    // core
    ctx.fillStyle = `rgba(160, 255, 220, ${0.9*g})`;
    ctx.beginPath();
    ctx.arc(w/2, h/2, 36 + 18*health, 0, Math.PI*2);
    ctx.fill();

    // spikes (pulse)
    const now = performance.now()/1000;
    const spikes = 9;
    for (let i=0;i<spikes;i++){
      const a = (i/spikes)*Math.PI*2 + now*0.6;
      const r1 = 80 + Math.sin(now*2 + i)*6;
      const r2 = r1 + 26 + 12*health;
      ctx.strokeStyle = `rgba(160, 255, 220, ${0.25+0.35*g})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w/2 + Math.cos(a)*r1, h/2 + Math.sin(a)*r1);
      ctx.lineTo(w/2 + Math.cos(a)*r2, h/2 + Math.sin(a)*r2);
      ctx.stroke();
    }
    requestAnimationFrame(drawOrganism);
  }
  requestAnimationFrame(drawOrganism);

  // ---------- Utilities ----------
  const $ = (sel, root=document) => root.querySelector(sel);
  const fmtUSD = (n, d=4) => {
    if (n === null || n === undefined || Number.isNaN(n)) return "$—";
    const abs = Math.abs(n);
    const dp = abs >= 1 ? 4 : abs >= 0.01 ? 5 : 6;
    return "$" + n.toFixed(d ?? dp);
  };
  const fmtUSD2 = (n) => "$" + (Number(n)||0).toFixed(2);
  const fmtTokens = (n) => {
    if (!Number.isFinite(n)) return "—";
    if (n >= 1_000_000) return (n/1_000_000).toFixed(2) + "m";
    if (n >= 1_000) return (n/1_000).toFixed(2) + "k";
    return n.toFixed(0);
  };

  // ---------- Health & tick ----------
  function applyDecay() {
    health = Math.max(0, health - DECAY_PER_TICK);
    if (health === 0 && alive) {
      alive = false;
      statusWord.textContent = "Dead";
      statusWord.classList.remove("ok");
      statusWord.classList.add("bad");
      heartbeat.textContent = "Flatline";
    }
    healthBar.style.width = (health*100).toFixed(0) + "%";
  }

  function nudgeByTrades() {
    // compute net flow last 5m: buys add, sells subtract (using USD value)
    const cutoff = Date.now() - FLOW_WINDOW_MS;
    while (flow.length && flow[0].t < cutoff) flow.shift();

    let net = 0;
    for (const f of flow) net += f.side === "BUY" ? f.valueUsd : -f.valueUsd;

    // normalize & map to [0..1] bar (left starve, right feed)
    const maxAbs = 50; // $ threshold for full deflection (tune to your token)
    const ratio = Math.max(-1, Math.min(1, net / maxAbs));
    flowBar.style.width = ((ratio+1)/2*100).toFixed(0) + "%";
    flowBar.style.background = ratio >= 0 ? "linear-gradient(90deg,#1f2937,#16a34a)" : "linear-gradient(90deg,#be123c,#1f2937)";
    flowWord.textContent = ratio > 0.1 ? "Feeding" : ratio < -0.1 ? "Starving" : "Neutral";

    // affect health glow lightly
    targetGlow = 0.5 + 0.3*Math.max(-0.5, Math.min(0.5, ratio));
    health = Math.min(1, Math.max(0, health + 0.0005*ratio)); // slow nudge
    healthBar.style.width = (health*100).toFixed(0) + "%";
  }

  // ---------- Backend polling ----------
  async function pollHealth() {
    try {
      const r = await fetch(`${API}/health`);
      const j = await r.json();
      // j = {status, price, timestamp}
      statusWord.textContent = j.status === "alive" ? "Alive" : "Dead";
      if (j.status === "alive") {
        statusWord.classList.add("ok");
        statusWord.classList.remove("bad");
        heartbeat.textContent = "Stable";
        alive = true;
      }
      priceEl.textContent = fmtUSD(j.price, 6);
      tsEl.textContent = new Date(j.timestamp).toLocaleTimeString();

      // price also drives target glow a bit
      const p = Number(j.price) || 0;
      targetGlow = 0.55 + Math.tanh((p - 0.005) * 60) * 0.25; // tune center @ 0.5c

    } catch (e) {
      console.error("health poll error:", e);
      statusWord.textContent = "Offline";
      statusWord.classList.remove("ok");
      heartbeat.textContent = "Weak";
    }
  }

  async function pollTrades() {
    try {
      const r = await fetch(`${API}/trades`);
      const j = await r.json();
      // expected: [{side:'BUY'|'SELL', price:Number(USD), amount:Number(tokens), time:ISO }]
      renderTrades(j || []);
    } catch (e) {
      console.error("trades poll error:", e);
    }
  }

  function renderTrades(list) {
    tradesBox.innerHTML = "";
    const frag = document.createDocumentFragment();
    const now = Date.now();

    list.slice(0, 12).forEach(t => {
      const row = document.createElement("div");
      row.className = "row t-mono";

      const side = (t.side || "").toUpperCase();
      const price = Number(t.price) || 0;             // USD per token
      const amount = Number(t.amount) || 0;           // tokens
      const valueUsd = price * amount;                // USD value
      const tt = t.time ? new Date(t.time) : new Date();

      // Keep a minimal flow record (for 5m net meter)
      flow.push({ t: tt.getTime(), side, valueUsd });

      row.innerHTML = `
        <div class="${side === "BUY" ? "buy" : "sell"}">${side}</div>
        <div class="t-right">$${price.toFixed(4)}</div>
        <div class="t-right">
          ${fmtUSD2(valueUsd)} <span class="muted">(${fmtTokens(amount)} tokens)</span>
        </div>
        <div class="t-right">${tt.toLocaleTimeString()}</div>
      `;
      frag.appendChild(row);
    });

    tradesBox.appendChild(frag);

    // clean old flow items (keep ~5m)
    const cutoff = now - FLOW_WINDOW_MS;
    while (flow.length && flow[0].t < cutoff) flow.shift();
  }

  // ---------- Interactions ----------
  feedBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    // micro “pulse”
    targetGlow = Math.min(1, targetGlow + 0.12);
    health = Math.min(1, health + 0.02);
    healthBar.style.width = (health*100).toFixed(0) + "%";
  });

  sfxBtn.addEventListener("click", () => {
    sfx = !sfx;
    sfxBtn.textContent = sfx ? "🔊 SFX On" : "🔇 SFX Off";
  });

  // ---------- Schedulers ----------
  setInterval(applyDecay, 1000);     // slow decay
  setInterval(pollHealth, 6000);     // price/health
  setInterval(() => {                // trades & flow mapping
    pollTrades();
    nudgeByTrades();
  }, 6000);

  // ---------- Boot ----------
  pollHealth();
  pollTrades();
})();
