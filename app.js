const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// --- Animation state ---
let t = 0;
const motes = Array.from({ length: 40 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: 1 + Math.random() * 2,
  dx: (Math.random() - 0.5) * 0.2,
  dy: (Math.random() - 0.5) * 0.2
}));

// Umbilical tether curve control points
const tether = {
  x1: canvas.width / 2,
  y1: canvas.height / 2,
  x2: canvas.width / 2 + 200,
  y2: canvas.height / 2 + 100,
};

function drawOrganism() {
  t += 0.01;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  // === Fluid haze background ===
  const g = ctx.createRadialGradient(cx, cy, 50, cx, cy, canvas.width / 1.5);
  g.addColorStop(0, "rgba(80, 0, 40, 0.4)");   // reddish
  g.addColorStop(1, "rgba(0, 0, 0, 0.9)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // === Ripple distortion rings ===
  for (let i = 1; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(
      cx + Math.sin(t * 0.5) * 10,
      cy + Math.cos(t * 0.3) * 10,
      i * 60 + Math.sin(t + i) * 5,
      0,
      Math.PI * 2
    );
    ctx.strokeStyle = `rgba(120, 150, 255, 0.05)`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // === Umbilical cord (Bezier curve) ===
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(
    cx + Math.sin(t) * 50,
    cy + Math.cos(t * 0.8) * 50,
    tether.x2 + Math.sin(t * 0.6) * 30,
    tether.y2 + Math.cos(t * 0.7) * 30,
    tether.x2,
    tether.y2
  );
  ctx.strokeStyle = "rgba(255, 150, 150, 0.4)";
  ctx.lineWidth = 6;
  ctx.stroke();

  // === Nucleus (the creature) ===
  const nucleusPulse = 40 + Math.sin(t * 2.3) * 6;
  ctx.beginPath();
  ctx.arc(cx, cy, nucleusPulse, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(80,160,255,0.6)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, nucleusPulse * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(120,200,255,0.9)";
  ctx.fill();

  // === Motes floating ===
  for (let m of motes) {
    m.x += m.dx;
    m.y += m.dy;

    if (m.x < 0) m.x = canvas.width;
    if (m.y < 0) m.y = canvas.height;
    if (m.x > canvas.width) m.x = 0;
    if (m.y > canvas.height) m.y = 0;

    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(200,200,255,0.2)";
    ctx.fill();
  }

  requestAnimationFrame(drawOrganism);
}
drawOrganism();
