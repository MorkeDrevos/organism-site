/******** Canvas bootstrap ********/
const canvas = document.getElementById('org-canvas');
const ctx     = canvas.getContext('2d', { alpha: true });
let DPR = Math.min(2, window.devicePixelRatio || 1);

function resize(){
  const w = canvas.clientWidth  || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  canvas.width  = Math.floor(w * DPR);
  canvas.height = Math.floor(h * DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
addEventListener('resize', resize, { passive: true });
resize();

/******** Time helper ********/
let t0 = performance.now();
const now = () => (performance.now() - t0) / 1000;

/******** Palette ********/
const PAL = {
  space1 : '#0a1020',
  space2 : '#050913',
  vignA  : 'rgba(255, 60, 180, 0.10)',  // faint magenta curtains
  vignB  : 'rgba( 20,190,255, 0.08)',   // faint aqua curtains
  nucleus: 'rgba(230,240,255,0.95)',
  rimA   : 'rgba(160,220,255,0.14)',
  rimB   : 'rgba(255,160,245,0.14)',
  skin   : 'rgba(220,225,235,0.18)',
  cord   : 'rgba(255,160,200,0.9)',
  cordGlow: 'rgba(255,160,220,0.25)',
  eye    : '#0b0f18',
  iris   : 'rgba(130,180,255,0.8)',
  rings  : 'rgba(120,180,220,0.18)',
  mote   : 'rgba(220,230,255,0.55)'
};

/******** Scene bits ********/
const RNG = (a,b)=> a + Math.random()*(b-a);
const MOTES = Array.from({length: 80}, ()=>({
  x: Math.random(), y: Math.random(), z: RNG(0.2, 1.2), d:RNG(-0.02,0.02)
}));

/******** Background ********/
function drawBackground(time){
  const { width:w, height:h } = canvas;

  // deep space
  const g = ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0, PAL.space1);
  g.addColorStop(1, PAL.space2);
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);

  // nebula curtains
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = 'blur(30px)';
  ctx.fillStyle = PAL.vignA;
  ctx.beginPath(); ctx.ellipse(w*0.2, h*0.3, w*0.35, h*0.45, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = PAL.vignB;
  ctx.beginPath(); ctx.ellipse(w*0.85, h*0.65, w*0.55, h*0.45, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // stars/motes
  for(const m of MOTES){
    m.x += (0.0006 + m.d*0.2);
    if(m.x>1) m.x=0, m.y=Math.random();
    const x = w*m.x, y = h*m.y;
    const r = (m.z*0.7 + 0.3) * (1 + 0.25*Math.sin(time*0.8 + m.x*17));
    ctx.fillStyle = PAL.mote;
    ctx.fillRect(x, y, r, r);
  }
}

/******** Echo rings ********/
function echo(cx, cy, scale, t){
  ctx.save();
  ctx.lineWidth = 0.8*scale;
  const n = 7;
  for(let i=0;i<n;i++){
    const r = (110 + i*28)*scale * (1 + 0.01*Math.sin(t*0.7 + i));
    ctx.strokeStyle = PAL.rings;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

/******** The organism (embryo silhouette) ********/
/* proportions in "design units" then scaled */
function drawEmbryo(cx, cy, scale, t){
  const breathe = 1 + 0.05*Math.sin(t*0.9);
  const pulse   = (0.5 + 0.5*Math.sin(t*1.2))**2;

  const head   = 52 * scale * breathe;
  const torsoW = 78 * scale;
  const torsoH = 54 * scale;
  const limb   = 44 * scale;

  ctx.save();

  // soft halo
  const halo = ctx.createRadialGradient(cx, cy, 6*scale, cx, cy, 140*scale);
  halo.addColorStop(0, `rgba(200,220,255,${0.18+0.12*pulse})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(cx, cy, 140*scale, 0, Math.PI*2); ctx.fill();

  // torso (ellipse)
  ctx.fillStyle = PAL.skin;
  ctx.strokeStyle = `rgba(180,220,255,${0.15+0.2*pulse})`;
  ctx.lineWidth = 2*scale;
  ctx.beginPath();
  ctx.ellipse(cx, cy+8*scale, torsoW, torsoH, 0.2, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();

  // head (big circle) with rim
  ctx.beginPath(); ctx.arc(cx+head*0.15, cy- head*0.35, head, 0, Math.PI*2);
  ctx.fillStyle = PAL.nucleus; ctx.fill();
  ctx.strokeStyle = `rgba(120,200,255,${0.25+0.2*pulse})`;
  ctx.lineWidth = 3*scale; ctx.stroke();

  // iris + pupil + blink
  const eyeX = cx + head*0.22;
  const eyeY = cy - head*0.35 + head*0.02*Math.sin(t*2.4);
  const blink = (Math.sin(t*3.7 + 0.7) > 0.92) ? 0.12 : 1; // quick blink
  ctx.fillStyle = PAL.iris; ctx.beginPath(); ctx.arc(eyeX, eyeY, 9*scale*blink, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = PAL.eye;  ctx.beginPath(); ctx.arc(eyeX, eyeY, 4.5*scale*blink, 0, Math.PI*2); ctx.fill();

  // soft ribs hint
  ctx.strokeStyle = `rgba(200,220,255,0.10)`;
  ctx.lineWidth = 1.2*scale;
  for(let i=0;i<6;i++){
    ctx.beginPath();
    ctx.ellipse(cx-6*scale, cy+10*scale + i*6*scale, torsoW*0.75, torsoH*0.45, -0.25, Math.PI*0.1, Math.PI*0.9);
    ctx.stroke();
  }

  // limb buds (2 arms, 2 legs) — arcs that breathe
  ctx.strokeStyle = `rgba(255,160,240,${0.28+0.12*pulse})`;
  ctx.lineWidth = 3*scale;
  function bud(ax, ay, len, rot){
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(rot + 0.2*Math.sin(t*1.3 + ax*0.01));
    ctx.beginPath(); ctx.arc(0,0, len, Math.PI*0.1, Math.PI*0.85); ctx.stroke();
    ctx.restore();
  }
  // shoulders/hips approximate anchors
  bud(cx-18*scale, cy- 4*scale, limb*0.70, -0.6); // left arm
  bud(cx+16*scale, cy- 2*scale, limb*0.60,  0.8); // right arm
  bud(cx-10*scale, cy+26*scale, limb*0.75, -0.9); // left leg
  bud(cx+14*scale, cy+24*scale, limb*0.68,  0.9); // right leg

  // umbilical cord (bezier) with glow
  const cordPhase = t*0.8;
  const tail = 140*scale;
  const endX = cx - tail*0.9;
  const endY = cy + 22*scale + 10*scale*Math.sin(cordPhase);
  const c1x = cx - 40*scale, c1y = cy + 10*scale + 16*scale*Math.sin(cordPhase*1.2);
  const c2x = cx - 90*scale, c2y = cy + 28*scale + 10*scale*Math.cos(cordPhase*0.9);

  ctx.lineCap='round';
  ctx.shadowBlur = 12*scale; ctx.shadowColor = PAL.cordGlow;
  ctx.strokeStyle = PAL.cord; ctx.lineWidth = 5.2*scale;
  ctx.beginPath(); ctx.moveTo(cx-6*scale, cy+20*scale);
  ctx.bezierCurveTo(c1x,c1y, c2x,c2y, endX, endY); ctx.stroke();
  ctx.shadowBlur = 0;

  // tip glow
  ctx.fillStyle = PAL.cordGlow;
  ctx.beginPath(); ctx.arc(endX, endY, 6*scale*(0.8+0.3*pulse), 0, Math.PI*2); ctx.fill();

  ctx.restore();
}

/******** Main loop ********/
function draw(){
  const t = now();

  drawBackground(t);

  const cx = canvas.width  * 0.50 / DPR;
  const cy = canvas.height * 0.56 / DPR;
  const scale = Math.min(canvas.width, canvas.height) / DPR / 900; // responsive

  echo(cx, cy, scale, t);
  drawEmbryo(cx, cy, scale, t);

  requestAnimationFrame(draw);
}
draw();
