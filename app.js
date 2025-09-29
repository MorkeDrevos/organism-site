/******** Canvas-free SVG animation (creature-first) ********/

const svg       = document.getElementById('organism');
const creature  = svg.getElementById('creature');
const breathGrp = svg.getElementById('breath');
const head      = svg.getElementById('head');
const blinkLid  = svg.getElementById('blinkLid');
const limbs     = {
  armL: svg.getElementById('armL'),
  armR: svg.getElementById('armR'),
  legL: svg.getElementById('legL'),
  legR: svg.getElementById('legR'),
};
const cordPath  = svg.getElementById('cord');
const cordTip   = svg.getElementById('cordTip');

/* center helper */
function setCreatureCenter(x, y){
  creature.setAttribute('transform', `translate(${x}, ${y})`);
}

/* size-aware center (keeps it centered responsively) */
function centerNow(){
  const r = svg.getBoundingClientRect();
  setCreatureCenter(r.width * 0.50, r.height * 0.55);
}
addEventListener('resize', centerNow, {passive:true});
centerNow();

/* Breathing animation via CSS + slight JS modulation */
breathGrp.style.animation = 'breathe 5.5s ease-in-out infinite';

/* Limb sway parameters */
const LIMB = {
  armL: { base: [-60,-20, -40, 10,  -60, 40], amp:  8, speed: 1.4, phase: 0.1 },
  armR: { base: [ 40,-10,  40,10,    60, 40], amp:  8, speed: 1.3, phase: 0.5 },
  legL: { base: [-40, 50, -50,30,   -70, 70], amp: 10, speed: 1.1, phase: 0.3 },
  legR: { base: [ 30, 52,  50,30,    70, 70], amp: 10, speed: 1.0, phase: 0.7 },
};

/* Umbilical control points (relative to creature center) */
const CORD = {
  start: { x: -8,  y: 20 },    // attach point under belly
  c1:    { x: -60, y: 30 },
  c2:    { x: -140,y: 40 },
  end:   { x: -190,y: 18 },
  amp:   16,
  speed: .8
};

/* Eye blink (scale the lid vertically) */
let nextBlinkAt = performance.now() + 1500 + Math.random()*2500;
function maybeBlink(now){
  if (now > nextBlinkAt){
    blinkLid.style.transition = 'transform 120ms ease';
    blinkLid.style.transform  = 'scale(1,1)';
    setTimeout(()=> {
      blinkLid.style.transform = 'scale(1,0.05)';
    }, 120);
    nextBlinkAt = now + 1400 + Math.random()*2600;
  }
}

/* Animate loop */
function loop(nowMS){
  const t = nowMS/1000;

  // limb sway
  for(const [id, cfg] of Object.entries(LIMB)){
    const [mx,my, qx,qy, ex,ey] = cfg.base;
    const sway = Math.sin(t*cfg.speed + cfg.phase) * cfg.amp;
    // Slight curvature variation with sway
    const d = `M ${mx},${my} q ${qx+sway},${qy} ${ex},${ey}`;
    limbs[id].setAttribute('d', d);
  }

  // umbilical wobble
  const wob = Math.sin(t*CORD.speed) * CORD.amp;
  const p0x = CORD.start.x, p0y = CORD.start.y;
  const p1x = CORD.c1.x,    p1y = CORD.c1.y + wob*0.6;
  const p2x = CORD.c2.x,    p2y = CORD.c2.y - wob*0.3;
  const p3x = CORD.end.x,   p3y = CORD.end.y + wob*0.1;
  const dCord = `M ${p0x},${p0y} C ${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`;
  cordPath.setAttribute('d', dCord);
  cordTip.setAttribute('cx', p3x);
  cordTip.setAttribute('cy', p3y);

  // tiny head drift (feels more alive)
  const headDx = Math.sin(t*0.8)*1.8;
  const headDy = Math.cos(t*0.9)*1.2;
  head.setAttribute('transform', `translate(${50+headDx}, ${-80+headDy})`);

  // occasional blink
  maybeBlink(nowMS);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
