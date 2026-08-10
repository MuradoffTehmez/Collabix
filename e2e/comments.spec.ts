import { type Page } from '@playwright/test';
import { test, expect } from './auth-fixture';
import { collectConsoleErrors, assertConsoleClean, apiGet } from './helpers';
import { AUTH_FILE } from './seed';

// TASK-7 / Bənd 8 — LinkedIn üslublu rəylər (thread + reaksiya + sort + cascade sil).
// Səhifədaxili fetch ilə əsl server kod yolu işlədilir (Secure-cookie 401 problemi yoxdur).

async function apiSend(page: Page, path: string, method: string, body?: unknown) {
  return page.evaluate(async ({ p, m, b }) => {
    const r = await fetch(p, {
      method: m,
      headers: b ? { 'Content-Type': 'application/json' } : {},
      body: b ? JSON.stringify(b) : undefined,
    });
    let data: any = null;
    try { data = await r.json(); } catch { /* boş */ }
    return { status: r.status, ok: r.ok, data };
  }, { p: path, m: method, b: body });
}

async function bootApp(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/#home', { waitUntil: 'domcontentloaded' });
  // Sessiya yüklənməsini gözlə (feed poll-u işə düşən kimi API səhifədaxili işləyir).
  await expect(page.locator('#app')).toHaveClass(/active/);
}

test.describe('Rəylər (Bənd 8)', () => {

  test('thread + flatten + reaksiya + sort + redaktə + cascade sil', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);

    // Hədəf post yarat (API — əsl kod yolu).
    const created = await apiSend(page, '/api/posts', 'POST', {
      blocks: [{ type: 'text', content: 'E2E rəy hədəfi ' + Date.now() }], tags: [],
    });
    expect(created.ok, JSON.stringify(created)).toBeTruthy();
    const postId = created.data.post.id as string;

    // İki üst səviyyə rəy + bir cavab + cavaba-cavab (flatten yoxlaması).
    const A = await apiSend(page, `/api/posts/${postId}/comments`, 'POST', { text: 'AAA üst rəy' });
    const B = await apiSend(page, `/api/posts/${postId}/comments`, 'POST', { text: 'BBB üst rəy' });
    expect(A.ok && B.ok).toBeTruthy();
    const aId = A.data.id as string, bId = B.data.id as string;

    const R = await apiSend(page, `/api/posts/${postId}/comments`, 'POST', { text: 'A-ya cavab', parentId: aId });
    expect(R.ok).toBeTruthy();
    expect(R.data.parentId, 'cavab üst rəyə bağlanmalıdır').toBe(aId);

    /* 🔴 TEST KÖHNƏLMİŞDİ, KOD YOX.
     *   Burada əvvəl `parentId === aId` gözlənilirdi — yəni "cavaba cavab kökə
     *   flatten olunur". O qayda QƏSDƏN GÖTÜRÜLÜB (`worker/routes/post.ts` →
     *   `addComment` şərhi): flatten "A-ya cavab" ilə "A-nın cavabına cavab"
     *   arasındakı fərqi itirirdi və söhbət yastılaşırdı. İndi valideyn olduğu
     *   kimi saxlanılır, dərinlik isə sərbəstdir.
     *
     * ⚠ SAXLAMA və GÖSTƏRMƏ AYRIDIR: `parent_comment_id` ƏSL valideyni saxlayır,
     *   `listComments` isə bütün alt ağacı kökün altında YASTI siyahı kimi
     *   qaytarır (aşağıdakı `replies[aId]` yoxlaması buna baxır). Test hər iki
     *   qatı ayrıca yoxlayır — biri dəyişsə digəri onu örtməsin. */
    const deep = await apiSend(page, `/api/posts/${postId}/comments`, 'POST', { text: 'cavaba cavab', parentId: R.data.id });
    expect(deep.ok).toBeTruthy();
    expect(deep.data.parentId, 'dərin cavab ƏSL valideynini saxlamalıdır').toBe(R.data.id);

    // Reaksiya: A-nı bəyən.
    const likeRes = await apiSend(page, `/api/posts/${postId}/comments/${aId}/like`, 'PUT');
    expect(likeRes.ok).toBeTruthy();

    // Sıralama = ən yeni: B (daha yeni) əvvəl; A-nın 2 cavabı; A.likedByMe.
    const listNew = await apiGet(page, `/api/posts/${postId}/comments?sort=new&limit=20`);
    const dNew = JSON.parse(listNew.body);
    expect(dNew.total).toBe(2);
    expect(dNew.hasMore).toBe(false);
    expect(dNew.comments.map((c: any) => c.id)).toEqual([bId, aId]);
    /* ⚠ `replies` ƏSL valideyn üzrə qruplaşır, kök üzrə yox — flatten qaydası
     *   götürüldükdən sonra yuvalanma cavabda da görünür. Əvvəl bu sətir hər
     *   iki cavabı `replies[aId]` altında gözləyirdi; o, məhz silinmiş
     *   davranışın izi idi. */
    expect(dNew.replies[aId].map((r: any) => r.text)).toEqual(['A-ya cavab']);
    expect(dNew.replies[R.data.id].map((r: any) => r.text)).toEqual(['cavaba cavab']);
    const aNew = dNew.comments.find((c: any) => c.id === aId);
    expect(aNew.likedByMe).toBe(true);
    expect(aNew.likeCount).toBe(1);

    // Sıralama = ən çox bəyənilən: A (1 bəyənmə) B-dən (0) əvvəl.
    const listTop = await apiGet(page, `/api/posts/${postId}/comments?sort=top&limit=20`);
    const dTop = JSON.parse(listTop.body);
    expect(dTop.comments.map((c: any) => c.id)).toEqual([aId, bId]);

    // Redaktə: B mətnini dəyiş → editedAt qoyulur.
    const edit = await apiSend(page, `/api/posts/${postId}/comments/${bId}`, 'PATCH', { text: 'BBB düzəldildi' });
    expect(edit.ok).toBeTruthy();
    const afterEdit = JSON.parse((await apiGet(page, `/api/posts/${postId}/comments?sort=new`)).body);
    const bEdited = afterEdit.comments.find((c: any) => c.id === bId);
    expect(bEdited.text).toBe('BBB düzəldildi');
    expect(bEdited.editedAt).toBeTruthy();

    // Cascade sil: A silinəndə cavabları da silinir; commentCount uyğunlaşır.
    const del = await apiSend(page, `/api/posts/${postId}/comments/${aId}`, 'DELETE');
    expect(del.ok).toBeTruthy();
    const afterDel = JSON.parse((await apiGet(page, `/api/posts/${postId}/comments?sort=new`)).body);
    expect(afterDel.total).toBe(1);
    expect(afterDel.comments.map((c: any) => c.id)).toEqual([bId]);
    expect(afterDel.replies[aId]).toBeUndefined();

    const postAfter = JSON.parse((await apiGet(page, `/api/posts/${postId}`)).body);
    expect(postAfter.post.commentCount).toBe(1);   // 4 yaradıldı, A+2 cavab silindi → yalnız B

    assertConsoleClean(errors);
  });

  test('post detalında rəy thread UI mount olur', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    const created = await apiSend(page, '/api/posts', 'POST', {
      blocks: [{ type: 'text', content: 'UI rəy postu ' + Date.now() }], tags: [],
    });
    const postId = created.data.post.id as string;

    await page.goto('/post/' + postId, { waitUntil: 'domcontentloaded' });
    /* ⚠ SEÇİCİLƏR KÖHNƏLMİŞDİ, UI YOX.
     *   `.comment-input-row` artıq qurulmur — rəy kompozitoru tək sətirlik
     *   `input`-dan çoxsətirli `textarea`-ya keçdi (`.c-composer-row`), çünki
     *   şərhlər Markdown dəstəkləyir. Sıralama düymələri isə ikidən dördə
     *   çıxdı: new · old · top · replies.
     *   CSS-də `.comment-input-row` qaydası hələ qalır — o, O-05-in "ölü sinif"
     *   siyahısına aiddir, bu testin işi deyil. */
    await expect(page.locator('#postDetail .c-composer-row')).toBeVisible();
    await expect(page.locator('#postDetail .comment-sortbar .csort')).toHaveCount(4);
    assertConsoleClean(errors);
  });
});
