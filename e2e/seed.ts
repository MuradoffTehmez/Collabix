// E2E test məlumatı — LOKAL wrangler dev üçün.
// İstifadəçilər REAL /api/auth/register endpoint-i ilə yaradılır: parol heşi
// (PBKDF2) məntiqi burada TƏKRARLANMIR, əsl kod yolu işlədilir.
//
// ⚠ `auth` rate-limit-i 5 dəqiqədə 10 sorğudur (worker/auth.ts RL).
// Ona görə:
//   * artıq mövcud istifadəçilər üçün register ÇAĞIRILMIR (D1-dən yoxlanılır) —
//     təkrar işə salmalarda sıfır auth sorğusu gedir;
//   * giriş bir dəfə edilir və sessiya storageState kimi saxlanılır.

import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const TEST_PASS = 'Test12345!';

// Turnstile token-i. Test mühiti Cloudflare-in "həmişə keçir" dummy secret-i ilə
// işləyir (playwright.config.ts), ona görə dəyərin özü əhəmiyyətsizdir — amma
// BOŞ OLA BİLMƏZ: server boş token-i siteverify-a çatmadan rədd edir.
// Brauzerdən kənar (xam `fetch`) çağırışlar widget-dən token ala bilmədiyi üçün
// bunu göndərir.
export const E2E_TURNSTILE = 'e2e-dummy-token';
export const PRIMARY = 'e2e_main';          // giriş üçün əsas hesab
export const AUTH_FILE = 'e2e/.auth/user.json';

// [username, ad, xp, neçə gün əvvəl aktiv, skill-lər]
// xp və aktivlik qəsdən fərqlidir ki, sıralama birmənalı yoxlansın.
export const USERS: Array<[string, string, number, number, Record<string, string>]> = [
  ['e2e_main',   'Main Tester',     10,  0, { Python: 'Orta' }],
  ['e2e_zara',   'Zara Quliyeva',  900,  1, { Python: 'Qabaqcıl', 'C++': 'Orta', SQL: 'Başlanğıc', Go: 'Orta', Rust: 'Başlanğıc' }],
  ['e2e_aysel',  'Aysel Məmmədli', 700,  3, { JavaScript: 'Orta', TypeScript: 'Qabaqcıl' }],
  ['e2e_bahram', 'Bəhram Əliyev',  500,  7, { Java: 'Başlanğıc' }],
  ['e2e_camal',  'Camal Hüseyn',   300, 14, { Python: 'Başlanğıc', İngilis: 'Orta' }],
  ['e2e_dilara', 'Dilarə Nəbi',    100, 30, { 'HTML/CSS': 'Orta' }],
  // 2FA testləri üçün AYRICA hesab (TASK-8 / Bənd 2). Adı qəsdən
  // `users.spec.ts`-dəki SEEDED siyahısında DEYİL — həmin testlər
  // `onlySeeded()` ilə süzür, yəni bu hesab sıralama assertion-larına
  // düşmür. 2FA qurma girişi dəyişdiyi üçün paylaşılan hesabda edilə bilməz.
  ['e2e_mfa',    'MFA Tester',      50,  5, { Python: 'Başlanğıc' }],
];

/* ---------- D1 köməkçiləri ---------- */
// SQL fayl vasitəsilə ötürülür: `--command` ilə uzun, boşluqlu və apostroflu
// sorğu Windows shell-ində parçalanır ("Unknown arguments: users, SET, ...").
export function d1(sql: string, capture = false): string {
  const file = join(tmpdir(), `collabix-e2e-${process.pid}-${Date.now()}.sql`);
  writeFileSync(file, sql, 'utf8');
  try {
    const args = ['wrangler', 'd1', 'execute', 'collabix-db', '--local',
      '--persist-to', '.wrangler/state', '--file', file];
    if (capture) args.push('--json');
    try {
      // stderr həmişə tutulur: `ignore` etsəydik SQL xətası "Command failed"
      // kimi görünərdi və əsl səbəb (hansı sətir, hansı sütun) itərdi.
      const out = execFileSync('npx', args, {
        stdio: ['ignore', capture ? 'pipe' : 'ignore', 'pipe'],
        shell: process.platform === 'win32',
        encoding: 'utf8',
      });
      return out || '';
    } catch (e: any) {
      const detail = [e?.stderr, e?.stdout].filter(Boolean).join('\n').slice(0, 1200);
      throw new Error(`d1 sorğusu uğursuz:\n${sql.slice(0, 400)}\n--- wrangler çıxışı ---\n${detail}`);
    }
  } finally {
    rmSync(file, { force: true });
  }
}

function existingUsernames(): Set<string> {
  const list = USERS.map(u => `'${u[0]}'`).join(',');
  const raw = d1(`SELECT username FROM users WHERE username IN (${list});`, true);
  // wrangler --json çıxışında başqa sətrlər də ola bilər — ilk JSON blokunu tap.
  const start = raw.indexOf('[');
  if (start < 0) return new Set();
  try {
    const parsed = JSON.parse(raw.slice(start));
    const rows = parsed?.[0]?.results ?? [];
    return new Set(rows.map((r: any) => r.username));
  } catch { return new Set(); }
}

async function registerOne(base: string, u: (typeof USERS)[number]) {
  const [username, name, , , progLevels] = u;
  const res = await fetch(base + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      turnstileToken: E2E_TURNSTILE,
      username, pass: TEST_PASS, name, age: 25,
      birthDate: '2000-01-01', gender: 'k', country: 'Azərbaycan', city: 'Bakı',
      bio: 'E2E test hesabı', progLevels, langLevels: {}, lookingFor: ['Study partner'],
    }),
  });
  if (res.ok) return;
  const body: any = await res.json().catch(() => ({}));
  if (typeof body?.error === 'string' && body.error.includes('tutulub')) return;
  throw new Error(`register ${username} alınmadı (${res.status}): ${JSON.stringify(body)}`);
}

export async function seedTestUsers(base: string) {
  const have = existingUsernames();
  const missing = USERS.filter(u => !have.has(u[0]));
  for (const u of missing) await registerOne(base, u);

  // Sıralama sahələri: xp (İstifadəçilər#5 "Ən yüksək XP") və last_active_at
  // ("Son aktiv olanlar"). Registrasiya hamısına eyni dəyər verir, ona görə
  // burada birbaşa yazılır — bunlar API ilə təyin edilə bilməyən qazanılan dəyərlərdir.
  const nowMs = Date.now();
  const sql = USERS.map(([username, , xp, daysAgo]) =>
    `UPDATE users SET xp = ${xp}, last_active_at = ${nowMs - daysAgo * 86400000} ` +
    `WHERE username = '${username}';`);

  // BÖLMƏ 3 testləri admin paneli tələb edir → əsas hesaba admin hüququ.
  // (API-də "özünü admin et" endpoint-i yoxdur və olmamalıdır — birbaşa D1.)
  sql.push(
    `INSERT OR IGNORE INTO admins (user_id, added_at, added_by) ` +
    `SELECT id, ${nowMs}, 'e2e-seed' FROM users WHERE username = '${PRIMARY}';`);

  // Terminal jurnalında hər səviyyədən sətir olsun (Admin#6 rəngləmə/filtr testi).
  const logRow = (n: number, action: string, level: string) =>
    `INSERT OR IGNORE INTO admin_logs (id, action, target_id, by_id, by_name, detail, created_at, level) ` +
    `SELECT 'e2e-log-${n}', '${action}', '', id, username, 'e2e', ${nowMs - n * 1000}, '${level}' ` +
    `FROM users WHERE username = '${PRIMARY}';`;
  sql.push(
    logRow(1, 'admin-remove', 'error'),
    logRow(2, 'user-edit', 'warning'),
    logRow(3, 'admin-add', 'success'),
    logRow(4, 'export-users', 'info'),
    `INSERT OR IGNORE INTO team_members (id, team_id, user_id, role_id, status, joined_at) ` +
    `SELECT 'member_e2e_main', 'team_1', id, 'role_1', 'active', ${nowMs} FROM users WHERE username = '${PRIMARY}';`
  );

  // TASK-11 RBAC testləri üçün: əsas hesabın ÜZV OLMADIĞI Private komanda.
  // Onun feed/fayl/üzv siyahısı 403 verməlidir (docs/TASK-11-REPORT.md K3–K5).
  sql.push(
    `INSERT OR IGNORE INTO teams (id, slug, name, description, visibility, owner_id, status, xp, created_at, updated_at) ` +
    `SELECT 'team_2', 'beta-team', 'Beta Team', 'Private team for RBAC tests', 'Private', id, 'active', 0, ${nowMs}, ${nowMs} ` +
    `FROM users WHERE username = 'e2e_zara';`,
    `INSERT OR IGNORE INTO team_roles (id, team_id, name, permissions, priority) ` +
    `VALUES ('role_2_owner', 'team_2', 'Owner', '["*"]', 100);`,
    `INSERT OR IGNORE INTO team_members (id, team_id, user_id, role_id, status, joined_at) ` +
    `SELECT 'member_team2_owner', 'team_2', id, 'role_2_owner', 'active', ${nowMs} ` +
    `FROM users WHERE username = 'e2e_zara';`,
    // Kəşfiyyat siyahısı testinə görünən Public komanda.
    `INSERT OR IGNORE INTO teams (id, slug, name, description, visibility, owner_id, status, xp, created_at, updated_at) ` +
    `SELECT 'team_3', 'gamma-team', 'Gamma Team', 'Public team for discover tests', 'Public', id, 'active', 0, ${nowMs}, ${nowMs} ` +
    `FROM users WHERE username = 'e2e_zara';`,
    `INSERT OR IGNORE INTO team_roles (id, team_id, name, permissions, priority) ` +
    `VALUES ('role_3_owner', 'team_3', 'Owner', '["*"]', 100);`,
    `INSERT OR IGNORE INTO team_roles (id, team_id, name, permissions, priority) ` +
    `VALUES ('role_3_dev', 'team_3', 'Developer', '["manage_tasks","manage_files"]', 45);`,
    `INSERT OR IGNORE INTO team_members (id, team_id, user_id, role_id, status, joined_at) ` +
    `SELECT 'member_team3_owner', 'team_3', id, 'role_3_owner', 'active', ${nowMs} ` +
    `FROM users WHERE username = 'e2e_zara';`,
  );

  d1(sql.join('\n'));
}
