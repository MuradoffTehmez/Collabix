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
}

const clamp = (v: unknown, max: number) => String(v ?? '').slice(0, max);

/**
 * Xam gövdəni təhlükəsiz mesaja çevirir. Yararsızdırsa `null`.
 *
 * ⚠ TƏHLÜKƏSİZLİK: fayl açarı client-in göndərdiyi `fileKey`-dən DEYİL,
 * `fileUrl`-dan çıxarılır və MÜTLƏQ `msgfiles/` prefiksi olmalıdır.
 * Xam açara inansaydıq, client `avatars/basqa-istifadeci/...` və ya istənilən
 * R2 obyektini mesaja bağlaya bilərdi — yəni yükləmə icazəsi olmayan fayllar
 * mesaj kimi paylaşılardı.
 */
export function sanitizeMsg(b: any): CleanMsg | null {
  const type = (MSG_TYPES as readonly string[]).includes(b?.type) ? b.type as MsgType : 'text';
  const text = clamp(b?.text, 8000).trim();

  let fileKey: string | null = null;
  if (typeof b?.fileUrl === 'string') {
    const m = b.fileUrl.match(/^\/files\/(msgfiles\/[\w./-]+)$/);
    if (m) fileKey = m[1];
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
  };
}
