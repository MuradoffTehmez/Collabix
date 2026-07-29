# TASK-10 — Təsdiqlənmiş əhatə (Faza 0 çıxışı)

**Tarix:** 2026-07-29 · **Baseline commit:** `1a00d96`
**Status:** qərarlar alınıb — Faza 1-dən icraya icazə verilir

Bu sənəd `AUDIT-TASK-10.md` §3 (Faza 0) tələbidir: *"Bu sənəd təsdiqlənmədən
Faza 3-ə keçmə."*

---

## 0. İnventar — auditin rəqəmləri maşınla yoxlandı

⚠ Audit 2026-07-26 tarixlidir; ondan sonra Task 7–9 icra olunub. Bəzi rəqəmlər
**köhnəlib** və əhatə faktiki ölçmə üzərində qurulur.

| Bənd | Audit iddiası | Faktiki (2026-07-29) | Fərq |
|---|---|---|---|
| `worker/routes.ts` | 140 KB, 100+ export | **189 644 B (185 KB), 120 export** | 🔴 **böyüyüb** |
| `styles.css` | 179 KB | 182 099 B (178 KB) | ✓ |
| `favicon.svg` | 255 KB | 261 522 B (255 KB) | ✓ |
| Boş service stub | 23 | **20 fayl ≤ 38 B** (+ `ai/mentor.ts` 129 B, `ai/review.ts` 131 B) | ≈ |
| Boş workflow | 6 | **6 fayl ≤ 222 B** | ✓ |
| Boş `catch {}` | "15+ yer" | **16 yer — LAKİN hamısının izahlı şərhi var; şərhsiz boş blok: 0** | 🔴 **tapıntı artıq ödənilib** |
| `cyberpunk_styles.css` | "istifadə olunurmu? olunmursa sil" | **İSTİFADƏ OLUNUR** — `cyberpunk` teması + `js/cyberpunk_fx.js` | 🔴 **auditin təklifi səhvdir** |
| `users.role` avtorizasiyada | oxunmur | **Təsdiq** — yalnız `routes.ts:2505` (CSV sütunu) və `util.ts:253` (`mapUser`) | ✓ |
| Admin ierarxiyası | yoxdur | **Təsdiq** — `SELECT 1 FROM admins WHERE user_id = ?` binar yoxlama, 5 yerdə | ✓ |
| `git remote` | Task 2-dən açıq | **YOXDUR** | 🔴 Faza 1.6 blokeri |

**Auditin ödənilmiş saydığım iki bəndi** (qəbul meyarı 13 və Faza 3.4-ün bir
hissəsi) yenidən "düzəldilməyəcək" — onlar üçün hesabatda **sübutlu status**
veriləcək. Boş catch-ləri "düzəltmək" adı ilə mövcud izahlı şərhləri
`console.error` ilə əvəz etmək **geriyə addım** olardı: `ws.send()` qapanan
sokete yazanda log yazmaq faydasız səs-küydür.

---

## 1. Strateji qərarlar (istifadəçi tərəfindən)

| Qərar | Seçim | Sənəddəki tövsiyə | Həcm |
|---|---|---|---|
| **A — PRD/TDD** | 🔴 **A2 — tam icra** | A3 (hibrid) | **15–25 gün** |
| **B — boş stub-lar** | **B2 + B3** | B2+B3 | Faza 3.1-ə birləşir + 1 gün |
| **C — sxem borcu** | **yaşıl + BÜTÜN sarı** | yaşıl məcburi, sarı seçimli | **5,5 gün** |
| **CI blokeri** | CI faylı yazılır, remote sonra bağlanır | — | 1 gün |

### 1.a Qərar A — niyə A2 və nə demək olduğu

Sənəd A2-ni açıq şəkildə **"audit tapıntısı deyil, məhsul qərarıdır — 25 günlük
iş 'borcun bağlanması' adı altında gizlədilməməlidir"** kimi qeyd edir. Bu
etiraz istifadəçiyə sualın içində təqdim edildi və **A2 bilərəkdən seçildi**.

Yəni bu task-ın xarakteri dəyişir: o, artıq yalnız borc bağlama deyil, həm də
**yeni məhsul inkişafıdır**. Hesabatda bu ayrım qorunacaq — "borc ödənildi"
ilə "yeni funksionallıq yazıldı" bir yerdə hesablanmayacaq.

**A2-nin faktiki əhatəsi (PRD §4–8, §16 oxundu):**

| Komponent | PRD tələbi | Mövcud |
|---|---|---|
| Rol enum | 10 (`OWNER`…`GUEST`) | `users.role` sütunu var, oxunmur |
| Permission enum | ~30 | yoxdur (komanda RBAC-ı ayrıdır və qalır) |
| Cədvəllər | `roles`, `permissions`, `role_permissions`, `user_permissions`, `reputation_logs`, `badge_logs`, `achievement_logs`, `warnings`, `bans`, `mutes` | **heç biri** |
| Mövcud olanlar | `users`, `xp_logs` (T9), `reports`, `admin_logs` (≈`audit_logs`) | ✓ |
| XP cədvəli | 11 hadisə növü | T9-da 7 mənbə var — **uyğunlaşdırılmalıdır** |
| Level | 10 səviyyəli cədvəl, **DB-də sabit saxlanılmamalı** | `levelFromXP = sqrt(xp/100)+1` — formula fərqlidir |
| Engine-lər | XP, Level, Reputation, Badge, Achievement | XP ✓ (T9), Level qismən, qalan 3 yoxdur |

⚠ **PRD ilə mövcud kod arasında iki ZİDDİYYƏT var** və onlar icradan əvvəl
həll edilməlidir (bax §3 "Açıq ziddiyyətlər").

### 1.b Qərar C — sarı qrupun `user_bans`-ı A2-yə bağlıdır

Sarı qrupda `user_bans` var; PRD isə `bans` + `mutes` + `warnings` tələb edir.
İkisini ayrıca qurmaq dublikat yaradardı → **`user_bans` A2-nin `bans`
cədvəli ilə birləşdirilir**, ayrıca icra olunmur.

---

## 2. Faza sırası və müstəqillik

**Bağlayıcı sıra:** 0 → 1 → 2 → (3 ∥ 4 ∥ 5) → A2 → 6

| Faza | Həcm | Müstəqil buraxıla bilər? |
|---|---|---|
| 0 — qərar qapısı | ✅ bitdi | — |
| 1 — test + CI | 4–5 gün | ❌ **bağlayıcı** — qalan hər şey buna möhtacdır |
| 2 — observability | 2 gün | ✅ |
| 3 — kod borcu | 5–6 gün | ✅ |
| 4 — sxem (yaşıl+sarı) | 5,5 gün | ✅ |
| 5 — funksional boşluqlar | 4–5 gün | ✅ |
| A2 — PRD icrası | 15–25 gün | ✅ (ən sonda, ən böyük) |
| 6 — sənəd + öhdəliklər | 1,5 gün | ❌ sonuncu olmalıdır |

**Ümumi: ~38–50 gün** (A3 seçilsəydi ~24–25 olardı).

⚠ **Ən böyük risk sənədin özündə yazılıb:** *"Bu task-ın uğursuzluq rejimi
'səhv kod' deyil, 'heç vaxt bitməmək'dir."* A2 bu riski **artırır**. Ona görə
hər faza ayrıca commit edilir və istənilən nöqtədə dayandırıla bilər.

---

## 3. 🔴 Açıq ziddiyyətlər — A2 icrasından ƏVVƏL həll edilməlidir

### 3.1 Level formulası

| Mənbə | Formula |
|---|---|
| PRD §7 | cədvəl: Lv2=500, Lv3=1500, … Lv10=50 000 XP |
| Kod (`levelFromXP`) | `floor(sqrt(xp/100)) + 1` → Lv2=100, Lv3=400, Lv10=8100 |

PRD həm də deyir: *"Formula sonradan dəyişdirilə bilməlidir. Database-də sabit
saxlanılmamalıdır."* Yəni **cədvəl konfiqurasiya olmalı, kod sabiti yox**.

⚠ Formulanın dəyişməsi **bütün mövcud istifadəçilərin səviyyəsini dəyişir**.
Admin paneli, profil, badge-lər səviyyəyə baxır. Bu, görünən məhsul dəyişikliyidir.

### 3.2 XP dəyərləri

| Hadisə | PRD | Kod (T9) |
|---|---|---|
| Paylaşım | +10 | +10 ✓ |
| Orijinal paylaşım | +15 | fərq yoxdur |
| Şərh | +2 | **+5** |
| Repost | +3 | 0 |
| Like almaq | +1 | 0 |
| Profili tamamlamaq | +100 | **+20** |
| İlk qeydiyyat | +50 | 0 |
| Gündəlik giriş | +5 | 0 |

⚠ Task 9 gündəlik tavanları **mövcud dəyərlərə görə** hesabladı (post 100 =
10 post). PRD dəyərlərinə keçsək tavanlar yenidən hesablanmalıdır.

**Bu iki ziddiyyət Faza A2 başlayanda istifadəçiyə ayrıca təqdim ediləcək** —
onlar mənim texniki seçimim deyil, məhsul qərarıdır.

---

## 4. Əhatədən kənar (dəyişməz)

| Bənd | Səbəb |
|---|---|
| UUIDv7, `profiles`/`user_emails`/`user_socials`/`user_settings` ayrılması, `post_blocks`, tam soft-delete | Qırmızı qrup → `docs/SCHEMA-ROADMAP.md` |
| `cyberpunk_styles.css` silinməsi | **Auditin təklifi səhvdir** — fayl aktiv temada işlədilir |
| Boş `catch{}` "düzəldilməsi" | Artıq ödənilib — 16 blokun hamısında izahlı şərh var |
| Firefox/Safari responsive testi | Ayrıca iş |
| Yeni funksionallıq (thread, reaksiya növləri, push) | Məhsul yol xəritəsi |
| Virus/malware skanı, upload kvotası | Məhsul əhatəsi |

---

## 5. Xarici öhdəliklər (sahib + tarix tələb edir)

| # | Öhdəlik | Sahib | Vəziyyət |
|---|---|---|---|
| 1 | `git remote` yaradılması | **İstifadəçi** | 🔴 Faza 1.6-nı bloklayır; CI faylı hazır olacaq |
| 2 | Cloudflare API token (CI secret) | **İstifadəçi** | CI işə düşmək üçün lazım |
| 3 | `collabix.az` DNS + MX | **İstifadəçi** | Task 2-dən |
| 4 | VÖEN, sosial profillər | **İstifadəçi** | Task 2-dən |
| 5 | Hüquqi mətnin peşəkar baxışı | **İstifadəçi** | Task 2-dən |

⚠ Bunlar **kod borcu deyil** — icra agenti onları bağlaya bilməz. Hesabatda
"📋 sahibi var" statusu ilə qeydə alınır.
