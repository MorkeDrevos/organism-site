// app.js — front-end glue (price, vitals, trades feed/starve)
(() => {
  const API = "";

  // ---- DOM
  const priceLabel = document.getElementById("priceLabel");
  const updatedLabel = document.getElementById("updatedLabel");
  const healthBar = document.getElementById("healthBar");
  const mutBar = document.getElementById("mutBar");
  const flowBar = document.getElementById("flowBar");
  const flowLabel = document.getElementById("flowLabel");
  const stageNum = document.getElementById("stageNum");

  const tradesBody = document.getElementById("trades-body"); // tbody
  const tradeHeadTime = document.getElementById("th-time");
  const tradeHeadType = document.getElementById("th-type");
  const tradeHeadValue = document.getElementById("th-value");
  const tradeHeadPrice = document.getElementById("th-price");

  // ---- State (toy sim for health/mutation)
  let health = 0.65; // 0..1
  let mutation = 0.12; // 0..1
  let net5m = 0; // simple net flow meter

  // ---- Formatters
  const fmtUSD = n => (Number.isFinite(n) ? `$${n.toFixed(n < 1 ? 4 : 2)}` : "$—");
  const fmtPrice = n => (Number.isFinite(n) ? `$${n.toFixed(6)}` : "$—");
  const fmtTime = iso => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  };

  function setHealth(v) {
    health = Math.max(0, Math.min(1, v));
    healthBar.style.width = `${Math.round(health * 100)}%`;
  }
  function setMutation(v) {
    mutation = Math.max(0, Math.min(1, v));
    mutBar.style.width = `${Math.round(mutation * 100)}%`;
  }
  function setFlow(v) {
    net5m = Math.max(-1, Math.min(1, v));
    const pct = Math.round(((net5m + 1) / 2) * 100);
    flowBar.style.width = `${pct}%`;
    flowBar.style.transformOrigin = "left";
    flowLabel.textContent = net5m > 0.05 ? "Feeding" : net5m < -0.05 ? "Starving" : "Neutral";
  }

  // ---- Canvas organism (simple womb vibe; hue shifts with health)
  const canvas = document.getElementById("org-canvas");
  const ctx = canvas.getContext("2d");
  function fitCanvas() {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(480, Math.floor(r.width));
    canvas.height = Math.max(360, Math.floor(r.height));
  }
  fitCanvas();
  window.addEventListener("resize", fitCanvas);

  function drawOrganism() {
    const W = canvas.width, H = canvas.height;
    const t = performance.now() / 1000;
    ctx.clearRect(0, 0, W, H);

    // background
    ctx.fillStyle = "rgba(10,16,24,0.9)";
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2;
    const base = 120 + 26 * Math.sin(t * 0.8);
    const hue = 140 + 60 * health; // teal->lime as health rises

    // nucleus glow
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, base);
    g.addColorStop(0, `hsla(${hue}, 75%, 62%, 0.55)`);
    g.addColorStop(1, `hsla(${hue}, 80%, 10%, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, base, 0, Math.PI * 2);
    ctx.fill();

    // concentric womb rings
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 4; i++) {
      const r = 150 + i * 55 + 6 * Math.sin(t * (0.9 + i * 0.1));
      ctx.strokeStyle = `hsla(${hue},70%,${26 + i * 10}%,0.18)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // drifting specks
    for (let i = 0; i < 16; i++) {
      const a = t * (0.12 + i * 0.01) + i;
      const r = 60 + (i * 18) % 220;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a * 0.97) * r * 0.8;
      ctx.fillStyle = `hsla(${hue}, 80%, ${60 - i * 2}%, 0.25)`;
      ctx.beginPath();
      ctx.arc(x, y, 1.3 + (i % 3) * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(drawOrganism);
  }
  requestAnimationFrame(drawOrganism);

  // ---- Data polling
  async function pollHealth() {
    try {
      const r = await fetch(`${API}/health`);
      const j = await r.json();
      if (Number.isFinite(j.price)) {
        priceLabel.textContent = fmtPrice(j.price);
      }
      const d = new Date(j.timestamp || Date.now());
      updatedLabel.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    } catch (e) {
      console.error("health fetch", e);
    }
  }

  async function pollTrades() {
    try {
      const r = await fetch(`${API}/trades`);
      const rows = await r.json();
      tradesBody.innerHTML = "";

      // compute net flow (USD): Feed positive, Starve negative (last 5m-ish)
      let net = 0;
      const now = Date.now();
      for (const it of rows) {
        const age = now - new Date(it.time).getTime();
        if (age < 5 * 60 * 1000) {
          net += (it.type === "Feed" ? 1 : -1) * (Number(it.valueUsd) || 0);
        }
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="left">${fmtTime(it.time)}</td>
          <td class="${it.type === "Feed" ? "feed" : "starve"}">${it.type}</td>
          <td class="left">${fmtUSD(it.valueUsd)}</td>
          <td class="left">${fmtPrice(it.priceUsd)}</td>
        `;
        tradesBody.appendChild(tr);
      }

      // nudge health by net flow (very gently)
      const delta = Math.max(-0.02, Math.min(0.02, net / 500)); // scale
      setHealth(health + delta);
      setMutation(Math.min(1, mutation + Math.max(0, delta) * 0.002));

      // set flow
      const norm = Math.max(-1, Math.min(1, net / 100)); // normalize
      setFlow(norm);
    } catch (e) {
      console.error("trades fetch", e);
    }
  }

  // slow decay driver
  function tickDecay() {
    setHealth(health - 0.005); // 0.5% per tick (~10s)
  }

  // ---- Boot
  setInterval(tickDecay, 10_000);
  setInterval(pollHealth, 6_000);
  setInterval(pollTrades, 6_000);
  pollHealth();
  pollTrades();
})();
