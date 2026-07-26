import { Env, uuid, now } from '../../util';

export class TeamActivityService {
  constructor(private env: Env) {}

  async logEvent(teamId: string, actorId: string, eventType: string, metadata: any = {}): Promise<void> {
    if (!teamId) return;

    // `actor_id` → users(id) FK-dir; 'system' kimi psevdo-aktyor INSERT-i sındırır
    // və bütün queue mesajı retry-a düşürdü. Belə hallarda komanda sahibini yazırıq.
    let actor = actorId;
    const exists = actor
      ? await this.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(actor).first<any>()
      : null;
    if (!exists) {
      const team = await this.env.DB.prepare('SELECT owner_id FROM teams WHERE id = ?').bind(teamId).first<any>();
      if (!team?.owner_id) return;
      actor = String(team.owner_id);
    }

    const { type: _type, ...meta } = metadata || {};
    await this.env.DB.prepare(
      'INSERT INTO team_activity (id, team_id, actor_id, event_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(uuid(), teamId, actor, eventType, JSON.stringify(meta), now()).run();
  }

  async getActivities(teamId: string, limit = 50, before?: number | null) {
    const { results } = await this.env.DB.prepare(
      `SELECT a.*, u.username, u.name, u.photo_url
         FROM team_activity a
         JOIN users u ON a.actor_id = u.id
        WHERE a.team_id = ? AND (? IS NULL OR a.created_at < ?)
        ORDER BY a.created_at DESC
        LIMIT ?`
    ).bind(teamId, before ?? null, before ?? null, Math.min(Math.max(limit, 1), 200)).all<any>();
    return results;
  }

  /** Son N günün gündəlik aktivlik sayı — Statistics tab-ındakı qrafik üçün. */
  async getDailyCounts(teamId: string, days = 30) {
    const since = now() - days * 86400000;
    const { results } = await this.env.DB.prepare(
      `SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS count
         FROM team_activity
        WHERE team_id = ? AND created_at >= ?
        GROUP BY day
        ORDER BY day ASC`
    ).bind(teamId, since).all<any>();
    return results;
  }
}
