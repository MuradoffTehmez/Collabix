/**
 * İSTİFADƏÇİ SİLİNMƏSİNİN TƏK HƏQİQƏT MƏNBƏYİ — BACKEND AUDIT / BE-001.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 PROBLEM
 * ════════════════════════════════════════════════════════════════════════════
 *
 * İstehsal sxemində `PRAGMA foreign_keys = 1` — yəni D1 xarici açarları TƏTBİQ
 * EDİR. Lakin 91 cədvəldən yalnız 47-sində FK bəyan olunub; qalan 55-i qorunmur
 * (`follows`, `bookmarks`, `post_reactions`, `comment_likes`, `notifications`,
 * `xp_logs`, `tasks`, `task_comments`, `reputation_logs`, `activities` …).
 *
 * Kök səbəb SQLite-dədir: `ALTER TABLE` mövcud cədvələ FK əlavə edə bilmir,
 * cədvəl YENİDƏN QURULMALIDIR. Sxem tədricən böyüdüyü üçün sonrakı cədvəllər
 * FK-sız qalıb. 55 cədvəli canlı bazada yenidən qurmaq isə həm bahadır, həm
 * risklidir — audit də bunu tövsiyə etmədi.
 *
 * Nəticə MƏLUMAT İTKİSİ DEYİL, MƏLUMAT ÇİRKLİLİYİDİR və zamanla artır: hesab
 * silinəndə onun bəyənmələri, izləmələri, XP jurnalı və bildirişləri sətir kimi
 * qalır, sayğaclar mövcud olmayan istifadəçini saymağa davam edir.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * HƏLL — BƏYANNAMƏ, KOD DEYİL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Silinmə siyasəti aşağıdakı `USER_REFS` xəritəsində BƏYAN olunur, `deleteAccount`
 * içində SQL kimi yazılmır. Üç fayda:
 *
 *   1. Bir yer. Əvvəl siyasət `routes/auth.ts`-dəki 30 sətirlik `batch()`
 *      içində idi və oradan başqa heç bir silinmə yolu ona baxmırdı.
 *   2. Tamlıq maşınla yoxlanır. `test/cascade.test.ts` sxemi oxuyur və
 *      istifadəçi sütunu olan HƏR cədvəlin xəritədə siyasəti olmasını tələb
 *      edir — yeni cədvəl siyasətsiz əlavə olunsa test sınır. FK-nın verə
 *      bilmədiyi zəmanətin əvəzi budur.
 *   3. Ölçülə bilir. `scanOrphans()` eyni xəritədən yetim sətir sayır və gecə
 *      cron-unda işləyir; yəni "təmizdir" iddiası hər gün yoxlanılır.
 *
 * ⚠ XƏRİTƏ SİYASƏTİ ƏKS ETDİRİR, ARZUNU YOX. Bir sütun bu gün təmizlənmirsə
 *   siyasəti `keep`-dir və SƏBƏBİ yazılır. Yalan `delete` yazmaq heç nə
 *   yazmamaqdan pisdir — auditin BE-002-dəki dərsi ilə eynidir.
 */
import { Env } from '../util';
import { log } from '../request-context';
import { alert } from '../alerts';
import { DELETED_UID, DELETED_NAME } from '../routes/shared';

/** Silinən hesabın izinin necə emal olunduğu. */
export type RefPolicy =
  /** Sətir tamamilə silinir — istifadəçinin öz törəmə məlumatıdır. */
  | { kind: 'delete' }
  /**
   * Sətir qalır, uid `deleted_user`-ə keçir — paylaşılan tarixçədir.
   *
   * `alsoSet` eyni UPDATE-də təmizlənən əlavə sütunlardır (məsələn denormallaşmış
   * `author_name`). AYRI ifadə kimi yazıla BİLMƏZ: uid dəyişdikdən sonra ikinci
   * UPDATE həmin sətirləri artıq tapa bilməz və ad köhnə sahibin adı ilə qalar.
   */
  | { kind: 'anonymize'; alsoSet?: Record<string, string> }
  /** Sətir qalır, sütun NULL olur. */
  | { kind: 'null' }
  /** Qəsdən toxunulmur. `why` MƏCBURİDİR və koda deyil, qərara istinad edir. */
  | { kind: 'keep'; why: string }
  /** Valideyn sətirlə birlikdə gedir (məsələn post silinəndə onun şərhləri). */
  | { kind: 'cascade'; why: string };

/**
 * Cədvəl → sütun → siyasət.
 *
 * ⚠ SIRA BURADA DEYİL. Bəzi addımlar bir-birindən ASILIDIR (sayğaclar `follows`
 *   silinməzdən ƏVVƏL azaldılmalıdır, çünki sonra kimin sayğacını azaltmaq
 *   lazım olduğunu öyrənmək mümkün olmur). Belə addımlar `preSteps()`-dədir və
 *   xəritə onları TƏKRARLAMIR.
 */
export const USER_REFS: Record<string, Record<string, RefPolicy>> = {
  /* ── İstifadəçinin öz törəmə məlumatı: silinir ─────────────────────────── */
  achievement_logs:      { uid: { kind: 'delete' } },
  badge_logs:            { uid: { kind: 'delete' } },
  bookmarks:             { user_id: { kind: 'delete' } },
  comment_likes:         { user_id: { kind: 'delete' } },
  comment_reactions:     { user_id: { kind: 'delete' } },
  likes:                 { user_id: { kind: 'delete' } },
  message_bookmarks:     { user_id: { kind: 'delete' } },
  message_reactions:     { user_id: { kind: 'delete' } },
  mfa_backup_codes:      { uid: { kind: 'delete' } },
  notification_mutes:    { user_id: { kind: 'delete' } },
  oauth_accounts:        { uid: { kind: 'delete' } },
  poll_votes:            { user_id: { kind: 'delete' } },
  post_reactions:        { user_id: { kind: 'delete' } },
  presence:              { user_id: { kind: 'delete' } },
  profile_views:         { uid: { kind: 'delete' } },
  progress:              { user_id: { kind: 'delete' } },
  reputation_logs:       { uid: { kind: 'delete' } },
  sessions:              { uid: { kind: 'delete' } },
  task_saved_views:      { user_id: { kind: 'delete' } },
  task_time_logs:        { user_id: { kind: 'delete' } },
  task_watchers:         { user_id: { kind: 'delete' } },
  user_activity:         { uid: { kind: 'delete' } },
  user_mfa:              { uid: { kind: 'delete' } },
  user_stats:            { uid: { kind: 'delete' } },
  admins:                { user_id: { kind: 'delete' } },
  /* `xp_logs`: AUDIT-TASK-9 / B-4 — qalsaydı `SUM(xp_logs) == users.xp`
   *  invariantı hər silinmədən sonra pozulardı və `/api/health` daimi "drift"
   *  göstərərdi. Yəni bu silinmə həm də sağlamlıq siqnalını qoruyur. */
  xp_logs:               { uid: { kind: 'delete' } },
  /* Üzvlük sətirləri: hesab yoxdursa üzvlük mənasızdır. */
  team_members:          { user_id: { kind: 'delete' } },
  team_project_members:  { user_id: { kind: 'delete' } },
  team_project_requests: { user_id: { kind: 'delete' } },
  /* `follows` iki tərəflidir — sayğaclar `preSteps()`-də azaldılır. */
  follows: {
    follower_id: { kind: 'delete' },
    target_id:   { kind: 'delete' },
  },
  /* İstifadəçiyə ÜNVANLANMIŞ bildirişlər gedir; onun GÖNDƏRDİYİ bildiriş
   * qarşı tərəfin siyahısındadır və orada `from_id` anonimləşir. */
  notifications: {
    user_id: { kind: 'delete' },
    from_id: { kind: 'anonymize' },
  },
  /* Dəvətlər: alan tərəf gedir, dəvət edən anonimləşir (dəvət qarşı tərəfin
   * siyahısında qalır). */
  team_invites: {
    user_id:    { kind: 'delete' },
    invited_by: { kind: 'anonymize' },
  },

  /* ── Paylaşılan tarixçə: anonimləşir ───────────────────────────────────── */
  /* AUDIT-TASK-9 / D-2 (variant b): MƏZMUN qalır — qarşı tərəf öz tarixçəsini
   * itirmir — KİMLİK silinir. `author_id` da dəyişir, təkcə ad yox: uid
   * qalsaydı, GDPR mənasında hələ də şəxsə bağlanan identifikator olardı. */
  room_messages: { author_id: { kind: 'anonymize', alsoSet: { author_name: DELETED_NAME } } },
  dm_messages: {
    from_id: { kind: 'anonymize' },
    to_id:   { kind: 'anonymize' },
  },
  /* Şərhlər postla birlikdə yaşayır; postu başqasınındırsa şərh söhbətin
   * hissəsidir və silinməsi mətni pozar. */
  comments:      { author_id: { kind: 'anonymize' } },
  task_comments: { author_id: { kind: 'anonymize' } },
  team_posts:    { author_id: { kind: 'anonymize' } },
  /* Fəaliyyət lentləri: sətir başqalarının lentində görünür. */
  activities: {
    uid:      { kind: 'anonymize' },
    actor_id: { kind: 'anonymize' },
  },
  team_activity: { actor_id: { kind: 'anonymize' } },
  task_activity: { actor_id: { kind: 'anonymize' } },
  /* Yaradıcı getdi, obyekt komandanındır. */
  rooms:            { created_by: { kind: 'anonymize' } },
  sprints:          { created_by: { kind: 'anonymize' } },
  task_automations: { created_by: { kind: 'anonymize' } },
  team_projects:    { created_by: { kind: 'anonymize' } },
  media:            { uid: { kind: 'anonymize' } },

  /* ── Sütun boşalır, sətir qalır ────────────────────────────────────────── */
  /* Hadisələr təhlükəsizlik telemetriyasıdır (hansı IP-dən neçə uğursuz giriş).
   * Şəxsi məlumat çıxarıldıqdan sonra artıq həmin istifadəçiyə aid deyil.
   * ⚠ SİLİNSƏYDİ: hesabını silərək öz izini təmizləyən hücumçu monitorinqi
   *   kor edərdi — yəni silinmə hücum alətinə çevrilərdi. */
  security_events:  { uid: { kind: 'null' } },
  /* Tapşırıq təyinatı boşalır, tapşırıq komandanın işidir. Yaradan isə
   * anonimləşir — `created_by` NULL olsaydı UI "kim yaratdı?" sualına boşluq
   * göstərərdi, `deleted_user` isə cavab verir. */
  team_tasks: {
    assignee_id: { kind: 'null' },
    created_by:  { kind: 'anonymize' },
  },
  /* Əlaqə formasının mesajı dəstək müraciətidir və cavablanmamış qala bilər;
   * məzmun qalır, kimlik gedir. E-poçt/ad sütunları formanın ÖZ sahələridir
   * (istifadəçi onları əl ilə yazır) — uid isə hesaba bağlayan istinaddır. */
  contact_messages: { uid: { kind: 'null' } },

  /* ── Qəsdən toxunulmur ─────────────────────────────────────────────────── */
  /* Moderasiya qeydləri: silinmiş hesab öz cəza tarixçəsini APARA BİLMƏZ, əks
   * halda ban-dan qaçmaq üçün hesabı silmək kifayət edərdi. */
  bans:              { uid: { kind: 'keep', why: 'ban-dan qaçmağın qarşısı — hesab silinməsi cəzanı ləğv etməməlidir' } },
  mutes:             { uid: { kind: 'keep', why: 'eyni səbəb: susdurma tarixçəsi qalmalıdır' } },
  warnings:          { uid: { kind: 'keep', why: 'eyni səbəb: xəbərdarlıq tarixçəsi qalmalıdır' } },
  /* Audit izi — PRD §14. Dəyişdirilə bilməz, əks halda audit mənasını itirir. */
  admin_logs: {
    by_id:     { kind: 'keep', why: 'audit izi (PRD §14) — dəyişdirilməz olmalıdır' },
    target_id: { kind: 'keep', why: 'audit izi (PRD §14) — dəyişdirilməz olmalıdır' },
  },
  /* Şikayətlər moderasiya prosesinin sənədidir; şikayətçi hesabını silsə də
   * baxılan iş bağlanmamış qala bilər. */
  reports: {
    reporter_id: { kind: 'keep', why: 'moderasiya işi hesabdan uzun yaşayır' },
    target_id:   { kind: 'keep', why: 'moderasiya işi hesabdan uzun yaşayır' },
  },
  post_reports:    { reporter_id: { kind: 'keep', why: 'eyni: moderasiya işi' } },
  comment_reports: { reporter_id: { kind: 'keep', why: 'eyni: moderasiya işi' } },
  moderator_applications: {
    uid:         { kind: 'keep', why: 'müraciət tarixçəsi — təkrar müraciət qiymətləndirməsi üçün' },
    reviewed_by: { kind: 'keep', why: 'kimin qərar verdiyi audit sualıdır' },
  },
  submissions: {
    user_id:     { kind: 'keep', why: 'həll arxivi — tapşırıq statistikası ondan hesablanır' },
    reviewed_by: { kind: 'keep', why: 'qiymətləndirən moderator qeydi' },
  },
  user_permissions: {
    uid:        { kind: 'keep', why: 'fərdi icazə istisnası — hesabla birlikdə `preSteps` silir' },
    granted_by: { kind: 'keep', why: 'kimin verdiyi audit sualıdır' },
  },
  /* ⚠ `teams.owner_id` QƏSDƏN toxunulmur və bu, MƏHSUL qərarıdır: sahibsiz
   *   komanda pozuq vəziyyətdir, lakin komandanı silmək və ya sahibliyi
   *   təsadüfi üzvə vermək daha pisdir. Düzgün yol istifadəçini silinmədən
   *   ƏVVƏL sahibliyi ötürməyə məcbur etməkdir (`/api/teams/:id/transfer`).
   *   Yetim skaneri bunu ÖLÇMÜR (aşağıdakı `scannable` qaydası) — əks halda
   *   siqnal həmişə qırmızı olar və oxunmaz. */
  teams:  { owner_id: { kind: 'keep', why: 'sahibsiz komanda — silinmədən əvvəl transfer tələb olunmalıdır (məhsul qərarı)' } },
  tasks:  { created_by: { kind: 'keep', why: 'öyrənmə çalışması platformanındır, müəllifindən uzun yaşayır' } },

  /* ── Valideynlə birlikdə gedir ─────────────────────────────────────────── */
  /* `posts` `preSteps()`-də silinir (re-post-ların soft-mark sırasına görə),
   * `post_shares` isə onunla birlikdə. */
  posts:       { author_id: { kind: 'cascade', why: 'preSteps() — re-post soft-mark sırası bağlayıcıdır' } },
  post_shares: { user_id:   { kind: 'cascade', why: 'preSteps() — posts silinməzdən əvvəl' } },
  /* Tombstone cədvəlinin ÖZÜ silinmiş uid-ləri saxlayır. */
  deleted_uids: { uid: { kind: 'keep', why: 'tombstone — silinmiş uid-lərin siyahısıdır, mənası budur' } },
  /* DM söhbəti hər iki tərəf silinməyincə qalır; mesajlar anonimləşdiyi üçün
   * söhbət başlığı da anonim görünür. */
  dm_threads: {
    user_a: { kind: 'keep', why: 'qarşı tərəf söhbətini itirməməlidir (mesajlar anonimləşir)' },
    user_b: { kind: 'keep', why: 'qarşı tərəf söhbətini itirməməlidir (mesajlar anonimləşir)' },
  },
};

/* ⚠ `DELETED_UID` / `DELETED_NAME` `routes/shared.ts`-dən İDXAL OLUNUR, burada
 *   təkrar elan edilmir: iki nüsxə olsaydı biri dəyişəndə anonimləşdirmə iki
 *   fərqli "silinmiş istifadəçi" yaradardı və heç bir test bunu tutmazdı. */

/**
 * `users`-də sətri OLMAYAN, lakin yetim SAYILMAYAN uid-lər.
 *
 * ⚠ ÖLÇÜLDÜ, təxmin edilmədi: skanerin ilk qaçışı lokal bazada
 *   `rooms.created_by = 'system'` üzrə 9 sətir tapdı. Bunlar bootstrap seed-inin
 *   yaratdığı otaqlardır — qəsdən sahibsizdirlər, çünki onları yaradan real
 *   hesab yoxdur. Süzülməsəydi siqnal HƏR GECƏ yanardı və yığılan həqiqi
 *   çirkliliyi görünməz edərdi.
 *
 * ⚠ `deleted_user` anonimləşdirmənin HƏDƏFİDİR: skaner öz işinin nəticəsini
 *   "yetim" adlandırmamalıdır.
 */
export const RESERVED_UIDS = ['deleted_user', 'system'] as const;

/**
 * Skanerin yoxladığı sütunlar: yalnız "yetim QALMAMALIDIR" vəd edənlər.
 *
 * ⚠ `keep` və `cascade` KƏNARDA qalır. Səbəb praktikdir: `keep` sütunlarında
 *   yetim sətir GÖZLƏNİLƏNDİR (ban tarixçəsi qəsdən qalır), onları saysaq
 *   siqnal həmişə qırmızı olar və heç kim baxmaz. Həmişə qırmızı yanan lampa
 *   sönük lampa ilə eyni məlumatı verir.
 */
export function scannableColumns(): { table: string; column: string }[] {
  const out: { table: string; column: string }[] = [];
  for (const [table, cols] of Object.entries(USER_REFS)) {
    for (const [column, p] of Object.entries(cols)) {
      if (p.kind === 'delete' || p.kind === 'anonymize' || p.kind === 'null') {
        out.push({ table, column });
      }
    }
  }
  return out;
}

/**
 * Xəritədən silinmə ifadələri qurur.
 *
 * ⚠ `preSteps` BURADA DEYİL: sırası bağlayıcı olan addımlar (sayğaclar,
 *   re-post soft-mark, posts) çağıran tərəfdə qalır, çünki onlar siyasət deyil,
 *   ARDICILLIQDIR. Xəritəyə qoysaydıq, sırasız iterasiya onları pozardı.
 */
export function cascadeStatements(db: D1Database, uid: string): D1PreparedStatement[] {
  const out: D1PreparedStatement[] = [];
  for (const [table, cols] of Object.entries(USER_REFS)) {
    for (const [column, p] of Object.entries(cols)) {
      if (p.kind === 'delete') {
        out.push(db.prepare(`DELETE FROM ${table} WHERE ${column} = ?`).bind(uid));
      } else if (p.kind === 'anonymize') {
        const extra = Object.entries(p.alsoSet || {});
        // ⚠ Əlavə sütunlar SABİT mətndir (xəritədə yazılıb), istifadəçi girişi
        //   deyil — yenə də bind ilə ötürülür ki, naxış bir gün dəyişəndə
        //   birləşdirmə vərdişi qalmasın.
        const sets = [`${column} = ?2`, ...extra.map((e, i) => `${e[0]} = ?${i + 3}`)].join(', ');
        out.push(db.prepare(`UPDATE ${table} SET ${sets} WHERE ${column} = ?1`)
          .bind(uid, DELETED_UID, ...extra.map(e => e[1])));
      } else if (p.kind === 'null') {
        out.push(db.prepare(`UPDATE ${table} SET ${column} = NULL WHERE ${column} = ?`).bind(uid));
      }
    }
  }
  return out;
}

/**
 * Yetim sətir skaneri — gecə cron-unda işləyir.
 *
 * ⚠ SORĞULAR HİSSƏ-HİSSƏ GEDİR. D1-də `UNION ALL` ən çox 5 termə icazə verir
 *   (layihədə əvvəl ölçülüb) və bir sorğuda 100 bağlı parametr limiti var.
 *   Hamısını tək sorğuya yığmaq icra vaxtında sınardı — statik analiz bunu
 *   göstərmir.
 *
 * ⚠ `deleted_user` SAYILMIR: o, qəsdən mövcud olmayan uid-dir (anonimləşdirmə
 *   hədəfi). Süzülməsəydi skaner öz işinin nəticəsini "yetim" adlandırardı.
 */
export async function scanOrphans(env: Env): Promise<{ total: number; byTable: Record<string, number> }> {
  const cols = scannableColumns();
  const byTable: Record<string, number> = {};
  let total = 0;

  const CHUNK = 5;
  for (let i = 0; i < cols.length; i += CHUNK) {
    const part = cols.slice(i, i + CHUNK);
    const reserved = RESERVED_UIDS.map(u => `'${u}'`).join(',');
    const sql = part.map(({ table, column }) =>
      `SELECT '${table}.${column}' AS ref, COUNT(*) AS n FROM ${table}
        WHERE ${column} IS NOT NULL AND ${column} NOT IN (${reserved})
          AND ${column} NOT IN (SELECT id FROM users)`,
    ).join(' UNION ALL ');
    try {
      const res = await env.DB.prepare(sql).all<{ ref: string; n: number }>();
      for (const r of res.results) {
        const n = Number(r.n) || 0;
        if (n > 0) { byTable[r.ref] = n; total += n; }
      }
    } catch (e: any) {
      // Bir hissənin sınması (məsələn hələ migrate olunmamış cədvəl) bütün
      // skaneri dayandırmamalıdır — qalan hissələr yenə dəyər verir.
      log('warn', 'orphan_scan_chunk_failed', {
        refs: part.map(p => `${p.table}.${p.column}`).join(','),
        message: e?.message || String(e),
      });
    }
  }
  return { total, byTable };
}

/**
 * Cron girişi. Nəticə `alert()` ilə bildirilir — XP invariantı ilə EYNİ
 * mexanizm, yəni monitorinq tərəfində yeni bir şey qurmaq lazım deyil.
 */
export async function runOrphanScan(env: Env): Promise<void> {
  const { total, byTable } = await scanOrphans(env);
  log('info', 'orphan_scan', { total, tables: Object.keys(byTable).length });
  if (total > 0) alert('orphan_rows_found', { total, byTable });
}
