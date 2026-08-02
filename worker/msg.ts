// Mesaj validasiyası — REST və WebSocket yollarının PAYLAŞILAN qaynağı.
//
// ⚠ NİYƏ AYRICA MODUL: TASK-8 / Bənd 13 ilə mesaj göndərməyin İKİNCİ yolu
// yarandı (WS → DO). Validasiyanı hər iki yerdə ayrıca yazsaq, qaydalar
// vaxtla ayrılar və bir qapı o birindən zəif qalar. Məhz belə bir fərq
// aşkarlandı: DO nüsxəsi `fileKey`-ə xam şəkildə inanırdı, REST isə onu
// `fileUrl`-dan prefiks yoxlaması ilə çıxarırdı.
//
// Bu modul indi TƏK həqiqət mənbəyidir — hər iki yol onu çağırır.

export const MSG_TYPES = ['text', 'image', 'file', 'code'] as const;
export type MsgType = (typeof MSG_TYPES)[number];

export interface CleanMsg {
  type: MsgType;
  text: string;
  fileKey: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  language: string | null;
  /** Thread (0047): hansı mesaja cavabdır. `null` = kök mesaj. */
  replyTo: string | null;
}

const clamp = (v: unknown, max: number) => String(v ?? '').slice(0, max);

/**
 * Xam gövdəni təhlükəsiz mesaja çevirir. Yararsızdırsa `null`.
 *
 * ⚠ TƏHLÜKƏSİZLİK: fayl açarı client-in göndərdiyi `fileKey`-dən DEYİL,
 * `fileUrl`-dan çıxarılır və MÜTLƏQ `msgfiles/{göndərənin uid-i}/` prefiksi
 * olmalıdır.
 *
 * ⚠ ŞƏRH DÜZƏLİŞİ (AUDIT C-1 əlavə vektoru / TASK-7 §7.6): əvvəlki şərh
 * qorumanın mövcud olduğunu iddia edirdi, yoxlama isə YALNIZ `msgfiles/`
 * prefiksinə baxırdı — açarın GÖNDƏRƏNƏ AİD olduğunu yoxlamırdı. Yəni hücumçu
 * `msgfiles/<başqasının uid-i>/<açar>` göndərib qurbanın DM əlavəsini öz
 * söhbətinə bağlaya bilirdi; `canReadKey` isə həmin faylı artıq "söhbət
 * iştirakçısı" olduğu üçün ona VERƏRDİ. İki qapı birlikdə bağlanmalıdır.
 *
 * `senderUid` çağıran tərəfdən gəlir (REST: `c.user.id`, WS: `meta.uid`) —
 * hər ikisi serverdə doğrulanmış kimlikdir, client onu spoof edə bilmir.
 *
 * ✅ FORWARD ARTIQ MÖVCUDDUR (`forwardMessage`, routes/room.ts) və yuxarıdakı
 * tələbə MƏHZ deyildiyi kimi əməl edir: yönləndirmə bu funksiyadan KEÇMİR,
 * server mənbə faylını R2-də YENİ `msgfiles/{yönləndirənin uid-i}/…` açarına
 * KÖÇÜRÜR. Yoxlama zəiflədilməyib — client hələ də başqasının açarını
 * göndərə bilmir.
 */
export function sanitizeMsg(b: any, senderUid: string): CleanMsg | null {
  const type = (MSG_TYPES as readonly string[]).includes(b?.type) ? b.type as MsgType : 'text';
  const text = clamp(b?.text, 8000).trim();

  let fileKey: string | null = null;
  if (typeof b?.fileUrl === 'string' && senderUid) {
    const m = b.fileUrl.match(/^\/files\/(msgfiles\/[\w./-]+)$/);
    // `..` və `//` açarın sahib seqmentini saxtalaşdıra bilər
    // (`msgfiles/{mənim uid}/../{yad uid}/x`) — prefiks yoxlamasından sonra da rədd.
    if (m && m[1].startsWith(`msgfiles/${senderUid}/`)
      && !m[1].includes('..') && !m[1].includes('//')) {
      fileKey = m[1];
    }
  }

  // Tipə uyğun minimum məzmun tələbi.
  if (type === 'text' && !text) return null;
  if (type === 'code' && !text) return null;
  if ((type === 'image' || type === 'file') && !fileKey) return null;

  return {
    type, text, fileKey,
    fileName: clamp(b?.fileName, 100) || null,
    fileSize: parseInt(b?.fileSize, 10) || null,
    mimeType: clamp(b?.mimeType, 60) || null,
    language: clamp(b?.language, 20) || null,
    /* ⚠ Yalnız FORMAT yoxlanılır (uuid-vari id), MÖVCUDLUQ yox.
     * Mövcudluğu yoxlamaq üçün əlavə SELECT lazımdır və o, HƏR mesaj
     * göndərişinə bir sorğu əlavə edərdi. Sahibsiz `reply_to` zərərsizdir:
     * UI onu "silinmiş mesaja cavab" kimi göstərir (arxivləmə onsuz da
     * valideyni silə bilir — bax miqrasiya 0047 şərhi). */
    replyTo: /^[\w-]{1,64}$/.test(String(b?.replyTo || '')) ? String(b.replyTo) : null,
  };
}
