import { Env, uuid, now, fromJSON } from '../../util';
import { groupKeyFor, priorityOf, bucketOf } from './taxonomy';

export class NotificationService {
  constructor(private env: Env) {}

  /**
   * Bildiriş yazısı — `routes.ts`-dəki `notify()` ilə eyni qaydalar:
   * istifadəçinin tərcihi söndürülübsə bildiriş göndərilmir.
   *
   * ⚠ SUSDURMA YAZI ANINDA tətbiq olunur, oxu anında YOX. İki səbəb:
   *   • susdurulmuş bildiriş bazaya düşməsə oxu yolu (siyahı, statistika,
   *     sayğac, arxiv təmizliyi) heç nə bilməli deyil — hər sorğuya
   *     `LEFT JOIN notification_mutes` əlavə etmək lazım gəlmirdi;
   *   • istifadəçinin gözlədiyi semantika budur: susdurduqdan SONRA gələnlər
   *     görünmür, ƏVVƏL gələnlər siyahıda qalır (Slack/GitHub davranışı).
   */
  /**
   * @param eventKey İDEMPOTENTLİK açarı (BE-003/BE-004, miqrasiya 0055).
   *
   * ⚠ İSTƏYƏ BAĞLIDIR və bu, qəsdlidir: bildirişlərin çoxu təkrarlana BİLƏR
   *   (eyni adam eyni posta iki şərh yazsa, iki bildiriş gəlməlidir). Açarı
   *   YALNIZ təkrarı arzuolunmaz olan yollar verir — məsələn "bu istifadəçi bu
   *   posta reaksiya verdi".
   *
   * ⚠ Açar veriləndə `INSERT OR IGNORE` işləyir və unikal indeks
   *   (`ux_notifications_event`) təkrarı ATOMİK bağlayır. Bu, `if (!prev)`
   *   yoxlamasından fərqlidir: yoxlama iki paralel sorğuda hər ikisinə "yaz"
   *   deyirdi, indeks isə ikincisini bazada dayandırır.
   */
  async notify(
    toUid: string,
    fromId: string,
    fromName: string,
    type: string,
    text: string,
    postId: string | null = null,
    eventKey: string | null = null,
  ): Promise<boolean> {
    if (toUid === fromId) return false;

    const target = await this.env.DB.prepare('SELECT settings FROM users WHERE id = ?').bind(toUid).first<any>();
    if (!target) return false;

    const prefs = fromJSON<any>(target.settings, {})?.notifications || {};
    // ⚠ Açar `TYPE_BUCKETS` səbətidir — əvvəlki əl ilə yazılmış üçlük
    //   (`like/comment/follow`) qalan doqquz tipi ÖRTMÜRDÜ, yəni "mesajları
    //   söndür" açarı heç vaxt işləmirdi. İndi hər səbətin öz açarı var.
    if (prefs[bucketOf(type)] === false) return false;

    const groupKey = groupKeyFor(type, fromId, postId);
    if (await this.isMuted(toUid, type, fromId, groupKey)) return false;

    // ⚠ `OR IGNORE` yalnız `event_key` veriləndə məna daşıyır: indeks şərtidir
    //   (`WHERE event_key IS NOT NULL`), yəni açarsız sətirlər heç vaxt
    //   toqquşmur və davranış əvvəlki kimi qalır.
    const res = await this.env.DB.prepare(
      `INSERT OR IGNORE INTO notifications
         (id, user_id, type, from_id, from_name, post_id, text, read, created_at, archived, priority, group_key, event_key)
       VALUES (?,?,?,?,?,?,?,0,?,0,?,?,?)`,
    ).bind(uuid(), toUid, type, fromId, fromName, postId, text, now(), priorityOf(type), groupKey, eventKey).run();

    // ⚠ `changes === 0` → təkrar idi. `false` qaytarmaq VACİBDİR: çağıran
    //   (`shared.ts` → `notify`) bu dəyərə görə realtime "yenilə" siqnalı
    //   göndərir; təkrarda siqnal göndərsək istifadəçinin siyahısı səbəbsiz
    //   yenilənərdi.
    return Number(res.meta?.changes || 0) > 0;
  }

  /**
   * Susdurma yoxlaması — TƏK sorğu, üç sahə.
   *
   * ⚠ Üç ayrı `first()` çağırışı yazsaydıq hər bildiriş yazısı ÜÇ D1
   *   gediş-gəliş əlavə edərdi; bildiriş isə ən çox yazılan sətir tipidir
   *   (hər bəyənmə, hər şərh). `IN` ilə tək sorğu eyni indeksdən oxuyur.
   */
  private async isMuted(toUid: string, type: string, fromId: string, groupKey: string): Promise<boolean> {
    const row = await this.env.DB.prepare(
      `SELECT 1 FROM notification_mutes
        WHERE user_id = ?1
          AND ((scope = 'type' AND target = ?2)
            OR (scope = 'user' AND target = ?3)
            OR (scope = 'thread' AND target = ?4))
        LIMIT 1`,
    ).bind(toUid, type, fromId, groupKey).first<any>();
    return !!row;
  }

  /**
   * Realtime siqnal — qlobal PresenceDO uid→soket indeksini saxlayır.
   */
  async pushSignal(uid: string, payload: unknown): Promise<void> {
    try {
      const stub = this.env.PRESENCE_DO.get(this.env.PRESENCE_DO.idFromName('global'));
      await stub.push(uid, payload);
    } catch { /* realtime opsionaldır */ }
  }
}
