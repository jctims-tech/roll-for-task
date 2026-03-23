import { useState, useRef, useEffect, useCallback } from "react";
import * as THREE from "three";

const GOLD = "#FFD700";
const GOLD_DIM = "#c8a000";
const C = {
  bg:"#0d0b1e", card:"#1a1830", must:GOLD, mustLight:"rgba(255,215,0,0.1)",
  fun:"#a87aff", funLight:"rgba(168,122,255,0.12)", accent:GOLD, blue:"#7eb8f7",
  purple:"#c77dff", text:"#ffffff", textDim:"#c8bfff", soft:"#8080a0",
  felt:"#12122e", feltDark:"#0a0a1e", feltBorder:"#3a3a7e",
};
const CONFETTI_COLORS = [GOLD,"#c77dff","#7eb8f7","#a87aff","#f7c948","#e87dff"];
const BREAK_MODES = {
  grind:    { label:"🔥 Grind",    desc:"Rare breaks",    basePct:0.12 },
  chaos:    { label:"🌀 Chaos",    desc:"Truly random",   basePct:null },
  balanced: { label:"🌿 Balanced", desc:"Regular breaks", basePct:0.28 },
};

function getFunChance(mode) {
  if (mode === "chaos") return Math.random() * 0.45 + 0.05;
  return BREAK_MODES[mode].basePct + (Math.random() * 0.08 - 0.04);
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      o.start(t); o.stop(t + 0.7);
    });
  } catch(e) {}
}

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap');
  * { box-sizing: border-box; }
  @keyframes fall    { to { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
  @keyframes pop     { 0%{transform:scale(0.85);opacity:0} 60%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
  @keyframes fadeUp  { 0%{transform:translateY(24px);opacity:0} 100%{transform:translateY(0);opacity:1} }
  @keyframes pulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
  @keyframes dieWiggle {
    0%   { transform: rotate(0deg)   scale(1);    }
    10%  { transform: rotate(-18deg) scale(1.08); }
    25%  { transform: rotate(22deg)  scale(0.95); }
    40%  { transform: rotate(-15deg) scale(1.06); }
    55%  { transform: rotate(18deg)  scale(0.97); }
    70%  { transform: rotate(-10deg) scale(1.04); }
    83%  { transform: rotate(8deg)   scale(0.99); }
    92%  { transform: rotate(-4deg)  scale(1.01); }
    100% { transform: rotate(0deg)   scale(1);    }
  }
  @keyframes dieLand {
    0%   { transform: scale(1.12); }
    50%  { transform: scale(0.94); }
    100% { transform: scale(1);    }
  }
  input:focus { outline:none; border-color:#FFD700!important; box-shadow:0 0 0 3px rgba(255,215,0,0.2)!important; }
  input::placeholder { color:#606080; }
  button:hover:not(:disabled) { transform:translateY(-1px); filter:brightness(1.1); }
  button:active:not(:disabled) { transform:translateY(1px); }
  button:disabled { opacity:0.35; cursor:not-allowed; }
  @keyframes glowGold { 0%,100%{box-shadow:0 0 12px rgba(255,215,0,0.3),inset 0 1px 0 rgba(255,255,255,0.06)} 50%{box-shadow:0 0 28px rgba(255,215,0,0.55),inset 0 1px 0 rgba(255,255,255,0.06)} }
  @keyframes glowViolet { 0%,100%{box-shadow:0 0 12px rgba(168,122,255,0.35),inset 0 1px 0 rgba(255,255,255,0.06)} 50%{box-shadow:0 0 28px rgba(168,122,255,0.6),inset 0 1px 0 rgba(255,255,255,0.06)} }
  @keyframes achieveSlide {
    0%   { transform: translateY(120px) scale(0.85); opacity:0; }
    6%   { transform: translateY(-8px)  scale(1.03); opacity:1; }
    9%   { transform: translateY(0px)   scale(1);    opacity:1; }
    88%  { transform: translateY(0px)   scale(1);    opacity:1; }
    100% { transform: translateY(120px) scale(0.9);  opacity:0; }
  }
  @keyframes achieveShimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes achieveStar {
    0%,100% { transform: scale(1) rotate(0deg); }
    50%     { transform: scale(1.3) rotate(15deg); }
  }
`;

// ── ACHIEVEMENT DATA ──────────────────────────────────────────────────────────
// Fixed achievements — always show at specific counts
const FIXED_ACHIEVEMENTS = {
  1:  { icon:"⚔️", title:"First Victory",    flavor:"Look at you. First task down. The bar was low but you cleared it and that counts.", reward:"The dopamine hit you just felt. You're welcome." },
  5:  { icon:"💎", title:"Legendary",         flavor:"Honestly? We didn't have a plan for this. Nobody makes it this far.", reward:"We'll figure something out. Stand by." },
  13: { icon:"🔮", title:"Occultist",         flavor:"Thirteen tasks. Unlucky for some, but apparently not for you. You're performing rituals of efficiency that would make a project manager weep. Keep your soul inside your body, please.", reward:"A haunting sense of accomplishment." },
};

// Final boss — always shown when all tasks complete
const FINAL_BOSS_ACHIEVEMENT = { icon:"🌟", title:"Final Boss", flavor:"You've done it. You've reached the end. Go to bed. Go to the kitchen. Look at a tree. You're making the rest of us look bad.", reward:"Legendary status and a very concerned look from your pet." };

// Random pool — shown for all other completions
const ACHIEVEMENTS = [
  { icon:"🎯", title:"Locked In",               flavor:"The streak is real. Whatever you're doing, don't stop to think about it.",                                                                               reward:"The right to tell someone you were productive today." },
  { icon:"🔥", title:"On A Roll",                flavor:"You've crossed a threshold into a reality where you actually do things. It's weird here, isn't it?",                                                    reward:"A fleeting sense of superiority." },
  { icon:"⚡", title:"Unstoppable",              flavor:"We're not saying you're a legend but we're not <em>not</em> saying it either.",                                                                         reward:"Bragging rights." },
  { icon:"🚀", title:"Escape Velocity",          flavor:"You're moving so fast you're starting to glow on reentry. Most people burn up before now.",                                                             reward:"Friction burns and glory." },
  { icon:"🏹", title:"In The Zone",              flavor:"You've reached escape velocity. Too fast for your own distractions to catch you. Look at them down there — they look like ants.",                       reward:"Oxygen. (metaphorical)" },
  { icon:"🧬", title:"Who Even Are You",         flavor:"Your DNA is rearranging itself into something... functional. It's disgusting. I liked you better when you were a mess, it was more relatable.",        reward:"A gold star." },
  { icon:"🧪", title:"Overdose",                 flavor:"You've officially exceeded the safe dosage of getting stuff done. I'm monitoring your vitals for signs of a personality transplant.",                   reward:"A clean cage and some cheese." },
  { icon:"🌀", title:"Category 5",               flavor:"You're a Category 5 task killer. Most people at this stage are curled in a fetal position wondering where it all went wrong.",                          reward:"Hazard pay. (we're working on it)" },
  { icon:"👑", title:"Three Productive People",  flavor:"I'm starting to suspect you're just three smaller productive people in a trench coat.",                                                                 reward:"Whoever's in the middle, you're doing great." },
  { icon:"📊", title:"Statistically Improbable", flavor:"We ran the numbers. The numbers are confused.",                                                                                                         reward:"Tell no one. They won't believe you anyway." },
  { icon:"🏆", title:"Vindicated",               flavor:"Somewhere out there, your third grade teacher who said you'd never focus on anything is having a very confusing day.",                                  reward:"Cold, delicious vindication." },
  { icon:"🏅", title:"Overachiever Suspect",     flavor:"At this point we're legally required to ask: are you okay? Blink twice if you need us to call someone.",                                               reward:"A mandatory hydration break. Drink water, you machine." },
  { icon:"🤖", title:"Sentient Spreadsheet",     flavor:"You've done so many tasks your soul has left your body and is now living in a Google Sheet. Congrats on the promotion to full-time robot.",            reward:"The existential dread of peak efficiency." },
  { icon:"🌌", title:"Void Gazer",               flavor:"You stared into the abyss of your to-do list… and it blinked first. Respect.",                                                                              reward:"A free pass to stare blankly at a wall for 10 minutes, guilt-free." },
  { icon:"🕯️", title:"Candle Burner",            flavor:"You're burning the candle at both ends, in the middle, and apparently sideways too. Impressive arson.",                                                 reward:"Full marks for creative combustion." },
  { icon:"🧟", title:"Back From the Dead",       flavor:"Task finished. You rose from the grave of I'll do it tomorrow like some kind of zombie productivity legend. Braaains… and schedules.",                 reward:"A surprisingly functional frontal lobe." },
  { icon:"👻", title:"Ghost of Productivity Past", flavor:"Your former self just appeared in ghost form to say how dare you. Haunt them back by doing another one.",                                                  reward:"Eternal petty satisfaction." },
];

function getAchievement(count, isAllDone) {
  if (isAllDone) return null;
  if (FIXED_ACHIEVEMENTS[count]) return FIXED_ACHIEVEMENTS[count];
  // Random from pool for everything else
  return ACHIEVEMENTS[Math.floor(Math.random() * ACHIEVEMENTS.length)];
}

// ── ACHIEVEMENT TOAST ─────────────────────────────────────────────────────────
function AchievementToast({ achievement, taskName }) {
  if (!achievement) return null;
  return (
    <div style={{
      position:"fixed", bottom:24, left:0, right:0,
      display:"flex", justifyContent:"center",
      padding:"0 16px",
      boxSizing:"border-box",
      zIndex:9999,
      animation:"achieveSlide 12s ease forwards",
      pointerEvents:"none",
    }}>
      <div style={{
        width:"100%", maxWidth:360,
        background:"#12103a",
        border:"1px solid rgba(255,215,0,0.45)",
        borderRadius:14,
        padding:"14px 16px",
        boxSizing:"border-box",
        display:"flex", gap:14, alignItems:"flex-start",
      }}>
        {/* Icon */}
        <div style={{
          fontSize:30, flexShrink:0, lineHeight:1,
          marginTop:2,
          animation:"achieveStar 0.6s ease-in-out 0.2s",
        }}>
          {achievement.icon}
        </div>

        {/* Text block */}
        <div style={{flex:1, minWidth:0}}>
          {/* Header label */}
          <div style={{
            fontSize:13, fontWeight:900, letterSpacing:"0.16em",
            color:"#FFD700", marginBottom:6, textTransform:"uppercase",
          }}>⚔️ NEW ACHIEVEMENT!</div>

          {/* Title */}
          <div style={{
            fontSize:20, fontWeight:900, color:"#ffffff",
            lineHeight:1.2, marginBottom:7,
          }}>
            {achievement.title}
          </div>

          {/* Flavor text */}
          <div style={{
            fontSize:11, color:"rgba(210,205,255,0.75)",
            fontWeight:500, lineHeight:1.5, marginBottom:7,
          }} dangerouslySetInnerHTML={{__html: achievement.flavor}}/>

          {/* Reward line */}
          <div style={{
            fontSize:11, color:"#c8a030",
            fontWeight:700,
          }}>🎲 Reward: {achievement.reward}</div>
        </div>
      </div>
    </div>
  );
}

function btn(bg, color, extra={}) {
  return { background:bg, color, border:"none", borderRadius:12, padding:"10px 20px",
    fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit",
    boxShadow:"0 4px 0 rgba(0,0,0,0.4)", transition:"transform 0.1s, filter 0.1s", ...extra };
}
function card(extra={}) {
  return { background:C.card, border:"1px solid rgba(255,215,0,0.18)",
    borderRadius:18, padding:20,
    boxShadow:"0 4px 24px rgba(0,0,0,0.5)", marginBottom:16, ...extra };
}
function inp() {
  return { flex:1, border:"1.5px solid rgba(255,215,0,0.35)", borderRadius:10,
    padding:"10px 14px", fontSize:16, fontFamily:"inherit",
    background:"#08071a", color:"#ffffff" };
}

// ── CONFETTI ──────────────────────────────────────────────────────────────────
function Confetti({ active }) {
  if (!active) return null;
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999}}>
      {Array.from({length:28},(_,i) => (
        <div key={i} style={{
          position:"absolute", left:`${Math.random()*100}%`, top:"-16px",
          width:`${8+Math.random()*8}px`, height:`${8+Math.random()*8}px`,
          background:CONFETTI_COLORS[i%CONFETTI_COLORS.length],
          borderRadius:Math.random()>0.5?"50%":"2px",
          animation:`fall ${1.2+Math.random()*1.1}s ease-in ${Math.random()*0.4}s forwards`,
          transform:`rotate(${Math.random()*360}deg)`,
        }}/>
      ))}
    </div>
  );
}

// ── COUNTDOWN TIMER ───────────────────────────────────────────────────────────
function CountdownTimer({ minutes, onDone }) {
  const totalSecs = minutes * 60;
  const endTimeRef = useRef(Date.now() + totalSecs * 1000);
  const pausedAtRef = useRef(null);
  const [secs, setSecs] = useState(totalSecs);
  const [running, setRunning] = useState(true);
  const timerRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setSecs(remaining);
      if (remaining <= 0) {
        if (!doneRef.current) {
          doneRef.current = true;
          playChime();
          onDone && onDone();
        }
        return;
      }
      timerRef.current = setTimeout(tick, 500);
    };
    timerRef.current = setTimeout(tick, 500);
    return () => clearTimeout(timerRef.current);
  }, [running]);

  const pause = () => {
    clearTimeout(timerRef.current);
    pausedAtRef.current = endTimeRef.current - Date.now();
    setRunning(false);
  };

  const resume = () => {
    endTimeRef.current = Date.now() + pausedAtRef.current;
    setRunning(true);
  };

  const m = Math.floor(secs/60), s = secs%60, pct = secs/totalSecs;
  const r = 28, circ = 2*Math.PI*r;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,margin:"10px 0"}}>
      <div style={{position:"relative",width:72,height:72}}>
        <svg width="72" height="72" style={{transform:"rotate(-90deg)"}}>
          <circle cx="36" cy="36" r={r} fill="none" stroke="#eee" strokeWidth="5"/>
          <circle cx="36" cy="36" r={r} fill="none" stroke={C.purple} strokeWidth="5"
            strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} style={{transition:"stroke-dashoffset 1s linear"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:C.text}}>
          {m}:{s.toString().padStart(2,"0")}
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>running?pause():resume()} style={btn(running?C.must:C.fun,running?"#1a1000":"white")}>{running?"⏸ Pause":"▶ Resume"}</button>
        <button onClick={()=>{playChime();onDone&&onDone();}} style={btn("rgba(255,255,255,0.08)",C.text,{border:"1px solid rgba(255,255,255,0.15)"})}>Skip ⏭</button>
      </div>
    </div>
  );
}


// ── THREE.JS AUDIO ─────────────────────────────────────────────────────────────
function d20PlayRoll(ctx) {
  // Tumbling thuds: a series of low-mid impacts that speed up then slow
  // Each impact = a pitched noise burst (woody thock) + tiny sub thud
  const impacts = [0, 0.18, 0.32, 0.44, 0.54, 0.60, 0.65];
  impacts.forEach((delay, i) => {
    const vol = 0.28 - i * 0.025;
    const dur = 0.06;
    const sr = ctx.sampleRate;

    // Noise body — bandpass filtered for woody "thock"
    const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const d = buf.getChannelData(0);
    for (let j = 0; j < d.length; j++) {
      const env = Math.pow(1 - j / d.length, 2.5);
      d[j] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass";
    bp.frequency.value = 280 + i * 30; bp.Q.value = 1.8;
    const g = ctx.createGain(); g.gain.value = Math.max(0.05, vol);
    src.connect(bp); bp.connect(g); g.connect(ctx.destination);
    src.start(ctx.currentTime + delay);

    // Sub thud underneath each impact
    const o = ctx.createOscillator(); const og = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(95, ctx.currentTime + delay);
    o.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + delay + 0.08);
    og.gain.setValueAtTime(Math.max(0.04, vol * 0.55), ctx.currentTime + delay);
    og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.1);
    o.connect(og); og.connect(ctx.destination);
    o.start(ctx.currentTime + delay);
    o.stop(ctx.currentTime + delay + 0.12);
  });
}
function d20PlayThud(ctx) {
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type="sine"; o.frequency.setValueAtTime(80,ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(22,ctx.currentTime+0.3);
  g.gain.setValueAtTime(0.6,ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.4);
  o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime+0.4);
}

// ── D20 FACE DATA ─────────────────────────────────────────────────────────────
const D20_FACE_NUMBERS=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
function buildD20FaceNormals(){
  const geo=new THREE.IcosahedronGeometry(1,0).toNonIndexed();
  const pos=geo.attributes.position;
  return Array.from({length:20},(_,f)=>{
    const cx=(pos.getX(f*3)+pos.getX(f*3+1)+pos.getX(f*3+2))/3;
    const cy=(pos.getY(f*3)+pos.getY(f*3+1)+pos.getY(f*3+2))/3;
    const cz=(pos.getZ(f*3)+pos.getZ(f*3+1)+pos.getZ(f*3+2))/3;
    return new THREE.Vector3(cx,cy,cz).normalize();
  });
}
const D20_FACE_NORMALS=buildD20FaceNormals();
function d20GetTopFace(quaternion){
  const invQ=quaternion.clone().invert();
  const localUp=new THREE.Vector3(0,1,0).applyQuaternion(invQ);
  let best=-Infinity,idx=0;
  D20_FACE_NORMALS.forEach((n,i)=>{ const dot=n.dot(localUp); if(dot>best){best=dot;idx=i;} });
  return D20_FACE_NUMBERS[idx];
}

// ── D20 FACE TEXTURE ──────────────────────────────────────────────────────────
function makeD20FaceTex(number){
  const size=512;
  const cv=document.createElement("canvas"); cv.width=cv.height=size;
  const ctx=cv.getContext("2d");
  ctx.fillStyle="#1a0840";
  ctx.beginPath(); ctx.moveTo(size/2,8); ctx.lineTo(size-8,size-8); ctx.lineTo(8,size-8); ctx.closePath(); ctx.fill();
  [[size*.38,size*.42,size*.26,"rgba(110,50,180,0.14)"],[size*.62,size*.58,size*.20,"rgba(140,70,220,0.11)"],
   [size*.44,size*.68,size*.18,"rgba(80,35,160,0.15)"],[size*.58,size*.32,size*.16,"rgba(160,85,220,0.08)"],
  ].forEach(([x,y,r,color])=>{
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,color); g.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(size/2,8); ctx.lineTo(size-8,size-8); ctx.lineTo(8,size-8); ctx.closePath(); ctx.fill();
  });
  ctx.strokeStyle="#c8a030"; ctx.lineWidth=9; ctx.lineJoin="round";
  ctx.beginPath(); ctx.moveTo(size/2,12); ctx.lineTo(size-12,size-12); ctx.lineTo(12,size-12); ctx.closePath(); ctx.stroke();
  const fs=number>=10?128:158;
  ctx.font=`900 ${fs}px Arial Black,Arial,sans-serif`;
  ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.shadowColor="rgba(0,0,0,0.8)"; ctx.shadowBlur=3; ctx.shadowOffsetX=1; ctx.shadowOffsetY=2;
  ctx.fillStyle="#8a6810"; ctx.fillText(String(number),size/2,size*.60);
  ctx.shadowBlur=0; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0;
  ctx.fillStyle="#e8c84a"; ctx.fillText(String(number),size/2,size*.60);
  return new THREE.CanvasTexture(cv);
}

function buildD20Mesh(){
  const group=new THREE.Group();
  const geo=new THREE.IcosahedronGeometry(1,0).toNonIndexed();
  const pos=geo.attributes.position;
  for(let f=0;f<20;f++){
    const verts=new Float32Array(9);
    for(let v=0;v<3;v++){ verts[v*3]=pos.getX(f*3+v); verts[v*3+1]=pos.getY(f*3+v); verts[v*3+2]=pos.getZ(f*3+v); }
    const uvs=new Float32Array([0.5,0.95,0.05,0.05,0.95,0.05]);
    const fg=new THREE.BufferGeometry();
    fg.setAttribute("position",new THREE.BufferAttribute(verts,3));
    fg.setAttribute("uv",new THREE.BufferAttribute(uvs,2));
    fg.computeVertexNormals();
    group.add(new THREE.Mesh(fg,new THREE.MeshLambertMaterial({map:makeD20FaceTex(D20_FACE_NUMBERS[f])})));
  }
  const edgeGeo=new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.007,0));
  group.add(new THREE.LineSegments(edgeGeo,new THREE.LineBasicMaterial({color:0xb89028,transparent:true,opacity:0.88})));
  return group;
}

function buildD20Surface(scene){
  const feltC=document.createElement("canvas"); feltC.width=feltC.height=1024;
  const fc=feltC.getContext("2d");
  // Lighter warm charcoal felt base
  fc.fillStyle="#040b05"; fc.fillRect(0,0,1024,1024);
  for(let i=0;i<50000;i++){
    const v=20+Math.random()*14;
    fc.fillStyle=`rgba(${v-4},${v},${v-4},${Math.random()*0.06})`;
    fc.fillRect(Math.random()*1024,Math.random()*1024,1,1);
  }
  // No radial spotlight — lamp handles lighting in 3D
  const feltTex=new THREE.CanvasTexture(feltC);
  feltTex.wrapS=THREE.RepeatWrapping; feltTex.wrapT=THREE.RepeatWrapping; feltTex.repeat.set(3,2);
  const surface=new THREE.Mesh(new THREE.PlaneGeometry(20,14),new THREE.MeshLambertMaterial({map:feltTex}));
  surface.rotation.x=-Math.PI/2; surface.position.y=0; scene.add(surface);
  const vc=document.createElement("canvas"); vc.width=vc.height=512;
  const vctx=vc.getContext("2d");
  const vg=vctx.createRadialGradient(256,256,80,256,256,360);
  vg.addColorStop(0,"rgba(0,0,0,0)"); vg.addColorStop(1,"rgba(0,0,0,0.55)");
  vctx.fillStyle=vg; vctx.fillRect(0,0,512,512);
  const vignette=new THREE.Mesh(new THREE.PlaneGeometry(20,14),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(vc),transparent:true,depthWrite:false}));
  vignette.rotation.x=-Math.PI/2; vignette.position.y=0.01; scene.add(vignette);
}

function buildD20Shadow(scene){
  const sc=document.createElement("canvas"); sc.width=sc.height=128;
  const sctx=sc.getContext("2d");
  const sg=sctx.createRadialGradient(64,64,4,64,64,62);
  sg.addColorStop(0,"rgba(0,0,0,0.6)"); sg.addColorStop(1,"rgba(0,0,0,0)");
  sctx.fillStyle=sg; sctx.fillRect(0,0,128,128);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.2,3.2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sc),transparent:true,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2; shadow.position.y=0.02; scene.add(shadow); return shadow;
}

function buildD20Tray(scene){
  const W=9.0,D=6.0,H=2.2,T=0.25;
  const woodC=document.createElement("canvas"); woodC.width=woodC.height=256;
  const wc=woodC.getContext("2d");
  const wg=wc.createLinearGradient(0,0,256,0);
  wg.addColorStop(0,"#080502"); wg.addColorStop(0.5,"#0a0603"); wg.addColorStop(1,"#060401");
  wc.fillStyle=wg; wc.fillRect(0,0,256,256);
  for(let i=0;i<60;i++){
    const y=(i/60)*256+Math.random()*3;
    wc.beginPath(); wc.moveTo(0,y);
    wc.bezierCurveTo(64,y+Math.random()*10-5,192,y+Math.random()*10-5,256,y);
    wc.strokeStyle=`rgba(${6+Math.random()*8},${3+Math.random()*4},${1+Math.random()*2},${0.2+Math.random()*0.25})`;
    wc.lineWidth=0.6+Math.random()*1.6; wc.stroke();
  }
  for(let i=0;i<120;i++){
    wc.fillStyle=`rgba(5,2,1,${Math.random()*0.15})`;
    wc.beginPath(); wc.arc(Math.random()*256,Math.random()*256,Math.random()*2,0,Math.PI*2); wc.fill();
  }
  const woodTex=new THREE.CanvasTexture(woodC);
  const mat=new THREE.MeshLambertMaterial({map:woodTex,side:THREE.DoubleSide});
  const rimMat=new THREE.MeshPhongMaterial({color:0x1a1008,shininess:15,specular:new THREE.Color(0x2a1a08)});
  [[0,H/2,D+T/2,W*2+T*2,H,T],[0,H/2,-D-T/2,W*2+T*2,H,T],[-W-T/2,H/2,0,T,H,D*2],[W+T/2,H/2,0,T,H,D*2]].forEach(([x,y,z,bw,bh,bd])=>{
    const wall=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd),mat);
    wall.position.set(x,y,z); wall.castShadow=true; wall.receiveShadow=true; scene.add(wall);
  });
  [[0,H+0.03,D+T/2,W*2+T*2,0.06,T+0.02],[0,H+0.03,-D-T/2,W*2+T*2,0.06,T+0.02],[-W-T/2,H+0.03,0,T+0.02,0.06,D*2],[W+T/2,H+0.03,0,T+0.02,0.06,D*2]].forEach(([x,y,z,bw,bh,bd])=>{
    const rim=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd),rimMat);
    rim.position.set(x,y,z); scene.add(rim);
  });
}

// ── D20 TRAY COMPONENT ────────────────────────────────────────────────────────
function DiceBox({ onResult, items }) {
  const mountRef=useRef(null);
  const ctxRef  =useRef(null);
  const rafRef  =useRef(null);
  const busyRef =useRef(false);
  const [rolling,setRolling]=useState(false);

  useEffect(()=>{
    const el=mountRef.current;
    const W=el.clientWidth, H=el.clientHeight;
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    renderer.setSize(W,H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(52,W/H,0.1,100);
    camera.position.set(0,11.5,8.2); camera.lookAt(0,0,-0.8);
    scene.add(new THREE.AmbientLight(0x0e1a0a,2.6));
    const lamp=new THREE.PointLight(0xfff5d0,9.0,40);
    lamp.position.set(0,12,2); lamp.castShadow=true;
    lamp.shadow.mapSize.set(2048,2048); lamp.shadow.bias=-0.001; scene.add(lamp);
    const fill=new THREE.DirectionalLight(0xffe8c0,1.2);
    fill.position.set(2,6,8); scene.add(fill);
    const acc=new THREE.PointLight(0x4422aa,0.8,22);
    acc.position.set(-3,5,-6); scene.add(acc);
    buildD20Surface(scene);
    buildD20Tray(scene);
    const shadowMesh=buildD20Shadow(scene);
    shadowMesh.material.opacity=0;
    const SURFACE_Y=1.8;
    const d20=buildD20Mesh();
    d20.scale.setScalar(1.8);
    d20.position.set(-18,SURFACE_Y,0);
    d20.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
    scene.add(d20);
    renderer.render(scene,camera);
    ctxRef.current={renderer,scene,camera,d20,shadowMesh,SURFACE_Y};
    let touchStartY=0;
    const onTouchStart=(e)=>{ touchStartY=e.touches[0].clientY; };
    const onTap=()=>{ if(!busyRef.current) doRoll(); };
    const onTouchEnd=(e)=>{
      const dy=Math.abs(e.changedTouches[0].clientY-touchStartY);
      if(dy<10) onTap();
    };
    renderer.domElement.addEventListener("click",      onTap);
    renderer.domElement.addEventListener("touchstart", onTouchStart,{passive:true});
    renderer.domElement.addEventListener("touchend",   onTouchEnd,{passive:true});
    return ()=>{
      cancelAnimationFrame(rafRef.current);
      renderer.domElement.removeEventListener("click",      onTap);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchend",   onTouchEnd);
      if(el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      renderer.dispose();
    };
  },[]);

  const doRoll=()=>{
    if(!items||!items.length) return;
    const {renderer,scene,camera,d20,shadowMesh,SURFACE_Y}=ctxRef.current;
    busyRef.current=true; setRolling(true);
    const fromLeft=Math.random()>0.5;
    const START_X=fromLeft?-11:11;
    const START_HEIGHT=2.8;
    const END_X=(Math.random()-0.5)*1.5;
    const END_Z=(Math.random()-0.5)*1.2;
    const travelDir=fromLeft?1:-1;
    const TOTAL_Z=-(travelDir)*(4+Math.random()*2)*Math.PI*2;
    const wobbleX=(Math.random()-0.5)*6;
    const wobbleY=(Math.random()-0.5)*3;
    d20.position.set(START_X,SURFACE_Y,END_Z);
    try{
      const ac=new(window.AudioContext||window.webkitAudioContext)();
      setTimeout(()=>{try{d20PlayRoll(ac);}catch(e){}},480);
      setTimeout(()=>{try{d20PlayThud(ac);}catch(e){}},1900);
    }catch(e){}
    const ROLL_DUR=1700, SETTLE_DUR=350, TOTAL=ROLL_DUR+SETTLE_DUR;
    const t0=performance.now();
    cancelAnimationFrame(rafRef.current);
    const roll=()=>{
      const elapsed=performance.now()-t0;
      const p=Math.min(elapsed/TOTAL,1);
      if(elapsed<=ROLL_DUR){
        const rp=elapsed/ROLL_DUR;
        const ease=1-Math.pow(1-rp,3);
        const speed=1-ease;
        d20.position.x=START_X+(END_X-START_X)*ease;
        d20.position.z=END_Z;
        const entryArc=START_HEIGHT*(1-ease);
        d20.position.y=SURFACE_Y+entryArc+Math.abs(Math.sin(rp*Math.PI*6))*0.28*speed;
        d20.rotation.z=TOTAL_Z*ease;
        d20.rotation.x=wobbleX*Math.sin(rp*Math.PI*4)*speed;
        d20.rotation.y=wobbleY*Math.sin(rp*Math.PI*3)*speed;
        const h=d20.position.y-SURFACE_Y;
        shadowMesh.position.x=d20.position.x; shadowMesh.position.z=d20.position.z;
        shadowMesh.scale.set(1+h*0.2,1+h*0.2,1);
        shadowMesh.material.opacity=Math.max(0,0.55-h*0.18);
      } else {
        const sp=(elapsed-ROLL_DUR)/SETTLE_DUR;
        const w=Math.sin(sp*Math.PI*4)*(1-sp)*0.04;
        d20.position.set(END_X,SURFACE_Y+Math.abs(w)*0.3,END_Z);
        d20.rotation.z=TOTAL_Z+w;
        d20.rotation.x=wobbleX*0.05*(1-sp);
        d20.rotation.y=wobbleY*0.05*(1-sp);
        shadowMesh.position.x=END_X; shadowMesh.position.z=END_Z;
        shadowMesh.scale.set(1,1,1); shadowMesh.material.opacity=0.52;
      }
      renderer.render(scene,camera);
      if(p<1){
        rafRef.current=requestAnimationFrame(roll);
      } else {
        d20.position.set(END_X,SURFACE_Y,END_Z);
        renderer.render(scene,camera);
        // Signal roll complete — parent picks from fresh pool
        busyRef.current=false; setRolling(false);
        onResult();
        const still=()=>{ rafRef.current=requestAnimationFrame(still); renderer.render(scene,camera); };
        still();
      }
    };
    rafRef.current=requestAnimationFrame(roll);
  };

  return (
    <div style={{textAlign:"center"}}>
      <div style={{position:"relative", width:"100%"}}>
        <div ref={mountRef} style={{
          width:"100%", height:220, borderRadius:12, overflow:"hidden",
          cursor:rolling?"wait":"pointer",
          boxShadow:"0 8px 40px rgba(0,0,0,0.6)",
        }}/>
        {!rolling && (
          <div style={{
            position:"absolute", bottom:12, left:0, right:0,
            fontSize:13, color:"rgba(255,215,0,0.7)", fontWeight:900, letterSpacing:3,
            pointerEvents:"none",
          }}>
            TAP TO ROLL
          </div>
        )}
        {rolling && (
          <div style={{
            position:"absolute", bottom:12, left:0, right:0,
            fontSize:10, color:"rgba(200,191,255,0.4)", fontWeight:800, letterSpacing:2,
            pointerEvents:"none",
          }}>
            ROLLING...
          </div>
        )}
      </div>
    </div>
  );
}

// ── SPIN WHEEL — pointer at top, result matches visual ───────────────────────
function Tag({ type }) {
  return (
    <span style={{fontSize:10,fontWeight:800,letterSpacing:1,padding:"2px 8px",borderRadius:20,
      background:type==="fun"?"rgba(168,122,255,0.2)":"rgba(255,215,0,0.18)",
      color:type==="fun"?C.fun:C.must,
      border:`1px solid ${type==="fun"?"rgba(168,122,255,0.4)":"rgba(255,215,0,0.4)"}`,textTransform:"uppercase"}}>
      {type==="fun"?"✨ Dopamine Break":"✦ Must Do"}
    </span>
  );
}

// No subtext — the checkbox label says it all


// ── ACHIEVEMENTS ──────────────────────────────────────────────────────────────
// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function App() {
  const loadSaved = (key, fallback) => {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  };

  const [screen,     setScreen]     = useState(()=>loadSaved("rft_screen","landing"));
  const [mustInput,  setMustInput]  = useState("");
  const [funInput,   setFunInput]   = useState("");
  const [funMin,     setFunMin]     = useState(()=>loadSaved("rft_funMin",5));
  const [funMax,     setFunMax]     = useState(()=>loadSaved("rft_funMax",15));
  const [mustItems,  setMustItems]  = useState(()=>loadSaved("rft_mustItems",[]));
  const [funItems,   setFunItems]   = useState(()=>loadSaved("rft_funItems",[]));
  const [breakMode,  setBreakMode]  = useState(()=>loadSaved("rft_breakMode","balanced"));
  const [mustTimedIds, setMustTimedIds] = useState(()=>new Set(loadSaved("rft_mustTimedIds",[])));
  const [mustTMin,   setMustTMin]   = useState(()=>loadSaved("rft_mustTMin",{}));
  const [mustTMax,   setMustTMax]   = useState(()=>loadSaved("rft_mustTMax",{}));
  const [result,     setResult]     = useState(()=>loadSaved("rft_result",null));
  const [completed,  setCompleted]  = useState(()=>loadSaved("rft_completed",[]));
  const [removedFun, setRemovedFun] = useState(()=>loadSaved("rft_removedFun",[]));
  const completedRef  = useRef([]);
  const removedFunRef = useRef([]);
  const [confetti,   setConfetti]   = useState(false);
  const [achievement, setAchievement] = useState(null);
  const achieveTimerRef = useRef(null);

  // Sync refs with restored state on mount
  useEffect(()=>{ completedRef.current = completed; }, []);
  useEffect(()=>{ removedFunRef.current = removedFun; }, []);

  // On restore, if all must-dos are completed redirect to celebration instead of empty game screen
  useEffect(()=>{
    if (screen === "game" && mustItems.length > 0 && mustItems.every(i => completed.includes(i.id))) {
      setScreen("celebration");
    }
  }, []);

  // Persist session state to localStorage whenever it changes
  useEffect(()=>{ try { localStorage.setItem("rft_screen", JSON.stringify(screen==="celebration"?"game":screen)); } catch{} }, [screen]);
  useEffect(()=>{ try { localStorage.setItem("rft_completed", JSON.stringify(completed)); } catch{} }, [completed]);
  useEffect(()=>{ try { localStorage.setItem("rft_removedFun", JSON.stringify(removedFun)); } catch{} }, [removedFun]);
  useEffect(()=>{ try { if(result) localStorage.setItem("rft_result", JSON.stringify({...result, duration:null})); else localStorage.removeItem("rft_result"); } catch{} }, [result]);

  // Persist setup state to localStorage whenever it changes
  useEffect(()=>{ try { localStorage.setItem("rft_mustItems", JSON.stringify(mustItems)); } catch{} }, [mustItems]);
  useEffect(()=>{ try { localStorage.setItem("rft_funItems", JSON.stringify(funItems)); } catch{} }, [funItems]);
  useEffect(()=>{ try { localStorage.setItem("rft_breakMode", JSON.stringify(breakMode)); } catch{} }, [breakMode]);
  useEffect(()=>{ try { localStorage.setItem("rft_funMin", JSON.stringify(funMin)); } catch{} }, [funMin]);
  useEffect(()=>{ try { localStorage.setItem("rft_funMax", JSON.stringify(funMax)); } catch{} }, [funMax]);
  useEffect(()=>{ try { localStorage.setItem("rft_mustTimedIds", JSON.stringify([...mustTimedIds])); } catch{} }, [mustTimedIds]);
  useEffect(()=>{ try { localStorage.setItem("rft_mustTMin", JSON.stringify(mustTMin)); } catch{} }, [mustTMin]);
  useEffect(()=>{ try { localStorage.setItem("rft_mustTMax", JSON.stringify(mustTMax)); } catch{} }, [mustTMax]);
  const [achieveTask, setAchieveTask] = useState("");
  const [showAchieve, setShowAchieve] = useState(false);
  const [showTimer,  setShowTimer]  = useState(false);
  const [timerDone,  setTimerDone]  = useState(false);

  const activeMust = mustItems.filter(i => !completed.includes(i.id));
  const activeFun  = funItems.filter(i  => !removedFun.includes(i.id));
  const allItems   = [...activeMust, ...activeFun];

  function buildPool() {
    if (!activeMust.length && !activeFun.length) return [];
    if (!activeMust.length) return activeFun;
    if (!activeFun.length)  return activeMust;
    return Math.random() < getFunChance(breakMode) ? activeFun : activeMust;
  }

  const addMust = () => {
    const t = mustInput.trim(); if (!t) return;
    setMustItems(p=>[...p,{id:Date.now(),text:t,type:"must"}]); setMustInput("");
  };
  const addFun = () => {
    const t = funInput.trim(); if (!t) return;
    setFunItems(p=>[...p,{id:Date.now()+1,text:t,type:"fun"}]); setFunInput("");
  };
  const removeMust = id => {
    setMustItems(p=>p.filter(i=>i.id!==id));
    setMustTimedIds(s=>{const n=new Set(s);n.delete(id);return n;});
  };
  const toggleTimed = id => {
    setMustTimedIds(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n;});
    setMustTMin(p=>({...p,[id]:p[id]||10}));
    setMustTMax(p=>({...p,[id]:p[id]||20}));
  };

  const handleResult = item => {
    const duration =
      item.type==="fun"
        ? funMin+Math.floor(Math.random()*(funMax-funMin+1))
        : mustTimedIds.has(item.id)
          ? (mustTMin[item.id]||10)+Math.floor(Math.random()*((mustTMax[item.id]||20)-(mustTMin[item.id]||10)+1))
          : null;
    setResult({...item,duration,keepInRotation:item.type==="fun"});
    setShowTimer(false); setTimerDone(false);
  };

  // For dice: item is passed directly (face value already picked the item)
  // Item is passed directly from DiceBox (winner pre-selected by face)
  const handleRoll = (item) => {
    // Use item directly — winner already selected by dice face
    // If called without (shouldn't happen now), fall back to pool
    if (item) {
      handleResult(item);
    } else {
      const pool = buildPool(); if (!pool.length) return;
      handleResult(pool[Math.floor(Math.random()*pool.length)]);
    }
  };

  // Dice picks from its own pool (must or fun based on break mode)
  const handleDiceRoll = () => {
    // Use refs to get truly current completed/removedFun at roll resolution time
    const freshMust = mustItems.filter(i => !completedRef.current.includes(i.id));
    const freshFun  = funItems.filter(i => !removedFunRef.current.includes(i.id));
    if (!freshMust.length && !freshFun.length) return;

    let pool;
    if (!freshMust.length) pool = freshFun;
    else if (!freshFun.length) pool = freshMust;
    else {
      const chance = breakMode === "chaos"
        ? Math.random() * 0.45 + 0.05
        : BREAK_MODES[breakMode].basePct;
      pool = Math.random() < chance ? freshFun : freshMust;
    }
    if (!pool.length) return;

    handleResult(pool[Math.floor(Math.random() * pool.length)]);
  };

  const markDone = () => {
    if (!result) return;
    if (result.type==="must" && !result.keepInRotation) {
      setCompleted(p => {
        const next = [...p, result.id];
        completedRef.current = next;
        const isAllDone = next.length === mustItems.length;
        const a = getAchievement(next.length, isAllDone);
        if (a) {
          setAchievement({ ...a, taskName: result.text, key: Date.now() });
          if(achieveTimerRef.current) clearTimeout(achieveTimerRef.current);
          achieveTimerRef.current = setTimeout(() => setAchievement(null), 13000);
        }
        if (isAllDone) {
          setTimeout(() => setScreen("celebration"), 50);
        }
        return next;
      });
      setConfetti(true); setTimeout(()=>setConfetti(false),1800);
    }
    if (result.type==="fun" && !result.keepInRotation) {
      setRemovedFun(p=>{const next=[...p,result.id]; removedFunRef.current=next; return next;});
    }
    setResult(null); setShowTimer(false); setTimerDone(false);
  };

  const allDone = mustItems.length>0 && activeMust.length===0;

  // ── LANDING ────────────────────────────────────────────────────────────────
  if (screen === "landing") {
    return (
      <div style={{
        minHeight:"100vh", background:`linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)`,
        fontFamily:"Nunito,sans-serif", display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", padding:"32px 24px", textAlign:"center",
      }}>
        <style>{GLOBAL_CSS}</style>

        {/* D20 image */}
        <div style={{
          marginBottom:20,
          animation:"pulse 2.8s ease-in-out infinite",
          filter:"drop-shadow(0 16px 48px rgba(150,80,255,0.5))",
        }}>
          <img
            src="data:image/jpeg;base64,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"
            alt="d20"
            style={{
              width:200, height:200,
              objectFit:"cover",
              borderRadius:"50%",
            }}
          />
        </div>

        {/* Name */}
        <div style={{animation:"fadeUp 0.6s ease both"}}>
          <h1 style={{
            margin:0, fontSize:42, fontWeight:900, color:"white",
            letterSpacing:-1.5, lineHeight:1,
          }}>Roll for Task</h1>
          <div style={{
            marginTop:8, fontSize:14, fontWeight:700, letterSpacing:3,
            color:C.accent, textTransform:"uppercase",
          }}>rollfortask.com</div>
        </div>

        {/* Tagline */}
        <p style={{
          marginTop:20, fontSize:17, color:"rgba(255,255,255,0.75)",
          fontWeight:700, lineHeight:1.5, maxWidth:300,
          animation:"fadeUp 0.6s ease 0.15s both",
        }}>
          Task paralysis hitting hard?<br/>
          <span style={{color:"white"}}>Let the dice decide.</span>
        </p>

        {/* ADHD callout */}
        <div style={{
          marginTop:20, background:"rgba(255,255,255,0.07)", borderRadius:14,
          padding:"12px 20px", maxWidth:300,
          border:"1px solid rgba(255,255,255,0.12)",
          animation:"fadeUp 0.6s ease 0.25s both",
        }}>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.8)",lineHeight:1.5}}>
            Mix must-dos with fun breaks, roll to decide, and bypass the freeze. No more "where do I even start" — just roll and go.
          </div>
        </div>

        {/* How it works */}
        <div style={{
          marginTop:24, display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center",
          maxWidth:340, animation:"fadeUp 0.6s ease 0.35s both",
        }}>
          {[["✅","Add your tasks"],["✨","Add dopamine breaks"],[null,"Roll the die"]].map(([e,t])=>(
            <div key={t} style={{
              display:"flex", alignItems:"center", gap:6,
              fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.45)",
              pointerEvents:"none", userSelect:"none",
            }}>
              {e
                ? <span style={{fontSize:16}}>{e}</span>
                : <img src="data:image/jpeg;base64,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" alt="d20" style={{width:22,height:22,borderRadius:"50%",objectFit:"cover"}}/>
              }
              {t}
            </div>
          ))}
        </div>

        {/* CTA hint */}
        <div style={{
          marginTop:24, fontSize:13, color:"rgba(255,255,255,0.5)",
          fontWeight:700, lineHeight:1.5, maxWidth:300, textAlign:"center",
          animation:"fadeUp 0.6s ease 0.42s both",
        }}>
          Tap <span style={{color:"rgba(255,215,0,0.8)"}}>Let's Roll</span> to add your tasks, dopamine breaks, and get rolling on your day!
        </div>

        {/* CTA */}
        <button onClick={()=>setScreen("setup")} style={{
          ...btn(C.must, "#1a1000", {
            marginTop:32, fontSize:18, padding:"16px 40px", borderRadius:16,
            fontWeight:900, letterSpacing:-0.5,
            boxShadow:"0 6px 0 rgba(0,0,0,0.4), 0 0 30px rgba(255,215,0,0.35)",
            animation:"fadeUp 0.6s ease 0.45s both",
          })
        }}>
          Let's Roll!
        </button>

        <div style={{marginTop:16,fontSize:11,color:"rgba(255,255,255,0.25)",fontWeight:700,animation:"fadeUp 0.6s ease 0.5s both"}}>
          Free · No account needed · Works on any device
        </div>
        <a href="/why-it-works.html" style={{
          marginTop:14, fontSize:11, color:"rgba(255,215,0,0.45)",
          fontWeight:700, textDecoration:"none", letterSpacing:0.3,
          animation:"fadeUp 0.6s ease 0.55s both", display:"block",
        }}
          onMouseOver={e=>e.target.style.color="rgba(255,215,0,0.75)"}
          onMouseOut={e=>e.target.style.color="rgba(255,215,0,0.45)"}
        >
          Why does this work? →
        </a>
        <a href="mailto:rollfortask@gmail.com" style={{
          marginTop:8, fontSize:11, color:"rgba(255,255,255,0.2)",
          fontWeight:700, textDecoration:"none", letterSpacing:0.3,
          animation:"fadeUp 0.6s ease 0.6s both", display:"block",
        }}
          onMouseOver={e=>e.target.style.color="rgba(255,255,255,0.45)"}
          onMouseOut={e=>e.target.style.color="rgba(255,255,255,0.2)"}
        >
          Share feedback →
        </a>
        <a href="/privacy.html" style={{
          marginTop:8, fontSize:11, color:"rgba(255,255,255,0.15)",
          fontWeight:700, textDecoration:"none", letterSpacing:0.3,
          animation:"fadeUp 0.6s ease 0.65s both", display:"block",
        }}
          onMouseOver={e=>e.target.style.color="rgba(255,255,255,0.35)"}
          onMouseOut={e=>e.target.style.color="rgba(255,255,255,0.15)"}
        >
          Privacy Policy
        </a>
      </div>
    );
  }
  if (screen === "celebration") {
    return (
      <div style={{
        minHeight:"100vh", background:C.bg,
        fontFamily:"Nunito,sans-serif", display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        padding:"40px 20px", textAlign:"center",
      }}>
        <style>{GLOBAL_CSS}</style>
        <Confetti active={true}/>
        {achievement && <AchievementToast key={achievement.key} achievement={achievement} taskName={achievement.taskName}/>}
        <div style={{
          fontSize:90, marginBottom:8,
          animation:"pulse 1.5s ease-in-out infinite",
          filter:"drop-shadow(0 8px 24px rgba(255,217,61,0.5))",
        }}>🏆</div>
        <h1 style={{
          margin:"0 0 8px", fontSize:32, fontWeight:900, color:C.text,
          letterSpacing:-1,
        }}>YOU DID IT!</h1>
        <div style={{display:"flex", gap:12, justifyContent:"center", marginBottom:28}}>
          <div style={{
            background:C.mustLight, borderRadius:14, padding:"14px 28px",
            border:`2px solid ${C.must}`,
          }}>
            <div style={{fontSize:36,fontWeight:900,color:C.must}}>{completed.length}</div>
            <div style={{fontSize:11,fontWeight:800,color:C.soft,letterSpacing:1}}>TASKS DONE</div>
          </div>
        </div>
        <div style={{
          background:"#1a1830",
          borderRadius:16, padding:"16px 20px", marginBottom:24,
          border:"1px solid rgba(255,215,0,0.2)",
          maxWidth:340, width:"100%",
        }}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.6}}>
            Your brain fought hard today. Getting started was the hardest part. Staying on track was the second. You did both. That's genuinely huge — go enjoy the rest of your day, you earned it.
          </div>
        </div>
        <button onClick={()=>{
          setScreen("setup");
          setResult(null);
          setCompleted([]);
          setRemovedFun([]);
          setMustItems([]);
          setFunItems([]);
          setBreakMode("balanced");
          setFunMin(5); setFunMax(15);
          setMustTimedIds(new Set());
          setMustTMin({}); setMustTMax({});
          completedRef.current = [];
          removedFunRef.current = [];
          try { ["rft_mustItems","rft_funItems","rft_breakMode","rft_funMin","rft_funMax","rft_mustTimedIds","rft_mustTMin","rft_mustTMax","rft_screen","rft_completed","rft_removedFun","rft_result"].forEach(k=>localStorage.removeItem(k)); } catch{}
        }} style={btn(C.must,"#1a1000",{fontSize:16,padding:"14px 28px",fontWeight:900,boxShadow:"0 4px 0 rgba(0,0,0,0.4), 0 0 16px rgba(255,215,0,0.3)"})}>
          Start Fresh
        </button>
        <button onClick={()=>{
          setResult(null);
          setCompleted([]);
          setRemovedFun([]);
          completedRef.current = [];
          removedFunRef.current = [];
          setScreen("setup");
          try { ["rft_screen","rft_completed","rft_removedFun","rft_result"].forEach(k=>localStorage.removeItem(k)); } catch{}
        }} style={btn("rgba(255,255,255,0.07)","rgba(255,255,255,0.7)",{fontSize:14,padding:"12px 28px",fontWeight:800,border:"1px solid rgba(255,255,255,0.15)"})}> 
          Edit My List
        </button>
      </div>
    );
  }

  if (screen==="setup") {
    return (
      <div style={{minHeight:"100vh",background:C.bg,fontFamily:"Nunito,sans-serif",padding:"24px 16px"}}>
        <style>{GLOBAL_CSS}</style>
        <div style={{maxWidth:520,margin:"0 auto",position:"relative"}}>
          <div style={{textAlign:"center",marginBottom:24}}>
            <img src="data:image/jpeg;base64,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" alt="d20" style={{width:120,height:120,objectFit:"cover",borderRadius:"50%",display:"block",margin:"0 auto",boxShadow:"0 0 0 3px rgba(150,80,255,0.3), 0 8px 28px rgba(150,80,255,0.4)"}}/>
            <h1 style={{margin:"8px 0 0",fontSize:26,fontWeight:900,color:"#ffffff",letterSpacing:-1}}>Roll for Task</h1>
            <p style={{margin:"4px 0 0",color:C.soft,fontSize:13}}>Add your tasks, then roll to decide</p>
          </div>

          <div style={card()}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <span style={{color:C.must,fontSize:14}}>✦</span><h2 style={{margin:0,fontSize:15,fontWeight:800,color:C.must}}>Must Do</h2>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <input value={mustInput} onChange={e=>setMustInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addMust()} placeholder="e.g. Call the dentist" style={inp()}/>
              <button onClick={addMust} style={btn(C.must,"#1a1000",{boxShadow:"0 3px 0 rgba(0,0,0,0.4), 0 0 14px rgba(255,215,0,0.4)"})} >Add</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {mustItems.map(item=>(
                <div key={item.id} style={{background:"rgba(255,215,0,0.1)",border:"1px solid rgba(255,215,0,0.25)",borderLeft:"3px solid rgba(255,215,0,0.7)",borderRadius:10,padding:"8px 12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{flex:1,fontSize:13,fontWeight:700,color:C.text}}>{item.text}</span>
                    <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:C.soft,cursor:"pointer",whiteSpace:"nowrap"}}>
                      <input type="checkbox" checked={mustTimedIds.has(item.id)} onChange={()=>toggleTimed(item.id)} style={{accentColor:C.must}}/>
                      ⏱ Add time limit
                    </label>
                    <span onClick={()=>removeMust(item.id)} style={{cursor:"pointer",color:C.soft,fontSize:16}}>×</span>
                  </div>
                  {mustTimedIds.has(item.id)&&(
                    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:C.soft}}>Random between:</span>
                      <input type="text" inputMode="numeric" value={mustTMin[item.id]??10}
                        onChange={e=>{const v=e.target.value;if(v===""||/^\d+$/.test(v))setMustTMin(p=>({...p,[item.id]:v===""?"":Number(v)}))}}
                        style={{...inp(),width:50,flex:"none",textAlign:"center",padding:"4px 6px"}}/>
                      <span style={{fontSize:11,color:C.soft}}>–</span>
                      <input type="text" inputMode="numeric" value={mustTMax[item.id]??20}
                        onChange={e=>{const v=e.target.value;if(v===""||/^\d+$/.test(v))setMustTMax(p=>({...p,[item.id]:v===""?"":Number(v)}))}}
                        style={{...inp(),width:50,flex:"none",textAlign:"center",padding:"4px 6px"}}/>
                      <span style={{fontSize:11,color:C.soft}}>min</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

          </div>

          <div style={card()}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <span>✨</span><h2 style={{margin:0,fontSize:15,fontWeight:800,color:C.fun}}>Dopamine Breaks</h2>
            </div>
            <div style={{fontSize:11,color:"rgba(168,122,255,0.5)",fontWeight:700,lineHeight:1.5,marginBottom:10}}>
              Breaks stay in rotation and repeat throughout your session.
            </div>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <input value={funInput} onChange={e=>setFunInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addFun()} placeholder="e.g. Read my book" style={inp()}/>
              <button onClick={addFun} style={btn(C.fun,"white",{boxShadow:"0 3px 0 rgba(0,0,0,0.4), 0 0 14px rgba(168,122,255,0.45)"})}>Add</button>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:C.textDim,fontWeight:700}}>Random break length between:</span>
              <input type="text" inputMode="numeric" value={funMin} onChange={e=>{const v=e.target.value; if(v===""||/^\d+$/.test(v)) setFunMin(v===""?"":Number(v))}}
                style={{...inp(),width:50,flex:"none",textAlign:"center"}}/>
              <span style={{fontSize:12,color:C.soft}}>to</span>
              <input type="text" inputMode="numeric" value={funMax} onChange={e=>{const v=e.target.value; if(v===""||/^\d+$/.test(v)) setFunMax(v===""?"":Number(v))}}
                style={{...inp(),width:50,flex:"none",textAlign:"center"}}/>
              <span style={{fontSize:12,color:C.soft}}>min</span>
            </div>
            <div style={{fontSize:11,color:"rgba(168,122,255,0.5)",fontWeight:700,lineHeight:1.5,marginBottom:8}}>
              🔬 5–15 min is the research-backed sweet spot for attention recovery — feel free to adjust.
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {funItems.map(item=>(
                <div key={item.id} style={{background:"rgba(168,122,255,0.1)",border:"1px solid rgba(168,122,255,0.25)",borderLeft:"3px solid rgba(168,122,255,0.7)",borderRadius:10,padding:"8px 12px",display:"flex",alignItems:"center",gap:8}}>
                  <span style={{flex:1,fontSize:13,fontWeight:700,color:C.text}}>{item.text}</span>
                  <span onClick={()=>setFunItems(p=>p.filter(i=>i.id!==item.id))}
                    style={{cursor:"pointer",color:C.soft,fontSize:16}}>×</span>
                </div>
              ))}
            </div>
          </div>

          <div style={card()}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <h2 style={{margin:0,fontSize:15,fontWeight:800,color:C.textDim}}>Settings</h2>
            </div>

            <div>
              <div style={{fontSize:11,fontWeight:800,color:C.soft,marginBottom:8,letterSpacing:2}}>BREAK FREQUENCY</div>
              <div style={{display:"flex",gap:8}}>
                {Object.entries(BREAK_MODES).map(([k,v])=>(
                  <button key={k} onClick={()=>setBreakMode(k)}
                    style={btn(breakMode===k ? C.must : "rgba(255,255,255,0.09)",
                      breakMode===k ? "#1a1000" : C.textDim,
                      {flex:1,fontSize:11,padding:"8px 4px",textAlign:"center",lineHeight:1.4,
                       border:`1px solid ${breakMode===k?"rgba(255,215,0,0.5)":"rgba(255,215,0,0.15)"}`,
                       boxShadow:breakMode===k?"0 4px 0 rgba(0,0,0,0.4), 0 0 12px rgba(255,215,0,0.3)":"0 4px 0 rgba(0,0,0,0.3)"})}>
                    <div style={{fontSize:15}}>{ k==="chaos" ? "🌀" : v.label.split(" ")[0]}</div>
                    <div style={{fontWeight:900}}>{v.label.split(" ").slice(1).join(" ")}</div>
                    <div style={{opacity:0.7,fontSize:10}}>{v.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button onClick={()=>{if(mustItems.length||funItems.length){setScreen("game");window.scrollTo({top:0,behavior:"instant"});}}}

            disabled={!mustItems.length&&!funItems.length}
            style={btn(C.must,"#1a1000",{width:"100%",fontSize:16,padding:"14px",fontWeight:900,boxShadow:"0 4px 0 rgba(0,0,0,0.5), 0 0 20px rgba(255,215,0,0.25)"})}>
            Let's Roll!
          </button>
        </div>

        {/* Why it works footer link */}
        <div style={{textAlign:"center", paddingBottom:24, paddingTop:8, display:"flex", flexDirection:"column", alignItems:"center", gap:6}}>
          <a href="/why-it-works.html" style={{
            fontSize:11, color:"rgba(255,215,0,0.4)",
            fontWeight:700, textDecoration:"none", letterSpacing:0.3,
          }}
            onMouseOver={e=>e.target.style.color="rgba(255,215,0,0.7)"}
            onMouseOut={e=>e.target.style.color="rgba(255,215,0,0.4)"}
          >
            Why does this work? →
          </a>
          <a href="mailto:rollfortask@gmail.com" style={{
            fontSize:11, color:"rgba(255,255,255,0.2)",
            fontWeight:700, textDecoration:"none", letterSpacing:0.3,
          }}
            onMouseOver={e=>e.target.style.color="rgba(255,255,255,0.45)"}
            onMouseOut={e=>e.target.style.color="rgba(255,255,255,0.2)"}
          >
            Share feedback →
          </a>
          <a href="/privacy.html" style={{
            fontSize:11, color:"rgba(255,255,255,0.15)",
            fontWeight:700, textDecoration:"none", letterSpacing:0.3,
          }}
            onMouseOver={e=>e.target.style.color="rgba(255,255,255,0.35)"}
            onMouseOut={e=>e.target.style.color="rgba(255,255,255,0.15)"}
          >
            Privacy Policy
          </a>
        </div>
      </div>
    );
  }

  // ── GAME ──────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"Nunito,sans-serif",padding:"24px 16px"}}>
      <style>{GLOBAL_CSS}</style>
      <Confetti active={confetti}/>
      {achievement && <AchievementToast key={achievement.key} achievement={achievement} taskName={achievement.taskName}/>}

      <div style={{maxWidth:520,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8}}><img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAGQAZADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD4zooo7UAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRR2oAKKDRQAUUUUAFFFFABRRRQAUUUUAFLSUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAB3ooooAKKBRQAUUd6KACiiigA70UUUAFFGKKACiiigAooooAKKKKAEpaKKACiigUAFFKqliFUEknAA713PhT4aa3q0Bvr6KWxsUwXYoS/5dF/4F+VTKcYK7Y4xctEcKaK9z0fw5o+kSIlpYxs3RpZQJHb8T0/DFX/EXw00TX/ntof7PvX+7Jbr8rH/aTofwwa5/rcL2NfYSsfPtFdT408BeI/Csz/b7J3tlP/HxEpKD/e7r+NctXSpKSujJprcKKKMUxBRRRQAUUUUAFFFFABRRiigAooooAKO9LSUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFJQAtFJS8UAFFJS0AFFFFAAaKK2/DHhfWfEN1HDp9o7LI20SFTgn0GOWPsM0m0ldjSb0RiV2XgT4ceJPFt1GlnaPFC3PmOnJHqB6e5wPevVPD3w28KeCoItQ8YXf2i++8lnHteXP05WMfXJ+lWNc8aavq0DaT4ZtF0jTTwRCSC/u79WNcrrynpSV/M6qeFb1kJZ6B8NvhnF5mqzf25raLn7NA2Qp/25Og+i4+pqjpPjjxH4o1W7hnb7Jo0VpI0Vnbx+XAh3IBwPvH3NYQ03SNPlMuoXBv7oc7VPyg/WtTwrqT3l3fwoiRwrZEiNBtUfvIxSlhJcjnPVnR7sfdRoFgJFILMciu10xv9NtCcf61MnuPmFccSzFERQoJHQV1GngpeW5JZQJEJ3fUV5r1BaHNaD8QrzS7+58N+NNOk1HT4p5YoJn/10abyAA/8Qx2P61J4n+DfhzxZZSax4Hvo1lPzNCi4IPo0Xb6r+VVNT1KJNe1Sy1OzS8t1vZ1GR8yjzG6H/GrOlWD2t0t/4V1F1dfmMDMVYe3+ciu+eGrUfep/8AfLCqrM8L8U+Fdb8NXJh1WyeNd21ZV+aNj7HsfY4NYlfYMPibS9eT+y/GemqJXXYZ/LG4/7w6OPz/CuC+IHwJt7iF9U8HXcbxMCwjBLRn+ZT9R9Kuni03y1FZnLVwsoarVHz3RWhrui6pol6bTVLKW1l7bxww9VPRh7is+uzc5QooooAKKKKACiikoAWiiigAopKKAFooooAKKKKACiikoAWiiigAoo70UAJS0UUAA60UUUAFFFFABRQaKACiiigAooooAKKKs6bYXmpXS2tjbS3EzdEjXJ+p9B7mgCtWhoui6lrFx5On2rzEHDN0Vfqegr1TwV8GZJIE1TxTewWVn9753wh9hj5nPsvHvXar4h0rw8I9L8F6dvmX5VuWiBlz/sKOI/ry3vXNLEXfLTV2dNPDSlrLRHNeEvhFp2kW8eq+NrpYUwGWBly7/7sfU/V8D2NdLceMUt4307whpaWEO3yzP1ndfQvj5R/srge1UfEuk67bXCXHih5Yp7hPMELPufB/vc5B9jipdM0NJrWS71a+XSNNhQMVjXdPLnoqr6n36VawycfaV5XXZHXGMYaRWpz935as1xqtyJ5CciJTx+NZ2o6vPMnk2yeXF02pwPxNehaVZabdQH+zfCsNpaKf3upapMzMg9dxwuT6Kp/Gsz4h2uiy29nBosIuBalmu74r5ayMcAIF/ujHGeTyTjpXVhKsJ1VSjHQVVTsecJDcXEhCgt646V1ngmya2bUZGwG+yBcd+ZU7fhVO3E8mI05AGAANqj8BXQ+GbOaNdR80gFreMD/v4P8K9TH0owws7djnprW40qxmTJ53D612FusqGMnbKAQa52Gyj+0oZD37mulRQkYO8FcV8Wzc57xrp6HxNqx8vb/pkp3AerE1zvl3FrIJIHIIOQVOK6/wAZpKnijVjG6sv2pjt9M4P9a5qUo74kVkJ7ivuKVLnpxuuiOZvU1LLXxcQfZ9ctRcxn+PADj/Gt7Q7i905/tvhzUGmjHLQO2GH1z1/H8644iSNNuFkX3HNSW00kEwltpWhdehBxXFissp1NIo6KdZrRnod/d+E/F9q+n+I9Mhtblj85aMbCfUr2PuMH3ryf4hfAa/sY31HwzKLm1PKxs+Vx/sv2+jY+prvdHvYNemWwvrePzwpZZ04YflWnHc+J/CU48iR7iyPOzGQR9Oh/DFeBKnVw03CDv5MudOnVV+p8kalYXum3b2l/azW06H5o5UKsKrV9g6laeC/iBafZdUs4IbjopI27W/2SOUP0/wC+TXkHxE+BOv6KXu/DzNq1nkkRceev07P+GD7VvSxUZvlejOKph5QPHaKfNFJDK8M0bxyIdrIy4Kn0IPSmV0mAUUUUAFFFGKACiiigAooooAKKKKACiiigAooooAKKKKACiikoAWikpaACikpaAAUUlLQAUUUAE9KACpLeGa4mSGCKSWVzhURSzMfQAda9O+HvwV8TeI0S/wBVU6JpZG8yXC4ldfVUOMD/AGmwPrXqFqvw6+HtsbbRLJNV1DG153fIY/7T9W/3Vwv1rCdeMXyrVm1OhKZ5t4F+DOq6lCNS8QyDTbBOWUsFbH+0x4X6DLe1egRah4O8HWwsfC+nw3t0Os8seYt3qEOS593z9BWLr+ta54il86+uTDaqMIn3Y419FQcAUzw3ph1G7W30u2klZm2tO46n0UHr9TwO9NYec1z13aPY7YU4U9ty4q654r1ZJtSnubjewBj3nc/PCjHI9ABzXfmKy8H/ALvTrK0j1uTkRRLujsh7sclpPck7fc1XS8tPC1sbLRpY59WdSJ71TlbcdCsZ9fV+/ReKx9Lv9PlL7tQijlLkSSSq3Ix1BAPGc8Vi6fPF1FG0F+Jve24s9hNLLHrWtXSQWkcpkea4BeW5YdVjTOSPc45603S7u01ohNOsr7J4j3ASFznvjofpmtDV38M3F0t9qOrXerTogSK1tITGigDgbn6fgprIk8Q6qN1npNlDodieCIgQ7A9dzn5m/Qe1aKnPFJKK1W3RL/MHFbstfEay/s+x06z1G7nmu1LMbaOTctumPunHG4nk46dK495by9iS2bbFax8pEvQe59TXTzKs9okUUEhY/wCsml+9J7D0FNh07kAgD2Wvawbw2CpWqyXMYzTlpfQztLsCq44G4enNbenxhbPUY4vLEgSEe/3z/hWppXhrUr7CWmnXEqnj5UPP412GjfCrV5Buljt7JWxu3Nlj+VcWY51QqUXSp63BQUUeeWFgxnQlixz1xWoYdq8NjivUb3wvovgvSm1nVX+2+TgJFjG9z0AHTP1qvF4f0jXtOi1XTmFtHcLvVAuQD3B54Oa+Z9ourC1zyrxk8cviTU1OC3mqT2PMan+tcrdxMOhz7EV7Jq3gB5HaT7NFctgAurfMQOnoa5PUvBnlEqwuYG7BhkfrX1OEzmh7NQk2mjCdJ3ueftIyxhTGNoNTQmKVxkGM9Oa37rwrfxjMUkUo7A/If1rLudI1C2BM1jMi/wB5V3L+Yr0qeLpVdpJmfI0anw/064l8XhYEeVNmWaMZ2j1PpXR3msavp/ijUrDxFYTjRJbphZXIjJ8qPgAkj+HqfUZ+orgtPsrd7hpJNTu7KUYCNHnA+pHIrp7DU/GdjHtsPEseoRdo7giTI+jc14mYYSpKs5wWh1wasjS8R6FaKovI32xkDZdwEHHpuxwR79Kq6f4i1/QR5d0BqFiwwHHIx7jn+v0p+nePLy1v/wCzvFGhQ21sy5+0W0O0EtxyM4I9RxXTXeg6da2X9oafDeSW0qCUJbL5qlSMgiNucfTn2rhnyv3K8bPuaKTXoc/rfhbwJ8TLXzLyFLXUiuFuImCyj/gXO4ezbvqK8O+I/wAE/FfhUSXllEdZ0xfm862T94i+rIMnHuuR9K9iudPtLmUz2TvZ3IPbgE/59ea0NJ8ZaxoUwt9Wj82AH75GQffPb9PrQ1Xw395GU8PCrrHRnx6eD3pK+w/FXw6+HnxKt3vISmiaw/P2u3ACux6eYvAb6naf9o189/E/4R+MfAUjT6lY/a9MJ+TUbQF4fbd3Q+zAexNdFLEQq7M4alGVN6nAUUUVuZBRRRQAUUUlAC0UlLQAUGikoAWikpaACiiigBKWiigAooooASlopaAEo611fw++Hnizx3emDw9pck0SHE13J8lvD/vOePwGT7V7z4f+Gfw5+GsKX/ii7h8Sa0nzCN1/0aNv9mP+P6vx7VlUrQp7mkKUp7HjXw3+Eni3xsEu7a1FhpRPN/dgrGR/sDq5+nHuK9k0jw/8OPhhEJ4UGva5GP8Aj5uADsb/AGF5WP68t7iqPiz4na14gdrTTA1taY2YTj5fTI6D2Fctb2klxNjbNeTk/cjUvg++KzUatbf3V+J2Qowhq9TW8T+NPEPih2i80wWuc+WmVT6n1PuaxYPJtX4AuZ/7x6D/AD7Vtx+F/ENzhW0828f/AE2cRj8uv6VbTwaYAPtWrQq5PMdsm5vzP+FddJ4bDLVoqUpPZGdocljPqg/tyyudQj2nyra3n8rc/GATgnbjPTmu8XWtXhs5bHTLPRvDtpLGY3EcfmSshGCpY7mI9his7SvA1y5R7LRr2f5hiSZtg+vOP5V2el/DrV5UH2m4tbJM8rGN7f0FedjcbQqSTT0XQ1p3itVqeYX9nfuPslvueDOWlYbDMfU56D2pLfRptymV4QB/CF3V7vpfw30WEh72W5vWHZm2r+Qrr9I8O6ZZgLZabbxnttjBb86mWeVFDkppJCcVe7PB9D0LW7qJU0zTJ5FPG9Ytg/M4rqtL+GGu3LrJeSWloT1yd7D8q9evGs9Mj8zUr6z0+Md7qdY+PoTmuX1f4q/D7Ssj+3G1CRf4LGBnH/fRwtcEsTiKvUbkV9I+FWkRMr395c3bDqq4RT+XNddpPhLw9pwzaaTbK395l3H8zXk+s/tCWMO5dI8PjHaS9uP/AGVf8a43Vvjh4y1PctvqCWUZ/gs4AmP+BHn9aSoVJbon3mfUyW/lKo2CNewxipFByFVc5rwL4AW+ueI/FE3iLVL68ltrJdoM0zP5kjdBz6Dn8q9Y+JviNfDXhaa4jcLe3OYbYdwSOW/Afris37t7icdbHlnx08SDVdbXS7SQG0sCVJB4eX+I/h0/Oo/gzrvk3Mvh+5kyk5MlqT2cfeX8Rz9RXH2Nhd6rcrDawyXE75KqoJZscmq2J9P1NZF8y3uoJAyk8FGB9K5udNnTy2jY+i449zZ4/wAKdJbvNGQqCWPODj5gKoeFtVi13QrbUowA0g2zIP4JB94f1+hr5n+Kv/CS+AfHl0+nahfQ2105uLeWOZlOCeV4Izg/pitaVJ1HyoxbsfTFxoOnXIJezRD/ALA2n9KyrnwpAhJt52T2Zcj8xivn7Qvj94ysMJc6hFfIOq3sAfP/AALg/rXeaH+0TpNwB/bPh0oT1ksbj/2V/wDGt3h61PoyOZM6nU/CZlyJtPgul/vDBP64P61zd94M03Jws9k/uSB/49/jXX6Z8Ufh7qwXZ4g+wu2Pkv7dosf8CGV/Wurs0i1K3E+mXNtfwnnfbTLMuP8AgJNaU8diaOzY+WLPGLjwfqZt5Ire5t7y3cYMcwI/I8jNU0tfiNoeBZahd3FsvCxy4mRQOgHXAHtivYbvSLPzS32cRS5+8mY2/TFVWsrmM7oLxuP4ZkDj8+D+tbTzSVa3tUmVGLjseW2+p6jq7s+q6da211E21pIlKmXjqQT2rQNussJikVXQ9iK7u63HK3uk210o/jicbvyYf1qi9r4akba89xpz5x+9UqoP1OV/Wuyjj6PKoMylGSlzI84n0S6sJftOkStERzsH3fy7fh+Vb/hzx/f6YPsOswBoHBRkkXdGw7gjpj6fka69PC7TL5lheW94nYqw/mMis7VPB8tzGy3Fi3T7yjcPxxUVadGq+aD1LjVvpNHE+Mvgn8PviBC+o+DbuPwzrEnzfZ8brOZvZR9w/wC7/wB8183/ABD+Hfi7wFf/AGbxJpEttGzYiuU+eCb/AHZBwfocH2r6XuvD+raHcNNYSuE7o33T7f8A666LRfH8M1nJoXizT4r6xlXZNa3cYdHH45/r+FTGvUo6T1XcyqYWMtYHw1RX1V8QP2dfDniaOTVvhZqkdncspkOj3svyN/1yk5x9Dke4r5s8WeGdf8KavJpPiLSrrTL2PrFOmCR6qejD3BIrtp1Y1FeLOGUHF2ZkUd6KBWhIUUUd6ACiiigAooooASlpKKAFopKWgAoqWytbm9u4rSzt5bm4mcJFFEhZ3Y8AADkk+le7fDj4GaZG8d/8SNaFoB8w0fTz5t03tK65WP8A3Rlv92onOMFeTKjFydkeO+EvC/iDxZqyaX4e0q51G6bqsS8IPVm6KPckV9H/AA7/AGd9D0QJqHjq4bXL9cMNLsS3kIfSRx8zn2XA+tep6JrOj+HNKXSfB3g9dPsk/vssIY/3mxlmPuxzUV7rPiW8XH262sVJ+7aw7mH/AAJv8K8+tjo7RZ108M92ipr1r4xvNNTSvDmm2Ph7S4l2xq7LCiL/ALKJnFcBN8ONIN2ZfE/jX7ZcE5aCzTJPtnk/oK7hdLS7uB/aF5d35zyJ52K5+nSukttIbyytjpnlQKuS6RBF/E9K4ViuV3judfK0rHntj4b8NWUYXSfC1zd7f+Wt42B9cMf/AGWtaPTdbZBFC2n6ZB2S3i3t9Ow/StnVNc8LaNEU1nxVo9sykkxRzefIf+Ax55+tcrqvxm8AaYG/s+21jVpB0JC20X/j2W/SpdWvVeg/dR0mm+ELOUCTU7y7vG/iDSbR+S12GheGtPt1/wCJfpqbvVIsn86+fdc/aQ1PlNC0bRtNHZvLa6l/NuP0riNb+LHj7xF+7vNZ1OaE/wDLJZTDH/3ymBW9PLMTW3JdRdD7A1S80PQ4idZ1rS9OC87bi6UP/wB8glv0rkdR+LngPTw5t7jU9Xdf+fS18uP/AL7kI/lXytaRajdybpXihJPUDLE/U1cuNNQoftNzPJxyCxAr1qHDcmrzkV0uz2fX/wBo1Yd0ejaBYWpz8sl5M1w/12rtH864bXPjZ461hWiXW79Im48uzRbZP/HQD+tcRDp9tHAssdsoy23LEHtnpUvzKwXJUdMLwP0rshk9ClurmMpElzqWsXkhlnIDt1eZy7n8TUIhllP768kbPUKMCpUiJ5/rVy2RACu0EnHzHqK3WHhDSKSM3JkNrZQqQBHu92NdN4f0x7i8ht4YRJLK6pGij7zE4AqrZWu8jjNe5fADwmDPJ4kuovkgzFaZHV/4n/AcfUmuTFuNCm5v5FRTuep+C9Cg8PaBbaZEyjy13zyAYDOeWb6f0ArxP4meJG8T+JJZItxsbf8Ac2w7FR1b6k8/lXp3xd8Q/wBkaB/ZUEuy91BSGweUh6E+2en514lPdWGm6Td6pdKPJtU3EE43t2X8T/Wvkak23bqdNKP2mcR8V/FE2gWMGlWMm26nxJKR/CnZT9euPpV/whraa54btr7zS11Evkzqxydw6H6EYP8A+qvHNY1GbxDrlzqV25bexbB9+1aHw61w6Jr4hmb/AES6wkgzwPQ/h/LNepLL+XDp21MVXvU8j6d+EviJdO1n+zrlwtpfEIcn7kvRW/HofwrovjV4UHijwtMsMeb60zLAe5wOV/Ef0rzGCBXOYyQGAIIP9a9r8F6udb0BJJ2ze27CG59SQOG/4EP1BrzITcJKS3RvOJ8VXkJR2R0UkdQw5qjJbQschWjb1U17J8fvBY0bxIdSskC2d+TIo7I/8S/mc/j7V5a8JDYkQ/WvssI416akup5tSDizMQ3cLZhvj9H/AM/1q7Ya3renSie3MkUinIkt5CjfmvP61IbMOCVqrJAysSAwI611yy9SWquRzyR32gfHXx3pO2OTWri7hHHl6hEtyv5sC36132h/tF2s6bda8MWczd5LC5aBv++W3D9RXgSEv8so3D/aGagmtbYy4EI+oOK46mSUZK6VjRV5I+s9K+K/w+1fGdVu9KlJHyX1qSv/AH3HuH8q6zT0sdYt2Okahp+pR4z/AKJcpIf++Qc/pXxJDY7ZB5VzJHns3IFSq2p2speJw7IeGRirD8RzXn1eH5rWDNo4nufY13oMMLh5LZ7aTP3lBjcfiMGkS91uzXda6xcSKOi3CrKPzPP618x6J8ZPiB4eVIotbv2gX/llc4uI/wAnzXZ6P+0TLMVXxB4c028APL2rNbP9ccr+lebPAYikaKrCW57rD4vvvLC6jolhfoeCY38tvphsj9aq3kXw212Nk1HTNQ0l88uEO1T9V3AfpXnmn/Ff4faoQHutV0hiQStxAJo/++kOf0rr9HvdF1li2i6/pN87DOyK5VHP/AHwf0rH2lanuikovZlrTfh2sU32jwb45s7tQdywXJw35qc598A10mp+G7rxHox0L4h+FINZsQPlkBEjRn+8ki4ZT78H61zur6Q4jEs+nlGX+Jo9p+uaisdV1jTQFsdYvrfH8Bl8xfybNONdJ82zCUHJWep5B8Vf2W9SsxPqnw7u5dWtlJLaZdYS7i9lY4WT6cH61846jZXmm3s1lqFpPaXULbZYZoyjofQqeRX6C6f8RPEVthL2CxvwO+DE5/LI/Ss/x7H8NPiRY+R408OXVvdKu2K/hQGaH/dkTkj2YEe1ejSx0Ho2cU8NJbI+AqK9c+KnwQ1Twzb3Gs+GNTt/FGgRAvJLbcXNsvrND1AHd1yPXFeR13RkpK6OdprRhQaKSqELRRRQACiiigBKWiigD279lHSEuLvxXr3lq8+ladF5ZxyiyzBZGX0OwMM+hNe/QWgDCOJF64AUcZ7CvM/2BbeK91DxvYzgGK506CNx7F3B/nXptj51l+4mY/abWUxSeu5Gx/QGvEzNPnTPRwb91ooeI9f8KeGJpbTxB4jtobuElZbW3Rp5lb+6wX5VP1NcTrHx08L2iNHpWhXV8R0kvJxEn/fKZP8A48Kxv2s/DxXxBp/iezU+Tq9tmQE8LOhw30yCD+deLf2S8T8xiU5xuZuv0FGFwUaquVUqyTsj1LU/j54nmDJpMdjpYP8Az52gL/8Afb7j+ori9c8X+MfEMpfVNU1G7Df8/FwzL/3znFUbSyuHfYFEe3lio6CrqRoZSAd4jXnnhf8A69exRy6nBczRm5S6mVtuyC0tyUHcKKkjsYXdfN8yZup3HpVqKOS5nKLglecentVgQeSu6Q8g8+pr0KOHjzWRGrK8cUaOAkMMS5xuK5x+dadjaNcygGVmQdhwPyqjb28lww7Bjx7Cup01I7SDbg5xgkV72Hw8d3sdNGnfVj4fLtY9oUKVHXvVGRxPLsZwFByzZ4pb6UYOM5Y1EEi3fuQ2zr83UHuPeoq1dbIqcr6FmeSKRTsRogX3BA2VUYx35z71CkRzvC+1LGoJ+YkenFXrdCoBPQc4rna59zKTuQpEDj5cHFXoLfEmBhsdx0NLFCQxL8E9q2NLtGdgMZyelc0kQjX8FaLc61rFrplquJZ3278cIvVmPsBzX1Np9tp2gaCkQIg0+wt+WPZVHJPuf5muG+CPhldP0o65cRhbi8XZACOViB6/8CPP0ApPjT4gCCHwtav8zgTXuPT+FP6n8K+RzXF+0qNJ6I2jC7seZ+LtUvPEfiG51OcEec37pOuyMfdX8v1ryb4568YUi8L2sm7y23XRU9ZT1H0UcfXNeqeI76Hw34YutfuGCtGPJtUP8UpGQfoo+b8q+Y3nk1G/uL+5LOXY7STzn1rnyvD+3qc72ReJnyR5UTWlqoth5fJCHdn1rMdSJMZwynIPvW/poAiYE9VNYt7xeH7x5r6upSSppnntWSPbfhL4hTVdAWzmw91ajnP8S/5/kPWvSfBWuJo+spfsWFnL+5ulH9wnh/8AgJ5+ma+X/COuNouv293CpWMsN4B6+v8An6V9B2+y+s4p7eRWimAcADivkMww/sKt1sz0qE/aRsz1z4h+G4fE3hy505gpmx5lvJ2VwOOfQ9Poa+TtUtpbC/ltZ4yjRsVYMOQR1FfVPw51Oa90Q6ZcuGurAAKc8yQnhT9VPyn8K8v/AGg/CghvI/ENumI7htlxtH3ZPX8R+o969LI8YoVPZSej29TCvTbXmeU2rQYKFVIK5z3FEunxzwkwgkgcjHX3qq0ckWOMjsRzmtbRpF+0Kk0y26NxvZSQPqBzX6Bh6ia5ZI4jl7rT5ojkI3XApscHkyr54Cg8njkV2d+9pKfLBTepK71+61c5reJNkflhWTuD1FazpRj7yFaxSvBHHM8MUecHk96i8x1kQlB0wfcUBdp4BzQJbaJ4zdlwhYAleuPxrmnVUU5S0GldiXcRMRdlGCeMVmNaRythoR/Ku417QWtrCHUbKX7bpFwdsVyFwyP3ilA+64/JgQRXOm2+c7eoNcrjTxMVUpO6KlCSdjn5LPynIR3jI9DxUYmvojlJg2PWtaaJpJ2wpz3yetUrmBlbhhyK8uvhk90TdrY2fD/xH8Y6AQLHWNRgT+4twxT/AL5Py/pXcaP8dtVLKus2GnX56F3h8mQ/8Cjx+qmvKHjdQD29ale2DoD8hG3Ocda8urgIS6Gkas0fQGmfFjwfe7BdwX2nP0LIVuFH/oLfoa7DQ9Q0zWoZZ9D1S2v1iXfMseVdFzjJVgCBk18iGDKMygjHQdia+nPgXoh0X4WjU5srdaxOTGf7sKcD823H8q8fFYaNFXTOqlWc3Y6G7WbfGtsm66eVEh453swA/n+Wa+Tfi5okPhv4oeJdBtgBBY6nPDEAMAIHO0flivtn4bad/anju0d+YtPja7k9C33Yx+ZJ/CvkH9pfH/C+vGeP+grL/SuzLU1Fvuc+Md2ked0UUV6ZxhRRRQAd6KKKACikpaAPpv8AYHvILHWvGVxcvshi02GR29FWU5P617T8QLNbTxq7pxDqUQnUj/novyvj6jaa8B/YvAeT4gQno/h1gf8AvvH9a9t0bVG8S/BrQvEEjebe6Mwhuz1JMf7qTP1Ta9eXjlzNxO7C6K5m/E/QV8R/CLULQKWn0xxew5GTt6OP++ST+FfMn2V/JikYgMuY2ye4r7J0Jo/tnkzqXtrlGjkB6MjDH9a+V/Heiy6F4n1fQJB80MrGM/3tp4P4jB/Glk9Rc3Kzoqx1uZOryxW+mpHalVZ8ZI6s3+FZtvFILYR9W3c89Se9OslhubhfPdliRR+JrQVIJ7hbaOJk4Ko+4Ae9fVVrN6HPN3dzR0e2htbdljCnePmdlz1Hb0NY+on7RckRjEa8Cta9mFlElsuHwuAAe/v712Xwk8OaTFDe+M/Eqb9G0cBvKOM3M55WMZ49z+HvTnOGGoupL+vI1p0+Yk8A/CbX9Y02PUZvJ022cAxtcAl5B6hBzj64q14w+FfiXRLCTU7a6t9UtYFLzCEFXRQOTtPUAc8HNQ3Xx88W3GrM9rZ6ZBYbjst2g3bh/vZ3E+/H0r6A+GHiGw8ZeGYdVto/KYnyrm2Y5MUg6g+oIOQe4NeFXzbMqTVSStDsdHMmrI+OpZRIwwcjqKuxKoRVAGcdP61J4htIrTxNqtpbx7Et7uRFX0G44FdF8MvCU/jDxTFolvdx2szwSSJI6FhlFzjA9ema99YiPs1Vls9THrY54ICw6A1dhHGCAfekeIwXk0Eq4khlaJwezA4NWbSMsRgZ71o6ikrx6kSRYtLZmxx3r0L4aeF31rXbayZSIW/eXDD+GIfe/E/dH19q53RbYNgyL79O1fRnww8OnRtER5o8Xt6A8oI5Rf4U/AHJ9ya8nMsV9XpabvYaVtTd1rULTQtEn1KVFSC0jAijXjc3RUH6CvB4Le/1rWJb65kEl5dzbjnsxP8AID9K7H4sa5/aevR6FZyBrOwb97g/fmPX/vkcfXNeffEzXIvB/gW4uLd9moamGgtuxSLpI4/3vuA/73pXw826s1TidVKKhHmZ4/8AHnxUmta6uiabNv06wBijI6SHPzyH3Y8/QAV5/H8oVUHyr0NQs7yTyTyMTI+T9KdaBfMAc4GetfZ4LDKjBQR5tWbnK5p27hRnI3Ffu1j3XM5zV6Zo0vCVb5QMDFVnTM3BB75r1Jq8bGcintLZQV7L8CPEZnibQ7qTD5/dMfX0/wA+pryGVCsjYI4PUVc0e9l0nU4r2FyuGG7FePj8J7am4mtCp7OVz69sJ7vT9Qg1G0hLNbnEq/8APSMj5l/L9QK7fXNOsNe0SazYiW0vIQUk+vKt9QcflXH/AAq1W38SeH47tGV5cKkydeezfjg/jmu20iD7I0mm7lMUm6ezx0XvJH+H3h9TXxlKpKFRwejR6dVJrmR8n+JNLutC1i40+8Uq8LlSAOPr9Mc/jWJNcKAApYHPevoD47+Ghd2ia9DFl4RsnwP4ezfh0/Gvn+9jUM21MYPSv0fLsa8RRU09dmeXWhysYbhgdoJU96fJIsq7MLkjk45qkt0bPUIJ3ijmiV/nWQbgR7j0r2jQvhh4d8Q2sGvWWpXVvY3I3G0RQzRMPvJvPYHpxnGK66+cUcM7Vbip0pTV0eQQWbTTCOFXd2GFUDJJ9gK7vQfhDqmrwpLrEq6batglfvTEey9F/H8q9n0Pw54d8L2TyWlrb2gC/vLuZgXI93P9MVxXjH4vaHpfmW2jRnVbkceYPliB+vU/pXz+Jzuvi26eFhZfj/kjqjRjBXkdFZeG9F0TwmdCiiQ6agJk+0EHfnqXY9fx6dBivCPHEHhuw13/AIpvUXuoQf30WNyxn0V/4h/L1NZnjHxl4i8UyH+0r51t8/LbxHag/AdaxoVVIcINuOmK6snwGIw8/aTlv0M6tWMtEi5NbqW+1Rthcn5cVRu2B2qdpGeeOalSSYNt6Kw6Gh0jkQsR8w4r6KrFVI6HPuULpVCHaMr1qojAccYNXbjmIheBVa3hM0yxjAGcGvGrLUlmjoumvqGrWGlW8Zea5kUKAOpYgL+pFfXWr2sNhbWWi2eBBp1ulqoH+yOT+J5rw/8AZo0b7f48uPEE4H2bSIWnBPTf91B+ZJ/4DXr+sTSurtB89xcuIkU95HO0Y/E18pmE+aryo76EbRud58Ivs2meHptavW8s6pfJbwEjllB8uMD6sWNfDv7R7b/jt4zbP/MXmH5GvsbxxqMOmePPhp4Es5AI4rlLudQeSE/dx5+rFz+FfGn7Qh3fHDxmf+ozc/8AoZrvwmmnY48Rrr3OFpKDSV2nMLRSUtABSUUUALRRRQB9C/sUn/iaeOV9fDrn8pVrsP2Z9eQap4j8H3jF4L6E3cSnpuUmOUD6oyn/AIDXGfsUn/ifeNV9fDcv/oxKwfA2syeHfiXpWrNkRxSkTY7xMxV//HSfyrgrR5qrXkdtDWB9JaJJILUWcxPn2Tm3kOeSVOAfxGDXnv7Suj+XqmmeKoYwVuYhHMcdHTA/VSv/AHzXplxClr4wkUqDHqEIdSO8kfB/NSD+FHxR0hNd+HGp2caBprVBdRDGfu53Af8AAS1eXh5ewxKOyXvRPlRbOOO6IePEKncMDqDzTmmijkMyR/c+5uq0Xkks41wCUYxyN6Y6Vk6gzGRlTBUenc+v9K+yi1JpnK1ZkqSC7vDKW3Khzk9ya9g8cWF1bfs8eHYbSFvLurk3F069i/3c/hkfhXjunrtCx4GRy31r6T+FHxC8MQeB7XTde1G3sbnT4/KKTqSJYwSVZRg7uOCOuRWOduoqEJxV0ndnTT2PDpvCN5pvh2z8Raisdta3s5gtI3yJJAo5cDH3e2e5New/s0XDWPiW50os3l3ll5+30ZGGD/3yxrzr4qeMf+E/8YRy2UbxaTYL5Vsp4LAdWwOBn9OB2rvPgXm38fabO5/1qyRHPoUOP5CiaqYjLakqkbdV8jSMbJnl3iYCT4g+IiV5OoSjI/3zXsP7M+gSprl34mmAit7WFoImbgM7YLH6BRyfeuGuvCl/qXxk1jQ7eLE02oOVY/dVNxJY+wBzXpnxv1+z8B+A7bwdoTbLu6i2HafnEZ6k+7nP4Zrz6+LbwcMPDWUvyFZI8f8AH1/pGpfEHVrnRhILWa4LbmAAY5PIx2PUVJpkBUhgm7nv3rG0GwkEaSv8zMeCe57n6V3WgWTTSxRRQlnYhVUHJYk4AH1PFexRp+xoxjJ7Iymrs7P4TeHf7V1pJ7iEfZLPEk2ejN/An5jJ9h717B4y1v8A4R7w3LeRlTez/ubRfVz/ABfQDmm+DNBj0XRoNPBBk/1lxJ/ec/eP0HQewrz7xXq48S+J2liy9jZ5htADwcfef8T+mK+MzLG+1m59NkVThzyt0Od0LTw2psLqfZDGrXN3dN0RFyzuT69ePXFfPvxd8WSeM/Gs80e5LKI+VbRZ4jiXhF+uOT7k17D8fvEK+GfCKeGLOTbqOqKs13jgxw5yiH/ePzH2C182RsY5MFSzNkN6nNdGR4Nyft5/IeJqfZRUf77Y4GeBUkKA7ue2elJIu1yAatGMbQwXC/WvraVI86xWiB3biPqPSpkLJIMYBAwMKOhqNCfMYDIU9ql35kiULgjgEda0jogIpkBlfHIB4qMxnlW4qd0ZLgqwI9RVgwqyCUnCnv61MqXPcVj0z9nHxeNB8Qx2V65+yy/u5Rn+Anr9R1/P1r68u7DzbQfZmSKaMia3kHI3jlTn0PQ+xNfAOlxzQXCXUL4dDkNX2r+zr4qh8VeD1sriRWvrBQME5LR9B+R4+mK+LzvASo1FVitzvpVLws+hs3UMGradhoMwXSMksTfwHo6H6HI/KvmT4g+F5PD+u3FoQSgO6NiPvIehr6w1G0On6uRz9n1Bh9I5wOD9HAx9QK8/+MHhz+2fD73MMW67swWGByyfxD+v4Vpk2O+r1VzbPRhOKkj5R1G3UowZTtbgkdq9N/Zw8UG11J/CuoT4iuXAtyx4EnQD/gQ4+oFcde2bFvL25JOBWVJZXVtfJdWsvlSIOWA59vy/pX1WOwP1ulaO5y0p+zlqa/xG8R63rmv3sV/cTJDBcPHFa5ISIKxGMevFc39kmjhSWS3lSN+VYoQG+hq9q5u7u5nnuZXe6mJaWRvvMx6sT6mux+AGvpBrUvhjVlimgvTsjEwBUSj7p56Z+7+VPENZbRThC9tykvazabOFjtFkXcRile22DhRXYan4r0KLWLuw8U+Bo7KWKZo2aylaJ4yDj3VvyFT2Om+DNc+XQ/Fn2SZjxbapDs/DzF4/Ot6WcUEl7aLj8r/kaKktkziXCFSrKcgcYrOBCFlKgkAj/A16HqvgDxJZp5wsBd25XIltXEikeox1FcTqlm8ErZVkZWwQRgj611SxNKtG9KSZlUg1qZki9gODzSwxeTBNOV5xtT3Jqd1VkDhcc1o6Fps2seINL0S2VmmnmXj/AGmIA/mPyrz8S1GDkzGMbs+gPgloa6D8JluJBtudVm8xuOfLXIX8zuP411XhWzF/44sIAuUsUa6f/e+7GD+JJ/CtPVLaC0s7TS7THkWUKQIOgIUAZrCi1geHPhz4o8Z5AnlV0sye5H7qLH/AiW/Cviqf72s5HoS92FjzrS/E3/CT/tZ2d/FJ5lqmpiztz1HlwnYCPqQx/GvCPjy2/wCNPjFvXWbr/wBGGu+/ZrjL/GLws7EsTek5J64PWvOvjW/mfF/xe3rrV3/6NavYwytKSOHEdDkKKKK7DmDFH4UUUAJS0lLQAUUlLQB9AfsUE/8ACT+MFHfw1N/6GlcJqDsupzODgB5F/DP/ANeu3/YpbHjDxWvr4auP/Q0rhL451O6B/wCekmAfrWNOHPibeR34bWJ9V/apJvA+iasWzPaQQys3dtqhX/NTmuwsp1kuYyWDwTR7MdQwYVwHge4W58K21nL8ym0R8e2NrfoR+Vb/AIJmZtK+ySMDNYyNbn14+6fxXbXjZlS9nVujqpvSx4V4x8PnQfFGsaO3QufK9x1X81Irgp42F0EYYCt+Qr6A/aS0wR3OleJYl5kXypiB/EvI/Qn8q8R1aAi8ldMlHw64/un/AOvX0mWT9tTiZyhdlfTwrSsWGD1PtWkLBdQBSRQyJ1warafasqdSC/WuqsLaG2tEDcO/zj/dH+Jr6mnSUo2lsdVOmuXUqWGkW9iscaAr0Y57D0ru/Cuox6PrFjqTL8tvMjn/AHQw3fpmuYsUkvtRQ+WRGCAo9feuomtoI49k2VYceuaVagqlNw6M1UEloe8zaZoGh6jrHjmTO+a3Ek0ucgRqo+57thfqcV8q67qdz408XX+vXr4R5SE7hQOMD2AwBXVeMfFXiST4ev4WtyJ7USJskBPmLGP4D6qOo7jHtXMaJYG3s4o1XCgD8v8A655r5HAZZPD1XKqttjnkuXcv20AeQImfLUBU47V7F8F/Dxad9ZuY/ktjsgyOsmOW/wCAg/mfauG8H6PPqV/Ba20eZZXCqSOB6k+wGT+FfRGk2Vjo2kpDu8qysYS0jn0HJY+5OT+NRnOMcY+zT1f5GT7mL8StWk07QF0yzYjUNTBQbescX8TfU9B9a4uBtL0LRptVvl/0LTIBLKoOPNbosY92bA/M9qq6hqV3rviOTWZQyrK22BP+ecYPyr9cc/jXnn7QfiIv9n8G2Dqq27mXUDGfvz4xt+iA7f8AeLelfI0qMsbiI0oHQl7OHmeU+NNavfFXiC91zUJA89xKzn0HsPQDgD2ArlXR0nWRSVZWyrDqCK3biJkTapIHfFUntyx6Y9zX6XSwsKFNQWyOKa5mZt558582eQyOAF3EDOB0qMuSoXJ6V1dr4a1Se1Z49Lv3TGd62zlfzxWNNpc0buHjZWU4IKkEVXNBu0XciVKS1M1F3Ekklj61Zs4d0hkIJK8j61MltsbGB75FPVzDcbogQ44FWopaszUbblSeaWZzEWC4HAxilnjxCgyd2cBe2KntLYy3IIBY5rqJ/CWrnQ49Z/s65+w5IE/lnZ+fp79KwlVgk3NjVNyOdZXgto4wzc8sO1eifA3xXeeE/GFrdxktEWwyZ4dT95fxH64rgp0lhIcghguAafps8iOu1iGVs1zY+jDE03A1pvlZ+jdxb2OvaEk8Dh7e7iWSGQdRnlWHuDj8RXKSrJLHI10qi5iYxXKjpvA+8PZhhh9a5P8AZc8crq2lHwzfyjz4wZLbJ693X/2YfjXpXjCzS1ul1MDEEgEN3x0XPyP/AMBJ59ia+FqU3B69NGaL3Zcv3Hyz8WPCp0XWXktkItp8ywkdAM8r+B/QiuCubci3MjAnj9a+pviH4fXWNDnsin+kxZeA/wC0B0+hHH5V80apAYZnhJdccMp4r7fI8aq1Lkk/eRlWh1OalDSZd2OT3JqjcRS2NzDqMOQ0bAsRwfrVzWLie3aOSABREwZzgE49a9f8G+C/C/jbSYdaSeeGNwEvbGEAKsw+9tbqqsMMB2zxW2PxlClFwrJ2a3JpU3LVMx9V0K5+IGmWHifTbP7TfT/6LqMaYH79RlZeezJg/UVq+Evgjp9neQ6n4jlFxMuGSzt3IiUj+8w5Y+wwPrXp9nbeH/C8VrpFl9h06KYhYIfMCtKx6deWJ9a83+JfjfXPt+oaJpRfTorR/Lkl24mkOOSCfujntzXztCvi8fFYSjsuvl5s7JKKfM0dR4m8XeG/CcQtbmZBOq4isrYAuB6YHCj64rwn4g+KG8U6kbt7C3tQBtQIMuy/7bfxGsXUbVluhO7NI0nzOzNlifUk1ULAsFA4HHua9rA5THByvJ3kclWu5aCW8GcK3TqfpXqH7L2jm/8AGt54hnjzDp0TSISON5yq/wDsx/CvNWbFlNJn94+I489yf8ivpv4KaAmgfC+23LibU289jj+ADCfoM/8AAqxz3EKFHlXUVCN3c0vGF3JDpM8kG4XEn7mEAdZJCFX9Tn8K4n9o+RdH+Eul6LbMQi3MakD+IIjAZ/HJrq9VYXXjDTtPDFks0N5KP9r7kYP4lj+FebftQXf2jw3CFbKpfCNcHsqMP55rw8qo80rs3rSscX+y25k+MHhZT2u2P8zXmHxacyfFPxY5761ef+jnr079lHn4x+Gfa5c/oa8u+KJz8TfFLeus3h/8jPXoUlapI4q7ukc5RRSV0nOFLRSUALRRSUAFLQOtFAHu/wCxe2PHPiZf73hq6/8AQkrjLtc6zMOoMkg/Wuu/Yu5+I2vIejeGbzP5x1zF8qprRxyCrE/nU4b/AHteh6GD2Pe/AU/k6bpbsxCeQqt/ukYP6Guq0OT+z/Fj2zEFb+E5I6CSP/Ff/Qa4bwqSNBsgf+fdf5Vv3l60VvY6yo3vaOsr987PlcfiprkzSjzQ5kawdpHYeP8ASh4g8CalYbS80KfaIsj+JeSPyyPxr5oERayAYZeBzG3qV/h/z719e6MyzGGZMNDMuc46hhxXzd430R9G8c6lpP3YpmYQn0U8r/MD8KfDde1XkZ0xV2c5pltJMxn25jjGc9iafal5JCGYAnqc9B6VpYay0v7OyhHUEsOvJ7flWRprb79I3+bceR2wK++nuoo1a1SO10uaKxto5vLAcDg459qniujNL9oYqp/hRlzkepqiVEr42/e5XnHFIRKl0rxKqgdSSDmnJ2dxuTuTyyLcyloYxEQcEdRn2qewsJXbLoFBP4mi0tHddycOMk8eprrPBeiz61qcNg5Ko3zTMOqxj7x/oPc15mOrRpxcp7Ixlvqd78INDW0spNZkTmdfKteOkefmb/gRH5D3pfi/rgtbWHw5BId82Jbvb12/wp+PU+wrsr28stC0SfUJkWO1s4sJGOMkDCoP0FfPst9qGteIpbq6J8+6m3Enpk9B7ADj8K/NsbiHVlKb6mdNc0rlvU9cXwt4buvEEjqZI/3Vkrj787DIOPRB8x+gHevABdT3NxJeXTs8kzFtzHJPfk+v9Sa6f4r+JBr+spplpMG02xzHEc8SHPzP/wACI/75C1yUwMMY54B5HYj1r6fhnLvYw9vNay/Idad2bGl6Vd65fW+nadF5t1dOERM4GfUnsAOSewFex/2H4V+Evhldc1O2TV9Uc7ImkXgvjnYDnavvjceOR24j9n/ULODx5bRT48yeCSGEns7Y/mAw/GvSv2ktAutX8CQX1pBJJLp1zvmRBk+U4ILY9j/Wss+xk6mOhhOblg7X87hBJR5keaJ+0F4mjvw8Wkab9kDf6kxfMR/vZz+te0aBYeDPjN4POoJYraX6Dy5WQASQyY45/iU+9fJWnWStKVYjB6fWvpz9ji0miuNaHPk7Yxtx/Ec/4VzZllcMHSWIoaNeZMakne54R8RPCN74W8QXWlXifvIG+VgOHU9GH+fWuXgt3kYoBncfSvqT9sTTLdLzRr5AonkieJ/UgYI/r+deUfCDwRL4t8YWmnbW8jPmXDgfdjHX8+B+NexQzDmwarVN1uZ8ik7o3Pg98MNPmsV8X+MrmLTvD0LjaZTt+0N6DuR7Dk/SvqDwtfeC/E2k/Y9Au7C8to02tCi4ZV6cqQDj9K+cP2qNdx4jg8J6fiHTNGhWJIU4UyEDccfkPwrzn4e+KNR8P63BqFhcPDNCwIKnr7V85XoV8ZH27enRFaWtsew/Hr4KRafBca94ctz9mQb57VB9wd2X29R+XpXzdcW8sFydin5T1r9EfAniOw8d+D49SjCCRl8u5iH8D45/A9R/9avkL4/eEm8K+M7q3gTZaXH76EAcAE8gfQ/oRXdlOLfOqNR6dH+hm7yvfdHP/DPxBd6BrtrqUcvlGN1ZWz90g8H/AB9ia+49J1ex8VeFodQhVWhuoiJIyc7W6Mh/H+lfnWb6WNWTH0Ne/fssfEbyr7/hGdQl/c3RCxEnhZMYX8/u/lUZ5hFD97T2e/8AmVFqat1R7bCkqiWxmJaeywoLHmSE/cf68bT7j3rxb42+FDbagNZtIgIbk/OB0WTv+fX86938TKbeWPVIU3SW3EiAf62Jvvr/AFHuKx/FGmW2s6NNYs4eG4jDRSgdO6sK8jLMY8PVU/v9Cpx5kfH97as7OpQEFTkHvXQfAjxR/wAIr4nm0y+lWO0vF8os5+VW5Mbn2BOD7N7VLr+nXVhezWksW2SJykinsQao22m6fdTpc3MCrMMgP6fhX3lbBQx9Llvvqc0H7ORzni9Ne1HWxrck1xc3pcu439Bnt6D09OK7a+8Qan4ms4b3VNPtbe8ht0ikniYlrnb/ABuOgbtxSNBcSSkBoxHEoBAHU+p+vFTPbtDtSIJ5WzBHpmvTw+W0KNVVYKzSsWpNnI6vzJklNoGOR+VYhh+ZyoBArX1gMtyQwwOmRVC3VTOufuDlvoKVZrmuzCWrsT6BpE2t+LNI0GAfNLKqt7Fj1/AZP4V9gzJFAEsoF228EaxRAD7oUYH8hXhn7MOifb/Ft94jmjzHZxkRZH8b5Ufkoc/iK9i8f3T6b4eu50/18wEEGO8kh2j8s5/CvgM6r+1xHIuh10o2Ry2jXgl/tjxCygGeZhAc5/dofLj/ADOW/GvJPj9KW8K2KZz/AKWT/wCOGvT9VMen6NZaVAcIoH/fKDA/M5P4V5J8c33aHYrnj7Sf/QDXpZZS5IrzOetK7Kf7J4z8aPDmD0uH/wDQXryn4ktv+IniV/72rXR/8jPXrf7Iqh/jT4e9p5D/AOQ3rx7x23meN9df+9qVwf8AyK1EP4szGtsjGooorYwCikpaACkopaAEpaSloA9w/YuOPifq4/veHL0f+gVgzANrgfAKmB2wa3P2L/8AkrF8v97QL0fotY8Kr/acW4Hm2lx780YX/e16Ho4PY9y+H2nf2r4SkVJfLu004SWxA/iUZP14GKj8KXcl9ozJNtZ/vNgcEj5WGPpg/hVr4U3kdkuiyHiJoVRs+4qukCaL4y1jSsbUjmMsY9Ubrj/gJFYYhydaVJvR7HTBKUX3PS/hjetceHFtJH3XFg7W7gf3Ryh/FSK479onSP3mm+I4EzJ/qpcDuOR/7N+laXw2uVsvFc9hI+37fDx7yR/4qT+Vdr470Ya14L1KxCbpEj8yLH94cj9cfnXiYWq8NilLzHGVmmfM+vvvj84bf3gB4+nNYmiK8uoMU4PSrEgdrOaFiS0DY59D/kVN4aTbdAgYJOelfplGsqlpHRe8kddaoRbKpiUyBMcj9aXT7SIn92vzk/Mzcj8KV7wu3kJGwbGDj0/wq1ZykdRgDjHat6skgmzTs7VUj+eQbRySO31r2H4caD/ZukfaZkxd321yCOUj/gX9cn3NcH8OdCGr6zG8yE2dviSbPRjn5U/EjP0FeneMtei8NeG7rV22mcjyrVCfvSHp+A6/hXxGf4/nl7GOy3OepK/uo89+OfiHzLuLw/aHdDaHdOwPDTHt/wABH6mvF/HviRdD8PSCB1F3eI0SN/EidGYehOdo+pPatXU75pVkubqQjO55JXOfUkmvHfEt6df1uZ921I/uKenHRf8APcmvCwGDeLrpPYp+5GyKOnXOFLSsGdjkqf6VsLJHNAyrydvANcvxGzZTvwfStPSZh5yq4OCRX6BQnypROZS1sy6n2mzniuLWV4pYyHjccEEcg16rpnx/8S2mkG0u9Ksr258vZ9ofILcdWGcE/hXn+rWQjhiurYnymOCOSAayvJDSfLjPescfleHxjUqsbtGi5obFmK+u9V1iW9u2Vpp5C77VCjPsBwBX2b+zN4dfSPBYv7iIpPqD+aoPXZgBfzHP414J8B/ho3iPUY9X1KLZpMEnRuPtDj+Ef7I7n8PXHoPxt+N1poNjJ4V8ITLJdbPKnu0PyxDoVTHU9t35eo+bzXEe0lHBUFe243F8upzP7T3i2DXvHf2CykEtrpy+SHXkM/8AER7Z4r0r9kHSIl0vU9WZB5jyLCpx2Ayf1b9K+TLW9e6uvMlcuxOSSepr7J/ZNlVvBF4gIylzk/iP/rUsZS+r4aFPz1/Mib/dux87fH9C/wASdckfnNy2M15pFJ5Mny8V7L+01prWfxG1QkYExEq+4P8A+qvFZdykhh3zmvVyuKlhoryIm9bn0t+yD4jkj8RXGiyyfubyHKgn+NeR/X862/2yNOibRtO1IAeZHKYie+GB/qBXjn7NOoSW3xQ0dQT80jLj8M/0r2b9sW8RPCljb5+aW7JHPZR/9evn8RH2GNjGPVp/eWtXzeR8f3T5kJ4GM5p+h6rJpWpxXkTFcMDkHGKq3rD5yeRVIEMCpYYr6upTVWnyy6nLzOMro+7vA3jGLxh4Jt71nEl2i+XdDPVgOG/Ec/XNWvCt4srXOiucPATLa5/ijJ+Zf+Ak5+h9q+WPgF40bw/4g+w3NwVtJwI5O+BnhvwP6Zr6Ju0ltdUi1S1mBuLcho+eD6g+xGR+NfnmKoSweIcJbHowtUhdGR8aPDAZF16BMdI7kD16K/8AQ/hXjp+SfZkrjofevrGZbHXdF3BPMs72I/KeoB4Kn3ByPwr5o8c6LcaFrN1p0gJKP8rY+8vUH8R/WvsMhx917GT229Djqx6lUSOZRvypKjggc+hp87OLdMNk7Tuz6g1kxSvzluwyT61pX5Hl53r8oVvlHqK+yjUuiIs4/WHMl2ccgjHXpWdcZjtXAwHlYRpz+taWqgCdnXjPNS+GNIfX/GWm6LFkhnUOR2z94/goY/hXk4yuoRlJkwjeR9HfAnQP7D+HlmWXbPe4uHB4O0gbB/3yF/M074iTC613TdKUEi3BvJOeN33Ix+rH8K73yI4IIoI08tI0CqAPugDp+HT8K8gvNTEuoaz4gZgY3kYQnP8ABH8ifm2T+NfnsL169zsbsjI1y6E2qSBWykf7tfovf8815l8ajv0izGekrH/x2uu0y/TUtVWzs0kmf+JwPlHvVP4z+FJm8MrqNndLPHZ5e4iddjgEY3LycgH6V9Xh504VI076nHODepz37IB2/G3w+SOPMl/9FPXjHi458VasfW9m/wDRjV7X+yWhX4y+Hv8ArrOT/wB+XrxDxOc+I9SPrdy/+hmuWP8AFmZVtkZ9FJRWxgFLRSUALRSUUALRRRQB7b+xe2PjDKv9/Rb0D/vgH+lZkU3l61AwGfLil/nV79jM4+NUQ/vaZej/AMhGqECRt4rihPIacxn6FwP61NB2xSfkehg3aLPc4vD+o2HhPS7i2YS3aRI9xDtwUP3vlx1HOPY+1N+JjtZ6poWvyW8ifaIfs9wrDBVl4wfwK1yvjj4meJNL+IN7pOmJZiws5fKCSQZL4AydwORznp6VR8c6x4m8XGzQ3DWVtGpLQQMzBmOMuc98DH0FYUsPiK9WNbpc6oOz2O2gv/Jey1iEsZLSRZMDqdhwR+K/zr6CsQt1DHNGcwyoCvPBVh1/WvmHwaxWyks5XaXKiRWY5zjhv0x+Ve9fCLUftfg9bR3LT2Dm2b/dHKH/AL5I/KvOzXD+xr+Qpq1z59+KmjDQfiHe2bRlLe4JZeOMNz/iPwrL0pWt5CpyCOD7H1r2H9pzQzPplnr8SZkiwjkD3z/j+deP2cgcxyhdwZc5PrX0uUYvnpq5rGV0mbVu5bdtj2qCBknk1r6Zb75ExGzE4AUdSfQe5NZlogYp6YxjHavUvhJoX2i6bV7iP9zbHEII4aT1/wCAj9SPSvQzHGxoUXNjlI9B8FaL/ZOjwWRC/aXPmXDDpvPUfQDA/CvEfjj4uTWfEZsrOYtY6cTHCAeHf+J/xPH0Fep/FzxSvhfwg6xSbdQ1EGGAA8on8T/0H1r5ku76CK1muHKsVHII5PoPx4r87nOVSTk9WzKmteZnM+PtcmtrH7EGAeUgsO/sPp3/AAFcdbukEIzIRK3zFu+afq0z6pqEt9N8yKTjHAJ/w/oKzZtxIznJ9K+uy3D/AFaldrVmU5tO5fhCSA7yxYnqO9TQkwSlWQEqeTnpTdJgkILsCFHOatRWzXErO24Juy3OM168It2YoptXNS1vp7m18oMBFkkDpzXoPwo+H51+R9V1Um30aAne+dpmYclFPYD+Ju31rC8CeHk13XLXTEkCRsd0rgZ8qNRl29+Bx74r2Lx3pfiC+8N2ei+ELWCGyJETobhIzFGv3RycnJOSectzXlZ3mcsOo4eErSl17I6oR6s4T4ufFx4rQ+EvCCx2enQr5UkkS7dyjjavovt37+leLLI88heVyzscljySa9VvPgh42nPnW9pp82ONi3q7s/jjmsG6+GfjXTZ1ju/C+pZJ4McXmKfoVyKwy6OBoK0Kib6u+rMainJ+RzmnxMrBsEDNfU/7IWvRRXOp6K8mGmjEsYJ6lev6Z/KvI9Z8FHwn4GbVvEcHlaleuINPsy2Cnd5Xx6DgL6nJ9KxPAHiu48L+KbLVrdsfZ5QWXPDL0IP1GaMwUMZQlKhryv7/AEEoWXK+p79+1x4ce5t7LxFBEWEeYJyB0B5U/mCP+BCvlW/i2lu2K+/pLjRvGvg/otzp2oQY68gEcj2YH9RXyD8Vfh5rHhLV5I5oXnsZGJt7tVyrr6N6N7flXLkWYU7OjN2fQmUG427E37MdjJd/FbSmVSVgEkr8dAEP+Irpf2vPEq3vi610SKQMthAWkA7SPz/LFanwXt7f4Z+DNV8feI4DBNPD5GnW0g2vLnnp1G4gfgCe4r578V6zda3rt5qt7KZLm6maWQ57k/yp0qSxmZOqtYw0+YSfJDUwLwN5jc+9VYmG07iBVyULJGOzdOvNVWgIGRX0MqTTujgb1H2s721yk8JO9Dn6ivpb4beKhrnh2JWmL3NsgQgtyUxwfw6V8xK+w8j611Xw916TSNejVGPlt1XP3lPUf1rwc5wCxFLnj8SOnCVuSVn1Prj4W68sWpy+HrqUEXRMttz92XHzL/wIDP1HvVj4w+G11TR/7Sgizc2g+fA5aP8A+t1/OvKbW5aBhexOvmLiWKVDghhgqR9K+gPDGs2/iXw7b6mipulBjuYuoSQD5h9D1Hsa+awtaVGSnHdHZWj1Pk65R45yGyqknOe1WJZUOnxsGPIwx9xXU/GHw3JoWsuIlP2WY74m/wBk9vw6VxcL79PMZXJR92AeSO9fouDxUa1JSXU4LcraM2cBnGTwvzH04r0/9lzQDeeILzxDLGGSFSiH/aYc/wDjo/8AHq8t1dwlr5UfDzHA9QM19T/AfQl0P4e2Py7ZbpfOfj+9gj/x0IK8POq/LDlXU1pKyubfxF1JtM8HahdR8XLJ5Vuf+mkh2r+pz+FfP/ju5+w+HrTSYnIDkbvVlQYH5k5/CvWPi/fmbVdL0dDkRBr2ZQep+5GPzLH8K8a1Dytc+Jdlp2cwRSqkg7bI8lz+j14uXx5VKr2/pG3ZHReHdNTwr4cFxIoN9coGbI+6WGQv4DBPvXmfxLQRGKeOSUyXJk892lZjIMZwcnp7V6f4n8QeHhr1roupXMgvLn5ljjPEW88Mx7c8DNeafFyB7KaC2m5MbSjPrwMH8q9rKoxlNX1e5z1W7+Rb/ZMG74x6IfQXDf8AkJq8G8QHdrt+3rcyH/x817z+yM6t8XdJPOUt7pv/ACEa8B1NxJqNzIOjSu35saiP8WZz1+hXFFFFamAUUlLQAlLSUUAFLSUtAHsn7HBx8brMf3rC7H/kI1lzyNB4llmGMxyyOB9CD/Sr37ID7PjrpK/37e6X/wAgN/hWfesf+Etnix1MvH1qKNlilfsd+E2PYfHvhi2n1/8Aty3iLwX8K3Bk3cIz8ZJ6AE4x9as/C6X7P4ltZrgpLAqSRT5II2OPLYfkx/KuQ8QeKdQ1T4V6b4dtrd5ZgVWZggyVQYUbvQ8Ej1WotGa58NfDPU7y5IjuLgi3hw33cjBP6sfwopupQoVac9r6fM65TTSXU6xLKXRr65tJFKtp14yNjuhOD+nNei/CLUms/Fc1g5Ihv4sDnjzE5B/FSfyrwfTPGuta7/pd2sETSQJDIUTJl2KFDnPcgZNdx4Z1O4hFjqkUhM9pKrnnqUPI/Ff51zY/DzeEhOe6Km1J3R9A+PtNGueDdT04rljEXj/3h0/XFfJ+jbhLNYOCGhbIOecDt+X8q+yrGWC5tobmM7oriMMD6qw/+vXy18RdFGg/Ei6iAKJNIzAex5/qa5cqxDhLlIg9LGl4XsZtS1CC0tk3SyOFUdv/ANVfRug6daaTpMdoriO2tYy8sh46csx+vJrz/wCCfhprSwbWLlD5koKW+f7vdvx6fnR8f/Fg0Tw+nhuzk23l8u+6KnlIuy/8CP6Clm2MeIqci2X5hJ8zseO/FvxhL4o8V3N6pK20f7q1Q/wxjp+J6/jXkfjHVWSJbONyWkODz+Z/Dp+db2q3gijkmd8YB5z09/wrzueT7TO97OG2k4Re4Hanl2G9pO72RFSVlZFxpYhbRxxLwvv3qRIjcS7ioA7ADFR2YRipYHHXk8CtqzNsB83GPQ19lShz7iiuZ6hYWRMiw8sWPQEnFbc+nm3hIlljRe6hsnPvWXJqv2SJhApDMMbuKyLi9kmXJnJOcAV0ucKehtzQgrHqHwq8RaB4al1O+1i8EOYkgQ7dzMCxZsAf7qiurvPjb4PtiRa2l7N8oXdnbkjvxmvnq5jR4Uc7mkU8g1CiO55Q7c181jsmp4yu6tRvXoR7eS0SPpvQ/j54UmnCXCXloD134KnsT2r0LS/ib4Pn09pT4gt/JRc9W3n2xjOa+KBaK4KqpzSQ2fl5BIQE4Kg9fwrhqcLQb9yTQ/by6o9H+M3xAfxn4oWS1DJptmDHbKTknJ5c+5/wHbNcnI5EYfPPWqUMI3DAOBVzYWIDMFUjkntX1GDwMMLRVKOxlKTerPRvg58W7/wZdCyvGNzpMrAvEW+4f7ynt/L19R9Eat8UPB0XhtdYnvobmBh+6txhpXfGdoXsffpXxTNalH/durrux94ciuie0NloSXChGeQkLk8p68dq8XE8MQxNb2kXy9/MuFV21Rf+L/jvVvGmrfabs+TbRErbWiH5IV/qx7mvPxIisGwN4PfpWqkiOM3EZMIyOOu7HrSXelWslibu3u4XkGMwoSXX3Ix/KvoMNgIYemoUVZI5aknN3M2drZyrRgqx+8O34UeWJGUM20fXGfaqv7xG3J2qYXAkALHnrWys9zmbKVxAuWwzKB2brTYTsPmqGDR42EHnNWr2RCxZFXBPU8nFVbkg42Ele3auSrCKuTezPUvBmv8A9oaMsDOd0YOznp6r/X8a9b+Cvin+yvEC6fdSYsL/ABE5PSOQfcf+h9jXy/4U1E6fqiorEJKe/QN/nivX/Dj/AGj51YhdvI756Yr4bMMKqFRtbM9WjU9rHU+l/iX4aTxD4antvL/0uAF4eOc91/H+YFfL80L2WoyQOu1j8uMd6+o/htr6694eRZZN99ZAQ3GerjHySfiBg+4ryX4/eFhperRa/aR4t7g/MAOFeurKca6b5Ht0M6kLs8u8P6W2veO7DR1BMZkVHPoP4j+ChjX2ha28dtZw28ahEjQAAfw+39Pwr51/Zc0P+0PEuoa1cR7kgwikju3J/wDHVx/wKvcviLqh0jwdqN5G+24aPyof+ujnav6nP4VhmVZ1Kr8iktkeOeJdbF1rGueIM741dxb+8cQ2p+bZP41wnw4lhk8XiV2JufKdAPYqdxP6/nWt4i/0Tww9oh+8m0HPUKP6kj8q4X4Y3Mi/EuEs+FYtHjPUlDivRp4fky/m7tfcLn9+xT8YSXN18V7y4hBZvO8lQR/CgA4/LNb37QLA6rZ+rxZP124rT8G6Mmo/EiS8eYMsJnuJF25xgNwfqSo/GsD48SiTWrfDf6oMn1woz+tdmDknjbR2SRnVVoIt/sh/8lWsuPu2F4R/37r59uOZ5P8AeP8AOvoL9j//AJKfCf7um3rf+QxXz5KcyOfUn+dYQd6kjlrdBtFJRWpiL3ooooAKSiigBaKKKAPV/wBkogfHvw/n+7c/+k8lU9SYReNnZuRvbJ/Gp/2UWCfHnw6T3M4/8gPVTxMm3xXJIpwBI5/DJH9Kyg/9pid2F2bOz0klbVNoz1wMdeTiqfxqvWitdO0CBuIUDSgd3b/62T/wKtPw3LEtzYtIMxiQBufyP54rlvGNtfX/AI2nlmt5MBmkGQemPl/8dFdWL9+rTp9zpnBuTsT+HnCWka7SoXaOld54XkXM0Lch/nA9xwf0P6VxenosdvEoBBYhmGa6HS7kQTxTdkb5h/s9D+leliaKqYd0/IlS6H098H9SF/4OitnbMtg5tzk87Ryp/I/pVP4l+BofE/ifSL9gVjj/AOPgqvUDnGe2efzrlfg1qX2HxRJp7v8Aur+LC+nmJyPzGa9lZSxUDv0r8/UpU5O245aO5WlurHQ9Fn1C4AisrGHcQOOg4Ue56V8j+PNbvfEPiO71a6Ylp5CxHZR2A9gK9c/aP8WpE0PhSylJEJEt4VP3nxwv4DmvBNbla30q4vXjk+zIMO4ztBxwuexPT86KauykrI4XxhqYluBZRN8rYLkf3e359fpisQkySBcYUcYqCa6Ms0s0hVnkbJOaljdgADtA9c19ThYxpw5TjlNtmhFL5YHAwfzqeKYkHa+D6HvWU7Hp5i7Qe5qeCRA+A459xXpwq6lxmzRLg8lhz2xxVY2xeYlTgZzUSuZGIDqfxrQtLWTht6gdznoK2TU2aJOQ7EaquV5Ap0KM+QFyDyKj2B3yH4+vWtLTxhiAyHb6VvBXZolcltbORLRnICg8nHWqsFuXmcYBzyK6Bw06IoIBK89qgsrci65weCOldagtEaOBSmjMNsqFQDknp61WnzgAkZxwK2NQgIRcnrWNcK/2hQCvWnJGVRWLWnQvcTQxxoj5fOzGQfwrc8Uqq2/2ZAD5a8kHvjnHt2qTwNbBbiW8kU5jiIUgcZPGazvFUjpK/IyxznpiuinGMYXZDXLA5aaQxMofLKpyULEA+1VxcyJlFJQN15zmpJoxMSZJc8cc9/eq8y7CFdl5HBJ61ySb3RxSuIGQsSrc+h6VCZGL7XjYe6802QoTgsv1BpI3Cn/WKcdOaxc7mQ3zNrYfj3NSqyPg8AdM9qY0xkO13Tb6cVBMsathZVI6/KwNc85AkTzQ4JOQe4IPevQfh/r5lshAzESqwD4PIbsfxH6j3rzUSSL9yRW/Hmrvh7UBYaqksjYjc7ZRnnHr9R1rw8ypxrU7dUdGHm4yPpj4beKJPDvia3vJmY2sg8m6T1jJ6/UHB/CvfvFWg2fiXw/c6VclXhuI8xyrzgkfKwr5TtoriwZEvkKSFVfDAjcCMqfoQQR9a+gfgb4oXV9DfRLiTN1YLmLJ5eEn/wBlPH0Ir5aL5XoehNdTR+C/hVvCPheeyuE/0qS5ZnbGMjoPwwF/WsL416kJb3TtGQnEebyZQev8KD8yT+Fenn5STnA7188+KdZOoeINW1wndAsh8kn/AJ5x/KgH1bP51rTi6tRLqzNPqcx4slimWS3d0SOM+UCWxnaPm/8AHifyrysC/wDD/iey1Z4nWPzFmhkKnZKFbBwe4OCK6XxbNfw2UVwirJhSX3DOCTkn8a6nwf4i0vxpocHh28gisbqyhC2uDuzjJLc9ySSw9OR0r67GN0KcaLXutb9mZab9TW8ONomlx3+uabqBnGpZcRuBujy27y+ucA4znHQV5V8YJmL2crNlm8wk+pOM12j2stlfNazR+XJGcMP5EeoPrXBfGA4XTx7SH+VYYKkqU7rW5jVm5I6v9j0f8XFaRui6RfH/AMhrXz0Tk5r6D/ZKYp4yu5egTQ9QP/kNK+fDXNS+KXqRW6BRRRW5gFFJS0AJS0lFABRRS0Aekfsxy+V8dfC7etw6/nE4p3irJ8QzZGOZQPch3/wqp+zu2z41eF2/6ff/AGRq0fGUSxawdzYxczA/9/ZB/Sudu2IgzuwivFnQaKxk0wP3H+FWPE3iHUpp7KfyLQmK3W3kdlO5wuQCffacfhUHhZM288RI2ggj8qh1qA429GDcflXsezhUknJarY6ZSlF3THWEO+DcgIK9Of0q1DIwk8pEZ5HO1EUElyegA7nPaovDyXF3NHY2MD3NzLwsa9wBkknoAOpJ4Fdzpun22hYNrIt1qUikS3i/diBHKQ56ehfqe2B1eKxsKEdd+xmu5oaJcX2lS2NxKAt3YmKSRQwJVlxuXI74yD75r6J13xDZaN4Om8TF0kQwg2gz/rHYfKP8+lfK+u63baNaP5jjznjIRB1+tcdeeOtfvdDtNGm1KZ7OzJaCFjlUz1xXxdSEqk3NdTRtO1za8SahcahqUl3cszzSuXdz1Yk5JNJZaze6ek0VtKPs82POgkQPHJjpuRsg/iK46bWL9wMvESO5WoZNY1DPBh6f3auNGysS6iO0fxDcCQuNK0N/Y6Tb/wDxFOXxTdKwK6NoYI7LpcH6/JXBjWdQDE5hz7rTDrmoBiQYcnr8laezZDqJHoQ8RX0g5sNGCk9f7Mg5/wDHKu2Wq3TnD2WlYJ4VdOh5/Ja8x/t7Ug4bNucdPkNW4vFWrpIHX7LkDAyh/wAaUqU+jHGrHqem3eqmH5Y7HTgO4+wRc/8AjtWdK12F4yn9k2EjDgk2kf8AhXlL+KtWc5b7P1z9w/40W/ijWIGZ0e3yTn7lQ6NS2/4lqtG57b/aFp9j3to2ltL2H2ZAKzV162jnZV0jSX7gi0H5V5dP4116bB3WqkdxH/8AXqCLxPqytvDQA/8AXPpUKjWW8vxL9vE9ig8S2qMI5fD2lSSZ5Jt+P0NWZNesgBJH4f0QqOCDA2SfwavGE8Wayjl91sSev7qhvFursD81uhPUrH1odKt/M/vYKvE9ttfEunsp3eF9DJB5zA//AMVT5/E2lbx/xSPh7Pb/AEdv/iq8RXxVrKDiWA/9s6Y/inWGILSw4HolL2Ne/wAT+9h7aHY9uHjKwtyxXwl4eGTnAgfH/odEXiPTb3I/4RHw2W9DbuSef9+vDj4j1VySZYv++KntvF+sWsbRxS243dT5fJ/Gh0q1tJP72HtYdj3mTUPD0MJd/CugyuTg4tSMtjtlulZWoeIdFRD5fhHw8H6KDaZGPXrXjE/jPW2AXzLcAf8ATOqjeK9ZMm7zYeBj/V0oYat1k/vE69Poj2ewvrK7LeZ4d8OQvjIQ2XB/HPFRXGtWEEnl/wDCKaAmejtZgj+deRnxnrf2fyd9vtP/AEy5pq+L9aMJjL2xznkx5xn8apYetf4vxF7aHY9PfxIi3O0+FvDoXt/oC/pzVO48SbMj/hHvDqBjwf7MT8s15wvibWQoXzYODkfu6T/hIdVdSrvAw/659K09jNbv8SPaxO7OvSkkHR9F4OcjTYv8Ks2WvtH++OjaI7A5GdOi/wDia83Gs6l0DRZ/3KP7Y1QjBmjA/wB2m6Mn1EqsT0XXdc1DXNSe/vyjyOFQBFwEUDAUDsAK2fBXiC48P6/Z6naJ80LZZT0dTwyn2IryaLWtTQfJLCp9kNXIvE2rxkEywHHTMdZOg9kX7VH2x468RWlv8N59f064DR3kAS0buXk+UD6gk5+hr5/1+1ux4aaCwt3n8koZVUZbylyWOOpwQCcdua860Txtq32iyttQvpJNKtZzL5AJ2CQjG4CvWtJv7e7tY72xuNwBDK6HBU/0Na4fmw9RTa2FdNWRwU7rPAOjDb9a5bUNEvrLUor/AEdtmCHAD7WUg9jXruv+G11QNe6RHHFf9ZbVQFW49SnZX/2ejdsHg8Y2dwR1KsuQysMFSOoI7GvqvrFPFUm19xzSvF3NJ9VudXgsZb2BYrqKIxysuMOckg/l29c1598XxmKzOOgb+ldvACCMVxHxg4WyHqjcfjWNBKLSRnLU6j9lUFfEGpv/AHdB1A/+OJXz6etfQn7Mh8u+1yTps8N6g36J/hXz2a4aGrl6ir9AopKWugwCiikoAWkope1ABRRRQB2/wGbZ8YvC56f8TBB+eRW/8QowmqzN6X04/wDI8tcx8FpPL+LHhh/TU4R/49iu1+JNk/mS3CqSG1G5XPqRcP8A4iuOvLlrQfmd+DV4yJ/B10kduI2GGdjkn02jit220m416+NlYKmUG6edziO3X+857ewHJPABrH+HnhfUvEDmZGaz0yFgJ7xlyA2PuIP439ug6nHf1R47PTbJdPsIRa2MR3kFss7dC8jfxN79ugAFdlfHRpK0dWbN3ZmWWm2Og2JsNHDMJgBdXci4luSOcf7KeiD6kk9OQ8XeLoNIka2tWWa5Awe4Q/1qv488dQxq+n6S/mP0eYdB9K8umdpJGkkYsxOSTXk2lVlzTMp1LaIvXmo3V9ctcXMrSOxySajWbPAbDCqLFxGWCk8cCq0bTCUTLgsv5Y9K7KeFclsY3fU3RMSo/Wl8wHrzVFJQwDqDz1Hp7VMG79Qa5Z03B2Zalcqy6vDHO0MlpOkiEqwYgYIpjarB1+zzf99CrWq2S6na+bEMX0C8Y/5boO3+8o/Me4rBhbepB+8K66NOnUWxDckzRbV4Mf8AHvN/30KT+1of+eEv5iqDxZOB1qMRMD3rdYWHYi8jU/taLP8Ax7y/mKkh1SORtogcH3IrJkRkG4cVJb5ZhjGRVrCU+xSbTNVtSRTjynJ/3hSx6irdInx7kVQnyAW2pj1HWiCQ9x9KtYKle1ik3c2EkZo94Xge9NWZm6Ifxp9i2bdz7elPiiweAa6lllHTQ3cNNCS3jklbYCATWlBoFzcCVo7hAsUZcloyO4GP1qbQLR5J87Pu9eO1eiQIlnYXCs0CyzQ7TkZIGc59jjiuqnk+HerRpTo8255RJYzI7JvU47gVFNaSxruJyPpXUmCJmkk82OPAJAYdayJftE0ZcYX+78nFNZNh30MJx5TAldkPzKTUDXaoeY3P4itKW0dV3SAFjzWXdRsxwBj8KxnlNGPQ55OSGvqcS9YZT+Ipo1WEc/Z5vzFQvCRwR+lVZFIJAH41yyy+nEydSSNAazbj/l3mP/AhThrUA/5d5v8AvoVlxw9SRStGAc1n9Qgxe1kan9uW4/5d5/8AvoVb0vUP7RuPs9rZXDsFLuQRhFAyWPoBXPQ2093dxWltE8s8zBEjQZZiTgAD1NdpJHbaHpp0SxdJJmIOo3SHIlcdIkP/ADzQ9/4m56Ba4cVSpUtEtTWnKUtXsVmk9qjaRnYRrkZ6n0FRvJgdMk8AetOaZbCATYDzP/qlYcE/3iPQenc/jXNTpuTsjVytuXHxGBEBtwOla/hnxJfaHc74H3xN9+JvutXCwvcx3DTB2dnO5yx+8T3+ta9nMs7fPww7etb1cLKC12IjUu9D6P8ACuv6frlt51pIA/V4ifmU/wBRWn4j8Mx+IENxEyW+qKo2yscJceiyHsewf8DxyPnrQtRudK1OK7sZdkyc57Y9Mele+fD3xlYeIIVhlZbe/UYaI9GP+z/hXEnKjLmidKamrM4uOCaG7ktLqGS3uYW2yRSDDKfcVwfxpKrJYpjkxn+dfSniLw/Z69bp5jC3vol2wXYXJX0Vx/Ent1Hb0PzX8b7bULPWorDVLNre5hhx1yjgk4dD/Ep9fw616mGxKqvzMZwaR037Pp8u38USA4K+EtRYfoK+fT1r6H+CsRttG8WuwwV8G3x/Nq+eKywzum/MjEq0kgFFFJXSc4tFJS0AFHaikoAKWkpaAOl+FbmP4keHXHUalB/6GK+iJfAk1/qgl1i9aHSzdzXYgiYeZLvkJCj+6OOWPI7Anp85/DU4+IXh7/sJW4/8iCvrDxRq1j4fhkvL6RY41J4zyT6AV5+NXvRZ2YWTimWL02Vjp6pGILCws4cRxp8scS+g/wAepPJya8K+JPj6TVnk07ScxWYOGk/ik/8ArVQ8feONQ8TXTRoWt7BThIVP3vc+prkdq7SWIVR1Y9BWcKV3eQ51OkRiNzjBJP5mtG2sGlhMp5I7en+NZwKkkJkL6nqf8K3NGuhgI5GRwfevZweGg3eYU0r6lLySoIz8pqo8DRsZFHBPIrpr2zRVE0JVlf7y96zmRQwDx5HQV6LhZlyjqUUtyV3xfMp6gUxSUcq3StNrWS3cTQhthPI9KZdwxz/NGQr+h459K5cZg1UjzR3JcLbFRZHikDISrKQVYdQfWq2s2yzK2p20aqwP+kRKMBSf4gPQn8j9RUiNk+W3BHA/wqaJ2jbcADwQykcMD1B9jXiQk6crkXuYqLvbdjCn9KnaIoORkHvVm9tVtpFlhLG1lPyZ6oe6n3H+BpRGWQA817dG1SPMi4wKgTIxnknjilggMRLMpweOlX2g3BQB93pU8EDTcJ1A710qjdmnsrszZIt3O7Oe1PgsnkYY4Uda3tP0yN54/tCNtbPSt620yBI3SNOvPIrpp4W+rN4Ybm1ZzVvZSxxum05IxWlBp4S3Es0qxr1JNdC1rBaaXJPNGBMPlQEjBJOAazz4mttEh8rRYILvUWIEmp3UIkCMeNsEbZVQP77Ak9gtZ47ExwqUUryeyNJxjS3NHRre5NqXstMvZEx/r2jKx/XdjFS3uo3AL2z6bIzqAJDAxckjueOtZtzZPqLG41rVr/UZ+7SzFgD7A54/Ksu+0v7EBc2Fw6MpyNp2uvuCKylLMIx57L0IlVaWxcUxXM7OpGB1Ruo+op8pBX5iFGMDArLm1u7uo1W8aOWeP7l0VAlHsxH3x9efen3d6Ht43UAFlyfY9668uxyxMHdWaOdyT1RDfzxxRuuM56kjJrFuSpQyE7Vpb+5bfjI9s1SAaaZTICyAjIBwSPTPauipK+hyzndjG82ZXMfyxp1yfX+dQLGgcliXJ/Sta6WOR2UW8dsSSfLUkKgA9TyT9azhEDuXJGTxiueVJ3MZIjA3H0FRz4UerE/KKsOyxp8owB3NamhWiWsX9s30e6Qn/QoWHDsD98/7Kn8zx0BrkxdWNCF3uKMOZ2J9Jg/sC08//mLXMZGe9rEw7ejsD/wFT6txVJAGTwBTpJJJ5XmmdnkdizuxyWJOSTUaAzShF6Duew9a+b96rO73Z03SVkOiIG6aUHYvYdT6KP8AGqkxmu7ncwBJx0HCjsB7Crl5tVAi/dXgCoYMRndgknoK9yhhFSSvv1MZO7HLbhV69PWoWRxIG3EY9Ksgn7784/KoNu+QscgDnH+NdM4pqxLNC0vfIYRTbcn+KtvTrieG4iubWZonjIZXQ4IxXH3AL5PT3NXtG1GSFvLlcbP7zdPxrxcThrXcNjWnU1sz6T+G3xDi1dY9L1cCG8PypMcBZfT6Gu08aeEdG8YaGdM1eAsUyba4Ufvbd8feU+nqp4P618yWDpt89WyQeOeQa9e+GvxEmi8nTNdcPCTsinP3l9A3rXkyi4O8TqTurMr6d4L1nwX4N8cXGpTQTw/8IzdwQ3EOQJcsTyD0OMcV8m197/FRUm+DvjCaOQOo0iVgVPBBFfBFd2C+BnNiXeQUUUV2HOFFFJQAtFJRQAtFJRQBc0a+k0zWLPUolDSWlxHOinoSjBgD+Vd/4x8VXfjHUJNRafdBnKQLx5IPYj19+9ea1JBNLBIskLsjjoVOKznTUtSoycTpTHKIZZ0t55Y4V3ymNCQi5xkn+EZIGTWn4b0QeItMnaO8hiv0f9zaHgMuOoPc5qj4U8ZX2kagl5a3cljdKCvmxfdcHqrryCp7ggg+ld/aXfhDxRsM8dt4V1hjuW6tlIsJ29WUZMB91ynstclWc6WtvmddHkk9WefXVnc2Fw1reQvDKpwQ4wRUcBkgmzk/WvXdZ0i8ggisfGmnGaCRM22p25D5XsyuuQ6/TNcf4g8F3un2326xkTUtMbkTw8lP94dq6sNjYze+prPDuOqKdjdJNDsLYJHBpxktLe5jN5NK2RuKwICV9M5I59qxIi0L4bjB61LqayTRCWI4bGG/xr0cTUnUo+6SpM9R8N3Ph3VljtLfWNOMr/L9m1NPszt7K5yhP/Ah9KoeM/CJ028IaCS0kPISUfK49UboRXC6bot1eMIGiKSkA7W43A9CPrXTadqfijw5Yvo8pa60t+GsL0F4h7xnrG3uuPcGuCksTD36U+ZdjoUm170Tl9V0+SJmfYQy/eGKpxvuXn7w/Wtm/v1h3TRB2hH+st5P9ZF7g9GX3H4gVl3kKYF1asDExzx/CarEQjWj7SCs+qOapBLWILIux45VLxP99R19iPcf/Wp9pbBCY3cPxmJgeGWoEIdcj8fap7d1wIZW2oTlH/55t/gf061ngcT7GdpbDoySdmaVjAWc7Y2OOOK19K0uE3CO6EIT8wPHFM0CaJWJmi/fR8SJu4IrYmvmGBDCGyOrL/Wvr6Si43R6sIRtdiXywpdLHDgYAxg849Kv2hjkURSwyBcfKo4Ln3I7Uuk2iH/SrqNSpPJU1cudRsDKxhtVVcYHzHI963RulbUz/GOmxy+Gp5bVCsqMrhAOSo+9ivNIUjldVmYqhblgM498d69Va+LxjcwOAQAR0/xrjrvQX1G9uZNKjREgQy3TyOI4IF9Wc8Lk8AdSeAK8LO6GirJ2scOLhzNTRalF5Y2EFzqFu32abiK8h+eGT6MOM+3UdwKguLiIQFvMUjsO5/CsbSdU1TTQ8mnXVzbpJxKqfcf2dTlW/EGrX9vMImf+zLEXf8FyqkbM9wmdm70OOOuM4xx083rQhaornL7SL3MaYukjIQS+cbQOc+lWLiGVYY4PusoAbJ7962dO0+LTbiG5uTBd2052wXsDlkDY+6QcFW9QQD9RzUusac5kZgMEnABHNelkuFUqbrJ3b/AycGlc5G8h2qqhd7+tTWFszSZ25CjOK2YtJdx8+R9atpZx21uzkAt0HHT6V7iw2t2YqGtzBFn58r+YCiKOOODVe4iRd0cC/VjWyzfaMxxxuxzyRVeWw8xjAZApUbppD92Ne/8An6CsMS4UouTF7Pm2MrTLCO5Z7u7Zlsrflj/FK3ZF9z+gyamuJ5LiYyOFXgBUX7qKOij2FSXU6S+XDAhjtohiJT192P8AtHv+XaqsrbflX7x/Svh8TXliKl+nQqyirISRi7CJOSeOO/tU67Y49keGP8TDuf8ACq0xFtDk/wCsYdPQelavh6CF9Pc3c8VvMrhlLgncp6gAA8g4/A114f2eFtOpuxKLm7GfHbzTNlUZvfFT3Fs1tAZXAJH8Oea2JHsVwomnuD6Kmwfr/hUtveLC+6Oztv8AtuokH5Hj9K2lmF/gi2y1Sgt2YUSpPawzIyjzFYumMeXg/qCMEf8A1qrSOgIVRya0tcuUmkRY2TAXL7FCguWJPA7cgenFZkcRdgkcbM7HCgDk10wlKVNOW/U5572RDPk4A4NXtI0W61HJULFAvMk0hwqD61qQaHb6eiXOtyEO3KWsfMj/AF9BW0ui6t4g05Lm7kg8P+HkbCSzEqjkdkUfNM/sgPuRXn4jFxhsbU8O95HDSai2k601tp9097aqwVSFxknqAPr2rv8AQLs3nH2eZJo32PG6EMremPX261btJPD3hW0NzpoOmrjB1S7VWvpfUQqMiEf7mX9WFcJ4g8fXDI9n4fibT4DkG4J/fvnqc/w5745PrXByutqlYcmoPc9S8afEZPDvw213whLdC61PV4Vtlt1bd9kjJBdpD2YgYC9ecnHf526nNKzMzFmJJJyST1pK6qdNU42RzTk5O7CiikrQkWikpaACiiigBKWkpaADvRRRQAVasb64tG/dNle6NyD/AIVVooauB6h4A+JWpaNGbKJ4rqwkOZtLvRvgkPqvdW/2lINeoeFrnQvEFx5vg++Oj6tJ/rNHvnDLMe4ifhZPodr/AFr5f71qadrM9uyiYmVB0OfmH0NcFbBKXvQ0Z10cVKGj2PcvFPhOzv7uSOW1Gg6yDtaJgfImb0Gfun2/SuIu9E1LR7jyL22eI/7QypHqD3FdV4P+KiXljHpni23/AOEg01VCLMSBeW47YY/fA9G/Aiu7Sys7/TGuvDt7D4i0QDMls/E9sP8AaB+ZT9cj0alQx9XDPlqrQ7l7OtrHc8z0HVrrRgvlWdpqdoOtpdZBT18uQcp9OV9q0NV8VaDqsfkebd6RLjmC9i81FP8AsyKP5qKu6l4ZgeSSbRJXZk5ks5flkT6eorF/sezvMQTXliLw8m2mlCOvthsc/Qmu+tTwskq9OXKxe/DQ5XXRbpGWi1C3uJN2F8kHp3yfTFZ3h3i+e2l+aF1yQe1dVfeEHgBaazuoFH8YyyH8aqWumWtqS0UqOx4JLYP05q8H71Xmc0zP2c3K7MXU7R9PueMtG3Kn1Hp9ajHzLkcqa6fUbazlhitLmZY3mz5JIPJHofx/WuXmjmsLt7a4BGD19fQj2rLG4ZU5c0NjGpDkfkXrG6cFVBxMi4Q/31/un3x0rasNTuPLVoZDsHGDXMlT2Yg9QR296u2lyykyjr0mUf8AoQrryvHOL9lN+h00K7+FnSteSTTM3meQhx8uT+NOF+IXzlGGep6GsV5xkcgj271n3F4PMIHIBx1zX0iqpGsq1jp7vU1eGVgoQhSRjkZrmtQ1G5ubZbcOwt4stFCD8u7H3yO7H1PPbpUaXmNysMZyCKrAqMgHI/lXkZxTnWjGUNbHNVquaOi0q6A0+BEwdqAED1xzms7VoljZZRgb2AwO9PgOj3FtGZJLnT7xBtaeDDxzDsWQkFWHTIJB9AeTNejRLaz3LfT6pesv7smJo44PUnccu2OAAAoznJ6Vz1Mxp1aPspU3fYl2a3M0SyrC8CSMElwGUHhsHjP0PSuume4jVRKAzEAMc5Oa5SzeKOVJ5cnacqv07mt2xuorzdNKwUhhnPpXrZBhp0KcufRvoSnpY0g4yAQBxz6k1n6qwYiNWwemBwBVhrq3MhCMD79DVa5e1RjMxZgOgz1Ne7KSSuwbvoU13W4EUbMZX+76fWs/ULlChtYGzGDmR/8Ano3+A/8Ar1JqFzJA7rn/AEqVcOf+eSH+Ee5H6fWs0YVSWHAr4jN8w9vP2cPhX4hJ8qshrYQZ79hU1pASDcSdO3uaZbRm4kLEYRfvH+laemtFNeIhlWGFPvSldwT6AdTXHhqUacfa1NvzMormdihFpd5PqRaaEoFAKA9we9bM2iX0Cq08TwoRkGTC5/OrD+IhpgJslEcxHNy6hpf+A5yE/U+4rOlvpJ7dr+Uu8rNy0zFmY+pJ5qXOpVqXUd+5r7kVoWJbGa3thOYSYSdolDBhu9MjofrWbcO7Hao/Af1rUsXkvdLlEUbB5WVAo74Oc/kP1q9pOkA3C28NudRuyQPKT/Vof9o9z7V6NHFRjR5qmhi6UpytExtN0Se8HmuyQW4PzTSHCj6etdV4c0G9u3kg8PWaqqLum1K4wAid2+bCov8AtNgfWtm8sdG0F1k8VXL6hqiAGHR7UgGP03nlYh9ct6AVzHi7x15sP2XUZI0tkbfDo9iNsKHsXzyzf7Tkn0Aryq2NqYh8tPRHQo06C13NlF8PaPIzaYkfiLURzLqN7kWUR9VU4abHq21PZq4/xX46/wBMaWO6Or6jjYbubmKMf3Y1GAFHooC/WuO1/wAQ6jq5KSv5VsD8sEfC/j/ePuaxzSp4VR1lqzmqYiUtEWdSv7zUbk3F7cSTynjLHoPQDsPYVWooxXUc4UGiigApKWigAooooAKKSloAKKSigBaKSloAKKSigBe9FAooAfFK8UgkidkYdCDXS+GPF1/pOoRXlteT2V3GfkuIGKkfXHb9PauXpKidOM1aSKjJx2Po/QPiFoPiIQweK4k06+H+q1a0XahPq6r933K5Hqtafi3w9Dc2if2zbpqFlIu621SzwxI/vcZDD3GfcCvmazvJ7Vsxt8p6qehrvfAHxD1Xw/KY7G4U20pzNYXXzwS/h2P+0MH3rhlhp0dab07HdSxd1yzLmsaf4h8MyLLpmpXcmnyNiO5tJG2c9A6jofwxVV9R19xvu4IL1T1MkKkn8Vwa9M0jUND8UztJoFwNH1iT7+mXLjZOfSNjgP8AQ4b61m6pp8aXL2t7anS7wHaUdSI2b0H90+xrowv1eq+WejN1RTV4M8t1yee7ljZ4GtREuI4wW2qc5JGemTWnHcR67ZfZ5Rs1CEfIW/jHv/n3rd1S0ntHMV1FtB6bhkEVimxt11CO6ibyynO1ehr044Z01ZO8WZcrTs2Y8Dsjm3lBVlOBnqParC7kcOhww/Ueh9qv67ZLcp9qhH71RlgP4h6/UVl2s3mIVbhx1968zE0JUJmTi4Ow+SbyzjpG33M9j6Vn3JJf5Tzmr8yLJGyN0br/AI1ly+ZG5iflhyCP4h616eFxjqR5ZboJSbQzz3Q4OTipoHd8kZx7VVkZiOpJHYirNlOip2J7g130p62bMr6iTO6noeOtKLliFXdj8aiuLpTLlkGDVcsrMduBnt3q3VSejJb10NZGypIbKj361Zjuh5bpC6HaAck4P4VhmR0TZkgfSp4mCt8pHPAxXVTxXKHMbltOScuwC45Jq0Ljyo1u5BnqLeNu5/vn2H6n6GsfT1NxIzyORbw4LsOrHso9z/8AXqxczNPJvbsAqgdFA6Ae1eVmeatx9lDfqbRfKr9RjFmdnclmJJYnv70yNXnlCLwPU9h6012Lt5cfJPB96uJ5dvBsB3OfvGvIwmGdWV3sZyZDPKGKWdvwp+8fUetdLpmlSrOtubPa+AQZmCIARnOSQPxzXORD98s+BleB6YrWt/MuVDEhIl6ySn5V+ldeIo1nUvFaLbyKpTXUn1PTdPiuZc3Ed/cEgJ9nJMKH64+c+w49zUE2lbokS7lMAJ+SFRud/bA9a6Hw9pV7qMjDSbclUXdLez4VEXuwzwo9zgVLPrmg+H45E0aNNa1Y5EmoXHNtF7qDzIfrhP8AerldeNG8U+ab3Z0OF/enoiWx0H7No0eoa7dR6NpWcKrE+bcH+6oHLH2Xp3IqrrHjtLDTzaeHYv7AsMFTcEj7XN64I/1Y9l59WrgvEPiqe7vXup7qTUr5hgzzHKoPRR6ewwK5e6uZ7qYyzytI57n/ADxWCoSqWdR/LoZVMVZWgbGo+IpnDQ6eGt42J3SE5kcnqc9v5+9YZJJJJJJ60lJXXGKirI4229xaKKKYgoopKAFooooAKKKSgBaSiloAKKKSgBaKSloAKKKKAEpaBRQAUUUUAFFFFABQKKKANCx1SaDCS5ljHTP3h9DXp/hv4lTzWiWHiCP+3dPVQg81sXMC/wCy5zkD+62R6EV5BTo5HjcOjFWHQg1jVoQqbmtOtKm7o+ho7W31LT5Lnw7dJrGmqMy2c3yz2/1B5X68r71zdzogld3093LLy9tKMSJ/8UK840XxDd2N5Hcw3E1rcxn5J4WKkflXpmkeM9M1pI4fEqC2uf8Alnqdqnyk+siDp/vL+K1EK9bD6PVHoQxEKuktGYMzSwOUwUIPI9PwrJ1S3MeLyHoT84HQe/0Nei69pUvkJLeIl7ayDMN/akNuHrkcN/P2rlb6wkggZ42W5tyPvqP5jtXW61PExtcdSm2tTAicSx7l49R6VDdwGZQAcOPuN6H0+hpJFNtKHTJjbj6e1WlAZQw5U157UqM7o49bmE5fnK4ZThgeoNRO4Vg+MHvWxqFrvVpox+8UfMP7w/xH8qyWXPKnGa9WjX9pG63IlFkUwV23ZIB/KkjjKyBhk+nvTlDKNpxn6075mYbm+la31uZ2Hj5m5Vj6EirMEMs0ot0IyRlmPRF7kmmr5m5YogZJXOFUDJJNascAs4DbIQ0h5mcchm9B7D9Tz6VnicT7KNluzSMerFbYsSQQ5EMf3c9Se7H3P6dKhnk2KFB+Y0+aXyo8nGT0FVFIL5cksemOteXRpyqyHORLG4jBAGW747e1WLJJLqTaiGRuwA4FSWtlt2m4JiDfdiUZdq6az0F4tNF9q9zHo2kt0LH55yOygfM59l49SK9d16WFglcIUZT1exl2lmDOsMMf267JwEj/ANWh9Ce59q37i10nw/tm8T3BvNQAzHpdqwynp5h6R/jlvasjVPGUWn2TWPhqA6RaEFWunx9qmHfBHEYPovPq1ef3WpSOWEBKKerZ+Y/jXn1K1bE76RNHUhS0itTsfF3ji91KH7HMY7WxU5j020ysQPYvnl292yfQCuJvb+4uvldtseeEXp/9eqp5PNFOnSjBWSOadSU3dhRS0laEBRRRQAUUUUAFJS0UAFFFJQAtFJS0AFHeiigBKWkpe1ABRSUtABRSUtABRSUtABRRRQAUUlFAC0UUUABopKKAFqa2uZbdsxtgd17GoaSjcDtfCPjO/wBGkYWc4WOQ/vbWYb4Zfqp7+4wfeu80++0DxK4+wSnRtWfg20r5imPojng/RsH3NeH1bs76SDAb50/UVzVMOm+aGjOmliZQ0ex6Zr2ilJnt7y2azuAcHj5G/wADXMPHNp10ba4UhTyD2x6iuk8N/EETWqWPiCA6pZqAqy5AuIR9T94D0P4GtnVvDNtrmlNf+H7uPULdORg4khPo6nlfx49DXNKrKPu1V8zqkoVleG5xWOMjjHQisnVLbymNxGv7tjh1H8J9fof/AK1aEXmQTPaXCskiHbg9QfSpAAAQyB1Iwynow9DVU6jpSujn30ZzjgEqwGQPSlaUKnKDrxxVjVLb7FIpBLW8oJjf09VPuP8A6/erekWiuF1CeMeWvy26N/y0YdWPsP1PHrXpPExjDmRKhrYm0y3NpD58v/H3KuR/0yQ/+zEfkPrT2YIpY9BTnJZmZiSSckk9fWm6bZ3es3wtbKJpMc8dPrXmSk5tykVvoiCGJ7l2mk2pEvG5ug9q3/DugXt/IxsINqKu6S7mGAi9254A9zWrcaNpHhhEk8S3Jmu1GYtNgwZPq3ZB7tz7VzHizxnd6kn2RQtnYKfksrc4X6uerH6/lWsK0mrUl8y3GFLWerN2XWdB8PF10iNNX1DHzXk4Jt0PqoPMn44X2NcXrfiK71C8e6ubh7y6bjzZDkKPRR0A9hgVjXFzLOcMcL2UdKhrWFBJ3lqznqVpT9B8sskrl5HLse5plFFbmIUZoooAKKKSgBaKKSgBaSiigBaKKSgAoopaACikqeytpry5S3gXdI+cD6DP9KAIKWiigAoopKAFooooAKKKO1ACUtFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFACozI25GKsOhFbvh/wAR32lXqXVrcy2twnSaI4yPQjuPbpWDRUygpKzGpOLuj0jxP4g0zxFpkN7Lp4tNdjcLJPa4FvdR46snVJAe44IJGBgVkW03mpgnDDr71ydvcSwNmNsZ6jsa1bLUI3YZPlyD1PBrmlh+WNka+1bd2dBDJFG+LizivLdjl4ZGKgnsQRyCPWmM7ORnaMAKABgKB0AHYCmROJFDZ46H2NQX1wIV2IwDY5PoK50m3Y2crIjvZgWMaYx0Y10DeNYtD0CDTPDVqNPlKZvNRkw1zcSEc7O0aDoMc9yea4e5v1X5YBk/3j0qg7tIxZ2LMe5rpWHUkuYx9q1sW7zUJZmYqWBY5Zycux9SapUUV0pJbGTdwooNApiCilpKACiijvQAUUUUAFFFFABiiiigBKXFFAoAKKKls5YobhZJrdLiMfejYkAj6jkUARV1fw3sLq51N5rOATXWVhtkY4DSP7+yhjV7StL03XJIY/D+hQ3sr8SQyXbRyRepOTgr7ive/hN8Oo/DQTULqGyFy25lW3laRI8jHDMOTjqfwrOUrotKzPl3xPZix1y5gQERl98eR/C3I/nj8Kza+lPit8LzdTNrOm6dY3kxBDWz3LRO/JOUxxnnkHH1rxfWYtF0qJoLvSIV1IEhrdLl3EX++wOM+wpqXQTif//Z" alt="d20" style={{width:28,height:28,borderRadius:"50%",objectFit:"cover"}}/><h1 style={{margin:0,fontSize:20,fontWeight:900,color:C.text}}>Roll for Task</h1></div>
            <div style={{fontSize:11,color:C.soft,marginTop:2}}>{activeMust.length} left · {completed.length} done</div>
          </div>
          <button onClick={()=>{setScreen("setup");setResult(null);setCompleted([]);setRemovedFun([]);}}
            style={btn("rgba(255,255,255,0.08)",C.textDim,{fontSize:12,padding:"6px 14px",border:"1px solid rgba(255,255,255,0.15)",boxShadow:"none"})}>← Setup</button>
        </div>



        {result && (
          <div style={card({
            animation:result.type==="fun"?"pop 0.3s ease, glowViolet 2.5s ease-in-out infinite":"pop 0.3s ease, glowGold 2.5s ease-in-out infinite",
            background:result.type==="fun" ? "#160e2e" : "#12101e",
            border:`2px solid ${result.type==="fun"?C.fun:C.must}`,
            textAlign:"center",
          })}>
            <div style={{fontSize:42,marginBottom:8,filter:`drop-shadow(0 0 10px ${result.type==="fun"?"rgba(168,122,255,0.6)":"rgba(255,215,0,0.6)"})`}}>{result.type==="fun"?"✨":"⚔️"}</div>
            <Tag type={result.type}/>
            <div style={{fontSize:22,fontWeight:900,color:"#ffffff",margin:"10px 0 6px",textShadow:`0 0 16px ${result.type==="fun"?"rgba(168,122,255,0.4)":"rgba(255,215,0,0.35)"}`}}>{result.text}</div>

            {result.duration && (showTimer?(
              <CountdownTimer minutes={result.duration} onDone={()=>{setTimerDone(true);setShowTimer(false);}}/>
            ):timerDone?(
              <div style={{fontSize:13,color:C.purple,fontWeight:800,margin:"8px 0"}}>⏰ Time's up!</div>
            ):(
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,margin:"8px 0"}}>
                <span style={{fontSize:13,color:C.soft,fontWeight:700}}>⏱ {result.duration} min</span>
                <button onClick={()=>setShowTimer(true)} style={btn(result.type==="fun"?C.fun:C.must,result.type==="fun"?"white":"#1a1000",{padding:"5px 12px",fontSize:11,boxShadow:"none"})}>Start Timer</button>
              </div>
            ))}

            <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 12px",margin:"10px 0",textAlign:"left"}}>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                <input type="checkbox" checked={result.keepInRotation}
                  onChange={()=>setResult(r=>({...r,keepInRotation:!r.keepInRotation}))}
                  style={{accentColor:result.type==="fun"?C.fun:C.must,width:16,height:16}}/>
                <div style={{fontSize:12,fontWeight:800,color:C.text}}>Keep in rotation <span style={{fontSize:11,fontWeight:700,color:C.soft}}>(won't mark as complete)</span></div>
              </label>
            </div>

            <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:10}}>
              <button onClick={markDone} style={btn(result.type==="fun"?C.fun:C.must,result.type==="fun"?"white":"#1a1000",{boxShadow:`0 4px 0 rgba(0,0,0,0.4), 0 0 14px ${result.type==="fun"?"rgba(168,122,255,0.4)":"rgba(255,215,0,0.4)"}`})}>
                {result.type==="fun"?"Done! ✨":"Done! ✅"}
              </button>
              <button onClick={()=>setResult(null)} style={btn("rgba(255,255,255,0.08)",C.textDim,{border:"1px solid rgba(255,255,255,0.12)"})}>Skip</button>
            </div>
          </div>
        )}

        {!allDone && (
          <div style={card({textAlign:"center"})}>
            <DiceBox onResult={handleDiceRoll} items={allItems}/>
          </div>
        )}

        <div style={card()}>
          <div style={{fontSize:11,fontWeight:800,color:C.soft,marginBottom:10,letterSpacing:2}}>TASK LIST</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {mustItems.map(item=>(
              <div key={item.id}
                onClick={()=>{
                  if(completed.includes(item.id)) {
                    setCompleted(p=>p.filter(id=>id!==item.id));
                  } else {
                    setCompleted(p => {
                      const next = [...p, item.id];
                      completedRef.current = next;
                      const isAllDone = next.length === mustItems.length;
                      const a = getAchievement(next.length, isAllDone);
                      if (a) {
                        setAchievement({ ...a, taskName: item.text, key: Date.now() });
                        if(achieveTimerRef.current) clearTimeout(achieveTimerRef.current);
                        achieveTimerRef.current = setTimeout(() => setAchievement(null), 13000);
                      }
                      if (isAllDone) {
                        setTimeout(() => setScreen("celebration"), 50);
                      }
                      return next;
                    });
                    setConfetti(true); setTimeout(()=>setConfetti(false),1800);
                  }
                }}
                style={{
                  display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,
                  background:completed.includes(item.id)?"rgba(255,255,255,0.03)":"rgba(255,215,0,0.1)",
                  border:`1px solid ${completed.includes(item.id)?"rgba(255,255,255,0.06)":"rgba(255,215,0,0.22)"}`,
                  borderLeft:`3px solid ${completed.includes(item.id)?"rgba(255,255,255,0.06)":"rgba(255,215,0,0.7)"}`,
                  opacity:completed.includes(item.id)?0.45:1,
                  textDecoration:completed.includes(item.id)?"line-through":"none",
                  fontSize:13,color:C.text,cursor:"pointer",
                  transition:"opacity 0.2s, background 0.2s",
                }}>
                <span style={{fontSize:16}}>{completed.includes(item.id)?"✅":"○"}</span>
                <span style={{flex:1}}>{item.text}</span>
                {mustTimedIds.has(item.id)&&(
                  <span style={{fontSize:11,color:C.soft}}>{mustTMin[item.id]||10}–{mustTMax[item.id]||20} min</span>
                )}
              </div>
            ))}
            {!allDone && funItems.map(item=>(
              <div key={item.id} style={{
                display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,
                background:removedFun.includes(item.id)?"rgba(255,255,255,0.03)":"rgba(168,122,255,0.1)",
                border:`1px solid ${removedFun.includes(item.id)?"rgba(255,255,255,0.06)":"rgba(168,122,255,0.25)"}`,
                borderLeft:`3px solid ${removedFun.includes(item.id)?"rgba(255,255,255,0.06)":"rgba(168,122,255,0.7)"}`,
                opacity:removedFun.includes(item.id)?0.4:1,
                fontSize:13,color:C.text,
              }}>
                <span>{removedFun.includes(item.id)?"—":"✨"}</span>
                <span style={{flex:1}}>{item.text}</span>
                <span style={{fontSize:11,color:C.soft}}>{funMin}–{funMax} min</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
