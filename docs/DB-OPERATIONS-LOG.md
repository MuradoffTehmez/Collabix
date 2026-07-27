# İstehsal bazası — əl ilə aparılan əməliyyatlar jurnalı

> AUDIT-TASK-5 §10/3 → AUDIT-TASK-6 §A-4 ilə yaradıldı.

## Niyə bu jurnal var

Task 3 ilə Task 5 arasında (2026-07-27, bir neçə saat ərzində) istehsal
bazasından sətirlər **əl ilə silinib** və bu heç yerdə qeydə alınmayıb.
Aşkarlanma yolu təsadüfi oldu: Task 5-in inventar sorğusu Task 3-dəki ölçmə
ilə ziddiyyət göstərdi.

Nəticə: **bootstrap datası da silinmişdi** (`rooms.general`) və qlobal çat
sükutla sınıq qalmışdı — heç kim xəbər tutmadı, çünki əməliyyatın izi yox idi.

## Qayda

**Miqrasiyadan KƏNAR hər `INSERT` / `UPDATE` / `DELETE` bura yazılır.**

Miqrasiya ilə edilən dəyişikliklər buraya yazılmır — onların izi
`migrations/` qovluğunda və `d1_migrations` cədvəlindədir.

Yazmadan əvvəl:

1. Təsirlənəcək sətirləri `SELECT COUNT(*)` ilə say (gözlənilən nəticə).
2. Silmə/dəyişmədirsə — əvvəlcə **ixrac** al (repo-dan kənar).
3. Əməliyyatdan sonra faktiki sayı yaz.

⚠ **Bootstrap datasına toxunma.** `rooms.general`, `taxonomies`, `faqs`,
`testimonials` — bunlar demo deyil; silinsə tətbiq çökür.
Bax `migrations/README.md` §3.

## Jurnal

| Tarix | İcraçı | Əməliyyat | Təsirlənən | Səbəb | İxrac |
|---|---|---|---|---|---|
| ? (Task 3 ↔ Task 5 arası) | ? | `teams`, `team_roles`, `users` (demo), `rooms` sətirlərinin silinməsi | `team_1`, `role_1`, `team_owner_123`, **`general`** və qalan bütün `rooms` sətirləri | ? | ❌ yoxdur |

> ⚠ Yuxarıdakı sətir **retrospektiv qeyddir**. Sənədləşdirilməmiş əməliyyatdır;
> bilinməyən sahələr `?` ilə saxlanılıb — **uydurulmayıb**.
> `general` otağı `0021_restore_bootstrap_rooms.sql` ilə bərpa edildi.

## Aşkarlama

`GET /api/health` bootstrap datasının mövcudluğunu yoxlayır
(AUDIT-TASK-6 §A-3):

```json
{ "ok": true, "checks": { "db": "ok", "bootstrap_general_room": "ok", "migrations_applied": 24 } }
```

`bootstrap_general_room: "missing"` → cavab **503** olur. Eyni hadisə təkrarlansa
bu dəfə sükutla keçməyəcək.
