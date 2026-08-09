// `routes.ts` bölünməsinin PAYLAŞILAN QATI — AUDIT-TASK-10 / Faza 3.1.
//
// Audit struktur borcu #1 (*"ən böyük borc"*): `routes.ts` 185 KB / 120 export.
// Hər dəyişiklik bütün faylı toxundururdu, merge konflikti riski və koqnitiv
// yük yaradırdı. `team-routes.ts` + `services/team/` nümunəsi düzgün yolu
// göstərirdi — bu bölünmə həmin naxışı `routes.ts`-ə tətbiq edir.
//
// 🔴 SAF REFAKTOR QAYDASI (sənəd §11.2): bu köçürmə DAVRANIŞ DƏYİŞMİR.
//   Funksiyaların gövdəsi, şərhləri və sırası OLDUĞU KİMİ köçürülüb; yalnız
//   `export` sözü əlavə edilib ki, domen modulları onlara çata bilsin.
//
// ⚠ ŞƏRH MƏDƏNİYYƏTİ (sənəd §11.5): audit bu layihənin şərhlərini "ən dəyərli
//   aktivlərindən biri" adlandırıb. Bölünmə zamanı şərhlər KÖÇÜRÜLÜB, silinməyib.
import {
  Ctx, err, json, todayStr, chunkForD1, placeholders, extractMentions, withCookies,
} from '../util';
import { sessionCookies, type TokenPair } from '../auth';
import { NotificationService } from '../services/notification';
import { grantXp } from '../xp';

/** D1 qısayolu — bütün domen modulları bunu işlədir. */
export const D = (c: Ctx) => c.env.DB;

/* ================= köməkçilər ================= */

/**
 * Bildiriş göndərmə — `Ctx` üçün NAZİK ÖRTÜK.
 *
 * 🔴 AUDIT-TASK-10 / Faza 3.2 (audit struktur borcu #4) — İKİ `notify()`
 * BİRLƏŞDİRİLDİ.
 *
 * Əvvəl eyni qaydalar İKİ yerdə yazılmışdı: burada və
 * `services/notification/index.ts`-də. Audit xəbərdarlığı: *"Şərh bunu 'eyni
 * qaydalar' kimi təsvir edir; VAXTLA AYRILACAQLAR."*
 *
 * Sənədin tələbi ilə əvvəlcə DIFF edildi — qaydalar hələ eyni idi (tərcih
 * yoxlaması + eyni INSERT). Fərq yalnız interfeysdə idi:
 *   • servis  — `env` alır, `fromId`/`fromName` AÇIQ ötürülür, `boolean` qaytarır,
 *               realtime siqnalı AYRICA metoddadır (queue/job-lar üçün uyğun)
 *   • bu örtük — `Ctx` alır, göndərəni `c.user`-dan çıxarır və siqnalı özü atır
 *
 * Ona görə SERVİS kanonik implementasiya seçildi (o, `Ctx`-dən asılı deyil və
 * artıq `queue.ts`, `jobs/ai.ts`, `jobs/render.ts` tərəfindən işlədilir), bu
 * funksiya isə yalnız uyğunlaşdırıcı qaldı. `msg.ts`-in paylaşılan modul kimi
 * çıxarılması ilə EYNİ naxışdır (auditin "düzgün naxış" adlandırdığı).
 *
 * ⚠ Realtime siqnal YALNIZ sətir həqiqətən yazılanda atılır: servis `false`
 *   qaytarırsa (tərcih söndürülüb və ya istifadəçi yoxdur) boş yerə siqnal
 *   getməməlidir.
 */
/**
 * @param eventKey İdempotentlik açarı — bax `NotificationService.notify`.
 *   Verilsə, eyni açarla ikinci bildiriş BAZADA bloklanır (BE-003/BE-004).
 */
export async function notify(
  c: Ctx, toUid: string, type: string, text: string,
  postId: string | null = null, eventKey: string | null = null,
) {
  if (!c.user) return;
  const wrote = await new NotificationService(c.env)
    .notify(toUid, c.user.id, c.user.name, type, text, postId, eventKey);
  if (wrote) await userPush(c, toUid, { t: 'notif' });
}

export async function notifyMentions(c: Ctx, text: string, label: string, postId: string | null = null) {
  const names = extractMentions(text);
  if (!names.length) return;
  // D-1: mətn 5000 simvola qədərdir və `@abc` cəmi 4 simvoldur → NƏZƏRİ olaraq
  // 1000+ unikal qeyd. Bölünmədən `IN (?×1000)` D1-i çökdürürdü.
  for (const chunk of chunkForD1(names)) {
    const q = `SELECT id FROM users WHERE username IN (${placeholders(chunk.length)})`;
    const rows = await D(c).prepare(q).bind(...chunk).all<any>();
    for (const r of rows.results) await notify(c, r.id, 'mention', label, postId);
  }
}

// Gündəlik fəaliyyət sayğacı (Bənd 9).
//
// İKİ yerə yazılır və bu, keçid dövrü üçün QƏSDƏNDİR:
//   * `user_activity` — yeni, normalized mənbə. Artımlı UPSERT: bütün tarixçəni
//     oxuyub geri yazmır, yəni "lost update" problemi yoxdur və yazı həcmi sabitdir.
//   * `users.activity_days` — köhnə JSON blob. Hələ də yenilənir, çünki keşlənmiş
//     köhnə client-lər (`mapUser` → `activityDays`) onu oxuyur. Bütün client-lər
//     yeni endpoint-ə keçəndən sonra bu sətir silinə bilər.
export async function bumpActivity(c: Ctx) {
  const day = todayStr();
  // AUDIT M-8 — köhnə `users.activity_days` JSON blob-una yazı DAYANDIRILDI.
  //
  // Problem: blob read-modify-write idi (bütün tarixçəni oxu → dəyiş → geri
  // yaz). İki paralel sorğu eyni köhnə blob-u oxuyub bir-birinin artımını
  // itirirdi (lost update). `user_activity` isə artımlı UPSERT-dir — yarış
  // yoxdur və yazı həcmi sabitdir.
  //
  // ⚠ Oxu yolu ƏVVƏLCƏ köçürülüb (Task 3 §5.2 "giriş yolu ≠ qiymətləndirmə
  // yolu" tələsi): `activityFor` artıq `user_activity` cədvəlindən oxuyur və
  // sətri olmayan istifadəçi üçün blob-u BİR DƏFƏ köçürür (tənbəl miqrasiya).
  // Blob sütunu SİLİNMİR — həmin tənbəl miqrasiya hələ ona güvənir.
  await D(c).prepare(
    `INSERT INTO user_activity (uid, date, count) VALUES (?,?,1)
     ON CONFLICT(uid, date) DO UPDATE SET count = count + 1`,
  ).bind(c.user!.id, day).run();
}

export async function bumpProgress(c: Ctx, uid: string, field: string, col: 'posts' | 'tasks', amount = 1) {
  await D(c).prepare(
    `INSERT INTO progress (user_id, field, ${col}) VALUES (?,?,?)
     ON CONFLICT(user_id, field) DO UPDATE SET ${col} = ${col} + ?`,
  ).bind(uid, field, amount, amount).run();
}

// Admin jurnalı `worker/admin-log.ts`-ə köçürüldü (AUDIT-TASK-6 §B-3):
// `team-routes.ts` də ona ehtiyac duyur (M-11), lakin oradan `routes.ts`-i
// import etmək komanda route-larının lazy yüklənməsini pozardı.
export type { LogLevel } from '../admin-log';

export const badReq = (m: string) => err(m, 400);

/**
 * Post `blocks` JSON-unun ümumi tavanı — AUDIT M-5.
 *
 * 64 KB seçimi ölçmə ilədir, təxminlə deyil: bazadakı ƏN BÖYÜK mövcud post
 * 58 bayt idi (uzaq bazada ümumiyyətlə post yox idi), yəni tavan real
 * istifadədən üç böyüklük dərəcəsi yuxarıdadır və heç bir mövcud postu
 * kəsmir. Məqsəd storage DoS-un qarşısını almaqdır, məzmunu məhdudlaşdırmaq
 * deyil.
 */
export const POST_BLOCKS_MAX_BYTES = 64 * 1024;

// XP dəyərləri tək yerdə — əvvəl `xp + 10` / `xp + 5` kimi sətirlərə
// yayılmışdı və tavan hesabı ilə uyğunluğu gözlə yoxlanmalı olurdu (bax xp.ts).
//
// AUDIT-TASK-10 / D-6.b — dəyərlər PRD §6 cədvəlinə uyğunlaşdırıldı.
// ⚠ `COMMENT_XP` 5-dən 2-yə ENDİ. Bu, GÖRÜNƏN məhsul dəyişikliyidir və
//   `xp.ts`-dəki `comment` tavanı da eyni commit-də 100 → 40 edildi ki,
//   əməliyyat büdcəsi (20 rəy/gün) dəyişməsin.
export const POST_XP = 10;          // PRD: Paylaşım +10 (sitat/paylaşım)
export const ORIGINAL_POST_XP = 15; // PRD: Orijinal paylaşım +15 (öz məzmunu)
export const COMMENT_XP = 2;        // PRD: Şərh +2   (əvvəl 5)
export const SOLUTION_XP = 50;      // Layihəyə xas (PRD "Faydalı cavab +10"-dan yuxarı)

// PRD §6-nın icra olunmamış qalan hadisələri (AUDIT-TASK-10 / D-6.b).
export const SIGNUP_XP = 50;        // PRD: İlk qeydiyyat  +50
export const DAILY_LOGIN_XP = 5;    // PRD: Gündəlik giriş  +5
export const REPOST_XP = 3;         // PRD: Repost          +3
export const LIKE_RECEIVED_XP = 1;  // PRD: Like almaq      +1
export const INVITE_XP = 50;        // PRD: Dost dəvəti    +50
export const VERIFIED_XP = 100;     // PRD: Hesabın təsdiqi +100

/**
 * PRD §6 "Gündəlik giriş +5" — AUDIT-TASK-10 / D-6.b.
 *
 * ⚠ NİYƏ AYRICA KÖMƏKÇİ: sessiya yaradan BEŞ ayrı yol var (parol girişi,
 *   2FA təsdiqi, sehrli link, OAuth callback, parol bərpasından sonra
 *   avtomatik giriş). Eyni səkkiz sətri beş yerə köçürsək biri unudulanda
 *   həmin yolla girən istifadəçi XP almazdı və səbəbi tapmaq çətin olardı.
 *
 * 🔴 İDEMPOTENTLİK `refId`-dədir: `todayStr()` = `YYYY-MM-DD` (UTC).
 *   `ux_xp_logs_source` UNIQUE indeksi (`uid, source, ref_id`) sayəsində
 *   istifadəçi gün ərzində NEÇƏ DƏFƏ giriş etsə də XP BİR DƏFƏ verilir —
 *   yəni funksiyanı bütün yollardan çağırmaq təhlükəsizdir.
 *
 * ⚠ Gün sərhədi UTC-dir (`xp.ts` `utcDayStart` ilə eyni səbəb): istifadəçinin
 *   elan etdiyi saat qurşağına güvənsək, qurşağı dəyişməklə eyni gündə iki
 *   dəfə bonus almaq olardı.
 *
 * ⚠ Uğursuzluq SƏSSİZ udulur: XP bonusu girişi BLOKLAMAMALIDIR.
 */
export async function grantDailyLogin(c: Ctx, uid: string): Promise<void> {
  try {
    await grantXp(c.env, uid, 'daily_login', todayStr(), DAILY_LOGIN_XP);
  } catch (e) {
    console.error('daily_login XP verilmədi', e);
  }
}

/**
 * AUDIT-TASK-9 / D-2 — silinmiş hesabın mesajlarındakı əvəzləyici kimlik.
 *
 * ⚠ `users` cədvəlində BELƏ SƏTİR YOXDUR və olmamalıdır: sentinel real hesab
 *   deyil, sadəcə "müəllif artıq mövcud deyil" işarəsidir. UI adı mesaj sətrinin
 *   `author_name` sütunundan oxuyur, `users`-dan yox — ona görə sınıq istinad
 *   yaranmır. `deleted_uids` tombstone-u ilə qarışdırma: o, ARXİV filtri üçündür.
 */
export const DELETED_UID = 'deleted_user';
export const DELETED_NAME = 'Silinmiş istifadəçi';

// Realtime: otaq mesajı dəyişəndə (yeni / redaktə / sil) həmin otağın DO-suna
// "yenilə" siqnalı göndərilir → bağlı client-lər dərhal refetch edir. Fan-out
// yalnız siqnaldır, məzmun D1-dən gəlir (persistence orada qalır). Xəta olsa
// susdurulur — realtime opsionaldır, REST hər halda işləyir.
export async function roomBroadcast(c: Ctx, roomId: string, payload: unknown): Promise<void> {
  try {
    const stub = c.env.ROOM_DO.get(c.env.ROOM_DO.idFromName(roomId));
    await stub.broadcast(payload);
  } catch { /* realtime opsional */ }
}

// Realtime: konkret istifadəçinin açıq tablarına siqnal (bildiriş / DM).
// Qlobal PresenceDO uid→soket indeksini saxlayır — ayrıca DO sinfi lazım deyil.
// roomBroadcast kimi: yalnız siqnal, məzmun REST-dən; xəta susdurulur.
export async function userPush(c: Ctx, uid: string, payload: unknown): Promise<void> {
  try {
    const stub = c.env.PRESENCE_DO.get(c.env.PRESENCE_DO.idFromName('global'));
    await stub.push(uid, payload);
  } catch { /* realtime opsional */ }
}

/**
 * R2-dən toplu silmə — AUDIT-TASK-9 / D-1.
 *
 * Əvvəl `keys.slice(0, 100)` (deleteAccount) və `keys.slice(0, 30)` (deletePost)
 * işlədilirdi. Limitdən çox şəkli olan istifadəçi hesabını siləndə artıq fayllar
 * R2-də YETİM qalırdı: GDPR "unudulmaq hüququ" yarımçıq icra olunur, heç bir
 * xəta görünmür, sonrakı audit isə D1-ə baxdığı üçün problemi tapmır.
 * Bu, Task 8 §7.b ilə eyni sinifdir — sərhəd test datasının üstündə olmadıqca
 * fərq görünmür.
 *
 * R2 binding-i bir `delete()` çağırışında ən çox 1000 açar qəbul edir → hissələmə.
 */
const R2_DELETE_CHUNK = 1000;

export async function deleteR2Keys(c: Ctx, keys: string[]): Promise<void> {
  const uniq = [...new Set(keys.filter(k => typeof k === 'string' && !!k))];
  for (let i = 0; i < uniq.length; i += R2_DELETE_CHUNK) {
    // Fayl silinməsi əsas əməliyyatı (hesab/post silmə) BLOKLAMAMALIDIR —
    // əvvəlki `.catch(() => {})` davranışı qorunur.
    await c.env.FILES.delete(uniq.slice(i, i + R2_DELETE_CHUNK)).catch(() => {});
  }
}

export const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Formula injection qorunması: =, +, -, @ ilə başlayan xanalar Excel-də
  // formul kimi icra oluna bilər — apostrofla neytrallaşdırılır.
  const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return /[",\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
};
export const csvRow = (cells: unknown[]) => cells.map(csvCell).join(',') + '\r\n';

/**
 * Sessiya cavabı: gövdə + access/refresh cookie cütü.
 *
 * ⚠ AUDIT-TASK-10 / Faza 3.1 — paylaşılan qata köçürüldü: `auth.ts` (parol
 *   girişi), `auth-methods.ts` (MFA/magic/OAuth) — hər üç yol sessiya verir.
 */
export const withSession = (body: unknown, pair: TokenPair) =>
  withCookies(json(body), sessionCookies(pair));

/* ═══════════════ PAROL GÜCÜ — AUDIT-TASK-10 / Faza 5/#6 ═══════════════ */

/**
 * Audit: *"Parol gücü yalnız '≥6 simvol' — kompleksslik/pwned-check yoxdur."*
 *
 * ⚠ QAYDA QƏSDƏN MÜLAYİMDİR (8 simvol + iki simvol sinfi). Səbəb:
 *   • NIST SP 800-63B UZUNLUĞU kompleksslikdən ÜSTÜN tutur və məcburi
 *     xüsusi-simvol qaydalarını AÇIQ TÖVSİYƏ ETMİR (istifadəçi `P@ssw0rd!`
 *     kimi proqnozlaşdırıla bilən naxışlara keçir)
 *   • Layihədə 2FA, magic link, Turnstile və hesab-səviyyəli CAPTCHA artıq var
 *     — parol TƏK müdafiə xətti deyil
 *   • Çox sərt qayda MÖVCUD istifadəçiləri parol dəyişməkdə bloklayardı
 *
 * ⚠ ƏN ÇOX RAST GƏLİNƏN parollar AÇIQ rədd edilir: uzunluq qaydası `password`
 *   və `12345678`-i buraxır, halbuki onlar hücumun BİRİNCİ sınadığı sətirlərdir.
 *
 * ⚠ PWNED (HIBP) YOXLAMASI İCRA OLUNMUR: o, hər qeydiyyatda ÜÇÜNCÜ TƏRƏF
 *   API-sinə xarici sorğu deməkdir (k-anonymity ilə olsa belə). Bu, yeni
 *   asılılıq, yeni gecikmə və yeni fail-open qərarı gətirir — `docs/` -də
 *   açıq öhdəlik kimi qeyd olunur, sükutla buraxılmır.
 */
const COMMON_PASSWORDS = new Set([
  'password', 'passw0rd', '12345678', '123456789', '1234567890', 'qwerty123',
  'qwertyui', 'iloveyou', 'admin123', 'welcome1', 'abc12345', 'letmein1',
  'collabix', 'parol123', '11111111', '00000000',
]);

export interface PasswordCheck { ok: boolean; error?: string }

export function checkPasswordStrength(pass: unknown): PasswordCheck {
  if (typeof pass !== 'string') return { ok: false, error: 'Şifrə tələb olunur.' };
  if (pass.length < 8) return { ok: false, error: 'Şifrə minimum 8 simvol olmalıdır.' };
  if (pass.length > 200) return { ok: false, error: 'Şifrə həddindən artıq uzundur.' };

  if (COMMON_PASSWORDS.has(pass.toLowerCase())) {
    return { ok: false, error: 'Bu şifrə çox işlənir — başqasını seçin.' };
  }
  // Yalnız təkrarlanan simvol (`aaaaaaaa`) uzunluq qaydasını keçir, lakin
  // praktikada entropiyası sıfıra yaxındır.
  //
  // ⚠ `Set` işlədilir, regex backreference (`/^(.)+$/`) YOX: ESLint-in
  //   `no-control-regex` qaydası backslash-rəqəm ardıcıllığını nəzarət simvolu
  //   kimi oxuya bilir və qayda niyyəti gizlədirdi.
  if (new Set(pass).size === 1) {
    return { ok: false, error: 'Şifrə eyni simvoldan ibarət ola bilməz.' };
  }
  // İki fərqli simvol sinfi: hərf + (rəqəm və ya işarə).
  const classes = [/[a-zA-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(re => re.test(pass)).length;
  if (classes < 2) {
    return { ok: false, error: 'Şifrədə hərf və rəqəm (və ya işarə) olmalıdır.' };
  }
  return { ok: true };
}
