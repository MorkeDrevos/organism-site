/******** CONFIG ********/
const TOKEN_MINT = "YOUR_CA_HERE";

/******** DOM ********/
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d");
resize();
window.addEventListener("resize", resize);

/******** State ********/
let health = 0.55;
let mutation = 0.08;
let t0 = performance.now();

/******** Palette ********/
const PALETTE = {
  bg: "#0a0a14",
  haze: "rgba(96,160,200,0.14)",
  nucleus: "rgba(210,245,255,0.9)",
  membrane: "rgba(160,225,255,0.25)",
  rimAqua: "rgba(127,235,255,0.65)",
  rimMag: "rgba(255,115,211,0.65)",
  motes: "rgba(200,220,255,0.65)",
};

/******** Tether ********/
let tetherPhase = 0;
const TETHER = {
  swayHz: 0.06,       // slower = gentler sway
  wobble: 0.25,       // curve bend intensity
  width: 3.0,         // base line width
  tipRadius: 10,      // glow at the tip
};

function drawTether(cx, cy, t, palette) {
  const ang = t * 0.4;
  const anchorR = 180;
  const ax = cx + Math.cos(ang) * anchorR;
  const ay = cy + Math.sin(ang) * anchorR;

  tetherPhase += TETHER.swayHz;
  const sway = Math.sin(tetherPhase) * TETHER.wobble * anchorR;

  const midx = (ax + cx) * 0.5 + Math.cos(ang + Math.PI / 2) * sway;
  const midy = (ay + cy) * 0.5 + Math.sin(ang + Math.PI / 2) * sway;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const pulse = 0.5 + 0.5 * Math.sin(t * 2.0);
  ctx.strokeStyle = palette.rimMag;
  ctx.lineWidth = TETHER.width * (0.85 + 0.3 * pulse);

  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(midx, midy, cx, cy);
  ctx.stroke();

  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, TETHER.tipRadius);
  grd.addColorStop(0, "rgba(255,255,255,0.45)");
  grd.addColorStop(1, "rgba(255,255,255,0.0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, TETHER.tipRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/******** Nucleus ********/
function drawNucleus(cx, cy, t, palette) {
  const r = 40 + Math.sin(t * 2.0) * 4;

  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
  grd.addColorStop(0.0, palette.nucleus);
  grd.addColorStop(0.5, "rgba(180,220,255,0.25)");
  grd.addColorStop(1.0, "rgba(0,0,0,0)");

  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.nucleus;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/******** Rings ********/
function drawRings(cx, cy, t, palette) {
  ctx.save();
  ctx.strokeStyle = palette.rimAqua;
  ctx.lineWidth = 1.2;

  for (let i = 1; i <= 6; i++) {
    const radius = 90 + i * 30 + Math.sin(t * 0.4 + i) * 5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.globalAlpha = 0.15 + 0.05 * Math.sin(t * 0.6 + i);
    ctx.stroke();
  }
  ctx.restore();
}

/******** Motes ********/
const motes = Array.from({ length: 50 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() * 2,
  s: Math.random() * 0.3 + 0.1,
}));

function drawMotes() {
  ctx.save();
  ctx.fillStyle = PALETTE.motes;
  motes.forEach((m) => {
    const x = m.x * canvas.width + Math.sin(performance.now() * 0.0001 + m.r) * 20;
    const y = m.y * canvas.height + Math.cos(performance.now() * 0.0001 + m.r) * 20;
    ctx.globalAlpha = 0.3 + 0.7 * Math.sin(performance.now() * 0.001 + m.r);
    ctx.beginPath();
    ctx.arc(x, y, m.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

/******** Main Draw ********/
function draw() {
  requestAnimationFrame(draw);
  const t = (performance.now() - t0) / 1000;

  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.55;

  drawMotes();
  drawRings(cx, cy, t, PALETTE);
  drawTether(cx, cy, t, PALETTE);
  drawNucleus(cx, cy, t, PALETTE);
}

/******** Utils ********/
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

/******** Boot ********/
draw();
