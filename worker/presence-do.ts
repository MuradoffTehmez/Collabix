// PresenceDO — tək qlobal instans (idFromName('global')): bütün daxil olmuş
// istifadəçilər buraya WebSocket açır. Real-time online/offline broadcast edir.
// "last seen" vaxtı ayrıca (yüngül heartbeat → users.last_active_at) saxlanılır.
// Miqyas qeydi: tək qlobal DO icma ölçüsü üçün uyğundur; çox böyük miqyasda
// shard-lamaq lazım olardı (indi 50-100 istifadəçi → problem yoxdur).
import { DurableObject } from 'cloudflare:workers';
import type { Env } from './util';

interface PMeta { uid: string; hidden: boolean; }

export class PresenceDO extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('WebSocket gözlənilir', { status: 426 });
    }
    const url = new URL(request.url);
    const meta: PMeta = {
      uid: url.searchParams.get('uid') || '',
      hidden: url.searchParams.get('hidden') === '1',   // showOnlineStatus=false → görünməz
    };
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(meta);
    // Yeni bağlantıya cari online siyahısının snapshot-ı.
    server.send(JSON.stringify({ t: 'snapshot', uids: this.onlineUids() }));
    // Görünən istifadəçinin İLK bağlantısıdırsa → başqalarına "online" (çox-tab dublikatı yox).
    if (meta.uid && !meta.hidden && this.countUid(meta.uid) === 1) {
      this.broadcast({ t: 'on', uid: meta.uid }, server);
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const meta = (this.attach(ws)) as PMeta;
    // Bu istifadəçinin BAŞQA aktiv soketi qalmayıbsa → "offline".
    const stillOnline = this.ctx.getWebSockets().some(w => w !== ws && this.attach(w).uid === meta.uid);
    if (meta.uid && !meta.hidden && !stillOnline) {
      this.broadcast({ t: 'off', uid: meta.uid }, ws);
    }
    try { ws.close(); } catch { /* artıq qapalı */ }
  }

  async webSocketError(): Promise<void> { /* runtime təmizləyir */ }

  // RPC — worker konkret istifadəçinin BÜTÜN açıq tablarına siqnal göndərir
  // (yeni bildiriş / DM). Bu DO uid→soket indeksini onsuz da saxladığına görə
  // ayrıca "user DO" sinfi lazım deyil. Yalnız siqnaldır: məzmun D1-dən REST
  // ilə çəkilir. Gizli (hidden) istifadəçi də alır — məxfilik yalnız
  // başqalarına görünməyə aiddir, öz bildirişlərinə yox.
  push(uid: string, payload: unknown): void {
    if (!uid) return;
    const msg = JSON.stringify(payload);
    for (const ws of this.ctx.getWebSockets()) {
      if (this.attach(ws).uid !== uid) continue;
      try { ws.send(msg); } catch { /* qapanan soket — keç */ }
    }
  }

  private attach(ws: WebSocket): PMeta {
    return (ws.deserializeAttachment() || { uid: '', hidden: false }) as PMeta;
  }
  private onlineUids(): string[] {
    return [...new Set(this.ctx.getWebSockets().map(w => this.attach(w)).filter(m => m.uid && !m.hidden).map(m => m.uid))];
  }
  private countUid(uid: string): number {
    return this.ctx.getWebSockets().filter(w => this.attach(w).uid === uid).length;
  }
  private broadcast(payload: unknown, except: WebSocket): void {
    const msg = JSON.stringify(payload);
    for (const w of this.ctx.getWebSockets()) {
      if (w === except) continue;
      try { w.send(msg); } catch { /* keç */ }
    }
  }
}
