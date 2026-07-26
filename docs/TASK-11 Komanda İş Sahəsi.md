# TASK-11: Komanda İş Sahəsi (Team Workspace)

> **Qeyd (2026-07-23).** Bu sənədin əvvəlki versiyası bütün fazaları "tamamlandı"
> elan edirdi, lakin kod auditi bir sıra iddiaları təsdiqləmədi (real-time chat,
> Files tabı, Team XP, InvitationSent, statistika qrafikləri). Audit + düzəlişlərin
> tam siyahısı: **`docs/TASK-11-REPORT.md`**. Aşağıdakı mətn indi kodun ƏSL
> vəziyyətini əks etdirir.

Cloudflare D1 + R2 + KV + Durable Objects + Queues + Workflows + Vectorize/Workers AI
üzərində qurulmuş tam hüquqlu komanda idarəetmə sistemi.

## 1. Əsas quruluş və CRUD

- **Komandalar:** yaratma, redaktə, soft-delete, sahiblik köçürülməsi (`/transfer`),
  Public komandaya birbaşa qoşulma (`/join`) və ayrılma (`/leave` — sahib istisna).
- **Görünürlük:** `Public` / `Private` / `Invite` (serverdə normalizə olunur).
- **Layihələr:** CRUD + status (`active`/`paused`/`completed`), Public layihəyə
  qoşulma sorğusu → təsdiq/rədd axını, layihə üzvləri.
- **Tapşırıqlar:** CRUD, status (To Do / In Progress / Review / Done), prioritet,
  icraçı təyinatı, deadline. Statusu icraçı özü də dəyişə bilər.

## 2. Üzvlər, rollar və dəvətlər

- **10 standart rol** hər komandada avtomatik yaradılır: Owner, Admin, Manager,
  Mentor, Moderator, DevOps, Developer, Designer, QA, Viewer.
- **10 granular icazə:** `manage_team`, `manage_settings`, `manage_roles`,
  `manage_members`, `manage_invites`, `manage_projects`, `manage_tasks`,
  `manage_files`, `manage_feed`, `manage_chat`.
- **Rol CRUD:** öz rollarını yaratmaq/redaktə etmək/silmək olur. `Owner` rolu
  qorunur — nə dəvətlə, nə rol təyinatı ilə verilə bilməz (yalnız transfer ilə).
- **Dəvətlər:** rol seçimi ilə, 7 gün etibarlı, daxili bildiriş + email
  (Cloudflare Email Sending). Dəvət olunan şəxs "Dəvətlər" tabında qəbul/imtina edir.
  Ünvanlanmış dəvəti yalnız ünvan sahibi qəbul edə bilər.

## 3. Alt modullar

- **Team Chat:** Durable Objects (RoomDO) üzərində **real-time WebSocket**;
  otaq seçici; komanda yaradılanda General/Development/Design/QA/Random otaqları
  hazır gəlir; `manage_chat` ilə yeni otaq yaratmaq olur; WS düşəndə polling fallback.
- **Team Feed:** post növləri — Paylaşım, Yenilik, İrəliləyiş, Buraxılış, **Elan**
  (elan yalnız `manage_feed` icazəsi ilə). Məzmun Markdown + DOMPurify ilə render olunur.
  Feed **yalnız komanda üzvlərinə** görünür.
- **Team Files:** R2 arxivi, PDR qovluq strukturu (`teams/{teamId}/{documents|design|assets|source|exports}/`),
  10 MB limit, sənəd/dizayn/kod formatları, kateqoriya filtrləri, silinmə həm D1-dən,
  həm R2-dən.

## 4. Monitorinq, XP və statistika

- **Activity Log:** 14 komanda hadisəsi (`TeamCreated`, `MemberJoined`, `RoleChanged`,
  `ProjectCompleted`, `TeamTaskCompleted`, `FileUploaded`, `InvitationSent` və s.)
  Queues vasitəsilə asinxron loglanır; səhifələnir.
- **Team XP:** Tapşırıq +20, **Bug +30**, Layihə bitdi +100, Hackathon +500,
  yeni üzv +5, fayl +2, post +1. XP yalnız status **keçidində** verilir.
  İstifadəçinin şəxsi XP-si isə +50 (TASK-7 qərarı).
- **Reputation:** Bronze → Silver → Gold → Diamond → Legend (tərəqqi zolağı ilə).
- **Statistics:** 12 metrik + tamamlanma faizi + 30 günlük aktivlik trendi
  (sparkline) + ən çox tapşırıq bitirənlər.

## 5. Admin panel və Cloudflare inteqrasiyaları

- **Admin panel:** komanda axtarışı, silinmişlərin göstərilməsi, üzv/layihə/tapşırıq/XP
  sayğacları, detal modalı (üzvlər + layihələr + statistika), sil/bərpa et.
- **Queues:** bütün komanda hadisələri; binding yoxdursa sinxron fallback.
- **Workflows:** Team Onboarding — Welcome → üzv dəvəti → ilk layihə → ilk tapşırıq;
  hər addım komandanın real vəziyyətini yoxlayır.
- **Vectorize + Workers AI:** layihə/tapşırıq/post indeksləməsi, komanda daxili
  semantik axtarış, tapşırıq/layihə xülasəsi, avto-teqlər. Binding yoxdursa
  funksiyalar səssizcə söndürülür — komanda iş sahəsi AI olmadan da tam işləkdir.

## 6. Təhlükəsizlik

- Rol əsaslı giriş nəzarəti (RBAC) — hər endpoint üçün icazə/üzvlük yoxlanışı.
- Private komandanın feed-i, faylları, üzvləri, aktivliyi və statistikası
  kənar istifadəçiyə bağlıdır.
- Post/fayl silmə: "müəllif özü **və ya** moderasiya icazəsi".
- Dəvətin vaxt limiti + kimlik uyğunluğu; Owner rolunun qorunması.
- Bütün mutasiya endpointlərində rate limit; soft delete; XSS qoruması.

## 7. Test

- `e2e/teams.spec.ts` — 6 UI ssenarisi.
- `e2e/teams-rbac.spec.ts` — 16 protokol ssenarisi (RBAC, rollar, dəvətlər, XP,
  aktivlik, feed, axtarış, admin).

## 8. Deploy

```bash
npm run db:migrate:remote   # 0019_task11_hardening.sql — deploy-dan ƏVVƏL
npm run deploy
```

Opsional konfiq: `EMAIL` + `EMAIL_FROM` (dəvət emaili), `APP_URL` (dəvət linki),
`AI_CHAT_MODEL` / `AI_EMBED_MODEL` (Workers AI model override).
