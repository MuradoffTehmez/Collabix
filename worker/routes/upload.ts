// Fayl yükləmə və `/files/*` xidməti — AUDIT-TASK-10 / Faza 3.1.
//
// `routes.ts` bölünməsinin BİRİNCİ domen modulu. Bu bölmə qəsdən birinci
// seçilib: o, ən müstəqildir (yalnız `security.ts` və `files-auth.ts`-dən
// asılıdır, digər domenlərə toxunmur), yəni bölünmə naxışını ən aşağı riskli
// yerdə sınamağa imkan verir.
//
// 🔴 SAF REFAKTOR: gövdə və şərhlər OLDUĞU KİMİ köçürülüb (sənəd §11.2, §11.5).
import { Ctx, json, uuid, now, fileUrl } from '../util';
import { logSecurityEvent, sniffType, imageDimensions } from '../security';
import { canReadKey, lazyAdminCheck, shouldLogDenial, CACHE_HEADER } from '../files-auth';
import { noteFileAccessDenied } from '../alerts';
import { badReq } from './shared';

/* ================= UPLOAD (Bənd 14 — server-side validasiya) ================= */
//
// ⚠ TƏHLÜKƏSİZLİK MODELİ: client-in göndərdiyi HEÇ NƏYƏ inanılmır.
// `util.js`-dəki resizer yalnız istifadəçi rahatlığı üçündür — hücumçu onu
// tamamilə keçib birbaşa `POST /api/upload`-a istədiyi baytı göndərə bilər.
// Ona görə burada üç müstəqil yoxlama var:
//   1) ƏSL ölçü — oxunmuş baytların uzunluğu (elan edilən `file.size` deyil)
//   2) ƏSL tip  — magic byte imzası (elan edilən `file.type` deyil)
//   3) PİKSEL ölçüsü — "decompression bomb" (kiçik fayl, nəhəng şəkil) qoruması
//
// R2-yə YALNIZ üç yoxlamadan keçən obyekt yazılır və `contentType` client-in
// dediyi yox, BAYTLARDAN OXUNAN tip olur.

// Şəkil üçün icazə verilən əsl tiplər (magic byte ilə tanınanlar).
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
// Mesaj əlavəsində şəkilə əlavə olaraq PDF də olur. ZIP/CSV/JSON/TXT üçün
// etibarlı magic byte yoxlaması yoxdur (mətn formatlarının imzası yoxdur),
// ona görə onlar `application/octet-stream` kimi yazılır və brauzerdə
// HEÇ VAXT icra olunmur — `serveFile` onları attachment kimi verir.
const MSG_SNIFFABLE = [...IMAGE_TYPES, 'application/pdf'];
const MSG_OPAQUE_EXT = ['txt', 'csv', 'json', 'zip'];

// TASK-11 komanda faylları: sənəd arxivi olduğu üçün icazəli formatlar daha
// genişdir. Mətn/ofis formatlarının etibarlı magic byte-ı yoxdur, ona görə
// onlar da `application/octet-stream` kimi yazılır və `serveFile` onları
// məcburi endirmə (attachment) ilə verir — R2 stored-XSS vektoru bağlanır.
const TEAM_SNIFFABLE = [...IMAGE_TYPES, 'application/pdf'];
const TEAM_OPAQUE_EXT = [
  'txt', 'csv', 'json', 'zip', 'md', 'log', 'xml', 'yml', 'yaml',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods',
  'fig', 'sketch', 'psd', 'ai', 'svg',
  'js', 'ts', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'sql', 'sh',
];
const TEAM_MAX_SIZE = 10_485_760; // 10 MB

// Maksimum piksel ölçüsü. 8000×8000 = 64 MP — real avatar/post şəkli üçün
// fövqəladə boldur, amma RAM partladan 40000×40000 bombanı kəsir.
const MAX_DIM = 8000;

export async function upload(c: Ctx) {
  const kind = c.url.searchParams.get('kind') || 'post';
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return badReq('Fayl yoxdur.');

  // TASK-11: komanda faylı — açar `teams/{teamId}/{category}/...` olur və
  // yükləyən şəxsin həmin komandada `manage_files` icazəsi yoxlanılır.
  // Bundan əvvəl komanda faylları `kind=post` ilə gedirdi: yalnız şəkil,
  // 2 MB limit və `posts/{userId}/` açarı — yəni sənəd arxivi işləmirdi.
  /* ═══ TAPŞIRIQ QOŞMASI (`kind=task`) ═══
   *
   * 🔴 NİYƏ AYRICA ENDPOINT YAZILMADI: yükləmə yolunda ÜÇ təhlükəsizlik
   *    yoxlaması var (əsl ölçü, magic byte, piksel bombası). Onları ikinci
   *    faylda təkrarlasaydıq, biri yenilənəndə digəri köhnə qalardı — bu,
   *    məhz stored-XSS vektorunun açıldığı sinif səhvdir.
   *
   * ⚠ İCAZƏ KOMANDA FAYLINDAN FƏRQLİDİR: sənəd arxivi `manage_files` istəyir,
   *   tapşırığa fayl qoşmaq isə İŞİN GEDİŞİDİR — komanda üzvlüyü kifayətdir.
   *   (Eyni ayrım `workspace-task.ts` → `canWrite`-dadır.)
   */
  let taskCtx: { taskId: string; teamId: string } | null = null;
  if (kind === 'task') {
    const taskId = c.url.searchParams.get('taskId') || '';
    if (!taskId) return badReq('taskId tələb olunur.');
    const { taskFor } = await import('./workspace-task');
    const task = await taskFor(c, taskId);
    if (!task) return badReq('Tapşırıq tapılmadı.');
    const { requireTeamMember } = await import('../middleware/team-auth');
    const denied = await requireTeamMember(c, String(task.team_id));
    if (denied) return denied;
    taskCtx = { taskId, teamId: String(task.team_id) };
  }

  let teamCtx: { teamId: string; category: string } | null = null;
  if (kind === 'team') {
    const teamId = c.url.searchParams.get('teamId') || '';
    if (!teamId) return badReq('teamId tələb olunur.');

    const { TeamService } = await import('../services/team/team.service');
    const team = await new TeamService(c.env).getTeam(teamId);
    if (!team) return badReq('Komanda tapılmadı.');

    const { requireTeamPermission } = await import('../middleware/team-auth');
    const denied = await requireTeamPermission(c, String(team.id), 'manage_files');
    if (denied) return denied;

    const { normalizeCategory } = await import('../services/team/file.service');
    teamCtx = { teamId: String(team.id), category: normalizeCategory(c.url.searchParams.get('category')) };
  }

  const bigKind = kind === 'team' || kind === 'task';
  const maxSize = kind === 'avatar' ? 1_048_576 : bigKind ? TEAM_MAX_SIZE : 2_097_152;
  const mb = kind === 'avatar' ? '1' : bigKind ? '10' : '2';

  const reject = async (msg: string, reason: string) => {
    await logSecurityEvent(c.env, c.req, {
      type: 'upload_rejected', uid: c.user!.id, username: c.user!.username, severity: 'warning',
      meta: { reason, kind, declared: file.type, name: String(file.name || '').slice(0, 80) },
    });
    return badReq(msg);
  };

  // Baytları oxu. Limit 1–2 MB olduğu üçün buferləmək təhlükəsizdir və
  // imza + ölçü yoxlaması onsuz da faylın başını tələb edir.
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > maxSize) return reject(`Fayl ${mb} MB-dan böyükdür.`, 'too_large');
  if (bytes.length === 0) return reject('Fayl boşdur.', 'empty');

  const ext = String(file.name || '').split('.').pop()?.toLowerCase() || '';
  const sniffed = sniffType(bytes);

  const opaqueOk =
    (kind === 'msg' && MSG_OPAQUE_EXT.includes(ext)) ||
    (bigKind && TEAM_OPAQUE_EXT.includes(ext));

  let contentType: string;
  if (opaqueOk && !sniffed) {
    // İmzası olmayan sənəd formatı — məzmununa zəmanət vermirik, ona görə
    // brauzerin təxmin etməsinə də imkan vermirik.
    contentType = 'application/octet-stream';
  } else {
    if (!sniffed) return reject('Bu fayl tipi dəstəklənmir.', 'unknown_signature');
    const allowed = kind === 'msg' ? MSG_SNIFFABLE : bigKind ? TEAM_SNIFFABLE : IMAGE_TYPES;
    if (!allowed.includes(sniffed)) return reject('Bu fayl tipi dəstəklənmir.', 'type_not_allowed');
    // Elan edilən tip əsl tiplə uyuşmursa bu, sadəcə səhv deyil — qəsdən
    // saxtakarlıq əlamətidir. Yükləməni dayandırıb hadisəni jurnala yazırıq.
    if (file.type && file.type !== sniffed) {
      return reject('Fayl tipi məzmunla uyğun gəlmir.', 'mime_mismatch');
    }
    contentType = sniffed;
  }

  // Piksel ölçüsü yoxlaması — yalnız şəkillərdə.
  if (sniffed && IMAGE_TYPES.includes(sniffed)) {
    const dim = imageDimensions(bytes, sniffed);
    if (!dim || dim.w <= 0 || dim.h <= 0) return reject('Şəkil oxuna bilmədi.', 'bad_dimensions');
    if (dim.w > MAX_DIM || dim.h > MAX_DIM) {
      return reject(`Şəkil ölçüsü ${MAX_DIM}×${MAX_DIM} pikseldən böyük ola bilməz.`, 'dimensions_too_large');
    }
  }

  // `-` simvol sinfinin SONUNDADIR → qaçırılma lazım deyil.
  const safeName = (file.name || 'file').replace(/[^\w.-]/g, '_').slice(0, 80);
  // PDR-dəki komanda qovluq strukturu: /teams/{team_id}/{category}/...
  /* ⚠ TAPŞIRIQ QOŞMASI KOMANDA SAHƏSİNDƏDİR (`teams/{id}/tasks/...`):
     oxu icazəsi `files-auth.ts` tərəfindən komanda üzvlüyünə görə verilir.
     `posts/{uid}/` altına qoysaydıq, fayl komandadan KƏNARA çıxardı. */
  const key = taskCtx
    ? `teams/${taskCtx.teamId}/tasks/${taskCtx.taskId}/${now()}-${uuid().slice(0, 8)}-${safeName}`
    : teamCtx
      ? `teams/${teamCtx.teamId}/${teamCtx.category}/${now()}-${uuid().slice(0, 8)}-${safeName}`
      : `${kind === 'avatar' ? 'avatars' : kind === 'msg' ? 'msgfiles' : 'posts'}/${c.user!.id}/${now()}-${uuid().slice(0, 8)}-${safeName}`;
  await c.env.FILES.put(key, bytes, { httpMetadata: { contentType } });

  // AUDIT-TASK-10 / Faza 4 (sarı qrup) — `media` kataloqu.
  //
  // Əvvəl R2 obyektləri YALNIZ `posts.image_keys` JSON-unda və mesaj
  // sətirlərində izlənilirdi. Nəticələr: "bu istifadəçi nə qədər yer tutur?"
  // sualı cavabsız idi (kvota mümkünsüz) və yetim obyektləri tapmaq üçün
  // bütün R2-ni sadalamaq lazım gəlirdi — Faza 3-də tapılan `slice(0, 100)`
  // yetimləri məhz buna görə görünməz idi.
  //
  // ⚠ `waitUntil`: kataloq yazısı yükləmə cavabını GECİKDİRMƏMƏLİDİR, və
  //   uğursuzluğu yükləməni ÇÖKDÜRMƏMƏLİDİR — fayl R2-də artıq var.
  c.ctx.waitUntil(
    c.env.DB.prepare(
      'INSERT OR REPLACE INTO media (key, uid, kind, mime, size, created_at) VALUES (?,?,?,?,?,?)',
    ).bind(key, c.user!.id, teamCtx ? 'team' : kind, contentType, bytes.length, now())
      .run().then(() => {}).catch(() => {}),
  );

  /* Qoşma sətri + denormallaşdırılmış sayğac.
     ⚠ `waitUntil` DEYİL: kart üzərindəki sayğac dərhal düzgün olmalıdır,
       əks halda istifadəçi faylı yükləyib panel bağlayanda kartda «0 qoşma»
       görər və faylı itirdiyini düşünər. */
  if (taskCtx) {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO task_attachments (id, task_id, r2_key, name, size, mime, uploaded_by, created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
      ).bind(uuid(), taskCtx.taskId, key, safeName, bytes.length, contentType, c.user!.id, now()),
      /* ⚠ `+ 1` YOXDUR: `batch()` ifadələri ARDICIL icra edir (tək
         tranzaksiya), yəni bu sətir işləyəndə INSERT ARTIQ olub və
         `COUNT(*)` yeni qoşmanı onsuz da sayır. `+1` ikiqat sayardı. */
      c.env.DB.prepare(
        `UPDATE team_tasks SET attach_count =
           (SELECT COUNT(*) FROM task_attachments WHERE task_id = ?1) WHERE id = ?1`,
      ).bind(taskCtx.taskId),
    ]);
  }

  return json({
    key, url: fileUrl(key), fileName: file.name, fileSize: bytes.length, mimeType: contentType,
    category: teamCtx?.category,
  });
}

/**
 * Rədd cavabı — HƏMİŞƏ boş `404`, `403` DEYİL (AUDIT-TASK-7 §5.4).
 *
 * `403` faylın MÖVCUDLUĞUNU təsdiqləyər və hücumçu açar sadalaması ilə komanda
 * strukturunu öyrənə bilərdi. Burada `code` sahəsi də verilmir — Task 4-də
 * əlavə edilən maşın kodları diaqnostika üçündür, bu cavab isə "yoxdur"dan
 * fərqlənməməlidir. `no-store`: rədd cavabı da keşlənməməlidir.
 */
const fileNotFound = () => new Response('Not found', {
  status: 404,
  headers: { 'Cache-Control': CACHE_HEADER['no-store'], 'X-Content-Type-Options': 'nosniff' },
});

/**
 * R2 obyektinin verilməsi — AUDIT-2026-07-26 / C-1.
 *
 * ⚠ AVTORİZASİYA R2 OXUSUNDAN ƏVVƏL GƏLİR. Əvvəl bu funksiya yalnız
 * `c.env.FILES.get(key)` edirdi və `index.ts`-dəki 401 qapısından başqa heç bir
 * yoxlama yox idi — yəni istənilən giriş etmiş istifadəçi yad komandanın
 * sənədini, başqasının DM əlavəsini və bütöv arxiv dump-larını oxuya bilirdi.
 * Qərar məntiqi `files-auth.ts`-dədir (default DENY + keş siyasəti).
 */
export async function serveFile(c: Ctx, key: string, method: 'GET' | 'HEAD' = 'GET') {
  // Admin yoxlaması TƏNBƏLDİR — bax `lazyAdminCheck`. Öz DM əlavəsini oxumaq
  // üçün `admins` cədvəlinə sorğu lazım deyil və ilk versiyada məhz o, ölçülən
  // +30 ms p95 artımını yaradırdı (§7.3).
  const decision = await canReadKey(c, key, lazyAdminCheck(c.env, c.user?.id || null));
  if (!decision.allow) {
    // §5.3 — rədd hadisələri loglanır: (a) reqressiya diaqnostikası
    // ("istifadəçi sınıq şəkil görür, səbəbini bilmir"), (b) real hücum
    // cəhdlərinin aşkarlanması.
    // ⚠ TAM AÇAR LOGLANMIR — açarın özü həssas ola bilər. Yalnız prefiks + səbəb.
    // ⚠ `shouldLogDenial` təkrarları birləşdirir: `asset` səbəti dəqiqədə 1200
    // sorğuya icazə verir və filtrsiz jurnal öz-özünə D1 yazı seli olardı.
    c.ctx.waitUntil((async () => {
      // 🔴 AUDIT-TASK-10 / Faza 2.3 — Task 7 §8/5 açıq öhdəliyi:
      // "bir uid-dən dəqiqədə onlarla rədd = açar sadalama. Avtomatik reaksiya
      // yoxdur." İndi var: sayğac astananı keçəndə siqnal verilir.
      //
      // ⚠ `shouldLogDenial`-dan ƏVVƏL çağırılır: o, təkrarları BİRLƏŞDİRİR
      //   (D1 yazı selini əngəlləmək üçün), yəni sadalama cəhdinin əsl HƏCMİ
      //   ondan sonra görünməzdi — məhz sayğacın ölçdüyü şey isə odur.
      await noteFileAccessDenied(c.env, c.user?.id || '', decision.prefix);
      if (!(await shouldLogDenial(c.env, c.user?.id || null, decision.prefix, decision.reason))) return;
      await logSecurityEvent(c.env, c.req, {
        type: 'file_access_denied', severity: 'warning', uid: c.user?.id || null,
        meta: { key_prefix: decision.prefix, reason: decision.reason, method },
      });
    })());
    return fileNotFound();
  }

  // HEAD də eyni avtorizasiyadan keçir (§7.10). Əvvəl `index.ts` yalnız GET-i
  // bu yola salırdı, HEAD isə SPA fallback-ına düşüb 200 HTML qaytarırdı.
  const obj = method === 'HEAD'
    ? await c.env.FILES.head(key)
    : await c.env.FILES.get(key);
  if (!obj) return fileNotFound();

  const headers = new Headers();
  obj.writeHttpMetadata(headers as any);
  // 🔴 Keş siyasəti QƏRARIN bir hissəsidir (§7.4). Məxfi prefikslərə `public`
  // qoysaq Cloudflare edge cavabı saxlayar və İKİNCİ istifadəçi sorğusu
  // Worker-ə heç çatmaz — avtorizasiya tamamilə keçilərdi.
  // "Performans üçün hamısını public edək" DEMƏ: publik prefikslər onsuz da
  // `public` alır, məxfilər isə edge-də QALMAMALIDIR.
  headers.set('Cache-Control', CACHE_HEADER[decision.cache]);
  // Cavab istifadəçiyə görə dəyişir — proxy-lər üçün açıq siqnal (`private` ilə birlikdə).
  if (decision.cache !== 'public') headers.set('Vary', 'Cookie');
  headers.set('ETag', obj.httpEtag);
  headers.set('X-Content-Type-Options', 'nosniff');
  // Yalnız imzası doğrulanmış şəkillər brauzerdə açılır (inline).
  // Qalan hər şey (PDF, ZIP, mətn — tipi zəmanətsiz olanlar) məcburi endirilir:
  // inline açılsaydı R2 stored-XSS vektoru olardı. `nosniff` ikinci qat qorumadır.
  const ct = headers.get('Content-Type') || '';
  headers.set('Content-Disposition', IMAGE_TYPES.includes(ct) ? 'inline' : 'attachment');
  if (method === 'HEAD') {
    headers.set('Content-Length', String((obj as R2Object).size));
    return new Response(null, { headers });
  }
  return new Response((obj as R2ObjectBody).body as any, { headers });
}

