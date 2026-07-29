// Qlobal axtarış (FTS5) — AUDIT-TASK-10 / Faza 3.1.
import { Ctx, json, fromJSON } from '../util';
import { D } from './shared';

/* ================= QLOBAL AXTARIŞ — FTS5 (Bənd 11) ================= */

// İstifadəçi girişini TƏHLÜKƏSİZ FTS5 sorğusuna çevirir.
//
// ⚠ Xam mətni birbaşa MATCH-ə vermək OLMAZ: FTS5-in öz sintaksisi var
// (`"`, `*`, `NEAR`, `AND/OR/NOT`, `:`, `^`). İstifadəçi «C++ "test"» yazsa
// sorğu sintaksis xətası verib 500 qaytarardı — yəni adi axtarış sözü
// endpoint-i sındıra bilərdi. Ona görə hər söz ayrıca sitat içinə alınır
// (sitat daxilində operatorlar adi mətn sayılır).
function ftsQuery(raw: string): string | null {
  const terms = String(raw || '')
    .toLowerCase()
    // `-` simvol sinfinin SONUNDADIR → qaçırılmağa ehtiyacı yoxdur.
    .replace(/["*():^-]/g, ' ')       // FTS operator simvolları söz ayırıcıya çevrilir
    .split(/\s+/)
    .filter(t => t.length >= 2)       // tək hərf indeksdə mənalı deyil, hər şeyi qaytarır
    .slice(0, 8);                     // sorğu uzunluğu limiti (DoS qapısı)
  if (!terms.length) return null;
  // Son söz PREFİKS kimi axtarılır ("prog" → "proqramlaşdırma") — yazarkən
  // axtarış (as-you-type) üçün. Qalanları tam söz.
  return terms.map((t, i) => (i === terms.length - 1 ? `"${t}"*` : `"${t}"`)).join(' AND ');
}

const SEARCH_LIMIT = 8;

export async function globalSearch(c: Ctx) {
  const q = ftsQuery(c.url.searchParams.get('q') || '');
  if (!q) return json({ posts: [], users: [], comments: [], query: '' });

  const scope = c.url.searchParams.get('scope') || 'all';
  const want = (s: string) => scope === 'all' || scope === s;

  // Üç indeks paralel sorğulanır — `batch` tək D1 gedişində icra edir.
  // `bm25()` FTS5-in daxili reytinq funksiyasıdır (kiçik = daha uyğun);
  // sütun çəkiləri ilə ad/başlıq mətndən üstün tutulur.
  const stmts: D1PreparedStatement[] = [];
  const kinds: string[] = [];

  if (want('posts')) {
    kinds.push('posts');
    stmts.push(D(c).prepare(
      `SELECT p.id, p.author_id, p.author_name, p.created_at, p.tags,
              snippet(posts_fts, 0, '<mark>', '</mark>', '…', 18) AS snip
         FROM posts_fts
         JOIN posts p ON p.rowid = posts_fts.rowid
        WHERE posts_fts MATCH ?1
        ORDER BY bm25(posts_fts, 1.0, 2.0), p.created_at DESC
        LIMIT ?2`,
    ).bind(q, SEARCH_LIMIT));
  }
  if (want('users')) {
    kinds.push('users');
    stmts.push(D(c).prepare(
      `SELECT u.id, u.username, u.name, u.photo_url, u.xp,
              snippet(users_fts, 2, '<mark>', '</mark>', '…', 14) AS snip
         FROM users_fts
         JOIN users u ON u.rowid = users_fts.rowid
        WHERE users_fts MATCH ?1 AND u.blocked = 0
        ORDER BY bm25(users_fts, 4.0, 3.0, 1.0, 1.0), u.xp DESC
        LIMIT ?2`,
    ).bind(q, SEARCH_LIMIT));
  }
  if (want('comments')) {
    kinds.push('comments');
    stmts.push(D(c).prepare(
      `SELECT cm.id, cm.post_id, cm.author_name, cm.created_at,
              snippet(comments_fts, 0, '<mark>', '</mark>', '…', 16) AS snip
         FROM comments_fts
         JOIN comments cm ON cm.rowid = comments_fts.rowid
        WHERE comments_fts MATCH ?1
        ORDER BY bm25(comments_fts), cm.created_at DESC
        LIMIT ?2`,
    ).bind(q, SEARCH_LIMIT));
  }

  let results: any[];
  try {
    results = await D(c).batch<any>(stmts);
  } catch (e: any) {
    // FTS sintaksis xətası buraya düşməməlidir (`ftsQuery` təmizləyir),
    // amma düşsə istifadəçi 500 yox, boş nəticə görsün.
    console.error('fts search', e?.message || e);
    return json({ posts: [], users: [], comments: [], query: '' });
  }

  const out: Record<string, any[]> = { posts: [], users: [], comments: [] };
  kinds.forEach((kind, i) => {
    const rows = results[i]?.results || [];
    if (kind === 'posts') {
      out.posts = rows.map((r: any) => ({
        id: r.id, authorUid: r.author_id, authorName: r.author_name,
        createdAt: r.created_at, tags: fromJSON(r.tags, []), snippet: r.snip,
      }));
    } else if (kind === 'users') {
      out.users = rows.map((r: any) => ({
        uid: r.id, username: r.username, name: r.name,
        photoURL: r.photo_url, xp: r.xp, snippet: r.snip,
      }));
    } else {
      out.comments = rows.map((r: any) => ({
        id: r.id, postId: r.post_id, authorName: r.author_name,
        createdAt: r.created_at, snippet: r.snip,
      }));
    }
  });

  return json({ ...out, query: c.url.searchParams.get('q') || '' });
}

