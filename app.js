(() => {
  const cfg = window.__CONFIG__ || {};
  const API = cfg.apiBase || "";

  // DOM
  const canvas = document.getElementById("org-canvas");
  const ctx = canvas.getContext("2d");
  const orgWrap = document.querySelector(".organism-wrap");

  const statusWord = document.getElementById("status-word");
  const priceEl = document.getElementById("price");
  const updatedEl = document.getElementById("updated");
  const healthBar = document.getElementById("health-bar");
  const mutBar = document.getElementById("mut-bar");
  const decayRate = document.getElementById("decay-rate");
  const flowMeter = document.getElementById("flow-meter");
  const flowLabel = document.getElementById("flow-label");
  const tradesEl = document.getElementById("trades");
  const tradeBtn = document.getElementById("trade-btn");
  const feedBtn = document.getElementById("feed-btn");
  const sfxBtn = document.getElementById("sfx-btn");

  // link your swap (can be Jupiter/Pump link):
  tradeBtn.href = "https://jup.ag/swap/SOL-NATIVE/USDC"; // placeholder, change on launch

  // State
  let health = 0.65;          // 0..1
  let targetHealth = 0.65;
  let mutation = 0.0;         // 0..1
  let lastPrice = 0;
  let lastHealthTs = 0;

  // Simple drawing of the pulsing core (kept minimal here)
  function draw(t) {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);
    const radius = 46 + Math.sin(t/500) * 10 + health * 40;
    const grad = ctx.createRadialGradient(w/2,h/2, 4, w/2,h/2, radius);
    grad.addColorStop(0, "rgba(126,224,255,.9)");
    grad.addColorStop(1, "rgba(126,224,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(w/2, h/2, radius, 0, Math.PI*2);
    ctx.fill();
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  function fmtUSD(v) { return v ? `$${Number(v).toFixed(4)}` : "$—"; }
  function setHealth(val) {
    health = Math.max(0, Math.min(1, val));
    healthBar.style.width = `${Math.round(health*100)}%`;
  }

  // Health model: price → targetHealth; decay over time; trades nudge it.
  const DECAY_PER_10M = 0.01;  // 1% every 10 minutes
  decayRate.textContent = "1% / 10m";
  function tickDecay() {
    const now = Date.now();
    if (!lastHealthTs) { lastHealthTs = now; return; }
    const dt = (now - lastHealthTs) / 1000; // seconds
    const decayPerSec = (DECAY_PER_10M / (10*60));
    setHealth(health * (1 - decayPerSec * dt));
    lastHealthTs = now;

    // drift health smoothly toward target
    const k = 0.08;
    setHealth(health + (targetHealth - health) * k);
  }

  // Fetch price → map to target health via soft clamp
  async function pollHealth() {
    try {
      const r = await fetch(`${API}/health`);
      const j = await r.json();
      lastPrice = j.price || 0;
      priceEl.textContent = fmtUSD(lastPrice);
      updatedEl.textContent = new Date(j.timestamp).toLocaleTimeString();

      // map price to a [0.2..0.95] band relative to 24h micro-range
      // For now, simple: higher price => higher target
      const mapped = Math.max(0.2, Math.min(0.95, 0.4 + Math.log10(1 + lastPrice*120)));
      targetHealth = mapped;
      statusWord.textContent = "Alive";
      statusWord.classList.add("accent");
    } catch (e) {
      statusWord.textContent = "Offline";
      statusWord.classList.remove("accent");
    }
  }

  // Poll trades → update tape, flow, and nudge health with micro pulses
  const FLOW_WINDOW_MS = 5*60*1000;
  function renderTrades(rows) {
    tradesEl.innerHTML = "";
    const now = Date.now();
    let net = 0;

    rows.slice(0, 12).forEach((t) => {
      const li = document.createElement("div");
      li.className = "trade";
      const side = document.createElement("span");
      side.className = "side " + (t.side === "sell" ? "sell" : "buy");
      side.textContent = t.side === "sell" ? "SELL" : "BUY";

      const price = document.createElement("span");
      price.className = "price";
      price.textContent = fmtUSD(t.price);

      const amt = document.createElement("span");
      amt.className = "amount";
      amt.textContent = `${Number(t.amount).toLocaleString()} tokens`;

      const time = document.createElement("span");
      time.className = "time";
      time.textContent = new Date(t.ts).toLocaleTimeString();

      li.appendChild(side);
      li.appendChild(price);
      li.appendChild(amt);
      li.appendChild(time);
      tradesEl.appendChild(li);

      // Flow calc (recent trades only)
      if (now - t.ts < FLOW_WINDOW_MS) {
        const usd = t.price * t.amount;
        net += (t.side === "sell" ? -usd : usd);
      }
    });

    // Flow meter visual (centered -> 0, left = starving, right = feeding)
    // Map net USD to width %, soft clamp
    const intensity = Math.max(-1, Math.min(1, net / 2000)); // scale
    const pct = Math.abs(intensity) * 50; // 0..50% from center
    flowMeter.style.width = `${pct}%`;
    flowMeter.style.left = "50%";
    flowMeter.style.transform = "translateX(-50%)";
    flowMeter.style.background = intensity >= 0
      ? "linear-gradient(90deg, transparent, rgba(50,213,131,.7))"
      : "linear-gradient(270deg, transparent, rgba(255,107,107,.7))";
    flowLabel.textContent = intensity > 0.08 ? "Feeding" : (intensity < -0.08 ? "Starving" : "Neutral");

    // Organism pulse on strong bias
    if (intensity > 0.12) {
      orgWrap.classList.remove("starve");
      void orgWrap.offsetWidth; // reflow to retrigger
      orgWrap.classList.add("feed");
      // micro health nudge
      setHealth(health + 0.01 * Math.min(1, intensity));
    } else if (intensity < -0.12) {
      orgWrap.classList.remove("feed");
      void orgWrap.offsetWidth;
      orgWrap.classList.add("starve");
      setHealth(health - 0.01 * Math.min(1, -intensity));
    } else {
      orgWrap.classList.remove("feed", "starve");
    }
  }

  async function pollTrades() {
    try {
      const r = await fetch(`${API}/trades`);
      const j = await r.json();
      renderTrades(j.trades || []);
    } catch (e) {
      // leave previous tape; no crash
    }
  }

  // Manual "feed" tap – only visual for now
  feedBtn.addEventListener("click", (e) => {
    e.preventDefault();
    setHealth(health + 0.02);
    orgWrap.classList.remove("starve");
    void orgWrap.offsetWidth;
    orgWrap.classList.add("feed");
    setTimeout(() => orgWrap.classList.remove("feed"), 900);
  });

  sfxBtn.addEventListener("click", () => {
    cfg.sfx = !cfg.sfx;
    sfxBtn.textContent = cfg.sfx ? "🔊 SFX On" : "🔇 SFX Off";
  });

  // Schedulers
  setInterval(tickDecay, 1000);
  setInterval(pollHealth, 5_000);
  setInterval(pollTrades, 6_000);

  // Boot
  pollHealth();
  pollTrades();
})();
