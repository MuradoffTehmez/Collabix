# 🛡️ Təhlükəsizlik Siyasəti (Security Policy)

Collabix istifadəçilərin məlumat təhlükəsizliyinə ən yüksək prioritet olaraq yanaşır. Biz platformamızı Zero Trust, end-to-end şifrələmə texnikaları və Cloudflare-in təqdim etdiyi ən qabaqcıl qoruma mexanizmləri ilə dizayn etmişik.

Ətraflı Təhlükəsizlik Arxitekturası üçün zəhmət olmasa baxın: [Collabix Security Wiki](https://github.com/MuradoffTehmez/Collabix/wiki/Security)

## 📌 Dəstəklənən Versiyalar

Aşağıdakı cədvəldə təhlükəsizlik yeniləmələrini qəbul edən versiyalarımız göstərilmişdir:

| Versiya | Dəstəklənir? |
| ------- | ------------ |
| 1.0.x   | ✅ Bəli       |
| < 1.0   | ❌ Xeyr      |

Biz həmişə ən son versiyanı (master/main) istifadə etməyinizi şiddətlə tövsiyə edirik.

## 🚨 Təhlükəsizlik Açığının (Vulnerability) Bildirilməsi

Əgər siz Collabix-də hər hansı bir potensial təhlükəsizlik zəifliyi (XSS, SQL Injection, Authentication Bypass və s.) tapmısınızsa, sizdən **bunu GitHub Issues hissəsində İCTİMAİ OLARAQ PAYLAŞMAMAĞINIZI xahiş edirik.**

Bunun əvəzinə dərhal bizə gizli olaraq bildirin:
1. Layihənin təsisçisi ilə əlaqə saxlayın: **tahmaz@muradov.net** *(nümunə e-poçt ünvanı - zəhmət olmasa gerçək e-poçtunuzla dəyişin)*.
2. E-poçtunuza mövzu olaraq `[SECURITY VULNERABILITY]` başlığını əlavə edin.
3. Açığın necə (addım-addım) icra ediləcəyini, təsir dairəsini və mümkünsə həll yolunu bizə göndərin.

Biz, ən geci **48 saat ərzində** sizə geri dönüş edəcəyik. Problem təsdiqləndikdən sonra yamaq (patch) hazırlanacaq və sizə (qəbul edərsəniz) "White-hat" kimi təşəkkür ediləcəkdir.

### Bizim Verdiyimiz Zəmanət
Təhlükəsizlik araşdırmaçıları tərəfindən tapılan və bizə e-poçt vasitəsilə bildirilən heç bir təhlükəsizlik probleminə görə sizin əleyhinizə hüquqi addım atılmayacaq (Əgər siz sistemdən zərərli məqsədlərlə və ya şəxsi məlumatları ələ keçirmək üçün istifadə etməmisinizsə).

## ✅ Qabaqcıl Təhlükəsizlik Mexanizmlərimiz
- **PBKDF2-SHA256:** Bütün şifrələr 100,000 iterasiya və salt ilə şifrələnir.
- **JWT (JSON Web Tokens):** Xüsusi HS256 kriptoqrafiya alqoritmi ilə imzalanır və cihazlar arası eyniləşdirilir.
- **XSS Qoruması:** Heç bir daxil edilən mətn HTML elementi olaraq (`innerHTML`) brauzerə yansımır. DOMPurify vasitəsilə filtrdən keçirilir.
- **SQL Injection:** D1 (SQLite) tranzaksiyalarında xüsusi `.bind()` qoruması tətbiq olunur.
