# 📡 API Reference

> Collabix arxa-üzü (backend) tam **RESTful** prinsiplərlə işləyən **92+ endpoint**-ə malikdir. Bütün cavablar (responses) `JSON` formatındadır.

---

## 🔑 Autentifikasiya Üsulları

Endpoint-lərin əksəriyyəti giriş tələb edir. Sorğuya `Authorization` başlığı əlavə edilməlidir:

```http
GET /api/users/me HTTP/1.1
Authorization: Bearer <JWT_TOKEN>
```

---

## 🗂️ Kateqoriyalar üzrə Endpointlər

*Aşağıdakı siyahı sistemdəki API-lərin qısa xülasəsidir. Əsl tətbiqdə URL-lər `/api/...` formatındadır.*

### 🔐 Autentifikasiya (`/api/auth/*`)
- `POST /register` — Yeni hesab yaradır.
- `POST /login` — E-poçt/İstifadəçi adı və Şifrə ilə giriş edir.
- `POST /logout` — Cari sessiyanı ləğv edir.
- `POST /magic/request` — Magic link tələb edir.
- `POST /magic/verify` — Magic linki təsdiqləyir.
- `GET /sessions` — Aktiv sessiyaların siyahısını qaytarır.
- `DELETE /sessions/others` — Cari cihaz xaric digər sessiyaları sonlandırır.

### 👤 İstifadəçilər və Profil (`/api/users/*`)
- `GET /me` — Daxil olmuş istifadəçinin məlumatları.
- `GET /:username` — Müəyyən bir istifadəçinin profil məlumatı.
- `PUT /me` — Profili yeniləyir (Bio, bacarıqlar, sosial linklər).
- `GET /` — Çox parametrik (Axtarış, filter, pagination) istifadəçi siyahısı.
- `POST /:id/follow` — İstifadəçini izləyir.
- `DELETE /:id/follow` — İzləməni ləğv edir.

### 📝 Paylaşımlar və Lent (`/api/posts/*`)
- `GET /` — Sonsuz skroll üçün paylaşımlar axını.
- `POST /` — Yeni paylaşım (mətn, kod, şəkil, sorğu) yaradır.
- `GET /:id` — Tək postun detalları.
- `DELETE /:id` — Postu silir.
- `POST /:id/like` — Postu bəyənir.
- `POST /:id/share` — Postu repost/quote edir.
- `POST /:id/bookmark` — Postu yadda saxlayır.

### 💬 Şərhlər (`/api/comments/*`)
- `GET /?postId=:id` — Postun şərhlərini gətirir.
- `POST /` — Yeni şərh (və ya cavab) yazır.
- `POST /:id/like` — Şərhi bəyənir.

### 🌐 Otaqlar (Realtime Chat) (`/api/rooms/*`)
- `GET /` — Qlobal söhbət otaqlarının siyahısı.
- `GET /:id/messages` — Otaqdakı yazışma tarixçəsini (və ya arxivdən) çəkir.
- *WebSocket bağlantısı `RoomDO` vasitəsilə qurulur.*

### 📩 Şəxsi Mesajlar (`/api/dms/*`)
- `GET /` — Aktiv DM pəncərələrinin (threads) siyahısı.
- `GET /:username/messages` — Müəyyən istifadəçi ilə yazışmalar.
- `POST /` — Yeni şəxsi mesaj göndərir.

### 🏢 Komandalar (`/api/teams/*`)
- `GET /` — İstifadəçinin olduğu komandalar.
- `POST /` — Yeni komanda yaradır.
- `GET /:id` — Komandanın tam dashboard məlumatı.
- `POST /:id/members` — Dəvət göndərir (Email).
- `GET /:id/projects` — Komandanın layihələrini gətirir.
- `POST /:id/tasks` — Kanban tapşırığı yaradır.
- `GET /:id/files` — Komandanın paylaşılan fayllarını çəkir.

### ⚙️ İdarəetmə Paneli (`/api/admin/*`)
- `GET /stats` — Sistem statistikası (Qrafiklər üçün).
- `GET /logs` — Audit terminal logları.
- `PUT /users/:id/role` — İstifadəçinin rolunu dəyişdirir.
- `POST /users/:id/ban` — Hesabı bloklayır.
- `GET /reports` — Gələn şikayətlərə baxış.

### 📦 Fayl Əməliyyatları (`/api/files/*`)
- `POST /upload` — R2 anbarına fayl/şəkil yükləyir (MIME yoxlanışı ilə).

---

## 🚧 Status Kodları (HTTP)

Collabix API-lərindən qayıdan əsas status kodları:

| Kod | Ad | Mənası |
|-----|----|--------|
| `200` | **OK** | Sorğu uğurludur. |
| `201` | **Created** | Yeni resurs yaradıldı (məs: yeni post). |
| `400` | **Bad Request** | Parametrlər əksik və ya səhvdir. |
| `401` | **Unauthorized** | Token yoxdur və ya etibarsızdır. |
| `403` | **Forbidden** | İcazə yoxdur (RBAC yoxlamasından keçmədi). |
| `404` | **Not Found** | Resurs tapılmadı. |
| `429` | **Too Many Requests**| Rate Limit aşıldı. |
| `500` | **Server Error** | Gözlənilməz arxa-üz xətası. |

---

**Əvvəlki:** [Frontend Modulları](Frontend-Modules) | **Növbəti:** [Autentifikasiya](Authentication)
