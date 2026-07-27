// AUDIT-TASK-3 / H-1 — icazə modelinin SAF funksiya testləri.
//
// `worker/services/team/permissions.ts` heç bir Workers API-si işlətmir, ona görə
// birbaşa import olunur və brauzer tələb etmir. Protokol (HTTP) səviyyəsindəki
// eskalasiya testləri `teams-rbac.spec.ts`-dədir; burada AUDIT-TASK-3 §6-dakı
// 2–4 və 6 saylı qəbul meyarları, həmçinin §5.2-dəki "qiymətləndirmə yoluna
// toxunulmayıb" invariantı maşınla təsbit olunur.
import { test, expect } from '@playwright/test';
import {
  TEAM_PERMISSIONS, STANDARD_ROLES, hasPermission,
  sanitizePermissions, expandPermissions, findEscalatedPermissions,
} from '../worker/services/team/permissions';

test.beforeEach(({ }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop',
    'Saf funksiya testi — viewport-dan asılı deyil, bir dəfə icra olunur');
});

const roleTemplate = (name: string) => {
  const tpl = STANDARD_ROLES.find(r => r.name === name);
  if (!tpl) throw new Error(`${name} şablonu STANDARD_ROLES-də yoxdur`);
  return tpl;
};

test.describe('AUDIT H-1 — sanitizePermissions (istifadəçi GİRİŞİ)', () => {
  // Əvvəl: `if (list.includes('*')) return ['*']` — istifadəçi öz roluna
  // bütün səlahiyyətləri bir simvolla yaza bilirdi.
  test("'*' istifadəçi girişindən qəbul olunmur", () => {
    expect(sanitizePermissions(['*'])).toEqual([]);
    expect(sanitizePermissions(['*', 'manage_tasks'])).toEqual(['manage_tasks']);
    expect(sanitizePermissions(['manage_tasks', '*'])).not.toContain('*');
  });

  test('etibarlı icazələr keçir, uydurma adlar atılır', () => {
    expect(sanitizePermissions(['manage_members'])).toEqual(['manage_members']);
    expect(sanitizePermissions(['manage_members', 'uydurma_icaze'])).toEqual(['manage_members']);
    expect(sanitizePermissions([...TEAM_PERMISSIONS])).toEqual([...TEAM_PERMISSIONS]);
  });

  test('dublikatlar təmizlənir', () => {
    expect(sanitizePermissions(['manage_tasks', 'manage_tasks'])).toEqual(['manage_tasks']);
  });

  test('massiv olmayan giriş boş dəst verir (fail-closed)', () => {
    expect(sanitizePermissions(null)).toEqual([]);
    expect(sanitizePermissions(undefined)).toEqual([]);
    expect(sanitizePermissions('manage_team')).toEqual([]);
    expect(sanitizePermissions({ 0: '*' })).toEqual([]);
  });
});

test.describe('AUDIT H-1 §5.2 — QİYMƏTLƏNDİRMƏ yolu toxunulmazdır', () => {
  // Owner rolu bazada `['*']` kimi saxlanılır (STANDARD_ROLES + e2e/seed.ts).
  // Bu üç test wildcard dəstəyinin qiymətləndirmədən SİLİNMƏDİYİNİ qoruyur —
  // silinsə HƏR komandanın Owner-i öz komandasından kilidlənərdi.
  test("hasPermission Owner-in ['*'] dəyərini hələ də qəbul edir", () => {
    expect(hasPermission(['*'], 'manage_team')).toBe(true);
    for (const p of TEAM_PERMISSIONS) expect(hasPermission(['*'], p)).toBe(true);
    expect(hasPermission([], 'manage_team')).toBe(false);
    expect(hasPermission(null, 'manage_team')).toBe(false);
  });

  test('Owner şablonu wildcard və 100 prioritetini saxlayır', () => {
    const owner = roleTemplate('Owner');
    expect(owner.permissions).toEqual(['*']);
    expect(owner.priority).toBe(100);
  });

  test('Admin şablonunda manage_team YOXDUR — sənədləşdirilmiş sərhəd', () => {
    const admin = roleTemplate('Admin');
    expect(admin.permissions).not.toContain('manage_team');
    expect(admin.permissions).not.toContain('*');
    expect(admin.permissions).toContain('manage_roles');
    expect(admin.permissions).toContain('manage_members');
    expect(admin.priority).toBeLessThan(roleTemplate('Owner').priority);
  });
});

test.describe('AUDIT H-1 — altçoxluq qaydası', () => {
  test("Owner-in ['*'] dəsti tam kataloqa açılır (funksional çökmə qoruması)", () => {
    expect([...expandPermissions(['*'])].sort()).toEqual([...TEAM_PERMISSIONS].sort());
  });

  test('Owner istənilən icazəni verə bilər — qayda onu bloklamır', () => {
    expect(findEscalatedPermissions(['*'], [...TEAM_PERMISSIONS])).toEqual([]);
  });

  test('Admin özündə olmayan manage_team-i verə bilmir', () => {
    const admin = roleTemplate('Admin').permissions;
    expect(findEscalatedPermissions(admin, ['manage_team'])).toEqual(['manage_team']);
    expect(findEscalatedPermissions(admin, ['manage_tasks', 'manage_feed'])).toEqual([]);
    expect(findEscalatedPermissions(admin, ['manage_tasks', 'manage_team'])).toEqual(['manage_team']);
  });

  test('icazəsi olmayan üzv heç nə verə bilmir (fail-closed)', () => {
    expect(findEscalatedPermissions([], ['manage_tasks'])).toEqual(['manage_tasks']);
    expect(findEscalatedPermissions(roleTemplate('Viewer').permissions, ['manage_feed']))
      .toEqual(['manage_feed']);
  });
});

test.describe('AUDIT H-1 — prioritet istiqaməti', () => {
  // §3.0/Sual 6: böyük rəqəm = güclü. Səhv istiqamət bütün prioritet
  // qaydasını tərsinə çevirib eskalasiyanı ASANLAŞDIRARDI.
  test('böyük rəqəm daha güclü roldur', () => {
    expect(roleTemplate('Owner').priority).toBeGreaterThan(roleTemplate('Admin').priority);
    expect(roleTemplate('Admin').priority).toBeGreaterThan(roleTemplate('Developer').priority);
    expect(roleTemplate('Developer').priority).toBeGreaterThan(roleTemplate('Viewer').priority);
  });
});
