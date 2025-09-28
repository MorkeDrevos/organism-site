<!-- Save as womb.js (same folder as index.html, styles.css, app.js) -->
<script>
(() => {
  // ===== Canvas bootstrap =====
  const canvas = document.getElementById('org-canvas');
  if (!canvas) return; // fail gracefully if canvas is missing
  const ctx = canvas.getContext('2d', { alpha: true });

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // ===== Animation state =====
  let t = 0;

  // “motes” (little particles drifting in fluid)
  const MOTES = Array.from({ length: 40 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: 1.2 + Math.random() * 1.8,
    s: 0.2 + Math.random() * 0.6, // speed
    p: Math.random() * Math.PI * 2  // phase
  }));

  // Offscreen noise canvas for veiny/hazy pass
  let noiseCanvas, noiseCtx;
  function makeNoise() {
    noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = 256;
    noiseCanvas.height = 256;
    noiseCtx = noiseCanvas.getContext('2d');
    const img = noiseCtx.createImageData(noiseCanvas.width, noiseCanvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = Math.random() * 255;
      d[i + 0] = n; // R
      d[i + 1] = n; // G
      d[i + 2] = n; // B
      d[i + 3] = 255;
    }
    noiseCtx.putImageData(img, 0, 0);
  }
  makeNoise();

  // Helpers
  const TAU = Math.PI * 2;
  const lerp = (a, b, m) => a + (b - a) * m;
  const ease = x => 1 - Math.pow(1 - x, 3);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function drawFluidGradient() {
    const cx = canvas.width * 0.52;
    const cy = canvas.height * 0.58; // lower for “in the womb”
    const r = Math.max(canvas.width, canvas.height) * 0.8;

    // Warm amniotic look (deep crimson → peachy core)
    const g = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
    g.addColorStop(0.00, 'rgba(255,180,150,0.35)');
    g.addColorStop(0.25, 'rgba(255,120,100,0.22)');
    g.addColorStop(0.55, 'rgba(140,40,40,0.25)');
    g.addColorStop(1.00, 'rgba(15,12,20,0.95)');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawVeinsAndHaze() {
    // Scroll the noise slowly for a living texture
    const scrollX = (Math.sin(t * 0.035) * 80) | 0;
    const scrollY = (Math.cos(t * 0.028) * 60) | 0;

    ctx.save();
    // Multiply darkens the reds slightly; screen adds milky haze highlights
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.12; // subtle
    for (let y = -256; y < canvas.height + 256; y += 256) {
      for (let x = -256; x < canvas.width + 256; x += 256) {
        ctx.drawImage(noiseCanvas, x + scrollX, y + scrollY);
      }
    }
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.08;
    for (let y = -256; y < canvas.height + 256; y += 256) {
      for (let x = -256; x < canvas.width + 256; x += 256) {
        ctx.drawImage(noiseCanvas, x - scrollX * 0.6, y - scrollY * 0.6);
      }
    }
    ctx.restore();
  }

  function drawOrganicRings() {
    // Soft concentric rings, slightly irregular (fluid ripple)
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.58;
    const base = Math.min(canvas.width, canvas.height) * 0.08;
    const rings = 9;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,230,220,0.12)';
    ctx.lineWidth = 1;

    for (let i = 1; i <= rings; i++) {
      const targetR = base * i * 1.45;
      // ripple distortion via angular wobble
      ctx.beginPath();
      for (let a = 0; a <= TAU + 0.05; a += TAU / 140) {
        const wobble =
          Math.sin(a * 3 + t * 0.6 + i * 0.7) * 2.2 +
          Math.sin(a * 7 - t * 0.4 + i) * 1.1;
        const r = clamp(targetR + wobble, 0, 99999);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r * 0.98; // slight oval
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCreatureCore() {
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.58;

    // Breathing scale (slower, irregular)
    const b = 0.8 + Math.sin(t * 0.9) * 0.04 + Math.sin(t * 0.23) * 0.03;
    const R = Math.min(canvas.width, canvas.height) * 0.045 * b;

    // Outer glow (peach)
    ctx.save();
    const glow = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 3.2);
    glow.addColorStop(0.0, 'rgba(255,180,160,0.25)');
    glow.addColorStop(1.0, 'rgba(255,150,120,0.00)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 3, 0, TAU);
    ctx.fill();

    // Core
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    core.addColorStop(0.0, 'rgba(255,210,190,0.95)');
    core.addColorStop(1.0, 'rgba(255,140,110,0.85)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();

    // A very subtle silhouette hint (abstract embryo curve)
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = 'rgba(90,10,10,0.65)';
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.3, cy - R * 0.2);
    ctx.quadraticCurveTo(cx + R * 0.8, cy - R * 0.9, cx + R * 0.35, cy + R * 0.3);
    ctx.quadraticCurveTo(cx - R * 0.2, cy + R * 0.6, cx - R * 0.3, cy - R * 0.2);
    ctx.fill();
    ctx.restore();
  }

  function drawMotes() {
    ctx.save();
    ctx.fillStyle = 'rgba(255,240,230,0.65)';
    for (const m of MOTES) {
      // Irregular drift (vertical preferred)
      m.y -= m.s * (0.4 + Math.sin((t + m.p) * 0.5) * 0.2);
      m.x += Math.sin((t + m.p) * 0.3) * 0.2;
      if (m.y < -10) {
        m.y = canvas.height + 10;
        m.x = Math.random() * canvas.width;
      }
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, TAU);
      ctx.fill();
      // tiny soft glow
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * 4, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function loop() {
    t += 0.016;

    // Clear with very dark plum to help multiply look
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0e0b11';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawFluidGradient();     // warm red/peach fluid
    drawVeinsAndHaze();      // noise veiny haze
    drawOrganicRings();      // soft ripple rings
    drawCreatureCore();      // pulsing nucleus + silhouette hint
    drawMotes();             // tiny floating specks

    requestAnimationFrame(loop);
  }

  loop();
})();
</script>
