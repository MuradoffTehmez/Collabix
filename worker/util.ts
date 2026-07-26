// Ortaq yardımçılar: cavab formatları, id-lər, validasiya.
export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  SESSIONS: KVNamespace;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  ENVIRONMENT: string;
  // --- TASK-8 opsional konfiq ---
  // Hamısı OPSİONALDIR (`?`). Qurulmayıbsa müvafiq funksiya səssizcə söndürülür,
  // sistem işləməyə davam edir — bax docs/TASK-8-SETUP.md.
  TURNSTILE_SECRET?: string;    // secret  — bot qoruması server yoxlaması (Bənd 7)
  TURNSTILE_SITE_KEY?: string;  // vars    — public açar, frontend widget-i üçün
  // OAuth (Bənd 5) — client id `vars`-da (public), secret `wrangler secret`-də.
  // Provayder yalnız CÜTÜ tam olduqda aktivləşir (oauth.ts `isConfigured`).
  OAUTH_GITHUB_ID?: string;     OAUTH_GITHUB_SECRET?: string;
  OAUTH_GOOGLE_ID?: string;     OAUTH_GOOGLE_SECRET?: string;
  OAUTH_LINKEDIN_ID?: string;   OAUTH_LINKEDIN_SECRET?: string;
  // Email (Bənd 4) — Cloudflare Email Sending binding-i.
  // Tip struktural yazılıb, `@cloudflare/workers-types`-dakı ada bağlanmayıb:
  // Email Sending 2025-də çıxıb və hələ dəyişir; ad dəyişsə build sınmasın.
  EMAIL?: { send(m: {
    to: string;
    from: { email: string; name?: string };
    subject: string;
    html?: string;
    text?: string;
  }): Promise<unknown> };
  EMAIL_FROM?: string;          // vars — göndərən ünvan (domen onboard olunmalıdır)
  // Arxivləmə (Bənd 12) — D1-də saxlanılan "isti pəncərə", gün. Default 90.
  ARCHIVE_HOT_DAYS?: string;
  // Cloudflare Queues (Bənd 18) — asinxron fan-out.
  // OPSİONALDIR: binding yoxdursa iş sinxron icra olunur (bax queue.ts `enqueue`).
  TASKS?: Queue<import('./events').SystemEvent>;
  APP_NAME?: string;            // vars — göndərən adı
  // Realtime otaq fan-out (WebSocket) — hər otağa bir instans.
  ROOM_DO: DurableObjectNamespace<import('./room-do').RoomDO>;
  // Real-time presence (online/offline) — tək qlobal instans.
  PRESENCE_DO: DurableObjectNamespace<import('./presence-do').PresenceDO>;
  
  // TASK-8 / Yeni Cloudflare Xidmətləri
  WORKFLOW?: any;
  AI?: any;
  VECTORIZE?: any;
  BROWSER?: Fetcher;
  // Model adları `vars` ilə override oluna bilər — Workers AI modelləri
  // deprecate olunanda deploy gözləmədən dəyişmək üçün (bax providers/ai).
  AI_CHAT_MODEL?: string;
  AI_EMBED_MODEL?: string;
  // Saytın KANONİK origin-i — TƏK HƏQİQƏT MƏNBƏYİ (AUDIT-TASK-2 / borc #14).
  //
  // Əvvəl domen 4 AYRI yerdə hardcoded idi və hər biri FƏRQLİ dəyər saxlayırdı:
  //   worker/seo.ts    → collabix.muradofftehmez01.workers.dev  (canonical/sitemap/OG)
  //   js/feed.js       → collabix.muradofftehmez01.workers.dev  (paylaş linkləri)
  //   worker/jobs/team → collabix.site                          (dəvət emaili — DNS-də YOXDUR!)
  //   js/legal.js      → collabix.app                           (əlaqə emaili)
  // Nəticə: dəvət emailləri ölü domenə keçid verirdi.
  //
  // ⚠ Bu dəyər canonical URL, sitemap, hreflang və OG şəkillərini təyin edir.
  // Səhv qoyulsa SEO-ya birbaşa zərər verir. Dəyişmək üçün DNS + Cloudflare
  // route + yönləndirmə planı lazımdır (bax docs/AUDIT-TASK-2-REPORT.md).
  SITE_ORIGIN?: string;
  // Dəvət emailindəki linkin bazası. Yoxdursa `SITE_ORIGIN`-ə düşür.
  APP_URL?: string;
}

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  blocked: number;
  settings: Record<string, any>;
  [k: string]: any;
}

export interface Ctx {
  env: Env;
  req: Request;
  url: URL;
  user: AuthUser | null;
  isAdmin: boolean;
  sid: string | null;      // cari sessiya id-si (sessions.id) — logout/"bu cihaz istisna" üçün
  legacy: boolean;         // TASK-8 öncəsi cookie ilə gəlib → me() yeni modelə köçürəcək
  // Worker icra konteksti — fon işi (`waitUntil`) üçün.
  // Onsuz növbəyə yazma cavabı gecikdirər, `await` etməsək isə Worker cavab
  // verən kimi işi kəsə bilər və bildirişlər itərdi.
  ctx: ExecutionContext;
}

export const now = () => Date.now();
export const uuid = () => crypto.randomUUID().replace(/-/g, '');

// Kriptoqrafik təsadüfi sətir. OAuth ilə yaradılan parolsuz hesablarda
// `pass_hash` sütununu İSTİFADƏ OLUNMAYAN dəyərlə doldurmaq üçün — boş və ya
// sabit dəyər qoysaq bütün belə hesablar eyni heşi paylaşardı.
export const b64uRandom = (bytes = 32) =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });
}
// `code` maşın üçündür, `error` insan üçün. Client 401-i görəndə mesajı oxuyub
// təxmin etmək əvəzinə koda baxır: `token_expired` → səssiz refresh + təkrar cəhd,
// başqa hər şey → çıxış. Mesaja görə qərar vermək tərcümə dəyişən kimi sınardı.
export const err = (message: string, status = 400, code?: string) =>
  json(code ? { error: message, code } : { error: message }, status);

// Bir cavaba BİR NEÇƏ Set-Cookie başlığı əlavə edir.
// `json(..., { 'Set-Cookie': ... })` obyekt formasında yalnız birini saxlaya bilər —
// access + refresh cütü isə iki ayrı başlıq tələb edir (spesifikasiya birləşdirməyə icazə vermir).
export function withCookies(res: Response, cookies: string[]): Response {
  const out = new Response(res.body, res);
  for (const ck of cookies) out.headers.append('Set-Cookie', ck);
  return out;
}

export async function readJson<T = any>(req: Request): Promise<T> {
  try { return await req.json() as T; } catch { return {} as T; }
}

export const normalizeUsername = (raw: string) =>
  (raw || '').trim().toLowerCase().normalize('NFKC').replace(/[^a-z0-9._]/g, '');
export const validUsername = (u: string) => /^[a-z0-9._]{3,20}$/.test(u);

export const clampStr = (v: unknown, max: number) => String(v ?? '').slice(0, max);
export const toJSON = (v: unknown, fallback: string) => {
  try { return JSON.stringify(v ?? JSON.parse(fallback)); } catch { return fallback; }
};
export const fromJSON = <T>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
};

export const pairIdFor = (a: string, b: string) => [a, b].sort().join('_');
export const todayStr = () => new Date().toISOString().slice(0, 10);

// @username qeydləri
export const extractMentions = (text: string): string[] =>
  [...new Set((text.match(/@([a-z0-9._]{3,20})/g) || []).map(m => m.slice(1)))];

/* ---------- sıra mapperleri: D1 sətri → client forması ---------- */
export function mapUser(r: any, self = false): any {
  if (!r) return null;
  const u: any = {
    uid: r.id, username: r.username, name: r.name, age: r.age,
    birthDate: r.birth_date, gender: r.gender, country: r.country, city: r.city,
    bio: r.bio, photoURL: r.photo_url,
    progLevels: fromJSON(r.prog_levels, {}), langLevels: fromJSON(r.lang_levels, {}),
    goals: r.goals, lookingFor: fromJSON(r.looking_for, []),
    instagram: r.instagram, github: r.github, linkedin: r.linkedin,
    telegram: r.telegram, website: r.website,
    streak: r.streak, xp: r.xp, tasksCompleted: r.tasks_completed,
    lastActiveDay: r.last_active_day, lastActiveAt: r.last_active_at,
    activityDays: fromJSON(r.activity_days, {}),
    joinedAt: r.joined_at, blocked: !!r.blocked, verified: !!r.verified,
    role: r.role, settings: fromJSON(r.settings, {}),
    activeProjectId: r.active_project_id || null,
    showProjectOnProfile: r.show_project_on_profile !== 0,
  };
  u.prog = Object.keys(u.progLevels);
  u.langs = Object.keys(u.langLevels);
  if (self) {
    u.contactEmail = r.contact_email;
    u.mustResetPassword = !!r.must_reset_password;
    // OAuth ilə yaradılmış hesabda parol yoxdur → UI "şifrəni dəyiş" əvəzinə
    // "şifrə təyin et" göstərir və hazırkı şifrə sahəsini gizlədir.
    u.hasPassword = r.has_password !== 0;
    u.email = r.email || '';
  }
  return u;
}

export function mapPost(r: any): any {
  if (!r) return null;
  const post: any = {
    id: r.id, authorUid: r.author_id, authorName: r.author_name,
    blocks: fromJSON(r.blocks, []), text: r.text, tags: fromJSON(r.tags, []),
    imagePaths: fromJSON(r.image_keys, []),
    likeCount: r.like_count, commentCount: r.comment_count, shareCount: r.share_count || 0,
    createdAt: r.created_at, editedAt: r.edited_at,
    sharedPostId: r.shared_post_id,
    postType: r.post_type || 'original',
    quoteText: r.quote_text || null,
    originalDeleted: !!r.original_deleted,
  };
  if (r.shared_post_id) {
    // Orijinal mövcud və silinməyibsə → embed; əks halda "silinib" stub.
    // Quote-un öz mətni (post.text/blocks) hər halda qorunur — yalnız embed collapse olur.
    if (r.s_author_id && !r.original_deleted) {
      post.sharedPost = {
        id: r.s_id, authorUid: r.s_author_id, authorName: r.s_author_name,
        blocks: fromJSON(r.s_blocks, []), text: r.s_text, tags: fromJSON(r.s_tags, []),
        imagePaths: fromJSON(r.s_image_keys, []),
        createdAt: r.s_created_at
      };
    } else {
      post.sharedPost = { id: r.shared_post_id, deleted: true };
    }
  }
  return post;
}

export const fileUrl = (key: string | null) => (key ? `/files/${key}` : null);

export function mapMsg(r: any, dm = false): any {
  const base: any = {
    id: r.id, type: r.type || 'text', text: r.text,
    fileUrl: fileUrl(r.file_key), fileName: r.file_name, fileSize: r.file_size,
    mimeType: r.mime_type, language: r.language,
    createdAt: r.created_at, editedAt: r.edited_at,
  };
  if (dm) { base.fromUid = r.from_id; base.toUid = r.to_id; }
  else { base.authorUid = r.author_id; base.authorName = r.author_name; }
  return base;
}

export function mapTask(r: any): any {
  return {
    id: r.id, title: r.title, desc: r.descr, category: r.category,
    createdBy: r.created_by, createdByName: r.created_by_name,
    status: r.status, createdAt: r.created_at,
  };
}

export function mapSubmission(r: any): any {
  return {
    id: r.user_id, uid: r.user_id, taskId: r.task_id,
    username: r.username, name: r.name, taskTitle: r.task_title,
    category: r.category, text: r.text, link: r.link,
    status: r.status, submittedAt: r.submitted_at,
  };
}
