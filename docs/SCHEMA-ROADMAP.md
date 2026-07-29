# Sxem yol xəritəsi — icra OLUNMAYAN bəndlər

**AUDIT-TASK-10 / Faza 4.3.** Bu sənəd **borcun ödənilməsi deyil, dürüst
qeydə alınmasıdır**.

> Sənədin tələbi: *"hər bənd üçün: nə, niyə, həcm, risk, ön şərt."*

---

## Vəziyyət — sxem borcunun 11 bəndi

| Qrup | Vəziyyət |
|---|---|
| 🟢 Yaşıl (3 bənd) | ✅ **İcra olundu** — `0032_schema_debt.sql` |
| 🟡 Sarı (4 bənd) | ✅ **İcra olundu** — istifadəçi qərarı ilə (Faza 0/C) |
| 🔴 Qırmızı (4 bənd) | ⏭️ **Bu sənəddə** |

---

## 🔴 R-1 — UUIDv7 keçidi

**Nə:** bütün PK/FK sütunlarını `uuid()` (32 simvol hex) əvəzinə UUIDv7-yə keçirmək.

**Niyə təklif olunub:** UUIDv7 vaxt-sıralıdır → indeks daxilində ardıcıl yazılır,
B-tree parçalanması azalır, `ORDER BY id` təbii xronoloji sıra verir.

**Niyə İCRA OLUNMUR:**

1. **40+ cədvəldə hər PK və FK yenidən yazılmalıdır.** SQLite-də PK tipini
   dəyişmək cədvəlin yenidən qurulmasıdır (`CREATE new → INSERT SELECT → DROP →
   RENAME`) — 40 cədvəl × canlı data.
2. **Mövcud ID-lər İŞLƏYİR.** Audit özü nümunə kimi `vbpVokAhLqJA9m0RpqMryroA4S8s`
   göstərir — bu, real problem yaratmır.
3. **Bu, borc deyil, OPTİMİZASİYA TERCİHİDİR.** Ölçülmüş performans problemi
   yoxdur; heç bir sorğu ID sıralamasına görə yavaşlamır.
4. Keçid dövründə **iki ID formatı yan-yana** yaşayacaq — hər JOIN, hər keş
   açarı və hər client istinadı bunu nəzərə almalıdır.

**Həcm:** 8–12 gün · **Risk:** 🔴 yüksək (canlı bazada data itkisi)
**Ön şərt:** staging mühiti + tam E2E baseline + geri qaytarma məşqi

---

## 🔴 R-2 — `profiles` / `user_emails` / `user_socials` / `user_settings` ayrılması

**Nə:** `users` cədvəlini normallaşdırmaq — profil sahələri, e-poçtlar, sosial
linklər və parametrlər ayrı cədvəllərə.

**Niyə təklif olunub:** `users` cədvəli genişdir (40+ sütun); JSON blob-lar
(`settings`, `prog_levels`, `lang_levels`, `looking_for`) sorğulana bilmir.

**Niyə İCRA OLUNMUR:**

1. **Hər oxu yolu JOIN qazanır.** `resolveUser` HƏR SORĞUDA çağırılır və
   hazırda TƏK sətir oxuyur. Dörd cədvələ bölsək bu, JOIN-a çevrilir — ən sıx
   yol ən çox zərər görər.
2. **`mapUser` 30+ yerdə işlədilir** və hamısı forma dəyişikliyindən təsirlənir.
3. Faza A2 `users`-ə **yeni sütun əlavə etdi** (`reputation`) — ayırma qərarı
   verilsəydi o da yeni cədvələ getməli idi. Yəni ayırma indi daha bahalıdır.

**Həcm:** 6–8 gün · **Risk:** 🟠 orta-yüksək
**Ön şərt:** oxu yollarının p50/p95 ölçməsi (Faza 2.1 observability bunu indi
mümkün edir) — JOIN xərci ÖLÇÜLMƏDƏN qərar verilməməlidir

---

## 🔴 R-3 — `post_blocks` (blok strukturunun normallaşdırılması)

**Nə:** `posts.blocks` JSON sütununu ayrıca `post_blocks` cədvəlinə çevirmək.

**Niyə təklif olunub:** blokları ayrıca sorğulamaq, blok tipinə görə axtarış,
`post_blocks.order` ilə sıralama.

**Niyə İCRA OLUNMUR:**

1. **Heç bir funksionallıq bunu tələb etmir.** Bloklar HƏMİŞƏ tam post ilə
   birlikdə oxunur və yazılır; ayrıca sorğulanmır.
2. AUDIT M-5 blob ölçüsünü onsuz da məhdudlaşdırıb (64 KB tavan, ölçmə ilə
   seçilib — bazadakı ən böyük post 58 bayt idi).
3. FTS axtarışı `posts_fts` üzərindən gedir, `blocks` üzərindən yox.
4. Ayırma `createPost`/`patchPost`/`deletePost` axınlarını dəyişər — bunların
   hər üçündə AUDIT C-1 şəkil istinadı qoruması var (Faza 3-də bir qüsur məhz
   orada tapıldı). Refaktor həmin qorumaya toxunmalı olardı.

**Həcm:** 3–4 gün · **Risk:** 🟠 orta (C-1 qoruma yolu dəyişir)
**Ön şərt:** blok səviyyəsində sorğu tələb edən REAL funksionallıq

---

## 🔴 R-4 — Tam soft-delete

**Nə:** bütün silmələri `deleted_at` sütunu ilə əvəz etmək.

**Niyə İCRA OLUNMUR:**

1. **GDPR ilə ZİDDİYYƏT təşkil edir.** Task 8 §8.6 və Task 9 / D-2 "unudulmaq
   hüququ"nu FİZİKİ silmə ilə icra edir. Universal soft-delete bunu pozar —
   silinən data bazada qalar.
2. Hazırda **hibrid model** var və o, QƏSDƏNDİR:
   - `posts.original_deleted` — repost konteksti üçün soft-mark
   - `teams` — soft-delete (Task 7 §8/3)
   - `bans`/`mutes.revoked_at` — audit izi (Faza A2)
   - istifadəçi datası — FİZİKİ silmə (GDPR)
3. Hər oxu sorğusuna `WHERE deleted_at IS NULL` əlavə olunar — unudulan bir
   yer **silinmiş datanı sızdırar**. Bu, C-1 sinfindən qüsur riskidir.

**Həcm:** 5–7 gün · **Risk:** 🔴 yüksək (GDPR + sızma)
**Ön şərt:** hüquqi baxış — hansı datanın soft, hansının fiziki silinəcəyi
**siyasət** qərarıdır

---

## 🟠 Əlavə: əsl FK-lar (Faza 4-də İNDEKS ilə əvəz olundu)

**Nə:** `likes`, `bookmarks`, `comments`, `notifications`, `reports` üçün
həqiqi `REFERENCES` konstraintləri.

**Faza 4-də nə edildi:** FK əvəzinə **indekslər** əlavə olundu.

**Niyə:**

1. SQLite-də mövcud cədvələ FK əlavə etmək cədvəlin **yenidən qurulmasını**
   tələb edir — Task 6 §Faza D bunu məhz bu səbəbdən təxirə salmışdı.
2. **D1-də `PRAGMA foreign_keys` zəmanətli DEYİL.** Mövcud kod bunu
   `deletePost`/`deleteAccount` şərhlərində qeyd edir və asılıları AÇIQ
   təmizləyir. Yəni FK əlavə etsək belə o, icra olunmaya bilər.
3. FK-nın iki faydasından biri (bütövlük) tətbiq qatında **artıq var**;
   ikincisi (JOIN sürəti) **indeksdən** gəlir.

**Həcm:** 2–3 gün · **Risk:** 🟠 orta
**Ön şərt:** 🔴 **staging** (Faza 1.7-də quruldu, lakin D1/R2 id-ləri hələ
placeholder-dir — bax `docs/TASK-10-SCOPE.md` §5)

---

## Yenidən baxış meyarı

Bu bəndlər **avtomatik olaraq "heç vaxt" demək deyil**. Hər biri üçün açıq
tetikləyici var:

| Bənd | Nə vaxt yenidən qiymətləndirilməlidir |
|---|---|
| R-1 UUIDv7 | İD sıralaması ölçülən performans problemi yaradanda |
| R-2 `users` ayrılması | `resolveUser` p95-i ölçülüb qəbuledilməz çıxanda |
| R-3 `post_blocks` | Blok səviyyəsində sorğu tələb edən funksionallıq gələndə |
| R-4 soft-delete | Hüquqi baxış hansı datanın saxlanacağını təyin edəndə |
| FK-lar | Staging real resurslarla işə düşəndə |
