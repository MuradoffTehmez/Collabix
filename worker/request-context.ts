// Sorğu konteksti və strukturlu log — AUDIT-TASK-10 / Faza 2.2.
//
// Audit (error states 70%): "Generik 500-lər, REQUEST ID YOX, boş `catch{}`
// blokları, frontend-də global error boundary yox."
//
// ════════════════════════════════════════════════════════════════════════════
// NİYƏ `AsyncLocalStorage`, NİYƏ PARAMETR DEYİL
// ════════════════════════════════════════════════════════════════════════════
//
// `err()` və `json()` layihədə 100+ yerdən çağırılır. Request ID-ni parametr
// kimi ötürmək həmin çağırışların HAMISINI dəyişmək demək idi — yəni Faza 3-ün
// "saf refaktor" qaydası ilə eyni commit-də yüzlərlə toxunuş.
//
// `AsyncLocalStorage` (nodejs_compat ilə Workers-də mövcuddur) kontekstin
// çağırış zəncirində GÖRÜNMƏZ şəkildə daşınmasına imkan verir.
//
// ⚠ MODUL SƏVİYYƏSİNDƏ DƏYİŞƏN İŞLƏTMƏK OLMAZDI: bir isolate eyni anda bir
//   neçə sorğu emal edir və qlobal dəyişən onları QARIŞDIRARDI — request ID
//   başqa istifadəçinin cavabına düşərdi.
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  /** Cavab başlığında (`X-Request-Id`) və hər log sətrində görünür. */
  requestId: string;
  method: string;
  path: string;
  /** `Date.now()` — müddət hesablamaq üçün. */
  start: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Sorğu emalını kontekst içində icra edir. */
export function runWithRequestContext<T>(rc: RequestContext, fn: () => T): T {
  return storage.run(rc, fn);
}

/** Cari sorğunun id-si — kontekstdən kənarda `null`. */
export const currentRequestId = (): string | null =>
  storage.getStore()?.requestId ?? null;

export const currentContext = (): RequestContext | undefined => storage.getStore();

/**
 * Yeni sorğu konteksti.
 *
 * ⚠ Cloudflare sorğuya artıq `cf-ray` başlığı əlavə edir. ONDAN İSTİFADƏ
 *   EDİLİR: belədə tətbiq logu ilə Cloudflare-in öz analitikası EYNİ
 *   identifikatorla uzlaşdırıla bilir. `cf-ray` yoxdursa (lokal `wrangler dev`)
 *   UUID yaradılır.
 */
export function newRequestContext(req: Request, path: string): RequestContext {
  return {
    requestId: req.headers.get('cf-ray') || crypto.randomUUID(),
    method: req.method,
    path,
    start: Date.now(),
  };
}

type Level = 'info' | 'warn' | 'error';

/**
 * Strukturlu log sətri.
 *
 * ⚠ JSON QƏSDƏNDİR: Cloudflare Workers Logs (Faza 2.1-də açıldı) JSON
 *   sahələrini indeksləyir — `console.error('mətn', obj)` isə yalnız mətn kimi
 *   axtarıla bilir. `requestId` ilə bir sorğunun BÜTÜN sətirləri bir yerə yığılır.
 *
 * ⚠ MƏZMUN SIZDIRMA: `extra`-ya istifadəçi mətni, token və ya tam fayl açarı
 *   QOYULMAMALIDIR — loglar saxlanılır və ixrac oluna bilər.
 */
export function log(level: Level, event: string, extra: Record<string, unknown> = {}): void {
  const rc = storage.getStore();
  const line = JSON.stringify({
    level,
    event,
    requestId: rc?.requestId ?? null,
    method: rc?.method,
    path: rc?.path,
    ms: rc ? Date.now() - rc.start : undefined,
    ...extra,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
