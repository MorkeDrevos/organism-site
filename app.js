// THE ORGANISM — Frontend logic (full file)
// - Pulls live data from backend /health
// - Smoothly maps price -> visual "health"
// - Handles retries + shows warnings if backend is unreachable

(() => {
  const cfg = window.__CONFIG__ || {};
  const API = cfg.apiBase || "";

  // ---------- DOM ----------
  const canvas = document.getElementById('organismCanvas');
  const ctx = canvas.getContext('2d');

  const feedBtn = document.getElementById('feedBtn');
  const tradeBtn = document.getElementById('tradeBtn');
  const sfxBtn = document.getElementById('sfxBtn');

  const statusWord = document.getElementById('statusWord');
  const heartbeatRate = document.getElementById('heartbeatRate');

  const healthBar = document.getElementById('healthBar');
  const mutBar = document.getElementById('mutBar');
  const healthPct = document.getElementById('healthPct');
  const mutPct = document.getElementById('mutPct');

  const stageLabel = document.getElementById('stageLabel');
  const stageBadge = document.getElementById('stageBadge');

  const decayRate = document.getElementById('decayRate');
  const priceLabel = document.getElementById('priceLabel');
  const updatedLabel = document.getElementById('updatedLabel');

  const alertBox = document.getElementById('alert');
  const feedLog = document.getElementById('feedLog');
  const orgWrap = document.querySelector('.organism-wrap');
  const hero = document.querySelector('.hero');

  if (cfg.jupiterUrl) tradeBtn.href = cfg.jupiterUrl;

  // ---------- State ----------
  let t = 0;                 // animation clock (ms)
  let stage = 1;
  let health = 35;           // displayed 0..100
  let mutation = 0;          // displayed 0..100
  let sfx = false;

  // smoothing
  let targetHealth = 35;     // where we want health to move toward
  const EASE = 0.18;         // easing factor each tick
  const POLL_MS = 5000;      // backend poll
  let failCount = 0;

  // ---------- Helpers ----------
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  function setAlert(text, level) {
    if (!text) { alertBox.className='alert hidden'; alertBox.textContent=''; return; }
    alertBox.textContent = text;
    alertBox.className = 'alert ' + (level || '');
  }
  function log(msg) {
    const li = document.createElement('li');
    li.textContent = msg;
    feedLog.prepend(li);
    while (feedLog.children.length > 40) feedLog.removeChild(feedLog.lastChild);
  }
  function fmtUsd(n){
    if (n === null || n === undefined) return '--';
    const num = Number(n);
    if (!isFinite(num)) return '--';
    if (num >= 1) return '$' + num.toFixed(4);
    if (num >= 0.01) return '$' + num.toFixed(6);
    return '$' + num.toPrecision(2);
  }

  // Map price -> [0..100] health with gentle curvature:
  // - Very low prices keep health low but non-zero
  // - Higher prices asymptotically approach 100
  function priceToHealth(price) {
    // Normalize: choose a “reference” price band for your token
    // so typical values land around 40–70% health.
    // You can tune REF and GAIN after you see live behavior.
    const REF = 0.01;     // ~1 cent as pivot for this test token
    const GAIN = 85;      // max health contribution from price
    const x = Math.max(0, price / REF);    // normalized price
    // smooth curve (logistic-like using arctan):
    const curve = Math.atan(x) / (Math.PI/2); // 0..1
    const h = 5 + curve * GAIN;               // reserve 5% floor
    return Math.max(5, Math.min(100, h));
  }

  // ---------- Drawing ----------
  function redraw() {
    ctx.clearRect(0,0,canvas.width, canvas.height);
    const cx = canvas.width/2;
    const cy = canvas.height/2 + 10;

    // Base pulse driven by time + health
    const beat = (Math.sin(t/420) + 1)/2; // 0..1
    const healthFactor = clamp01(health/100);
    const radius = 78 + beat*26*healthFactor + stage*3;

    const grd = ctx.createRadialGradient(cx, cy, radius*0.2, cx, cy, radius);
    grd.addColorStop(0, 'rgba(120,255,210,0.95)');
    grd.addColorStop(1, 'rgba(20,40,60,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2); ctx.fill();

    // filaments
    ctx.strokeStyle = 'rgba(140,210,255,0.25)';
    for (let i=0;i<stage*8;i++){
      const ang = (i/stage)*Math.PI/4 + t/3000 + i*0.13;
      const len = radius + 24 + (Math.sin(t/900+i)*12);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang)*len, cy + Math.sin(ang)*len);
      ctx.stroke();
    }
  }

  // ---------- UI sync ----------
  function applyUI(alerts=[]) {
    // ease health toward target
    health += (targetHealth - health) * EASE;

    // mutation creeps (faster if health is high)
    mutation = Math.min(100, mutation + (0.05 + 0.35*clamp01(health/100)));

    healthBar.style.width = Math.max(0, Math.min(100, health)) + '%';
    healthPct.textContent = Math.round(Math.max(0, health)) + '%';
    mutBar.style.width = Math.max(0, Math.min(100, mutation)) + '%';
    mutPct.textContent = Math.round(Math.max(0, mutation)) + '%';

    // status labels
    if (health <= 0.5) {
      statusWord.textContent = 'Dead';
      statusWord.classList.remove('alive'); statusWord.classList.add('dead');
      heartbeatRate.textContent = 'Flatline';
    } else if (health < 10) {
      statusWord.textContent = 'Dying';
      statusWord.classList.remove('alive'); statusWord.classList.remove('dead');
      heartbeatRate.textContent = 'Faint';
    } else if (health < 30) {
      statusWord.textContent = 'Weak';
      statusWord.classList.remove('alive'); statusWord.classList.remove('dead');
      heartbeatRate.textContent = 'Weak';
    } else {
      statusWord.textContent = 'Alive';
      statusWord.classList.add('alive'); statusWord.classList.remove('dead');
      heartbeatRate.textContent = 'Stable';
    }

    // alerts
    if (alerts.length) {
      const text = alerts[0];
      const level = text.startsWith('COLLAPSE') ? 'crit'
                   : text.includes('Critical') ? 'crit'
                   : text.includes('Starvation') ? 'warn' : '';
      setAlert(text, level);
    } else if (failCount === 0) {
      setAlert('', '');
    }

    // vibe effect
    if (health > 0 && health < 12) hero.classList.add('shake'); else hero.classList.remove('shake');
  }

  // ---------- Backend polling ----------
  async function pollBackend() {
    if (!API) return;

    try {
      const r = await fetch(`${API}/health`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const s = await r.json();

      // update price/time display
      const price = Number(s.price || 0);
      priceLabel.textContent = fmtUsd(price);
      updatedLabel.textContent = new Date(s.timestamp || Date.now()).toLocaleTimeString();

      // compute a new target health from price
      targetHealth = priceToHealth(price);

      // reset warning on success
      failCount = 0;

    } catch (e) {
      failCount++;
      // Exponential-ish backoff messaging
      if (failCount === 1) setAlert('Backend unreachable. Showing local animation only.', 'warn');
      if (failCount > 6) setAlert('Backend still offline. Retrying…', 'warn');
    } finally {
      setTimeout(pollBackend, POLL_MS);
    }
  }

  // ---------- Interactions ----------
  sfxBtn.addEventListener('click', () => {
    sfx = !sfx;
    sfxBtn.textContent = sfx ? '🔊 SFX On' : '🔈 SFX Off';
    sfxBtn.setAttribute('aria-pressed', String(sfx));
  });

  feedBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    // micro “pulse”
    orgWrap.style.transform = 'scale(1.02)';
    setTimeout(()=> orgWrap.style.transform = 'scale(1.0)', 120);
    // little health nudge so it feels responsive
    targetHealth = Math.min(100, targetHealth + 2);
    log('Manual feed trigger (demo).');
  });

  // ---------- Tickers ----------
  setInterval(() => { t += 50; redraw(); applyUI([]); }, 50);
  decayRate.textContent = '1% / 10m';
  pollBackend();
})();
