# ⚡ Real-Vaxt Ünsiyyət (Realtime / WebSocket)

> Collabix-in WebSocket və Cloudflare Durable Objects (DO) əsasında işləyən yüksək sürətli real-vaxt məntiqi.

---

## 🏗️ Niyə Durable Objects (DO)?

WebSocket bağlantıları hər serverdə "state" (vəziyyət) tutmalıdır. Lakin Serverless Worker-lər (Cloudflare) daima yaradılıb məhv edilirlər, yəni stateless-dirlər (vəziyyət saxlamırlar). 
Bunu həll etmək üçün, xüsusi bir node-da yerləşən və yaddaşı daim qorunan (Stateful) tək bir maşın - **Durable Object (DO)** istifadə edilir. Otaqdakı və ya sistemdəki bütün websocket bağlantıları həmin DO-ya mərkəzləşir və məlumatları bütün müştərilərə eyni anda paylayır (Fan-out).

---

## 🟢 PresenceDO (Mövcudluq və Onlayn Statusu)

Bu sistem kimin onlayn, kimin oflayn olduğunu qlobal miqyasda ölçür. 

1. **Heartbeat (Ürəkdöyüntüsü):** Brauzer (Client) tətbiq açıq olduğu müddətcə müəyyən saniyədən bir arxa-planda `PresenceDO`-ya gizli bir `ping` göndərir.
2. **Statusların Yenilənməsi:** `PresenceDO` öz daxili yaddaşında kimin sonuncu dəfə nə vaxt "ping" atdığını qeyd edir. 
3. **Yayım (Broadcast):** Tətbiqdəki bütün istifadəçilərə cari statuslar (Məsələn, Tahmaz - Online, Ali - 5 dəqiqə əvvəl) anında göndərilir. Ekranda adların yanındakı Yaşıl/Boz nöqtələr bununla idarə olunur.

---

## 💬 RoomDO (Söhbət Otaqları)

Real-vaxt mesajlaşma və "yazır..." animasiyalarını idarə edir.

### Məlumat Axını (Data Flow)

1. **Bağlantı (Connect):** İstifadəçi otağa girir, Worker onu qəbul edir və WebSocket ilə `RoomDO`-ya yönləndirir (Upgrade edir).
2. **Mesajlaşma:**
   - İstifadəçi "Salam" yazır və göndərir.
   - JS `WebSocket.send()` vasitəsilə JSON göndərir.
   - `RoomDO` mesajı qəbul edir.
   - O, mesajı əvvəlcə `D1` (Relyasiyalı məlumat bazası) yaddaşına daimi olaraq yazır.
   - Sonra `RoomDO` eyni otaqdakı **bütün digər WebSocket müştərilərinə** mesajı dərhal təkrar yayımlayır (Broadcast).
3. **Typing Indicator:** İstifadəçi klaviaturaya basdıqda (keydown), bazaya heç nə yazılmadan sadəcə yüngül `is_typing` eventi yayılır və ekranda *"Tahmaz yazır..."* effekti görünür.

---

## 🛜 Bağlantının Bərpası (Exponential Backoff)

İnternet qırılarsa, və ya istifadəçi yeraltı metrodan keçərsə, brauzer WebSocket kəsintisini hiss edir. Kodu `chat.js` və `presence.js`-də yerləşən bərpa mexanizmi (Backoff), dərhal deyil (serveri yükləməmək üçün), saniyələri artıraraq (1s, 2s, 4s, 8s) serverə yenidən qoşulmağa cəhd edir. Bağlantı gələndə mesajlar senkronizasiya edilir.

---

**Əvvəlki:** [Oyunlaşdırma (Gamification)](Gamification) | **Növbəti:** [Komandalar və İş Sahələri](Teams-and-Workspaces)
