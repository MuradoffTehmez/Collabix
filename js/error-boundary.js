// Qlobal error boundary — AUDIT-TASK-10 / Faza 2.2.
//
// Audit (error states 70%): "frontend-də global error boundary YOX."
//
// PROBLEM: tutulmayan JS xətası və ya rədd edilmiş promise səhifəni SÜKUTLA
// yarımçıq qoyurdu — istifadəçi boş ekran və ya donmuş düymə görürdü, heç bir
// izahat almırdı və dəstəyə nə deyəcəyini bilmirdi.
//
// ⚠ BU, `try/catch`-in ƏVƏZİ DEYİL. Modul kodu öz xətalarını olduğu kimi
//   idarə etməlidir; bu qat yalnız QAÇAN xətaları tutur.
import { toast } from './ui.js';
import { t } from './i18n.js';

/**
 * Eyni xəta təkrarlanarsa toast selini bağlayır.
 *
 * ⚠ Sonsuz döngəyə düşmüş `setInterval` saniyədə onlarla eyni xəta atır;
 *   qorumasız hər biri toast yaradar və interfeys tamamilə istifadəolunmaz olardı.
 */
const seen = new Map();
const REPEAT_WINDOW_MS = 10_000;

function shouldReport(key) {
  const now = Date.now();
  const last = seen.get(key);
  if (last && now - last < REPEAT_WINDOW_MS) return false;
  seen.set(key, now);
  // Xəritə sonsuz böyüməsin.
  if (seen.size > 50) seen.delete(seen.keys().next().value);
  return true;
}

/**
 * ⚠ Şəbəkə/abort xətaları BURADA GÖSTƏRİLMİR.
 *
 * `api.js` onları öz axınında idarə edir (401 → refresh, 429 → dayan) və
 * istifadəçi onsuz da müvafiq mesajı görür. Burada təkrar göstərmək eyni
 * hadisə üçün iki toast demək olardı.
 */
function isNoise(reason) {
  const msg = String(reason?.message || reason || '');
  return /AbortError|Failed to fetch|NetworkError|Load failed|ResizeObserver/i.test(msg);
}

function report(kind, reason, extra = {}) {
  if (isNoise(reason)) return;
  const message = String(reason?.message || reason || 'naməlum');
  if (!shouldReport(kind + ':' + message.slice(0, 120))) return;

  // Konsola STRUKTURLU yazılır — brauzer konsolu dəstəyin yeganə mənbəyidir
  // (server-side log frontend xətasını görmür).
  console.error(JSON.stringify({
    level: 'error', event: 'ui_' + kind, message,
    stack: typeof reason?.stack === 'string' ? reason.stack.slice(0, 600) : undefined,
    path: location.hash || location.pathname,
    ...extra,
  }));

  toast(t('err.unexpected'), 'err');
}

let installed = false;

/**
 * Boot-un ƏN ƏVVƏLİNDƏ çağırılmalıdır ki, modul yüklənməsi zamanı atılan
 * xətalar da tutulsun.
 */
export function initErrorBoundary() {
  if (installed) return;
  installed = true;

  window.addEventListener('error', ev => {
    // Resurs yüklənmə xətaları (`<img>`, `<script>`) `error` hadisəsi verir,
    // lakin `ev.error` boş olur — onlar istifadəçiyə göstərilməməlidir.
    if (!ev.error) return;
    report('error', ev.error, { source: ev.filename, line: ev.lineno });
  });

  window.addEventListener('unhandledrejection', ev => {
    report('rejection', ev.reason);
  });
}
