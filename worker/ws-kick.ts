// WS sessiya kəsilməsi — AUDIT-2026-07-26 / H-6 (AUDIT-TASK-9 / C-2).
//
// PROBLEM: `revokeAllSessions` və `removeMember` WebSocket-ə TƏSİR ETMİRDİ.
// Komandadan çıxarılan / bloklanan / sessiyası ləğv edilən istifadəçi açıq
// soket üzərindən məxfi otağı oxumağa və yazmağa DAVAM EDİRDİ. Hibernation API
// ilə soket saatlarla, günlərlə yaşayır — yəni bu, nəzəri risk deyil.
//
// ⚠ İKİ QATLI MÜDAFİƏ:
//   • bu modul — DƏRHAL kəsir (RPC)
//   • RoomDO periodik re-auth (C-1) — RPC itsə/çatmasa 60 s içində kəsir
// Birincisi olmasa gecikmə qəbuledilməz olardı; ikincisi olmasa RPC-nin
// uğursuzluğu qoruma boşluğu yaradardı.
//
// ════════════════════════════════════════════════════════════════════════════
// 🔴 NİYƏ "BÜTÜN OTAQLARA GÖNDƏR" YANAŞMASI RƏDD EDİLDİ (ölçmə ilə)
// ════════════════════════════════════════════════════════════════════════════
//
// İlk versiya istifadəçinin qoşula BİLƏCƏYİ hər otağa `disconnect` göndərirdi.
// Ölçmə (lokal `wrangler dev`, ~15 otaq): bloklamadan SONRAKI ilk sorğu
// **32 saniyə** çəkdi və `admin.spec.ts` "#5 bulk blok" testi sındı.
//
// Səbəb: `env.ROOM_DO.get(...)` otaqda soket OLMASA BELƏ DO-nu OYADIR. Oyanan
// DO-nun gözləyən `alarm`-ı varsa o da işə düşür və hər soket üçün D1 re-auth
// sorğusu edir. Yəni bir bloklama onlarla DO-nu və onlarla D1 sorğusunu
// tetikləyirdi — halbuki bloklanan istifadəçinin çox güman heç bir açıq soketi
// yox idi.
//
// HƏLL: soketi OLAN otaqların siyahısı WS upgrade anında KV-yə yazılır
// (`noteSocket`), kəsmə isə YALNIZ həmin otaqlara göndərilir. Offline
// istifadəçini bloklamaq indi bir KV oxusudur və SIFIR DO oyanışıdır.
//
// ⚠ KV eventual consistency (~60 s) siyahını qısa müddət köhnə saxlaya bilər.
//   Bu, qoruma boşluğu YARATMIR: C-1 periodik re-auth məhz bu hal üçün
//   fallback-dır. Komanda hadisələri isə KV-dən ASILI DEYİL (aşağı bax).
import type { Env } from './util';

/** Canlı soket qeydinin ömrü. Soketlər bundan uzun yaşasa upgrade təkrarlanır. */
const LIVE_TTL_SEC = 3600;
/** Bir istifadəçi üçün izlənən maksimum otaq — açar sonsuz böyüməsin. */
const LIVE_MAX = 20;

const liveKey = (uid: string) => `wsrooms:${uid}`;

async function liveRooms(env: Env, uid: string): Promise<string[]> {
  try {
    const raw = await env.SESSIONS.get(liveKey(uid));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(x => typeof x === 'string') : [];
  } catch { return []; }
}

/**
 * WS upgrade anında çağırılır — "bu istifadəçinin bu otaqda soketi var".
 *
 * ⚠ 101 cavabından ƏVVƏL yazılmalıdır: əks halda soket mövcud olur, qeyd isə
 *   hələ yoxdur və həmin pəncərədə kəsmə otağı görmür.
 */
export async function noteSocket(env: Env, uid: string, roomId: string): Promise<void> {
  if (!uid || !roomId) return;
  try {
    const cur = await liveRooms(env, uid);
    if (cur.includes(roomId)) {
      // TTL-i təzələ: uzun yaşayan soket qeydi vaxtı bitib itməsin.
      await env.SESSIONS.put(liveKey(uid), JSON.stringify(cur), { expirationTtl: LIVE_TTL_SEC });
      return;
    }
    const next = [...cur, roomId].slice(-LIVE_MAX);
    await env.SESSIONS.put(liveKey(uid), JSON.stringify(next), { expirationTtl: LIVE_TTL_SEC });
  } catch (e: any) {
    // Qeyd tutulmasa kəsmə gecikər (C-1 60 s-də tutur) — soket AÇILMALIDIR.
    console.error('ws-kick qeydi yazılmadı', uid, roomId, e?.message || e);
  }
}

/**
 * Verilmiş otaqlarda istifadəçinin soketlərini bağlayır.
 *
 * ⚠ XƏTA İDARƏSİ (audit §C-2): RPC uğursuz olarsa ƏSAS ƏMƏLİYYAT
 *   (`removeMember`, `revokeAllSessions`) GERİ QAYTARILMIR. Səbəb: üzvün
 *   silinməsi bazada artıq doğrudur və onu geri almaq daha pis vəziyyət
 *   yaradardı. Xəta loglanır, periodik yoxlama (C-1) fallback-dır.
 */
export async function kickFromRooms(
  env: Env, uid: string, roomIds: string[], exceptSid?: string | null,
): Promise<void> {
  if (!uid || !roomIds.length || !env.ROOM_DO) return;
  await Promise.all(roomIds.map(async roomId => {
    try {
      await env.ROOM_DO.get(env.ROOM_DO.idFromName(roomId)).disconnect(uid, exceptSid);
    } catch (e: any) {
      console.error('ws-kick uğursuz', roomId, uid, e?.message || e);
    }
  }));
}

/**
 * İstifadəçini CANLI soketi olan bütün otaqlardan kəsir — sessiya ləğvi, blok,
 * parol dəyişikliyi, hesab silinməsi.
 *
 * `ctx.waitUntil` ilə çağırılmalıdır.
 */
export async function kickEverywhere(
  env: Env, uid: string, exceptSid?: string | null,
): Promise<void> {
  const rooms = await liveRooms(env, uid);
  if (!rooms.length) return;   // 🔴 sürətli yol: heç bir DO oyandırılmır
  await kickFromRooms(env, uid, rooms, exceptSid);
}

/**
 * İstifadəçini BİR komandanın otaqlarından kəsir — üzvlük/rol dəyişiklikləri.
 *
 * ⚠ Bu yol KV qeydindən ASILI DEYİL və olmamalıdır. Komandadan çıxarılma
 *   H-6-nın ƏSAS ssenarisidir; KV-nin eventual consistency-si burada 60 s-lik
 *   sızma pəncərəsi açardı. Komanda otaqlarının sayı kiçikdir (adətən 1-3),
 *   ona görə birbaşa göndərmək ucuzdur.
 */
export async function kickFromTeam(env: Env, uid: string, teamId: string): Promise<void> {
  if (!teamId) return;
  try {
    const rows = await env.DB.prepare('SELECT id FROM team_chat_rooms WHERE team_id = ?')
      .bind(teamId).all<any>();
    await kickFromRooms(env, uid, rows.results.map(r => String(r.id)));
  } catch (e: any) {
    console.error('ws-kick komanda otaqları alınmadı', teamId, e?.message || e);
  }
}

/**
 * Komandanın BÜTÜN soketlərini bağlayır — `deleteTeam`.
 *
 * ⚠ Task 7 §8/3: `deleteTeam` SOFT-DELETE-dir, `team_members` sətirləri qalır.
 *   Yəni üzvlük yoxlaması otağı bağlamır — kəsmə burada AÇIQ edilməlidir.
 *   (Soft-delete siyasətinin özü Task 10-dadır.)
 *
 * ⚠ Üzv-üzv gəzmək ƏVƏZİNƏ otaq başına TƏK `disconnectAll()` çağırılır:
 *   1000 üzvlü komandada birincisi 1000 RPC, ikincisi isə otaq sayı qədər
 *   (adətən 1-3) RPC deməkdir.
 */
export async function kickTeamRooms(env: Env, teamId: string): Promise<void> {
  if (!teamId || !env.ROOM_DO) return;
  try {
    const rooms = await env.DB.prepare('SELECT id FROM team_chat_rooms WHERE team_id = ?')
      .bind(teamId).all<any>();
    await Promise.all(rooms.results.map(async r => {
      try {
        await env.ROOM_DO.get(env.ROOM_DO.idFromName(String(r.id))).disconnectAll();
      } catch (e: any) {
        console.error('ws-kick otaq bağlanmadı', r.id, e?.message || e);
      }
    }));
  } catch (e: any) {
    console.error('ws-kick komanda silinməsi', teamId, e?.message || e);
  }
}
