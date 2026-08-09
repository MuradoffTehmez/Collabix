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

import { readdirSync, readFileSync } from 'node:fs';

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

/* ─── 3b. İDEMPOTENTLİK (BACKEND AUDIT / BE-006) ───
 *
 * 🔴 NİYƏ: `0031_prd_rbac.sql` bir dənə qorumasız
 *   `ALTER TABLE users ADD COLUMN reputation …` daşıyır. Fayl əl ilə təkrar
 *   icra olunanda SQLite `duplicate column name` ilə DAYANIR və faylın
 *   SONRAKI hissəsi — 64 sətirlik rol/icazə seed-i — heç vaxt işləmir.
 *   Nəticə səssizdir: rollar var, icazələr yarımçıq, OWNER hesab bəzi admin
 *   endpoint-lərində 403 alır və bu, "kod sınıb" kimi görünür.
 *   Ölçüldü: təzə lokal bazada `role_permissions` 127, istehsalda 144.
 *
 * ⚠ Miqrasiya runner-i hər faylı BİR DƏFƏ icra edir, ona görə normal deploy
 *   yolunda problem yoxdur. Tələ lokal mühit qurarkən, faylı əl ilə
 *   qaçırarkən üzə çıxır — və məhz orada diaqnoz ən bahalıdır.
 *
 * ⚠ TƏTBİQ OLUNMUŞ MİQRASİYALAR DÜZƏLDİLMİR: `0031` tarixdir, onu dəyişmək
 *   artıq icra olunmuş bazalarla fərq yaradar. Qayda YALNIZ yeni fayllara
 *   tətbiq olunur; köhnələr `GRANDFATHERED` siyahısındadır.
 */
/* ⚠ QAYDA YALNIZ YENİ FAYLLARA: bu nömrədən ƏVVƏLKİ miqrasiyalar artıq
 *   istehsalda tətbiq olunub. Onları redaktə etmək icra olunmuş bazalarla
 *   fərq yaradar və heç bir problemi həll etməz — tələ yalnız GƏLƏCƏK
 *   fayllarda təkrarlanmamalıdır. Eyni yanaşma yuxarıdakı
 *   `HISTORIC_DUPLICATES` üçün də işlədilib.
 *   Ölçmə: bu hədd olmadan qayda 54 tarixi faylı işarələyirdi. */
const IDEMPOTENCY_RULE_FROM = 55;
for (const p of parsed) {
  if (Number(p.num) < IDEMPOTENCY_RULE_FROM) continue;
  const sql = readFileSync(`${DIR}/${p.file}`, 'utf8')
    .replace(/--[^\n]*/g, '')            // sətir şərhləri
    .replace(/\/\*[\s\S]*?\*\//g, '');   // blok şərhləri
  /* `ADD COLUMN` üçün SQLite-da `IF NOT EXISTS` YOXDUR — ifadə təkrar icrada
   * mütləq sınır və onu sındırmamaq mümkün deyil. Ona görə qayda ifadənin
   * ÖZÜNÜ deyil, ZƏRƏRİNİ hədəf alır: sınan ifadədən SONRA gələn ifadələr heç
   * vaxt işləməyəcək.
   *
   * ⚠ Yəni TƏK ifadəsi `ADD COLUMN` olan fayl DÜZGÜN naxışdır (`0055` məhz
   *   belədir) və xəbərdarlıq ALMAMALIDIR. Əks halda qayda öz tövsiyəsini
   *   cəzalandırar, developer isə onu səs-küy sayıb hamısını görməzdən gələr.
   *   Problem yalnız faylda BAŞQA ifadə də olanda var. */
  const addCol = [...sql.matchAll(/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)/gi)];
  if (addCol.length) {
    const stmtCount = sql.split(';').filter(s => s.trim()).length;
    if (stmtCount > addCol.length) {
      warnings.push(
        `${p.file}: \`ALTER TABLE ${addCol[0][1]} ADD COLUMN ${addCol[0][2]}\` təkrar icrada SINIR ` +
        `və faylda ${stmtCount} ifadə var — sonrakılar heç vaxt işləməyəcək. ` +
        'Sütun əlavəsini AYRI miqrasiyada saxla (bax 0055 + 0056).',
      );
    }
  }
  // `CREATE TABLE`/`CREATE INDEX` üçün isə qoruma MÖVCUDDUR — istifadə olunmasa xətadır.
  for (const m of sql.matchAll(/CREATE\s+(TABLE|(?:UNIQUE\s+)?INDEX)\s+(?!IF\s+NOT\s+EXISTS)(\w+)/gi)) {
    errors.push(`${p.file}: \`CREATE ${m[1].toUpperCase()} ${m[2]}\` — \`IF NOT EXISTS\` yoxdur (təkrar icrada sınır)`);
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
