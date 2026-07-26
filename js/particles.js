// Interactive Particle Network (Constellation): mesh + maus repulse +
// 2s hərəkətsizlikdə particle-lar "COLLABIX" yazısına toplaşır (text-morph).
// Xüsusi Canvas 2D — kitabxanasız. prefers-reduced-motion-da işə düşmür.

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const IDLE_MS = 2000;
const LINK_DIST = 110;
const MOUSE_R = 130;

export function attachParticles(host){
  if(!host || REDUCED) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'particle-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, dpr = Math.min(devicePixelRatio || 1, 2);
  let parts = [];
  let targets = [];        // "COLLABIX" piksel hədəfləri
  let morphing = false;
  let lastMove = performance.now();
  let mouse = { x: -9999, y: -9999 };
  let raf = null;

  const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--coral').trim() || '#4a8fff';
  const accent2 = () => getComputedStyle(document.documentElement).getPropertyValue('--teal').trim() || '#5eeaea';

  function resize(){
    const r = host.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(140, Math.max(50, Math.floor(W * H / 9000)));
    parts = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .45, vy: (Math.random() - .5) * .45,
      tx: 0, ty: 0,
    }));
    sampleText();
  }

  // "COLLABIX" sözünü offscreen canvas-a çəkib piksellərini nümunələ.
  function sampleText(){
    targets = [];
    if(W < 200 || H < 120) return;
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const octx = off.getContext('2d');
    const fs = Math.min(W / 6.2, 120);
    octx.font = `800 ${fs}px 'Space Grotesk', 'JetBrains Mono', sans-serif`;
    octx.textAlign = 'center'; octx.textBaseline = 'middle';
    octx.fillStyle = '#fff';
    octx.fillText('COLLABIX', W / 2, H / 2);
    const data = octx.getImageData(0, 0, W, H).data;
    const gap = Math.max(6, Math.floor(fs / 14));
    for(let y = 0; y < H; y += gap){
      for(let x = 0; x < W; x += gap){
        if(data[(y * W + x) * 4 + 3] > 128) targets.push({ x, y });
      }
    }
    // qarışdır ki, morph təbii görünsün
    for(let i = targets.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [targets[i], targets[j]] = [targets[j], targets[i]];
    }
  }

  function assignTargets(){
    if(!targets.length) return;
    parts.forEach((p, i) => {
      const tgt = targets[i % targets.length];
      p.tx = tgt.x; p.ty = tgt.y;
    });
  }

  function frame(now){
    raf = requestAnimationFrame(frame);
    // görünmürsə heç nə etmə (tab gizli / element bağlı)
    if(document.hidden || !canvas.isConnected || host.offsetParent === null) return;
    const idle = now - lastMove > IDLE_MS && targets.length;
    if(idle && !morphing){ morphing = true; assignTargets(); }
    if(!idle && morphing) morphing = false;

    ctx.clearRect(0, 0, W, H);
    const col = accent(), col2 = accent2();

    for(const p of parts){
      if(morphing){
        // hədəfə yumşaq keçid
        p.x += (p.tx - p.x) * .06;
        p.y += (p.ty - p.y) * .06;
      } else {
        p.x += p.vx; p.y += p.vy;
        if(p.x < 0 || p.x > W) p.vx *= -1;
        if(p.y < 0 || p.y > H) p.vy *= -1;
        // maus repulse (elastik itələmə)
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if(d2 < MOUSE_R * MOUSE_R && d2 > 1){
          const d = Math.sqrt(d2);
          const f = (MOUSE_R - d) / MOUSE_R * 1.6;
          p.x += dx / d * f; p.y += dy / d * f;
        }
      }
    }

    // mesh xətləri (morph zamanı da incə saxlanılır)
    ctx.lineWidth = .6;
    for(let i = 0; i < parts.length; i++){
      for(let j = i + 1; j < parts.length; j++){
        const a = parts[i], b = parts[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if(d2 < LINK_DIST * LINK_DIST){
          const alpha = (1 - Math.sqrt(d2) / LINK_DIST) * (morphing ? .12 : .22);
          ctx.strokeStyle = col;
          ctx.globalAlpha = alpha;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    // particle nöqtələri
    ctx.globalAlpha = morphing ? .95 : .7;
    for(let i = 0; i < parts.length; i++){
      ctx.fillStyle = i % 5 ? col : col2;
      ctx.beginPath();
      ctx.arc(parts[i].x, parts[i].y, morphing ? 1.8 : 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function onMove(e){
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    lastMove = performance.now();
  }
  function onLeave(){ mouse.x = mouse.y = -9999; }

  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerleave', onLeave);
  window.addEventListener('resize', resize);
  resize();
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    host.removeEventListener('pointermove', onMove);
    host.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('resize', resize);
    canvas.remove();
  };
}
