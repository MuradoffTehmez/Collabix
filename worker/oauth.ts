// OAuth 2.0 — GitHub / Google / LinkedIn (TASK-8 / FAZA 2 / Bənd 5).
//
// AXIN:
//   1. GET /api/auth/oauth/:provider/start
//        → `state` (CSRF) yaradılır, KV-yə yazılır, cookie-yə qoyulur
//        → istifadəçi provayderə yönləndirilir
//   2. Provayder geri qaytarır: GET /api/auth/oauth/:provider/callback?code=..&state=..
//        → `state` cookie İLƏ KV-dəki dəyər tutuşdurulur (ikiqat yoxlama)
//        → code → access_token → profil
//        → hesab həlli: bağlıdır? email uyğun gəlir? yoxsa yeni qeydiyyat?
//
// GRACEFUL DEGRADATION: provayderin client id/secret cütü yoxdursa o provayder
// sadəcə MÖVCUD DEYİL — `/api/config` onu siyahıya salmır, frontend düyməsini
// göstərmir, endpoint-lər 404 qaytarır. Açar qoyulan an işə düşür.

import { Env, uuid, now } from './util';

/* ================= provayder konfiqurasiyası ================= */

export interface OAuthProfile {
  providerId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  login: string;      // provayderdəki istifadəçi adı (username təklifi üçün)
  avatar: string;
}

interface ProviderDef {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  idVar: keyof Env;
  secretVar: keyof Env;
  fetchProfile(accessToken: string): Promise<OAuthProfile>;
}

// Bütün provayderlərə eyni User-Agent lazımdır (GitHub onsuz 403 verir).
const UA = { 'User-Agent': 'Collabix-OAuth' };

const json = async (res: Response) => {
  if (!res.ok) throw new Error(`provayder cavabı ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json<any>();
};

export const PROVIDERS: Record<string, ProviderDef> = {
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    idVar: 'OAUTH_GITHUB_ID', secretVar: 'OAUTH_GITHUB_SECRET',
    async fetchProfile(token) {
      const h = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', ...UA };
      const u = await json(await fetch('https://api.github.com/user', { headers: h }));
      // GitHub profil email-i GİZLİ ola bilər (`user.email === null`) — o halda
      // ayrıca endpoint-dən doğrulanmış primary email çəkilir. Bu addım olmasa
      // GitHub istifadəçilərinin böyük hissəsi email-siz gələr və hesab
      // birləşdirmə işləməzdi.
      let email = u.email || '';
      let verified = !!u.email;
      if (!email) {
        try {
          const list = await json(await fetch('https://api.github.com/user/emails', { headers: h }));
          const primary = list.find((e: any) => e.primary && e.verified) || list.find((e: any) => e.verified);
          if (primary) { email = primary.email; verified = true; }
        } catch { /* email scope verilməyib — email-siz davam edirik */ }
      }
      return {
        providerId: String(u.id), email, emailVerified: verified,
        name: u.name || u.login || '', login: u.login || '', avatar: u.avatar_url || '',
      };
    },
  },

  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    idVar: 'OAUTH_GOOGLE_ID', secretVar: 'OAUTH_GOOGLE_SECRET',
    async fetchProfile(token) {
      const u = await json(await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${token}`, ...UA },
      }));
      return {
        providerId: String(u.sub), email: u.email || '', emailVerified: !!u.email_verified,
        name: u.name || '', login: (u.email || '').split('@')[0] || '', avatar: u.picture || '',
      };
    },
  },

  linkedin: {
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scope: 'openid profile email',
    idVar: 'OAUTH_LINKEDIN_ID', secretVar: 'OAUTH_LINKEDIN_SECRET',
    async fetchProfile(token) {
      const u = await json(await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}`, ...UA },
      }));
      return {
        providerId: String(u.sub), email: u.email || '', emailVerified: !!u.email_verified,
        name: u.name || '', login: (u.email || '').split('@')[0] || '', avatar: u.picture || '',
      };
    },
  },
};

// Provayder yalnız HƏR İKİ açarı varsa "qurulmuş" sayılır.
// Birini unutmaq ən çox rast gəlinən konfiq səhvidir — yarımçıq konfiqi
// aktiv saymaq istifadəçini işləməyən düyməyə aparardı.
export function isConfigured(env: Env, name: string): boolean {
  const p = PROVIDERS[name];
  return !!p && !!env[p.idVar] && !!env[p.secretVar];
}

export const configuredProviders = (env: Env): string[] =>
  Object.keys(PROVIDERS).filter(n => isConfigured(env, n));

/* ================= state (CSRF) ================= */

export const STATE_COOKIE = 'cx_oauth';
const STATE_TTL = 600;   // 10 dəqiqə — istifadəçi provayderdə bu qədər qala bilər

export interface StateData {
  provider: string;
  // Bağlama rejimi: giriş etmiş istifadəçi profilinə əlavə provayder qoşur.
  // Boşdursa adi giriş/qeydiyyat axınıdır.
  linkUid?: string;
  returnTo: string;
}

// `state` HƏM KV-də, HƏM cookie-də saxlanılır və callback-də ikisi tutuşdurulur.
//
// Niyə ikisi birdən? Tək cookie: hücumçu öz state-ini qurbanın brauzerinə yaza
// bilər (login CSRF → qurban hücumçunun hesabına bağlanar). Tək KV: state
// dəyəri URL-də gedir, yəni loglardan/referer-dən sızsa təkrar istifadə oluna
// bilər. İkisinin uyğunluğu hər iki vektoru bağlayır.
export async function createState(env: Env, data: StateData): Promise<{ state: string; cookie: string }> {
  const state = uuid() + uuid();
  await env.SESSIONS.put(`oauth:${state}`, JSON.stringify(data), { expirationTtl: STATE_TTL });
  return {
    state,
    // SameSite=Lax MƏCBURİDİR: callback provayderdən gələn TOP-LEVEL
    // naviqasiyadır; `Strict` olsaydı cookie göndərilməz və hər giriş sınardı.
    cookie: `${STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=${STATE_TTL}`,
  };
}

export async function consumeState(env: Env, urlState: string, cookieState: string | null): Promise<StateData | null> {
  if (!urlState || !cookieState || urlState !== cookieState) return null;
  const raw = await env.SESSIONS.get(`oauth:${urlState}`);
  if (!raw) return null;
  // BİRDƏFƏLİK: oxunan kimi silinir → replay mümkün deyil.
  await env.SESSIONS.delete(`oauth:${urlState}`);
  try { return JSON.parse(raw) as StateData; } catch { return null; }
}

export const clearStateCookie = () =>
  `${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=0`;

/* ================= authorize / token ================= */

export const redirectUri = (url: URL, provider: string) =>
  `${url.origin}/api/auth/oauth/${provider}/callback`;

export function authorizeUrl(env: Env, url: URL, provider: string, state: string): string {
  const p = PROVIDERS[provider];
  const q = new URLSearchParams({
    client_id: String(env[p.idVar]),
    redirect_uri: redirectUri(url, provider),
    response_type: 'code',
    scope: p.scope,
    state,
  });
  return `${p.authorizeUrl}?${q.toString()}`;
}

export async function exchangeCode(env: Env, url: URL, provider: string, code: string): Promise<string> {
  const p = PROVIDERS[provider];
  const res = await fetch(p.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', ...UA },
    body: new URLSearchParams({
      client_id: String(env[p.idVar]),
      client_secret: String(env[p.secretVar]),
      code,
      redirect_uri: redirectUri(url, provider),
      grant_type: 'authorization_code',
    }),
  });
  const data = await json(res);
  // Provayderlər xətanı 200 ilə də qaytara bilir (GitHub belə edir) —
  // status kifayət etmir, gövdə yoxlanılmalıdır.
  if (!data.access_token) throw new Error(`token alınmadı: ${data.error_description || data.error || 'naməlum'}`);
  return data.access_token as string;
}

export const fetchProfile = (provider: string, token: string) => PROVIDERS[provider].fetchProfile(token);

/* ================= gözləyən qeydiyyat (18+ qapısı) ================= */

// OAuth profili YAŞ vermir, platforma isə 18+-dır. Ona görə yeni istifadəçi
// üçün hesab callback-də DƏRHAL YARADILMIR: profil qısaömürlü "bilet" kimi
// KV-yə yazılır, istifadəçi sihirbaza yönləndirilir və orada doğum tarixini
// (18+ yoxlaması) və istifadəçi adını təsdiqləyir. Yalnız bundan sonra hesab
// yaranır. Belədə mövcud yaş qapısı OAuth ilə KEÇİLMİR.
const PENDING_TTL = 900;   // 15 dəqiqə — sihirbazı doldurmağa kifayət edir

export interface PendingSignup extends OAuthProfile { provider: string }

export async function createPending(env: Env, data: PendingSignup): Promise<string> {
  const ticket = uuid() + uuid();
  await env.SESSIONS.put(`oauthpend:${ticket}`, JSON.stringify(data), { expirationTtl: PENDING_TTL });
  return ticket;
}

export const readPending = async (env: Env, ticket: string): Promise<PendingSignup | null> => {
  if (!ticket) return null;
  const raw = await env.SESSIONS.get(`oauthpend:${ticket}`);
  try { return raw ? JSON.parse(raw) as PendingSignup : null; } catch { return null; }
};

export const consumePending = (env: Env, ticket: string) => env.SESSIONS.delete(`oauthpend:${ticket}`);

/* ================= istifadəçi adı təklifi ================= */

// Provayderdəki addan etibarlı, BOŞ OLAN Collabix istifadəçi adı düzəldir.
// `validUsername` qaydası: 3-20 simvol, yalnız [a-z0-9._].
export async function suggestUsername(env: Env, login: string, email: string): Promise<string> {
  const base = (login || email.split('@')[0] || 'user')
    .toLowerCase().normalize('NFKC').replace(/[^a-z0-9._]/g, '').slice(0, 16) || 'user';
  const padded = base.length >= 3 ? base : (base + 'user').slice(0, 16);

  for (let i = 0; i < 12; i++) {
    // İlk cəhd təmiz addır; sonrakılar rəqəm əlavə edir (ad tutulubsa).
    const candidate = i === 0 ? padded : `${padded}${i}`.slice(0, 20);
    const taken = await env.DB.prepare('SELECT 1 FROM users WHERE username = ?').bind(candidate).first();
    if (!taken) return candidate;
  }
  // Bütün variantlar tutulubsa təsadüfi sonluq — praktikada bura düşülmür.
  return `${padded.slice(0, 12)}${Math.floor(Math.random() * 100000)}`.slice(0, 20);
}

/* ================= hesab həlli ================= */

export type ResolveOutcome =
  | { kind: 'login'; uid: string }                    // artıq bağlıdır
  | { kind: 'linked'; uid: string }                   // email üzrə mövcud hesaba bağlandı
  | { kind: 'signup'; profile: PendingSignup };       // yeni istifadəçi — sihirbaza

export async function resolveAccount(env: Env, provider: string, profile: OAuthProfile): Promise<ResolveOutcome> {
  // 1) Bu provayder hesabı artıq bağlıdırsa — birbaşa giriş.
  const linked = await env.DB.prepare(
    'SELECT uid FROM oauth_accounts WHERE provider = ? AND provider_id = ?',
  ).bind(provider, profile.providerId).first<any>();
  if (linked) return { kind: 'login', uid: linked.uid };

  // 2) DOĞRULANMIŞ email mövcud hesabla üst-üstə düşürsə — avtomatik bağla.
  //
  // ⚠ `emailVerified` şərtdir. Doğrulanmamış email ilə bağlasaydıq, hücumçu
  //    provayderdə qurbanın email-ini yazıb onun Collabix hesabını ələ keçirərdi
  //    (klassik "pre-account takeover"). Doğrulanmamış email sadəcə iqnor olunur.
  if (profile.email && profile.emailVerified) {
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND email != \'\'',
    ).bind(profile.email.toLowerCase()).first<any>();
    if (existing) {
      await env.DB.prepare(
        'INSERT OR IGNORE INTO oauth_accounts (provider, provider_id, uid, email, login, linked_at) VALUES (?,?,?,?,?,?)',
      ).bind(provider, profile.providerId, existing.id, profile.email.toLowerCase(), profile.login, now()).run();
      return { kind: 'linked', uid: existing.id };
    }
  }

  // 3) Yeni istifadəçi — hesab HƏLƏ yaradılmır (18+ qapısı, yuxarıdakı izah).
  return { kind: 'signup', profile: { ...profile, provider } };
}
