import { Env, uuid, now, clampStr } from '../../util';

/** PDR: Team Feed növləri. */
export const POST_KINDS = ['post', 'announcement', 'update', 'release', 'progress'] as const;
export type PostKind = (typeof POST_KINDS)[number];

export function normalizeKind(v: unknown): PostKind {
  const s = String(v || 'post').toLowerCase();
  return (POST_KINDS as readonly string[]).includes(s) ? (s as PostKind) : 'post';
}

export class TeamFeedService {
  constructor(private env: Env) {}

  /**
   * Post növü `visibility` sütununda saxlanılır (0014-də ayrıca `kind` sütunu
   * yoxdur və miqrasiya artıq produksiyada tətbiq olunub). Dəyərlər:
   * 'post' | 'announcement' | 'update' | 'release' | 'progress'.
   */
  async createPost(teamId: string, authorId: string, content: string, kind: unknown = 'post') {
    const id = uuid();
    await this.env.DB.prepare(
      'INSERT INTO team_posts (id, team_id, author_id, content, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, teamId, authorId, clampStr(content, 5000), normalizeKind(kind), now()).run();
    return id;
  }

  async getPost(postId: string) {
    return this.env.DB.prepare('SELECT * FROM team_posts WHERE id = ?').bind(postId).first<any>();
  }

  async getFeed(teamId: string, limit = 100) {
    const { results } = await this.env.DB.prepare(
      `SELECT p.*, u.username, u.name, u.photo_url
         FROM team_posts p
         JOIN users u ON p.author_id = u.id
        WHERE p.team_id = ?
        ORDER BY p.created_at DESC
        LIMIT ?`
    ).bind(teamId, Math.min(Math.max(limit, 1), 200)).all<any>();
    return results;
  }

  /**
   * Silmə. İcazə yoxlanışı route qatındadır (`canModerate`), amma burada da
   * `team_id` şərti var ki, başqa komandanın post id-si ilə silmə mümkün olmasın.
   */
  async deletePost(teamId: string, postId: string) {
    const res = await this.env.DB
      .prepare('DELETE FROM team_posts WHERE id = ? AND team_id = ?')
      .bind(postId, teamId).run();
    return !!res.meta.changes;
  }
}
