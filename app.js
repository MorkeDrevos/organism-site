/******** Canvas bootstrap ********/
const canvas = document.getElementById('org-canvas');
const ctx = canvas.getContext('2d', { alpha: true });
let DPR = Math.min(2, window.devicePixelRatio||1);

function resize(){
  const w = canvas.clientWidth  || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  canvas.width  = Math.floor(w * DPR);
  canvas.height = Math.floor(h * DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
addEventListener('resize', resize, {passive:true});
resize();

/******** Time ********/
let t0 = performance.now();
const time = ()=> (performance.now()-t0)/1000;

/******** Palette ********/
const PAL = {
  space1:'#0a1020', space2:'#060913',
  curtainA:'rgba(200,40,200,.09)', curtainB:'rgba(40,200,255,.07)',
  mote:'rgba(220,230,255,.55)',
  skin:'rgba(230,236,246,.16)', rim:'rgba(150,210,255,.20)',
  head:'#eef6ff', iris:'rgba(120,180,255,.85)', pupil:'#0b0f18',
  cord:'rgba(255,150,210,.95)', cordGlow:'rgba(255,140,220,.28)',
  ring:'rgba(120,180,220,.18)'
};

/******** Stars / motes ********/
const RND=(a,b)=>a+Math.random()*(b-a);
const MOTES = Array.from({length:80},()=>({x:Math.random(),y:Math.random(),z:RND(.4,1.2),d:RND(-.02,.02)}));

/******** Background ********/
function bg(t){
  const w=canvas.width/DPR, h=canvas.height/DPR;

  // deep gradient
  const g = ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,PAL.space1); g.addColorStop(1,PAL.space2);
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);

  // nebula curtains
  ctx.save(); ctx.globalCompositeOperation='screen'; ctx.filter='blur(30px)';
  ctx.fillStyle=PAL.curtainA; ctx.beginPath(); ctx.ellipse(w*.2,h*.3,w*.5,h*.5,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=PAL.curtainB; ctx.beginPath(); ctx.ellipse(w*.85,h*.75,w*.6,h*.5,0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // motes
  for(const m of MOTES){
    m.x += (0.0006 + m.d*0.2); if(m.x>1){m.x=0;m.y=Math.random();}
    const x=w*m.x, y=h*m.y, r=(m.z*.7+.3)*(1+.25*Math.sin(t*.8+m.x*17));
    ctx.fillStyle=PAL.mote; ctx.fillRect(x,y,r,r);
  }
}

/******** Echo rings ********/
function echo(cx,cy,scale,t){
  ctx.save(); ctx.lineWidth=.8*scale;
  for(let i=0;i<7;i++){
    const r=(110+i*28)*scale*(1+.01*Math.sin(t*.7+i));
    ctx.strokeStyle=PAL.ring; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

/******** Embryo silhouette (head, torso, limb buds, cord) ********/
function drawEmbryo(cx,cy,scale,t){
  const breathe = 1 + .06*Math.sin(t*.9);
  const pulse   = (0.5+0.5*Math.sin(t*1.2))**2;

  // proportions (responsive)
  const headR = 50*scale*breathe;
  const torsoW= 86*scale, torsoH=60*scale;
  const limb  = 50*scale;

  ctx.save();

  // soft halo
  const halo=ctx.createRadialGradient(cx,cy,6*scale,cx,cy,150*scale);
  halo.addColorStop(0,`rgba(200,220,255,${.16+.12*pulse})`);
  halo.addColorStop(1,'transparent');
  ctx.fillStyle=halo; ctx.beginPath(); ctx.arc(cx,cy,150*scale,0,Math.PI*2); ctx.fill();

  // torso
  ctx.fillStyle=PAL.skin; ctx.strokeStyle=`rgba(160,210,255,${.18+.18*pulse})`; ctx.lineWidth=2*scale;
  ctx.beginPath(); ctx.ellipse(cx,cy+8*scale,torsoW,torsoH,0.18,0,Math.PI*2); ctx.fill(); ctx.stroke();

  // ribs hints
  ctx.strokeStyle='rgba(200,220,255,.10)'; ctx.lineWidth=1.2*scale;
  for(let i=0;i<6;i++){
    ctx.beginPath();
    ctx.ellipse(cx-6*scale, cy+10*scale+i*6*scale, torsoW*.75, torsoH*.45, -0.25, .1*Math.PI, .9*Math.PI);
    ctx.stroke();
  }

  // head + rim
  ctx.beginPath(); ctx.arc(cx+headR*.15, cy-headR*.35, headR, 0, Math.PI*2);
  ctx.fillStyle=PAL.head; ctx.fill();
  ctx.strokeStyle=`rgba(120,200,255,${.25+.2*pulse})`; ctx.lineWidth=3*scale; ctx.stroke();

  // iris/pupil + blink
  const eyeX=cx+headR*.22, eyeY=cy-headR*.37 + headR*.04*Math.sin(t*2.4);
  const blink = (Math.sin(t*3.4+0.6) > .92)? .12 : 1;
  ctx.fillStyle=PAL.iris; ctx.beginPath(); ctx.arc(eyeX,eyeY,9*scale*blink,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=PAL.pupil; ctx.beginPath(); ctx.arc(eyeX,eyeY,4.4*scale*blink,0,Math.PI*2); ctx.fill();

  // limb buds (arcs that sway)
  ctx.strokeStyle=`rgba(255,160,240,${.28+.12*pulse})`; ctx.lineWidth=3*scale;
  const bud=(ax,ay,len,rot,phase)=>{
    ctx.save(); ctx.translate(ax,ay); ctx.rotate(rot + .25*Math.sin(t*1.3+phase));
    ctx.beginPath(); ctx.arc(0,0,len,.1*Math.PI,.85*Math.PI); ctx.stroke(); ctx.restore();
  };
  bud(cx-18*scale, cy- 6*scale, limb*.68, -0.7, 0.1); // left arm
  bud(cx+16*scale, cy- 4*scale, limb*.62,  0.8, 0.3); // right arm
  bud(cx-12*scale, cy+28*scale, limb*.74, -0.9, 0.6); // left leg
  bud(cx+14*scale, cy+26*scale, limb*.70,  0.9, 0.9); // right leg

  // umbilical cord (single)
  const ph=t*.8, tail=160*scale;
  const endX=cx-tail*.9, endY=cy+22*scale + 12*scale*Math.sin(ph);
  const c1x=cx-40*scale, c1y=cy+10*scale + 18*scale*Math.sin(ph*1.2);
  const c2x=cx-96*scale, c2y=cy+28*scale + 12*scale*Math.cos(ph*.9);
  ctx.lineCap='round'; ctx.shadowBlur=12*scale; ctx.shadowColor=PAL.cordGlow;
  ctx.strokeStyle=PAL.cord; ctx.lineWidth=5.2*scale;
  ctx.beginPath(); ctx.moveTo(cx-6*scale, cy+20*scale);
  ctx.bezierCurveTo(c1x,c1y, c2x,c2y, endX,endY); ctx.stroke();
  ctx.shadowBlur=0;
  ctx.fillStyle=PAL.cordGlow; ctx.beginPath(); ctx.arc(endX,endY,6*scale*(.8+.3*pulse),0,Math.PI*2); ctx.fill();

  ctx.restore();
}

/******** Main loop ********/
function draw(){
  const t = time();
  const cx = canvas.width/DPR * .50;
  const cy = canvas.height/DPR * .56;
  const scale = Math.min(canvas.width,canvas.height)/DPR / 900; // responsive

  bg(t);
  echo(cx,cy,scale,t);
  drawEmbryo(cx,cy,scale,t);

  requestAnimationFrame(draw);
}
draw();
