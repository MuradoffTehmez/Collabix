# Miqrasiya qaydaları

> AUDIT-TASK-5 / H-7 ilə yazıldı. Bu qaydalar `scripts/check-migrations.mjs`
> tərəfindən maşınla yoxlanılır — `npm run check:migrations`.

---

## 1. Bir nömrə = bir fayl

Fayl adı formatı: `NNNN_ad.sql` — 4 rəqəm, alt xətt, kiçik hərflərlə ad.
Nömrələr ardıcıldır, boşluq buraxılmır.

## 2. 🔴 Tətbiq olunmuş miqrasiya DƏYİŞMƏZDİR

Adı dəyişdirilmir, məzmunu redaktə edilmir, silinmir.

`wrangler` tətbiq tarixçəsini **fayl adı** ilə `d1_migrations` cədvəlində izləyir.
Faylı yenidən adlandırsan wrangler onu **yeni miqrasiya** sayar və **təkrar
tətbiq edər**. `INSERT OR IGNORE` daşıyan faylda bu zərərsiz görünə bilər, lakin
`ALTER TABLE`, `CREATE INDEX` və ya `DELETE` daşıyan faylda **dağıdıcıdır**.

Səhv varsa → **yeni** miqrasiya yaz, köhnəyə toxunma.

## 3. Seed datası miqrasiyaya YAZILMIR

İki sinif var və onları qarışdırmaq təhlükəlidir:

| Sinif | Nümunə | Miqrasiyada olsun? |
|---|---|---|
| 🟢 **Bootstrap** — tətbiqin işləməsi üçün lazımdır | `general` otağı, taksonomiyalar, FAQ, testimonial (`0002_seed.sql`) | ✅ Bəli |
| 🔴 **Demo/test** — uydurma nümunə data | `Alpha Team`, `Team Owner` (`0015`–`0018`) | ❌ Xeyr → `e2e/seed.ts` |

**Fərq testi:** bootstrap-sız tətbiq **çökür**; demo-suz tətbiq **işləyir**.

⚠ Tarixi səhv: `0015`–`0018` demo datasını istehsal bazasına yazırdı. Onlar
`0020_drop_demo_seed.sql` ilə təmizləndi (fayllar özləri qayda 2-yə görə
saxlanılır). Yeni demo datası **yalnız** `e2e/seed.ts`-ə yazılır.

## 4. Hər miqrasiya idempotent olmalıdır

`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
`INSERT OR IGNORE`, `DELETE … WHERE`.

Səbəb: miqrasiya təkrar tətbiq oluna bilər (qayda 2-nin pozulması, mühitin
bərpası, əl ilə icra). Təkrar icra **xəta verməməlidir**.

## 5. Mövcud dublikatlar — TARİXİ FAKT, DÜZƏLDİLMİR

| Nömrə | Fayllar | Tətbiq sırası |
|---|---|---|
| `0015` | `0015_project_members_requests.sql`, `0015_seed_teams.sql` | əlifba sırası ilə təsadüfən düzgün |
| `0016` | `0016_seed_chat_room.sql`, `0016_task11_schema.sql` | eyni |

⚠ Hər ikisi `d1_migrations`-də qeydə alınıb. **Yenidən adlandırılması təkrar
icraya səbəb olar** (bax qayda 2). Yoxlayıcı script bunları ağ siyahıda saxlayır;
**yeni** dublikat yaradılsa xəta verir.

## 6. Deploy sırası — miqrasiya deploy-dan ƏVVƏL

```bash
npm run db:migrate:remote     # əvvəlcə
npm run deploy                # sonra
```

`npm run deploy` artıq bu qapıdan keçir: `predeploy` script-i
`scripts/check-migrations.mjs --remote` çağırır və **tətbiq olunmamış miqrasiya
varsa deploy-u bloklayır**.

⚠ Niyə vacibdir: sıra pozulsa istehsalda yalnız **düzgün** parol 500 verir,
uğursuz giriş 401 qalır — yəni qüsur monitorinqdə "normal 401 fonu" kimi görünür
və **gizlənir** (audit, proses borcu #8).

---

## Yoxlama

```bash
npm run check:migrations            # ad formatı, dublikat, boşluq
npm run check:migrations -- --remote  # + tətbiq olunmamış miqrasiya qapısı
```
