# Dondurulmuş E2E baseline — AUDIT-TASK-8 §8.0/Sual 0

**Ölçmə tarixi:** 2026-07-28 (AUDIT-TASK-7 sonu, commit `82fe945`)
**Nəticə:** 544 test → **278 keçdi · 186 skip · 80 sındı**

## Niyə bu fayl var

AUDIT-TASK-8 §8.0/Sual 0 yaşıl baseline tələb edir. Baseline yaşıl DEYİL, lakin
80 sınığın **heç biri Task 7-dən deyil** — `git stash` ilə təmiz `HEAD` üzərində
`admin.spec --project=desktop` işlədildi və **eyni 12 test, eyni sətirlərdə**
sındı. Qərar (istifadəçi, 2026-07-28): **Task 8 davam edir, bu 80 test məlum
sınıq siyahısı kimi dondurulur; yalnız YENİ sınıqlar reqressiya sayılır.**

## İki kök səbəb

| Qrup | Say | Kök səbəb |
|---|---:|---|
| Admin paneli (desktop + mobile) | ~40 | `#adminUserList .admin-user-row` DOM-da var, lakin CSS ilə `hidden` — layout qüsuru |
| Mobile layihəsi | ~40 | Paylaşılan sessiya / viewport qüsuru (Task 4 §5.2-dən bəri açıq). **Eyni testlər desktop-da keçir** |

## İstifadə

Yeni dəst qaçışından sonra fərqi çıxar:

```bash
npx playwright test 2>&1 | sed -n '/failed$/,/skipped$/p' \
  | sed '1d;$d' | sed 's/ *─*$//;s/^    //' | sort > /tmp/now.txt
comm -13 e2e/KNOWN-FAILING.txt /tmp/now.txt    # YALNIZ yeni sınıqlar = reqressiya
```

`comm` çıxışı boşdursa reqressiya yoxdur.

## Öhdəlik

🔴 Bu siyahı **bağlanmalıdır** — bax `AUDIT-TASK-7-REPORT.md` §9 və
`AUDIT-TASK-8-REPORT.md` §10. Yaşıl baseline olmadan sonrakı task-ların
reqressiyaları səs-küydə itir.
