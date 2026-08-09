import { getTheme } from './ui.js';

let rafId = null;
let initialized = false;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * FX YALNIZ cyberpunk teması aktiv olanda qurulur.
 *
 * 🔴 NİYƏ (2026-08-09-da tapılan REQRESSİYA): bu funksiya əvvəl boot-da
 *    ŞƏRTSİZ işləyirdi və `<canvas id="cp-canvas">`-ı hər istifadəçi üçün
 *    `<body>`-yə əlavə edirdi. Onu gizlədən `#cp-canvas { position: fixed;
 *    display: none }` qaydası tema bölünməsində `css/theme-extra.css`-ə keçdi
 *    və o fayl yalnız matrix/cyberpunk seçiləndə yüklənir. Nəticədə tünd
 *    temada canvas STİLSİZ qalır: normal axında, `width×height` atributları
 *    ilə tam ekran ölçüsündə. Ölçüldü — sənəd 900px yerinə 1804px olurdu,
 *    yəni səhifənin altında bir ekran boyu BOŞ sahə yaranırdı və qabıq
 *    "sabit header" düzəlişindən əvvəl də səbəbsiz sürüşürdü.
 *
 * ⚠ İkinci qazanc: `loop()` hər kadrda `requestAnimationFrame` planlaşdırırdı
 *   və yalnız içəridə "tema cyberpunk deyil" deyib qayıdırdı — yəni BÜTÜN
 *   istifadəçilər üçün əbədi boş kadr döngüsü. İndi döngü ümumiyyətlə
 *   başlamır.
 *
 * ⚠ `MutationObserver` QƏSDƏN seçilib: `ui.js`-dəki `onThemeChange` TƏK
 *   callback saxlayır (ikinci abunə birincini basardı), `cyberpunk_fx.js` isə
 *   onsuz da `ui.js`-dən import edir — geri istinad dövr yaradardı.
 *   `data-theme` atributu isə temanın yeganə həqiqət mənbəyidir.
 */
export function initCyberpunkFX() {
  if (REDUCED) return; // Do not initialize heavy JS if reduced motion is requested.
  if (getTheme() === 'cyberpunk') { bootCyberpunkFX(); return; }

  const mo = new MutationObserver(() => {
    if (getTheme() !== 'cyberpunk') return;
    mo.disconnect();
    bootCyberpunkFX();
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

function bootCyberpunkFX() {
  if (initialized) return;
  initialized = true;

  document.body.classList.add('cp-fx-active');

  // 1. Custom Cursor setup
  const cursor = document.createElement('div');
  cursor.id = 'cp-cursor';
  document.body.appendChild(cursor);

  let mouseX = -999;
  let mouseY = -999;
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (getTheme() === 'cyberpunk') {
      cursor.style.left = mouseX + 'px';
      cursor.style.top = mouseY + 'px';
    }
  });

  document.addEventListener('mouseover', (e) => {
    if (getTheme() !== 'cyberpunk') return;
    const target = e.target.closest('a, button, input, select, .card');
    if (target) {
      cursor.classList.add('hovering');
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (getTheme() !== 'cyberpunk') return;
    const target = e.target.closest('a, button, input, select, .card');
    if (target) {
      cursor.classList.remove('hovering');
    }
  });

  // 2. Canvas Setup (Particles + Matrix Streams)
  const canvas = document.createElement('canvas');
  canvas.id = 'cp-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // Başlanğıc dəyər: `resize()` onları dərhal yeniləyir, lakin elan anında
  // `undefined` olması hesablamalarda `NaN` riski yaradırdı (checkJs TS18048).
  let w = 0, h = 0;
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // Particles Array (Optimized to 50)
  const particles = [];
  for (let i = 0; i < 50; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
    });
  }

  // Data Streams (Matrix columns)
  const columns = Math.floor(w / 20);
  const drops = [];
  for (let i = 0; i < columns; i++) {
    drops[i] = Math.random() * -100; // start off-screen
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    if (getTheme() !== 'cyberpunk') return; // Pause calculation if not active

    ctx.clearRect(0, 0, w, h);

    // --- Draw Data Streams (2% opacity Digital Rain) ---
    ctx.fillStyle = 'rgba(0, 245, 255, 0.02)';
    ctx.font = '15px "JetBrains Mono", monospace';
    for (let i = 0; i < drops.length; i++) {
      const text = Math.random() > 0.5 ? '1' : '0';
      ctx.fillText(text, i * 20, drops[i] * 20);
      if (drops[i] * 20 > h && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }

    // --- Draw Particles & Connection Lines ---
    ctx.fillStyle = '#FF0088';
    
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Dodge mouse
      const dx = p.x - mouseX;
      const dy = p.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        const force = (120 - dist) / 120;
        p.vx += (dx / dist) * force * 0.5;
        p.vy += (dy / dist) * force * 0.5;
      }

      // Move
      p.x += p.vx;
      p.y += p.vy;

      // Friction
      p.vx *= 0.98;
      p.vy *= 0.98;

      // Random roam if very slow
      if (Math.abs(p.vx) < 0.1) p.vx += (Math.random() - 0.5) * 0.2;
      if (Math.abs(p.vy) < 0.1) p.vy += (Math.random() - 0.5) * 0.2;

      // Wrap edges
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      // Draw Connection Lines (if near another particle and near mouse)
      if (dist < 200) {
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx2 = p.x - p2.x;
          const dy2 = p.y - p2.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (dist2 < 80) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(0, 245, 255, ${0.4 - (dist2 / 80) * 0.4})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Draw particle dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  requestAnimationFrame(loop);
}
