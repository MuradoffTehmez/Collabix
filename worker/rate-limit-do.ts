// RateLimitDO — ATOMİK rate limiter (AUDIT-2026-07-26 / H-3).
//
// ════════════════════════════════════════════════════════════════════════════
// NİYƏ DURABLE OBJECT, NİYƏ NATIVE `ratelimit` BINDING DEYİL
// ════════════════════════════════════════════════════════════════════════════
//
// AUDIT-TASK-9 / 9.0-Sual 1 Cloudflare-in native rate limiting binding-inin
// semantikasını sənəddən yoxlamağı tələb edirdi. Nəticə — binding H-3-ün ÜÇ
// qüsurundan yalnız birini bağlayır:
//
//   developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
//   ① "For each unique key you pass to your rate limiting binding, there is a
//      unique limit PER CLOUDFLARE LOCATION."
//        → H-3/#2 (botnet coğrafi paylanma ilə limiti dəfələrlə keçir) AÇIQ QALIR.
//   ② "The Rate Limiting API is permissive, eventually consistent, and
//      INTENTIONALLY DESIGNED TO NOT BE USED AS AN ACCURATE ACCOUNTING SYSTEM."
//        → Təhlükəsizlik kontrolu üçün rəsmi olaraq tövsiyə edilmir.
//   ③ `period` yalnız 10 və ya 60 saniyə ola bilər.
//        → `auth` səbətinin 300 s pəncərəsi ifadə OLUNA BİLMİR.
//   ④ Limit `wrangler.jsonc`-də statikdir → 8+ səbət üçün 8+ ayrı binding.
//
// Durable Object isə hər açar üçün TƏK instansdır və qlobal ardıcıldır:
//   developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
//   "While these storage operations execute, no other requests can interleave —
//    input gate blocks new events."
// Məhz bu zəmanət H-3/#1-i (read-then-write yarışı) bağlayır: `get`→`put`
// arasında ikinci sorğu ARAYA GİRƏ BİLMİR.
//
// ⚠ MİQRASİYA QƏSDƏN NATAMAMDIR. AUDIT-TASK-4 §4.1 taksonomiyası:
//     🔴 TƏHLÜKƏSİZLİK səbətləri (auth, refresh, upload) → bu DO
//     🟠 XƏRC qoruyucuları (read, ai, presence, …)       → KV-də QALIR
//   Xərc səbətlərində təxmini sayma kifayətdir; hamısını DO-ya köçürmək hər
//   sorğuya DO round-trip-i əlavə edərdi və miqrasiya xərcini əsaslandırmazdı.
//
// ⚠ DO AÇAR STRATEGİYASI: hər limit açarı üçün AYRICA instans
//   (`idFromName('rl:auth:i:1.2.3.4')`). Şardlanmış alternativ az DO yaradır,
//   lakin daxili sayğac ayrımı tələb edir — sadəlik reqressiya riskini azaldır
//   (AUDIT-TASK-9 / A-1).
import { DurableObject } from 'cloudflare:workers';
import type { Env } from './util';

/** Tək açar altında saxlanılır — DO onsuz da bir limit açarına xidmət edir. */
const STATE_KEY = 'w';

/**
 * Alarm pəncərənin bitməsindən bu qədər sonra işə düşür. Ehtiyat saat
 * sürüşmələri üçündür — erkən oyanan alarm AKTİV pəncərəni silərdi.
 */
const ALARM_GRACE_MS = 60_000;

interface WinState {
  /** Sabit pəncərə indeksi: `floor(nowSec / windowSec)`. */
  win: number;
  count: number;
  /** Alarm-ın pəncərənin bitmə anını hesablaya bilməsi üçün saxlanılır. */
  windowSec: number;
}

export class RateLimitDO extends DurableObject<Env> {
  /**
   * Bir sorğunu sayğaca yazır və limitə sığıb-sığmadığını qaytarır.
   *
   * ⚠ `get` ilə `put` ARASINDA HEÇ BİR qeyri-storage `await` OLMAMALIDIR.
   * Input gate yalnız storage əməliyyatları boyunca qoruyur; araya `fetch()`
   * qoyulsa yarış PENCƏRƏSİ YENİDƏN AÇILAR və bu faylın bütün mənası itər
   * (bax "Rules of Durable Objects" → "Avoid race conditions with non-storage I/O").
   *
   * @param win        sabit pəncərə indeksi (çağıran tərəfdə hesablanır)
   * @param limit      pəncərə üzrə icazə verilən maksimum sorğu
   * @param windowSec  pəncərə uzunluğu — yalnız alarm hesabı üçün
   */
  async hit(win: number, limit: number, windowSec: number): Promise<boolean> {
    const cur = await this.ctx.storage.get<WinState>(STATE_KEY);
    const fresh = !cur || cur.win !== win;
    const st: WinState = fresh ? { win, count: 0, windowSec } : cur;

    if (st.count >= limit) return false;
    st.count++;
    await this.ctx.storage.put(STATE_KEY, st);

    // Alarm YALNIZ pəncərə açılanda qurulur — hər sorğuda `setAlarm` çağırmaq
    // storage yazısını ikiqat artırardı. Məqsəd: istifadə olunmayan DO-nun
    // state-i sonsuz qalmasın (hər IP üçün bir sətir → milyonlarla yetim sətir).
    if (fresh) await this.ctx.storage.setAlarm(this.endOf(st) + ALARM_GRACE_MS);
    return true;
  }

  /** Sabit pəncərənin bitmə anı (ms). */
  private endOf(st: WinState): number {
    return (st.win + 1) * st.windowSec * 1000;
  }

  async alarm(): Promise<void> {
    const cur = await this.ctx.storage.get<WinState>(STATE_KEY);
    if (!cur) return;
    // 🔴 AKTİV pəncərəni SİLMƏ. Alarm gecikə və bu vaxt yeni pəncərə açılmış
    // ola bilər; kor-koranə `deleteAll()` hücumçunun sayğacını sıfırlayardı,
    // yəni təmizləmə məntiqi limiterin özündə boşluq yaradardı.
    if (Date.now() < this.endOf(cur)) {
      await this.ctx.storage.setAlarm(this.endOf(cur) + ALARM_GRACE_MS);
      return;
    }
    await this.ctx.storage.deleteAll();
  }
}
