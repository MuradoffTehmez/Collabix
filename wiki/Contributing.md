# 🤝 Töhfə Vermə Təlimatı (Contributing)

> Collabix-ə necə töhfə (contribute) verə biləcəyinizi anladan qaydalar toplusu. Açıq mənbə (Open-Source) və ya daxili mühəndislər üçündür.

---

## 🌱 Başlanğıc

Layihəyə kömək etmək istədiyiniz üçün təşəkkürlər! Töhfə verməzdən əvvəl:
1. Siyahıdakı [Issue-lərə (Problemlər)](https://github.com/MuradoffTehmez/Collabix/issues) göz atın.
2. Problemin təkrarlanmaması üçün yeni bir Issue açın və üzərində işləyəcəyinizi bildirin (Assign).
3. [Quraşdırma Təlimatını (Getting Started)](Getting-Started) oxuyub layihəni lokalda işə salın.

---

## 🔄 Git və PR (Pull Request) Axını

1. **Fork** edin (və ya icazəniz varsa Repository-ni klonlayın).
2. Yeni bir filial (Branch) yaradın. Şaxələndirmə qaydası:
   - `feature/yeni-xususiyyet` (Məs: `feature/dark-mode`)
   - `bugfix/xeta-helli` (Məs: `bugfix/login-crash`)
   - `docs/senetleme-adi` 
3. Kodu yazın və **commit** edin. Commit yazıları qısa, aydın və ingilis dilində (və ya layihənin dilində) olmalıdır:
   - `fix: resolved crashing issue on login page`
   - `feat: added drag and drop to kanban`
4. Değişiklikləri öz repozitoriyanıza **Push** edin.
5. Ana repository-yə (main branch) doğru **Pull Request (PR)** açın. PR təsvirinə dəyişikliyin səbəbini və sınaq (test) nəticələrini yazın.

---

## 📝 Kodlaşdırma Standartları (Style Guide)

### Frontend (Vanilla JS)
- Heç bir UI framework istifadə etməyin. Kod `/js/` altındakı modullara bölünməlidir.
- Funksional proqramlaşdırmadan istifadə etməyə çalışın.
- DOM manipulyasiyası zamanı **XSS hücumlarının qarşısını almaq üçün** *mütləq* `el()` util funksiyasını (və ya `document.createElement`) istifadə edin. Heç vaxt `innerHTML` istifadə etməyin!
- Dəyişənlər və funksiyalar üçün mənalı İngiliscə adlar (camelCase) seçin.

### Backend (TypeScript)
- `worker/` qovluğu Cloudflare Workers üçün yazılıb. Tipləri (Types/Interfaces) mütləq şəkildə dəqiqləşdirin (TypeScript qaydaları).
- Hər hansı bir SQL (D1) müraciəti edərkən **həmişə** `bind` metodundan istifadə edərək SQL Injection-ın qarşısını alın.
- `eslint` yoxlamasından keçməyən kodlar qəbul edilməyəcək. Mütləq `npm run lint` işlədin.

### Formatlama
- Layihədə **Prettier** istifadə olunur.
- ⚠️ **VACİB QAYDA:** Kütləvi `npm run format` əmrini bütün repozitoriyada işlətməyin! Bu `git blame` tarixini məhv edir. Yalnız öz dəyişdirdiyiniz fayllar üçün işlədin: `npm run format -- path/to/your/file.js`.

---

## 🧪 Testləmə

Yeni kodunuz sistemin digər hissələrini qırmamalıdır:
1. `npm run test:unit` ilə təməl funksiyaları yoxlayın.
2. Əgər vizual dəyişiklik və ya tam bir xüsusiyyət (Feature) əlavə etmisinizsə Playwright E2E testlərini (`npm run e2e`) icra edin.

PR-lər yalnız bütün testlərdən keçdikdən və Audit edildikdən sonra qəbul olunacaq (Merge).

---

**Əvvəlki:** [← Komandalar və İş Sahələri](Teams-and-Workspaces) | **Növbəti:** [Test Strategiyası →](Testing)
