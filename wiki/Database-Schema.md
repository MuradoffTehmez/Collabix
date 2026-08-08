# 🗄️ Verilənlər Bazası Sxemi

> Cloudflare D1 (SQLite) üzərində qurulmuş 26+ cədvəllik verilənlər bazası arxitekturası.

---

## 📊 İcmal

| Metrik | Dəyər |
|--------|-------|
| **Verilənlər bazası** | Cloudflare D1 (SQLite-əsaslı) |
| **Cədvəl sayı** | 26+ |
| **İndeks sayı** | 25+ |
| **Miqrasiya sayı** | 54 fayl |
| **İlk miqrasiya** | `0001_init.sql` |
| **Son miqrasiya** | `0054_workspace.sql` |

---

## 📋 Cədvəl Kateqoriyaları

### 👤 Hesablar və İdarə

| Cədvəl | Təsvir | Əsas Sütunlar |
|--------|--------|---------------|
| `users` | İstifadəçi profil datası | `id`, `username`, `email`, `password_hash`, `salt`, `role`, `xp`, `level`, `reputation`, `bio`, `avatar_url`, `is_verified`, `created_at` |
| `admins` | Admin rol təyinatı | `user_id`, `role` |
| `admin_logs` | Audit logları (bütün kritik əməliyyatlar) | `id`, `admin_id`, `action`, `target_id`, `details`, `level`, `created_at` |
| `progress` | İstifadəçi inkişaf qeydləri | `user_id`, `metric`, `value`, `updated_at` |
| `presence` | Son aktivlik statusu | `user_id`, `last_seen`, `status` |
| `sessions` | Aktiv sessiya qeydləri | `token`, `user_id`, `device_info`, `ip`, `created_at`, `expires_at` |
| `oauth_accounts` | OAuth bağlantıları | `user_id`, `provider`, `provider_id`, `created_at` |
| `mfa_totp` | 2FA gizli açarları | `user_id`, `secret`, `enabled`, `created_at` |
| `xp_logs` | XP tarixçəsi | `id`, `user_id`, `amount`, `reason`, `created_at` |
| `deleted_uids_tombstone` | Silinmiş hesab qalıqları | `user_id`, `deleted_at` |

### 📝 Məzmun və İcma

| Cədvəl | Təsvir | Əsas Sütunlar |
|--------|--------|---------------|
| `posts` | Paylaşımlar (lent məzmunu) | `id`, `user_id`, `content`, `blocks`, `visibility`, `share_count`, `created_at` |
| `comments` | Şərhlər (thread dəstəyi) | `id`, `post_id`, `user_id`, `parent_id`, `content`, `created_at` |
| `likes` | Post bəyənmələri | `user_id`, `post_id`, `created_at` |
| `comment_likes` | Şərh bəyənmələri | `user_id`, `comment_id` |
| `bookmarks` | Yadda saxlananlar | `user_id`, `post_id`, `created_at` |
| `post_shares` | Repost/Quote paylaşımlar | `id`, `user_id`, `original_post_id`, `quote`, `type` |
| `post_reactions` | Emoji reaksiyaları | `id`, `post_id`, `user_id`, `reaction_type` |
| `polls` | Sorğular | `id`, `post_id`, `question`, `options`, `multi_select` |
| `follows` | İzləmə münasibətləri | `follower_id`, `following_id`, `created_at` |

### 💬 Ünsiyyət

| Cədvəl | Təsvir | Əsas Sütunlar |
|--------|--------|---------------|
| `rooms` | Söhbət otaqları | `id`, `name`, `topic`, `icon`, `created_by`, `created_at` |
| `room_messages` | Otaq mesajları | `id`, `room_id`, `user_id`, `content`, `edited_at`, `created_at` |
| `dm_threads` | DM pəncərələri | `id`, `user1_id`, `user2_id`, `last_message_at` |
| `dm_messages` | Şəxsi mesajlar | `id`, `thread_id`, `sender_id`, `content`, `read_at`, `created_at` |
| `archive_meta` | Arxivlənmiş mesaj metadatası | `type`, `id`, `r2_key`, `message_count`, `archived_at` |

### 🏢 Komandalar və İş Sahələri

| Cədvəl | Təsvir | Əsas Sütunlar |
|--------|--------|---------------|
| `teams` | Komandalar | `id`, `name`, `slug`, `owner_id`, `description`, `avatar_url`, `created_at` |
| `team_members` | Komanda üzvləri | `team_id`, `user_id`, `role_id`, `joined_at` |
| `team_roles` | Fərdi komanda rolları | `id`, `team_id`, `name`, `permissions`, `priority`, `color` |
| `team_invites` | Komanda dəvətləri | `id`, `team_id`, `email`, `token`, `expires_at` |
| `team_projects` | Komanda layihələri | `id`, `team_id`, `name`, `description`, `status` |
| `team_tasks` | Kanban tapşırıqları | `id`, `project_id`, `title`, `assignee_id`, `status`, `priority` |
| `team_files` | Ortaq fayllar | `id`, `team_id`, `name`, `r2_key`, `uploaded_by` |
| `sprints` | İş sahəsi sprintləri | `id`, `team_id`, `name`, `start_date`, `end_date`, `status` |
| `task_time_logs` | Vaxt izləmə jurnalı | `id`, `task_id`, `user_id`, `minutes`, `description`, `created_at` |
| `task_comments` | Tapşırıq şərhləri | `id`, `task_id`, `user_id`, `content`, `created_at` |
| `task_attachments` | Tapşırıq faylları | `id`, `task_id`, `user_id`, `file_name`, `r2_key` |
### 🎓 Təhsil

| Cədvəl | Təsvir | Əsas Sütunlar |
|--------|--------|---------------|
| `tasks` | Tədris tapşırıqları | `id`, `title`, `description`, `category`, `difficulty`, `xp_reward` |
| `submissions` | İstifadəçi həlləri | `id`, `task_id`, `user_id`, `content`, `status`, `reviewed_by` |

### 🔧 Sistem və İdarəetmə

| Cədvəl | Təsvir | Əsas Sütunlar |
|--------|--------|---------------|
| `reports` | İstifadəçi şikayətləri | `id`, `reporter_id`, `target_id`, `reason`, `status` |
| `taxonomies` | Bacarıq/dil kateqoriyaları | `id`, `type`, `name`, `order` |
| `faqs` | Tez-tez verilən suallar | `id`, `question`, `answer`, `order` |
| `testimonials` | İstifadəçi rəyləri | `id`, `name`, `content`, `avatar_url` |
| `stats_daily` | Gündəlik statistika | `date`, `metric`, `value` |
| `contact_messages` | Əlaqə forması mesajları | `id`, `name`, `email`, `message`, `created_at` |
| `newsletter` | Xəbər bülleteni abunələri | `id`, `email`, `subscribed_at` |
| `notifications` | Bildiriş mərkəzi | `id`, `user_id`, `type`, `data`, `read_at`, `created_at` |
| `moderator_applications` | Moderator müraciətləri | `id`, `user_id`, `reason`, `status` |
| `invites` | Platform dəvət sistemi | `id`, `inviter_id`, `code`, `used_by`, `expires_at` |

---

## 🔗 Əsas Münasibətlər (Relations)

```
users ──┬── posts ──── comments ──── comment_likes
        │              │
        │              └── likes
        │
        ├── follows (follower ↔ following)
        │
        ├── bookmarks
        │
        ├── dm_threads ──── dm_messages
        │
        ├── rooms ──── room_messages
        │
        ├── teams ──┬── team_members
        │           ├── team_roles
        │           ├── team_invites
        │           ├── team_projects ──── team_tasks
        │           └── team_files
        │
        ├── tasks ──── submissions
        │
        ├── sessions
        ├── oauth_accounts
        ├── mfa_totp
        ├── xp_logs
        ├── notifications
        └── presence
```

---

## 📑 FTS (Full-Text Search)

Collabix D1-in **FTS5** (Full-Text Search) imkanını istifadə edir:

| FTS Cədvəli | Axtarış Sahəsi | Miqrasiya |
|-------------|---------------|-----------|
| `posts_fts` | Post məzmunu (tam gövdə) | `0033_fts_full_body.sql` |
| `users_fts` | İstifadəçi adı, bio | `0027_users_search_name.sql` |

---

## 🔄 Miqrasiya Sistemi

### Miqrasiya Adlandırma Konvensiyası

```
XXXX_descriptive_name.sql

Məsələn:
  0001_init.sql
  0014_schema_team.sql
  0049_notification_center.sql
```

### Miqrasiya Əmrləri

```bash
# Lokal miqrasiya
npm run db:migrate:local

# Remote (production) miqrasiya
npm run db:migrate:remote

# Staging miqrasiya
npx wrangler d1 migrations apply collabix-db-staging --remote --env staging
```

### Miqrasiya Yoxlama Skripti

```bash
npm run check:migrations
```

Bu skript (`scripts/check-migrations.mjs`) deploy-dan əvvəl miqrasiyaların sırasının düzgünlüyünü yoxlayır.

---

## 📈 İndekslər

Performans üçün 25+ indeks mövcuddur. Əsas indekslər:

| İndeks | Cədvəl | Sütunlar | Məqsəd |
|--------|--------|----------|--------|
| `idx_posts_user_created` | `posts` | `user_id`, `created_at` | Feed sorğuları |
| `idx_comments_post` | `comments` | `post_id`, `created_at` | Şərh yükləmə |
| `idx_likes_post_user` | `likes` | `post_id`, `user_id` | Unikal bəyənmə |
| `idx_follows_pair` | `follows` | `follower_id`, `following_id` | İzləmə statusu |
| `idx_dm_thread` | `dm_messages` | `thread_id`, `created_at` | DM tarixçə |
| `idx_room_msg_room` | `room_messages` | `room_id`, `created_at` | Otaq mesajları |
| `idx_team_members_team` | `team_members` | `team_id` | Komanda üzvləri |
| `idx_notifications_user` | `notifications` | `user_id`, `read_at` | Bildirişlər |

---

## 📦 Arxivləmə Sistemi

90 gündən köhnə mesajlar avtomatik olaraq D1-dən R2-yə arxivlənir:

```
Gündəlik Cron (03:17 UTC)
    │
    ├── 90+ günlük room_messages ──→ R2 (gzip)
    ├── 90+ günlük dm_messages ──→ R2 (gzip)
    ├── Vaxtı bitmiş sessiyalar ──→ SİLİNİR
    └── 90+ günlük security events ──→ SİLİNİR

Oxuma yolu (mesajlar İTMİR):
    GET /api/rooms/:id/messages?before=<ts>
    GET /api/dms/:pair/messages?before=<ts>
    D1 bitəndə ──→ R2 arxivindən oxunur
```

---

## 🔗 Əlaqəli Səhifələr

- **[Sistem Arxitekturası →](Architecture)**
- **[Cloudflare Ekosistemi →](Cloudflare-Ecosystem)**
- **[API Reference →](API-Reference)**

---

**Əvvəlki:** [← Arxitektura](Architecture) | **Növbəti:** [Xüsusiyyətlər Kataloqu →](Features)
