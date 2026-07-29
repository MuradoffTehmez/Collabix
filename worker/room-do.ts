// RoomDO — hər otağa bir Durable Object (idFromName(roomId)).
//
// TASK-8 / Bənd 13 — MESAJ AXINI DƏYİŞDİ:
//
//   Köhnə:  Browser → REST → Worker → D1 (yazı) → RPC → DO → WS (fan-out)
//           Yəni istifadəçi mesajını görmək üçün D1 yazısını GÖZLƏYİRDİ.
//
//   Yeni:   Browser → WS → DO → dərhal broadcast → arxada asinxron D1 yazısı
//           Qəbul edilən gecikmə D1-in yazı vaxtından asılı deyil.
//
// REST endpoint-i SİLİNMİR: köhnə client-lər, WS qopanda fallback və
// server-tərəf inteqrasiyalar ondan istifadə edir (bax routes.ts sendRoomMessage).
//
// Hibernation API ilə işləyir — boş duran DO yaddaşda saxlanılmır.
import { DurableObject } from 'cloudflare:workers';
import type { Env } from './util';
import { sanitizeMsg, type CleanMsg } from './msg';

/**
 * Soketə bağlanan bütün vəziyyət — `serializeAttachment` ilə.
 *
 * 🔴 AUDIT M-4 + C-3: əvvəl token-bucket `this.buckets` Map-ində, yəni DO
 * YADDAŞINDA idi. Hibernation API boş duran DO-nu yaddaşdan çıxarır → Map
 * itir → limit SIFIRLANIR. Yəni spam qapısı sadəcə 10 saniyə gözləməklə
 * yan keçilirdi. `serializeAttachment` hibernation boyu QORUNUR və `ctx.storage`
 * -dən fərqli olaraq disk yazısı tələb etmir (limit ~2 KB — bu struktur ~150 B).
 */
interface WsMeta {
  uid: string;
  name: string;
  /** Sessiya id-si — C-1 re-auth sessiyanın ləğv olunub-olunmadığını yoxlayır. */
  sid: string;
  /** M-4: token-bucket (əvvəl yaddaşdakı Map-də idi). */
  tokens: number;
  last: number;
  /** C-1: üzvlük keşinin bitmə anı (ms). */
  authUntil: number;
}

// Otaq mesajının D1 sütunları — routes.ts-dəki `MSG_COLS` ilə eyni sıra.
const INSERT_SQL =
  `INSERT INTO room_messages
     (id, room_id, author_id, author_name, type, text, file_key, file_name, file_size, mime_type, language, created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;

// Soket başına sadə token-bucket. WS açıq qaldığı üçün REST rate-limit-i
// (IP + endpoint) buradakı axını TUTMUR — spam qapısını DO-nun özü bağlamalıdır.
const RATE_BURST = 12;         // ani partlayış
const RATE_REFILL_MS = 1500;   // hər 1.5 saniyəyə +1 token

/**
 * 🔴 AUDIT H-6 — WS periodik yenidən-avtorizasiya.
 *
 * ƏVVƏL: üzvlük YALNIZ upgrade anında yoxlanılırdı (index.ts). Hibernation API
 * ilə soket SAATLARLA, GÜNLƏRLƏ yaşayır → komandadan çıxarılan, bloklanan və ya
 * sessiyası ləğv edilən istifadəçi məxfi otağı oxumağa və yazmağa DAVAM EDİRDİ.
 * Task 7 `canReadKey` ilə FAYL oxusunu, Task 3 isə `removeMember`-i düzəltmişdi
 * — açıq soket hər ikisini keçirdi.
 *
 * ⚠ Bu, TƏK müdafiə deyil: `disconnect(uid)` RPC (C-2) DƏRHAL təsir edir,
 *   periodik yoxlama isə RPC itsə/çatmasa fallback-dır (defense in depth).
 */
const REAUTH_INTERVAL_MS = 60_000;

/**
 * D1 xətası zamanı keşin uzadıla biləcəyi maksimum müddət.
 *
 * Fail-closed, lakin KƏSKİN DEYİL: qısamüddətli D1 nasazlığı bütün otaqları
 * bağlamamalıdır. Bu pəncərədən sonra soket bağlanır.
 */
const REAUTH_GRACE_MS = 120_000;

/** WS bağlanma kodu — client bunu tanıyıb YENİDƏN QOŞULMAMALIDIR. */
const CLOSE_UNAUTHORIZED = 4403;

export class RoomDO extends DurableObject<Env> {
  // Otaq daxilində monoton artan sıra nömrəsi. DO tək-axınlıdır, ona görə
  // bu sayğac SIRALAMA ZƏMANƏTİ verir: client mesajları `seq` üzrə düzür və
  // şəbəkə yenidən sıralasa belə ekranda qarışıqlıq olmur.
  private seq = 0;
  // İdempotentlik: görülmüş client-id-lər. Yenidən qoşulan client eyni mesajı
  // təkrar göndərsə (ack itibsə) ikinci nüsxə YARADILMIR.
  private seenCids = new Map<string, { id: string; seq: number }>();

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('WebSocket gözlənilir', { status: 426 });
    }
    const url = new URL(request.url);
    // Kimlik SERVER tərəfdə əlavə olunur (worker/index.ts) — client spoof edə bilməz.
    const now = Date.now();
    const meta: WsMeta = {
      uid: url.searchParams.get('uid') || '',
      name: url.searchParams.get('name') || '',
      sid: url.searchParams.get('sid') || '',
      // Upgrade-də avtorizasiya index.ts-də ARTIQ yoxlanılıb → ilk pəncərə
      // etibarlıdır, dərhal ikinci D1 sorğusu etmirik.
      tokens: RATE_BURST, last: now, authUntil: now + REAUTH_INTERVAL_MS,
    };
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(meta);
    // Süpürgə alarmı — OXU yolunu bağlayan mexanizm budur (aşağıdakı `alarm`
    // şərhinə bax). Artıq qurulubsa yenidən qurulmur.
    if (!(await this.ctx.storage.getAlarm())) {
      await this.ctx.storage.setAlarm(now + REAUTH_INTERVAL_MS);
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  // RPC — REST yolu (və redaktə/silmə) mesaj dəyişdirəndən sonra çağırır.
  broadcast(payload: unknown): void {
    this.sendAll(JSON.stringify(payload));
  }

  private sendAll(msg: string, except?: WebSocket): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try { ws.send(msg); } catch { /* qapanan soket — keç */ }
    }
  }

  /**
   * Token-bucket — state SOKETƏ bağlıdır (M-4).
   *
   * ⚠ Çağıran `ws.serializeAttachment(meta)` etməlidir; burada yalnız `meta`
   *   mutasiya olunur, çünki yazı `handleSend`-də digər dəyişikliklərlə
   *   BİRLİKDƏ, tək çağırışda edilir (attachment yazısı ucuz olsa da təkrarı
   *   mənasızdır).
   */
  private allow(meta: WsMeta): boolean {
    const now = Date.now();
    // Keçən vaxta görə doldur.
    const refill = Math.floor((now - meta.last) / RATE_REFILL_MS);
    if (refill > 0) {
      meta.tokens = Math.min(RATE_BURST, meta.tokens + refill);
      meta.last = now;
    }
    if (meta.tokens <= 0) return false;
    meta.tokens--;
    return true;
  }

  /**
   * C-1 — üzvlüyün, blok statusunun və sessiyanın yenidən yoxlanması.
   *
   * TƏK D1 sorğusu: aktiv otaqda 20 mesaj/dəq × 50 istifadəçi = 1000 sorğu/dəq
   * olardı, ona görə nəticə `authUntil` ilə 60 saniyə keşlənir (audit §C-1
   * "Performans"). Keş soketin attachment-indədir → hibernation-da qorunur.
   *
   * @returns `true` = icazəli, `false` = soket bağlanmalıdır
   */
  private async reauthorize(meta: WsMeta): Promise<boolean> {
    const now = Date.now();
    if (now < meta.authUntil) return true;   // keş hələ təzədir

    const roomId = this.roomIdFor();
    try {
      const row = await this.env.DB.prepare(
        `SELECT u.blocked                       AS blocked,
                s.revoked                       AS s_revoked,
                s.expires_at                    AS s_expires,
                (SELECT tcr.team_id FROM team_chat_rooms tcr WHERE tcr.id = ?3) AS team_id,
                (SELECT COUNT(*) FROM team_members tm
                  WHERE tm.team_id = (SELECT tcr2.team_id FROM team_chat_rooms tcr2 WHERE tcr2.id = ?3)
                    AND tm.user_id = ?1 AND tm.status = 'active')               AS member,
                (SELECT COUNT(*) FROM admins a WHERE a.user_id = ?1)            AS is_admin
           FROM users u LEFT JOIN sessions s ON s.id = ?2 AND s.uid = ?1
          WHERE u.id = ?1`,
      ).bind(meta.uid, meta.sid, roomId).first<any>();

      // İstifadəçi silinib → sətir yoxdur.
      if (!row) return false;
      if (row.blocked) return false;
      // Sessiya yoxlaması yalnız `sid` məlum olanda aparılır. Köhnə (TASK-8
      // öncəsi) cookie ilə qoşulan client-də `sid` yoxdur — onu bu səbəbdən
      // atmaq qanuni istifadəçini kəsərdi; blok və üzvlük yoxlaması qalır.
      if (meta.sid) {
        if (row.s_revoked === null) return false;          // sessiya sətri silinib
        if (Number(row.s_revoked) !== 0) return false;     // ləğv edilib
        if (Number(row.s_expires) <= now) return false;    // vaxtı bitib
      }
      // Komanda otağıdırsa üzvlük şərtdir; qlobal otaqda (team_id NULL) deyil.
      if (row.team_id && !Number(row.member) && !Number(row.is_admin)) return false;

      meta.authUntil = now + REAUTH_INTERVAL_MS;
      return true;
    } catch (e: any) {
      // FAIL-CLOSED, lakin kəskin deyil (audit §C-1): qısamüddətli D1 nasazlığı
      // bütün otaqları bağlamamalıdır. Keş `REAUTH_GRACE_MS` qədər uzadılır,
      // ondan sonra soket bağlanır.
      console.error('WS re-auth D1 xətası', roomId, meta.uid, e?.message || e);
      if (now < meta.authUntil + REAUTH_GRACE_MS) {
        meta.authUntil = now + 10_000;   // qısa təkrar cəhd
        return true;
      }
      return false;
    }
  }

  private closeUnauthorized(ws: WebSocket): void {
    try { ws.close(CLOSE_UNAUTHORIZED, 'unauthorized'); } catch { /* artıq qapalı */ }
  }

  /**
   * 🔴 C-2 — `disconnect(uid)` RPC. Periodik yoxlama 60 saniyəyə qədər gecikmə
   * buraxır; bu metod DƏRHAL təsir edir.
   *
   * Çağırılan yerlər: removeMember, leaveTeam, revokeAllSessions, blockUser,
   * deleteAccount, deleteTeam, updateMemberRole (bax worker/ws-kick.ts).
   *
   * @param exceptSid Bu sessiyanın soketi TOXUNULMAZ qalır. "Digər cihazlardan
   *   çıxış" axını üçün MƏCBURİDİR: onsuz istifadəçi öz cari cihazındakı çatı
   *   da itirərdi və client 4403-də yenidən qoşulmadığı üçün (C-2 client
   *   tərəfi) söhbət sükutla ölərdi.
   */
  disconnect(uid: string, exceptSid?: string | null): number {
    let n = 0;
    for (const ws of this.ctx.getWebSockets()) {
      const meta = (ws.deserializeAttachment() || {}) as WsMeta;
      if (meta.uid !== uid) continue;
      if (exceptSid && meta.sid === exceptSid) continue;
      this.closeUnauthorized(ws);
      n++;
    }
    return n;
  }

  /**
   * Otağın BÜTÜN soketlərini bağlayır — `deleteTeam` (bax ws-kick.ts).
   *
   * Üzv-üzv `disconnect()` çağırmaqdan ucuzdur: 1000 üzvlü komandada o, 1000
   * RPC deməkdir, bu isə otaq başına birdir.
   */
  disconnectAll(): number {
    const list = this.ctx.getWebSockets();
    for (const ws of list) this.closeUnauthorized(ws);
    return list.length;
  }

  /**
   * 🔴 OXU YOLUNUN BAĞLANMASI (audit §C-1 sonuncu sətir).
   *
   * `handleSend`-dəki yoxlama yalnız YAZINI dayandırır. Çıxarılmış üzv yaza
   * bilməsə də broadcast ALMAĞA davam etsəydi məxfi otaq yenə sızardı —
   * halbuki broadcast server tərəfdən gəlir və "qəbul anında" yoxlanıla bilmir.
   * Ona görə süpürgə ALARM ilə edilir: hər 60 saniyədə bütün soketlər yenidən
   * avtorizasiya olunur və icazəsizlər bağlanır.
   */
  async alarm(): Promise<void> {
    const sockets = this.ctx.getWebSockets();
    if (!sockets.length) return;   // otaq boşdur — alarm yenidən qurulmur
    for (const ws of sockets) {
      const meta = (ws.deserializeAttachment() || {}) as WsMeta;
      if (!meta.uid) { this.closeUnauthorized(ws); continue; }
      // Süpürgə keşi NƏZƏRƏ ALMAMALIDIR — məqsəd məhz keşi yeniləməkdir.
      meta.authUntil = 0;
      if (await this.reauthorize(meta)) ws.serializeAttachment(meta);
      else this.closeUnauthorized(ws);
    }
    if (this.ctx.getWebSockets().length) {
      await this.ctx.storage.setAlarm(Date.now() + REAUTH_INTERVAL_MS);
    }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;
    // Qeyri-adi böyük çərçivəni parse etməyə çalışmırıq.
    if (message.length > 32_000) return;
    let data: any;
    try { data = JSON.parse(message); } catch { return; }
    if (!data) return;

    const meta = (ws.deserializeAttachment() || {}) as WsMeta;
    if (!meta.uid) return;   // kimliksiz soket heç nə edə bilməz

    // 🔴 H-6: YAZI yolu. Əvvəl burada YALNIZ `meta.uid`-in mövcudluğuna
    // baxılırdı — yəni upgrade anındakı icazə ƏBƏDİ sayılırdı.
    if (!(await this.reauthorize(meta))) return this.closeUnauthorized(ws);

    if (data.t === 'typing') return this.handleTyping(ws, meta);
    if (data.t === 'send') return this.handleSend(ws, meta, data);
  }

  private handleTyping(ws: WebSocket, meta: WsMeta): void {
    // `reauthorize` keşi yeniləmiş ola bilər → attachment yazılır, əks halda
    // hər mesajda yenidən D1 sorğusu gedərdi.
    ws.serializeAttachment(meta);
    // Göndərən istisna — öz "yazır…" göstəricisini görməməlidir.
    this.sendAll(JSON.stringify({ t: 'typing', uid: meta.uid, name: meta.name }), ws);
  }

  private async handleSend(ws: WebSocket, meta: WsMeta, data: any): Promise<void> {
    const cid = typeof data.cid === 'string' ? data.cid.slice(0, 64) : '';
    if (!cid) return;   // cid olmadan idempotentlik və ack mümkün deyil

    // Təkrar göndəriş (ack itib, client yenidən cəhd edib) — YENİ mesaj yaratma,
    // sadəcə əvvəlki nəticəni təkrar bildir.
    const seen = this.seenCids.get(cid);
    if (seen) {
      try { ws.send(JSON.stringify({ t: 'ack', cid, id: seen.id, seq: seen.seq })); } catch { /* keç */ }
      return;
    }

    if (!this.allow(meta)) {
      // M-4: rədd halında da yazılır — əks halda `last` yenilənməz və bucket
      // hibernation-dan sonra sıfırlanmış kimi davranardı.
      ws.serializeAttachment(meta);
      try { ws.send(JSON.stringify({ t: 'error', cid, code: 'rate_limit' })); } catch { /* keç */ }
      return;
    }
    ws.serializeAttachment(meta);

    // ⚠ PAYLAŞILAN validasiya (worker/msg.ts) — REST yolu ilə EYNİ qaydalar.
    // DO-ya ayrıca nüsxə yazsaydıq, qaydalar ayrılar və bir qapı zəif qalardı
    // (məhz belə oldu: ilk versiya `fileKey`-ə xam şəkildə inanırdı).
    // `meta.uid` WS upgrade-də SERVERDƏ doğrulanıb (index.ts `resolveUser` →
    // query param), client onu spoof edə bilmir — `fileKey` sahibliyi məhz ona
    // görə yoxlanılır (AUDIT C-1 əlavə vektoru).
    const msg = sanitizeMsg(data, meta.uid);
    if (!msg) {
      try { ws.send(JSON.stringify({ t: 'error', cid, code: 'empty' })); } catch { /* keç */ }
      return;
    }

    const id = crypto.randomUUID().replace(/-/g, '');
    const createdAt = Date.now();
    const seq = ++this.seq;

    this.seenCids.set(cid, { id, seq });
    // Xəritə sonsuz böyüməsin: yalnız son 500 cid saxlanılır. Təkrar göndəriş
    // saniyələr içində olur, ona görə bu pəncərə praktikada kifayətdir.
    if (this.seenCids.size > 500) {
      const oldest = this.seenCids.keys().next().value;
      if (oldest !== undefined) this.seenCids.delete(oldest);
    }

    const wire = {
      t: 'msg', seq, id, cid,
      authorUid: meta.uid, authorName: meta.name,
      type: msg.type, text: msg.text,
      fileUrl: msg.fileKey ? `/files/${msg.fileKey}` : null,
      fileName: msg.fileName, fileSize: msg.fileSize,
      mimeType: msg.mimeType, language: msg.language,
      createdAt,
    };

    // 1) DƏRHAL fan-out — istifadəçi mesajını D1 yazısını gözləmədən görür.
    //    Göndərənə də gedir: `cid` ilə optimistik sətri əvəz edir.
    this.sendAll(JSON.stringify(wire));

    // 2) ARXADA persistence. `waitUntil` olmadan DO cavab verən kimi işi
    //    dayandıra bilər və mesaj D1-ə heç vaxt düşməzdi.
    this.ctx.waitUntil(this.persist(id, msg, meta, createdAt, seq));
  }

  private async persist(
    id: string, msg: CleanMsg, meta: WsMeta, createdAt: number, seq: number,
  ): Promise<void> {
    const roomId = this.roomIdFor();
    try {
      await this.env.DB.prepare(INSERT_SQL).bind(
        id, roomId, meta.uid, meta.name, msg.type, msg.text,
        msg.fileKey, msg.fileName, msg.fileSize, msg.mimeType, msg.language, createdAt,
      ).run();
    } catch (e: any) {
      console.error('otaq mesajı D1-ə yazılmadı', roomId, id, e?.message || e);
      // Mesaj yayımlandı, amma saxlanılmadı — bunu GİZLƏTMİRİK.
      // Client-lərə "yenilə" siqnalı gedir: onlar D1-dən oxuyub həqiqi
      // vəziyyəti göstərir (mesaj yoxa çıxır). Səssiz uyğunsuzluqdan yaxşıdır.
      this.sendAll(JSON.stringify({ t: 'error', seq, code: 'persist_failed' }));
      this.sendAll(JSON.stringify({ t: 'refresh' }));
    }
  }

  // Otaq id-si DO adından gəlir. `idFromName(roomId)` ilə yaradıldığı üçün
  // `ctx.id.name` həmin adı saxlayır.
  private roomIdFor(): string {
    return this.ctx.id.name || '';
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try { ws.close(code, reason); } catch { /* artıq qapalı */ }
  }

  async webSocketError(): Promise<void> {
    // Soket runtime tərəfindən avtomatik təmizlənir — əlavə iş lazım deyil.
  }
}
