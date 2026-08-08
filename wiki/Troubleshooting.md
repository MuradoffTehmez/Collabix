# 🔧 Problemlərin Həlli (Troubleshooting)

> Collabix platformasını işlədərkən (həm lokal inkişaf, həm də canlı mühit) rastlaşa biləcəyiniz problemlər və onların həlli yolları.

---

## 💻 Lokal İnkişaf (Local Development) Xətaları

### Xəta: "Cannot read properties of undefined" (D1 Error)
**Səbəb:** `wrangler.jsonc` faylında `d1_databases` altında lokal mühit üçün ID göstərilməyib və ya miqrasiyalar aparılmayıb.
**Həll:**
```bash
npm run db:migrate:local
```
Əmrini icra edib bütün 54 cədvəlin düzgün formalaşdığına əmin olun.

### Xəta: "D1: too many parameters" və ya "IN (?x2000) limits"
**Səbəb:** SQLite/D1 eyni anda 100-dən çox parametr qəbul edə bilmir. Əgər siz array ilə (`IN (...)`) çoxlu məlumat axtarırsınızsa, bu xəta yaranır. (Məsələn, TASK-8-dəki cron arxivləşdirmə prosesi).
**Həll:** Massivi (array) 100-100 `chunk`lara (parçalara) bölərək `Promise.all` və ya dövr (loop) içində D1-ə ardıcıl sorğu göndərin.

### Xəta: "MFA / Magic Link Email Getmir"
**Səbəb:** E-poçt servisi (Resend) üçün açarınız yoxdur.
**Həll:** Layihənin kök qovluğundakı `.dev.vars` faylında `RESEND_API_KEY` əlavə edilməlidir.

### Xəta: "Turnstile (CAPTCHA) Failed" Lokal serverdə
**Səbəb:** Turnstile Cloudflare-in təhlükəsizlik alətidir, o ancaq canlı IP və ya tanınmış domenlərdə normal işləyir. 
**Həll:** `.dev.vars` faylında `TURNSTILE_SECRET` açarını boş buraxın. Bu bot qorumasını lokalda bağlayacaq və testlərinizi rahat davam etdirəcəksiniz.

---

## 🌐 İstifadəçi Tərəfi (Client-Side) Ümumi Problemlər

### Məlumatlarım (Bəyənmələr, İzləmələr) yenilənmir!
**Həll:** Tətbiq birbaşa API-yə getmədən əvvəl LocalStorage/Keş və daxili `store.js`-dən məlumatları oxuyur. Əgər asinxron bir xəta yaranıbsa, səhifəni tam yeniləyin (Ctrl + F5). Bu həm önbelleyi (cache), həm də Redux-vari state-i sıfırlayacaq.

### Chat-da (Otaqda) "Offline" düşürəm və ya mesajım getmir
**Həll:** Cloudflare WebSocket 100 saniyə (idle) boş qaldıqda əlaqəni kəsir. Həmçinin Metro/Tunel kimi yerlərdə internet zəifləməsi buna səbəbdir. Tətbiq bir neçə saniyədən bir öz-özünü bərpa etməyə (Exponential backoff) cəhd edir. Lakin çox uzun sürərsə səhifəni 1 dəfə Refresh edin.

### Avatar yükləyərkən (Upload) xəta alıram
**Səbəb:** Çox güman ki yükləmək istədiyiniz fayl icazə verilən şəkil formatında (JPEG, PNG, WEBP) deyil və ya sistemin icazə verdiyi Maksimum Fayl Ölçüsündən (Məs. 5 MB) böyükdür.
**Həll:** Şəkli fərqli bir tətbiqdə sıxaraq (compress) yenidən cəhd edin.

---

## 🛠️ Əlavə Kömək
Əgər probleminizi yuxarıda tapa bilmədinizsə, lütfən brauzerinizin "Developer Tools -> Console" bölməsini (F12) açın. Qırmızı rənglə yazılan xətanın şəklini çəkərək bizə [Bug Report (İssue)](https://github.com/MuradoffTehmez/Collabix/issues/new?template=bug_report.md) göndərin.

---

**Əvvəlki:** [← Tez-tez Verilən Suallar](FAQ) | **Növbəti:** [Əlaqə və Dəstək →](Support)
