// Live Habitat Demo — improved visuals, labels, and micro-interactions.
// Replace simulated logic with a backend when ready.
(() => {
  const cfg = window.__CONFIG__;

  // DOM
  const canvas = document.getElementById('organismCanvas');
  const ctx = canvas.getContext('2d');
  const feedBtn = document.getElementById('feedBtn');
  const tradeBtn = document.getElementById('tradeBtn');
  const sfxBtn = document.getElementById('sfxBtn');

  const healthBar = document.getElementById('healthBar');
  const mutBar = document.getElementById('mutBar');
  const healthPct = document.getElementById('healthPct');
  const mutPct = document.getElementById('mutPct');
  const alertBox = document.getElementById('alert');
  const feedLog = document.getElementById('feedLog');
  const heartbeatRate = document.getElementById('heartbeatRate');

  const stageLabel = document.getElementById('stageLabel');
  const stageBadge = document.getElementById('stageBadge');
  const decayRateEl = document.getElementById('decayRate');

  const orgWrap = document.querySelector('.organism-wrap');
  const hero = document.querySelector('.hero');

  tradeBtn.href = cfg.jupiterUrl;

  // State
  let health = 100;
  let mutation = 0;
  let stage = 1;
  let t = 0;
  let alive = true;
  let sfx = false;
  let decayMs = 10 * 60 * 1000; // Stage 1: 1% / 10m

  // Helpers
  function stageDecayMs(s) {
    if (s===1) return 10*60*1000;
    if (s===2) return 7*60*1000;
    if (s===3) return 5*60*1000;
    if (s===4) return 3*60*1000;
    return 2*60*1000;
  }
  function humanDecay(ms){
    const m = Math.round(ms/60000);
    return `1% / ${m}m`;
  }
  function setAlert(text, level) {
    if (!text) { alertBox.className='alert hidden'; alertBox.textContent=''; return; }
    alertBox.textContent = text;
    alertBox.className = 'alert ' + (level || '');
  }
  function log(msg) {
    const li = document.createElement('li');
    li.textContent = msg;
    feedLog.prepend(li);
  }

  // SFX toggle
  sfxBtn.addEventListener('click', () => {
    sfx = !sfx;
    sfxBtn.textContent = sfx ? '🔊 SFX On' : '🔈 SFX Off';
    sfxBtn.setAttribute('aria-pressed', String(sfx));
  });

  // Draw organism
  function redraw() {
    ctx.clearRect(0,0,canvas.width, canvas.height);

    const cx = canvas.width/2;
    const cy = canvas.height/2 + 10;
    const beat = (Math.sin(t/400) + 1)/2; // 0..1
    const healthFactor = Math.max(0.5, health/100);
    const radius = 78 + beat*24*healthFactor + stage*3;

    // Core glow
    const grd = ctx.createRadialGradient(cx, cy, radius*0.2, cx, cy, radius);
    grd.addColorStop(0, 'rgba(120, 255, 210, 0.95)');
    grd.addColorStop(1, 'rgba(20, 40, 60, 0.0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI*2);
    ctx.fill();

    // Tendrils
    ctx.strokeStyle = 'rgba(140, 210, 255, 0.25)';
    for (let i=0;i<stage*8;i++){
      const ang = (i/stage)*Math.PI/4 + t/3000 + i*0.13;
      const len = radius + 24 + (Math.sin(t/900+i)*12);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang)*len, cy + Math.sin(ang)*len);
      ctx.stroke();
    }
  }

  function updateUI() {
    healthBar.style.width = Math.max(0, Math.min(100, health)) + '%';
    healthPct.textContent = Math.round(Math.max(0, health)) + '%';
    mutBar.style.width = Math.max(0, Math.min(100, mutation)) + '%';
    mutPct.textContent = Math.round(Math.max(0, mutation)) + '%';

    if (health <= 0) {
      alive = false;
      document.querySelector('.status').textContent = 'Dead';
      document.querySelector('.status').classList.remove('alive');
      document.querySelector('.status').classList.add('dead');
      heartbeatRate.textContent = 'Flatline';
      setAlert('COLLAPSE: The organism has died. Awaiting rebirth protocol.', 'crit');
      hero.classList.remove('shake');
    } else if (health < 10) {
      setAlert('Critical starvation. Immediate feeding required.', 'crit');
      heartbeatRate.textContent = 'Faint';
      hero.classList.add('shake');
    } else if (health < 30) {
      setAlert('Starvation detected. Mutations at risk of failure.', 'warn');
      heartbeatRate.textContent = 'Weak';
      hero.classList.remove('shake');
    } else {
      setAlert('', '');
      heartbeatRate.textContent = 'Stable';
      hero.classList.remove('shake');
    }
  }

  function onMutate() {
    // Update labels + archive + decay
    decayMs = stageDecayMs(stage);
    stageLabel.textContent = String(stage);
    decayRateEl.textContent = humanDecay(decayMs);

    const names = {
      1:'The Cell',
      2:'The Organism',
      3:'The Eye',
      4:'The Hybrid',
      5:'The Apex'
    };
    stageBadge.textContent = `Stage ${stage} • ${names[stage] || '???'}`;

    const archive = document.getElementById('archive');
    const li = document.createElement('li');
    const desc = {
      2:'The Organism — Tendrils extend outward. Hungrier.',
      3:'The Eye — It sees who feeds and who starves.',
      4:'The Hybrid — Circuits through flesh. Unnatural.',
      5:'The Apex — Beautiful and terrifying.'
    };
    if (desc[stage]) {
      li.innerHTML = `<strong>Stage ${stage}:</strong> ${desc[stage]}`;
      archive.appendChild(li);
    }

    // Quick flash / pulse
    orgWrap.style.transform = 'scale(1.04)';
    setTimeout(()=> orgWrap.style.transform = 'scale(1.0)', 220);
  }

  function maybeMutate() {
    if (mutation >= 100 && health >= 25) {
      stage += 1;
      mutation = 0;
      log(`✨ Mutation achieved → Stage ${stage}.`);
      onMutate();
    }
  }

  // Initial labels
  decayRateEl.textContent = humanDecay(decayMs);

  // Tick
  setInterval(() => {
    if (!alive) return;
    t += 50;

    // decay: 1% per decayMs
    const dt = 50; // ms
    const decayPerMs = 1 / decayMs;
    health -= decayPerMs * dt * 1000;
    if (health < 0) health = 0;

    // passive mutation progress (placeholder until backend)
    mutation += 0.005;
    if (mutation > 100) mutation = 100;

    redraw();
    updateUI();
    maybeMutate();
  }, 50);

  // Simulated feed (dev/demo). Replace with tx listener later.
  feedBtn.addEventListener('click', () => {
    if (!alive){
      // simple rebirth: first feed revives to 25%
      alive = true;
      health = 25;
      document.querySelector('.status').textContent = 'Alive';
      document.querySelector('.status').classList.remove('dead');
      document.querySelector('.status').classList.add('alive');
      heartbeatRate.textContent = 'Weak';
      setAlert('Rebirth protocol engaged. The organism stirs again…', 'warn');
      log('🩺 Rebirth initiated by manual feed.');
    } else {
      const sol = (Math.random()*1.2 + 0.1).toFixed(2);
      const gain = Math.min(20, parseFloat(sol) * 2); // % health
      health = Math.min(100, health + gain);
      mutation = Math.min(100, mutation + gain * 0.6);
      log(`+${sol} SOL fed — Health +${gain.toFixed(2)}%, Mutation +${(gain*0.6).toFixed(2)}%`);
    }
    // micro feedback
    orgWrap.style.transform = 'scale(1.02)';
    setTimeout(()=> orgWrap.style.transform = 'scale(1.0)', 120);
    if (sfx) new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YQA=').play();
    updateUI();
  });

  // Optional backend polling
  async function pollBackend() {
    if (!cfg.apiBase) return;
    try {
      const r = await fetch(cfg.apiBase + '/state');
      if (r.ok) {
        const s = await r.json();
        health = s.health; mutation = s.mutation; stage = s.stage;
        onMutate(); // refresh labels if stage changed
      }
    } catch(e){ /* ignore */ }
    setTimeout(pollBackend, 5000);
  }
  pollBackend();
})();
