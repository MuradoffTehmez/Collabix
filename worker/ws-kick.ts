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
import type { Env } from './util';

/**
 * İstifadəçinin qoşula biləcəyi BÜTÜN otaqlar.
 *
 * İki mənbə:
 *   • qlobal otaqlar (`rooms`) — bootstrap siyahısıdır, kiçikdir ('general' və s.)
 *     və hər istifadəçi onlara qoşula bilər;
 *   • istifadəçinin komandalarının çat otaqları (`team_chat_rooms`).
 *
 * ⚠ `team_members`-də sətir ARTIQ SİLİNMİŞ ola bilər (removeMember əvvəlcə
 *   silir). Ona görə komanda otaqları üçün çağıran tərəf `teamId`-ni AÇIQ
 *   ötürür — yalnız üzvlüyə güvənsək, çıxarılan üzv üçün siyahı boş qayıdar
 *   və kəsmə heç vaxt baş verməzdi.
 */
async function roomsForUser(env: Env, uid: string, extraTeamId?: string): Promise<string[]> {
  const ids = new Set<string>();
  try {
    const global = await env.DB.prepare('SELECT id FROM rooms').all<any>();
    for (const r of global.results) ids.add(String(r.id));

    const teamRooms = await env.DB.prepare(
      `SELECT id FROM team_chat_rooms
        WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = ?1)
           OR team_id = ?2`,
    ).bind(uid, extraTeamId || '').all<any>();
    for (const r of teamRooms.results) ids.add(String(r.id));
  } catch (e: any) {
    console.error('ws-kick otaq siyahısı alınmadı', uid, e?.message || e);
  }
  return [...ids];
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
 * İstifadəçini BÜTÜN otaqlardan kəsir — sessiya ləğvi, blok, hesab silinməsi.
 *
 * `ctx.waitUntil` ilə çağırılmalıdır: RPC cavabı gözlənilməməlidir, əks halda
 * "çıxış et" düyməsi otaq sayı qədər round-trip gözləyərdi (audit §C-2).
 */
export async function kickEverywhere(
  env: Env, uid: string, exceptSid?: string | null,
): Promise<void> {
  await kickFromRooms(env, uid, await roomsForUser(env, uid), exceptSid);
}

/** İstifadəçini yalnız BİR komandanın otaqlarından kəsir — üzvlük dəyişiklikləri. */
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
 * Komandanın BÜTÜN üzvlərini onun otaqlarından kəsir — `deleteTeam`.
 *
 * ⚠ Task 7 §8/3: `deleteTeam` SOFT-DELETE-dir, `team_members` sətirləri qalır.
 *   Yəni üzvlük yoxlaması otağı bağlamır — kəsmə burada AÇIQ edilməlidir.
 *   (Soft-delete siyasətinin özü Task 10-dadır; burada yalnız soket kəsilir.)
 *
 * ⚠ D-1: bütün sorğular alt-sorğu (`IN (SELECT …)`) formasındadır, yəni bağlı
 *   dəyişən sayı SABİTDİR və D1-in 100 parametr limiti bu modulda risk deyil.
 */
export async function kickTeamRooms(env: Env, teamId: string): Promise<void> {
  if (!teamId || !env.ROOM_DO) return;
  try {
    const [rooms, members] = await Promise.all([
      env.DB.prepare('SELECT id FROM team_chat_rooms WHERE team_id = ?').bind(teamId).all<any>(),
      env.DB.prepare('SELECT user_id FROM team_members WHERE team_id = ?').bind(teamId).all<any>(),
    ]);
    const roomIds = rooms.results.map(r => String(r.id));
    for (const m of members.results) await kickFromRooms(env, String(m.user_id), roomIds);
  } catch (e: any) {
    console.error('ws-kick komanda silinməsi', teamId, e?.message || e);
  }
}
