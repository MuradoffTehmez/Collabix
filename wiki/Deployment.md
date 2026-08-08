# 🚀 Deploy Təlimatı (Deployment)

> Collabix-in Cloudflare mühitinə həm Staging (Test), həm də Production (Canlı) nüsxələrinin göndərilməsi qaydaları.

---

## 📦 Cloudflare Workers Mühiti

Cloudflare-ə deploy Wrangler CLI (`wrangler`) vasitəsilə həyata keçirilir. Proses iki əsas hissədən ibarətdir:
1. **Frontend (Statik Fayllar):** Vite tərəfindən paketlənir (build) və Workers Assets olaraq yüklənir.
2. **Backend (API):** TypeScript kodları compile olunub Worker (V8 Isolate) olaraq Edge şəbəkəsinə paylanır.

---

## 🧪 Staging (Sınaq) Mühiti

Production-a çıxmadan əvvəl dəyişikliklər real Cloudflare xidmətləri ilə `staging` mühitində yoxlanılır.

### Staging Konfiqurasiyası

Bu əmrlər (bir dəfəlik hesab sahibi tərəfindən) icra olunmalıdır:
```bash
wrangler d1 create collabix-db-staging
wrangler r2 bucket create collabix-files-staging
wrangler kv namespace create SESSIONS_STAGING
```
Və bu ID-lər `wrangler.jsonc`-dəki `env.staging` altına yerləşdirilir.

### Staging-ə Deploy

Əvvəlcə məlumat bazasında (D1) hər hansı yeni miqrasiya varsa, onu staging-ə tətbiq edin:
```bash
npx wrangler d1 migrations apply collabix-db-staging --remote --env staging
```

Və tətbiqi deploy edin:
```bash
npm run build
npx wrangler deploy --env staging
```
Bu, tətbiqi `collabix-staging.muradofftehmez01.workers.dev` kimi sınaq URL-ində canlıya alacaq.

---

## 🌍 Production (Canlı) Mühit

Hər şey staging-də qaydasındadırsa, əsas istifadəçilərə açıq olan Production mühitinə çıxırıq.

### 1. D1 Miqrasiyaları Yoxla
Sıralamanın doğru olduğundan əmin olmaq üçün `check:migrations` scripti işə salınır (Bu onsuz da `predeploy` olaraq package.json-a əlavə edilib).
Yaradılmış SQL dəyişikliklərini canlı bazaya tətbiq edin:
```bash
npm run db:migrate:remote
```

### 2. Canlı Deploy
Bu komanda həm `vite build` işlədir, həm də Cloudflare-ə əsas nüsxəni (production) göndərir:
```bash
npm run deploy
```

*(Qeyd: CI/CD avtomatlaşdırması GitHub Actions vasitəsilə qurula bilər)*

---

**Əvvəlki:** [← Test Strategiyası](Testing) | **Növbəti:** [Yol Xəritəsi →](Roadmap)
