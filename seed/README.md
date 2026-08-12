# Collabix — demo seed sistemi

15 günlük sintetik istifadəçi ekosistemi yaradan generator, onun reset, audit və
hesabat alətləri. Spesifikasiya: repo kökündəki `COLLABIX_Seed.md`.

> ⚠ **Bütün yaradılan məlumatlar 100% sintetikdir.** Real şəxs, real e-poçt, real
> telefon və ya real ödəniş məlumatı işlədilmir. Bu rəqəmlər heç bir halda real
> istifadəçi statistikası kimi təqdim edilə bilməz — sayt özü də bunu
> `demo.tag` etiketi ilə admin panelində və statistika ekranında bildirir.

## Komandalar

| Komanda | İş |
|---|---|
| `npm run seed:demo` | Lokal D1-ə demo mühiti yazır (SEED_LEVEL=2 → 600 istifadəçi) |
| `npm run seed:reset` | Lokal D1-dən **yalnız demo** datanı silir |
| `npm run seed:audit` | Seed sonrası tam yoxlama (FK, yetim sətir, XP, ekran doluluğu) |
| `npm run seed:report` | `seed/SEED-REPORT.md` hesabatını yenidən qurur |
| `npm run seed:remote` | Remote (canlı) D1-ə yazır — açıq təsdiq tələb edir |
| `npm run seed:remote:reset` | Remote D1-dən demo datanı silir — açıq təsdiq tələb edir |

Miqyas `SEED_LEVEL` ilə seçilir (`seed/config.mjs`):

| Səviyyə | İstifadəçi | Təyinat |
|---|---:|---|
| 1 | 250 | kiçik demo / sürətli qaçış |
| 2 | 600 | **standart demo** (sənəd §1 hədəfi) |
| 3 | 1 000 | böyük demo |
| 4 | 2 500 | benchmark (sənəd §22 LEVEL 4) |

Bütün ikinci dərəcəli həcmlər (post, şərh, bəyənmə, tapşırıq…) istifadəçi
sayından törəyir — səviyyə dəyişəndə nisbətlər pozulmur.

## Production guard (sənəd §38)

İki ayrı qapı var:

1. `COLLABIX_ENV=production` — generator və reset **tamamilə** dayanır.
2. `--remote` — əlavə olaraq `SEED_CONFIRM_REMOTE=yes` tələb edir.

```bash
SEED_CONFIRM_REMOTE=yes npm run seed:remote
```

Audit və hesabat skriptləri yalnız OXUYUR, ona görə guard onlara tətbiq olunmur.

## Remote rejim necə işləyir (İKİQAT YAZMA)

`--remote` verildikdə hər ifadə **həm lokal SQLite faylına, həm də** remote D1-ə
gedir:

```
generate.mjs → db.insert()
                 ├── lokal miniflare SQLite (hazırlanmış ifadə)
                 └── SQL mətn növbəsi → wrangler d1 execute --remote --file
```

Səbəb: generator yazdığı sətirləri geri **oxuyur** — komanda üzvlükləri,
`user_stats` aqreqatları, nişan qaydaları və gündəlik statistika məhz həmin
oxulardan hesablanır. Yalnız SQL yığan sürüm öz yazdığını görmür, əvvəlki
qaçışın lokal sətirlərini görürdü və remote-a mövcud olmayan ID-lərə istinad
edən törəmə data gedərdi.

Bunun iki nəticəsi var:

- **Remote qaçışdan əvvəl lokal demo data təmizlənməlidir** (`npm run seed:reset`),
  əks halda lokal fayl iki qaçışın cəmini saxlayar.
- Qaçışdan sonra lokal baza remote-un güzgüsüdür, yəni `npm run seed:audit`
  faktiki olaraq remote datanı yoxlayır.

## Qaçış qaydası

```bash
npm run db:migrate:local     # sxem hazır olsun
npm run seed:reset           # köhnə demo data (varsa) silinsin
npm run seed:demo            # yaradılış
npm run seed:audit           # yoxlama — 0 kəsilmə gözlənilir
npm run seed:report          # SEED-REPORT.md
```

⚠ **`wrangler dev` işləyərkən seed qaçırılmamalıdır** — workerd SQLite faylını
tutur və yazma `SQLITE_BUSY` verir. Serveri dayandırın, seed edin, sonra
yenidən başladın.

## Fayl quruluşu

| Fayl | Məsuliyyət |
|---|---|
| `config.mjs` | BÜTÜN miqyas/paylanma parametrləri — generator heç bir rəqəmi öz içində sabitləmir |
| `db.mjs` | Driver: sxem yoxlaması, tranzaksiya, lokal/remote ikiqat yazma |
| `rand.mjs` | Determinist təsadüf, zaman xətti, paylanma köməkçiləri |
| `hash.mjs` | PBKDF2 parol heşi — worker/auth ilə eyni parametrlər |
| `content/` | Mətn hovuzları: insanlar, postlar, şərhlər, söhbətlər, iş sahəsi, çalışmalar |
| `generate.mjs` | 13 fazalı pipeline |
| `reset.mjs` | FK sırası ilə yalnız demo sətirlərin silinməsi |
| `audit.mjs` | Sənəd §43 yoxlamaları + ekran doluluğu + təhlükəsizlik |
| `report.mjs` | Sənəd §48/§23 hesabatı (`SEED-REPORT.md`) |
| `patch-repost-engagement.mjs` | Birdəfəlik yamaq (aşağıya bax) |

### Birdəfəlik yamaq: repost engagement

`patch-repost-engagement.mjs` generatorun köhnə sürümü ilə yaradılmış bazanı
yenidən qurmadan düzəldir: repost/sitat sətirlərinə bəyənmə, şərh, cavab,
reaksiya, bildiriş və XP əlavə edir, sonra sayğacları mənbədən yenidən
hesablayır. Yalnız `like_count = 0 AND comment_count = 0` olan sətirlərə
toxunur, yəni təkrar qaçış heç nə etmir.

Təzə seed üçün LAZIM DEYİL — generator artıq repostları şərh/bəyənmə
fazalarından əvvəl yaradır.

## Demo data necə tanınır

Reset və audit bu əlamətlərə görə işləyir:

```
users.username   LIKE 'demo_%'
teams.slug       LIKE 'demo_%'
invites.code     LIKE 'DEMO-%'
team_files.path  LIKE 'demo/%'
```

E2E datası (`e2e_*`) və real hesablar **toxunulmur**.

## Parollar (sənəd §40)

Hər demo hesabın parolu unikaldır: `<SEED_PASS><istifadəçi adının ilk 6 simvolu>`.
`SEED_PASS` standart olaraq `Demo2026!`-dir və `SEED_PASS` mühit dəyişəni ilə
əvəz oluna bilər. Ən aktiv 10 hesabın siyahısı hər qaçışda `DEMO-ACCOUNTS.md`
faylına yazılır — **bu fayl yalnız development/demo üçündür.**

## Audit nəyi kəsir

`audit.mjs` sıfır tolerantlıqla yoxlayır: sınıq xarici açarlar, yetim sətirlər,
dublikat username/e-poçt, gələcək tarixlər, mənfi sayğaclar, XP jurnalı ilə
`users.xp` fərqi, denormalizasiya olunmuş sayğacların (like/comment/follower)
real sətirlərlə uyğunluğu, hər əsas ekranın minimum doluluğu və hesab başına
əhatə (hər hesabın komandası, bildirişi, izləyicisi, DM-i olsun).

⚠ Bir yoxlama qəsdən "mövcudluq"a görə deyil, **seed sətirlərinə** görə
qurulub: demo hesaba sonradan real giriş etmək normaldır və o sessiyanın tokeni
real olmalıdır. Ona görə "real token yoxdur" yoxlaması yalnız seed-in yazdığı
sətirlərə (RFC 5737 test IP bloku) baxır.
