// Post və şərh domeni — AUDIT-TASK-10 / Faza 3.1.
//
// Feed, post CRUD, re-post/quote, bəyənmə, əlfəcin və şərh axını.
//
// ⚠ ŞƏKİL İSTİNADI QORUMASI (AUDIT C-1) bu moduldadır: `normalizeFileRef`,
//   `collectImageRefs`, `assertOwnedImageRefs`, `clampBlockRefs`,
//   `clampImageKeys`. Onlar YALNIZ post yolunda mənalıdır — `upload.ts`-dəki
//   `canReadKey` isə OXU qapısıdır. İkisi ayrı qatlardır (dərinlikdə müdafiə).
//
// 🔴 SAF REFAKTOR: gövdə və şərhlər olduğu kimi köçürülüb (§11.2, §11.5).
import {
  Ctx, json, err, readJson, uuid, now, clampStr, fromJSON,
  mapPost, chunkForD1, placeholders,
} from '../util';
import { grantXp, compensateXp } from '../xp';
import { grantReputation, evaluateProgression } from '../progression';
import { QueueService } from '../services/queue';
import {
  D, badReq, notify, notifyMentions, bumpActivity, bumpProgress, deleteR2Keys,
  POST_BLOCKS_MAX_BYTES, POST_XP, ORIGINAL_POST_XP, COMMENT_XP,
  REPOST_XP, LIKE_RECEIVED_XP,
} from './shared';

/* ================= POSTS ================= */

/**
 * Post şəkil istinadının normallaşdırılması — AUDIT C-1 / zəncirin 1-ci addımı.
 *
 * Eyni R2 açarı client-dən üç formada gələ bilər:
 *   `/files/posts/x/y`, `posts/x/y`, `https://<domen>/files/posts/x/y`
 * Yoxlama xam sətrə baxsaydı, hücumçu sadəcə formanı dəyişib yan keçərdi.
 * Tanınmayan forma (data:, xarici domen) boş sətrə düşür və yoxlamada rədd olunur.
 */
function normalizeFileRef(raw: unknown, ownHost: string): string {
  let v = String(raw ?? '').trim();
  if (!v) return '';
  // Mütləq URL → yalnız ÖZ host-umuz qəbul olunur (sorğunun gəldiyi host).
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      if (u.host !== ownHost) return '';
      v = u.pathname;
    } catch { return ''; }
  }
  if (v.startsWith('/files/')) v = v.slice('/files/'.length);
  // Traversal və protokol-nisbi (`//evil.com/...`) formalar birbaşa rədd.
  if (!v || v.startsWith('/') || v.includes('..') || v.includes('//')) return '';
  return v;
}

/**
 * Post şəkil mənbələrinin sahiblik yoxlaması — AUDIT C-1 / zəncirin 1-ci addımı.
 *
 * ƏVVƏL: `blocks` verbatim, `imageKeys` isə `toJSON(b.imageKeys, '[]')` ilə XAM
 * saxlanılırdı. Hücumçu `blocks:[{type:'image',urls:['/files/teams/<yad>/…']}]`
 * göndərib QLOBAL FEED-də yad komandanın məxfi sənədini göstərə bilirdi — feed-i
 * açan hər kəsin brauzeri faylı çəkirdi.
 *
 * ⚠ Bu, `canReadKey`-in ƏVƏZİ deyil, ONA ƏLAVƏDİR (dərinlikdə müdafiə):
 * `canReadKey` oxunu bağlayır, bu yoxlama isə istinadın ilk növbədə
 * yaradılmasının qarşısını alır (feed-də sınıq şəkil görünməsin).
 *
 * Qayda: post yalnız MÜƏLLİFİN öz yüklədiyi şəkilləri göstərə bilər →
 * `posts/{uid}/…`. Xarici URL-lərə icazə verilmir; CSP `img-src 'self'` onsuz da
 * bloklayırdı, indi server də aydın xəta ilə rədd edir.
 */
function collectImageRefs(blocks: any[], imageKeys: unknown): string[] {
  const refs: string[] = [];
  // Bütün blok növləri gəzilir, yalnız `image` deyil: gələcəkdə `video`/`file`
  // bloku əlavə edilsə də URL sahələri bu siyahıya avtomatik düşsün.
  //
  // ⚠ BURADA KƏSMƏ YOXDUR — girişlər `clampBlockRefs`/`clampImageKeys` ilə
  // ARTIQ kəsilmiş gəlir. Bax həmin funksiyaların şərhi (AUDIT-TASK-9 / D-1).
  for (const b of Array.isArray(blocks) ? blocks : []) {
    if (!b || typeof b !== 'object') continue;
    if (Array.isArray(b.urls)) refs.push(...b.urls.map(String));
    if (typeof b.url === 'string') refs.push(b.url);
    if (typeof b.src === 'string') refs.push(b.src);
  }
  if (Array.isArray(imageKeys)) refs.push(...imageKeys.map(String));
  return refs;
}

/**
 * 🔴 AUDIT-TASK-9 / D-1 — YOXLANILAN sərhəd = SAXLANILAN sərhəd.
 *
 * Əvvəl `collectImageRefs` yalnız ilk 30 `imageKeys`-i və blok başına ilk 20
 * `urls`-i yoxlayırdı, `createPost` isə `toJSON(b.imageKeys)` ilə XAM massivi
 * saxlayırdı. Nəticə: 31-ci açardan sonrakı istinadlar `assertOwnedImageRefs`
 * yoxlamasından TAMAMİLƏ yan keçib bazaya düşürdü — yəni AUDIT C-1-in bağladığı
 * zəncirin 1-ci addımı 30-dan çox şəkilli postda yenidən açıq idi.
 *
 * Bu, Task 8 §7.b ilə eyni sinifdir: sərhəd bir yerdə var, digərində yoxdur və
 * fərq yalnız limit ÜSTÜ data ilə görünür. Kəsmə indi saxlamadan ƏVVƏL edilir.
 */
const REF_URLS_PER_BLOCK = 20;
const REF_IMAGE_KEYS = 30;

const clampBlockRefs = (blocks: any[]): any[] => blocks.map(blk => (
  blk && typeof blk === 'object' && Array.isArray(blk.urls)
    ? { ...blk, urls: blk.urls.slice(0, REF_URLS_PER_BLOCK).map(String) }
    : blk
));

/**
 * Postun TAM mətni — FTS indeksi üçün (AUDIT-TASK-10 / Faza 5/#4).
 *
 * ⚠ `posts.text` ÖNİZLƏMƏDİR (300 simvol) və feed kartında göstərilir; onu
 *   uzatmaq görünüşü pozardı. Axtarış isə bütün gövdəni görməlidir, ona görə
 *   ayrıca `search_text` sütunu var.
 *
 * ⚠ Tavan 20 000 simvol: `POST_BLOCKS_MAX_BYTES` (64 KB) onsuz da gövdəni
 *   məhdudlaşdırır, lakin FTS sətrinin özü də sərhədsiz böyüməməlidir.
 */
const buildSearchText = (blocks: any[]): string =>
  blocks
    .map(b => (b && typeof b === 'object' && typeof b.content === 'string' ? b.content : ''))
    .filter(Boolean)
    .join(' ')
    .slice(0, 20_000);

const clampImageKeys = (v: unknown): string[] =>
  Array.isArray(v) ? v.slice(0, REF_IMAGE_KEYS).map(String) : [];

/**
 * `ownerUid` = postun MÜƏLLİFİ, redaktə edən şəxs yox. Admin başqasının postunu
 * redaktə edəndə (`patchPost`) müəllifin öz şəkilləri qanunidir — yoxlamanı
 * redaktorun uid-inə bağlasaq admin hər redaktəsində postun şəkillərini sındırardı.
 */
function assertOwnedImageRefs(c: Ctx, refs: string[], ownerUid: string): Response | null {
  const own = `posts/${ownerUid}/`;
  for (const raw of refs) {
    const key = normalizeFileRef(raw, c.url.host);
    if (!key || !key.startsWith(own)) {
      return err('Post yalnız öz yüklədiyiniz şəkilləri göstərə bilər.', 400, 'invalid_image_ref');
    }
  }
  return null;
}
/**
 * AUDIT M-10 — bloklanmış istifadəçinin postları feed-də QALIRDI, halbuki
 * `publicGetPost` onları 404 ilə gizlədirdi. Daxili ziddiyyət: eyni post
 * birbaşa linkdə "yoxdur", feed-də isə görünürdü.
 * `JOIN users … WHERE blocked = 0` hər iki yolu eyniləşdirir.
 * (İndeks: `idx_users_blocked` — bax D-4.)
 */
/**
 * Feed — KEYSET (cursor) paginasiyası. AUDIT-TASK-10 / Faza 5/#1.
 *
 * ƏVVƏL: `LIMIT 60`, cursor YOX. Yəni 60-dan köhnə post İSTİFADƏÇİ ÜÇÜN
 * MÖVCUD DEYİLDİ — feed məzmunu sükutla itirdi.
 *
 * ⚠ NİYƏ KEYSET, NİYƏ OFFSET: `OFFSET` böyüdükcə D1 atlanan sətirləri yenə
 *   oxuyur (O(n)), üstəlik yeni post gələndə səhifələr SÜRÜŞÜR və istifadəçi
 *   eyni postu iki dəfə görür. Layihə `adminLogs` və `usersDirectory`-də
 *   onsuz da keyset işlədir — eyni naxış davam etdirilir.
 *
 * ⚠ KURSOR `(created_at, id)` CÜTÜDÜR, təkcə `created_at` deyil: eyni
 *   millisaniyədə yaradılmış iki post sərhəddə İTƏ və ya TƏKRARLANA bilərdi.
 */
export async function feed(c: Ctx) {
  const limit = Math.min(Math.max(parseInt(c.url.searchParams.get('limit') || '60', 10) || 60, 5), 100);
  const cursor = c.url.searchParams.get('cursor');   // "<created_at>_<id>"
  let after: { ts: number; id: string } | null = null;
  if (cursor) {
    const i = cursor.lastIndexOf('_');
    const ts = Number(cursor.slice(0, i));
    if (i > 0 && Number.isFinite(ts)) after = { ts, id: cursor.slice(i + 1) };
  }

  const where = after
    ? 'WHERE u.blocked = 0 AND (p.created_at < ?1 OR (p.created_at = ?1 AND p.id < ?2))'
    : 'WHERE u.blocked = 0';
  const query = `
    SELECT p.*,
           s.id AS s_id, s.author_id AS s_author_id, s.author_name AS s_author_name,
           s.blocks AS s_blocks, s.image_keys AS s_image_keys,
           s.text AS s_text, s.tags AS s_tags, s.created_at AS s_created_at
    FROM posts p
    JOIN users u ON p.author_id = u.id
    LEFT JOIN posts s ON p.shared_post_id = s.id
    ${where}
    ORDER BY p.created_at DESC, p.id DESC LIMIT ${limit + 1}
  `;
  const stmt = after
    ? D(c).prepare(query).bind(after.ts, after.id)
    : D(c).prepare(query);
  const rows = await stmt.all<any>();

  // `limit + 1` çəkilir ki, "daha var?" sualı ƏLAVƏ SORĞU olmadan cavablansın.
  const hasMore = rows.results.length > limit;
  const page = rows.results.slice(0, limit);
  const last = page[page.length - 1];
  const [reactMine, reactAgg] = await loadPostReactions(c, page.map(r => r.id as string));
  return json({
    posts: page.map(r => mapPost(r, reactMine, reactAgg)),
    hasMore,
    nextCursor: hasMore && last ? `${last.created_at}_${last.id}` : null,
  });
}

/**
 * Post reaksiyalarını toplu oxuyur (N+1 sorğudan qaçmaq üçün).
 * @returns [mənimkilər, tip üzrə saylar]
 *
 * ⚠ `chunkForD1` MƏCBURİDİR: feed 100 posta qədər qaytara bilər, D1-in
 *   bir sorğuda bağlana bilən dəyişən limiti isə 100-dür. `reserved: 1`
 *   variantında `user_id = ?` əlavə bir yer tutur.
 */
async function loadPostReactions(c: Ctx, ids: string[]) {
  const mine = new Map<string, string>();
  const agg = new Map<string, Record<string, number>>();
  if (!ids.length) return [mine, agg] as const;
  for (const chunk of chunkForD1(ids, 1)) {
    const r = await D(c).prepare(
      `SELECT post_id, type FROM post_reactions
        WHERE user_id = ? AND post_id IN (${placeholders(chunk.length)})`,
    ).bind(c.user!.id, ...chunk).all<any>();
    for (const row of r.results) mine.set(row.post_id as string, row.type as string);
  }
  for (const chunk of chunkForD1(ids)) {
    const r = await D(c).prepare(
      `SELECT post_id, type, COUNT(*) AS n FROM post_reactions
        WHERE post_id IN (${placeholders(chunk.length)}) GROUP BY post_id, type`,
    ).bind(...chunk).all<any>();
    for (const row of r.results) {
      const b = agg.get(row.post_id as string) || {};
      b[row.type as string] = row.n as number;
      agg.set(row.post_id as string, b);
    }
  }
  return [mine, agg] as const;
}

export async function getPost(c: Ctx, id: string) {
  const query = `
    SELECT p.*,
           s.id AS s_id, s.author_id AS s_author_id, s.author_name AS s_author_name,
           s.blocks AS s_blocks, s.image_keys AS s_image_keys,
           s.text AS s_text, s.tags AS s_tags, s.created_at AS s_created_at
    FROM posts p
    LEFT JOIN posts s ON p.shared_post_id = s.id
    WHERE p.id = ?
  `;
  const row = await D(c).prepare(query).bind(id).first();
  if (!row) return err('Post tapılmadı.', 404);
  const [reactMine, reactAgg] = await loadPostReactions(c, [id]);
  return json({ post: mapPost(row, reactMine, reactAgg) });
}

export async function createPost(c: Ctx) {
  const b = await readJson(c.req);
  // AUDIT M-5 — `blocks` JSON-u ölçü limiti OLMADAN saxlanılırdı: blok sayı
  // 20-yə kəsilirdi, lakin BİR blokun məzmunu istənilən uzunluqda ola bilərdi
  // → D1 sətrinin şişməsi, storage DoS.
  //
  // İki qatlı tavan: hər blok üçün 5000 simvol, sonra ÜMUMİ JSON üçün 64 KB.
  // Ümumi tavan blok sayına deyil, `JSON.stringify(...).length`-ə baxır —
  // 20 × 5000 = 100 KB hələ də D1 sətri üçün çoxdur.
  const blocks = Array.isArray(b.blocks)
    ? clampBlockRefs(b.blocks.slice(0, 20).map((blk: any) => (
      blk && typeof blk === 'object' && typeof blk.content === 'string'
        ? { ...blk, content: clampStr(blk.content, 5000) }
        : blk
    )))
    : [];
  // D-1: yoxlanılan massivin EYNİSİ saxlanılır (bax `clampImageKeys`).
  const imageKeys = clampImageKeys(b.imageKeys);
  if (JSON.stringify(blocks).length > POST_BLOCKS_MAX_BYTES) {
    return err('Post həddindən artıq böyükdür.', 400, 'payload_too_large');
  }
  // AUDIT C-1 — istismar zəncirinin 1-ci addımı burada kəsilir (bax
  // `assertOwnedImageRefs`). `imageKeys` VƏ `blocks[].urls` birlikdə yoxlanılır:
  // birini qoruyub digərini açıq qoymaq zənciri bağlamazdı.
  const refDenied = assertOwnedImageRefs(c, collectImageRefs(blocks, imageKeys), c.user!.id);
  if (refDenied) return refDenied;
  let sharedPostId = b.sharedPostId ? clampStr(b.sharedPostId, 50) : null;
  if (sharedPostId) {
    // İçiçə re-postların qarşısını al: hədəf özü də re-post-dursa, ən orijinal posta düzəlt (flatten-to-root).
    const target = await D(c).prepare('SELECT shared_post_id FROM posts WHERE id = ?').bind(sharedPostId).first<any>();
    if (!target) return err('Orijinal post tapılmadı.', 404);
    if (target?.shared_post_id) sharedPostId = target.shared_post_id;
  }
  // Birbaşa re-post (mətnsiz) artıq toggle endpoint-dən keçir → burada yalnız quote (öz mətni ilə).
  if (sharedPostId && !blocks.length) return badReq('Birbaşa re-post üçün /repost istifadə edin.');
  if (!blocks.length && !sharedPostId) return badReq('Post boş ola bilməz.');
  const postType = sharedPostId ? 'quote' : 'original';
  const tags: string[] = Array.isArray(b.tags) ? b.tags.slice(0, 12).map((t: unknown) => clampStr(t, 30)) : [];
  const firstText = (blocks.find((x: any) => x.type === 'text') || {}).content || '';
  const quoteText = postType === 'quote' ? clampStr(firstText, 500) : null;
  const id = uuid();
  await D(c).prepare(
    'INSERT INTO posts (id, author_id, author_name, blocks, image_keys, text, tags, created_at, shared_post_id, post_type, quote_text, search_text) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
  ).bind(id, c.user!.id, c.user!.name, JSON.stringify(blocks),
    JSON.stringify(imageKeys), clampStr(firstText, 300), JSON.stringify(tags), now(), sharedPostId, postType, quoteText,
    buildSearchText(blocks)).run();
  // H-5: XP idempotent + gündəlik tavanlı verilir. Tavana çatanda post YENƏ DƏ
  // yaradılır — yalnız XP verilmir (audit §B-3: "əməliyyat uğurlu olsun").
  //
  // AUDIT-TASK-10 / D-6.b — PRD §6 İKİ AYRI SƏTİR sayır:
  //   "Paylaşım +10"          → sitat/paylaşım (başqasının məzmununa söykənir)
  //   "Orijinal paylaşım +15" → istifadəçinin öz məzmunu
  // Ayrım `sharedPostId`-dədir: dolu olsa post başqa posta istinad edir.
  //
  // ⚠ Mənbə hər iki halda `post`-dur (ayrı `XpSource` DEYİL) — əks halda
  //   gündəlik tavan ikiyə bölünər və istifadəçi 10 orijinal + 10 sitat
  //   yazmaqla büdcəni iki qat aşardı.
  const isOriginal = !sharedPostId;
  const xpGrant = await grantXp(
    c.env, c.user!.id, 'post', id, isOriginal ? ORIGINAL_POST_XP : POST_XP);
  // FAZA A2 — nişan/nailiyyət mühərriki. `waitUntil`: qiymətləndirmə post
  // yaratma cavabını GECİKDİRMƏMƏLİDİR.
  c.ctx.waitUntil(evaluateProgression(c.env, c.user!.id).then(() => {}));
  await bumpActivity(c);
  for (const t of tags) await bumpProgress(c, c.user!.id, t, 'posts');
  // ⚡ FAN-OUT NÖVBƏYƏ (TASK-8 / Bənd 18).
  //
  // Əvvəl @mention bildirişləri MƏHZ BURADA, sorğunun içində göndərilirdi:
  // 20 nəfər qeyd edilmiş postda 20+ ardıcıl D1 yazısı — istifadəçi "Paylaş"
  // düyməsindən sonra hamısını gözləyirdi. İndi post yazılan kimi cavab
  // qayıdır, bildirişlər isə arxada işlənir.
  //
  // `enqueue` növbə yoxdursa işi SİNXRON icra edir → funksionallıq itmir.
  const mentionText = blocks.map((x: any) => x.content || '').join(' ');
  const queueService = new QueueService(c.env);
  c.ctx.waitUntil(Promise.all([
    queueService.publish({
      type: 'MentionFanout', fromId: c.user!.id, fromName: c.user!.name,
      text: mentionText, label: 'səni paylaşımda qeyd etdi', postId: id,
    }),
    queueService.publish({
      type: 'PostCreated', postId: id, authorId: c.user!.id,
      authorName: c.user!.name, text: clampStr(mentionText, 120),
    }),
  ]));

  if (sharedPostId) {
    await D(c).prepare('UPDATE posts SET share_count = share_count + 1 WHERE id = ?').bind(sharedPostId).run();
    const orig = await D(c).prepare('SELECT author_id FROM posts WHERE id = ?').bind(sharedPostId).first<any>();
    if (orig) await notify(c, orig.author_id, 'repost', 'paylaşımını sitat gətirdi', sharedPostId);
  }

  const query = `
    SELECT p.*,
           s.id AS s_id, s.author_id AS s_author_id, s.author_name AS s_author_name,
           s.blocks AS s_blocks, s.image_keys AS s_image_keys,
           s.text AS s_text, s.tags AS s_tags, s.created_at AS s_created_at
    FROM posts p
    LEFT JOIN posts s ON p.shared_post_id = s.id
    WHERE p.id = ?
  `;
  const row = await D(c).prepare(query).bind(id).first();
  // `xpCapped` — UI "Bugünkü XP limitinə çatdınız" bildirişi üçün (3 dildə).
  return json({ post: mapPost(row), xpCapped: xpGrant.reason === 'daily_cap' });
}

export async function patchPost(c: Ctx, id: string) {
  const row = await D(c).prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<any>();
  if (!row) return err('Post tapılmadı.', 404);
  if (row.author_id !== c.user!.id && !c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  const b = await readJson(c.req);
  const blocks = Array.isArray(b.blocks)
    ? clampBlockRefs(b.blocks.slice(0, 20))   // D-1: yoxlanılan = saxlanılan
    : fromJSON<any[]>(row.blocks, []);
  // AUDIT C-1 — redaktə yolu da yoxlanılır. Yalnız `createPost`-u qorusaydıq
  // hücumçu boş post yaradıb dərhal PATCH ilə məxfi açarı yerləşdirərdi.
  // Yoxlama YALNIZ client yeni bloklar göndərəndə işləyir: mövcud sətrin öz
  // blokları (`fromJSON(row.blocks)`) müəllifin köhnə, qanuni məzmunudur.
  if (Array.isArray(b.blocks)) {
    const refDenied = assertOwnedImageRefs(c, collectImageRefs(blocks, null), String(row.author_id));
    if (refDenied) return refDenied;
  }
  const firstText = (blocks.find((x: any) => x.type === 'text') || {}).content || b.text || '';

  // AUDIT-TASK-10 / Faza 5/#7 — `imageKeys` və `tags` ƏVVƏL YENİLƏNMİRDİ.
  //
  // Nəticə: istifadəçi postdan şəkil silsə və ya teq dəyişsə, dəyişiklik
  // `blocks`-da görünürdü, lakin `image_keys` və `tags` sütunları KÖHNƏ
  // qalırdı. Bu, iki real problem yaradırdı:
  //   • `deletePost` silinən şəkilləri R2-dən təmizləyəndə ARTIQ İSTİFADƏ
  //     OLUNMAYAN açarları silirdi, YENİLƏRİ isə yetim qoyurdu
  //   • teq axtarışı (`posts_fts.tags`) köhnə teqlərlə cavab verirdi
  //
  // ⚠ Sahələr YALNIZ client onları GÖNDƏRƏNDƏ yenilənir: `PATCH` qismidir və
  //   göndərilməyən sahə toxunulmamalıdır (əks halda yalnız mətn redaktə edən
  //   client bütün şəkilləri silərdi).
  const sets = ['blocks = ?', 'text = ?', 'edited_at = ?', 'search_text = ?'];
  const vals: unknown[] = [
    JSON.stringify(blocks), clampStr(firstText, 300), now(), buildSearchText(blocks),
  ];
  if (Array.isArray(b.imageKeys)) {
    const keys = clampImageKeys(b.imageKeys);
    // C-1: yeni açarlar da SAHİBLİK yoxlamasından keçməlidir.
    const denied = assertOwnedImageRefs(c, keys, String(row.author_id));
    if (denied) return denied;
    sets.push('image_keys = ?'); vals.push(JSON.stringify(keys));
  }
  if (Array.isArray(b.tags)) {
    const tags = b.tags.slice(0, 12).map((t: unknown) => clampStr(t, 30));
    sets.push('tags = ?'); vals.push(JSON.stringify(tags));
  }
  vals.push(id);
  await D(c).prepare(`UPDATE posts SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  return json({ ok: true });
}

export async function deletePost(c: Ctx, id: string) {
  const row = await D(c).prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<any>();
  // ⚠ Tapılmayanda 404 qaytarılır, `{ok:true}` DEYİL. Səssiz 200 real bir bug-ı
  // gizlədirdi: müştəri `/api/posts/undefined`-ə sorğu göndərirdi, server "oldu"
  // deyirdi, UI "silindi" toast-ı göstərirdi, post isə yerində qalırdı
  // (TASK-7 / Bənd 1). İdempotentlik müştəri tərəfdə saxlanılır: 404 = "artıq yoxdur".
  if (!row) return err('Post tapılmadı.', 404);
  if (row.author_id !== c.user!.id && !c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  const keys = fromJSON<string[]>(row.image_keys, []);
  await deleteR2Keys(c, keys);
  // Cascade (Cloud-Function trigger ekvivalenti), atomik batch. D1-də
  // `PRAGMA foreign_keys` zəmanətli deyil, `bookmarks`/`notifications`-da isə
  // FK ümumiyyətlə yoxdur — ona görə asılılar burada AÇIQ təmizlənir.
  const stmts = [
    D(c).prepare('DELETE FROM posts WHERE id = ?').bind(id),
    // orijinal müəllifin öz postu → ona istinad edən repost/quote-lar "silinib"
    // soft-mark olunur (quote öz mətnini saxlayır).
    D(c).prepare('UPDATE posts SET original_deleted = 1 WHERE shared_post_id = ?').bind(id),
    D(c).prepare('DELETE FROM post_shares WHERE post_id = ? OR repost_id = ?').bind(id, id),
    D(c).prepare('DELETE FROM comments WHERE post_id = ?').bind(id),
    D(c).prepare('DELETE FROM likes WHERE post_id = ?').bind(id),
    D(c).prepare('DELETE FROM bookmarks WHERE post_id = ?').bind(id),
    D(c).prepare('DELETE FROM notifications WHERE post_id = ?').bind(id),
  ];
  if (row.shared_post_id) {
    stmts.push(D(c).prepare('UPDATE posts SET share_count = MAX(0, share_count - 1) WHERE id = ?').bind(row.shared_post_id));
  }
  await D(c).batch(stmts);
  // 🔴 H-5 #3 — istismarın ƏSAS dövrəsi burada bağlanır: yarat (+10) → sil →
  // təkrarla. Kompensasiya YALNIZ uyğun `xp_logs` sətri varsa işləyir və
  // məbləği mövcud XP ilə clamp edir → Task 6-nın `users_xp_nonneg` trigger-i
  // TETİKLƏNMİR (bax xp.ts `compensateXp` üç qatlı müdafiə).
  //
  // ⚠ Batch-dən SONRA və `waitUntil`-siz: XP geri alınmadan cavab qaytarsaq,
  //   sürətli yarat-sil dövrəsi kompensasiyanı qabaqlaya bilərdi.
  await compensateXp(c.env, String(row.author_id), 'post', id);
  return json({ ok: true });
}

// Birbaşa re-post — idempotent toggle (repost / undo-repost). Cloud-Function trigger yerinə
// share_count-u atomik batch-də saxlayır; post_shares kompozit-PK ilə dublikat qarşılanmır.
export async function toggleRepost(c: Ctx, id: string) {
  const target = await D(c).prepare('SELECT id, author_id, shared_post_id FROM posts WHERE id = ?').bind(id).first<any>();
  if (!target) return err('Post tapılmadı.', 404);
  // flatten-to-root: re-post-un re-post-u həmişə kök orijinala istinad edir
  const rootId = target.shared_post_id || id;
  const root = target.shared_post_id
    ? await D(c).prepare('SELECT id, author_id FROM posts WHERE id = ?').bind(rootId).first<any>()
    : target;
  if (!root) return err('Post tapılmadı.', 404);
  if (root.author_id === c.user!.id) return err('Öz paylaşımını re-post edə bilməzsən.', 400);

  const existing = await D(c).prepare('SELECT repost_id FROM post_shares WHERE user_id = ? AND post_id = ?')
    .bind(c.user!.id, rootId).first<any>();
  if (existing) {
    // undo-repost
    await D(c).batch([
      D(c).prepare('DELETE FROM posts WHERE id = ?').bind(existing.repost_id),
      D(c).prepare('DELETE FROM post_shares WHERE user_id = ? AND post_id = ?').bind(c.user!.id, rootId),
      D(c).prepare('UPDATE posts SET share_count = MAX(0, share_count - 1) WHERE id = ?').bind(rootId),
    ]);
    return json({ reposted: false });
  }
  const newId = uuid();
  await D(c).batch([
    D(c).prepare('INSERT INTO posts (id, author_id, author_name, blocks, image_keys, text, tags, created_at, shared_post_id, post_type) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(newId, c.user!.id, c.user!.name, '[]', '[]', '', '[]', now(), rootId, 'repost'),
    D(c).prepare('INSERT INTO post_shares (user_id, post_id, repost_id, created_at) VALUES (?,?,?,?)')
      .bind(c.user!.id, rootId, newId, now()),
    D(c).prepare('UPDATE posts SET share_count = share_count + 1 WHERE id = ?').bind(rootId),
  ]);
  await notify(c, root.author_id, 'repost', 'paylaşımını re-post etdi', rootId);
  // AUDIT-TASK-10 / D-6.b — PRD §6: "Repost +3". XP RE-POST EDƏNƏ verilir.
  //
  // ⚠ `refId = rootId` (kök post) — `newId` DEYİL. Səbəb: `newId` hər toggle-da
  //   yenidir, yəni repost→undo→repost dövrəsi hər dəfə yeni açar yaradar və
  //   UNIQUE indeksi keçərdi → sonsuz XP fabriki. Kök id sabitdir, ona görə
  //   eyni postu neçə dəfə re-post etsən də XP BİR DƏFƏ verilir.
  //
  // ⚠ Öz postunu re-post etmək yuxarıda (satır 410) onsuz da qadağandır.
  await grantXp(c.env, c.user!.id, 'repost', rootId, REPOST_XP);
  return json({ reposted: true, id: newId });
}

export async function likePut(c: Ctx, id: string) {
  const post = await D(c).prepare('SELECT author_id FROM posts WHERE id = ?').bind(id).first<any>();
  if (!post) return err('Post tapılmadı.', 404);
  const r = await D(c).prepare('INSERT OR IGNORE INTO likes (post_id, user_id, created_at) VALUES (?,?,?)')
    .bind(id, c.user!.id, now()).run();
  if (r.meta.changes > 0) {
    await D(c).prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?').bind(id).run();
    await notify(c, post.author_id, 'like', 'paylaşımını bəyəndi', id);
    // FAZA A2 / PRD §8 — "Like" reputasiya mənbəyidir.
    //
    // ⚠ `refId` = `${postId}:${bəyənən}` — idempotentlik açarı. Eyni istifadəçi
    //   bəyənib-geri götürüb yenidən bəyənsə reputasiya BİR DƏFƏ verilir;
    //   əks halda bu, sonsuz reputasiya fabriki olardı (AUDIT-TASK-9 / H-5-in
    //   XP üçün bağladığı eyni istismar sinfi).
    c.ctx.waitUntil((async () => {
      await grantReputation(c.env, String(post.author_id), 'like', `${id}:${c.user!.id}`);
      // AUDIT-TASK-10 / D-6.b — PRD §6: "Like almaq +1". XP MÜƏLLİFƏ verilir.
      //
      // 🔴 BU, ƏN RİSKLİ XP MƏNBƏYİDİR: dəyəri istifadəçi özü deyil, BAŞQALARI
      //   yaradır. Üç müdafiə eyni anda işləyir:
      //     1. `refId` reputasiya ilə EYNİ açardır (`post:bəyənən`) → hər
      //        bəyənən bir dəfə sayılır, bəyən/geri-al dövrəsi XP vermir;
      //     2. `XP_RULES.like_received.daily = 50`;
      //     3. ümumi gündəlik tavan (`XP_DAILY_TOTAL`).
      //
      // ⚠ Öz postunu bəyənmək XP verməməlidir — `likePut` bunu qadağan etmir,
      //   ona görə burada açıq yoxlanılır.
      if (String(post.author_id) !== c.user!.id) {
        await grantXp(c.env, String(post.author_id), 'like_received',
          `${id}:${c.user!.id}`, LIKE_RECEIVED_XP);
      }
      await evaluateProgression(c.env, String(post.author_id));
    })());
  }
  return json({ ok: true });
}
export async function likeDelete(c: Ctx, id: string) {
  const r = await D(c).prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').bind(id, c.user!.id).run();
  if (r.meta.changes > 0) {
    await D(c).prepare('UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id = ?').bind(id).run();
  }
  return json({ ok: true });
}

export async function bookmarkPut(c: Ctx, id: string) {
  await D(c).prepare('INSERT OR IGNORE INTO bookmarks (user_id, post_id, created_at) VALUES (?,?,?)')
    .bind(c.user!.id, id, now()).run();
  return json({ ok: true });
}
export async function bookmarkDelete(c: Ctx, id: string) {
  await D(c).prepare('DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?').bind(c.user!.id, id).run();
  return json({ ok: true });
}

// LinkedIn üslublu rəylər (TASK-7 / Bənd 8): üst səviyyə rəylər + bir səviyyəli
// cavablar (thread), rəyə bəyənmə, sıralama (ən yeni / ən çox bəyənilən), limit ilə
// "daha çox yüklə". Polling ilə uzlaşsın deyə səhifələmə `limit`-lə aparılır: müştəri
// cari limit-i saxlayır, "daha çox" onu artırır, hər poll cari limit-i gətirir.
/** İcazə verilən reaksiya tipləri — 0039 miqrasiyasındakı CHECK ilə EYNİ olmalıdır. */
export const REACTION_TYPES = ['like', 'love', 'laugh', 'wow', 'fire', 'clap', 'tada', 'hundred', 'rocket'] as const;
export type ReactionType = typeof REACTION_TYPES[number];
const isReaction = (v: unknown): v is ReactionType =>
  typeof v === 'string' && (REACTION_TYPES as readonly string[]).includes(v);

/**
 * @param myReacts commentId → mənim verdiyim reaksiya tipi
 * @param reactCounts commentId → { type: say }
 *
 * ⚠ `likeCount`/`likedByMe` SAXLANILIR: mövcud UI və e2e testləri onlara
 *   baxır. `reactions` onların üstünə əlavədir, əvəzi deyil.
 */
const mapComment = (
  r: any,
  myLikes: Set<string>,
  myReacts?: Map<string, string>,
  reactCounts?: Map<string, Record<string, number>>,
) => ({
  id: r.id, postId: r.post_id, parentId: r.parent_comment_id || null,
  authorUid: r.author_id, authorName: r.author_name, text: r.text,
  createdAt: r.created_at, editedAt: r.edited_at || null,
  likeCount: r.like_count || 0, likedByMe: myLikes.has(r.id),
  reactions: reactCounts?.get(r.id) || {},
  myReaction: myReacts?.get(r.id) || null,
  pinnedAt: r.pinned_at || null,
  hiddenAt: r.hidden_at || null,
});
/**
 * Sıralama açarı → SQL `ORDER BY` (ALLOWLIST).
 * ⚠ Dəyər BİRBAŞA SQL-ə yapışdırılır, ona görə istifadəçi girişi heç vaxt
 *   buraya düşməməlidir — yalnız bu cədvəldəki sabitlər.
 */
const COMMENT_ORDER: Record<string, string> = {
  new: 'cm.created_at DESC',
  old: 'cm.created_at ASC',
  top: 'cm.like_count DESC, cm.created_at DESC',
  // "Ən çox cavab" — alt sorğu ilə cavab sayı.
  replies: '(SELECT COUNT(*) FROM comments r WHERE r.parent_comment_id = cm.id) DESC, cm.created_at DESC',
};

export async function listComments(c: Ctx, postId: string) {
  const sortRaw = c.url.searchParams.get('sort') || 'new';
  const sort = Object.prototype.hasOwnProperty.call(COMMENT_ORDER, sortRaw) ? sortRaw : 'new';
  const limit = Math.min(Math.max(parseInt(c.url.searchParams.get('limit') || '20', 10) || 20, 5), 200);
  // JOIN əlavə olunduğu üçün sütunlar açıq prefiksli olmalıdır (M-10).
  // Sancaqlanmış şərh HƏMİŞƏ birinci — seçilmiş sıralamadan asılı olmayaraq.
  const order = `(cm.pinned_at IS NULL), cm.pinned_at DESC, ${COMMENT_ORDER[sort]}`;
  // Gizlədilmiş şərhlər yalnız moderatorlara görünür (onlar "Bərpa et" edə bilsin).
  const hiddenFilter = c.isAdmin ? '' : ' AND cm.hidden_at IS NULL';
  // Üst səviyyə rəylər (limit+1 → daha çoxu var?).
  // M-10: bloklanmış müəllifin rəyləri gizlədilir (feed ilə eyni qayda).
  const topRows = await D(c).prepare(
    `SELECT cm.* FROM comments cm JOIN users u ON cm.author_id = u.id
      WHERE cm.post_id = ? AND cm.parent_comment_id IS NULL AND u.blocked = 0${hiddenFilter}
      ORDER BY ${order} LIMIT ?`,
  ).bind(postId, limit + 1).all<any>();
  const hasMore = topRows.results.length > limit;
  const top = topRows.results.slice(0, limit);
  const topIds = top.map(r => r.id);
  // Yalnız yüklənmiş üst rəylərin cavabları (xronoloji).
  // D-1: `limit` 200-ə qədər ola bilər → bölünmədən `IN (?×200)` D1 limitini
  // (100) aşırdı. Hissələmə SIRALAMANI POZMUR: bölgü VALİDEYN id-ləri üzrədir,
  // yəni bir valideynin bütün cavabları eyni hissədədir və aşağıdakı
  // `replies[parent]` qruplaşdırması xronoloji sıranı olduğu kimi saxlayır.
  const replyRows: any[] = [];
  for (const chunk of chunkForD1(topIds)) {
    const rr = await D(c).prepare(
      `SELECT cm.* FROM comments cm JOIN users u ON cm.author_id = u.id
        WHERE cm.parent_comment_id IN (${placeholders(chunk.length)}) AND u.blocked = 0
        ORDER BY cm.created_at ASC`,
    ).bind(...chunk).all<any>();
    replyRows.push(...rr.results);
  }
  // Mənim bəyəndiyim rəylər. D-1: `allIds` = üst rəylər + BÜTÜN cavabları →
  // praktikada sərhədsiz (200 rəyin hər birinin 50 cavabı = 10 000 dəyişən).
  // `reserved: 1` — `user_id = ?` sorğuda IN siyahısından ƏLAVƏ bağlanır.
  const allIds = [...topIds, ...replyRows.map(r => r.id as string)];
  const myLikes = new Set<string>();
  for (const chunk of chunkForD1(allIds, 1)) {
    const lr = await D(c).prepare(
      `SELECT comment_id FROM comment_likes WHERE user_id = ? AND comment_id IN (${placeholders(chunk.length)})`,
    ).bind(c.user!.id, ...chunk).all<any>();
    for (const r of lr.results) myLikes.add(r.comment_id as string);
  }
  // ── Reaksiyalar ──────────────────────────────────────────────────────────
  // İki sorğu: (a) mənim reaksiyam, (b) tip üzrə ümumi bölgü.
  // ⚠ `chunkForD1` MƏCBURİDİR — `allIds` yuxarıdakı bəyənmə sorğusundakı kimi
  //   praktikada sərhədsizdir və D1-in 100 dəyişən limitini aşardı.
  const myReacts = new Map<string, string>();
  const reactCounts = new Map<string, Record<string, number>>();
  for (const chunk of chunkForD1(allIds, 1)) {
    const mine = await D(c).prepare(
      `SELECT comment_id, type FROM comment_reactions
        WHERE user_id = ? AND comment_id IN (${placeholders(chunk.length)})`,
    ).bind(c.user!.id, ...chunk).all<any>();
    for (const r of mine.results) myReacts.set(r.comment_id as string, r.type as string);
  }
  for (const chunk of chunkForD1(allIds)) {
    const agg = await D(c).prepare(
      `SELECT comment_id, type, COUNT(*) AS n FROM comment_reactions
        WHERE comment_id IN (${placeholders(chunk.length)}) GROUP BY comment_id, type`,
    ).bind(...chunk).all<any>();
    for (const r of agg.results) {
      const bucket = reactCounts.get(r.comment_id as string) || {};
      bucket[r.type as string] = r.n as number;
      reactCounts.set(r.comment_id as string, bucket);
    }
  }

  const replies: Record<string, any[]> = {};
  for (const r of replyRows) (replies[r.parent_comment_id] ||= []).push(mapComment(r, myLikes, myReacts, reactCounts));
  const cnt = await D(c).prepare(
    `SELECT COUNT(*) AS n FROM comments WHERE post_id = ? AND parent_comment_id IS NULL${c.isAdmin ? '' : ' AND hidden_at IS NULL'}`,
  ).bind(postId).first<any>();
  return json({
    comments: top.map(r => mapComment(r, myLikes, myReacts, reactCounts)),
    replies, total: cnt?.n || 0, hasMore,
  });
}
export async function addComment(c: Ctx, postId: string) {
  const b = await readJson(c.req);
  const text = clampStr(b.text, 1000).trim();
  if (!text) return badReq('Şərh boş ola bilməz.');
  const post = await D(c).prepare('SELECT author_id FROM posts WHERE id = ?').bind(postId).first<any>();
  if (!post) return err('Post tapılmadı.', 404);

  // Bir səviyyə qaydası: cavaba cavab yazılırsa, kök üst rəyə düzlənir
  // (dərin cavablar eyni thread-də @mention ilə). replyToAuthor → cavab bildirişi.
  let parentId: string | null = null;
  let replyToAuthor: string | null = null;
  if (b.parentId) {
    const parent = await D(c).prepare('SELECT id, author_id, parent_comment_id FROM comments WHERE id = ? AND post_id = ?')
      .bind(clampStr(b.parentId, 40), postId).first<any>();
    if (parent) {
      parentId = parent.parent_comment_id || parent.id;   // flatten-to-root
      replyToAuthor = parent.author_id;
    }
  }
  const id = uuid();
  const ts = now();
  await D(c).prepare('INSERT INTO comments (id, post_id, author_id, author_name, text, created_at, parent_comment_id) VALUES (?,?,?,?,?,?,?)')
    .bind(id, postId, c.user!.id, c.user!.name, text, ts, parentId).run();
  await D(c).prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?').bind(postId).run();
  // H-5: XP idempotent + tavanlı. Tavana çatanda rəy YENƏ yazılır.
  const cXp = await grantXp(c.env, c.user!.id, 'comment', id, COMMENT_XP);
  if (parentId && replyToAuthor) await notify(c, replyToAuthor, 'comment', 'şərhinə cavab yazdı', postId);
  else await notify(c, post.author_id, 'comment', 'paylaşımına şərh yazdı', postId);
  await notifyMentions(c, text, 'səni şərhdə qeyd etdi', postId);
  return json({ ok: true, id, createdAt: ts, parentId, xpCapped: cXp.reason === 'daily_cap' });
}
export async function editComment(c: Ctx, postId: string, cid: string) {
  const b = await readJson(c.req);
  const text = clampStr(b.text, 1000).trim();
  if (!text) return badReq('Şərh boş ola bilməz.');
  const row = await D(c).prepare('SELECT author_id FROM comments WHERE id = ? AND post_id = ?').bind(cid, postId).first<any>();
  if (!row) return err('Şərh tapılmadı.', 404);
  if (row.author_id !== c.user!.id) return err('İcazə yoxdur.', 403, 'forbidden');   // redaktə yalnız müəllif
  await D(c).prepare('UPDATE comments SET text = ?, edited_at = ? WHERE id = ?').bind(text, now(), cid).run();
  return json({ ok: true });
}
export async function deleteComment(c: Ctx, postId: string, cid: string) {
  const row = await D(c).prepare('SELECT author_id FROM comments WHERE id = ? AND post_id = ?').bind(cid, postId).first<any>();
  if (!row) return json({ ok: true });
  const post = await D(c).prepare('SELECT author_id FROM posts WHERE id = ?').bind(postId).first<any>();
  const allowed = row.author_id === c.user!.id || c.isAdmin || post?.author_id === c.user!.id;
  if (!allowed) return err('İcazə yoxdur.', 403, 'forbidden');
  // Cascade sil: rəy + bütün cavabları (dərinlik 1 olduğu üçün birbaşa uşaqlar tamdır) + reaksiyalar.
  // `author_id` də oxunur: cascade silinən cavabların müəllifi BAŞQA
  // istifadəçilər ola bilər və XP kompensasiyası hər sətrin ÖZ müəllifinə
  // tətbiq edilməlidir (yanlış uid ilə `xp_logs` sətri tapılmazdı və dövrə
  // sükutla açıq qalardı).
  const kids = await D(c).prepare('SELECT id, author_id FROM comments WHERE parent_comment_id = ?')
    .bind(cid).all<any>();
  const owners: Array<{ id: string; uid: string }> = [
    { id: cid, uid: String(row.author_id) },
    ...kids.results.map(r => ({ id: String(r.id), uid: String(r.author_id) })),
  ];
  const ids = owners.map(o => o.id);
  // D-1: cavabların sayı SƏRHƏDSİZDİR — populyar rəyin 500 cavabı olsa
  // `IN (?×501)` D1-i çökdürür və rəy HEÇ VAXT silinə bilmirdi.
  // Silmələr hissələnir, lakin hamısı EYNİ `batch()`-də qalır → atomiklik
  // qorunur (yarımçıq silmə yetim `comment_likes` sətirləri buraxardı).
  const stmts = [];
  for (const chunk of chunkForD1(ids)) {
    const ph = placeholders(chunk.length);
    stmts.push(D(c).prepare(`DELETE FROM comments WHERE id IN (${ph})`).bind(...chunk));
    stmts.push(D(c).prepare(`DELETE FROM comment_likes WHERE comment_id IN (${ph})`).bind(...chunk));
  }
  stmts.push(D(c).prepare('UPDATE posts SET comment_count = MAX(0, comment_count - ?) WHERE id = ?').bind(ids.length, postId));
  await D(c).batch(stmts);
  // H-5 #3 — rəy dövrəsi də bağlanır. Cascade silinən CAVABLARIN XP-si də geri
  // alınır: yalnız kök rəyi kompensasiya etsək, hücumçu cavab yazıb valideyni
  // silməklə cavabların XP-sini saxlayardı.
  //
  // ⚠ D-1 intizamı: hər cavab üçün ayrıca `compensateXp` çağırsaq, 120 cavablı
  //   rəydə ən azı 120 SELECT olardı. Əvvəlcə HİSSƏLƏNMİŞ tək sorğu ilə hansı
  //   sətirlərin ümumiyyətlə XP qazandığı tapılır — gündəlik tavan səbəbindən
  //   bu siyahı praktikada xeyli qısadır.
  const earned = new Set<string>();
  for (const chunk of chunkForD1(ids)) {
    const rs = await D(c).prepare(
      `SELECT ref_id FROM xp_logs
        WHERE source = 'comment' AND amount > 0 AND ref_id IN (${placeholders(chunk.length)})`,
    ).bind(...chunk).all<any>();
    for (const r of rs.results) earned.add(String(r.ref_id));
  }
  for (const o of owners) {
    if (earned.has(o.id)) await compensateXp(c.env, o.uid, 'comment', o.id);
  }
  return json({ ok: true });
}
export async function commentLikePut(c: Ctx, postId: string, cid: string) {
  const row = await D(c).prepare('SELECT author_id FROM comments WHERE id = ? AND post_id = ?').bind(cid, postId).first<any>();
  if (!row) return err('Şərh tapılmadı.', 404);
  const r = await D(c).prepare('INSERT OR IGNORE INTO comment_likes (comment_id, user_id, created_at) VALUES (?,?,?)')
    .bind(cid, c.user!.id, now()).run();
  if (r.meta.changes > 0) {
    await D(c).prepare('UPDATE comments SET like_count = like_count + 1 WHERE id = ?').bind(cid).run();
    await notify(c, row.author_id, 'like', 'şərhini bəyəndi', postId);
  }
  return json({ ok: true });
}
export async function commentLikeDelete(c: Ctx, _postId: string, cid: string) {
  const r = await D(c).prepare('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?').bind(cid, c.user!.id).run();
  if (r.meta.changes > 0) {
    await D(c).prepare('UPDATE comments SET like_count = MAX(0, like_count - 1) WHERE id = ?').bind(cid).run();
  }
  return json({ ok: true });
}

/* ================= POST: REAKSİYA / MODERASİYA / ŞİKAYƏT (0040) =================
 * ⚠ Şərhlərdəki (0039) modelin EYNİSİ — bilərəkdən eyni struktur, eyni
 *   invariantlar. Fərqləndirmək iki ayrı davranış yaradar və biri
 *   düzəldiləndə digəri unudulardı. */

/** `like` tipini köhnə `likes` + `posts.like_count` ilə sinxron saxlayır. */
async function syncPostLike(c: Ctx, postId: string, wasLike: boolean, nowLike: boolean) {
  if (nowLike && !wasLike) {
    const ins = await D(c).prepare('INSERT OR IGNORE INTO likes (post_id, user_id, created_at) VALUES (?,?,?)')
      .bind(postId, c.user!.id, now()).run();
    if (ins.meta.changes > 0) await D(c).prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?').bind(postId).run();
  } else if (!nowLike && wasLike) {
    const del = await D(c).prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').bind(postId, c.user!.id).run();
    if (del.meta.changes > 0) await D(c).prepare('UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id = ?').bind(postId).run();
  }
}

export async function postReactionPut(c: Ctx, id: string) {
  const b = await readJson(c.req);
  if (!isReaction(b.type)) return badReq('Naməlum reaksiya tipi.');
  const post = await D(c).prepare('SELECT author_id FROM posts WHERE id = ?').bind(id).first<any>();
  if (!post) return err('Post tapılmadı.', 404);

  const prev = await D(c).prepare('SELECT type FROM post_reactions WHERE post_id = ? AND user_id = ?')
    .bind(id, c.user!.id).first<any>();
  if (prev?.type === b.type) return json({ ok: true, type: b.type });

  await D(c).prepare(
    `INSERT INTO post_reactions (post_id, user_id, type, created_at) VALUES (?,?,?,?)
       ON CONFLICT(post_id, user_id) DO UPDATE SET type = excluded.type`,
  ).bind(id, c.user!.id, b.type, now()).run();
  await syncPostLike(c, id, prev?.type === 'like', b.type === 'like');
  if (!prev) await notify(c, post.author_id, 'like', 'paylaşımına reaksiya verdi', id);
  return json({ ok: true, type: b.type });
}

export async function postReactionDelete(c: Ctx, id: string) {
  const prev = await D(c).prepare('SELECT type FROM post_reactions WHERE post_id = ? AND user_id = ?')
    .bind(id, c.user!.id).first<any>();
  if (!prev) return json({ ok: true });
  await D(c).prepare('DELETE FROM post_reactions WHERE post_id = ? AND user_id = ?').bind(id, c.user!.id).run();
  await syncPostLike(c, id, prev.type === 'like', false);
  return json({ ok: true });
}

/** Sancaq — YALNIZ admin: post sancağı qlobal feed-ə təsir edir. */
export async function postPin(c: Ctx, id: string) {
  if (!c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  const row = await D(c).prepare('SELECT id FROM posts WHERE id = ?').bind(id).first<any>();
  if (!row) return err('Post tapılmadı.', 404);
  await D(c).prepare('UPDATE posts SET pinned_at = NULL WHERE pinned_at IS NOT NULL').run();
  await D(c).prepare('UPDATE posts SET pinned_at = ? WHERE id = ?').bind(now(), id).run();
  return json({ ok: true, pinned: true });
}

export async function postUnpin(c: Ctx, id: string) {
  if (!c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  await D(c).prepare('UPDATE posts SET pinned_at = NULL WHERE id = ?').bind(id).run();
  return json({ ok: true, pinned: false });
}

export async function postHide(c: Ctx, id: string) {
  if (!c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  const r = await D(c).prepare('UPDATE posts SET hidden_at = ?, hidden_by = ? WHERE id = ?')
    .bind(now(), c.user!.id, id).run();
  if (!r.meta.changes) return err('Post tapılmadı.', 404);
  return json({ ok: true, hidden: true });
}

export async function postRestore(c: Ctx, id: string) {
  if (!c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  const r = await D(c).prepare('UPDATE posts SET hidden_at = NULL, hidden_by = NULL WHERE id = ?').bind(id).run();
  if (!r.meta.changes) return err('Post tapılmadı.', 404);
  return json({ ok: true, hidden: false });
}

export async function postReport(c: Ctx, id: string) {
  const b = await readJson(c.req);
  const reason = clampStr(b.reason, 300).trim();
  if (!reason) return badReq('Səbəb boş ola bilməz.');
  const row = await D(c).prepare('SELECT id FROM posts WHERE id = ?').bind(id).first<any>();
  if (!row) return err('Post tapılmadı.', 404);
  const ins = await D(c).prepare(
    `INSERT OR IGNORE INTO post_reports (id, post_id, reporter_id, reporter_name, reason, created_at)
     VALUES (?,?,?,?,?,?)`,
  ).bind(uuid(), id, c.user!.id, c.user!.name, reason, now()).run();
  if (!ins.meta.changes) return err('Bu paylaşımı artıq şikayət etmisən.', 409, 'already_reported');
  return json({ ok: true });
}

/* ================= ŞƏRH: REAKSİYA / MODERASİYA / ŞİKAYƏT (0039) ================= */

/**
 * Reaksiya qoy və ya dəyiş (PUT — idempotent).
 *
 * ⚠ `like` tipi HƏM `comment_reactions`-a, HƏM DƏ köhnə `comment_likes` +
 *   `comments.like_count`-a yazılır. Səbəb: mövcud UI/`likedByMe`/e2e hələ
 *   köhnə yolu oxuyur. İki cədvəlin sinxron qalması bu funksiyanın
 *   məsuliyyətidir — birini yeniləyib digərini unutmaq sayğacı sürüşdürər.
 */
export async function commentReactionPut(c: Ctx, postId: string, cid: string) {
  const b = await readJson(c.req);
  if (!isReaction(b.type)) return badReq('Naməlum reaksiya tipi.');
  const row = await D(c).prepare('SELECT author_id FROM comments WHERE id = ? AND post_id = ?')
    .bind(cid, postId).first<any>();
  if (!row) return err('Şərh tapılmadı.', 404);

  const prev = await D(c).prepare('SELECT type FROM comment_reactions WHERE comment_id = ? AND user_id = ?')
    .bind(cid, c.user!.id).first<any>();
  if (prev?.type === b.type) return json({ ok: true, type: b.type });   // dəyişiklik yoxdur

  await D(c).prepare(
    `INSERT INTO comment_reactions (comment_id, user_id, type, created_at) VALUES (?,?,?,?)
       ON CONFLICT(comment_id, user_id) DO UPDATE SET type = excluded.type`,
  ).bind(cid, c.user!.id, b.type, now()).run();

  // Köhnə `like` yolunu sinxron saxla.
  const wasLike = prev?.type === 'like';
  const nowLike = b.type === 'like';
  if (nowLike && !wasLike) {
    const ins = await D(c).prepare('INSERT OR IGNORE INTO comment_likes (comment_id, user_id, created_at) VALUES (?,?,?)')
      .bind(cid, c.user!.id, now()).run();
    if (ins.meta.changes > 0) await D(c).prepare('UPDATE comments SET like_count = like_count + 1 WHERE id = ?').bind(cid).run();
  } else if (!nowLike && wasLike) {
    const del = await D(c).prepare('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?').bind(cid, c.user!.id).run();
    if (del.meta.changes > 0) await D(c).prepare('UPDATE comments SET like_count = MAX(0, like_count - 1) WHERE id = ?').bind(cid).run();
  }
  // Bildiriş yalnız YENİ reaksiyada — tip dəyişməsi spam yaratmamalıdır.
  if (!prev) await notify(c, row.author_id, 'like', 'şərhinə reaksiya verdi', postId);
  return json({ ok: true, type: b.type });
}

export async function commentReactionDelete(c: Ctx, _postId: string, cid: string) {
  const prev = await D(c).prepare('SELECT type FROM comment_reactions WHERE comment_id = ? AND user_id = ?')
    .bind(cid, c.user!.id).first<any>();
  if (!prev) return json({ ok: true });
  await D(c).prepare('DELETE FROM comment_reactions WHERE comment_id = ? AND user_id = ?').bind(cid, c.user!.id).run();
  if (prev.type === 'like') {
    const del = await D(c).prepare('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?').bind(cid, c.user!.id).run();
    if (del.meta.changes > 0) await D(c).prepare('UPDATE comments SET like_count = MAX(0, like_count - 1) WHERE id = ?').bind(cid).run();
  }
  return json({ ok: true });
}

/** Sancaq: yalnız POST müəllifi və ya admin. Bir postda yalnız BİR sancaq. */
export async function commentPin(c: Ctx, postId: string, cid: string) {
  const post = await D(c).prepare('SELECT author_id FROM posts WHERE id = ?').bind(postId).first<any>();
  if (!post) return err('Post tapılmadı.', 404);
  if (post.author_id !== c.user!.id && !c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  const row = await D(c).prepare('SELECT id FROM comments WHERE id = ? AND post_id = ?').bind(cid, postId).first<any>();
  if (!row) return err('Şərh tapılmadı.', 404);
  // Əvvəlki sancaq götürülür — "ən üstdə bir şərh" qaydası.
  await D(c).prepare('UPDATE comments SET pinned_at = NULL WHERE post_id = ? AND pinned_at IS NOT NULL').bind(postId).run();
  await D(c).prepare('UPDATE comments SET pinned_at = ? WHERE id = ?').bind(now(), cid).run();
  return json({ ok: true, pinned: true });
}

export async function commentUnpin(c: Ctx, postId: string, cid: string) {
  const post = await D(c).prepare('SELECT author_id FROM posts WHERE id = ?').bind(postId).first<any>();
  if (!post) return err('Post tapılmadı.', 404);
  if (post.author_id !== c.user!.id && !c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  await D(c).prepare('UPDATE comments SET pinned_at = NULL WHERE id = ? AND post_id = ?').bind(cid, postId).run();
  return json({ ok: true, pinned: false });
}

/**
 * Gizlət (moderasiya) — yalnız admin.
 * ⚠ SİLMƏ DEYİL: sətir qalır, `hidden_at` qoyulur. Beləliklə "Bərpa et"
 *   mümkündür və moderasiya qərarı auditdə izlənir (kim, nə vaxt).
 */
export async function commentHide(c: Ctx, postId: string, cid: string) {
  if (!c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  const r = await D(c).prepare('UPDATE comments SET hidden_at = ?, hidden_by = ? WHERE id = ? AND post_id = ?')
    .bind(now(), c.user!.id, cid, postId).run();
  if (!r.meta.changes) return err('Şərh tapılmadı.', 404);
  return json({ ok: true, hidden: true });
}

export async function commentRestore(c: Ctx, postId: string, cid: string) {
  if (!c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  const r = await D(c).prepare('UPDATE comments SET hidden_at = NULL, hidden_by = NULL WHERE id = ? AND post_id = ?')
    .bind(cid, postId).run();
  if (!r.meta.changes) return err('Şərh tapılmadı.', 404);
  return json({ ok: true, hidden: false });
}

/** Şikayət — hər istifadəçi bir şərhi bir dəfə (UNIQUE index 409 verir). */
export async function commentReport(c: Ctx, postId: string, cid: string) {
  const b = await readJson(c.req);
  const reason = clampStr(b.reason, 300).trim();
  if (!reason) return badReq('Səbəb boş ola bilməz.');
  const row = await D(c).prepare('SELECT id FROM comments WHERE id = ? AND post_id = ?').bind(cid, postId).first<any>();
  if (!row) return err('Şərh tapılmadı.', 404);
  const ins = await D(c).prepare(
    `INSERT OR IGNORE INTO comment_reports (id, comment_id, post_id, reporter_id, reporter_name, reason, created_at)
     VALUES (?,?,?,?,?,?,?)`,
  ).bind(uuid(), cid, postId, c.user!.id, c.user!.name, reason, now()).run();
  // `OR IGNORE` + UNIQUE → təkrar şikayət səssizcə udulur; istifadəçiyə
  // "artıq şikayət etmisən" demək daha dürüstdür.
  if (!ins.meta.changes) return err('Bu şərhi artıq şikayət etmisən.', 409, 'already_reported');
  return json({ ok: true });
}

