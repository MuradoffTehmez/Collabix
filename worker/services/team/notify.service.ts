import { Env } from '../../util';
import { NotificationService } from '../notification';

/**
 * Komanda bildirişləri (PDR "Team Notifications").
 *
 * `notifications` cədvəli mövcud sistemlə paylaşılır; `type` sahəsi
 * `team_*` prefiksi ilə gedir ki, UI onları qruplaşdıra bilsin.
 * Realtime siqnal PresenceDO üzərindən göndərilir — istifadəçi onlayndırsa
 * zəng ikonası dərhal yenilənir.
 */
export class TeamNotifyService {
  private notif: NotificationService;
  constructor(private env: Env) {
    this.notif = new NotificationService(env);
  }

  private async send(toUid: string, fromId: string, fromName: string, type: string, text: string) {
    if (!toUid || toUid === fromId) return;
    const ok = await this.notif.notify(toUid, fromId, fromName, type, text, null);
    if (ok) await this.notif.pushSignal(toUid, { t: 'notif' });
  }

  /** Komandanın bütün üzvlərinə (aktyorun özündən başqa). */
  async broadcast(teamId: string, fromId: string, fromName: string, type: string, text: string) {
    const { results } = await this.env.DB
      .prepare("SELECT user_id FROM team_members WHERE team_id = ? AND status = 'active'")
      .bind(teamId).all<any>();
    await Promise.all(results.map(r => this.send(String(r.user_id), fromId, fromName, type, text)));
  }

  async toUser(toUid: string, fromId: string, fromName: string, type: string, text: string) {
    await this.send(toUid, fromId, fromName, type, text);
  }

  /** İcazəsi olan idarəçilərə (məs. layihəyə qoşulma sorğusu). */
  async toManagers(teamId: string, fromId: string, fromName: string, type: string, text: string) {
    const { results } = await this.env.DB.prepare(
      `SELECT m.user_id, r.permissions
         FROM team_members m JOIN team_roles r ON m.role_id = r.id
        WHERE m.team_id = ? AND m.status = 'active'`
    ).bind(teamId).all<any>();

    const targets = results.filter(r => {
      const p = String(r.permissions || '');
      return p.includes('"*"') || p.includes('manage_projects') || p.includes('manage_members');
    });
    await Promise.all(targets.map(r => this.send(String(r.user_id), fromId, fromName, type, text)));
  }
}
