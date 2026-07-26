// Cloudflare Turnstile (TASK-8 / Bənd 7) — görünməz bot qoruması.
//
// GRACEFUL DEGRADATION burada da tətbiq olunur: `/api/config` boş site key
// qaytarırsa (açar hələ yaradılmayıb, və ya lokal dev) HEÇ NƏ yüklənmir —
// nə skript, nə widget. `getToken()` boş sətir qaytarır, server tərəf isə
// secret olmadığı üçün yoxlamanı onsuz da atlayır. Yəni açarlar qoyulana
// qədər qeydiyyat/giriş tam işlək qalır, açar qoyulan an qoruma özü aktivləşir.
import { getTheme } from './ui.js';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/* ---------- public konfiq (bir dəfə çəkilir) ---------- */
let cfgPromise = null;
export function siteConfig(){
  if(!cfgPromise){
    cfgPromise = fetch('/api/config', { credentials: 'same-origin' })
      .then(r => r.json())
      .catch(() => ({}));   // konfiq alınmasa da tətbiq işləməlidir
  }
  return cfgPromise;
}

/* ---------- skript (bir dəfə yüklənir) ---------- */
let scriptPromise = null;
function loadScript(){
  if(scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('turnstile script yüklənmədi'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

// Collabix-in 3 teması → Turnstile-ın 2 teması.
// 'matrix' tünd fondur, ona görə dark-a düşür.
const themeFor = () => (getTheme() === 'light' ? 'light' : 'dark');

/**
 * Widget-i konteynerə qoşur.
 * @returns {Promise<null|{getToken:Function, reset:Function, remove:Function}>}
 *          Açar yoxdursa / skript yüklənməsə `null` — çağıran tərəf bunu
 *          "qoruma söndürülüb" kimi qəbul edib davam etməlidir.
 */
export async function mountTurnstile(container, action){
  const cfg = await siteConfig();
  if(!cfg.turnstileSiteKey || !container) return null;
  try{ await loadScript(); }catch(e){ console.warn('Turnstile əlçatmazdır', e); return null; }
  if(!window.turnstile) return null;

  let token = '';
  let waiters = [];
  const settle = tok => { token = tok || ''; waiters.splice(0).forEach(fn => fn(token)); };

  container.innerHTML = '';
  const id = window.turnstile.render(container, {
    sitekey: cfg.turnstileSiteKey,
    action,
    theme: themeFor(),
    // 'interaction-only' — istifadəçi yalnız ŞÜBHƏLİ görünəndə qutu görür.
    // Normal halda widget tamamilə görünməzdir (UX-ə toxunmur).
    appearance: 'interaction-only',
    'refresh-expired': 'auto',
    callback: settle,
    'error-callback': () => settle(''),
    'timeout-callback': () => settle(''),
    'expired-callback': () => { token = ''; },
  });

  return {
    /**
     * Token-i gözləyir. `ms` bitəndə boş sətir qaytarır — ilişib qalmaq
     * əvəzinə server-in qərarına buraxırıq (server açarı varsa 403 verəcək,
     * yoxdursa buraxacaq). Beləcə Turnstile-ın yavaşlığı düyməni əbədi
     * kilidləmir.
     */
    getToken(ms = 10000){
      if(token) return Promise.resolve(token);
      return new Promise(resolve => {
        waiters.push(resolve);
        setTimeout(() => resolve(token || ''), ms);
      });
    },
    // Uğursuz cəhddən sonra token birdəfəlikdir — yenidən almaq lazımdır.
    reset(){ token = ''; try{ window.turnstile.reset(id); }catch(e){} },
    remove(){ try{ window.turnstile.remove(id); }catch(e){} },
  };
}

/* ---------- forma reyestri ----------
   Widget UI qatında (modal açılanda) qoşulur, token isə şəbəkə qatında
   (auth.js) lazım olur. Reyestr bu ikisini bir-birinə bağlayır ki, `login()`
   / `register()` funksiyalarına DOM referansı ötürmək lazım gəlməsin. */
const widgets = new Map();

export async function ensureWidget(key, container, action){
  if(widgets.has(key)) return widgets.get(key);
  const handle = await mountTurnstile(container, action);
  widgets.set(key, handle);        // `null` da saxlanılır — təkrar cəhd etməyək
  return handle;
}

// Qoruma söndürülübsə boş sətir → server onsuz da yoxlamanı atlayır.
export async function tokenFor(key){
  const h = widgets.get(key);
  return h ? h.getToken() : '';
}

export function resetWidget(key){
  const h = widgets.get(key);
  if(h) h.reset();
}
