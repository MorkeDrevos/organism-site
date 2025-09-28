// app.js — full file
(() => {
  // ========= Config =========
  const cfg = window.__CONFIG__ || {};
  const API = cfg.apiBase || "https://organism-backend.onrender.com";
  const HEALTH_URL = `${API}/health`;
  const TRADES_URL = `${API}/trades`;

  // polling cadence
  const POLL_HEALTH_MS = 6000;
  const POLL_TRADES_MS = 6000;
  const DECAY_TICK_MS  = 1000;

  // net flow window
  const FLOW_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  // ========= DOM refs =========
  const canvas      = document.getElementById("organism-canvas");
  const ctx         = canvas?.getContext?.("2d");
  const orgWrap     = document.querySelector(".organism-wrap");
  const glow        = document.querySelector(".organism-glow");

  const statusWord  = document.getElementById("status-word");
  const decayRate   = document.getElementById("decay-rate");
  const stageLabel  = document.getElementById("stage-label");
  const priceLabel  = document.getElementById("price-label");
  const updatedLbl  = document.getElementById("updated-label");

  const healthBar   = document.getElementById("health-bar");
  const mutBar      = document.getElementById("mut-bar");
  const flowBar     = document.getElementById("flow-bar");
  const flowLabel   = document.getElementById("flow-label");

  const tradesBody  = document.getElementById("trades-body"); // <tbody>

  const feedBtn     = document.getElementById("feed-btn");
  const sfxBtn      = document.getElementById("sfx-btn");
  const swapBtn     = document.getElementById("swap-btn");

  // ========= State =========
  let health = 0.75;          // 0..1
  let mutation = 0.00;        // 0..1
  let stage = 1;
  let lastPrice = 0;          // USD
  let lastHealthFetch = 0;

  let sfx = false;
  let flowEvents = [];        // {ts, valueUsd, side}

  // ========= Utils =========
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmtUSD = (v) => {
    if (!isFinite(v)) return "$—";
    return v < 1
      ? `$${v.toFixed(4)}`
      : v < 1000
      ? `$${v.toFixed(2)}`
      : `$${Number(v.toFixed(0)).toLocaleString()}`;
  };
  const fmtTokens = (n) => `${Number(n).toLocaleString()} tokens`;
  const fmtTime = (ts) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch { return "—"; }
  };

  // Canvas: soft pulsing ring
  function drawOrganism() {
    if (!ctx || !canvas) return;
    const w = canvas.width = canvas.clientWidth;
    const h = canvas.height = canvas.clientHeight;
    const cx = w / 2, cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    const t = Date.now() / 1000;
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.3);
    const radius = Math.min(w, h) * 0.12 * (0.9 + 0.2 * health);

    // color shifts with net flow (feeding -> greenish, starving -> reddish)
    const flow = getNetFlowUsd(); // -1..+1 normalized later
    const hue = flow >= 0 ? 160 : 12; // green vs red
    const alpha = 0.35 + 0.35 * pulse;

    // core glow
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 4);
    grd.addColorStop(0, `hsla(${hue}, 85%, 65%, ${alpha})`);
    grd.addColorStop(1, `hsla(${hue}, 85%, 10%, 0)`);

    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * (1.1 + 0.05 * Math.sin(t * 3)), 0, Math.PI * 2);
    ctx.fill();

    // subtle lines
    ctx.globalAlpha = 0.15 + 0.1 * pulse;
    ctx.strokeStyle = `hsla(${hue}, 90%, 70%, 0.8)`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + (t * 0.5);
      const r1 = radius * 1.4;
      const r2 = radius * (1.9 + 0.05 * Math.sin(t * 2 + i));
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(drawOrganism);
  }

  // ========= Health & Trades =========
  async function pollHealth() {
    try {
      const r = await fetch(HEALTH_URL, { cache: "no-store" });
      const j = await r.json();
      lastPrice = Number(j?.price) || 0;
      lastHealthFetch = Number(j?.timestamp) || Date.now();

      // UI bits
      statusWord.textContent = "Alive";
      priceLabel.textContent  = fmtUSD(lastPrice);
      updatedLbl.textContent  = fmtTime(lastHealthFetch);

      // nudge health slightly by price drift (demo)
      const priceInfluence = clamp((lastPrice || 0) * 5, -0.02, 0.02);
      health = clamp(health + priceInfluence, 0, 1);
      healthBar.style.width = `${Math.round(health * 100)}%`;

      // stage logic (toy)
      mutation = clamp(mutation + 0.0015 + Math.max(0, getNetFlowUsdNorm()) * 0.004, 0, 1);
      mutBar.style.width = `${Math.round(mutation * 100)}%`;
      if (mutation >= 1) {
        stage += 1;
        stageLabel.textContent = `Stage ${stage}`;
        mutation = 0;
      }
    } catch (e) {
      console.error("Health fetch error:", e);
      statusWord.textContent = "Offline";
    }
  }

  async function pollTrades() {
    try {
      const r = await fetch(TRADES_URL, { cache: "no-store" });
      const j = await r.json();
      const arr = Array.isArray(j) ? j : Array.isArray(j?.trades) ? j.trades : [];
      if (!Array.isArray(arr)) return;

      // render rows + collect flow events
      renderTrades(arr);

      // update net flow bar (buys add, sells subtract)
      updateFlow();
    } catch (e) {
      console.error("Trades fetch error:", e);
    }
  }

  function renderTrades(trades) {
    if (!tradesBody) return;

    // keep only recent window in flow store
    const now = Date.now();
    flowEvents = flowEvents.filter(ev => now - ev.ts <= FLOW_WINDOW_MS);

    const rows = trades
      .slice(0, 20) // show latest N
      .map(t => {
        // backend uses lowercase "buy"/"sell"
        const side = String(t.side || "").toLowerCase();
        const price = Number(t.price) || 0;         // USD per token
        const amount = Number(t.amount) || 0;       // tokens
        const ts = Number(t.ts) || now;

        // push to flow store (value in USD, signed)
        const valueUsd = price * amount;
        flowEvents.push({ ts, side, valueUsd });

        return {
          side,
          price,
          amount,
          valueUsd,
          ts
        };
      });

    // build DOM
    tradesBody.innerHTML = "";
    rows.forEach(row => {
      const tr = document.createElement("tr");
      tr.className = "trade-row";

      const sideTd  = document.createElement("td");
      const priceTd = document.createElement("td");
      const valTd   = document.createElement("td");
      const timeTd  = document.createElement("td");

      sideTd.textContent = row.side.toUpperCase();
      sideTd.className = row.side === "buy" ? "buy" : "sell";

      priceTd.textContent = fmtUSD(row.price);
      valTd.innerHTML = `${fmtUSD(row.valueUsd)}<div class="sub">${fmtTokens(row.amount)}</div>`;
      timeTd.textContent = fmtTime(row.ts);

      tr.append(sideTd, priceTd, valTd, timeTd);
      tradesBody.appendChild(tr);
    });
  }

  function getNetFlowUsd() {
    // Sum last 5m, buys positive, sells negative
    const now = Date.now();
    const recent = flowEvents.filter(ev => now - ev.ts <= FLOW_WINDOW_MS);
    if (!recent.length) return 0;
    const total = recent.reduce((acc, ev) => acc + (ev.side === "buy" ? ev.valueUsd : -ev.valueUsd), 0);
    return total; // raw USD
  }

  function getNetFlowUsdNorm() {
    // normalize for UI [-1..+1] by a soft scale
    const usd = getNetFlowUsd();
    const scale = 50; // $50 moves ~ full bar; tune freely
    return clamp(usd / scale, -1, 1);
  }

  function updateFlow() {
    const n = getNetFlowUsdNorm();
    const pct = Math.round((n + 1) * 50); // -1..+1 -> 0..100
    flowBar.style.width = `${pct}%`;

    let label = "Neutral";
    if (n > 0.1) label = "Feeding";
    else if (n < -0.1) label = "Starving";
    flowLabel.textContent = label;

    // glow “color burn” by flow
    if (glow) glow.style.filter = `brightness(${1 + Math.abs(n) * 0.4})`;
    if (orgWrap) orgWrap.style.setProperty("--flow-tilt", n.toFixed(3));
  }

  // Passive decay (every second)
  function tickDecay() {
    // baseline decay (1% / 10m -> ~0.000167 per sec)
    const base = 0.000167;

    // flow slows/speeds decay
    const flow = getNetFlowUsdNorm(); // -1..+1
    const mod = 1 - (0.5 * Math.max(flow, 0)) + (0.4 * Math.max(-flow, 0)); // feeding reduces decay; starving increases
    health = clamp(health - base * mod, 0, 1);
    healthBar.style.width = `${Math.round(health * 100)}%`;
  }

  // ========= Interactions =========
  sfxBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    sfx = !sfx;
    sfxBtn.textContent = sfx ? "🔊 SFX On" : "🔇 SFX Off";
  });

  feedBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    // a tiny manual nudge
    health = clamp(health + 0.02, 0, 1);
    healthBar.style.width = `${Math.round(health * 100)}%`;
    orgWrap?.animate([{ transform: "scale(1)" }, { transform: "scale(1.02)" }, { transform: "scale(1)" }], { duration: 220, easing: "ease-out" });
  });

  // ========= Schedulers =========
  setInterval(tickDecay, DECAY_TICK_MS);
  setInterval(pollHealth, POLL_HEALTH_MS);
  setInterval(pollTrades, POLL_TRADES_MS);

  // ========= Boot =========
  drawOrganism();
  pollHealth();
  pollTrades();
})();
