import { Env, uuid, now } from '../../util';
import {
  STANDARD_ROLES, DEFAULT_MEMBER_ROLE, OWNER_ROLE,
  parsePermissions, sanitizePermissions,
} from './permissions';

export class TeamRoleService {
  constructor(private env: Env) {}

  // DİQQƏT: massiv qaytarır. Əvvəllər `all()` nəticəsinin özü (`{results,...}`)
  // qaytarılırdı və route onu `json({ roles })` kimi göndərirdi — frontend
  // `Array.isArray(...)` yoxlamasından keçmədiyi üçün rol seçimi HƏMİŞƏ boş idi.
  async getRoles(teamId: string) {
    const { results } = await this.env.DB
      .prepare('SELECT * FROM team_roles WHERE team_id = ? ORDER BY priority DESC')
      .bind(teamId).all<any>();
    return results.map(r => ({ ...r, permissions: parsePermissions(r.permissions) }));
  }

  async getRole(roleId: string) {
    const r = await this.env.DB.prepare('SELECT * FROM team_roles WHERE id = ?').bind(roleId).first<any>();
    return r ? { ...r, permissions: parsePermissions(r.permissions) } : null;
  }

  async getRoleByName(teamId: string, name: string) {
    const r = await this.env.DB
      .prepare('SELECT * FROM team_roles WHERE team_id = ? AND name = ? LIMIT 1')
      .bind(teamId, name).first<any>();
    return r ? { ...r, permissions: parsePermissions(r.permissions) } : null;
  }

  /**
   * SİSTEM yolu — `STANDARD_ROLES` şablonlarını olduğu kimi yazır.
   *
   * AUDIT-TASK-3 / H-1: Owner şablonu `['*']` daşıyır və `sanitizePermissions`
   * artıq wildcard-ı ATIR (istifadəçi girişi üçün qəsdən belədir). Seed bu
   * funksiyadan keçsəydi Owner rolu BOŞ icazə ilə yaradılardı — yəni hər yeni
   * komandanın sahibi öz komandasını idarə edə bilməzdi.
   */
  private async insertRole(teamId: string, name: string, permissions: string[], priority: number) {
    const id = uuid();
    await this.env.DB.prepare(
      'INSERT INTO team_roles (id, team_id, name, permissions, priority) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, teamId, name, JSON.stringify(permissions), priority).run();
    return id;
  }

  /** İSTİFADƏÇİ yolu — giriş `sanitizePermissions`-dən keçir (H-1 ağ siyahısı). */
  async createRole(teamId: string, name: string, permissions: string[], priority = 0) {
    return this.insertRole(teamId, name, sanitizePermissions(permissions), priority);
  }

  async updateRole(roleId: string, updates: { name?: string; permissions?: string[]; priority?: number }) {
    const sets: string[] = [];
    const values: any[] = [];
    if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
    if (updates.permissions !== undefined) {
      sets.push('permissions = ?');
      values.push(JSON.stringify(sanitizePermissions(updates.permissions)));
    }
    if (updates.priority !== undefined) { sets.push('priority = ?'); values.push(updates.priority); }
    if (!sets.length) return;
    // D-1: audit sütunu. `teams.updated_at` ilə eyni naxış — hər
    // uğurlu UPDATE-də yenilənir, əks halda sütun boş qalar və
    // "nə vaxt dəyişdi" sualına cavab verməz.
    sets.push('updated_at = ?');
    values.push(now(), roleId);
    await this.env.DB.prepare(`UPDATE team_roles SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  }

  /** Rolu silmək — həmin roldakı üzvlər default rola köçürülür (FK sınmasın). */
  async deleteRole(teamId: string, roleId: string) {
    const fallback = await this.ensureRole(teamId, DEFAULT_MEMBER_ROLE);
    await this.env.DB.batch([
      this.env.DB.prepare('UPDATE team_members SET role_id = ? WHERE team_id = ? AND role_id = ?')
        .bind(fallback, teamId, roleId),
      this.env.DB.prepare('DELETE FROM team_roles WHERE id = ? AND team_id = ?').bind(roleId, teamId),
    ]);
  }

  /**
   * PDR-dəki 10 standart rolu yaradır (mövcud olanlara toxunmur).
   * Həm `createTeam`-dən, həm də köhnə komandalar üçün "lazy backfill" kimi
   * çağırılır — əvvəllər yaradılmış komandalarda yalnız "Owner" rolu var idi.
   */
  async ensureStandardRoles(teamId: string): Promise<Record<string, string>> {
    const existing = await this.getRoles(teamId);
    const byName = new Map(existing.map(r => [String(r.name), String(r.id)]));

    const stmts: D1PreparedStatement[] = [];
    const out: Record<string, string> = {};

    for (const tpl of STANDARD_ROLES) {
      const found = byName.get(tpl.name);
      if (found) { out[tpl.name] = found; continue; }
      const id = uuid();
      out[tpl.name] = id;
      stmts.push(
        this.env.DB.prepare('INSERT INTO team_roles (id, team_id, name, permissions, priority) VALUES (?, ?, ?, ?, ?)')
          .bind(id, teamId, tpl.name, JSON.stringify(tpl.permissions), tpl.priority)
      );
    }
    if (stmts.length) await this.env.DB.batch(stmts);

    for (const [name, id] of byName) if (!(name in out)) out[name] = id;
    return out;
  }

  /** Adı verilən rolun id-si; yoxdursa standart şablondan yaradılır. */
  async ensureRole(teamId: string, name: string): Promise<string> {
    const found = await this.getRoleByName(teamId, name);
    if (found) return String(found.id);
    const map = await this.ensureStandardRoles(teamId);
    if (map[name]) return map[name];
    // Sistem şablonu → `insertRole` (sanitizasiyasız). Şablon yoxdursa boş dəst.
    const tpl = STANDARD_ROLES.find(r => r.name === name);
    return this.insertRole(teamId, name, tpl?.permissions ?? [], tpl?.priority ?? 0);
  }

  /** Yeni üzv üçün təhlükəsiz default rol — HEÇ VAXT Owner deyil. */
  async getDefaultMemberRoleId(teamId: string): Promise<string> {
    return this.ensureRole(teamId, DEFAULT_MEMBER_ROLE);
  }

  async getOwnerRoleId(teamId: string): Promise<string> {
    return this.ensureRole(teamId, OWNER_ROLE);
  }
}
