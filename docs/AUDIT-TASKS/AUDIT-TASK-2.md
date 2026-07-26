# AUDIT-TASK-2 — Hüquqi Məzmun, Kimlik Datası və Domen Vahidliyi

**Layihə:** Collabix
**Mənbə audit:** `AUDIT-2026-07-26.md`
**Əlavə mənbə:** `AUDIT-TASK-1-REPORT.md` §5.1 (yeni tapıntı: versiya nəzarəti yoxdur)
**Bağlanan tapıntılar:** Hüquqi risk #12 (Critical — uyğunluq), L-8 (Low), struktur borcu #14 (domen ziddiyyəti), TASK-5 qalıq 8%
**Yeni bənd:** 2.0 — `git init` (AUDIT-TASK-1-REPORT §5.1-dən eskalasiya)
**Təxmini həcm:** 3 saat + 30 dəqiqə (2.0)
**Ön şərt:** AUDIT-TASK-1 tamamlanmış olmalıdır (kök `robots.txt` silinib, `.gitignore` düzəlib)
**Bloklayıcı asılılıq:** ⚠️ **2.1 bəndi istifadəçidən real hüquqi məlumat tələb edir — o gəlmədən 2.2–2.6 icra oluna bilməz**

---

## GOAL KOMANDASI (qısa forma)

```
/goal AUDIT-2  Əvvəlcə git init + ilk commit (Task 1-in dəyişiklikləri hələ izlənmir).
               Sonra: legal placeholder-ləri real hüquqi kimlik datası ilə əvəzlə,
               mövcud olmayan sosial URL-ləri sil (uydurma!), JSON-LD sameAs-ı düzəlt,
               domeni tək mənbədən idarə et (env dəyişəni).
               DONE: canlı Privacy/Terms-də '[' yoxdur + bütün URL-lər 200 + tək domen mənbəyi
                     + placeholder detektoru testi yaşıl.
```

---

# TAM PROMPT

> Aşağıdakı hissəni olduğu kimi icra agentinə ver.

---

## 1. ROL

Sən Collabix layihəsində işləyən **kıdemli mühəndissən** və bu task-da eyni zamanda **uyğunluq (compliance) məsul şəxsi** rolunu daşıyırsan.

Bu task-ın xüsusiyyəti: **texniki cəhətdən trivialdır, hüquqi cəhətdən yox.** Dəyişdirdiyin sətirlər canlı saytda Privacy Policy və Terms of Service səhifələrində göstərilir və data controller identifikasiyası kimi qanuni tələbi qarşılayır.

**Ən vacib davranış qaydası:** hüquqi kimlik datasını (şirkət adı, ünvan, hüquqi forma, əlaqə emaili, yurisdiksiya) **heç bir halda özündən uydurmа, təxmin etmə və ya "məntiqli görünən" dəyərlə doldurma.** Yanlış şirkət ünvanı olan məxfilik siyasəti placeholder-dən **daha təhlükəlidir**, çünki placeholder açıq şəkildə natamamdır, uydurulmuş data isə saxta təsdiqdir. Data yoxdursa — dayan və istə.

---

## 2. KONTEKST

### 2.a Layihə

Collabix — Cloudflare Workers (D1/R2/KV/DO/Queues) üzərində qurulmuş, canlı deploy edilmiş sosial/komanda platformasıdır. Frontend vanilla JS ESM (27 modul, 3 dil: az/en/ru), SSR meta inyeksiyası Worker səviyyəsində `worker/seo.ts` + HTMLRewriter ilə edilir.

### 2.b Bu task-ın həll etdiyi problem

Auditin §9 "Hüquqi / uyğunluq riski" bölməsi (bənd 12):

> `js/legal.js:5-7` — `company: '[ŞİRKƏT ADI / Collabix]'`, `address: '[Rəsmi ünvan — şəhər, küçə]'`, `social: 'https://discord.gg/[collabix]'`.
> Bunlar **Privacy Policy və Terms of Service** səhifələrində və footer-də **canlı saytda göstərilir**. Placeholder şirkət adı/ünvanı olan məxfilik siyasəti GDPR/yerli qanunvericilik baxımından **etibarsızdır** (data controller identifikasiyası tələb olunur).

Buna əlavə olaraq:
- **L-8** — `worker/seo.ts:122` JSON-LD `sameAs` sahəsi mövcud olmayan profillərə işarə edir (`instagram.com/collabix`, `github.com/collabix`) → struktur data etibarını aşağı salır, Google-un E-E-A-T siqnallarına mənfi təsir edir.
- **Struktur borcu #14** — domen ziddiyyəti: silinmiş kök `robots.txt` `collabix.app` yazırdı, `worker/seo.ts:6` isə `collabix.muradofftehmez01.workers.dev`. Kök fayllar Task 1-də silindi, lakin **tək həqiqət mənbəyi hələ qurulmayıb** — domen hələ də kodda hardcoded-dır.
- **TASK-5 qalıq 8%** — audit TASK-5-i (i18n + SEO/GEO/AEO) 92% qiymətləndirib; çatışmayan hissə məhz `SITE.social` placeholder-ləridir.

### 2.c AUDIT-TASK-1-dən gələn yeni ön şərt

Task 1 hesabatı §5.1-də aşkarlanıb: **layihədə `.git` ümumiyyətlə yoxdur.** Nəticələr:
- Task 1-in dəyişiklikləri yalnız repo-dan kənar snapshot ilə geri qaytarıla bilir.
- Task 2 və sonrakı hər task eyni vəziyyətdə olacaq — geri qaytarıla bilməyən dəyişikliklər yığılacaq.
- Audit Sprint 1/#14-dəki CI qurulması (Task 10) **mümkün deyil** — ön şərti git-dir.

Ona görə bu task **2.0 bəndi ilə başlayır**. Bu, əhatə genişlənməsidir və şüurludur: 30 dəqiqəlik iş bütün qalan task zəncirini bərpa edilə bilən edir.

---

## 3. ƏHATƏ — 7 BƏND

---

### 2.0 · Versiya nəzarətinin qurulması (ÖN ŞƏRT)

**Mənbə:** `AUDIT-TASK-1-REPORT.md` §5.1 · **Risk:** High (proses) · **Həcm:** 30 dəqiqə

**Nədir:** 6,7 MB-lıq, 171 endpoint-li, canlı deploy edilmiş layihə heç bir versiya nəzarəti altında deyil.

**Tələb — bu sıra ilə:**

#### Addım 1 — `.gitignore`-un hazır olduğunu təsdiqlə

Task 1-də düzəldilib. Yenidən yoxla ki, ilk commit sirr daşımasın:
```bash
cat .gitignore
```
Aşağıdakılar mütləq olmalıdır: `node_modules/`, `dist/`, `.wrangler/`, `**/serviceAccountKey.json`, `**/.emulator-data/`, `**/auth_export/`, `**/*.pem`, `**/*.key`, `legacy/`, `testsprite_tests/`, `.dev.vars`, `.env*`.

**Əlavə et (Task 1-də yox idi, indi kritikdir):**
```gitignore
# Cloudflare / yerli sirlər
.dev.vars
.dev.vars.*
.env
.env.*
!.env.example

# Miqrasiya artefaktları — 53 istifadəçinin PBKDF2 heşini daşıyır (AUDIT-TASK-1-REPORT §5.4)
migration-cf/import.sql
migration-cf/update.sql
```

#### Addım 2 — İlk commit-dən ƏVVƏL sirr taraması (MƏCBURİ)

```bash
git init
git add -A
git status --short > /tmp/staged.txt
wc -l /tmp/staged.txt
```

İndi **commit etmədən əvvəl** staged siyahını yoxla:
```bash
git diff --cached --name-only | grep -iE "\.env|dev\.vars|\.pem$|\.key$|serviceAccount|import\.sql|accounts\.json|config\.json"
```
**Nəticə boş olmalıdır.** Boş deyilsə → `git rm --cached <fayl>` + `.gitignore`-a əlavə et → yenidən yoxla.

Əlavə olaraq məzmun taraması:
```bash
git diff --cached | grep -inE "password=|api_key|secret|BEGIN (RSA|PRIVATE)" | head -40
```
Nəticələri **oxu və qiymətləndir** — `password` sözünün kodda qanuni istifadələri var (`pass_hash`, `verifyPassword`); axtardığın **dəyər** daşıyan sətirlərdir.

#### Addım 3 — İlk commit

```bash
git commit -m "chore: repo bazası — AUDIT-TASK-1 tamamlandıqdan sonrakı vəziyyət

Bu, layihənin ilk commit-idir. Əvvəlki tarixçə mövcud deyil.
Bazaya AUDIT-TASK-1-in bütün dəyişiklikləri daxildir:
  - H-2: /api/admin/admins admin qapısı
  - C-2: legacy/ silinməsi (53 açıq mətnli parol)
  - C-3: ARCHIVE_HOT_DAYS = 3650 (müvəqqəti)
  - M-16: .gitignore düzəlişi
  - L-1: X-XSS-Protection çıxarılması

Mənbə: AUDIT-2026-07-26.md, AUDIT-TASK-1-REPORT.md"
```

#### Addım 4 — Bundan sonrakı hər bənd ayrıca commit

Task 1 §5.1-dəki commit strategiyası artıq **icra oluna bilən**dir. Bu task-ın 2.1–2.7 bəndlərinin hər biri ayrıca commit alır.

**Qadağa:** ❌ Remote (GitHub və s.) əlavə etmə və push etmə. Bu, repo sahibinin qərarıdır — remote-un publik/private olması, kimin girişi olacağı və branch qorumaları ayrıca müzakirə tələb edir. Yalnız yerli repo qur.

---

### 2.1 · Hüquqi kimlik datasının toplanması — **BLOKLAYICI**

**Audit ID:** Hüquqi risk #12 · **Risk:** Critical (uyğunluq) · **Həcm:** istifadəçidən asılı

**Bu bənd kod dəyişikliyi deyil.** Bu, məlumat toplama addımıdır və 2.2–2.6-nın ön şərtidir.

**Tələb:** İstifadəçidən aşağıdakı cədvəli doldurmasını istə. Doldurulmamış sətir qalarsa **həmin sahəyə toxunma** — placeholder qalsın, çünki yanlış dəyər placeholder-dən pisdir.

| # | Sahə | Niyə lazımdır | Nümunə format |
|---|---|---|---|
| 1 | **Hüquqi ad** | Data controller identifikasiyası (GDPR Art. 13(1)(a) analoqu) | `"Collabix MMC"` və ya `"Tehmez Muradov (fərdi sahibkar)"` və ya `"Collabix"` (qeyri-rəsmi layihə) |
| 2 | **Hüquqi forma** | Terms-də məsuliyyət həddinin kimə aid olduğu | MMC / ASC / fərdi sahibkar / qeydiyyatsız şəxsi layihə |
| 3 | **Rəsmi ünvan** | Qanuni tələb; istifadəçinin şikayət ünvanı | Şəhər, küçə, bina — və ya qeydiyyatsızdırsa yalnız ölkə/şəhər |
| 4 | **Əlaqə emaili** | Data subject sorğuları (silmə, ixrac, etiraz) üçün **işlək** ünvan | `privacy@…` və ya real şəxsi email |
| 5 | **VÖEN / qeydiyyat nömrəsi** | Varsa — etibarlılıq siqnalı | Yalnız hüquqi şəxsdirsə |
| 6 | **Yurisdiksiya** | Terms-də mübahisə həlli bəndi | Azərbaycan Respublikası / digər |
| 7 | **Rəsmi domen** | Bax 2.5 | `collabix.app` və ya `*.workers.dev` |
| 8 | **Sosial profillər** | Yalnız **REAL MÖVCUD** olanlar | URL siyahısı, mövcud olmayanı yazma |

**Qərar qapısı — istifadəçi hüquqi şəxs deyilsə:**

Bu tamamilə normal haldır (şəxsi layihə, qeydiyyatsız). Bu halda **uydurma şirkət yaratma** — mətn belə formalaşdırılır:

| Sahə | Qeydiyyatsız layihə üçün düzgün dəyər |
|---|---|
| company | `Collabix` (məhsul adı, "MMC"/"LLC" **əlavə etmə**) |
| address | Yalnız ölkə/şəhər, məs. `Naxçıvan, Azərbaycan` — küçə/bina uydurma |
| legalForm | Sahəni tamamilə çıxar, "MMC" yazma |
| contact | Real işlək email — bu **məcburidir**, qeydiyyat olmasa da |

**Qeyd:** Mən hüquqşünas deyiləm və bu, hüquqi məsləhət deyil. Aşağıdakı yoxlama siyahısı GDPR və oxşar rejimlərin **ümumi** tələblərinə əsaslanır. Platforma AB istifadəçilərinə xidmət göstərirsə və ya böyüyürsə, mətnin hüquqşünas tərəfindən nəzərdən keçirilməsi tövsiyə olunur.

**Bu bənd tamamlanmayıbsa:** 2.2, 2.3, 2.6 icra olunmur. 2.0, 2.4, 2.5, 2.7 icra oluna bilər (onlar hüquqi datadan asılı deyil).

---

### 2.2 · `js/legal.js` — SITE placeholder-lərinin əvəzlənməsi

**Audit ID:** Hüquqi risk #12 · **Risk:** Critical · **Həcm:** 30 dəqiqə

**Yer:** `js/legal.js:5-7` və `:14-17`

**Hazırkı vəziyyət (auditdən doğrulanmış):**
```js
company: '[ŞİRKƏT ADI / Collabix]',
address: '[Rəsmi ünvan — şəhər, küçə]',
social:  'https://discord.gg/[collabix]',
```

**Tələb — icradan əvvəl:**

1. **`js/legal.js` faylını TAM oxu.** Audit bu faylın yalnız `SITE` obyektini və `LEGAL` mətnlərini qrep ilə yoxlayıb, sətir-sətir oxumayıb. Faylda başqa placeholder ola bilər.

2. **Bütün placeholder-ləri tap** — yalnız `SITE`-dakıları yox:
   ```bash
   grep -n "\[" js/legal.js | grep -vE "^\s*[0-9]+:\s*(//|\*)"
   grep -rn "TODO\|FIXME\|XXX\|placeholder\|PLACEHOLDER" js/legal.js
   grep -rn "example\.com\|lorem\|ipsum" js/legal.js
   ```
   Tapılanların **tam siyahısını** hesabata yaz.

3. 2.1-dəki cədvəldən gələn dəyərləri qoy. **Doldurulmamış sahə üçün placeholder-i saxla** və hesabatda "gözləyir" kimi işarələ.

4. Hər dəyişdirilmiş sahənin yanına mənbə şərhi qoy:
   ```js
   // Hüquqi kimlik datası — AUDIT-TASK-2 / hüquqi risk #12.
   // Bu dəyərlər Privacy Policy, Terms of Service və footer-də CANLI göstərilir.
   // Dəyişdirmək üçün hüquqi təsdiq lazımdır — placeholder-ə qaytarma.
   ```

**Qadağa:** ❌ `LEGAL` mətnlərinin özünü (Privacy Policy / Terms bəndlərinin məzmununu) yenidən yazma. Bu task **kimlik datasını** düzəldir, hüquqi mətn redaktəsi deyil. Mətndə uyğunsuzluq görsən — 2.6-da qeyd et, düzəltmə.

---

### 2.3 · Sosial URL-lərin təmizlənməsi

**Audit ID:** TASK-5 qalıq · **Risk:** Medium (etibar) · **Həcm:** 20 dəqiqə

**Yer:** `js/legal.js:14-17` (`SITE.social`), footer render kodu

**Nədir:** `https://discord.gg/[collabix]` — sintaktik olaraq etibarsız URL. Footer-də klikləndikdə 404 və ya brauzer xətası verir.

**Tələb — qərar ağacı:**

| Hal | Əməliyyat |
|---|---|
| Profil **mövcuddur** və 2.1-də URL verilib | Real URL qoy, sonra **canlı yoxla** (aşağı) |
| Profil **mövcud deyil** | **Sahəni tamamilə sil** — massivdən/obyektdən çıxar |
| Profil **gələcəkdə olacaq** | Yenə **sil**. Sınıq link "tezliklə" mesajından pisdir |

**Hər qalan URL-i maşınla yoxla:**
```bash
for u in <URL siyahısı>; do
  echo -n "$u → "
  curl -s -o /dev/null -w "%{http_code}\n" -L --max-time 10 "$u"
done
```
`200` olmayan hər URL silinir. `301/302` → son hədəf `200`-dürsə saxla, amma **son URL-i** yaz (yönləndirmə zənciri SEO dəyərini azaldır).

**Frontend qorunması:** `SITE.social` boş massiv/obyekt olduqda footer render kodu **çökməməlidir**. Boş halı yoxla:
```bash
grep -rn "SITE.social" js/
```
Hər istifadə yerində boş dəyərə qarşı müdafiə (`?.`, `Array.isArray`, uzunluq yoxlaması) olduğunu təsdiqlə. Yoxdursa əlavə et — bu, əhatənin qanuni hissəsidir, çünki sən boşaltma ehtimalı yaradırsan.

---

### 2.4 · JSON-LD `sameAs` sahəsinin düzəldilməsi

**Audit ID:** L-8 · **Risk:** Low · **Həcm:** 15 dəqiqə

**Yer:** `worker/seo.ts:122`

**Nədir:** JSON-LD struktur datasında `sameAs` massivi mövcud olmayan profillərə işarə edir:
```ts
sameAs: ['https://instagram.com/collabix', 'https://github.com/collabix']
```

**Niyə əhəmiyyətlidir:** `sameAs` axtarış sistemləri üçün **entity reconciliation** siqnalıdır — "bu təşkilat həm də budur" iddiası. Mövcud olmayan profilə işarə edən `sameAs` yoxlanılan zaman uğursuz olur və Knowledge Graph üçün mənfi siqnaldır. Layihə `AUDIT_2026.md`-də SEO üzrə özünə "100/100" verib; bu tapıntı həmin iddianı zəiflədir.

**Tələb:**

1. 2.3-dəki doğrulanmış URL siyahısını istifadə et — **eyni mənbədən**.
2. Real profil yoxdursa `sameAs` sahəsini **tamamilə çıxar**. Boş massiv (`sameAs: []`) də qoyma — schema.org-da boş massiv mənasızdır.
3. Düzəlişdən sonra JSON-LD-ni **valid olduğunu yoxla**:
   ```bash
   curl -s <URL> | grep -A40 'application/ld+json' | sed -n '2,40p' | python3 -m json.tool
   ```
   Sintaksis xətası verməməlidir.
4. `worker/seo.ts`-də başqa şişirdilmiş/yanlış struktur data sahəsi varmı — yoxla və hesabata yaz (`foundingDate`, `numberOfEmployees`, `aggregateRating` kimi sahələr uydurulubsa, onlar da eyni problemi daşıyır).

---

### 2.5 · Domen vahidliyi — tək həqiqət mənbəyi

**Audit ID:** struktur borcu #14 · **Risk:** Medium · **Həcm:** 45 dəqiqə

**Yer:** `worker/seo.ts:6` (ORIGIN), `wrangler.jsonc`, `js/legal.js`, `worker/og.ts`

**Nədir:** Task 1-də kök `robots.txt`/`sitemap.xml` (`collabix.app` yazan) silindi. Lakin domen hələ də **kodda hardcoded**-dır:
```ts
// worker/seo.ts:6
const ORIGIN = 'https://collabix.muradofftehmez01.workers.dev';
```

Bu, üç problem yaradır: (1) domen dəyişəndə kod dəyişməli olur, (2) staging mühiti (audit Sprint 3/#31) mümkün deyil, (3) fərqli fayllarda uyğunsuzluq riski qalır.

**Tələb:**

1. **Mövcud vəziyyəti kartla** — bütün domen istinadlarını tap:
   ```bash
   grep -rn "collabix\.app\|workers\.dev\|https://collabix" \
     worker/ js/ *.html *.json *.jsonc --include="*.ts" --include="*.js" \
     --include="*.html" --include="*.json" --include="*.jsonc" 2>/dev/null
   ```
   Nəticəni cədvəl kimi hesabata yaz: fayl:sətir → hansı domen → rolu.

2. **Env dəyişəni qur.** `wrangler.jsonc`-də `vars` bölməsinə əlavə et:
   ```jsonc
   "SITE_ORIGIN": "https://collabix.muradofftehmez01.workers.dev",
   ```
   *(2.1/sahə 7-də rəsmi domen verilibsə onu yaz.)*

3. **`worker/seo.ts:6`-nı fallback ilə env-ə bağla:**
   ```ts
   // Domen TƏK mənbədən gəlir: wrangler.jsonc → vars.SITE_ORIGIN (AUDIT-TASK-2 / borc #14).
   // Fallback yalnız binding yoxdursa işləyir (lokal dev). İstehsalda vars mütləq təyin olunur.
   const origin = (c.env.SITE_ORIGIN || 'https://collabix.muradofftehmez01.workers.dev').replace(/\/+$/, '');
   ```
   `Env` tipinə `SITE_ORIGIN: string` əlavə et (strict TS keçməlidir).

4. **Bütün digər hardcoded istinadları** eyni mənbəyə bağla — `og.ts`, `seo.ts`-in sitemap/canonical/JSON-LD hissələri, `js/legal.js`.

5. **Sondakı slash normalizasiyası** — `replace(/\/+$/, '')` mütləqdir, əks halda `${origin}/sitemap.xml` → `//sitemap.xml` yarana bilər.

**Qadağa:** ❌ Domeni faktiki olaraq **dəyişmə** (`workers.dev` → `collabix.app`). Bu, DNS, sertifikat, Cloudflare route konfiqurasiyası və SEO yönləndirmə planı tələb edir — ayrıca tapşırıqdır. Sən yalnız **mənbəni vahidləşdirirsən**, dəyəri yox. Rəsmi domen 2.1-də verilibsə, `vars`-a onu yaz və hesabatda "DNS/route konfiqurasiyası ayrıca lazımdır" bəndini işarələ.

---

### 2.6 · Hüquqi mətnin minimum tələblərə qarşı yoxlanması

**Audit ID:** Hüquqi risk #12 (genişləndirilmiş) · **Risk:** Medium · **Həcm:** 30 dəqiqə

**Bu bənd auditdə yoxdur — 2.2 icra olunarkən mətn onsuz da oxunacaq, ona görə eyni keçiddə yoxlama aparılır.**

**Tələb:** `js/legal.js`-dəki `LEGAL` mətnlərini (hər 3 dildə) oxu və aşağıdakı sual siyahısına **cavab cədvəli** hazırla. **Mətni düzəltmə** — yalnız boşluqları sənədləşdir.

| # | Sual | Var? | Yer / qeyd |
|---|---|---|---|
| 1 | Data controller kimdir — ad və ünvan göstərilib? | | |
| 2 | Data subject sorğuları üçün işlək əlaqə kanalı var? | | |
| 3 | Hansı data toplanır — sadalanıb? | | |
| 4 | Toplama məqsədi və hüquqi əsas göstərilib? | | |
| 5 | Data saxlanma müddəti göstərilib? | | ⚠️ Arxivləmə 90 gün (indi 3650) — mətnlə uyğundurmu? |
| 6 | Üçüncü tərəflər sadalanıb? | | Cloudflare, OAuth provayderləri (Google/GitHub/…), email servisi |
| 7 | İstifadəçi hüquqları (giriş, düzəliş, silmə, ixrac, etiraz) sadalanıb? | | Kodda `exportMyData` və `deleteAccount` var — mətndə əks olunubmu? |
| 8 | Cookie/sessiya izahı var? | | `cx_at`, `cx_rt`, `cx_sess` |
| 9 | Yaş həddi göstərilib? | | |
| 10 | Mətnin son yenilənmə tarixi var? | | |
| 11 | Mübahisə həlli / yurisdiksiya bəndi var? (Terms) | | |
| 12 | 3 dilin məzmunu **uyğundurmu**? | | Tərcümələr fərqli öhdəlik vəd etməməlidir |

**Xüsusi diqqət — kod ilə mətn ziddiyyəti:**
- Mətn "mesajlarınız X müddət saxlanılır" deyirsə və `ARCHIVE_HOT_DAYS` fərqlidirsə → **ziddiyyət**, hesabata yaz.
- Mətn "istənilən vaxt bütün datanızı ixrac edə bilərsiniz" deyirsə, lakin GDPR ixracı arxivi, `contact_messages`-i və komanda datasını əhatə etmirsə (audit hüquqi risk #13) → **ziddiyyət**, Task 8-ə bağla.

Nəticə: `docs/AUDIT-TASK-2-LEGAL-GAPS.md` — tapılan boşluqların siyahısı, hüquqi nəzərdən keçirmə üçün.

---

### 2.7 · Placeholder detektoru — reqressiya qoruması

**Həcm:** 30 dəqiqə

**Nədir:** Placeholder-lər canlı sayta çıxıb və aylarla qalıb. Bunun yenidən baş verməməsi üçün **avtomatik qapı** lazımdır.

**Tələb:** `e2e/legal.spec.ts` yarat (və ya mövcud spec-ə əlavə et):

```ts
import { test, expect } from '@playwright/test';

/**
 * AUDIT-TASK-2 — placeholder reqressiya qoruması.
 * Səbəb: `[ŞİRKƏT ADI]` və `discord.gg/[collabix]` canlı saytda aylarla qaldı
 * və auditdə hüquqi risk kimi qeyd olundu (AUDIT-2026-07-26 §9/12).
 * Bu test onların qayıtmasını bloklayır.
 */

const PLACEHOLDER_PATTERNS = [
  /\[[^\]]{2,60}\]/,          // [ŞİRKƏT ADI], [Rəsmi ünvan …]
  /\bTODO\b|\bFIXME\b|\bXXX\b/i,
  /lorem ipsum/i,
  /example\.com/i,
];

const LEGAL_ROUTES = ['/#/privacy', '/#/terms', '/#/about'];  // faktiki route-larla əvəzlə

for (const route of LEGAL_ROUTES) {
  test(`${route} — placeholder qalmayıb`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    const text = await page.locator('main').innerText();

    for (const re of PLACEHOLDER_PATTERNS) {
      expect(text, `${route} səhifəsində placeholder aşkarlandı: ${re}`).not.toMatch(re);
    }
  });
}

test('footer-də sınıq sosial link yoxdur', async ({ page, request }) => {
  await page.goto('/');
  const hrefs = await page.locator('footer a[href^="http"]').evaluateAll(
    (els) => els.map((e) => (e as HTMLAnchorElement).href),
  );

  for (const href of hrefs) {
    expect(href, `sintaktik olaraq etibarsız URL: ${href}`).not.toMatch(/\[|\]/);
    const res = await request.get(href, { maxRedirects: 3, timeout: 10_000 });
    expect(res.status(), `${href} → ${res.status()}`).toBeLessThan(400);
  }
});

test('JSON-LD sameAs yalnız mövcud profilləri göstərir', async ({ page, request }) => {
  await page.goto('/');
  const raw = await page.locator('script[type="application/ld+json"]').first().innerText();
  const ld = JSON.parse(raw);                       // sintaksis yoxlaması da budur

  for (const url of ld.sameAs ?? []) {
    const res = await request.get(url, { maxRedirects: 3, timeout: 10_000 });
    expect(res.status(), `sameAs sınıqdır: ${url}`).toBeLessThan(400);
  }
});
```

**Qeyd:** Xarici URL yoxlaması şəbəkədən asılıdır və CI-da flaky ola bilər. Flaky olarsa `test.describe.configure({ retries: 2 })` əlavə et, testi silmə — sınıq link aşkarlaması bu task-ın əsas dəyəridir.

---

## 4. ƏHATƏDƏN KƏNAR — bunları ETMƏ

| Tapıntı | Aid task | Səbəb |
|---|---|---|
| Hüquqi mətnin özünün yenidən yazılması | Ayrıca (hüquqşünas) | 2.6 yalnız boşluğu sənədləşdirir |
| Faktiki domen dəyişikliyi (DNS/route) | Ayrıca | Sertifikat + SEO yönləndirmə planı tələb edir |
| GDPR ixracının tamamlanması (hüquqi risk #13) | **Task 8** | Arxiv + komanda datası + `contact_messages` |
| `serveFile` avtorizasiyası (C-1) | **Task 7** | — |
| `sanitizePermissions` `'*'` (H-1) | **Task 3** | — |
| Rate limit səbətləri (H-4) | **Task 4** | — |
| 403-də `code` sahəsinin əlavəsi | **Task 4** | Task 1 hesabatı §5.3 — 33 route-a təsir edir |
| `migration-cf/import.sql` silinməsi | **Task 5** | Task 1 hesabatı §5.4 — `package.json` script-ləri asılıdır |
| Demo seed migration-ları (H-7) | **Task 5** | — |
| `styles.css` / `favicon.svg` optimizasiyası | **Task 10** | — |
| Git remote / push / branch qoruması | Repo sahibi | 2.0 yalnız yerli repo qurur |

---

## 5. İCRA QAYDALARI

### 5.1 Commit strategiyası

2.0 tamamlandıqdan sonra hər bənd ayrıca commit:

```
fix(legal): hüquqi kimlik datası placeholder-ləri əvəzləndi

Audit: AUDIT-2026-07-26.md §9/12
Risk: Critical (uyğunluq)
Təsir: Privacy Policy və Terms canlı saytda '[ŞİRKƏT ADI]' göstərirdi →
       data controller identifikasiyası yox idi.
Mənbə: istifadəçi tərəfindən təsdiqlənmiş hüquqi kimlik datası (AUDIT-TASK-2 §2.1)
Test: e2e/legal.spec.ts — placeholder detektoru
```

**Sıra:** 2.0 → 2.5 → 2.4 → 2.3 → 2.2 → 2.6 → 2.7
*(Hüquqi datadan asılı olmayan bəndlər əvvəl — 2.1 gecikirsə iş dayanmasın.)*

### 5.2 Uydurma qadağası

Bu task-ın ən vacib qaydası. **Aşağıdakılar heç bir halda uydurulmur:**
- şirkət adı, hüquqi forma, ünvan, VÖEN
- əlaqə emaili (işləməyən ünvan yazma)
- sosial profil URL-ləri
- JSON-LD-də `foundingDate`, `numberOfEmployees`, `aggregateRating` kimi sahələr

Data yoxdursa: **sahəni sil və ya placeholder-i saxla + hesabatda "gözləyir" işarələ.** Hər ikisi uydurmadan yaxşıdır.

### 5.3 Üçdilli uyğunluq

`js/i18n.js` 96,5 KB-dır və 3 dil daşıyır. Hüquqi mətn dəyişikliyi **hər üç dildə** paralel edilməlidir. Bir dildə düzəliş, ikisində placeholder → daha pis vəziyyət.

Yoxlama:
```bash
grep -c "\[" js/i18n.js    # dil bloklarında qalan placeholder sayı
```

### 5.4 Şərh mədəniyyəti

Task 1-də olduğu kimi: hər dəyişdirilmiş hüquqi sahənin yanına **niyə** və **dəyişdirmək üçün nə lazımdır** şərhi qoy. Bu sahələr gələcəkdə "sadəcə mətn" kimi görünüb təsadüfən dəyişdirilə bilər.

---

## 6. QƏBUL MEYARLARI

| # | Meyar | Doğrulama | Gözlənilən |
|---|---|---|---|
| 1 | Git repo mövcuddur | `git rev-parse --is-inside-work-tree` | `true` |
| 2 | İlk commit sirr daşımır | `git log --all -S "password=" --oneline` və `-S "API_KEY"` | **boş** |
| 3 | `.dev.vars` / `.env` izlənmir | `git check-ignore -v .dev.vars .env` | qayda göstərir |
| 4 | Strict TypeScript keçir | `npx tsc --noEmit` | exit 0 |
| 5 | Build uğurludur | `npm run build` | exit 0 |
| 6 | E2E reqressiya yoxdur | `npx playwright test` | Task 1 nəticəsi ≥ |
| 7 | Placeholder detektoru yaşıl | `npx playwright test legal` | hamısı keçir |
| 8 | Hüquqi səhifələrdə `[…]` yoxdur | canlı `/#/privacy`, `/#/terms` | 0 uyğunluq |
| 9 | Sosial URL-lər işləyir | `curl -o /dev/null -w "%{http_code}"` hər biri | `< 400` və ya sahə silinib |
| 10 | JSON-LD valid | `python3 -m json.tool` | sintaksis xətası yox |
| 11 | `sameAs` sınıq link daşımır | hər URL `curl` | `< 400` və ya sahə yoxdur |
| 12 | Domen tək mənbədən | `grep -rn "workers.dev\|collabix.app" worker/ js/` | yalnız `wrangler.jsonc` `vars`-da |
| 13 | `SITE_ORIGIN` binding işləyir | deploy sonrası `GET /sitemap.xml` | URL-lər düzgün domendədir |
| 14 | Sondakı slash problemi yoxdur | `curl -s <url>/sitemap.xml \| grep "//"` | `https://`-dən başqa `//` yoxdur |
| 15 | 3 dil uyğundur | `grep -c "\[" js/i18n.js` | 0 (hüquqi bloklarda) |
| 16 | Footer boş `social`-da çökmür | `SITE.social = []` ilə lokal test | səhifə render olunur |

---

## 7. HESABAT FORMATI

`docs/AUDIT-TASK-2-REPORT.md`:

```markdown
# AUDIT-TASK-2 — İcra Hesabatı

**Tarix:** …   **İcraçı:** …
**Commit-lər:** <hash → başlıq>
**Ön şərt vəziyyəti:** AUDIT-TASK-1 ✅ / git repo <quruldu / mövcud idi>

---

## 0. Ön şərt: versiya nəzarəti (2.0)
- İlk commit hash: …
- İzlənən fayl sayı: …
- Sirr taraması: <nəticə>
- İgnore edilən kritik yollar: <siyahı>

## 1. Bağlanan tapıntılar
| Audit ID | Bənd | Vəziyyət | Sübut |
|---|---|---|---|
| —      | 2.0 · git init            | ✅ | commit <hash> |
| #12    | 2.1 · hüquqi data toplandı| ✅/⏳ | <hansı sahələr gəldi> |
| #12    | 2.2 · legal.js düzəldildi | ✅/⏳ | <sətir siyahısı> |
| TASK-5 | 2.3 · sosial URL-lər      | ✅ | <saxlanan / silinən> |
| L-8    | 2.4 · JSON-LD sameAs      | ✅ | … |
| #14    | 2.5 · domen vahidliyi     | ✅ | … |
| —      | 2.6 · hüquqi boşluq auditi| ✅ | AUDIT-TASK-2-LEGAL-GAPS.md |
| —      | 2.7 · placeholder testi   | ✅ | e2e/legal.spec.ts, N test |

## 2. Qəbul meyarları
| … 16 sətir … |

## 3. Domen istinad xəritəsi (2.5/addım 1)
| Fayl:sətir | Domen | Rolu | Vəziyyət |

## 4. Doldurulmamış hüquqi sahələr
| Sahə | Vəziyyət | Bloklayır |
| address | ⏳ gözləyir | Privacy Policy tam etibarlı deyil |

## 5. Aşkarlanan yeni risklər
<2.6-dakı kod↔mətn ziddiyyətləri; seo.ts-də başqa uydurma struktur data; digər>

## 6. Açıq qalan öhdəliklər
- [ ] Hüquqi mətnin peşəkar nəzərdən keçirilməsi
- [ ] DNS/route konfiqurasiyası (rəsmi domenə keçid qərar verilibsə)
- [ ] Git remote qərarı (repo sahibi)
- [ ] AUDIT-TASK-1-dən miras: ARCHIVE_HOT_DAYS → "90" (Task 8-dən sonra)
- [ ] AUDIT-TASK-1-dən miras: TestSprite API açarının rotasiyası
- [ ] AUDIT-TASK-1-dən miras: 53 hesaba parol sıfırlama qərarı

## 7. Geri qaytarma planı
Artıq `git revert <hash>` ilə bənd-bənd mümkündür (2.0 sayəsində).
| Commit | Revert | Gözlənilən təsir |
```

---

## 8. BİRİNCİ ADDIM

**Addım A — dərhal icra et (hüquqi datadan asılı deyil):**
Bənd **2.0**-ı tamamla və ilk commit-in hash-ini bildir. Bu, bütün sonrakı işi bərpa edilə bilən edir.

**Addım B — sonra topla və təqdim et:**

1. `js/legal.js` faylının **tam məzmunu** (`SITE` obyekti + `LEGAL` mətnlərinin strukturu)
2. `grep -n "\[" js/legal.js` nəticəsi
3. `worker/seo.ts:1-20` və `:110-135` sətirləri
4. Domen istinad xəritəsi (2.5/addım 1-dəki grep nəticəsi)
5. `SITE.social`-ın frontend-də istifadə yerləri (`grep -rn "SITE.social" js/`)
6. Hüquqi səhifələrin faktiki route-ları (2.7-dəki `LEGAL_ROUTES` üçün)

**Addım C — istifadəçidən istə:**
§2.1-dəki 8 sətirlik cədvəli təqdim et və doldurulmasını gözlə. **Doldurulmamış sahə üçün heç nə uydurma.**

**Dayanma şərti:** 2.1 cədvəlində 1-ci (hüquqi ad) və ya 4-cü (əlaqə emaili) sahə gəlməzsə, 2.2 və 2.6 icra olunmur — bu iki sahə data controller identifikasiyasının minimumudur. Qalan bəndlərlə davam et və hesabatda blokeri işarələ.
