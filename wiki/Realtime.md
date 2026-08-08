# ⚡ Real-vaxt Arxitekturası (Realtime WebSocket)

Collabix heç bir kənar xidmət (məs. Pusher, Socket.io) istifadə etmədən **Cloudflare Durable Objects (DO)** üzərindən yerli olaraq real-vaxt (WebSocket) dəstəyi verir.

## 🧱 Əsas Komponentlər

### 1. `RoomDO` (Otaq Mesajlaşması)

Hər bir otaq üçün **ayrıca bir Durable Object instansı** (`idFromName(roomId)`) yaradılır. 

- **Mesaj Axını**: 
  - Brauzer → WS → DO → dərhal broadcast (bütün aktiv istifadəçilərə) → arxa planda asinxron D1 yazısı.
  - Bu struktur sayəsində mesajın qəbul edilmə və görünmə gecikməsi D1-in yazılma vaxtından asılı deyil.
- **Performans və Hibernation API**:
  - Boş duran DO yaddaşda saxlanılmır (Hibernation). Sükut dövründə xərc sıfıra enir.
- **Təhlükəsizlik və Spam Qoruması (Token-bucket)**:
  - DO səviyyəsində WebSocket üzərində ani spamın (burst) qarşısını almaq üçün `RATE_BURST = 12` və hər 1.5 saniyəyə bir token artırılması tətbiq olunub. Token vəziyyəti soketin `attachment`-ində saxlanılır ki, hibernation ərzində itməsin.
- **Avtorizasiya**:
  - `REAUTH_INTERVAL_MS = 60_000` ilə hər dəqiqə soket sahibinin həmin otağa hələ də giriş icazəsinin olub-olmaması yoxlanılır. Əgər istifadəçi otaqdan çıxarılarsa, WebSocket bağlantısı avtomatik qapanır.

### 2. `PresenceDO` (Qlobal Online/Offline Statusu)

Bütün platforma üçün **tək bir qlobal instans** (`idFromName('global')`) istifadə olunur.

- **İşləmə Məntiqi**: Bütün daxil olmuş istifadəçilər buraya WebSocket açır. Bir istifadəçi onlayn olduqda (gizli deyilsə), digər istifadəçilərə bu məlumat anında ötürülür.
- **Push Bildirişlər**: Server (worker) hər hansı bir istifadəçinin bütün açıq tablarına yeni bildiriş və ya DM (Direct Message) kimi siqnalları göndərə bilir (`push` metodu vasitəsilə). Məzmun özü isə REST ilə çəkilir, WebSocket yalnız xəbərdar edir.
- **Multi-Tab Dəstəyi**: Eyni istifadəçinin fərqli tablarda bir neçə bağlantısı ola bilər. Offline status yalnız onun **bütün** soketləri bağlandıqda digərlərinə yayımlanır.

## 🛡️ Təhlükəsizlik Mexanizmləri

- **Kimlik Doğrulama**: WebSocket "upgrade" anında URL-də gələn məlumatlar deyil, server-tərəfli cookie-lərlə doğrulanmış kimlik (index.ts tərəfindən) DO-ya ötürülür.
- **RPC Zəngləri**: Bir istifadəçi profil ayarlarında bildiriş və ya statusunu gizlədəndə, bu, REST API üzərindən RPC (Remote Procedure Call) ilə DO-ya ötürülür və dərhal qüvvəyə minir.

---
**Növbəti**: [Komandalar və İş Sahələri →](Teams-and-Workspaces)
