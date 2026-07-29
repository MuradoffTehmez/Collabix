# E2E baseline — BAĞLANDI ✅

**Əvvəl (2026-07-28, commit `82fe945`):** 544 test → 278 keçdi · 186 skip · **80 sındı**
**Sonra (`f6307bd` + admin protokol skip-ləri):** **0 sınıq**

Bu fayl AUDIT-TASK-8 §8.0/Sual 0 üçün *dondurulmuş sınıq siyahısı* kimi
yaradılmışdı: baseline yaşıl deyildi, lakin 80 sınığın heç biri Task 7/8-dən
deyildi (`git stash` ilə təmiz `HEAD` üzərində eyni 12 test, eyni sətirlərdə
sınırdı). İstifadəçi qərarı ilə Task 8 davam etdi və siyahı sonradan tam
bağlandı. `KNOWN-FAILING.txt` artıq istinad nöqtəsi DEYİL — **tarixi sənəddir**.

## Nə idi və necə bağlandı

| Qrup | Say | Kök səbəb | Həll |
|---|---:|---|---|
| Admin paneli | ~40 | Panel sidebar TAB-larına bölünüb, jurnal terminal→cədvəl olub. Testlər köhnə tək-səhifə dizaynına yazılmışdı → elementlər DOM-da var, `.active` sinfi olmadığı üçün `hidden`. **Tətbiqdə qüsur yox idi** | `openTab()`, `openTaxonomyAccordion()`, cədvəl selektorları (`.badge-{lvl}`) |
| Mobile layihəsi | ~40 | Access token ömrü 15 dəq (`ACCESS_TTL`), tam dəst ~28 dəq. `mobile` başlayanda paylaşılan `AUTH_FILE` köhnəlmiş olur; desktop-da refresh rotasiyası baş veribsə, fayldakı köhnə token "reuse" sayılıb sessiyanı LƏĞV EDİR (**server davranışı düzgündür — qüsur harness-də idi**) | `auth-refresh` setup layihəsi `mobile`-dan əvvəl sessiyanı təzələyir |
| Admin CSV/protokol (mobile) | 3 | `heavy` səbəti (20/saat) eyni ixracın iki layihədə təkrarlanması ilə dolurdu → `rate_limited` | Viewport-dan asılı olmayan testlər yalnız `desktop`-da (`protocolOnly()`) |

## Yol boyu tapılan REAL məhsul qüsurları

Bunlar test qüsuru deyil — istifadəçiyə təsir edən defektlərdir:

1. **Admin sidebar mobildə mətni kəsirdi.** Üfüqi sürüşən zolaqda flex uşaqları
   sıxılırdı (`scrollW 127 > clientW 47` — 6 düymənin hamısı) → `flex: 0 0 auto`.
2. **Fasiləsiz uzun mətn bütün səhifəni üfüqi sürüşdürürdü.** 2000 simvolluq
   təsvir qrid trekini **18 810 px**-ə genişləndirirdi (viewport 360 px). Real
   həyatda uzun URL eyni nəticəni verərdi →
   `.user-card { min-width: 0; overflow-wrap: anywhere; }`
3. **`js/threat.js` `<tbody>`-yə `<div>` əlavə edirdi** — etibarsız HTML,
   brauzer onu cədvəldən kənara çıxarır və "boşdur" mesajı səhv yerdə görünürdü
   → `<tr><td colspan>`.

## Reqressiya yoxlaması

```bash
npx playwright test 2>&1 | tail -5
```

Sınıq sayı **0** olmalıdır.

⚠ Yeni sınıq çıxarsa, onu bu fayla **ƏLAVƏ ETMƏ** — səbəbini tap və bağla.
Bu siyahının yenidən böyüməsi baseline-ın itməsi deməkdir və sonrakı task-ların
reqressiyaları yenidən səs-küydə itər.

---

## 🔴 DÜZƏLİŞ (AUDIT-TASK-9, 2026-07-29) — "0 sınıq" İDDİASI ETİBARSIZ İDİ

Yuxarıdakı "**0 sınıq**" nəticəsi ölçüldüyü an üçün doğru ola bilər, lakin bu
faylın commit edildiyi İŞ AĞACINDA doğru DEYİLDİ. Task 9 iki müstəqil boşluq
tapdı:

1. **`home.spec.ts` — 21 testin HAMISI sınırdı.** `auth-fixture.ts` yaradılıb,
   lakin `playwright.config.ts`-dən layihə səviyyəsindəki `storageState`
   ÇIXARILMAYIB. Nəticədə sessiyalı kontekst QONAQ spec-inə də tətbiq olunurdu:
   `/` açılanda tətbiq publik səhifəni deyil, giriş etmiş görünüşü qurur →
   `#pub-welcome` heç vaxt `active` olmur → hər test 7 s timeout.
   ⚠ `auth-fixture.ts`-in ÖZ başlıq şərhi məhz bunu proqnozlaşdırırdı.
   → Düzəldildi: `home.spec.ts` sessiyanı açıq təmizləyir (`20079ab`).

2. **`mobile / admin.spec:235` ("#6 jurnal kopyalanır") hələ də sınır.**
   Dəyişikliklərdən ƏVVƏLKİ ağacda da təkrarlanır (30,4 s timeout), yəni Task 9
   reqressiyası deyil — sadəcə bağlanmamış qalıb.

**Dərs:** bu fayl artıq baseline SƏNƏDİ deyil, TARİXİ qeyddir. Növbəti task
baseline-ı **özü ölçməlidir** və ölçməni **kod dəyişməzdən əvvəl** bitirməlidir
(watch rejimi + `reuseExistingServer` ölçməni səssizcə korlayır — Task 9 §0).
