#!/usr/bin/env node
// Köhnə Firebase Storage emulyatorundan (localhost:9199) əsl şəkil baytlarını
// çəkib real Cloudflare R2-ə yükləyir, sonra D1-də photo_url/blocks sahələrini
// yeni /files/... ünvanlarına yeniləyir.
//
// ⚠ ARTIQ İCRA OLUNA BİLMƏZ (AUDIT-TASK-1 / 2026-07-27).
// Bu skript Firebase emulyatorunun `legacy/firebase/.emulator-data` exportundan
// asılı idi. Həmin qovluq 53 istifadəçinin AÇIQ MƏTNLİ parolunu saxladığı üçün
// tamamilə silindi (AUDIT C-2). Skript tarixi istinad kimi saxlanılır —
// miqrasiya artıq tamamlanıb və nəticəsi `update.sql`-dədir.
// Yenidən işlətmək lazım gəlsə emulyator exportu təmiz mənbədən bərpa
// olunmalıdır; PAROL FAYLINI geri gətirmək QADAĞDIR.
//
//   node backfill-images.mjs             → DRY-RUN: nə köçürüləcəyini göstərir
//   node backfill-images.mjs --execute   → R2-ə yükləyir + update.sql yaradır
//   (sonra: wrangler d1 execute collabix-db --remote --file migration-cf/update.sql)
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const FS = 'http://127.0.0.1:8080/v1/projects/demo-collabix/databases/(default)/documents';
const HDR = { Authorization: 'Bearer owner' };
const EXECUTE = process.argv.includes('--execute');
const q = v => `'${String(v).replace(/'/g, "''")}'`;

function fv(val) {
  if (val == null) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('mapValue' in val) { const o = {}; Object.entries(val.mapValue.fields || {}).forEach(([k, v]) => { o[k] = fv(v); }); return o; }
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(fv);
  return null;
}
function doc2obj(d) { const o = { _id: d.name.split('/').pop() }; Object.entries(d.fields || {}).forEach(([k, v]) => { o[k] = fv(v); }); return o; }
async function list(path) {
  const out = [];
  let pageToken = '';
  do {
    const res = await fetch(`${FS}/${path}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`, { headers: HDR });
    const json = await res.json();
    (json.documents || []).forEach(d => out.push(doc2obj(d)));
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return out;
}

const tmpDir = mkdtempSync(join(tmpdir(), 'collabix-img-'));

async function uploadToR2(url, r2Key) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Emulyatordan oxuna bilmədi (${res.status}): ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const tmpFile = join(tmpDir, 'img.jpg');
  writeFileSync(tmpFile, buf);
  execFileSync('npx', [
    'wrangler', 'r2', 'object', 'put', `collabix-files/${r2Key}`,
    '--file', tmpFile, '--content-type', 'image/jpeg', '--remote',
  ], { cwd: 'C:/Users/Tahmaz Muradov/Desktop/Collabix', stdio: 'pipe', shell: true });
  return `/files/${r2Key}`;
}

async function main() {
  console.log(`\n=== Şəkil backfill — ${EXECUTE ? '🔴 EXECUTE (R2-ə yüklənir)' : '🟢 DRY-RUN'} ===\n`);

  const users = await list('users');
  const usersWithPhoto = users.filter(u => u.photoURL);
  const posts = await list('posts');
  const postsWithImg = posts.filter(p => (p.blocks || []).some(b => b.type === 'image'));

  console.log(`İstifadəçi avatarı: ${usersWithPhoto.length}`);
  console.log(`Post şəkli olan: ${postsWithImg.length}\n`);

  if (!EXECUTE) {
    usersWithPhoto.forEach(u => console.log(`  avatar: @${u.username} (${u._id})`));
    postsWithImg.forEach(p => console.log(`  post: ${p._id}`));
    console.log('\n🟢 DRY-RUN bitdi. İcra üçün: node backfill-images.mjs --execute');
    rmSync(tmpDir, { recursive: true, force: true });
    return;
  }

  const sql = [];
  let n = 0;

  for (const u of usersWithPhoto) {
    try {
      const r2Key = `avatars/${u._id}.jpg`;
      const newUrl = await uploadToR2(u.photoURL, r2Key);
      sql.push(`UPDATE users SET photo_url = ${q(newUrl)} WHERE id = ${q(u._id)};`);
      console.log(`  ✓ avatar @${u.username} → ${newUrl}`);
      n++;
    } catch (e) {
      console.log(`  ✗ avatar @${u.username}: ${e.message}`);
    }
  }

  for (const p of postsWithImg) {
    try {
      const newBlocks = [];
      let imgIdx = 0;
      for (const b of (p.blocks || [])) {
        if (b.type !== 'image') { newBlocks.push(b); continue; }
        const newUrls = [];
        for (const url of (b.urls || [])) {
          const r2Key = `posts/${p.authorUid}/${p._id}_backfill_${imgIdx++}.jpg`;
          newUrls.push(await uploadToR2(url, r2Key));
        }
        newBlocks.push({ ...b, urls: newUrls });
      }
      sql.push(`UPDATE posts SET blocks = ${q(JSON.stringify(newBlocks))} WHERE id = ${q(p._id)};`);
      console.log(`  ✓ post ${p._id} (${newBlocks.filter(b => b.type === 'image').reduce((s, b) => s + b.urls.length, 0)} şəkil)`);
      n++;
    } catch (e) {
      console.log(`  ✗ post ${p._id}: ${e.message}`);
    }
  }

  writeFileSync(new URL('./update.sql', import.meta.url), sql.join('\n') + '\n', 'utf8');
  console.log(`\n✅ ${n} obyekt R2-ə yükləndi. SQL: migration-cf/update.sql (${sql.length} UPDATE)`);
  console.log('   Tətbiq et: wrangler d1 execute collabix-db --remote --file migration-cf/update.sql');
  rmSync(tmpDir, { recursive: true, force: true });
}

main().catch(e => { console.error('XƏTA:', e.message); process.exit(1); });
