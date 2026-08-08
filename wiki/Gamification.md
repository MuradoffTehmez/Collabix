# 🎮 Oyunlaşdırma (Gamification)

> Collabix, istifadəçilərin inkişafını izləmək və cəmiyyətdə aktiv iştirakı stimullaşdırmaq üçün Oyunlaşdırma sistemlərindən istifadə edir.

---

## 🔮 XP (Təcrübə Xalı)

XP, istifadəçinin platformada nə qədər vaxt keçirdiyini və icmaya nə qədər töhfə verdiyini ölçür. Server (`worker/xp.ts`) hər uyğun hərəkət üçün avtomatik XP təyin edir və loglayır (`xp_logs`). 

### XP Qazanma Mənbələri (Nümunəvi)

- **Post paylaşmaq:** +10 XP (Gündəlik limitli)
- **Suala cavab vermək / Şərh:** +5 XP
- **Doğru/Qəbul edilən cavab:** +15 XP
- **Tədris tapşırığı həll etmək:** +50 XP (Limitsiz)
- **Gündəlik platformaya giriş:** +5 XP
- **Profilini tamamlamaq:** Bir dəfəlik +30 XP bonusu

> **Zero Trust (Sıfır Güvən):** XP-lər heç vaxt frontend-dən göndərilən sorğu ilə verilmir. Onlar Backend tərəfində iş prosesi (məsələn, Post məlumat bazasına uğurla yazıldıqdan sonra) nəticəsində təyin olunur.

---

## 📈 Səviyyə (Level) Sistemi

XP-lər müəyyən miqdara çatdıqca, istifadəçinin Level-i (Səviyyəsi) yüksəlir. Səviyyələr inkişaf dinamikasını göstərir:

- **Level 1 (Yeni başlayan):** 0 — 99 XP
- **Level 2 (Aktiv üzv):** 100 — 299 XP
- **Level 3 (Təcrübəli):** 300 — 599 XP
- **Level 4 (Mütəxəssis):** 600 — 999 XP
- **Level 5+ (Lider):** 1000+ XP

Yeni səviyyəyə çatanda istifadəçiyə dərhal xüsusi Toast bildirişi və Notification (Bildiriş) gəlir.

---

## ⭐ Reputasiya (Reputation)

XP fəaliyyətə, **Reputasiya** isə *keyfiyyətə* əsaslanır.

- Başqaları sizin postunuzu və ya şərhi **bəyənəndə**,
- Həlliniz, digərləri tərəfindən **qəbul ediləndə**
- Sistem sizə Reputasiya xalı əlavə edir.

Əgər istifadəçi tez-tez Spam və Təhqir şikayətləri alırsa və bu şikayətlər Moderator tərəfindən haqlı tapılırsa, Reputasiya xalı mənfiyə düşə bilər.

---

## 🎖️ Nişanlar (Badges)

Badges (Nişanlar) istifadəçi nailiyyətlərini qeyd edir və profil ekranında nümayiş olunur. Onlar bəzi mərhələləri və ya nailiyyətləri tamamladıqda avtomatik olaraq (və ya admin tərəfindən) açılır.

Nümunə Nişanlar:
- 🌱 **İlk Addım** (İlk postunu paylaşdı)
- 🔥 **Aktiv Üzv** (7 gün ardıcıl daxil oldu)
- 🧑‍🏫 **Mentor** (50 mənalı şərh)
- 💻 **Kod Ustası** (10 kod tapşırığını doğru etdi)
- ✅ **Təsdiqlənmiş (Verified)** (Admin tərəfindən təsdiq edilib)

---

## 📅 Aktivlik Xəritəsi (Heatmap)

Profil səhifəsində, GitHub profillərində olduğu kimi 365 günlük, rənglərə (yaşıldan tünd-yaşıla) görə fərqlənən "Aktivlik Heatmap-i" mövcuddur. Hər yazılan kod, post və şərh bu xəritədəki kvadratları canlandırır.

---

**Əvvəlki:** [RBAC](RBAC) | **Növbəti:** [Realtime (WebSocket)](Realtime)
