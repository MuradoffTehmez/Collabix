# Collabix — TASK-7: Kritik bug-lar + Rəy/Repost/Tapşırıq tamamlanması (Cloudflare)

Sən təcrübəli full-stack + Cloudflare-edge mühəndisisən. TASK-6 icra olundu (30/31, E2E 110/110). İndi kritik bug-ları düzəldib bir neçə funksiyanı tamamlayacaqsan. **Diqqət:** 2 və 3-cü bəndlər (səhifə yenidən yüklənməsi) tətbiqi az qala yararsız edir — **əvvəlcə onlar**. Kod yazmadan əvvəl plan → təsdiq; hər fazadan sonra dayan, dəyişiklik + `tsc --noEmit` + `vite build` + `wrangler deploy --dry-run` + Playwright E2E (desktop + Pixel 7) + sıfır konsol xətası göstər.

## ⚙️ Stack
**Cloudflare Workers + D1 (SQLite/SQL) + R2 + KV + TypeScript + Vite + wrangler.** App qatı hash-routing, public real path (SSR HTMLRewriter). Custom auth (PBKDF2). Real-time (Durable Objects+WS) hələ qurulmayıb.

## 🔁 Ümumi qaydalar (hər bəndə)
- **Mövcud reusable-ları təkrar-istifadə et:** initials-avatar (`util.js avatarNode`), verified badge, toast, modal, skeleton, i18n `t()`/`tf()`, locale `fmtDate/fmtNum/fmtRelTime/fmtTime`, tema (dark/light/matrix), code-copy.
- Hər dəyişiklik: **mobil + AZ/EN/RU + 3 tema + `prefers-reduced-motion`**. Yeni mətn i18n açarı ilə. Schema dəyişikliyi **migration 0008+**.
- **Optimistic UI:** istifadəçi əməliyyatları (like/comment/repost/bookmark) dərhal DOM-da əks olunsun, xətada geri qaytarılsın — **naviqasiya/remount YOX**.
- Hər real bug üçün əvvəl **kök səbəbi ölç** (fərziyyə ilə deyil), sonra düzəlt + reqressiya E2E testi əlavə et.

---

# FAZA 1 — KRİTİK STABİLLİK (Bəndlər 3, 2, 1, 4)

Bu 4 bənd çox güman **eyni kökə** bağlıdır: app-qatı hash-router + əməliyyat handler-ləri tam səhifə remount/reload edir.

### Bənd 3 — Səhifə öz-özünə yenidən yüklənir (heç bir əməliyyat olmadan)
**Diaqnoz (əvvəl bunu et):** `window.addEventListener('beforeunload', e => console.trace('UNLOAD'))` və `hashchange`/`popstate`/`visibilitychange` log-la; bütün `setInterval`/`setTimeout`, `location.reload()`, `location.href=`, `remountCurrentPage()`, `<meta http-equiv=refresh>`, service worker update, presence heartbeat (30s) çağırışlarını audit et. Tetikləyəni tap.
**Həll:** data-təzələmə üçün olan timer/listener **tam reload/remount etməsin** — yalnız lazımi hissəni `fetch` + DOM-patch etsin (scroll, focus, açıq modal/dropdown qorunsun). Remount **yalnız real route dəyişəndə** baş versin (guard əlavə et: eyni route-a remount etmə).

### Bənd 2 — Like / rəy / bookmark → səhifə yenidən yüklənir
**Diaqnoz:** həmin düymələr `<a href>` / `<form>` içindədirmi? Handler-də `e.preventDefault()` varmı? Handler `location`/hash dəyişirmi?
**Həll:** hamısını `<button type="button">`-a çevir; handler `preventDefault()`+`stopPropagation()`; **async `fetch`** Worker API-yə; uğurda yalnız təsirlənən elementi yenilə (like sayı+dolu ürək, bookmark ikonu, yeni rəyi əlavə et) — **optimistic**, xətada rollback + toast. Səhifə remount/reload olmasın.

### Bənd 1 — Post silinmir ("silindi" yazılır, amma qalır)
**Səbəb:** silmə, repost-lar üçün olan **cascade soft-delete** məntiqini öz-postuna da tətbiq edir (yalnız `original_deleted=true` işarələyir), amma postun özünü silmir/DOM-dan çıxarmır.
**Həll:** ayır — **müəllif öz orijinal postunu siləndə:** D1-dən həqiqi `DELETE` (+ R2 şəkilləri, `comments`, `*_likes`, `post_shares` təmizlə) VƏ ona istinad edən repost/quote-ları `original_deleted=true` soft-mark et ("Bu məzmun silinib" göstər); sonra postu feed/profildən **DOM-dan çıxar**. "silindi" yalnız *başqasının* orijinalı silinən repost-lar üçün görünsün.

### Bənd 4 — Re-post işləmir
**Diaqnoz:** düymə API-yə bağlıdırmı; endpoint xəta verirmi; Bənd 2/3 reload-u repost-u da sındırırmı; `post_shares`/`share_count` məntiqi (migration 0005 indi tətbiq olunub) düzgündürmü.
**Həll:** repost toggle end-to-end işləsin — düymə → API (idempotent, `share_count` D1 `batch()` ilə atomik) → **optimistic** feed/profil yenilənməsi; "[user] re-post etdi" atribusiyası; repost-of-repost → kökə flatten; öz-postunu repost qadağan (aydın toast). Reload YOX.

---

# FAZA 2 — Rəy sistemi (LinkedIn üslubu) (Bənd 8)

Hazırkı rəy məntiqini LinkedIn kimi yenidən qur:
- **Threaded cavablar:** rəyə cavab (bir səviyyə iç-içə; daha dərin cavablar eyni thread-də `@mention` ilə düzlənir). D1: `comments(id, post_id, author_uid, parent_comment_id NULLABLE self-ref, text, created_at, edited_at, like_count)`.
- **@mention:** rəy/cavabda autocomplete → `@username` link + **bildiriş** (`comment_mention`). Rəyə cavab → parent müəllifə bildiriş (`comment_reply`); posta rəy → post müəllifinə bildiriş.
- **Reaksiya:** rəyə bəyənmə (`comment_likes(comment_id, uid)` kompozit PK), sayğac.
- **Redaktə/sil** (öz rəyi; müəllif/admin); silinəndə cavabları idarə et (soft "silinib" və ya cascade).
- **Sıralama:** ən yeni / ən çox bəyənilən; "daha çox rəy yüklə" (D1 LIMIT+cursor).
- Optimistic əlavə/like; avatar = initials-avatar; vaxt = `fmtRelTime`; verified badge. Mobil + i18n + tema.

---

# FAZA 3 — Profildə Sitat (Quote) + repost/quote göstərilməsi (Bənd 5)

- **Yaratma girişi:** paylaş modalındakı "Fikirlə paylaş" (quote) → composer açılır, orijinal post **embed** olunur, yuxarıya öz mətni/həştəqi əlavə edir (`post_type='quote'`, `quote_text`). Modal bütün post-ların altında (feed + profil + post detal).
- **Göstərilmə:** profildə istifadəçinin **repost və quote**-ları da post siyahısında görünsün (orijinal embed + "[user] re-post etdi" / quote mətni + orijinala klik-link). Boş isə uyğun empty-state.

---

# FAZA 4 — Otaq/DM mesajlarında avatar + vaxt (Bənd 9)

- Otaq (ümumi + study) və DM mesajlarında **göndərənin initials-avatarı** (şəkil yoxdursa Ə-M) + **mesaj vaxtı** (`fmtTime`/`fmtRelTime`, hover-də tam tarix).
- Ardıcıl eyni-göndərən mesajları qruplaşdır (avatar+ad bir dəfə, vaxt hər mesajda/qrupda — Slack/LinkedIn üslubu). Verified badge adın yanında. Mobil + i18n + tema. (Real-time çatdırılma hələ DO fazasında; bu yalnız göstərişdir.)

---

# FAZA 5 — Tapşırıq məntiqi: audit & fix (Bənd 7)

**Əvvəl araşdır:** cari task axınını (create/pending/approve/submission/review) izlə, pozulan yerləri **siyahıla**, sonra tam düzəlt. Hədəf lifecycle:
- **Yaratma:** hər istifadəçi təklif edir → `status='pending'` (server məcbur edir) → **"Gözləyən tapşırıqlar"** (yaradan + admin görür).
- **Moderasiya:** admin `approved`/`rejected` (yalnız admin; rules/route enforce) → təsdiqdə public, rəddə yaradana **bildiriş**.
- **Submission:** istifadəçi təsdiqli tapşırığa həll göndərir → `submissions` → admin **yoxlayır** (approve/reject) → təsdiqdə **XP** + həmin taksonomiya sahəsi üzrə **irəliləyiş** artır (TASK-4 "sahələr üzrə irəliləyiş" ilə bağla) + bildiriş.
- Kateqoriya dinamik taksonomiyadan; D1 status sütunları + index; bütün keçidlərdə bildiriş. Mobil + i18n + tema.

---

# FAZA 6 — Admin: Level (Lv) redaktəsi (Bənd 6)

- Admin user-edit modalına **Level (Lv)** [+ opsional XP] sahəsi; D1 `users.level`/`users.xp` update; audit log `user-level-edit` (düzgün səviyyə — TASK-6 `deriveLevel` cədvəlinə əlavə et); Lv göstərilən hər yerdə (profil, users kartı, badge) əks olunsun.

---

## 🔻 Qalan / köçürülən işlər (bu prompta daxil, amma ayrı faza / sənin tərəfin)
- **Real-time (Durable Objects + WebSocket) — növbəti böyük faza:** Room DO + broadcast, "typing…", presence miqrasiyası (heartbeat→DO), bildiriş fan-out. `wrangler.jsonc`-də DO binding **hələ yoxdur**. Bu, Admin#12 və İstifadəçilər#1-i tam bitirər. (Bu TASK-də yalnız Bənd 9-un *göstəriş* hissəsi var; canlı çatdırılma DO fazasında.)
- **Sənin tərəfindən:** `SITE.social` placeholder URL-ləri (`js/legal.js`: Discord/GitHub/LinkedIn).
- **Məlum məhdudiyyətlər (qərar tələb edir):** C#/Java/LinkedIn rəsmi loqoları simple-icons-dan trademark səbəbi ilə silinib (hazırda rəngli initial / mətn-nişan fallback); `online`/`mutual` filtrləri client-side (presence/follow dəstləri yalnız client-də) — DO fazasında server-side edilə bilər.

---

## 🗂️ D1 migration / schema (0008+)
```
0008: comments(id, post_id, author_uid, parent_comment_id→comments.id, text, created_at, edited_at, like_count)
      comment_likes(comment_id, uid) kompozit PK
      index: comments(post_id, created_at), comments(parent_comment_id)
      (tasks status/submissions, users.level/xp — mövcudsa yoxla, yoxdursa əlavə et)
```
- Bildiriş tipləri: `comment_reply`, `comment_mention`, `task_approved`, `task_rejected`, `submission_reviewed`.
- Delete cascade (Bənd 1) D1-də FK/`ON DELETE` və ya Worker daxilində batch ilə.

---

## ✅ Definition of Done
- [ ] (3) Səhifə heç vaxt öz-özünə reload olmur; data səssiz təzələnir (scroll/focus/modal qorunur).
- [ ] (2) Like/rəy/bookmark async + optimistic, reload YOX.
- [ ] (1) Öz post həqiqətən silinir (D1+R2+asılılar); repost-lar "silinib" soft-mark; feed/profildən çıxır.
- [ ] (4) Repost end-to-end işləyir (optimistic, atomik share_count, flatten, öz-post qadağan).
- [ ] (8) Rəylər LinkedIn-üslubu: cavab + @mention(bildiriş) + reaksiya + edit/sil + sort.
- [ ] (5) Quote profildən yaradılır və profildə repost/quote göstərilir.
- [ ] (9) Otaq/DM mesajlarında avatar + vaxt (qruplaşdırılmış).
- [ ] (7) Tapşırıq lifecycle-i düzgün (create→pending→approve→submission→review→XP+progress+bildiriş).
- [ ] (6) Admin istifadəçi Lv (+XP) redaktə edir; hər yerdə əks olunur.
- [ ] Hər dəyişiklik mobil+AZ/EN/RU+3 tema+reduced-motion; komponentlər təkrar-istifadə; tsc+build+dry-run+E2E ✅ (desktop+Pixel 7), sıfır konsol xətası; deploy qırılmayıb.

---

## ❓ Başlamazdan əvvəl təsdiq al
1. **Silmə (Bənd 1):** öz orijinal post silinəndə asılı repost/quote-lar **"silinib" soft-mark** (quote şərhi qorunur) — təsdiq? (Yoxsa onlar da silinsin?)
2. **Rəy dərinliyi (Bənd 8):** LinkedIn kimi **bir səviyyə** cavab (dərini @mention ilə düzlə) — uyğun?
3. **Rəy silinməsi:** cavabı olan rəy silinəndə "silinib" placeholder qalsın (thread qorunsun) — təsdiq?
4. **Tapşırıq XP (Bənd 7):** submission təsdiqində XP + sahə-irəliləyişi avtomatik artsın — miqdarı/qaydanı mən verim, yoxsa sən default təyin et?
5. **Level redaktə (Bənd 6):** admin yalnız Lv, yoxsa Lv+XP birlikdə dəyişsin?
6. **Real-time:** DO+WS fazasını bu TASK-dən sonra ayrıca edirik (indi yox) — təsdiq?

Təsdiqdən sonra FAZA 1 (əvvəl Bənd 3 diaqnozu) ilə başla.