/************ Canvas bootstrap ************/
const canvas = document.getElementById('org-canvas');
const ctx = canvas.getContext('2d', { alpha: true });
let DPR = Math.min(2, window.devicePixelRatio || 1);

function resize() {
  const w = canvas.clientWidth = window.innerWidth;
  const h = canvas.clientHeight = window.innerHeight;
  canvas.width  = Math.floor(w * DPR);
  canvas.height = Math.floor(h * DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
addEventListener('resize', resize, { passive:true });
resize();

/************ Time ************/
let t0 = performance.now();
function now() { return (performance.now() - t0)/1000; } // seconds

/************ Palette ************/
const PAL = {
  space1: '#070b14',
  vignette: 'rgba(0,0,0,0.6)',
  star: 'rgba(255,255,255,0.8)',
  aqua: '#8de9ff',
  aquaSoft: 'rgba(141,233,255,.35)',
  mag: '#ff6ad5',
  magSoft: 'rgba(255,106,213,.35)',
  belly: 'rgba(220,235,255,0.08)',
  skin: 'rgba(255,210,220,0.16)',
  cord: '#ffb49a',
  eye: '#0b0f18',
  glow: 'rgba(200,230,255,0.25)'
};

/************ Scene helpers ************/
const RND = (min, max) => min + Math.random()*(max-min);
const clamp = (v, lo=0, hi=1) => Math.max(lo, Math.min(hi, v));
const TAU = Math.PI*2;

/************ Stars (parallax layers) ************/
const starsA = Array.from({length: 90}, () => ({
  x: Math.random(), y: Math.random(), s: Math.random()*1.2 + .2, a: Math.random()*.6+.2
}));
const starsB = Array.from({length: 60}, () => ({
  x: Math.random(), y: Math.random(), s: Math.random()*2 + .5, a: Math.random()*.35+.1
}));
function stars(dt){
  // slow drift to feel like fluid-space
  const px = Math.sin(dt*0.03)*0.03, py = Math.cos(dt*0.025)*0.03;
  ctx.save();
  for(const L of [starsA, starsB]){
    for(const st of L){
      const x = (st.x + px) * canvas.width/DPR;
      const y = (st.y + py) * canvas.height/DPR;
      ctx.globalAlpha = st.a;
      ctx.fillStyle = PAL.star;
      ctx.fillRect(x, y, st.s, st.s);
    }
  }
  ctx.restore();
}

/************ Creature state (procedural) ************/
const STATE = {
  // “health” affects breath amplitude + cord glow; “mut” grows limbs slowly
  health: 0.65,
  mut: 0.18,

  // internal motion
  breathHz: 0.08,           // 0.08 Hz (slow)
  blinkEvery: 6,            // seconds
  cordNoise: 0,             // updated each frame
};

// Nudge health/mutation very gently to keep it alive-looking
setInterval(() => {
  const drift = (Math.random()-0.5)*0.04;
  STATE.health = clamp(STATE.health + drift, 0.2, 0.95);
  STATE.mut = clamp(STATE.mut + (Math.random()-0.5)*0.03, 0, 1);
}, 4000);

/************ Drawing primitives ************/
function fillRing(x,y,r, w, color){
  ctx.beginPath();
  ctx.arc(x,y,r,0,TAU);
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function blobPath(points){ // smooth body outline by curve through points
  ctx.beginPath();
  for (let i=0;i<points.length;i++){
    const p = points[i], n = points[(i+1)%points.length];
    const mx = (p.x+n.x)/2, my = (p.y+n.y)/2;
    if(i===0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(p.x,p.y,mx,my);
  }
  ctx.closePath();
}

/************ Embryo silhouette (head+torso+limb buds) ************/
function drawEmbryo(cx, cy, scale, t){
  const breath = (Math.sin(t*TAU*STATE.breathHz)*0.5+0.5); // 0..1
  const inflate = 1 + breath*0.06*STATE.health;            // subtle

  // proportions (tweak for style)
  const headR   = 54 * scale * inflate;
  const torsoR  = 44 * scale;
  const curl    = 36 * scale * (0.8 + STATE.mut*0.5);      // spine curl
  const lean    = Math.sin(t*0.2)*8*scale;                 // slow sway

  // anchor spine path (three control points)
  const spine = [
    {x: cx - 0.5*torsoR + lean, y: cy - 0.2*torsoR - curl},
    {x: cx + 0.1*torsoR + lean, y: cy + 0.1*torsoR - curl*0.2},
    {x: cx + 0.3*torsoR + lean, y: cy + 0.5*torsoR}
  ];

  // head center sits at first spine point
  const hx = spine[0].x, hy = spine[0].y;
  // belly base at last spine point
  const bx = spine[2].x, by = spine[2].y;

  // === soft aura behind creature
  const grd = ctx.createRadialGradient(cx, cy, 10, cx, cy, 420*scale);
  grd.addColorStop(0, 'rgba(30,40,70,0.25)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0,0,canvas.width/DPR,canvas.height/DPR);

  // === body outline points (bean-like)
  const pts = [];
  const steps = 16;
  for(let i=0;i<steps;i++){
    const a = i/steps*TAU;
    // base bean radius with slight directional squash
    const baseR = (i < steps*0.55 ? headR*1.05 : torsoR*1.05);
    const wob = Math.sin(a*4 + t*1.2)*2*scale;
    const r = baseR + wob;
    const ox = Math.cos(a)*r;
    const oy = Math.sin(a)*r;
    // pull lower half toward belly to form torso taper
    const pull = (Math.sin(a+Math.PI/2)+1)/2; // 0..1 on lower side
    const px = (i < steps*0.55 ? hx : cx+lean) + ox* (i < steps*0.55 ? 1 : 0.85) + (bx-cx)*0.05*pull;
    const py = (i < steps*0.55 ? hy : cy)      + oy* (i < steps*0.55 ? 1 : 0.95) + (by-cy)*0.08*pull;
    pts.push({x:px, y:py});
  }

  // === fill body (soft translucent skin)
  ctx.save();
  blobPath(pts);
  ctx.fillStyle = PAL.skin;
  ctx.fill();

  // inner belly glow
  const belly = ctx.createRadialGradient(bx,by,4*scale, bx,by, 120*scale);
  belly.addColorStop(0, 'rgba(255,240,250,0.28)');
  belly.addColorStop(1, 'rgba(255,240,250,0)');
  ctx.fillStyle = belly;
  ctx.fill();

  // rim lights (aqua/magenta alternating)
  ctx.lineWidth = 2.5*scale;
  ctx.strokeStyle = PAL.aquaSoft;
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 1.5*scale;
  ctx.strokeStyle = PAL.magSoft;
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';

  // === eye (feels sentient)
  const eyeOpen = ( (t % STATE.blinkEvery) < 0.12 ) ? 0.2 : 1.0; // quick blink
  ctx.beginPath(); ctx.arc(hx+2*scale, hy+4*scale, 8*scale*eyeOpen, 0, TAU);
  ctx.fillStyle = PAL.eye; ctx.fill();
  ctx.beginPath(); ctx.arc(hx+2*scale, hy+4*scale, 2.5*scale*eyeOpen, 0, TAU);
  ctx.fillStyle = 'white'; ctx.fill();

  // === ribs / vertebra hint (curved arc)
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 1*scale;
  ctx.strokeStyle = 'rgba(180,210,255,0.5)';
  ctx.beginPath();
  ctx.arc(cx+lean*0.6, cy+torsoR*0.15, torsoR*0.9, 0.7*Math.PI, 1.7*Math.PI);
  ctx.stroke();
  ctx.restore();

  // === umbilical (single, organic)
  drawCord(bx, by, scale, t);

  // === limb buds (scale with mutation)
  const M = STATE.mut;           // 0..1
  const budR = (10+18*M)*scale;
  const budAlpha = 0.25 + 0.45*M;

  ctx.fillStyle = `rgba(200,230,255,${budAlpha})`;
  // arms (near middle)
  ellipse(bx - torsoR*0.35, by - torsoR*0.15, budR*1.1, budR*0.7, 0.35);
  // legs (lower)
  ellipse(bx - torsoR*0.15, by + torsoR*0.25, budR*1.2, budR*0.75, -0.2);
  // tiny fingertips/toe nubs as points when M grows
  if (M > 0.5){
    nub(bx - torsoR*0.45, by - torsoR*0.10, 3.5*scale);
    nub(bx - torsoR*0.40, by - torsoR*0.02, 3*scale);
    nub(bx - torsoR*0.10, by + torsoR*0.36, 3.5*scale);
  }
}

function ellipse(cx, cy, rx, ry, tilt){
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(tilt);
  ctx.beginPath();
  ctx.ellipse(0,0,rx,ry,0,0,TAU);
  ctx.fill();
  ctx.restore();
}
function nub(x,y,r){
  ctx.beginPath(); ctx.arc(x,y,r,0,TAU);
  ctx.fill();
}

/************ Cord ************/
function drawCord(x, y, scale, t){
  // end point drifts like fluid
  STATE.cordNoise += 0.008;
  const sway = Math.sin(t*0.9 + STATE.cordNoise*2.0)*30*scale;
  const tipx = x - 140*scale + sway;
  const tipy = y - 30*scale + Math.cos(t*0.7)*16*scale;

  const c1x = x - 40*scale, c1y = y - 10*scale;
  const c2x = x - 90*scale + sway*0.5, c2y = y - 40*scale;

  // tube
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 10*scale;
  ctx.strokeStyle = 'rgba(255,190,170,0.35)';
  ctx.beginPath();
  ctx.moveTo(x,y);
  ctx.bezierCurveTo(c1x,c1y, c2x,c2y, tipx, tipy);
  ctx.stroke();

  // highlight
  ctx.lineWidth = 5.5*scale;
  ctx.strokeStyle = 'rgba(255,210,200,0.35)';
  ctx.stroke();

  // tip glow
  ctx.globalCompositeOperation='lighter';
  ctx.lineWidth = 2.5*scale;
  ctx.strokeStyle = STATE.health>0.55 ? PAL.aquaSoft : PAL.magSoft;
  ctx.stroke();
  ctx.globalCompositeOperation='source-over';
  ctx.restore();
}

/************ Echo rings behind creature ************/
function echo(cx, cy, scale, t){
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 1;
  const rings = 7;
  for(let i=0;i<rings;i++){
    const r = (80 + i*32) * scale;
    const hue = i%2 ? PAL.aquaSoft : PAL.magSoft;
    ctx.strokeStyle = hue;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/************ Background curtains ************/
function curtains(t){
  const w = canvas.width/DPR, h = canvas.height/DPR;
  const grad = ctx.createLinearGradient(0,0,w,0);
  grad.addColorStop(0, 'rgba(30,0,40,0.10)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,20,60,0.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,w,h);
}

/************ Creature profile wrapper (choose center & scale) ************/
function creatureProfile(cx, cy, scale, t){
  // orbit a tiny bit to feel alive
  const ox = Math.sin(t*0.15)*14*scale;
  const oy = Math.cos(t*0.18)*10*scale;

  echo(cx+ox, cy+oy, scale, t);
  drawEmbryo(cx+ox, cy+oy, scale, t);
}

/************ Main loop ************/
function draw(){
  requestAnimationFrame(draw);
  const t = now();

  // background
  const w = canvas.width/DPR, h = canvas.height/DPR;
  ctx.fillStyle = PAL.space1;
  ctx.fillRect(0,0,w,h);

  curtains(t);
  stars(t);

  // center/scale
  const cx = canvas.width/(2*DPR);
  const cy = canvas.height/(2*DPR) + 20;
  const scale = Math.min(canvas.width, canvas.height)/(1200*DPR); // responsive

  creatureProfile(cx, cy, Math.max(0.8, scale), t);
}
draw();
