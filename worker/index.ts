// Collabix Worker: statik sayt (ASSETS) + REST API (D1/R2/KV) + security headers.
import { Env, Ctx, err, fromJSON } from './util';
import { resolveUser, rateLimit, peekUid, RL, RateBucket } from './auth';
import { logSecurityEvent, csrfSuspicion } from './security';
import { runArchiveJob } from './archive';
import { handleQueueBatch } from './queue';
import { SystemEvent } from './events';
import * as R from './routes';
import { matchPublicRoute, buildMeta, rewriteHead, buildRobots, buildSitemap, buildLlms } from './seo';
import { ogImageResponse, ogDefaultResponse } from './og';
import { handleChat } from './services/ai';
import { handleSearchSemantic } from './services/search';
import { noteSocket } from './ws-kick';
import { runWithRequestContext, newRequestContext, log } from './request-context';
import { alert } from './alerts';
import { moderationState, requirePermission } from './rbac';

// Durable Object-lar (realtime) — binding class_name-ləri burdan export olunmalıdır.
export { RoomDO } from './room-do';
export { PresenceDO } from './presence-do';
export { RateLimitDO } from './rate-limit-do';
export { CollabixWorkflow } from './workflows/index';

// TASK-11 team route-ları ayrıca modulda saxlanılır və LAZY yüklənir: bundle
// yalnız `/api/teams/*` sorğusunda parse olunur, qalan endpointlərin soyuq
// start vaxtına təsir etmir.
type TeamRoutes = typeof import('./team-routes');
const TR = async (_c: Ctx, fn: (m: TeamRoutes) => Promise<Response>) => fn(await import('./team-routes'));

type Handler = (c: Ctx, ...params: string[]) => Promise<Response>;
interface Route {
  method: string;
  pattern: RegExp;
  handler: Handler;
  auth?: boolean;      // giriş tələb olunur
  admin?: boolean;     // ⚠ KÖHNƏ binar qapı — bax `perm`
  /**
   * PRD §5 icazə qapısı — `admin: true`-nun yerini tutur.
   *
   * ⚠ NİYƏ `admin` SAXLANILIR: iki qapı fərqli suala cavab verir.
   *   `admin: true` → "bu hesab `admins` cədvəlindədir?" (binar, rolsuz)
   *   `perm: 'X'`   → "bu hesabın X icazəsi var?" (rol matrisi + fərdi istisna)
   *
   *   Yeni marşrutlar YALNIZ `perm` işlətməlidir. `admin` yalnız o marşrutlar
   *   üçün qalır ki, konkret icazəyə bağlanması mənasız olsun (hazırda: yoxdur
   *   — hamısı köçürülüb; sahə fövqəladə bootstrap üçün saxlanılır).
   *
   * ⚠ İkisi birlikdə verilsə HƏR İKİSİ tələb olunur (VƏ məntiqi), çünki
   *   qapıların zəifləməsi sükutla baş verməməlidir.
   */
  perm?: string;
  /**
   * Rate-limit səbəti (auth.ts-dəki `RL` cədvəli tək mənbədir).
   *
   * AUDIT-TASK-4 / H-4 — DEFAULT DENY: sahə verilmirsə route avtomatik
   * `DEFAULT_RL` səbətinə düşür. Limitsiz qalmaq üçün `rl: 'none'` AÇIQ
   * yazılmalıdır ki, istisna kod baxışında görünsün.
   *
   * Tip birləşməsi qəsdən dardır: `rl: 'typo'` yazılsa `tsc` sınır — səhv
   * səbət adı sükutla `read`-ə düşməməlidir.
   */
  rl?: RateBucket | 'none';
}

/**
 * `rl` verilməyən route-un düşdüyü səbət — AUDIT-TASK-4 / H-4.
 *
 * Əvvəl: `rl` verilməyən route LİMİTSİZ idi → 171 route-dan 107-si qorunmurdu
 * (Workers AI, Vectorize, presence və admin tam-skan sorğuları daxil).
 * İndi: yeni route əlavə edən developer rate limit haqqında unutsa belə
 * təhlükəsiz default işləyir.
 *
 * Qeyd: cədvəldəki BÜTÜN route-lar hazırda açıq `rl` daşıyır (təsnifat kod
 * baxışında görünsün deyə). Bu default gələcək route-lar üçün torbadır.
 */
const DEFAULT_RL: RateBucket = 'read';

const ROUTES: Route[] = [
  // auth
  { method: 'POST', pattern: /^\/api\/auth\/register$/, handler: R.register, rl: 'auth' },
  { method: 'POST', pattern: /^\/api\/auth\/login$/, handler: R.login, rl: 'auth' },
  { method: 'POST', pattern: /^\/api\/auth\/logout$/, handler: R.logout, rl: 'write' },
  // Access token yeniləmə (TASK-8 / Bənd 15). `auth` YOXDUR: bura məhz access
  // token bitəndə gəlinir — giriş tələb etsəydi funksiya öz-özünü bloklayardı.
  // Kimlik refresh cookie-si ilə sübut olunur.
  { method: 'POST', pattern: /^\/api\/auth\/refresh$/, handler: R.refresh, rl: 'refresh' },
  { method: 'GET', pattern: /^\/api\/auth\/me$/, handler: R.me, rl: 'read' },
  // 2FA / TOTP (Bənd 2). `mfa` girişin İKİNCİ addımıdır — `auth: true` YOXDUR,
  // çünki sessiya hələ verilməyib; kimlik challenge token-i ilə sübut olunur.
  { method: 'POST', pattern: /^\/api\/auth\/mfa$/, handler: R.mfaVerify, rl: 'auth' },
  { method: 'GET', pattern: /^\/api\/me\/mfa$/, handler: R.mfaStatus, auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/me\/mfa\/setup$/, handler: R.mfaSetup, auth: true, rl: 'auth' },
  { method: 'POST', pattern: /^\/api\/me\/mfa\/confirm$/, handler: R.mfaConfirm, auth: true, rl: 'auth' },
  { method: 'POST', pattern: /^\/api\/me\/mfa\/backup-codes$/, handler: R.mfaRegenerateBackup, auth: true, rl: 'auth' },
  { method: 'DELETE', pattern: /^\/api\/me\/mfa$/, handler: R.mfaDisable, auth: true, rl: 'auth' },
  // Magic link (Bənd 4). `consume` brauzer naviqasiyasıdır (302), `request`
  // isə XHR — ikisi də giriş tələb etmir, kimlik məhz burada qurulur.
  { method: 'POST', pattern: /^\/api\/auth\/magic-link$/, handler: R.magicLinkRequest, rl: 'auth' },
  { method: 'GET', pattern: /^\/api\/auth\/magic\/([\w-]+)$/, handler: R.magicLinkConsume, rl: 'auth' },
  // Parol bərpası (AUDIT-TASK-10 / Faza 5/#5). `auth: true` YOXDUR — məhz
  // giriş edə bilməyən istifadəçi üçündür. `auth` səbəti: brute-force qapısı.
  { method: 'POST', pattern: /^\/api\/auth\/password-reset$/, handler: R.passwordResetRequest, rl: 'auth' },
  { method: 'POST', pattern: /^\/api\/auth\/password-reset\/confirm$/, handler: R.passwordResetConfirm, rl: 'auth' },
  // OAuth 2.0 (Bənd 5). `start` və `callback` BRAUZER NAVİQASİYASIDIR (302),
  // ona görə `auth: true` qoyulmur — kimlik `state` cookie-si ilə daşınır.
  { method: 'GET', pattern: /^\/api\/auth\/oauth\/(github|google|linkedin)\/start$/, handler: R.oauthStart, rl: 'auth' },
  // Callback sessiya YARADIR — yəni girişin ikinci addımıdır və `start` ilə
  // eyni `auth` səbətinə düşməlidir, `read`-ə yox.
  { method: 'GET', pattern: /^\/api\/auth\/oauth\/(github|google|linkedin)\/callback$/, handler: R.oauthCallback, rl: 'auth' },
  { method: 'GET', pattern: /^\/api\/auth\/oauth\/pending$/, handler: R.oauthPending, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/me\/oauth$/, handler: R.listOAuthAccounts, auth: true, rl: 'read' },
  { method: 'DELETE', pattern: /^\/api\/me\/oauth\/(github|google|linkedin)$/, handler: R.unlinkOAuth, auth: true, rl: 'write' },
  // Aktiv sessiyalar / cihazlar (Bənd 3)
  { method: 'GET', pattern: /^\/api\/auth\/sessions$/, handler: R.listSessions, auth: true, rl: 'read' },
  { method: 'DELETE', pattern: /^\/api\/auth\/sessions\/others$/, handler: R.revokeOtherSessions, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/auth\/sessions\/([\w-]+)$/, handler: R.revokeOneSession, auth: true, rl: 'write' },
  { method: 'GET', pattern: /^\/api\/auth\/username-available$/, handler: R.usernameAvailable, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/auth\/change-password$/, handler: R.changePassword, auth: true, rl: 'auth' },
  { method: 'POST', pattern: /^\/api\/auth\/change-username$/, handler: R.changeUsername, auth: true, rl: 'auth' },
  { method: 'DELETE', pattern: /^\/api\/auth\/account$/, handler: R.deleteAccount, auth: true, rl: 'auth' },

  // TASK-8 / FAZA 4 — axtarış, statistika, fəaliyyət, GDPR ixracı
  { method: 'GET', pattern: /^\/api\/search$/, handler: R.globalSearch, auth: true, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/users\/([\w.]+)\/stats$/, handler: R.userStats, auth: true, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/users\/([\w.]+)\/activity$/, handler: R.activityFor, auth: true, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/me\/export$/, handler: R.exportMyData, auth: true, rl: 'heavy' },

  // users / profil / sosial
  { method: 'GET', pattern: /^\/api\/users$/, handler: R.listUsers, auth: true, rl: 'read' },
  // İstifadəçilər səhifəsi üçün sıralanan/filtrlənən/səhifələnən kataloq (TASK-6).
  { method: 'GET', pattern: /^\/api\/users\/directory$/, handler: R.usersDirectory, auth: true, rl: 'read' },
  /* Kataloq əlavələri (miqrasiya 0050/0051).
     ⚠ Bu üçü `/api/users/([\w-]+)` kimi parametrli naxışlardan ƏVVƏL
       gəlməlidir — sabit seqment parametrli naxışa da uyğun gəlir. */
  { method: 'GET', pattern: /^\/api\/users\/suggested$/, handler: R.suggestedUsers, auth: true, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/users\/dir-stats$/, handler: R.directoryStats, auth: true, rl: 'read' },
  /* CSV ixracı `heavy` səbətindədir: cari filtrlə 500 sətrə qədər YIĞIR,
     yəni bir çağırış 9 ardıcıl D1 səhifə sorğusuna qədər çəkə bilər.
     `read` səbətində olsaydı istifadəçi onu təkrar-təkrar çağıraraq bazanı
     yükləyə bilərdi. */
  { method: 'GET', pattern: /^\/api\/users\/export\.csv$/, handler: R.exportDirectory, auth: true, rl: 'heavy' },
  { method: 'PATCH', pattern: /^\/api\/me$/, handler: R.patchMe, auth: true, rl: 'write' },
  { method: 'PATCH', pattern: /^\/api\/me\/settings$/, handler: R.patchSettings, auth: true, rl: 'write' },
  { method: 'GET', pattern: /^\/api\/me\/social$/, handler: R.mySocial, auth: true, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/users\/([\w-]+)\/follow-lists$/, handler: R.followLists, auth: true, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/users\/([\w-]+)\/progress$/, handler: R.progressOf, auth: true, rl: 'read' },
  { method: 'PUT', pattern: /^\/api\/follows\/([\w-]+)$/, handler: R.followPut, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/follows\/([\w-]+)$/, handler: R.followDelete, auth: true, rl: 'write' },
  { method: 'PUT', pattern: /^\/api\/bookmarks\/([\w-]+)$/, handler: R.bookmarkPut, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/bookmarks\/([\w-]+)$/, handler: R.bookmarkDelete, auth: true, rl: 'write' },

  // posts
  { method: 'GET', pattern: /^\/api\/feed$/, handler: R.feed, auth: true, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/posts\/([\w-]+)$/, handler: R.getPost, auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/posts$/, handler: R.createPost, auth: true, rl: 'write' },
  { method: 'PATCH', pattern: /^\/api\/posts\/([\w-]+)$/, handler: R.patchPost, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/posts\/([\w-]+)$/, handler: R.deletePost, auth: true, rl: 'write' },
  { method: 'POST', pattern: /^\/api\/posts\/([\w-]+)\/repost$/, handler: R.toggleRepost, auth: true, rl: 'write' },
  { method: 'PUT', pattern: /^\/api\/posts\/([\w-]+)\/like$/, handler: R.likePut, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/posts\/([\w-]+)\/like$/, handler: R.likeDelete, auth: true, rl: 'write' },
  { method: 'GET', pattern: /^\/api\/posts\/([\w-]+)\/comments$/, handler: R.listComments, auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/posts\/([\w-]+)\/comments$/, handler: R.addComment, auth: true, rl: 'write' },
  { method: 'PATCH', pattern: /^\/api\/posts\/([\w-]+)\/comments\/([\w-]+)$/, handler: R.editComment, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/posts\/([\w-]+)\/comments\/([\w-]+)$/, handler: R.deleteComment, auth: true, rl: 'write' },
  { method: 'PUT', pattern: /^\/api\/posts\/([\w-]+)\/comments\/([\w-]+)\/like$/, handler: R.commentLikePut, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/posts\/([\w-]+)\/comments\/([\w-]+)\/like$/, handler: R.commentLikeDelete, auth: true, rl: 'write' },
  // Şərh sistemi (0039) — reaksiya / moderasiya / şikayət.
  // ⚠ `reaction` marşrutu `like`-dan SONRA gəlir; naxışlar kəsişmir, amma
  //   sıra oxunaqlılıq üçün məntiqi qruplaşdırılıb.
  { method: 'PUT', pattern: /^\/api\/posts\/([\w-]+)\/comments\/([\w-]+)\/reaction$/, handler: R.commentReactionPut, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/posts\/([\w-]+)\/comments\/([\w-]+)\/reaction$/, handler: R.commentReactionDelete, auth: true, rl: 'write' },
  { method: 'PUT', pattern: /^\/api\/posts\/([\w-]+)\/comments\/([\w-]+)\/pin$/, handler: R.commentPin, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/posts\/([\w-]+)\/comments\/([\w-]+)\/pin$/, handler: R.commentUnpin, auth: true, rl: 'write' },
  // Gizlət/bərpa: `perm` YOX, handler-in özü `c.isAdmin` yoxlayır — moderasiya
  // qərarı post müəllifinə DEYİL, yalnız platforma admininə aiddir.
  { method: 'PUT', pattern: /^\/api\/posts\/([\w-]+)\/comments\/([\w-]+)\/hide$/, handler: R.commentHide, auth: true, rl: 'admin' },
  { method: 'DELETE', pattern: /^\/api\/posts\/([\w-]+)\/comments\/([\w-]+)\/hide$/, handler: R.commentRestore, auth: true, rl: 'admin' },
  { method: 'POST', pattern: /^\/api\/posts\/([\w-]+)\/comments\/([\w-]+)\/report$/, handler: R.commentReport, auth: true, rl: 'write' },
  // Post reaksiya / moderasiya / şikayət (0040) — şərhlərdəki modelin eynisi.
  { method: 'PUT', pattern: /^\/api\/posts\/([\w-]+)\/reaction$/, handler: R.postReactionPut, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/posts\/([\w-]+)\/reaction$/, handler: R.postReactionDelete, auth: true, rl: 'write' },
  { method: 'PUT', pattern: /^\/api\/posts\/([\w-]+)\/pin$/, handler: R.postPin, auth: true, rl: 'admin' },
  { method: 'DELETE', pattern: /^\/api\/posts\/([\w-]+)\/pin$/, handler: R.postUnpin, auth: true, rl: 'admin' },
  { method: 'PUT', pattern: /^\/api\/posts\/([\w-]+)\/hide$/, handler: R.postHide, auth: true, rl: 'admin' },
  { method: 'DELETE', pattern: /^\/api\/posts\/([\w-]+)\/hide$/, handler: R.postRestore, auth: true, rl: 'admin' },
  { method: 'POST', pattern: /^\/api\/posts\/([\w-]+)\/report$/, handler: R.postReport, auth: true, rl: 'write' },
  // Sorğu səsverməsi (0043) — eyni variantı təkrar seçmək səsi götürür.
  { method: 'POST', pattern: /^\/api\/posts\/([\w-]+)\/poll\/vote$/, handler: R.pollVote, auth: true, rl: 'write' },

  // rooms
  { method: 'GET', pattern: /^\/api\/rooms$/, handler: R.listRooms, auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/rooms$/, handler: R.createRoom, auth: true, perm: 'MANAGE_ROOMS', rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/rooms\/([\w-]+)$/, handler: R.deleteRoom, auth: true, perm: 'MANAGE_ROOMS', rl: 'write' },
  // Otaq ikonu (0048) — silmə ilə eyni icazə: otağın görünüşünü dəyişməkdir.
  { method: 'PATCH', pattern: /^\/api\/rooms\/([\w-]+)$/, handler: R.patchRoom, auth: true, perm: 'MANAGE_ROOMS', rl: 'write' },
  { method: 'GET', pattern: /^\/api\/rooms\/([\w-]+)\/messages$/, handler: R.roomMessages, auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/rooms\/([\w-]+)\/messages$/, handler: R.sendRoomMessage, auth: true, rl: 'write' },
  { method: 'PATCH', pattern: /^\/api\/rooms\/([\w-]+)\/messages\/([\w-]+)$/, handler: R.editRoomMessage, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/rooms\/([\w-]+)\/messages\/([\w-]+)$/, handler: R.deleteRoomMessage, auth: true, rl: 'write' },
  // Sabitlənmiş mesajlar (0046). Şərh pin-i ilə eyni PUT/DELETE konvensiyası.
  { method: 'GET', pattern: /^\/api\/rooms\/([\w-]+)\/pins$/, handler: R.listRoomPins, auth: true, rl: 'read' },
  { method: 'PUT', pattern: /^\/api\/rooms\/([\w-]+)\/messages\/([\w-]+)\/pin$/, handler: R.pinRoomMessage, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/rooms\/([\w-]+)\/messages\/([\w-]+)\/pin$/, handler: R.unpinRoomMessage, auth: true, rl: 'write' },
  // Reaksiya · əlfəcin (0047). Şərh reaksiyaları ilə eyni PUT/DELETE konvensiyası.
  { method: 'PUT', pattern: /^\/api\/rooms\/([\w-]+)\/messages\/([\w-]+)\/reaction$/, handler: R.roomReactionPut, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/rooms\/([\w-]+)\/messages\/([\w-]+)\/reaction$/, handler: R.roomReactionDelete, auth: true, rl: 'write' },
  { method: 'PUT', pattern: /^\/api\/rooms\/([\w-]+)\/messages\/([\w-]+)\/bookmark$/, handler: R.roomBookmarkPut, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/rooms\/([\w-]+)\/messages\/([\w-]+)\/bookmark$/, handler: R.roomBookmarkDelete, auth: true, rl: 'write' },

  // dms
  { method: 'GET', pattern: /^\/api\/dms$/, handler: R.listThreads, auth: true, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/dms\/([\w_-]+)\/messages$/, handler: R.dmMessages, auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/dms\/to\/([\w-]+)$/, handler: R.sendDM, auth: true, rl: 'write' },
  { method: 'PATCH', pattern: /^\/api\/dms\/([\w_-]+)\/messages\/([\w-]+)$/, handler: R.editDM, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/dms\/([\w_-]+)\/messages\/([\w-]+)$/, handler: R.deleteDMMsg, auth: true, rl: 'write' },
  { method: 'POST', pattern: /^\/api\/dms\/([\w_-]+)\/read$/, handler: R.markThreadRead, auth: true, rl: 'write' },
  { method: 'GET', pattern: /^\/api\/dms\/([\w_-]+)\/pins$/, handler: R.listDMPins, auth: true, rl: 'read' },
  { method: 'PUT', pattern: /^\/api\/dms\/([\w_-]+)\/messages\/([\w-]+)\/pin$/, handler: R.pinDMMessage, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/dms\/([\w_-]+)\/messages\/([\w-]+)\/pin$/, handler: R.unpinDMMessage, auth: true, rl: 'write' },
  { method: 'PUT', pattern: /^\/api\/dms\/([\w_-]+)\/messages\/([\w-]+)\/reaction$/, handler: R.dmReactionPut, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/dms\/([\w_-]+)\/messages\/([\w-]+)\/reaction$/, handler: R.dmReactionDelete, auth: true, rl: 'write' },
  { method: 'PUT', pattern: /^\/api\/dms\/([\w_-]+)\/messages\/([\w-]+)\/bookmark$/, handler: R.dmBookmarkPut, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/dms\/([\w_-]+)\/messages\/([\w-]+)\/bookmark$/, handler: R.dmBookmarkDelete, auth: true, rl: 'write' },
  /* Forward — HƏR İKİ istiqamət (otaq↔DM) üçün TƏK endpoint.
     Mənbə və hədəf gövdədədir, çünki marşrut naxışı iki fərqli scope-u
     eyni anda ifadə edə bilmir. */
  { method: 'POST', pattern: /^\/api\/messages\/forward$/, handler: R.forwardMessage, auth: true, rl: 'write' },
  /* Link önizləməsi (OG unfurl).
     ⚠ `rl: 'heavy'` — endpoint XARİCİ sayta sorğu göndərir; adi `read`
       səbətində olsaydı bir istifadəçi serveri yad saytlara sorğu maşınına
       çevirə bilərdi. Nəticə həm də KV-də 24 saat keşlənir. */
  { method: 'GET', pattern: /^\/api\/link-preview$/, handler: R.linkPreview, auth: true, rl: 'heavy' },
  /* Önizləmə şəklinin proxy-si — CSP `img-src 'self'` olduğu üçün MƏCBURDUR,
     həm də istifadəçinin IP-sini yad sayta sızmağa qoymur. */
  { method: 'GET', pattern: /^\/api\/link-image$/, handler: R.linkImage, auth: true, rl: 'read' },

  // presence + notifications
  { method: 'POST', pattern: /^\/api\/presence$/, handler: R.heartbeat, auth: true, rl: 'presence' },
  { method: 'GET', pattern: /^\/api\/presence$/, handler: R.presenceMap, auth: true, rl: 'presence' },
  { method: 'GET', pattern: /^\/api\/notifications$/, handler: R.listNotifs, auth: true, rl: 'read' },
  /* Bildiriş mərkəzi (miqrasiya 0049).
     🔴 SIRA BAĞLAYICIDIR: SABİT seqmentli naxışlar parametrli olanlardan
        ƏVVƏLDİR. `DELETE /api/notifications/([\w-]+)` naxışı `…/mutes`-a da
        uyğun gəlir — cədvəl ilk uyğunluğu seçdiyi üçün sabitləri qabağa
        qoymaq yeganə qorumadır. */
  { method: 'GET', pattern: /^\/api\/notifications\/stats$/, handler: R.notifStats, auth: true, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/notifications\/previews$/, handler: R.notifPreviews, auth: true, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/notifications\/mutes$/, handler: R.listMutes, auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/notifications\/mutes$/, handler: R.toggleMute, auth: true, rl: 'write' },
  { method: 'POST', pattern: /^\/api\/notifications\/read-all$/, handler: R.readAllNotifs, auth: true, rl: 'write' },
  /* Toplu əməliyyat — ən çox 200 sətir (bax `BULK_MAX`). `write` səbəti
     kifayətdir: seçim rejimi bir düymə basımına BİR sorğu göndərir. */
  { method: 'POST', pattern: /^\/api\/notifications\/bulk$/, handler: R.bulkNotifs, auth: true, rl: 'write' },
  { method: 'POST', pattern: /^\/api\/notifications\/([\w-]+)\/read$/, handler: R.readNotif, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/notifications\/([\w-]+)$/, handler: R.deleteNotif, auth: true, rl: 'write' },

  // tasks + submissions
  { method: 'GET', pattern: /^\/api\/tasks$/, handler: R.listTasks, auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/tasks$/, handler: R.createTask, auth: true, rl: 'write' },
  { method: 'POST', pattern: /^\/api\/tasks\/([\w-]+)\/review$/, handler: R.reviewTask, auth: true, perm: 'MANAGE_TASKS', rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/tasks\/([\w-]+)$/, handler: R.deleteTask, auth: true, perm: 'MANAGE_TASKS', rl: 'write' },
  { method: 'PUT', pattern: /^\/api\/tasks\/([\w-]+)\/submission$/, handler: R.submitSolution, auth: true, rl: 'write' },
  { method: 'GET', pattern: /^\/api\/submissions$/, handler: R.listSubmissions, auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/submissions\/([\w-]+)\/([\w-]+)\/review$/, handler: R.reviewSubmission, auth: true, perm: 'MANAGE_TASKS', rl: 'write' },

  // reports
  { method: 'POST', pattern: /^\/api\/reports$/, handler: R.createReport, auth: true, rl: 'write' },
  { method: 'GET', pattern: /^\/api\/reports$/, handler: R.listReports, auth: true, perm: 'VIEW_REPORTS', rl: 'read' },
  { method: 'PATCH', pattern: /^\/api\/reports\/([\w-]+)$/, handler: R.resolveReport, auth: true, perm: 'MANAGE_REPORTS', rl: 'write' },

  // taxonomy
  { method: 'GET', pattern: /^\/api\/taxonomies$/, handler: R.listTaxonomies, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/taxonomies\/(prog|spoken)$/, handler: R.saveTaxItem, auth: true, perm: 'MANAGE_CATEGORIES', rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/taxonomies\/(prog|spoken)\/([\w-]+)$/, handler: R.deactivateTaxItem, auth: true, perm: 'MANAGE_CATEGORIES', rl: 'write' },

  // public
  // Frontend boot-da çağırır (Turnstile site key) — giriş tələb etmir.
  { method: 'GET', pattern: /^\/api\/config$/, handler: R.publicConfig, rl: 'read' },
  // Sağlamlıq yoxlaması (AUDIT-TASK-6 §A-3) — bootstrap datasının itməsini
  // aşkarlayır. Autentifikasiyasızdır, ona görə heç bir detal sızdırmır.
  { method: 'GET', pattern: /^\/api\/health$/, handler: R.health, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/public\/faqs$/, handler: R.publicFaqs, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/public\/testimonials$/, handler: R.publicTestimonials, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/public\/stats$/, handler: R.publicStats, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/public\/posts\/([\w-]+)$/, handler: R.publicGetPost, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/public\/users\/([\w.]+)$/, handler: R.publicGetUser, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/public\/newsletter$/, handler: R.newsletterSubscribe, rl: 'form' },
  { method: 'POST', pattern: /^\/api\/public\/contact$/, handler: R.contactSubmit, rl: 'form' },

  // admin
  { method: 'GET', pattern: /^\/api\/admin\/faqs$/, handler: R.adminListFaqs, auth: true, perm: 'MANAGE_CONTENT', rl: 'admin' },
  { method: 'POST', pattern: /^\/api\/admin\/faqs$/, handler: R.adminSaveFaq, auth: true, perm: 'MANAGE_CONTENT', rl: 'admin' },
  { method: 'DELETE', pattern: /^\/api\/admin\/faqs\/([\w-]+)$/, handler: R.adminDeleteFaq, auth: true, perm: 'MANAGE_CONTENT', rl: 'admin' },
  { method: 'GET', pattern: /^\/api\/admin\/testimonials$/, handler: R.adminListTestimonials, auth: true, perm: 'MANAGE_CONTENT', rl: 'admin' },
  { method: 'POST', pattern: /^\/api\/admin\/testimonials$/, handler: R.adminSaveTestimonial, auth: true, perm: 'MANAGE_CONTENT', rl: 'admin' },
  { method: 'DELETE', pattern: /^\/api\/admin\/testimonials\/([\w-]+)$/, handler: R.adminDeleteTestimonial, auth: true, perm: 'MANAGE_CONTENT', rl: 'admin' },
  { method: 'GET', pattern: /^\/api\/admin\/contacts$/, handler: R.adminContacts, auth: true, perm: 'MANAGE_CONTACTS', rl: 'admin' },
  { method: 'POST', pattern: /^\/api\/admin\/contacts\/([\w-]+)\/read$/, handler: R.adminContactRead, auth: true, perm: 'MANAGE_CONTACTS', rl: 'admin' },
  { method: 'PATCH', pattern: /^\/api\/admin\/users\/([\w-]+)$/, handler: R.adminPatchUser, auth: true, perm: 'MANAGE_USERS', rl: 'admin' },
  { method: 'POST', pattern: /^\/api\/admin\/users\/([\w-]+)\/temp-password$/, handler: R.adminTempPassword, auth: true, perm: 'MANAGE_USERS', rl: 'admin' },
  { method: 'GET', pattern: /^\/api\/admin\/admins$/, handler: R.adminListAdmins, auth: true, perm: 'MANAGE_ROLES', rl: 'admin' },
  { method: 'PUT', pattern: /^\/api\/admin\/admins\/([\w-]+)$/, handler: R.adminAddAdmin, auth: true, perm: 'MANAGE_ROLES', rl: 'admin' },
  { method: 'DELETE', pattern: /^\/api\/admin\/admins\/([\w-]+)$/, handler: R.adminRemoveAdmin, auth: true, perm: 'MANAGE_ROLES', rl: 'admin' },
  { method: 'GET', pattern: /^\/api\/admin\/logs$/, handler: R.adminLogs, auth: true, perm: 'VIEW_AUDIT_LOG', rl: 'admin' },
  // TASK-6 / BÖLMƏ 3
  { method: 'GET', pattern: /^\/api\/admin\/users$/, handler: R.adminUsersList, auth: true, perm: 'MANAGE_USERS', rl: 'admin' },
  { method: 'POST', pattern: /^\/api\/admin\/users\/bulk$/, handler: R.adminBulkUsers, auth: true, perm: 'MANAGE_USERS', rl: 'admin' },

  // ═══ FAZA A2 — PRD §4-6: moderasiya, rol və icazə (AUDIT-TASK-10) ═══
  //
  // ⚠ `admin: true` bayrağı QOYULMUR — bu marşrutlar `requirePermission` ilə
  //   qorunur. Fərq mühümdür: `admin` BİNARdır, icazə isə rol ierarxiyasını
  //   nəzərə alır (MODERATOR xəbərdarlıq verə bilər, bloklaya bilməz).
  //   `auth: true` isə lazımdır — qonaq heç birinə çata bilməz.
  { method: 'GET',  pattern: /^\/api\/me\/permissions$/, handler: R.myPermissions, auth: true, rl: 'read' },
  { method: 'GET',  pattern: /^\/api\/roles$/, handler: R.listRoles, auth: true, rl: 'admin' },
  { method: 'PUT',  pattern: /^\/api\/users\/([\w-]+)\/role$/, handler: R.setUserRole, auth: true, rl: 'admin' },
  { method: 'PUT',  pattern: /^\/api\/users\/([\w-]+)\/permission$/, handler: R.setUserPermission, auth: true, rl: 'admin' },
  { method: 'GET',  pattern: /^\/api\/users\/([\w-]+)\/moderation$/, handler: R.moderationStatus, auth: true, rl: 'read' },
  { method: 'GET',  pattern: /^\/api\/users\/([\w-]+)\/warnings$/, handler: R.listWarnings, auth: true, rl: 'admin' },
  { method: 'POST', pattern: /^\/api\/users\/([\w-]+)\/warn$/, handler: R.warnUser, auth: true, rl: 'write' },
  { method: 'POST', pattern: /^\/api\/users\/([\w-]+)\/ban$/, handler: R.banUser, auth: true, rl: 'write' },
  { method: 'POST', pattern: /^\/api\/users\/([\w-]+)\/mute$/, handler: R.muteUser, auth: true, rl: 'write' },
  { method: 'POST', pattern: /^\/api\/users\/([\w-]+)\/restore$/, handler: R.restoreUser, auth: true, rl: 'write' },

  // ── Moderator namizədliyi — PRD §12 ──────────────────────────────────────
  //
  // ⚠ İlk üçündə `perm` YOXDUR və bu qəsdəndir: onlar İSTİFADƏÇİNİN ÖZ
  //   müraciətidir (`c.user!.id` ilə işləyir), başqasına toxunmur.
  //   Uyğunluq qapısı `evaluateEligibility`-nin içindədir.
  //
  // ⚠ Son ikisi `MANAGE_ROLES` tələb edir — namizədləri görmək və təsdiqləmək
  //   rol təyini prosesidir; moderatorun özü namizədləri görməməlidir
  //   (maraqlar toqquşması).
  { method: 'GET',  pattern: /^\/api\/me\/moderator-eligibility$/, handler: R.myModeratorEligibility, auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/me\/moderator-application$/, handler: R.applyForModerator, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/me\/moderator-application$/, handler: R.withdrawModeratorApplication, auth: true, rl: 'write' },
  // ── Dəvət axını — PRD §6 ─────────────────────────────────────────────────
  //
  // ⚠ `/api/invites/:code/check` QONAQ üçündür (`auth` YOXDUR): qeydiyyat
  //   formunda kod yazılarkən canlı yoxlanılır, istifadəçi isə hələ giriş
  //   etməyib. Cavab yalnız `valid` + dəvət edənin ADInı daşıyır — kod
  //   sadalayan hücumçu istifadəçi kataloqu çıxara bilməməlidir.
  { method: 'GET',    pattern: /^\/api\/invites\/([A-Za-z0-9]{1,16})\/check$/, handler: R.checkInvite, rl: 'read' },
  { method: 'GET',    pattern: /^\/api\/me\/invites$/, handler: R.myInvites, auth: true, rl: 'read' },
  { method: 'POST',   pattern: /^\/api\/me\/invites$/, handler: R.createInvite, auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/me\/invites\/([A-Za-z0-9]{1,16})$/, handler: R.revokeInvite, auth: true, rl: 'write' },
  { method: 'GET',    pattern: /^\/api\/admin\/invite-stats$/, handler: R.adminInviteStats, auth: true, perm: 'VIEW_ANALYTICS', rl: 'admin' },

  { method: 'GET',  pattern: /^\/api\/admin\/moderator-applications$/, handler: R.listModeratorApplications, auth: true, perm: 'MANAGE_ROLES', rl: 'admin' },
  { method: 'POST', pattern: /^\/api\/admin\/moderator-applications\/([\w-]+)\/review$/, handler: R.reviewModeratorApplication, auth: true, perm: 'MANAGE_ROLES', rl: 'admin' },
  { method: 'GET', pattern: /^\/api\/admin\/stats-daily$/, handler: R.adminStatsDaily, auth: true, perm: 'VIEW_ANALYTICS', rl: 'heavy' },
  { method: 'GET', pattern: /^\/api\/admin\/teams$/, handler: async (c) => TR(c, m => m.listAllTeams(c)), auth: true, perm: 'MANAGE_TEAMS', rl: 'admin' },
  { method: 'GET', pattern: /^\/api\/admin\/teams\/([\w-]+)$/, handler: async (c, id) => TR(c, m => m.adminTeamDetail(c, id)), auth: true, perm: 'MANAGE_TEAMS', rl: 'admin' },
  { method: 'POST', pattern: /^\/api\/admin\/teams\/([\w-]+)\/action$/, handler: async (c, id) => TR(c, m => m.adminTeamAction(c, id)), auth: true, perm: 'MANAGE_TEAMS', rl: 'admin' },
  { method: 'GET', pattern: /^\/api\/admin\/export\/(users|logs)\.csv$/, handler: R.adminExportCsv, auth: true, perm: 'SYSTEM_BACKUP', rl: 'heavy' },
  { method: 'POST', pattern: /^\/api\/taxonomies\/(prog|spoken)\/reorder$/, handler: R.reorderTaxonomy, auth: true, perm: 'MANAGE_CATEGORIES', rl: 'write' },
  { method: 'POST', pattern: /^\/api\/admin\/log$/, handler: R.adminLogAction, auth: true, perm: 'VIEW_AUDIT_LOG', rl: 'admin' },
  // TASK-8 / Bənd 1 — Threat Dashboard
  { method: 'GET', pattern: /^\/api\/admin\/security\/events$/, handler: R.securityEvents, auth: true, perm: 'VIEW_AUDIT_LOG', rl: 'admin' },
  { method: 'GET', pattern: /^\/api\/admin\/security\/summary$/, handler: R.securitySummary, auth: true, perm: 'VIEW_AUDIT_LOG', rl: 'admin' },

  // TASK-8 / Yeni Xidmətlər (AI, Vectorize)
  { method: 'POST', pattern: /^\/api\/ai\/chat$/, handler: handleChat, auth: true, rl: 'ai' },
  { method: 'GET', pattern: /^\/api\/search\/semantic$/, handler: handleSearchSemantic, auth: true, rl: 'search' },

  // ================= TASK-11 / Teams =================
  // TR() — hər team route-u üçün lazy import. Bütün endpointlər BİR dəfə
  // yazılır: əvvəl bu blokun 23 sətri aşağıda təkrarlanmışdı və hansı
  // tərifin işlədiyi görünmürdü.
  { method: 'GET', pattern: /^\/api\/teams$/, handler: async (c) => TR(c, m => m.getTeams(c)), auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/teams$/, handler: async (c) => TR(c, m => m.createTeam(c)), auth: true, rl: 'write' },
  { method: 'GET', pattern: /^\/api\/teams\/discover$/, handler: async (c) => TR(c, m => m.discoverTeams(c)), auth: true, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/teams\/([\w-]+)$/, handler: async (c, id) => TR(c, m => m.getTeam(c, id)), auth: true, rl: 'read' },
  { method: 'PATCH', pattern: /^\/api\/teams\/([\w-]+)$/, handler: async (c, id) => TR(c, m => m.updateTeam(c, id)), auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/teams\/([\w-]+)$/, handler: async (c, id) => TR(c, m => m.deleteTeam(c, id)), auth: true, rl: 'write' },
  { method: 'POST', pattern: /^\/api\/teams\/([\w-]+)\/join$/, handler: async (c, id) => TR(c, m => m.joinTeam(c, id)), auth: true, rl: 'write' },
  { method: 'POST', pattern: /^\/api\/teams\/([\w-]+)\/leave$/, handler: async (c, id) => TR(c, m => m.leaveTeam(c, id)), auth: true, rl: 'write' },
  { method: 'POST', pattern: /^\/api\/teams\/([\w-]+)\/transfer$/, handler: async (c, id) => TR(c, m => m.transferOwnership(c, id)), auth: true, rl: 'write' },
  { method: 'GET', pattern: /^\/api\/teams\/([\w-]+)\/search$/, handler: async (c, id) => TR(c, m => m.searchTeamWorkspace(c, id)), auth: true, rl: 'search' },
  { method: 'GET', pattern: /^\/api\/teams\/([\w-]+)\/ai\/summary$/, handler: async (c, id) => TR(c, m => m.getTeamAISummary(c, id)), auth: true, rl: 'ai' },

  // Members
  { method: 'GET', pattern: /^\/api\/teams\/([\w-]+)\/members$/, handler: async (c, id) => TR(c, m => m.getTeamMembers(c, id)), auth: true, rl: 'read' },
  { method: 'PATCH', pattern: /^\/api\/teams\/([\w-]+)\/members\/([\w-]+)$/, handler: async (c, id, uid) => TR(c, m => m.updateMemberRole(c, id, uid)), auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/teams\/([\w-]+)\/members\/([\w-]+)$/, handler: async (c, id, uid) => TR(c, m => m.removeTeamMember(c, id, uid)), auth: true, rl: 'write' },

  // Roles
  { method: 'GET', pattern: /^\/api\/teams\/([\w-]+)\/roles$/, handler: async (c, id) => TR(c, m => m.getTeamRoles(c, id)), auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/teams\/([\w-]+)\/roles$/, handler: async (c, id) => TR(c, m => m.createTeamRole(c, id)), auth: true, rl: 'write' },
  { method: 'PATCH', pattern: /^\/api\/teams\/([\w-]+)\/roles\/([\w-]+)$/, handler: async (c, id, rid) => TR(c, m => m.updateTeamRole(c, id, rid)), auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/teams\/([\w-]+)\/roles\/([\w-]+)$/, handler: async (c, id, rid) => TR(c, m => m.deleteTeamRole(c, id, rid)), auth: true, rl: 'write' },

  // Invites
  { method: 'GET', pattern: /^\/api\/invites$/, handler: async (c) => TR(c, m => m.getMyInvites(c)), auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/invites\/([\w-]+)\/accept$/, handler: async (c, iid) => TR(c, m => m.acceptTeamInvite(c, iid)), auth: true, rl: 'write' },
  { method: 'POST', pattern: /^\/api\/invites\/([\w-]+)\/decline$/, handler: async (c, iid) => TR(c, m => m.declineTeamInvite(c, iid)), auth: true, rl: 'write' },
  { method: 'GET', pattern: /^\/api\/teams\/([\w-]+)\/invites$/, handler: async (c, id) => TR(c, m => m.getTeamInvites(c, id)), auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/teams\/([\w-]+)\/invites$/, handler: async (c, id) => TR(c, m => m.createTeamInvite(c, id)), auth: true, rl: 'write' },
  { method: 'POST', pattern: /^\/api\/teams\/([\w-]+)\/invites\/([\w-]+)\/accept$/, handler: async (c, _t, i) => TR(c, m => m.acceptTeamInvite(c, i)), auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/teams\/([\w-]+)\/invites\/([\w-]+)$/, handler: async (c, t, i) => TR(c, m => m.deleteTeamInvite(c, t, i)), auth: true, rl: 'write' },

  // Projects
  { method: 'GET', pattern: /^\/api\/teams\/([\w-]+)\/projects$/, handler: async (c, id) => TR(c, m => m.getTeamProjects(c, id)), auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/teams\/([\w-]+)\/projects$/, handler: async (c, id) => TR(c, m => m.createTeamProject(c, id)), auth: true, rl: 'write' },
  { method: 'PATCH', pattern: /^\/api\/teams\/([\w-]+)\/projects\/([\w-]+)$/, handler: async (c, t, p) => TR(c, m => m.updateTeamProject(c, t, p)), auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/teams\/([\w-]+)\/projects\/([\w-]+)$/, handler: async (c, t, p) => TR(c, m => m.deleteTeamProject(c, t, p)), auth: true, rl: 'write' },
  { method: 'POST', pattern: /^\/api\/teams\/([\w-]+)\/projects\/([\w-]+)\/join$/, handler: async (c, t, p) => TR(c, m => m.joinTeamProject(c, t, p)), auth: true, rl: 'write' },
  { method: 'GET', pattern: /^\/api\/teams\/([\w-]+)\/projects\/([\w-]+)\/requests$/, handler: async (c, t, p) => TR(c, m => m.getProjectRequests(c, t, p)), auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/teams\/([\w-]+)\/projects\/([\w-]+)\/requests\/([\w-]+)\/approve$/, handler: async (c, t, p, r) => TR(c, m => m.approveProjectRequest(c, t, p, r)), auth: true, rl: 'write' },
  { method: 'POST', pattern: /^\/api\/teams\/([\w-]+)\/projects\/([\w-]+)\/requests\/([\w-]+)\/reject$/, handler: async (c, t, p, r) => TR(c, m => m.rejectProjectRequest(c, t, p, r)), auth: true, rl: 'write' },

  // Tasks
  { method: 'GET', pattern: /^\/api\/teams\/([\w-]+)\/tasks$/, handler: async (c, id) => TR(c, m => m.getTeamTasks(c, id)), auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/teams\/([\w-]+)\/tasks$/, handler: async (c, id) => TR(c, m => m.createTeamTask(c, id)), auth: true, rl: 'write' },
  { method: 'PATCH', pattern: /^\/api\/teams\/([\w-]+)\/tasks\/([\w-]+)$/, handler: async (c, t, tk) => TR(c, m => m.updateTeamTask(c, t, tk)), auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/teams\/([\w-]+)\/tasks\/([\w-]+)$/, handler: async (c, t, tk) => TR(c, m => m.deleteTeamTask(c, t, tk)), auth: true, rl: 'write' },

  // Files
  { method: 'GET', pattern: /^\/api\/teams\/([\w-]+)\/files$/, handler: async (c, id) => TR(c, m => m.getTeamFiles(c, id)), auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/teams\/([\w-]+)\/files$/, handler: async (c, id) => TR(c, m => m.recordTeamFile(c, id)), auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/teams\/([\w-]+)\/files\/([\w-]+)$/, handler: async (c, t, f) => TR(c, m => m.deleteTeamFile(c, t, f)), auth: true, rl: 'write' },

  // Feed (`/posts` köhnə aliaslardır — frontend `/feed` işlədir)
  { method: 'GET', pattern: /^\/api\/teams\/([\w-]+)\/feed$/, handler: async (c, id) => TR(c, m => m.getTeamFeed(c, id)), auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/teams\/([\w-]+)\/(?:feed|posts)$/, handler: async (c, id) => TR(c, m => m.createTeamPost(c, id)), auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/teams\/([\w-]+)\/(?:feed|posts)\/([\w-]+)$/, handler: async (c, t, p) => TR(c, m => m.deleteTeamPost(c, t, p)), auth: true, rl: 'write' },

  // Chat rooms
  { method: 'GET', pattern: /^\/api\/teams\/([\w-]+)\/rooms$/, handler: async (c, id) => TR(c, m => m.getTeamRooms(c, id)), auth: true, rl: 'read' },
  { method: 'POST', pattern: /^\/api\/teams\/([\w-]+)\/rooms$/, handler: async (c, id) => TR(c, m => m.createTeamRoom(c, id)), auth: true, rl: 'write' },
  { method: 'DELETE', pattern: /^\/api\/teams\/([\w-]+)\/rooms\/([\w-]+)$/, handler: async (c, t, r) => TR(c, m => m.deleteTeamRoom(c, t, r)), auth: true, rl: 'write' },

  // Activity / Stats
  { method: 'GET', pattern: /^\/api\/teams\/([\w-]+)\/activity$/, handler: async (c, id) => TR(c, m => m.getTeamActivity(c, id)), auth: true, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/teams\/([\w-]+)\/stats$/, handler: async (c, id) => TR(c, m => m.getTeamStats(c, id)), auth: true, rl: 'read' },

  // İstifadəçi axtarışı (dəvət modalı)
  { method: 'GET', pattern: /^\/api\/users\/search$/, handler: async (c) => TR(c, m => m.searchUsers(c)), auth: true, rl: 'read' },
  { method: 'GET', pattern: /^\/api\/users\/suggestions$/, handler: async (c) => TR(c, m => m.suggestUsers(c)), auth: true, rl: 'read' },



  // upload
  { method: 'POST', pattern: /^\/api\/upload$/, handler: R.upload, auth: true, rl: 'upload' },
];

/* ---------- security headers ---------- */
// Turnstile widget-i öz skriptini və challenge iframe-ini challenges.cloudflare.com-dan
// yükləyir. Bu mənbələr CSP-də HƏMİŞƏ icazəlidir (açar qurulmasa da) — siyahı
// statikdir, `TURNSTILE_SITE_KEY`-dən asılı olsaydı hər cavabda şərtli CSP
// qurmaq lazım gələrdi və edge keşi ilə uyğunsuzluq yaradardı.
// Əlavə risk yoxdur: bu, Cloudflare-in öz domenidir və `frame-ancestors 'none'`
// bizim səhifənin başqasına yerləşdirilməsini hər halda qadağan edir.
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
const CSP = [
  "default-src 'self'",
  `script-src 'self' ${TURNSTILE_ORIGIN}`,
  // AUDIT-2026-07-26 / M-3 — `'unsafe-inline'` ÇIXARILDI (AUDIT-TASK-10 / Faza 3.4).
  //
  // Ön şərt ödəndi: `index.html`-də inline `style="…"` atributu və `<style>`
  // bloku QALMADI (182 KB `styles.css` → `css/` altında 19 modul + `u-*`
  // utility sinifləri). Server tərəfdən qaytarılan HTML-də də `<style>` yoxdur
  // (`og.ts` SVG-dir və CSP yalnız `isHtml` üçün qoyulur; `email.ts` e-poçtdur).
  //
  // ⚠ İstifadəçi məzmunu risk yaratmır: `js/markdown.js` DOMPurify-ı
  //   `ALLOWED_ATTR: ['href','title']` ilə çağırır — `style` heç vaxt keçmir.
  //
  // ⚠ BİLİNƏN HƏDD (CSP-nin özünün məhdudiyyəti, bizim boşluq DEYİL):
  //   CSSOM ilə qoyulan stil (`el.style.width`, `el.style.cssText`) CSP-yə
  //   TABE DEYİL və işləməyə davam edir — `js/util.js`-dəki `el()` builder-i
  //   və `applyPercentWidths()` məhz bu yoldan istifadə edir. Bloklanan şey
  //   ƏSL XSS vektorudur: parse olunan HTML-dəki inline stil.
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  `frame-src ${TURNSTILE_ORIGIN}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ');

function withSecurityHeaders(res: Response, isHtml: boolean): Response {
  // ⚠ `new Response(body, res)` bir NEÇƏ Set-Cookie başlığını birləşdirə bilər.
  // Access + refresh cütü İKİ ayrı başlıqdır və birləşsə brauzer heç birini
  // qəbul etmir → istifadəçi giriş edə bilmir. Ona görə əvvəlcə ayrıca oxuyub,
  // wrapper-dən sonra bir-bir geri yazırıq.
  const cookies = typeof (res.headers as any).getSetCookie === 'function'
    ? (res.headers as any).getSetCookie() as string[] : [];
  const out = new Response(res.body, res);
  if (cookies.length > 1) {
    out.headers.delete('Set-Cookie');
    for (const ck of cookies) out.headers.append('Set-Cookie', ck);
  }
  // Core security
  out.headers.set('X-Content-Type-Options', 'nosniff');
  out.headers.set('X-Frame-Options', 'DENY');
  out.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // HSTS with preload
  out.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  // Cross-origin isolation
  out.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  out.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  // Enhanced Permissions-Policy
  out.headers.set('Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()');
  // `X-XSS-Protection` QƏSDƏN qoyulmur (AUDIT-2026-07-26 / L-1). Chrome və Edge
  // XSS Auditor-u tamamilə çıxarıb, Firefox heç vaxt tətbiq etməyib; köhnə
  // mühitlərdə isə auditor-un özü yan-kanal informasiya sızması vektoru idi.
  // Əsl müdafiə: yuxarıdaki `script-src 'self'` (unsafe-inline YOX) + client
  // tərəfdə `el()` DOM builder-i və DOMPurify.
  if (isHtml) {
    out.headers.set('Content-Security-Policy', CSP);
  }
  return out;
}

/* ---------- static SEO files (D1-driven; seo.ts tək mənbə) ---------- */
function serveStatic(body: string, contentType: string, cache = 'public, max-age=3600'): Response {
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': cache,
    },
  });
}

export default {
  // AUDIT-TASK-10 / Faza 2.2 — bütün emal SORĞU KONTEKSTİ içindədir.
  //
  // `runWithRequestContext` `AsyncLocalStorage` işlədir: `err()`/`json()` və
  // `log()` request ID-ni parametr almadan görür. Onsuz 100+ çağırış yerini
  // dəyişmək lazım gələrdi (bax worker/request-context.ts başlığı).
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    return runWithRequestContext(newRequestContext(request, path),
      () => handleRequest(request, env, ctx, url, path));
  },

  // Queue consumer (TASK-8 / Bənd 18). `wrangler.jsonc` → queues.consumers.
  // Hər mesaj ayrıca ack/retry olunur — bax queue.ts-dəki izah.
  async queue(batch: MessageBatch<SystemEvent>, env: Env): Promise<void> {
    await handleQueueBatch(batch, env);
  },

  // Cron Trigger (TASK-8 / Bənd 12). `wrangler.jsonc` → triggers.crons.
  //
  // ⚠ `waitUntil` MƏCBURİDİR: `scheduled` handler qaytardıqdan sonra runtime
  // işi dayandıra bilər. Promise-i ona bağlamasaq arxivləmə yarımçıq kəsilər
  // və R2-yə yazılıb D1-dən silinməmiş mesajlar dublikat yaradardı.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runArchiveJob(env).catch(e => {
      log('error', 'archive_job_failed', { message: e?.message || String(e) });
    }));
  },
} satisfies ExportedHandler<Env, SystemEvent>;

async function handleRequest(
  request: Request, env: Env, ctx: ExecutionContext, url: URL, path: string,
): Promise<Response> {

    // CORS: yalnız same-origin istifadə olunur; cross-origin preflight-ları rədd et
    if (request.method === 'OPTIONS' && path.startsWith('/api/')) {
      return new Response(null, { status: 204, headers: { 'Allow': 'GET, POST, PUT, PATCH, DELETE' } });
    }

    // SEO: robots / sitemap / llms — D1-dən generasiya, tək mənbə (seo.ts)
    if (request.method === 'GET') {
      if (path === '/robots.txt') return serveStatic(buildRobots(env), 'text/plain; charset=utf-8');
      if (path === '/sitemap.xml') return serveStatic(await buildSitemap(env), 'application/xml; charset=utf-8');
      if (path === '/llms.txt') return serveStatic(await buildLlms(env), 'text/plain; charset=utf-8');
      // Dinamik OG şəkil (post/profil preview kartı) + generic default
      if (path === '/og/default.png') return ogDefaultResponse(env, request, ctx);
      const og = path.match(/^\/og\/(post|user)\/([\w.-]+)\.png$/);
      if (og) return ogImageResponse(env, request, og[1] as 'post' | 'user', og[2], ctx);
    }

    // R2 faylları
    //
    // ⚠ Bu yol ROUTES cədvəlindən KƏNARDIR — yəni 4.3-dəki opt-out inversiyası
    // ona toxunmur və o, `read` səbətinə düşmür. Bu, QƏSDƏNDİR: bir feed
    // səhifəsi 20+ obyekt çəkir, `read` səbətinə salınsaydı normal gəzinti bir
    // neçə səhifədən sonra 429 alardı. Əvəzində ayrıca `asset` səbəti (1200/dəq)
    // R2 oxu xərcini qoruyur. Açar `uid` üzrədir — giriş onsuz da tələb olunur.
    //
    // ⚠ AUDIT C-1 / TASK-7: burada YALNIZ autentifikasiya var. Avtorizasiya
    // (`canReadKey` → default DENY) `R.serveFile` içindədir və R2 oxusundan
    // ƏVVƏL işləyir. HEAD də eyni yoldan keçir — əvvəl o, SPA fallback-ına
    // düşüb 200 HTML qaytarırdı, yəni yoxlamadan yan keçirdi.
    if (path.startsWith('/files/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const auth = await resolveUser(env, request);
      const c: Ctx = {
        env, req: request, url, user: auth?.user || null, isAdmin: false,
        sid: auth?.sid || null, legacy: !!auth?.legacy, ctx,
      };
      if (!c.user) return err('Giriş tələb olunur.', 401, 'auth_required');

      const assetRl = await rateLimit(env, request, 'asset', c.user.id);
      if (!assetRl.ok) {
        const res429 = err('Çox sayda fayl sorğusu.', 429, 'rate_limited');
        res429.headers.set('Retry-After', String(assetRl.retryAfter));
        return withSecurityHeaders(res429, false);
      }
      // ⚠ `c.isAdmin` BURADA HESABLANMIR. `archive/` və sadalanmayan prefikslər
      // admin statusundan asılıdır, lakin sorğunu qabaqcadan etmək HƏR məxfi
      // fayl sorğusuna bir D1 çağırışı əlavə edirdi (ölçüldü: +30 ms p95).
      // `serveFile` tənbəl resolver işlədir — sorğu yalnız qərar ondan asılı
      // olanda gedir (§7.3).
      const key = decodeURIComponent(path.slice('/files/'.length));
      const res = await R.serveFile(c, key, request.method as 'GET' | 'HEAD');
      return withSecurityHeaders(res, false);
    }

    // WebSocket upgrade → RoomDO (realtime otaq). 101 cavabı security-header
    // wrapper-dən KEÇMİR — `new Response(res.body, res)` webSocket property-ni itirər.
    // Kimlik serverdə doğrulanıb DO-ya query ilə ötürülür (client spoof edə bilməz).
    {
      const wsMatch = path.match(/^\/api\/rooms\/([\w-]+)\/ws$/);
      if (wsMatch && request.method === 'GET' && request.headers.get('Upgrade') === 'websocket') {
        const auth = await resolveUser(env, request);
        if (!auth?.user) return new Response('Giriş tələb olunur.', { status: 401 });
        const roomId = wsMatch[1];

        // TASK-11: otaq komandaya aiddirsə, WS də üzvlük tələb edir — REST
        // qapısı (`guardTeamRoom`) tək başına kifayət etməzdi, çünki realtime
        // axını birbaşa DO-dan gəlir.
        const teamRoom = await env.DB
          .prepare('SELECT team_id FROM team_chat_rooms WHERE id = ?').bind(roomId).first<any>();
        if (teamRoom) {
          const isAdmin = !!(await env.DB.prepare('SELECT 1 AS x FROM admins WHERE user_id = ?')
            .bind(auth.user.id).first<any>());
          const member = isAdmin || !!(await env.DB.prepare(
            "SELECT 1 AS x FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'active'",
          ).bind(teamRoom.team_id, auth.user.id).first<any>());
          if (!member) return new Response('İcazə yoxdur.', { status: 403 });
        }

        const stub = env.ROOM_DO.get(env.ROOM_DO.idFromName(roomId));
        const doUrl = new URL(request.url);
        doUrl.searchParams.set('uid', auth.user.id);
        doUrl.searchParams.set('name', auth.user.name);
        // AUDIT H-6 / C-1: DO periodik re-auth-da sessiyanın hələ etibarlı
        // olduğunu yoxlayır. `sid` olmasa `revokeAllSessions` yalnız növbəti
        // HTTP sorğusunda hiss olunardı — açıq soket isə toxunulmaz qalardı.
        doUrl.searchParams.set('sid', auth.sid || '');
        // AUDIT H-6 / C-2: "bu istifadəçinin bu otaqda soketi var" qeydi.
        // 101 cavabından ƏVVƏL yazılır — əks halda soket mövcud olur, qeyd isə
        // hələ yoxdur və həmin pəncərədə kəsmə otağı görməz.
        // Bu qeyd sayəsində bloklama/sessiya ləğvi BÜTÜN otaqları yox, yalnız
        // faktiki soketi olanları oyadır (ölçmə: əvvəl növbəti sorğu 32 s).
        await noteSocket(env, auth.user.id, roomId);
        return stub.fetch(new Request(doUrl.toString(), request));
      }
      // Real-time presence (online/offline) — tək qlobal PresenceDO.
      if (path === '/api/presence/ws' && request.method === 'GET' && request.headers.get('Upgrade') === 'websocket') {
        const auth = await resolveUser(env, request);
        if (!auth?.user) return new Response('Giriş tələb olunur.', { status: 401 });
        const priv = fromJSON<any>(auth.user.settings as any, {})?.privacy || {};
        const stub = env.PRESENCE_DO.get(env.PRESENCE_DO.idFromName('global'));
        const doUrl = new URL(request.url);
        doUrl.searchParams.set('uid', auth.user.id);
        doUrl.searchParams.set('hidden', priv.showOnlineStatus === false ? '1' : '0');
        return stub.fetch(new Request(doUrl.toString(), request));
      }
    }

    // API
    if (path.startsWith('/api/')) {
      for (const route of ROUTES) {
        if (route.method !== request.method) continue;
        const m = path.match(route.pattern);
        if (!m) continue;
        try {
          // `rl` verilmirsə DEFAULT_RL; `'none'` isə AÇIQ istisnadır (bax 4.4).
          const bucket = route.rl ?? DEFAULT_RL;
          if (bucket !== 'none') {
            // Açar `uid` üzrədir (NAT arxasındakı istifadəçilər bir-birini
            // bloklamasın). `peekUid` yalnız JWT imzasını yoxlayır — D1-ə
            // getmir, ona görə limiterin auth-dan ƏVVƏL olması sırası qorunur.
            const rlUid = RL[bucket].key === 'auto' ? await peekUid(env, request) : null;
            const verdict = await rateLimit(env, request, bucket, rlUid);
            if (!verdict.ok) {
              // Limit pozması təhlükə siqnalıdır (Bənd 1) — dashboard-da görünür.
              // `ctx.waitUntil`: jurnal yazısı 429 cavabını GECİKDİRMƏMƏLİDİR.
              //
              // `read` DEFAULT səbətdir və bütün cədvələ şamil olunur — hər
              // pozmanı yazsaq `security_events` jurnalı bir istifadəçinin
              // sınıq polling dövrəsi ilə dolar. Ona görə yalnız `read` üçün
              // 1/10 sampling; qalan səbətlər tam yazılır.
              const sampled = bucket !== 'read' || Math.random() < 0.1;
              if (sampled) {
                ctx.waitUntil(logSecurityEvent(env, request, {
                  // `mechanism` — AUDIT-TASK-9 / A-2: miqrasiya dövründə
                  // "hansı limiter qərar verdi" sualı jurnaldan cavablanmalıdır,
                  // əks halda `RL_MECHANISM` bayrağının təsiri görünməz olur.
                  type: 'rate_limit', severity: 'warning',
                  meta: { bucket, path, mechanism: verdict.mechanism },
                }));
              }
              // `code` maşın üçündür (util.ts fəlsəfəsi), `Retry-After` isə HTTP
              // standartıdır — düzgün client ona əməl edib polling-i dayandırır.
              const res429 = err('Çox sorğu — bir az sonra yenidən cəhd edin.', 429, 'rate_limited');
              res429.headers.set('Retry-After', String(verdict.retryAfter));
              return withSecurityHeaders(res429, false);
            }
          }
          // 🔴 AUDIT M-1 — CSRF: LOG REJİMİNDƏN BLOKLAMAYA KEÇİD
          //                  (AUDIT-TASK-10 / Faza 2.3, Task 6-nın açıq öhdəliyi).
          //
          // Task 6 bunu qəsdən log rejimində qoymuşdu: "yoxlama çox sərt olarsa
          // mobil tətbiq, API client-lər və `Sec-Fetch-Site` göndərməyən köhnə
          // brauzerlər kəsilər. Əvvəlcə real trafikdə pozma halları toplanır."
          //
          // İNDİ BLOKLANIR, LAKİN YALNIZ TƏHLÜKƏSİZ ALT-ÇOXLUQDA:
          //
          //   `csrfSuspicion` iki fərqli siqnal qaytarır (bax security.ts):
          //     `cross_origin:<origin>`   → `Origin` VAR və BİZİM DEYİL
          //     `sec_fetch_site:<value>`  → `Origin` yoxdur, yalnız Sec-Fetch-Site
          //
          //   Yalnız BİRİNCİSİ bloklanır. Səbəb: `Origin` başlığını brauzer
          //   özü qoyur və onu saxtalaşdırmaq mümkün deyil — yəni yad origin
          //   YALANÇI POZİTİV OLA BİLMƏZ. İkinci siqnal isə köhnə brauzerlərdə
          //   və proxy arxasında səhv dəyər daşıya bilər → log rejimində qalır.
          //
          // ⚠ Cookie-siz client-lər (mobil app, curl) `Bearer` token yolundadır
          //   və `Origin` göndərmir → onlara TOXUNULMUR.
          const csrf = csrfSuspicion(request, env.SITE_ORIGIN || '');
          if (csrf) {
            const blocked = csrf.startsWith('cross_origin:');
            ctx.waitUntil(logSecurityEvent(env, request, {
              type: 'csrf_suspect', severity: blocked ? 'critical' : 'warning',
              meta: { reason: csrf, path, method: request.method,
                mode: blocked ? 'blocked' : 'log_only' },
            }));
            if (blocked) {
              alert('csrf_blocked', { reason: csrf, path, method: request.method });
              return withSecurityHeaders(
                err('Sorğu mənbəyi qəbul edilmədi.', 403, 'csrf_blocked'), false);
            }
          }
          const auth = await resolveUser(env, request);
          const c: Ctx = {
            env, req: request, url,
            user: auth?.user || null,
            isAdmin: false,
            sid: auth?.sid || null,
            legacy: !!auth?.legacy,
            ctx,
          };
          if (c.user) {
            // 🔴 FAZA A2 — `users.role` NƏHAYƏT AVTORİZASİYAYA BAĞLANDI.
            //
            // Audit tapıntısı: sütun mövcud idi, lakin HEÇ BİR qərarda
            // oxunmurdu; admin yoxlaması binar idi (`admins` cədvəli) və
            // HƏR ADMIN TAM SƏLAHİYYƏTLİ olurdu.
            //
            // ⚠ `admins` cədvəli SAXLANILIR və `isAdmin` ONA GÖRƏ hesablanır:
            //   33 mövcud admin route-u ondan asılıdır və hamısını bir
            //   commit-də icazə modelinə köçürmək davranış dəyişikliyi riski
            //   olardı. Miqrasiya 0031 hər admini ən azı `ADMIN` roluna
            //   qoyub, yəni iki model UZLAŞIR. Yeni marşrutlar isə
            //   `requirePermission` işlədir (bax routes/moderation.ts).
            //
            // ⚠ `ADMIN` və yuxarı rol da `isAdmin` sayılır — belədə rol
            //   sistemi ilə təyin edilmiş admin köhnə panelə də çata bilir.
            const [adminRow, roleRow] = await Promise.all([
              env.DB.prepare('SELECT 1 AS x FROM admins WHERE user_id = ?').bind(c.user.id).first<any>(),
              env.DB.prepare(
                `SELECT r.priority AS p FROM users u
                   JOIN roles r ON r.name = u.role WHERE u.id = ?`,
              ).bind(c.user.id).first<any>().catch(() => null),
            ]);
            // `roles` cədvəli hələ migrate olunmayıbsa `roleRow` null olur →
            // yalnız köhnə yoxlama işləyir (fail-safe, kilidlənmə yoxdur).
            c.isAdmin = !!adminRow || Number(roleRow?.p ?? 0) >= 80;

            // 🔴 BAN TƏTBİQİ — PRD §16.
            //
            // Müddətli ban bitəndə `users.blocked` sütunu ÖZÜ sıfırlanmır
            // (onu dəyişən cron yoxdur), ona görə həqiqət mənbəyi `bans`
            // cədvəlidir. Vaxtı bitmiş ban burada SÜKUTLA keçir.
            if (c.user.blocked) {
              const st = await moderationState(env, c.user.id);
              if (!st.banned) {
                // Ban bitib/ləğv edilib, lakin köhnə bayraq qalıb → uzlaşdır.
                ctx.waitUntil(env.DB.prepare('UPDATE users SET blocked = 0 WHERE id = ?')
                  .bind(c.user.id).run().then(() => {}));
                c.user.blocked = 0;
              }
            }
          }
          // `auth_required` kodu client üçün siqnaldır: "access token bitib ola
          // bilər — bir dəfə refresh et və təkrar cəhd et". Kod olmasaydı client
          // mesaj mətninə baxmalı olardı (tərcümə dəyişən kimi sınardı).
          if (route.auth && !c.user) {
            return withSecurityHeaders(err('Giriş tələb olunur.', 401, 'auth_required'), false);
          }
          // `forbidden` kodu — AUDIT-TASK-1 §5.3 mirası. Bu tək sətir 33 admin
          // route-unun hamısına şamil olunur: client artıq mesaj mətnini deyil,
          // maşın kodunu oxuyur (util.ts-dəki `code` fəlsəfəsi).
          if (route.admin && !c.isAdmin) {
            return withSecurityHeaders(err('Yalnız admin.', 403, 'forbidden'), false);
          }
          // 🔴 PRD §5 icazə qapısı — "Backend HƏR əməliyyatda Permission
          // yoxlamalıdır". Bu sətir 35 marşrutun binar `admins` yoxlamasını
          // əvəz edir: artıq "admin olmaq" deyil, KONKRET İCAZƏ tələb olunur.
          //
          // ⚠ Miqrasiya 0035 bunu təhlükəsiz edir: `admins` cədvəlindəki hər
          //   kəs ən azı `ADMIN` rolundadır və `ADMIN` bu icazələri daşıyır.
          //   Yeganə istisna `MANAGE_ROLES`/`MANAGE_PERMISSIONS`-dır (yalnız
          //   SUPER_ADMIN+) — məhz auditin "hər admin = tam səlahiyyət"
          //   tapıntısının bağlanması budur.
          if (route.perm) {
            const denied = await requirePermission(c, route.perm);
            if (denied) return withSecurityHeaders(denied, false);
          }
          // 🔴 SUSDURMA TƏTBİQİ — PRD §4.
          //
          // Mute BAN DEYİL: istifadəçi oxuya bilər, YAZA bilməz. Ona görə
          // yalnız mutasiya metodları bağlanır və sessiya ləğv EDİLMİR.
          //
          // ⚠ `write` səbətindəki route-lar deyil, HTTP METODU meyar seçilib:
          //   rate-limit səbəti xərc təsnifatıdır, mutasiya isə semantikadır —
          //   ikisini qarışdırmaq gələcəkdə səssiz boşluq yaradardı.
          if (c.user && request.method !== 'GET' && request.method !== 'HEAD') {
            const st = await moderationState(env, c.user.id);
            if (st.muted) {
              return withSecurityHeaders(
                err('Hesabınız müvəqqəti susdurulub.', 403, 'muted'), false);
            }
          }
          const res = await route.handler(c, ...m.slice(1));
          const out = withSecurityHeaders(res, false);
          // API responses should not be indexed
          out.headers.set('X-Robots-Tag', 'noindex, nofollow');
          return out;
        } catch (e: any) {
          // AUDIT-TASK-10 / Faza 2.2 — strukturlu log + request ID.
          //
          // ⚠ `stack` LOGA düşür, CAVABA yox: stack trace fayl yollarını və
          //   daxili struktur adlarını sızdırır. İstifadəçi yalnız `requestId`
          //   alır və dəstək onunla LOG-u tapır (`err()` 5xx-də onu gövdəyə
          //   qoyur; başlıq isə hər cavabda var).
          log('error', 'api_unhandled', {
            message: e?.message || String(e),
            stack: typeof e?.stack === 'string' ? e.stack.slice(0, 800) : undefined,
          });
          return withSecurityHeaders(err('Server xətası.', 500), false);
        }
      }
      return withSecurityHeaders(err('Tapılmadı.', 404), false);
    }

    // Public path-lar (real URL, hash deyil) → shell HTML-i çək, HTMLRewriter ilə
    // per-route meta/JSON-LD inject et. Crawler/scraper JS icra etmədən düzgün meta görür.
    if (request.method === 'GET') {
      const route = matchPublicRoute(path);
      if (route) {
        const meta = await buildMeta(route, env);
        const shell = await env.ASSETS.fetch(new Request(new URL('/', url), request));
        const rewritten = rewriteHead(shell, meta, route);
        const out = withSecurityHeaders(rewritten, true);
        out.headers.set('Content-Type', 'text/html; charset=utf-8');
        out.headers.set('Content-Language', meta.lang);
        if (meta.status === 404) {
          out.headers.set('X-Robots-Tag', 'noindex');
          return new Response(out.body, { status: 404, headers: out.headers });
        }
        // HTML qabığı HƏMİŞƏ revalidate olsun (ETag ilə ucuz 304) — belədə hər deploy
      // dərhal istifadəçilərə çatır. Əvvəl `stale-while-revalidate=86400` edge-də
      // köhnə qabığı 24 saata qədər verirdi → deploy-dan sonra da köhnə client qalırdı
      // (məs. repost düzəlişi istifadəçiyə çatmırdı). Hashed asset-lər immutable qalır.
      out.headers.set('Cache-Control', 'no-cache');
        return out;
      }
    }

    // Statik sayt (Vite build) — SPA fallback assets konfiqindədir
    const res = await env.ASSETS.fetch(request);
    const isHtml = (res.headers.get('Content-Type') || '').includes('text/html');
    const out = withSecurityHeaders(res, isHtml);
    // Hashed asset-lər üçün uzun cache
    if (path.startsWith('/assets/')) {
      const o = new Response(out.body, out);
      o.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return o;
    }
    // HTML pages: short cache + ETag for freshness
    if (isHtml) {
      // HTML qabığı HƏMİŞƏ revalidate olsun (ETag ilə ucuz 304) — belədə hər deploy
      // dərhal istifadəçilərə çatır. Əvvəl `stale-while-revalidate=86400` edge-də
      // köhnə qabığı 24 saata qədər verirdi → deploy-dan sonra da köhnə client qalırdı
      // (məs. repost düzəlişi istifadəçiyə çatmırdı). Hashed asset-lər immutable qalır.
      out.headers.set('Cache-Control', 'no-cache');
    }
    return out;
}
