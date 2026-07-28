// Gecikmə ölçməsi — AUDIT-TASK-7 §7.3 / meyar 20 (p95 artımı < 30 ms).
//
// ⚠ ADİ DƏSTDƏ İŞLƏMİR: `PERF=1` olmadan skip edilir. Vaxt ölçən test CI-da
// flaky olur (maşın yükü nəticəni dəyişir) və dəstə 30 s əlavə edir. İcra:
//     PERF=1 npx playwright test _perf-files --project=desktop
//
// METODOLOGİYA: `canReadKey` publik prefikslərdə (`posts/`, `avatars/`) HEÇ BİR
// I/O əlavə etmir — yalnız sətir müqayisələri. Yəni `posts/` bu günkü ölçüsü
// düzəlişdən ƏVVƏLKİ vəziyyətin ekvivalentidir. `teams/` isə üstünə üzvlük
// yoxlamasını (KV oxusu, miss halında + D1 sorğusu) əlavə edir.
// Artım = p95(teams) − p95(posts).
import { test, expect, type Page } from '@playwright/test';
import { AUTH_FILE } from './seed';
import { E2E_TEAM } from './fixtures';

test.use({ storageState: AUTH_FILE });

const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function uploadPng(page: Page, query: string, name: string) {
  return page.evaluate(async ([q, b64, fname]) => {
    const bin = atob(b64 as string);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const fd = new FormData();
    fd.append('file', new File([bytes], fname as string, { type: 'image/png' }));
    const r = await fetch(`/api/upload?${q}`, { method: 'POST', body: fd });
    return { status: r.status, body: await r.json() };
  }, [query, PNG_B64, name] as const);
}

/**
 * ⚠ NÖVBƏLƏŞDİRİLMİŞ (interleaved) ölçmə. Prefiksləri ARDICIL ölçmək səhv
 * nəticə verir: dev serverinin istiliyi, GC və maşın yükü zamanla sürüşür və
 * sürüşmə fərq kimi görünür (ilk cəhddə `posts/` p95-i 35 → 66 ms dəyişdi,
 * halbuki kod eyni idi). Hər turda hər prefiksə bir sorğu gedir → sürüşmə
 * hamısına eyni təsir edir və çıxılanda yox olur.
 */
async function benchAll(page: Page, urls: Record<string, string>, n: number) {
  return page.evaluate(async ([map, count]) => {
    const names = Object.keys(map as Record<string, string>);
    const times: Record<string, number[]> = {};
    for (const k of names) times[k] = [];
    for (let i = 0; i < (count as number); i++) {
      for (const k of names) {
        const t0 = performance.now();
        // `cache: 'no-store'` — brauzer keşi ölçünü yalançı sıfıra endirməsin.
        const r = await fetch((map as Record<string, string>)[k], { cache: 'no-store' });
        await r.arrayBuffer();
        times[k].push(performance.now() - t0);
      }
    }
    const out: Record<string, { n: number; p50: number; p95: number; max: number }> = {};
    for (const k of names) {
      const t = times[k].sort((a, b) => a - b);
      const q = (p: number) => t[Math.min(t.length - 1, Math.floor(t.length * p))];
      out[k] = { n: t.length, p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +t[t.length - 1].toFixed(2) };
    }
    return out;
  }, [urls, n] as const);
}

test('ÖLÇMƏ: /files/ gecikməsi prefiks üzrə', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'ölçmə bir dəfə');
  test.skip(!process.env.PERF, 'Ölçmə testi — yalnız PERF=1 ilə işləyir');
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/#home', { waitUntil: 'networkidle' });

  const postUp = await uploadPng(page, 'kind=post', 'perf-post.png');
  const teamUp = await uploadPng(page, `kind=team&teamId=${E2E_TEAM.id}&category=documents`, 'perf-team.png');
  const msgUp = await uploadPng(page, 'kind=msg', 'perf-msg.png');
  expect(postUp.status).toBe(200);
  expect(teamUp.status).toBe(200);
  expect(msgUp.status).toBe(200);

  const urls = { posts: postUp.body.url, teams: teamUp.body.url, msgfiles: msgUp.body.url };
  const N = 80;
  // İstiləşdirmə — ilk sorğular R2/KV bağlantısını qurur, ölçüyə düşməsin.
  await benchAll(page, urls, 8);

  const r = await benchAll(page, urls, N);
  console.log('\n=== /files/ ÖLÇMƏ (növbələşdirilmiş, n=' + N + ' hər prefiks) ===');
  console.log('posts/    (sürətli yol, I/O YOX) ', JSON.stringify(r.posts));
  console.log('msgfiles/ (sahiblik, I/O YOX)    ', JSON.stringify(r.msgfiles));
  console.log('teams/    (üzvlük, KV keşi)      ', JSON.stringify(r.teams));
  console.log('p50 ARTIM (teams − posts)    =', (r.teams.p50 - r.posts.p50).toFixed(2), 'ms');
  console.log('p95 ARTIM (teams − posts)    =', (r.teams.p95 - r.posts.p95).toFixed(2), 'ms');
  console.log('p50 ARTIM (msgfiles − posts) =', (r.msgfiles.p50 - r.posts.p50).toFixed(2), 'ms');
  console.log('p95 ARTIM (msgfiles − posts) =', (r.msgfiles.p95 - r.posts.p95).toFixed(2), 'ms');
});
