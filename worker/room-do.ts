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

interface WsMeta { uid: string; name: string }

// Otaq mesajının D1 sütunları — routes.ts-dəki `MSG_COLS` ilə eyni sıra.
const INSERT_SQL =
  `INSERT INTO room_messages
     (id, room_id, author_id, author_name, type, text, file_key, file_name, file_size, mime_type, language, created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;

// Soket başına sadə token-bucket. WS açıq qaldığı üçün REST rate-limit-i
// (IP + endpoint) buradakı axını TUTMUR — spam qapısını DO-nun özü bağlamalıdır.
const RATE_BURST = 12;         // ani partlayış
const RATE_REFILL_MS = 1500;   // hər 1.5 saniyəyə +1 token

interface Bucket { tokens: number; last: number }

export class RoomDO extends DurableObject<Env> {
  // Otaq daxilində monoton artan sıra nömrəsi. DO tək-axınlıdır, ona görə
  // bu sayğac SIRALAMA ZƏMANƏTİ verir: client mesajları `seq` üzrə düzür və
  // şəbəkə yenidən sıralasa belə ekranda qarışıqlıq olmur.
  private seq = 0;
  // İdempotentlik: görülmüş client-id-lər. Yenidən qoşulan client eyni mesajı
  // təkrar göndərsə (ack itibsə) ikinci nüsxə YARADILMIR.
  private seenCids = new Map<string, { id: string; seq: number }>();
  private buckets = new Map<string, Bucket>();

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('WebSocket gözlənilir', { status: 426 });
    }
    const url = new URL(request.url);
    // Kimlik SERVER tərəfdə əlavə olunur (worker/index.ts) — client spoof edə bilməz.
    const meta: WsMeta = {
      uid: url.searchParams.get('uid') || '',
      name: url.searchParams.get('name') || '',
    };
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(meta);
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

  private allow(uid: string): boolean {
    const now = Date.now();
    const b = this.buckets.get(uid) || { tokens: RATE_BURST, last: now };
    // Keçən vaxta görə doldur.
    const refill = Math.floor((now - b.last) / RATE_REFILL_MS);
    if (refill > 0) {
      b.tokens = Math.min(RATE_BURST, b.tokens + refill);
      b.last = now;
    }
    if (b.tokens <= 0) { this.buckets.set(uid, b); return false; }
    b.tokens--;
    this.buckets.set(uid, b);
    return true;
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

    if (data.t === 'typing') return this.handleTyping(ws, meta);
    if (data.t === 'send') return this.handleSend(ws, meta, data);
  }

  private handleTyping(ws: WebSocket, meta: WsMeta): void {
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

    if (!this.allow(meta.uid)) {
      try { ws.send(JSON.stringify({ t: 'error', cid, code: 'rate_limit' })); } catch { /* keç */ }
      return;
    }

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
