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
let pulseSize = 40; // base nucleus radius
let feedBoost = 0;  // grows when fed
let starveDrain = 0; // shrinks when starving

// drifting particles
const motes = Array.from({ length: 20 }, () => ({
  x: Math.random() * window.innerWidth,
  y: Math.random() * window.innerHeight,
  r: 1 + Math.random() * 2,
  dx: (Math.random() - 0.5) * 0.15,
  dy: (Math.random() - 0.5) * 0.15,
  driftPhase: Math.random() * Math.PI * 2
}));

function drawOrganism() {
  t += 0.01;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // amniotic fluid gradient overlay
  const g = ctx.createRadialGradient(
    canvas.width/2, canvas.height/2, 50,
    canvas.width/2, canvas.height/2, canvas.width/1.2
  );
  g.addColorStop(0, "rgba(0, 80, 120, 0.20)");
  g.addColorStop(0.6, "rgba(0, 40, 70, 0.15)");
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // ripple distortion rings
  ctx.strokeStyle = "rgba(0,150,200,0.08)";
  ctx.lineWidth = 1.5;
  for (let i=0;i<8;i++) {
    const wobble = Math.sin(t*0.9 + i*0.6) * 8;
    const r = 120 + i*40 + wobble;
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2, r, 0, Math.PI*2);
    ctx.stroke();
  }

  // nucleus pulse (with feed/starve influence)
  const pulse = pulseSize 
              + Math.sin(t*2.1) * 6 
              + Math.sin(t*0.37) * 3
              + feedBoost
              - starveDrain;

  ctx.beginPath();
  ctx.fillStyle = "rgba(0,180,255,0.7)";
  ctx.shadowBlur = 40;
  ctx.shadowColor = "rgba(0,200,255,0.9)";
  ctx.arc(canvas.width/2, canvas.height/2, pulse, 0, Math.PI*2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // motes drifting (irregular)
  ctx.fillStyle = "rgba(200,255,255,0.5)";
  motes.forEach(m => {
    m.driftPhase += 0.01 + Math.random()*0.003;
    m.x += m.dx + Math.sin(t*0.5 + m.driftPhase) * 0.3;
    m.y += m.dy + Math.cos(t*0.7 + m.driftPhase) * 0.3;

    if (m.x<0) m.x=canvas.width;
    if (m.x>canvas.width) m.x=0;
    if (m.y<0) m.y=canvas.height;
    if (m.y>canvas.height) m.y=0;

    ctx.beginPath();
    ctx.arc(m.x,m.y,m.r,0,Math.PI*2);
    ctx.fill();
  });

  // decay feed/starve effects slowly
  feedBoost *= 0.97;
  starveDrain *= 0.97;

  requestAnimationFrame(drawOrganism);
}
drawOrganism();

// --- Button interactions ---
document.getElementById("feedBtn").addEventListener("click", () => {
  feedBoost += 10; // big pulse when fed
});
document.getElementById("sfxBtn").addEventListener("click", () => {
  starveDrain += 6; // shrink when starving
});
