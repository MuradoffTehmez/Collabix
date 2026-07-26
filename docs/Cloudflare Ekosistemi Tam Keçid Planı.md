# Cloudflare Ekosistemi Tam Keçid Planı

Bu plan `/goal` tapşırığında qeyd edilmiş Cloudflare ekosisteminin mərhələli şəkildə tam tətbiqini əhatə edir. (Queues və Turnstile artıq mövcuddur).

## User Review Required

Aşağıdakı yeni Cloudflare xidmətləri sistemə inteqrasiya ediləcək. Xahiş olunur arxitekturanı və təklif olunan istifadə ssenarilərini təsdiqləyəsiniz:
> [!IMPORTANT]
> - **Workflows**: Davamlı, kəsiləndə yenidən qaldığı yerdən davam edə bilən çox addımlı proseslər.
> - **AI Gateway + Workers AI**: Cloudflare-in lokal AI modelləri (məsələn, Llama 3) ilə mətn və ya embedding generasiyası. AI Gateway vasitəsilə sorğular qeydə alınır və rate-limit tətbiq edilir.
> - **Browser Rendering**: Server-side səhifə yüklənməsi, skrinşot (screenshot) və PDF yaradılması (Puppeteer vasitəsilə).
> - **Vectorize**: Verilənlərin semantik axtarışı üçün vektor bazası (RAG).

## Open Questions

Daha dəqiq biznes məntiqi yazmaq üçün bu detalları dəqiqləşdirməyə ehtiyac var:
> [!WARNING]
> 1. **Workflows Ssenarisi**: Hər hansı xüsusi uzunmüddətli proses varmı? (Məsələn: Yeni istifadəçi qeydiyyatından 1 gün sonra "Xoş gəldin" seriyası, yoxsa asinxron hesabatların generasiyası?) 
> 2. **Browser Rendering Məqsədi**: Bu funksiyanı əsasən hansı səhifələr üçün istifadə edəcəyik? (Məsələn: Postun PDF kimi yadda saxlanılması, yoxsa istifadəçi profilinin skrinşotunun çıxarılması?)
> 3. **AI Gateway**: Sizin Cloudflare hesabınızda spesifik bir "AI Gateway" konfiqurasiyası var, yoxsa mən sadəcə Worker daxilində universal bir konfiqurasiya yazım?
> 4. **Vectorize Məlumatları**: Semantik axtarış nə üçün istifadə ediləcək? (Postlar üzrə semantik axtarış, yoxsa başqa cür sənəd axtarışı?)

## Proposed Changes

### 1. `package.json`
- **[MODIFY]** `package.json`: Browser Rendering dəstəyi üçün `@cloudflare/puppeteer` paketi əlavə olunacaq.

### 2. Cloudflare Konfiqurasiyası (`wrangler.jsonc`)
- **[MODIFY]** `wrangler.jsonc`:
  - `workflows`: Yeni workflow class-ı üçün binding.
  - `ai`: Workers AI üçün binding.
  - `vectorize`: Semantik axtarış bazası üçün binding.
  - `browser`: Puppeteer əsaslı render üçün binding.

### 3. Tiplərin Yenilənməsi
- **[MODIFY]** `worker/util.ts`: `Env` interfeysinə `WORKFLOW`, `AI`, `VECTORIZE` və `BROWSER` tipləri əlavə olunacaq.

### 4. Workflows Tətbiqi
- **[NEW]** `worker/workflow.ts`: Nümunəvi (və ya biznes tələbinə uyğun) çoxmərhələli iş axını (`WorkflowEntrypoint` class-ı).
- **[MODIFY]** `worker/index.ts`: Yuxarıdakı Workflow class-ı export ediləcək və işə salmaq üçün API (`/api/workflows/start`) yaradılacaq.

### 5. Workers AI və AI Gateway
- **[NEW]** `worker/ai.ts`: Workers AI modellərini (Llama 3 və s.) çağırmaq, həmçinin AI Gateway vasitəsilə sorğuların izlənilməsini təmin edən utilitlər.
- **[MODIFY]** `worker/index.ts`: `/api/ai/chat` API endpoint-i yaradılacaq.

### 6. Browser Rendering
- **[NEW]** `worker/browser.ts`: `@cloudflare/puppeteer` işlədən və PDF/Screenshot generasiyası edən funksiyalar.
- **[MODIFY]** `worker/index.ts`: `/api/render/pdf` kimi API-lər əlavə olunacaq.

### 7. Vectorize (Semantik Axtarış)
- **[NEW]** `worker/vectorize.ts`: Mətnləri embedding vektorlarına çevirib (Workers AI ilə) Vectorize indeksinə yazan və oxuyan (semantik axtarış edən) məntiq.
- **[MODIFY]** `worker/index.ts`: `/api/search/semantic` endpoint-i əlavə olunacaq.

## Verification Plan

### Automated Tests
- Dəyişikliklərdən sonra build prosesi (`npm run build`) və `npm run typecheck` işlədiləcək.

### Manual Verification
- Sizin köməyinizlə Cloudflare Dashboard-da Vectorize indeksləri yaradılacaq: `wrangler vectorize create collabix-index --dimensions=768 --metric=cosine` və s.
- Lokal dev mühitində (`wrangler dev`) Workflow-un tətiklənməsi, PDF çıxarılması və AI funksiyalarının düzgün işləməsi yoxlanılacaq.
