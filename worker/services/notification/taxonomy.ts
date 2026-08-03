// SAF bildiriş taksonomiyası — səbətlər, prioritet, qrup açarı.
//
// 🔴 NİYƏ AYRICA FAYL: `services/notification/index.ts` bu qaydalara YAZI
//    anında ehtiyac duyur, `routes/notification.ts` isə OXU anında. Qaydalar
//    marşrut modulunda qalsaydı dövr yaranırdı:
//      routes/notification → routes/shared → services/notification → routes/notification
//    Bu modulun HEÇ BİR importu yoxdur, ona görə dövr qırılır.
//    (`js/icon-set.js`-in `ui.js ↔ icons.js` dövrünü qırması ilə eyni naxış.)

/* ═══════════════════════ SƏBƏTLƏR ═══════════════════════
 *
 * ⚠ TƏK MƏNBƏ: filtr pilləri (client), statistika kartları, susdurma və
 *   istifadəçi tərcihləri — hamısı bu cədvəldən qidalanır. Əvvəl tip siyahısı
 *   `js/notify.js`-də ƏLLƏ yazılmışdı və səkkiz komanda tipi ora heç vaxt
 *   əlavə olunmamışdı; komanda bildirişləri yalnız "Hamısı"nda görünürdü.
 *
 * 🔴 AÇAR ADLARI GERİYƏ UYĞUNDUR: `likes`, `comments`, `follows` —
 *    bunlar `users.settings.notifications` JSON-unda ARTIQ YAZILMIŞ açarlardır
 *    (`js/profile.js` onları oxuyur). `followers` yazsaydıq izləmə bildirişini
 *    söndürmüş MÖVCUD istifadəçilərin tərcihi səssizcə qüvvədən düşərdi.
 *    Görünən etiket ayrıdır (i18n) — burada dəyişməz olan yalnız açardır.
 */
export const TYPE_BUCKETS: Record<string, readonly string[]> = {
  messages: ['dm'],
  // ⚠ `repost` BURADADIR, `system`-də YOX. O, `post.ts`-də yazılan real tipdir
  //   (re-post + sitat) və heç bir səbətə salınmasaydı catch-all qaydası onu
  //   "Sistem" pilinə atardı — istifadəçi öz paylaşımına gələn re-postu sistem
  //   xəbəri kimi görərdi. Semantik olaraq ən yaxın səbət "paylaşıma reaksiya"
  //   olan `likes`-dır.
  likes: ['like', 'repost'],
  comments: ['comment'],
  mentions: ['mention'],
  follows: ['follow'],
  tasks: ['task', 'team_task'],
  teams: ['team_invite', 'team_role', 'team_kick', 'team_announcement', 'team_onboarding'],
  projects: ['team_project', 'team_project_request'],
  system: ['verified', 'admin'],
};

/** Səbətə düşməyən hər tip `system`-ə yığılır — "naməlum tip görünmür" qüsuru olmasın. */
export const KNOWN_TYPES: ReadonlySet<string> = new Set(Object.values(TYPE_BUCKETS).flat());

export function bucketOf(type: string): string {
  for (const [bucket, types] of Object.entries(TYPE_BUCKETS)) {
    if (types.includes(type)) return bucket;
  }
  return 'system';
}

/**
 * Yüksək prioritetli tiplər — istifadəçidən HƏRƏKƏT tələb edənlər.
 *
 * ⚠ Bəyənmə/şərh QƏSDƏN yoxdur: onlar ən çox gələn tiplərdir və prioritet
 *   verilsəydi nişan bütün siyahını doldurub mənasını itirərdi (siqnal/küy).
 */
const PRIORITY_TYPES = new Set(['mention', 'team_invite', 'team_project_request', 'admin']);

export const priorityOf = (type: string): number => (PRIORITY_TYPES.has(type) ? 1 : 0);

/**
 * Qrup açarı — "Ayşə paylaşımını 8 dəfə bəyəndi" / "Ayşə və daha 7 nəfər".
 *
 * 🔴 EYNİ QAYDA MİQRASİYA 0049-dakı geriyə-doldurma `CASE` ifadəsindədir.
 *    İki nüsxə qaçılmazdır (biri mövcud sətirləri doldurur, digəri yeniləri
 *    yazır); qayda dəyişsə HƏR İKİSİ eyni commit-də dəyişməlidir — `level.ts`
 *    ↔ miqrasiya 0034 ilə eyni sinif borc.
 *
 * QAYDALAR:
 *   dm      → `dm:<göndərən>`      hər həmsöhbət ayrı qrup
 *   follow  → `follow`             bütün izləmələr TƏK qrupda ("N nəfər izlədi")
 *   post-a bağlı → `<tip>:<post>`  eyni postdakı reaksiyalar birləşir
 *   qalan   → `<tip>:<göndərən>`
 */
export function groupKeyFor(type: string, fromId: string | null, postId: string | null): string {
  if (type === 'dm') return 'dm:' + (fromId || '');
  if (type === 'follow') return 'follow';
  if (postId) return type + ':' + postId;
  return type + ':' + (fromId || '');
}
