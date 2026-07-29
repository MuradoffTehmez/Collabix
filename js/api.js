// REST müştərisi + polling meneceri. Cookie-əsaslı sessiya (HttpOnly) —
// hər sorğu same-origin gedir, token client JS-də saxlanılmır.
import { bus } from './util.js';

// `code` və `retryAfter` AUDIT-TASK-4 / §4.6 ilə əlavə olundu: çağıran tərəf
// (xüsusən polling dövrələri) mesaj MƏTNİNƏ baxmadan qərar verə bilsin.
// Mətnə görə qərar vermək tərcümə dəyişən kimi sınardı.
export class ApiError extends Error {
  constructor(message, status, code = '', retryAfter = 0){
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;   // saniyə — yalnız 429-da mənalıdır
  }
}

/* ---------- access token yeniləmə (TASK-8 / Bənd 15) ----------
   Access token cəmi 15 dəqiqə yaşayır, ona görə uzun sessiyada 401 NORMAL
   haldır — çıxış səbəbi deyil. Belə halda səssizcə `/auth/refresh` çağırılır
   (refresh cookie-si HttpOnly-dir, JS onu görmür — brauzer özü göndərir) və
   orijinal sorğu BİR DƏFƏ təkrarlanır.

   TƏK-UÇUŞ (single-flight): səhifə açılanda 5-6 sorğu paralel gedir və hamısı
   eyni anda 401 ala bilər. Hər biri ayrıca refresh etsəydi, token rotasiyası
   səbəbindən biri digərinin token-ini etibarsız edərdi → "reuse" aşkarlaması
   işə düşüb istifadəçini TAMAMİLƏ ÇIXARARDI. Ona görə eyni anda yalnız bir
   refresh sorğusu olur, qalanları həmin promise-i gözləyir. */
let refreshing = null;

function refreshSession(){
  if(refreshing) return refreshing;
  refreshing = (async () => {
    try{
      const r = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
      return r.ok;
    }catch(e){ return false; }
  })();
  // Nəticə oxunduqdan sonra qıfılı burax — növbəti dövr yenidən refresh edə bilsin.
  refreshing.finally(() => { refreshing = null; });
  return refreshing;
}

/**
 * @param {{ method?: string, body?: any, form?: FormData }} [cfg]
 * @returns {RequestInit}
 */
function buildOpts({ method = 'GET', body, form } = {}){
  /** @type {RequestInit & { headers: Record<string,string> }} */
  const opts = { method, credentials: 'same-origin', headers: {} };
  if(form){ opts.body = form; }
  else if(body !== undefined){
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  return opts;
}

export async function api(path, cfg = {}){
  let res = await fetch('/api' + path, buildOpts(cfg));
  let data = null;
  try{ data = await res.json(); }catch(e){}

  // 401 + `auth_required` → access token bitib. Bir dəfə yenilə, təkrar cəhd et.
  // `/auth/*` istisnadır: oradakı 401 «şifrə yanlışdır» və ya «refresh etibarsız»
  // deməkdir — onları təkrarlamaq sonsuz döngü yaradardı.
  if(res.status === 401 && data && data.code === 'auth_required' && !path.startsWith('/auth/')){
    const ok = await refreshSession();
    if(ok){
      // FormData bir dəfə oxunandan sonra təkrar istifadə oluna bilir (stream deyil),
      // ona görə opts yenidən qurulur və eyni gövdə ilə göndərilir.
      res = await fetch('/api' + path, buildOpts(cfg));
      data = null;
      try{ data = await res.json(); }catch(e){}
    }
  }

  if(!res.ok){
    if(res.status === 401) bus.dispatchEvent(new CustomEvent('api-unauthorized'));

    // 429 → `Retry-After` (saniyə) HTTP standartıdır; server onu hər limit
    // cavabında göndərir. Başlıq oxunmasa 60 saniyə ehtiyat dəyəri götürülür ki,
    // client sonsuz təkrar etməsin.
    let retryAfter = 0;
    if(res.status === 429){
      retryAfter = Number(res.headers.get('Retry-After')) || 60;
      // UI qatı bu hadisəni tutub istifadəçiyə anlaşılan mesaj göstərir —
      // 429 səssiz uğursuzluğa çevrilməməlidir (AUDIT-TASK-4 §4.6/4).
      bus.dispatchEvent(new CustomEvent('api-rate-limited', { detail: { retryAfter } }));
    }
    throw new ApiError(
      (data && data.error) || `Xəta (${res.status})`,
      res.status, (data && data.code) || '', retryAfter,
    );
  }
  return data;
}

// Polling: dərhal bir dəfə çəkir, sonra intervalla; `events` siyahısındakı
// bus hadisələrində dərhal təzələnir (mutasiyadan sonra ani yenilənmə).
export function startPoll({ fetcher, onData, interval, events = [] }){
  let stopped = false;
  let timer = null;
  // 429 alındıqda dövrənin dayandığı an (ms). AUDIT-TASK-4 §4.6/4:
  // 3 saniyəlik poll 429-dan sonra dayanmasa hər tick sayğacı yenidən doldurur
  // və istifadəçi limitdən HEÇ VAXT çıxa bilmir — öz-özünü gücləndirən nasazlıq.
  let pausedUntil = 0;
  const tick = async () => {
    if(stopped || document.hidden) return;
    if(Date.now() < pausedUntil) return;
    let data;
    try{
      data = await fetcher();
    }catch(e){
      if(e && e.status === 401) stopped = true; // sessiya bitib — poll dayansın
      else if(e && e.status === 429) pausedUntil = Date.now() + (e.retryAfter || 60) * 1000;
      else console.error('poll fetch xətası', e);
      return;
    }
    pausedUntil = 0;   // uğurlu cavab → fasilə bitdi
    // onData (render) burada, try/catch-dən KƏNARDA çağırılır — fetch xətaları ilə
    // render xətalarını qarışdırmayaq, əks halda render bugları səssizcə udulur.
    if(!stopped) onData(data);
  };
  tick();
  timer = setInterval(tick, interval);
  const handlers = events.map(ev => {
    const h = () => tick();
    bus.addEventListener(ev, h);
    return [ev, h];
  });
  const onVisible = () => { if(!document.hidden) tick(); };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    stopped = true;
    clearInterval(timer);
    handlers.forEach(([ev, h]) => bus.removeEventListener(ev, h));
    document.removeEventListener('visibilitychange', onVisible);
  };
}
