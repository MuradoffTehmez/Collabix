# PRD — Collabix İstifadəçi Səviyyə (XP), Reputation və Role Sistemi

## Sənəd Məlumatı

**Layihə:** Collabix

**Modul:** User Progression & Authorization System

**Versiya:** 1.0

**Status:** Development

---

# 1. Məqsəd

Collabix platformasında istifadəçilərin aktivliyini mükafatlandırmaq, etibarlı icmanı formalaşdırmaq və idarəetmə səlahiyyətlərini təhlükəsiz şəkildə bölmək.

Bu sistem aşağıdakı üç anlayışı tamamilə bir-birindən ayırmalıdır:

* XP (Experience)
* Level
* Reputation
* Role

Bu dörd anlayış bir-birinə qarışdırılmamalıdır.

---

# 2. Əsas Prinsiplər

## XP

İstifadəçinin aktivliyini göstərir.

XP yalnız istifadəçinin etdiyi fəaliyyətlər nəticəsində artır.

XP heç vaxt idarəetmə səlahiyyəti vermir.

---

## Level

XP əsasında avtomatik hesablanır.

Level yalnız istifadəçi xüsusiyyətlərini açır.

Məsələn:

* yeni badge
* profil dizaynı
* daha çox media yükləmək
* yeni emoji
* AI limitinin artması

Level heç vaxt Moderator və ya Admin etmir.

---

## Reputation

İcmanın istifadəçiyə olan etibarıdır.

Reputation:

* Like
* Faydalı cavab
* Report
* Warning
* Spam
* Moderator qərarları

əsasında dəyişir.

---

## Role

İdarəetmə səlahiyyətidir.

Role yalnız səlahiyyət verir.

Role XP-dən asılı deyil.

Role yalnız Admin və ya Owner tərəfindən dəyişdirilə bilər.

---

# 3. İstifadəçi Modeli

Hər istifadəçidə aşağıdakı sahələr olmalıdır.

```typescript
User {

id

username

displayName

email

avatar

bio

createdAt

xp

level

reputation

role

badges[]

achievements[]

permissions[]

lastXPAt

lastLevelUpAt

}
```

---

# 4. Rollar

## USER

Standart istifadəçi.

---

## VERIFIED

Təsdiqlənmiş istifadəçi.

---

## PREMIUM

Premium xüsusiyyətlər.

---

## HELPER

İcmaya kömək edən istifadəçi.

Report cavablandıra bilər.

---

## MODERATOR

Şərhləri silə bilər.

Post gizlədə bilər.

Warning göndərə bilər.

Spam idarə edə bilər.

---

## SENIOR MODERATOR

Temporary Ban

Appeal baxışı

Moderator fəaliyyətinə nəzarət

---

## ADMIN

İstifadəçi idarəetməsi

Kateqoriyalar

Tag

Announcement

System Settings

---

## SUPER ADMIN

Tam sistem səlahiyyəti.

---

## OWNER

Layihənin sahibi.

Silinə bilməz.

---

# 5. Permission Sistemi

Role yalnız başlanğıcdır.

Əsas yoxlama Permission ilə edilməlidir.

Misal:

```typescript
permissions:{

canCreatePost

canDeleteOwnPost

canDeleteAnyPost

canHidePost

canEditAnyPost

canWarnUser

canMuteUser

canBanUser

canManageReports

canManageTags

canManageCategories

canManageSettings

canManageRoles

canViewAuditLogs

canManageAds

}
```

Backend hər əməliyyatda Permission yoxlamalıdır.

Role yalnız default permission təyin edir.

---

# 6. XP Sistemi

XP yalnız müsbət aktivlikdən gəlir.

| Hadisə             |   XP |
| ------------------ | ---: |
| İlk qeydiyyat      |  +50 |
| Profili tamamlamaq | +100 |
| Gündəlik giriş     |   +5 |
| Paylaşım           |  +10 |
| Orijinal paylaşım  |  +15 |
| Şərh               |   +2 |
| Repost             |   +3 |
| Like almaq         |   +1 |
| Faydalı cavab      |  +10 |
| Dost dəvəti        |  +50 |
| Hesabın təsdiqi    | +100 |

---

XP aşağıdakı hallarda verilməməlidir:

Spam

Silinmiş paylaşım

Silinmiş şərh

Bot fəaliyyəti

Flood

---

# 7. Level Hesablanması

Level avtomatik hesablanmalıdır.

Misal:

| Level |    XP |
| ----: | ----: |
|     1 |     0 |
|     2 |   500 |
|     3 |  1500 |
|     4 |  3500 |
|     5 |  7000 |
|     6 | 12000 |
|     7 | 18000 |
|     8 | 26000 |
|     9 | 36000 |
|    10 | 50000 |

Formula sonradan dəyişdirilə bilməlidir.

Database-də sabit saxlanılmamalıdır.

---

# 8. Reputation Sistemi

Reputation istifadəçinin etibarıdır.

Müsbət:

Like

Accepted Answer

Verified Report

Helpful Answer

Community Vote

Mənfi:

Spam

Warning

Mute

Ban

Report Abuse

Fake Content

Misal:

+1

+5

+20

-5

-20

-100

---

# 9. Badge Sistemi

Badge Role-dan ayrıdır.

Misal:

Verified

Developer

Designer

Photographer

Writer

Top Contributor

Early Supporter

Founder

Moderator

Admin

Premium

100 Posts

1000 Likes

1 Year Member

---

# 10. Achievement Sistemi

Misal:

First Post

100 Posts

500 Posts

1000 Comments

100 Followers

1000 Followers

365 Days Active

10000 XP

Level 20

Level 50

---

# 11. Level Unlock Sistemi

Level artdıqca yeni imkanlar açılır.

Misal:

LV1

Normal istifadəçi

---

LV3

Profil banneri

---

LV5

Daha çox media

---

LV8

Profil mövzuları

---

LV10

Animated Avatar

---

LV15

AI xüsusiyyətləri

---

LV20

Exclusive Badge

---

LV30

Creator Status

---

LV50

Legend Profile

---

# 12. Moderator Namizədliyi

İstifadəçi moderator olmur.

Müraciət edir.

Şərtlər:

90 gün hesab

LV15+

500 Reputation

Son 30 gündə Warning yoxdur

Verified hesab

Admin təsdiqləyir.

Role dəyişir.

XP dəyişmir.

---

# 13. Təhlükəsizlik

XP heç vaxt client tərəfindən dəyişdirilə bilməz.

XP yalnız server hesablamalıdır.

Permission yalnız serverdə yoxlanmalıdır.

Role yalnız Owner/Admin dəyişə bilər.

Level server tərəfindən hesablanmalıdır.

Reputation yalnız server dəyişə bilər.

Bütün dəyişikliklər Audit Log-a yazılmalıdır.

---

# 14. Audit Log

Qeyd olunmalıdır:

Role Change

Permission Change

XP Add

XP Remove

Reputation Change

Ban

Mute

Warning

Delete Post

Delete Comment

Admin Login

System Setting Change

---

# 15. Anti-Abuse Sistemi

XP farming qadağandır.

Eyni IP

Bot davranışı

100 spam comment

100 like exchange

Fake account

Auto report abuse

halında XP verilməməlidir.

Şübhəli fəaliyyətlər avtomatik işarələnməlidir.

---

# 16. Gələcək Genişləndirmə

Sistem aşağıdakı modulları dəstəkləməlidir:

* Seasonal XP
* Leaderboard
* Guild / Community Levels
* Weekly Challenges
* Daily Missions
* Creator Rank
* Verified Organization
* AI Reputation Score
* Contributor Program
* Public API

---

# 17. Uğur Kriteriyaları (Acceptance Criteria)

* XP yalnız server tərəfindən hesablanır.
* Level XP əsasında avtomatik yenilənir.
* Role və Level tamamilə ayrıdır.
* Permission əsaslı yoxlama bütün qorunan əməliyyatlarda tətbiq olunur.
* Reputation ayrıca idarə olunur.
* Badge və Achievement sistemi işləyir.
* Audit Log bütün kritik dəyişiklikləri qeyd edir.
* Anti-abuse mexanizmləri XP manipulyasiyasının qarşısını alır.
* Gələcəkdə yeni rollar, permission-lar və level mükafatları kodun əsas arxitekturasını dəyişmədən əlavə edilə bilir.

## Arxitektura Prinsipi

**XP = Aktivlik**

**Level = İnkişaf**

**Reputation = Etibar**

**Role = Səlahiyyət**

Bu dörd anlayış müstəqil saxlanılmalı və biri digərinin funksiyasını əvəz etməməlidir. Bu yanaşma Collabix-in uzunmüddətli miqyaslana bilməsi, təhlükəsizliyi və gələcək funksiyaların rahat inteqrasiyası üçün əsas prinsip kimi qəbul edilir.

# //////////////////////////////////////////////////////////

# Technical Design Document (TDD)

## Collabix User Progression & Authorization System

**Project:** Collabix

**Module:** XP • Level • Reputation • Role • Permission System

**Version:** 1.0

**Architecture:** Cloudflare Workers + D1 + R2 + KV + Durable Objects

**Status:** Technical Design

---

# 1. Məqsəd

Bu sənəd Collabix platformasında istifadəçi inkişafı (Progression), icma etibarı (Reputation) və səlahiyyət idarəetməsi (Authorization) sisteminin texniki implementasiyasını müəyyən edir.

Bu sistem aşağıdakı prinsiplərə əsaslanır:

* Zero Trust
* Server-side Validation
* Event Driven
* Permission Based Authorization
* Scalable
* Future Proof

---

# 2. Core Architecture

```
User Action
      │
      ▼
Cloudflare Worker
      │
      ▼
Authorization Middleware
      │
      ▼
Permission Validator
      │
      ▼
Business Logic
      │
      ▼
XP Engine
      │
      ▼
Level Engine
      │
      ▼
Achievement Engine
      │
      ▼
Notification Service
      │
      ▼
Audit Logger
      │
      ▼
Database
```

Heç bir client məlumatı etibarlı hesab olunmur.

---

# 3. User Schema

```ts
User {

id

username

displayName

email

avatar

cover

bio

createdAt

updatedAt

lastLogin

xp

level

reputation

role

isVerified

isPremium

isBanned

isMuted

status

}
```

---

# 4. Role Enum

```ts
enum Role {

OWNER

SUPER_ADMIN

ADMIN

SENIOR_MODERATOR

MODERATOR

HELPER

PREMIUM

VERIFIED

USER

GUEST

}
```

Role yalnız səlahiyyəti göstərir.

---

# 5. Permission Enum

```ts
enum Permission {

CREATE_POST

EDIT_POST

DELETE_OWN_POST

DELETE_ANY_POST

PIN_POST

LOCK_POST

CREATE_COMMENT

DELETE_COMMENT

DELETE_ANY_COMMENT

MANAGE_REPORTS

VIEW_REPORTS

WARN_USER

MUTE_USER

BAN_USER

RESTORE_USER

VERIFY_ACCOUNT

MANAGE_BADGES

MANAGE_LEVELS

MANAGE_ROLES

MANAGE_PERMISSIONS

MANAGE_TAGS

MANAGE_CATEGORIES

MANAGE_SETTINGS

VIEW_ANALYTICS

VIEW_AUDIT_LOG

MANAGE_ADS

MANAGE_API_KEYS

SYSTEM_BACKUP

}
```

---

# 6. Default Permission Mapping

```
USER
↓

CREATE_POST
CREATE_COMMENT

--------------------------------

MODERATOR

↓

DELETE_ANY_POST

DELETE_ANY_COMMENT

WARN_USER

MANAGE_REPORTS

--------------------------------

ADMIN

↓

ALL MODERATOR

+

MANAGE_USERS

MANAGE_SETTINGS

MANAGE_TAGS

--------------------------------

OWNER

↓

ALL
```

Permission DB-dən oxunmalıdır.

Hardcode edilməməlidir.

---

# 7. XP Engine

XP yalnız server tərəfindən hesablanacaq.

```
Client

↓

Worker

↓

XP Engine

↓

Validation

↓

Database
```

Client:

```
+100 XP
```

göndərə bilməz.

---

XP Rules

```
Daily Login

+5

Post

+10

Comment

+2

Like Received

+1

Verified Report

+20

Helpful Answer

+10

Profile Completed

+100
```

---

# 8. XP Anti Abuse

XP verilmir:

```
Spam

Bot

Flood

Duplicate Post

Mass Comments

Deleted Post

Deleted Comment

Auto Generated Spam
```

Rate Limit:

```
Max XP/hour

Max XP/day

Cooldown

Duplicate Detection
```

---

# 9. Level Engine

Formula:

```
Level = calculate(XP)
```

Misal:

```
0 XP

↓

LV1

500 XP

↓

LV2

1500 XP

↓

LV3
```

Level DB-də saxlanıla və ya XP-dən hesablanaraq cache edilə bilər. Hesablama strategiyası konfiqurasiya ilə dəyişdirilə bilməlidir.

---

# 10. Reputation Engine

Sources:

```
Like

Helpful Answer

Verified Report

Accepted Solution

Moderator Decision
```

Negative

```
Spam

Warning

Mute

Ban

Fake Report

Abuse
```

---

Formula

```
Rep

=

Positive

-

Negative
```

---

# 11. Badge Engine

Trigger Based

```
100 Posts

↓

Writer Badge

1000 Likes

↓

Popular Badge

365 Days

↓

Veteran Badge
```

---

# 12. Achievement Engine

```
First Login

First Post

100 Posts

1000 Comments

100 Followers

Level 10

Level 25

Level 50
```

---

# 13. Unlock Engine

```
LV2

↓

Banner

LV5

↓

More Upload

LV10

↓

Animated Avatar

LV20

↓

Creator Tools

LV50

↓

Legend Status
```

---

# 14. Authorization Middleware

Hər request:

```
Authentication

↓

Role

↓

Permission

↓

Business Rules

↓

Execute
```

Heç bir endpoint bypass edilə bilməz.

---

# 15. API Design

## XP

```
GET

/api/user/xp
```

```
GET

/api/user/level
```

```
GET

/api/user/reputation
```

---

Achievements

```
GET

/api/user/achievements
```

---

Badges

```
GET

/api/user/badges
```

---

Moderator

```
POST

/api/mod/warn
```

```
POST

/api/mod/mute
```

```
POST

/api/mod/ban
```

---

Admin

```
POST

/api/admin/role
```

```
POST

/api/admin/permission
```

---

# 16. Database Tables

```
users

roles

permissions

role_permissions

user_permissions

xp_logs

reputation_logs

badge_logs

achievement_logs

audit_logs

reports

warnings

bans

mutes
```

---

# 17. Audit Log

Hər dəyişiklik yazılır.

```
Role Changed

Permission Added

XP Added

XP Removed

Reputation Changed

Warning

Mute

Ban

Login

Settings Changed

Delete Post

Delete Comment
```

---

# 18. Notification Flow

```
Level Up

↓

Notification

↓

Animation

↓

Badge Unlock

↓

Toast
```

---

# 19. Security

Server Side Only

```
XP

Role

Permission

Reputation

Level

Badges

Achievements
```

Client yalnız oxuya bilər.

---

JWT

```
User ID

Session ID

Issued

Expire
```

Role JWT-də olsa belə, kritik əməliyyatlar zamanı server verilənlər bazasındakı cari icazələri yoxlamalıdır.

---

Rate Limit

```
Login

Comment

Post

Like

Report

Follow
```

---

CSRF

Required

---

XSS

Sanitize

---

SQL Injection

Prepared Statement

---

# 20. Caching

Cloudflare KV

```
Role

Permission

Badge

Achievement
```

TTL

```
5-30 min
```

Invalidate:

```
Role Change

Permission Change

Badge Unlock
```

---

# 21. Performance

Target

```
Permission Check

<5ms

XP Update

<10ms

Level Calculate

<5ms

Badge Check

<15ms
```

---

# 22. Monitoring

Metrics

```
XP Earned

Level Ups

Reports

Bans

Warnings

Permission Errors

Unauthorized Attempts

API Latency
```

---

# 23. Future Extensions

```
Guild XP

Clan Level

Season Pass

Daily Mission

Weekly Mission

Battle Pass

Creator Rank

Partner Program

AI Reputation

Marketplace Reputation

Skill Tree
```

---

# 24. Acceptance Criteria

* XP yalnız server tərəfindən hesablanır.
* Level XP əsasında yenilənir.
* Reputation ayrıca idarə olunur.
* Role və Permission tam ayrıdır.
* Bütün qorunan endpoint-lərdə Permission yoxlanılır.
* Audit Log bütün kritik əməliyyatları qeyd edir.
* Anti-abuse mexanizmləri XP manipulyasiyasını bloklayır.
* Sistem yeni rollar, permission-lar və level mükafatları əlavə edilərkən əsas arxitekturanın dəyişdirilməsini tələb etmir.
* Orta permission yoxlama gecikməsi 5 ms-dən az, XP yenilənməsi isə 10 ms-dən az hədəflənir.

---

# 25. Architecture Principles

```
XP
↓

Activity

-------------------

LEVEL

↓

Progress

-------------------

REPUTATION

↓

Trust

-------------------

ROLE

↓

Authority

-------------------

PERMISSION

↓

Access Control
```

Bu beş komponent müstəqil işləməli, bir-birindən asılı olmamalıdır. Sistem hadisə əsaslı (event-driven), server tərəfindən idarə olunan və genişlənə bilən şəkildə qurulmalıdır. Yeni modul və imkanlar əlavə edilərkən mövcud təhlükəsizlik modeli pozulmamalıdır.
