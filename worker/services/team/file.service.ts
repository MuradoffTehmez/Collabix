import { Env, uuid, now } from '../../util';

/** PDR: /team_id/{documents,design,assets,source,exports}/ */
export const FILE_CATEGORIES = ['documents', 'design', 'assets', 'source', 'exports'] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

export function normalizeCategory(v: unknown): FileCategory {
  const s = String(v || 'documents').toLowerCase();
  return (FILE_CATEGORIES as readonly string[]).includes(s) ? (s as FileCategory) : 'documents';
}

export class TeamFileService {
  constructor(private env: Env) {}

  async recordFile(
    teamId: string, uploaderId: string, path: string,
    type: string, size: number, category: unknown = 'documents',
  ) {
    const id = uuid();
    await this.env.DB.prepare(
      `INSERT INTO team_files (id, team_id, uploaded_by, path, type, size, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, teamId, uploaderId, path, type, size, normalizeCategory(category), now()).run();
    return id;
  }

  async getFile(fileId: string) {
    return this.env.DB.prepare('SELECT * FROM team_files WHERE id = ?').bind(fileId).first<any>();
  }

  async getFiles(teamId: string, category?: string) {
    const cat = category && category !== 'all' ? normalizeCategory(category) : null;
    const { results } = await this.env.DB.prepare(
      `SELECT f.*, u.username, u.name
         FROM team_files f
         JOIN users u ON f.uploaded_by = u.id
        WHERE f.team_id = ? AND (? IS NULL OR f.category = ?)
        ORDER BY f.created_at DESC`
    ).bind(teamId, cat, cat).all<any>();
    return results;
  }

  async getUsage(teamId: string) {
    const row = await this.env.DB
      .prepare('SELECT COUNT(*) AS files, COALESCE(SUM(size), 0) AS bytes FROM team_files WHERE team_id = ?')
      .bind(teamId).first<any>();
    return { files: Number(row?.files || 0), bytes: Number(row?.bytes || 0) };
  }

  /**
   * Faylı həm D1-dən, həm R2-dən silir. Əvvəl yalnız D1 sətri silinirdi və
   * R2 obyekti əbədi qalırdı (həm xərc, həm də silinmiş faylın URL ilə
   * əlçatan qalması demək idi).
   */
  async deleteFile(teamId: string, fileId: string) {
    const file = await this.env.DB
      .prepare('SELECT * FROM team_files WHERE id = ? AND team_id = ?')
      .bind(fileId, teamId).first<any>();
    if (!file) return null;

    await this.env.DB.prepare('DELETE FROM team_files WHERE id = ?').bind(fileId).run();
    try {
      await this.env.FILES.delete(String(file.path));
    } catch (e: any) {
      console.error('R2 delete failed for', file.path, e?.message || e);
    }
    return file;
  }
}
