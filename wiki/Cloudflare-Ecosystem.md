# ☁️ Cloudflare Ekosistemi

> Collabix, Cloudflare-in təqdim etdiyi ən qabaqcıl Edge xidmətlərindən istifadə edərək ənənəvi serverlərə olan ehtiyacı tamamilə aradan qaldırır.

---

## 🌩️ Cloudflare Workers (Hesablama Nüvəsi)

Cloudflare Workers, proqram kodunu V8 Isolates daxilində işlədən serverless (serversiz) platformadır. Collabix-in bütün backend məntiqi burada cəmləşib.

### Xüsusiyyətlər
- **Gecikmə (Latency):** < 50ms (dünyanın istənilən yerindən)
- **Soyuq Başlanğıc (Cold Start):** Nəzərəçarpacaq dərəcədə yoxdur (< 5ms)
- **Miqyaslanma:** Avtomatik və limitsiz

---

## 🗄️ Cloudflare D1 (Relyasiyalı Baza)

D1, Cloudflare-in Edge-də işləyən ilk serverless relyasiyalı SQL məlumat bazasıdır (SQLite əsaslı).

| Xüsusiyyət | Collabix-dəki Rolu |
|------------|--------------------|
| **Cədvəllər** | 26+ cədvəl (istifadəçilər, postlar, şərhlər, və s.) |
| **Performans** | Sorğular Cloudflare edge-dən icra edilir |
| **Tam Mətn Axtarışı** | FTS5 vasitəsilə `users_fts` və `posts_fts` indeksləri |
| **Miqrasiyalar** | Wrangler CLI vasitəsilə (`wrangler d1 migrations apply`) |

---

## 📦 Cloudflare R2 (Obyekt Anbarı)

R2, S3-ə uyğun və Egress (xaricə çıxış) ödənişi olmayan obyekt anbarıdır.

| Xüsusiyyət | Collabix-dəki Rolu |
|------------|--------------------|
| **İstifadəçi Məzmunu** | Avatarlar, post şəkilləri, komanda faylları |
| **Təhlükəsizlik** | Worker daxilində MIME tip yoxlanışı (Whitelist) |
| **Arxivləmə** | 90 gündən köhnə otaq və DM mesajlarının JSON formatında saxlanması |

---

## 🔑 Cloudflare KV (Key-Value)

KV, qlobal miqyasda sürətli oxunma (read) üçün optimallaşdırılmış açar-dəyər (key-value) verilənlər bazasıdır.

| Xüsusiyyət | Collabix-dəki Rolu |
|------------|--------------------|
| **Sessiya İdarəsi** | JWT tokenlərinin etibarlılıq və ləğv qeydləri |
| **Cəld Keşləmə** | Tez-tez istifadə olunan statik məlumatlar üçün |

---

## ⏳ Durable Objects (DO)

Durable Objects, güclü tutarlılıq (strong consistency) və vəziyyət qoruyan (stateful) əməliyyatlar üçün istifadə olunur.

| Object Adı | Collabix-dəki Rolu |
|------------|--------------------|
| **RoomDO** | Otaqlarda WebSocket vasitəsilə real-vaxt mesajlaşma və "yazır..." statusu |
| **PresenceDO** | Qlobal miqyasda istifadəçilərin Online/Offline statusunun yayımı |
| **RateLimitDO** | Yarışsız (race-free), atomik və dəqiq rate-limiting mühərriki |

---

## 📨 Cloudflare Queues

Queues, asinxron tapşırıqların idarə edilməsi üçündür.

| Xüsusiyyət | Collabix-dəki Rolu |
|------------|--------------------|
| **Tapşırıq (Task) Emalı** | Ağır hesablama və kənar API müraciətlərinin asinxron işlənməsi |
| **Təkrar Cəhd (Retry)** | Səhvlər olduqda 3 cəhdədək yenidən yoxlama |
| **DLQ** | Uğursuz mesajların `collabix-tasks-dlq` (Dead Letter Queue) qutusuna düşməsi |

---

## 🤖 AI və Vektor xidmətləri

| Xidmət | Collabix-dəki Rolu |
|--------|--------------------|
| **Workers AI** | Serverless maşın öyrənməsi modelləri vasitəsilə AI funksiyaları |
| **Vectorize** | Süni intellekt axtarışı üçün vektor verilənlər bazası |
| **AI Gateway** | AI sorğularının idarəedilməsi və loglanması |

---

**Əvvəlki:** [← Sistem Arxitekturası](Architecture) | **Növbəti:** [Verilənlər Bazası Sxemi →](Database-Schema)
