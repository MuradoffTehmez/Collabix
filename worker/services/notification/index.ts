import { Env, uuid, now, fromJSON } from '../../util';

export class NotificationService {
  constructor(private env: Env) {}

  /**
   * Bildiriş yazısı — `routes.ts`-dəki `notify()` ilə eyni qaydalar:
   * istifadəçinin tərcihi söndürülübsə bildiriş göndərilmir.
   */
  async notify(
    toUid: string, 
    fromId: string, 
    fromName: string,
    type: string, 
    text: string, 
    postId: string | null = null
  ): Promise<boolean> {
    if (toUid === fromId) return false;
    
    const target = await this.env.DB.prepare('SELECT settings FROM users WHERE id = ?').bind(toUid).first<any>();
    if (!target) return false;
    
    const prefs = fromJSON<any>(target.settings, {})?.notifications || {};
    const prefKey = ({ like: 'likes', comment: 'comments', follow: 'follows' } as any)[type];
    if (prefKey && prefs[prefKey] === false) return false;

    await this.env.DB.prepare(
      'INSERT INTO notifications (id, user_id, type, from_id, from_name, post_id, text, read, created_at) VALUES (?,?,?,?,?,?,?,0,?)',
    ).bind(uuid(), toUid, type, fromId, fromName, postId, text, now()).run();
    
    return true;
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
