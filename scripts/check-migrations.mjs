// Miqrasiya nizamının yoxlayıcısı — AUDIT-TASK-5 §5.5.c, §5.6.
//
// Qaydalar `migrations/README.md`-dədir; bu skript onları maşınla təsbit edir.
//
// İşə salmaq:
//   node scripts/check-migrations.mjs            # ad formatı, dublikat, boşluq
//   node scripts/check-migrations.mjs --remote   # + tətbiq olunmamış miqrasiya QAPISI
//
// `--remote` rejimi `npm run deploy`-un `predeploy` addımından çağırılır:
// tətbiq olunmamış miqrasiya varsa deploy BLOKLANIR. Səbəb (audit, proses
// borcu #8): sıra pozulsa istehsalda yalnız DÜZGÜN parol 500 verir, uğursuz
// giriş 401 qalır — yəni qüsur monitorinqdə "normal 401 fonu" kimi gizlənir.

import { readdirSync } from 'node:fs';

const DIR = 'migrations';
const NAME_RE = /^(\d{4})_[a-z0-9_]+\.sql$/;

/**
 * Tarixi dublikatlar — DÜZƏLDİLMİR (migrations/README.md qayda 5).
 * `wrangler` tətbiq tarixçəsini fayl adı ilə izləyir; yenidən adlandırma
 * təkrar icra deməkdir. Bunlar `d1_migrations`-də artıq qeydə alınıb.
 * ⚠ Bu siyahıya YENİ sətir əlavə etmə — yeni dublikat xəta verməlidir.
 */
const HISTORIC_DUPLICATES = new Set(['0015', '0016']);

const errors = [];
const warnings = [];

const files = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort();
if (!files.length) errors.push(`${DIR}/ qovluğunda .sql faylı yoxdur`);

/* ─── 1. Ad formatı ─── */
const parsed = [];
for (const f of files) {
  const m = NAME_RE.exec(f);
  if (!m) {
    errors.push(`Ad formatı pozulub: ${f} — gözlənilən NNNN_ad.sql (kiçik hərf, alt xətt)`);
    continue;
  }
  parsed.push({ file: f, num: m[1] });
}

/* ─── 2. Dublikat nömrələr ─── */
const byNum = new Map();
for (const p of parsed) {
  if (!byNum.has(p.num)) byNum.set(p.num, []);
  byNum.get(p.num).push(p.file);
}
for (const [num, group] of byNum) {
  if (group.length < 2) continue;
  if (HISTORIC_DUPLICATES.has(num)) {
    warnings.push(`Tarixi dublikat ${num}: ${group.join(', ')} — qəsdən saxlanılır (README §5)`);
  } else {
    errors.push(
      `YENİ dublikat nömrə ${num}: ${group.join(', ')}\n` +
      `  → Nömrəni dəyiş. Mövcud faylı YENİDƏN ADLANDIRMA (README §2) — ` +
      `yeni faylın nömrəsini artır.`,
    );
  }
}

/* ─── 3. Nömrə boşluğu (xəbərdarlıq) ─── */
const nums = [...new Set(parsed.map(p => Number(p.num)))].sort((a, b) => a - b);
for (let i = 1; i < nums.length; i++) {
  const gap = nums[i] - nums[i - 1];
  if (gap > 1) {
    warnings.push(`Nömrə boşluğu: ${String(nums[i - 1]).padStart(4, '0')} → ${String(nums[i]).padStart(4, '0')}`);
  }
}

/* ─── 4. Uzaq qapı: tətbiq olunmamış miqrasiya varmı? ─── */
if (process.argv.includes('--remote')) {
  const { execFileSync: run } = await import('node:child_process');
  let out = '';
  try {
    out = run('npx', ['wrangler', 'd1', 'migrations', 'list', 'collabix-db', '--remote'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
  } catch (e) {
    // Wrangler tətbiq olunmamış miqrasiya OLMADIQDA da sıfırdan fərqli kod
    // qaytara bilər — çıxışı yenə də oxuyuruq, yalnız tamamilə boşdursa xəta.
    out = [e?.stdout, e?.stderr].filter(Boolean).join('\n');
    if (!out.trim()) {
      errors.push(`Uzaq miqrasiya siyahısı alınmadı: ${e?.message || e}`);
    }
  }
  const pending = files.filter(f => out.includes(f));
  if (pending.length) {
    errors.push(
      `TƏTBİQ OLUNMAMIŞ miqrasiya var — deploy BLOKLANDI:\n` +
      pending.map(f => `    • ${f}`).join('\n') +
      `\n  → Əvvəlcə: npm run db:migrate:remote\n` +
      `  → Sonra:   npm run deploy\n` +
      `  (README §6 — sıra pozulsa qüsur istehsalda GİZLƏNİR)`,
    );
  } else {
    console.log('✓ Uzaq baza: tətbiq olunmamış miqrasiya yoxdur');
  }
}

/* ─── Nəticə ─── */
for (const w of warnings) console.warn(`⚠  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`✗  ${e}`);
  console.error(`\n${errors.length} xəta — bax migrations/README.md`);
  process.exit(1);
}
console.log(`✓ ${files.length} miqrasiya faylı yoxlanıldı — nizam qaydadadır`);
