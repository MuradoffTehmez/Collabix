// Marşrut icazələrinin sxemlə uyğunluğu — PRD §5 / rol ayrımı.
//
// ════════════════════════════════════════════════════════════════════════════
// 🔴 NİYƏ BU TEST VAR
// ════════════════════════════════════════════════════════════════════════════
//
// `perm: 'MANAGE_USRS'` (yazı səhvi) TypeScript-i sındırmır — sahə `string`-dir.
// Runtime-da isə `can()` bazada belə icazə tapmır və **hər kəsə 403 verir**.
// Yəni bir hərflik səhv marşrutu HAMI üçün sükutla bağlayır və bu, yalnız
// istifadəçi şikayət edəndə görünür.
//
// Test marşrut cədvəlini və miqrasiyaları MƏNBƏDƏN oxuyub tutuşdurur —
// əl ilə saxlanılan ikinci siyahı yaratmır (o da köhnələ bilərdi).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** `worker/index.ts`-dəki marşrut cədvəlində işlədilən bütün icazələr. */
function routePerms(): string[] {
  const src = readFileSync(join(root, 'worker/index.ts'), 'utf8');
  const out = new Set<string>();
  for (const line of src.split('\n')) {
    // Yalnız ƏSL marşrut sətirləri — şərhdəki nümunələr sayılmamalıdır.
    if (!line.includes('pattern:')) continue;
    const m = line.match(/perm:\s*'([A-Z_]+)'/);
    if (m) out.add(m[1]);
  }
  return [...out].sort();
}

/** Miqrasiyalarda `permissions` cədvəlinə əlavə olunan bütün adlar. */
function schemaPerms(): Set<string> {
  const out = new Set<string>();
  const dir = join(root, 'migrations');
  for (const f of readdirSync(dir).filter(f => f.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, f), 'utf8');
    // `INSERT ... INTO permissions (...) VALUES` blokundakı ilk sütun = ad.
    const blocks = sql.split(/INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+permissions[^;]*/gi);
    const matches = sql.match(/INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+permissions[\s\S]*?;/gi) || [];
    void blocks;
    for (const b of matches) {
      for (const m of b.matchAll(/\(\s*'([A-Z_]+)'\s*,/g)) out.add(m[1]);
    }
  }
  return out;
}

/** Konkret rolun miqrasiyalardan sonrakı icazə dəsti (statik təhlil). */
function permsOfRole(role: string): Set<string> {
  const out = new Set<string>();
  const dir = join(root, 'migrations');
  for (const f of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(dir, f), 'utf8');
    for (const b of sql.match(/INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+role_permissions[\s\S]*?;/gi) || []) {
      // (a) `VALUES ('ROLE', 'PERM')`
      for (const m of b.matchAll(/\(\s*'([A-Z_]+)'\s*,\s*'([A-Z_]+)'\s*\)/g)) {
        if (m[1] === role) out.add(m[2]);
      }
      // (b) `SELECT 'ROLE', name FROM permissions WHERE name IN (...)`
      const sel = b.match(new RegExp(`SELECT\\s+'${role}',\\s*name\\s+FROM\\s+permissions[\\s\\S]*?(?:;|$)`, 'i'));
      if (sel) {
        const inList = sel[0].match(/IN\s*\(([\s\S]*?)\)/i);
        if (inList) for (const m of inList[1].matchAll(/'([A-Z_]+)'/g)) out.add(m[1]);
        else for (const p of schemaPerms()) out.add(p);   // `SELECT name FROM permissions` = HAMISI
      }
      // (c) `SELECT 'ROLE', permission_name FROM role_permissions WHERE role_name = 'BASE'` (kaskad)
      const casc = b.match(new RegExp(`SELECT\\s+'${role}',\\s*permission_name\\s+FROM\\s+role_permissions\\s+WHERE\\s+role_name\\s*=\\s*'([A-Z_]+)'`, 'i'));
      if (casc) for (const p of permsOfRole(casc[1])) out.add(p);
      // (d) `SELECT r.name, 'PERM' FROM roles r WHERE r.name IN (...)`
      const multi = b.match(/SELECT\s+r\.name,\s*'([A-Z_]+)'\s+FROM\s+roles\s+r\s+WHERE\s+r\.name\s+IN\s*\(([\s\S]*?)\)/i);
      if (multi && new RegExp(`'${role}'`).test(multi[2])) out.add(multi[1]);
      // (e) `SELECT r.name, p.name FROM roles r, permissions p WHERE r.name IN (...) AND p.name IN (...)`
      const cross = b.match(/SELECT\s+r\.name,\s*p\.name\s+FROM\s+roles\s+r,\s*permissions\s+p\s+WHERE\s+r\.name\s+IN\s*\(([\s\S]*?)\)\s*AND\s+p\.name\s+IN\s*\(([\s\S]*?)\)/i);
      if (cross && new RegExp(`'${role}'`).test(cross[1])) {
        for (const m of cross[2].matchAll(/'([A-Z_]+)'/g)) out.add(m[1]);
      }
    }
  }
  return out;
}

describe('marşrut icazələri — sxemlə uyğunluq', () => {
  it('🔴 hər `perm:` dəyəri sxemdə MÖVCUDDUR (yazı səhvi = hamıya 403)', () => {
    const schema = schemaPerms();
    const unknown = routePerms().filter(p => !schema.has(p));
    expect(unknown, `sxemdə olmayan icazə(lər): ${unknown.join(', ')}`).toEqual([]);
  });

  it('marşrut cədvəlində binar `admin: true` qapısı QALMAYIB', () => {
    const src = readFileSync(join(root, 'worker/index.ts'), 'utf8');
    const leftovers = src.split('\n')
      .filter(l => l.includes('pattern:') && l.includes('admin: true'));
    expect(leftovers, 'PRD §5: hər əməliyyat icazə ilə qorunmalıdır').toEqual([]);
  });

  it('icazə qapısı olan marşrut sayı gözləniləndən az deyil', () => {
    // Reqressiya mühafizəsi: kimsə `perm:`-i silsə say düşər.
    expect(routePerms().length).toBeGreaterThanOrEqual(13);
  });
});

describe('rol matrisi — kilidlənmə mühafizəsi', () => {
  it('🔴 OWNER bootstrap-ı miqrasiyada var (MANAGE_ROLES zənciri açıqdır)', () => {
    const sql = readFileSync(join(root, 'migrations/0035_rbac_completion.sql'), 'utf8');
    expect(sql).toMatch(/UPDATE users SET role = 'OWNER'/);
    // İdempotentlik: artıq OWNER varsa toxunmamalıdır.
    expect(sql).toMatch(/NOT EXISTS\s*\(\s*SELECT 1 FROM users WHERE role = 'OWNER'\s*\)/);
  });

  it('🔴 ADMIN rolu köhnə admin panelinin icazələrini SAXLAYIR', () => {
    // `admins` cədvəlindəki hər kəs 0031-də ADMIN oldu. Route-lar icazəyə
    // köçdüyü üçün ADMIN bunları daşımasa panel ONLAR ÜÇÜN bağlanardı.
    const admin = permsOfRole('ADMIN');
    for (const p of ['MANAGE_USERS', 'MANAGE_CONTENT', 'MANAGE_CONTACTS',
      'MANAGE_TEAMS', 'MANAGE_ROOMS', 'MANAGE_TASKS', 'MANAGE_CATEGORIES',
      'VIEW_AUDIT_LOG', 'VIEW_ANALYTICS', 'VIEW_REPORTS', 'MANAGE_REPORTS']) {
      expect(admin.has(p), `ADMIN rolunda ${p} yoxdur → panel bağlanar`).toBe(true);
    }
  });

  it('🔴 ADMIN rolu QƏSDƏN məhdudlaşdırılan icazələri DAŞIMIR', () => {
    // Auditin "hər admin = tam səlahiyyət" tapıntısının bağlanması budur.
    const admin = permsOfRole('ADMIN');
    for (const p of ['MANAGE_ROLES', 'MANAGE_PERMISSIONS', 'SYSTEM_BACKUP']) {
      expect(admin.has(p), `${p} ADMIN-də OLMAMALIDIR (SUPER_ADMIN+)`).toBe(false);
    }
  });

  it('OWNER bütün icazələri daşıyır', () => {
    const owner = permsOfRole('OWNER');
    const schema = schemaPerms();
    const missing = [...schema].filter(p => !owner.has(p));
    expect(missing, `OWNER-də çatışmayan: ${missing.join(', ')}`).toEqual([]);
  });
});
