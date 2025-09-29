/* THE ORGANISM — Embryo profile (head, torso/spine, limbs, single cord) */
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", {alpha:true});
function resize(){ canvas.width=innerWidth; canvas.height=innerHeight; }
addEventListener("resize", resize); resize();

const TAU = Math.PI*2;
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));

/* Palette */
const P = {
  space:   "#080b12",
  star:    "rgba(210,235,255,.75)",
  hazeA:   "rgba(120,40,160,.12)",
  hazeB:   "rgba(0,140,220,.10)",
  skin:    "rgba(210,230,245,.12)",       // translucent skin fill
  rimA:    "rgba(160,235,255,.9)",        // aqua rim
  rimB:    "rgba(255,120,220,.55)",       // magenta rim
  inner:   "rgba(245,255,255,.22)",
  bone:    "rgba(230,245,255,.35)",
  eyeIris: "rgba(190,220,255,.95)",
  eyePup:  "rgba(10,14,20,.96)",
  eyeSpec: "rgba(255,255,255,.8)",
  cordA:   "rgba(255,185,215,.85)",
  cordB:   "rgba(255,150,200,.30)"
};

/* Stars + curtains */
function stars(t){
  ctx.fillStyle=P.star;
  for(let i=0;i<72;i++){
    const x=(i*179 + Math.sin(t*.11+i*2.7)*99999)%canvas.width;
    const y=(i* 97 + Math.cos(t*.09+i*1.9)*77777)%canvas.height;
    const s=0.35+0.6*Math.max(0,Math.sin(t*1.1+i));
    ctx.globalAlpha=.12+.6*s;
    ctx.fillRect((x+canvas.width)%canvas.width,(y+canvas.height)%canvas.height,1.4,1.4);
  }
  ctx.globalAlpha=1;
}
function curtains(t){
  let x=canvas.width*.82 + Math.sin(t*.12)*18;
  let g=ctx.createLinearGradient(x,0,x-260,canvas.height);
  g.addColorStop(0,P.hazeA); g.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=g; ctx.fillRect(0,0,canvas.width,canvas.height);

  x=canvas.width*.14 + Math.cos(t*.10)*22;
  g=ctx.createLinearGradient(x,0,x+240,canvas.height);
  g.addColorStop(0,P.hazeB); g.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=g; ctx.fillRect(0,0,canvas.width,canvas.height);
}

/* Helpers */
function circle(x,y,r,fill,stroke,w=1){
  if(fill){ ctx.fillStyle=fill; ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.fill(); }
  if(stroke){ ctx.lineWidth=w; ctx.strokeStyle=stroke; ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.stroke(); }
}
function capsule(x1,y1,x2,y2,r){ // for limbs
  const a=Math.atan2(y2-y1,x2-x1);
  ctx.beginPath();
  ctx.arc(x1,y1,r,a+Math.PI/2,a-Math.PI/2,true);
  ctx.arc(x2,y2,r,a-Math.PI/2,a+Math.PI/2,true);
  ctx.closePath();
}

/* Umbilical (single) */
function cord(ax,ay,t,scale){
  const L=340*scale, sway=Math.sin(t*.35)*40*scale;
  const bx=ax-L*.45, by=ay+L*.08 + sway*.35;
  const cx=ax-L*.95, cy=ay-L*.10 + sway;

  ctx.lineCap="round";
  ctx.lineWidth=14*scale; ctx.strokeStyle=P.cordB;
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(bx,by,cx,cy); ctx.stroke();
  ctx.lineWidth=6*scale; ctx.strokeStyle=P.cordA;
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(bx,by,cx,cy); ctx.stroke();

  ctx.fillStyle=P.cordA; circle(ax,ay,5*scale,P.cordA);
}

/* Limb chain with small claw/foot */
function limb(baseX,baseY, seg,len,dir,t,wave,thk,scale,glow){
  let x=baseX,y=baseY,a=dir;
  const pts=[[x,y]];
  for(let i=0;i<seg;i++){
    a+=Math.sin(t*1.2+i*.9)*wave;
    const L=len*(1 - i/seg*.25);
    x+=Math.cos(a)*L; y+=Math.sin(a)*L;
    pts.push([x,y]);
  }
  for(let i=0;i<pts.length-1;i++){
    const [ax,ay]=pts[i],[bx,by]=pts[i+1];
    const r=thk*(1 - i/(pts.length-1)*.45);
    ctx.save(); ctx.shadowColor=glow; ctx.shadowBlur=8*scale;
    ctx.fillStyle=P.skin; ctx.globalAlpha=.95;
    capsule(ax,ay,bx,by,r); ctx.fill(); ctx.restore();
    ctx.globalAlpha=.9; ctx.lineWidth=1.4*scale; ctx.strokeStyle=glow;
    capsule(ax,ay,bx,by,r); ctx.stroke();
  }
  const [hx,hy]=pts.at(-1);
  ctx.globalAlpha=1; ctx.fillStyle="rgba(245,255,255,.95)";
  ctx.beginPath();
  ctx.moveTo(hx,hy);
  ctx.lineTo(hx+3.5*scale, hy+1.2*scale);
  ctx.lineTo(hx+1.2*scale, hy-3.8*scale);
  ctx.closePath(); ctx.fill();
}

/* Ribs hint */
function ribs(cx,cy,baseR,t,scale){
  ctx.strokeStyle=P.bone; ctx.lineWidth=2*scale;
  for(let i=0;i<6;i++){
    const rr=baseR + i*12*scale + 4*scale*Math.sin(t*.9+i*.6);
    ctx.beginPath(); ctx.arc(cx,cy,rr,Math.PI*.15,Math.PI*.85); ctx.stroke();
  }
}

/* Creature profile (facing left, curled) */
function creatureProfile(cx,cy,t,scale){
  const breathe = 1 + 0.08*Math.sin(t*.8);
  const tilt = 0.1*Math.sin(t*.4);

  // Torso (large capsule-ish body)
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(tilt);
  ctx.beginPath();
  ctx.ellipse(0, 8*scale, 150*scale*breathe*.55, 110*scale*breathe*.55, 0, 0, TAU);
  ctx.fillStyle=P.skin; ctx.fill();
  ctx.strokeStyle=P.rimB; ctx.globalAlpha=.6; ctx.lineWidth=2*scale; ctx.stroke();
  ctx.globalAlpha=1;

  // Head (big, forward/left)
  const hx = -120*scale, hy = -20*scale;
  ctx.beginPath(); ctx.ellipse(hx,hy, 86*scale, 74*scale, 0, 0, TAU);
  ctx.fillStyle=P.skin; ctx.fill();
  ctx.strokeStyle=P.rimA; ctx.lineWidth=2*scale; ctx.stroke();

  // Eye (visible on profile—toward viewer)
  const eyeR = 26*scale;
  circle(hx+18*scale, hy-6*scale, eyeR*.65, P.eyeIris);
  circle(hx+18*scale, hy-6*scale, eyeR*.35*(0.6 + 0.4*Math.abs(Math.sin(t*2.4))), P.eyePup);
  ctx.fillStyle=P.eyeSpec;
  ctx.beginPath();
  ctx.ellipse(hx+10*scale, hy-12*scale, eyeR*.22, eyeR*.13, -0.5, 0, TAU);
  ctx.fill();

  // Belly/inner glow
  const g = ctx.createRadialGradient(10*scale,14*scale, 10*scale, 0,0, 170*scale);
  g.addColorStop(0,"rgba(255,255,255,.95)");
  g.addColorStop(1,P.inner);
  ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(0,12*scale, 60*scale, 60*scale, 0, 0, TAU); ctx.fill();

  // Ribs/vertebra arc (reads as body, not a dot)
  ribs(-10*scale, 22*scale, 70*scale, t, scale);

  // Limbs (arms folded, legs tucked)
  const tJ = t*.8;
  limb(-40*scale, 36*scale, 3, 34*scale, Math.PI*0.95, tJ, .18, 12*scale, scale, P.rimA);  // fore arm (near)
  limb(-16*scale, 22*scale, 3, 30*scale, Math.PI*1.10, tJ+.5, .16, 11*scale, scale, P.rimB); // far arm
  limb( 18*scale, 60*scale, 3, 36*scale, Math.PI*1.10, tJ+.2, .14, 13*scale, scale, P.rimA);  // near leg
  limb(-10*scale, 64*scale, 3, 36*scale, Math.PI*1.00, tJ+.9, .14, 13*scale, scale, P.rimB);  // far leg

  // Umbilical attaches low belly
  cord(10*scale, 28*scale, t, scale);

  ctx.restore();
}

/* Echo rings around the organism (soft) */
function echo(cx,cy,scale,t){
  ctx.lineWidth=2*scale;
  for(let i=0;i<7;i++){
    const r=220*scale + i*36*scale + Math.sin(t*.7+i)*6*scale;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,TAU);
    ctx.strokeStyle=`rgba(120,180,220,${0.14 - i*0.012})`;
    ctx.stroke();
  }
}

/* Main loop */
let t0=performance.now();
function draw(){
  const t=(performance.now()-t0)/1000;
  ctx.fillStyle=P.space; ctx.fillRect(0,0,canvas.width,canvas.height);
  curtains(t); stars(t);

  const cx=canvas.width*.54, cy=canvas.height*.62;
  const scale=Math.min(canvas.width,canvas.height)/1000;

  echo(cx,cy,scale,t);
  creatureProfile(cx,cy,t,scale);

  requestAnimationFrame(draw);
}
draw();
