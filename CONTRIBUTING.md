# 🤝 Töhfə Vermə Qaydaları (Contributing)

Collabix layihəsinə göstərdiyiniz maraq və dəstək üçün təşəkkür edirik! Biz açıq mənbə (open-source) cəmiyyətinin gücünə inanır və hər bir köməkliyi böyük məmnuniyyətlə qarşılayırıq.

Bu sənəd sizə layihəyə necə töhfə verə biləcəyinizi göstərir.

## 📚 Ətraflı Məlumat (Wiki)
Zəhmət olmasa, hər hansı bir dəyişiklik etməzdən əvvəl tam [Töhfə Təlimatımızı (Wiki)](https://github.com/MuradoffTehmez/Collabix/wiki/Contributing) və [Sistem Arxitekturasını](https://github.com/MuradoffTehmez/Collabix/wiki/Architecture) oxuyun.

## 🚀 Necə Başlamalı?

1. **Repozitoriyanı Fork edin:** Layihəni öz GitHub hesabınıza kopyalayın.
2. **Klonlayın:** `git clone https://github.com/SizinHesab/Collabix.git`
3. **Branch Yaradın:** Yeni funksiya və ya xəta həlli üçün fərqli budaq (branch) açın. Məs: `git checkout -b feature/yeni-funksiya` və ya `bugfix/xeta-helli`.
4. **Kodu Yazın:** Vanilla JS (Frontend) və TypeScript (Backend - Cloudflare Workers) qaydalarına riayət edərək dəyişikliyinizi edin.
5. **Test Edin:** Kodu commit etməzdən öncə `npm run test:unit` və `npm run lint` ilə xətaları yoxlayın.
6. **Commit Edin:** Commit mesajlarınızı aydın və qısa şəkildə yazın. Məsələn: `feat: add realtime typing indicator`.
7. **Push və Pull Request:** Kodunuzu branch-a push edib əsas repozitoriyaya **Pull Request (PR)** açın.

## 🛠️ Kodlaşdırma Standartları
- **Vanilla JS:** Frontend tərəfində hər hansı bir çərçivə (framework) istifadəsi qadağandır.
- **Təhlükəsizlik:** DOM manipulyasiyası zamanı mütləq XSS yoxlamaları (məs: `el()` util funksiyası) aparılmalıdır. `innerHTML` istifadə etməyin.
- **Backend (Cloudflare):** D1 məlumat bazasına müraciətlər zamanı mütləq `.bind()` metodundan istifadə edərək SQL Injection qarşısı alınmalıdır.

## 🐛 Xəta (Bug) Bildirimi
Əgər sistemdə bir xəta tapmısınızsa, zəhmət olmasa [Issues](https://github.com/MuradoffTehmez/Collabix/issues) bölməsinə daxil olaraq **Bug Report** şablonunu seçin və xətanı detallı şəkildə bizə bildirin.

Collabix ailəsinə qoşulduğunuz üçün təşəkkürlər! 🎉
