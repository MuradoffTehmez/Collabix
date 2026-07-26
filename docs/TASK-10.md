# TASK-10 — Cloudflare Native Service Architecture Refactor (PDR)

**Task ID:** TASK-10  
**Priority:** 🔴 Critical  
**Category:** Architecture / Cloudflare Native / Backend  
**Status:** Planned  
**Depends On:** TASK-01 ~ TASK-09

---

# Məqsəd

Cloudflare ekosisteminin (Workers, D1, R2, KV, Durable Objects, Queues, Turnstile, Workflows, Workers AI, AI Gateway, Browser Rendering, Vectorize) tam şəkildə **Cloudflare Native Architecture** prinsiplərinə uyğun yenidən qurulması.

Bu tapşırığın məqsədi sadəcə yeni servis əlavə etmək deyil.

Əsas məqsəd:

- Event-Driven Architecture
- Service-Oriented Design
- Future-Proof AI Architecture
- Scalability
- Loose Coupling
- Maintainability

qurmaqdır.

---

# Mövcud Problemlər

Hazırkı implementasiya işlək olsa da uzun müddətli inkişaf üçün uyğun deyil.

## 1. Workflow API əsaslıdır

Hazırda

```
POST /api/workflows/start
```

mövcuddur.

Bu düzgün yanaşma deyil.

Workflow istifadəçi tərəfindən deyil,
sistem hadisələri tərəfindən başlamalıdır.

Misal

```
User Register

↓

Queue

↓

Workflow
```

---

## 2. AI yalnız Chat endpoint üzərində qurulub

Hazırda

```
/api/ai/chat
```

mövcuddur.

Bu gələcək inkişafı çətinləşdirəcək.

Çünki gələcəkdə

- AI Mentor
- AI Review
- AI Summary
- AI Translation
- AI Quiz
- AI Documentation
- AI Moderation
- AI Embedding
- AI Search

əlavə olunacaq.

---

## 3. AI Gateway yanlış istifadə olunur

AI Gateway

AI modeli deyil.

Onun işi

- Logging
- Analytics
- Retry
- Cache
- Rate Limit
- Provider Switching

etməkdir.

Kod AI Gateway-dən asılı olmamalıdır.

---

## 4. Vectorize yalnız Semantic Search kimi istifadə olunur

Bu düzgün deyil.

Vectorize

yalnız Search deyil.

Həmçinin

- RAG
- Similarity
- Recommendation
- Duplicate Detection
- AI Context

üçün istifadə olunmalıdır.

---

## 5. Browser Rendering sinxron işləyir

Hazırda

```
POST /api/render/pdf
```

birbaşa PDF yaradır.

Bu istifadəçini gözlədir.

Ağır render əməliyyatları Queue vasitəsilə arxa plana keçirilməlidir.

---

## 6. Service Layer yoxdur

Workers AI

Browser

Vectorize

birbaşa endpoint-lərdən çağırılır.

Bu gələcəkdə başqa provider əlavə etməyi çətinləşdirəcək.

---

## 7. AI Provider dəyişmək mümkün deyil

Kod birbaşa

Workers AI

istifadə edir.

Gələcəkdə

OpenAI

Claude

Gemini

DeepSeek

OpenRouter

əlavə etmək çətin olacaq.

---

# Məqsəd Arxitekturası

```
Client

↓

REST API

↓

Service Layer

↓

Queue

↓

Workflow

↓

Workers AI

↓

AI Gateway

↓

Vectorize

↓

Browser Rendering

↓

R2 / D1 / KV
```

---

# Tətbiq Ediləcək Dəyişikliklər

---

# 1. Workflow Refactor

## REMOVE

```
POST /api/workflows/start
```

---

## CREATE

```
worker/workflows/

welcome.ts

daily_digest.ts

contest.ts

certificate.ts

cleanup.ts

inactive_user.ts

leaderboard.ts

report_generation.ts
```

---

Workflow yalnız

System Events

vasitəsilə başladılacaq.

Misal

```
User Registered

↓

Queue

↓

Welcome Workflow
```

---

```
Contest Started

↓

Workflow

↓

7 gün gözlə

↓

Winner seç

↓

XP ver

↓

Badge ver
```

---

# 2. Service Layer

Yeni struktur

```
worker/services/

ai/

browser/

vector/

workflow/

queue/

notification/

search/
```

Hər servis müstəqil olacaq.

---

# 3. AI Refactor

Yeni struktur

```
worker/services/ai/

chat.ts

mentor.ts

review.ts

summary.ts

translation.ts

quiz.ts

embedding.ts

moderation.ts
```

---

Endpointlər

```
/api/ai/chat

/api/ai/mentor

/api/ai/review

/api/ai/summarize

/api/ai/moderate

/api/ai/embed

/api/ai/translate
```

---

# 4. AI Provider Layer

Yeni

```
AIProvider
```

abstraksiyası yaradılacaq.

```
AIService

↓

AIProvider

↓

Workers AI

↓

OpenAI

↓

Gemini

↓

Claude

↓

DeepSeek
```

Provider dəyişməsi yalnız konfiqurasiya ilə mümkün olacaq.

---

# 5. AI Gateway

AI Gateway yalnız

Gateway

kimi istifadə olunacaq.

Onun üzərindən

- Logging
- Analytics
- Retry
- Cache
- Rate Limit
- Failover

idarə ediləcək.

Business Logic AI Gateway-dən asılı olmayacaq.

---

# 6. Browser Rendering Refactor

Yeni struktur

```
worker/services/browser/

pdf.ts

screenshot.ts

certificate.ts

portfolio.ts

resume.ts
```

---

Render prosesi

```
Export Request

↓

Queue

↓

Browser Rendering

↓

R2

↓

Notification

↓

Download URL
```

İstifadəçi render tamamlanmasını gözləməyəcək.

---

# 7. Vector Pipeline

Yeni

```
worker/services/vector/

post.ts

comment.ts

task.ts

wiki.ts

course.ts

documentation.ts
```

---

Flow

```
Post

↓

Queue

↓

Embedding

↓

Vectorize

↓

Metadata

↓

Index Update
```

---

Semantik axtarış

```
Question

↓

Embedding

↓

Similarity Search

↓

Top Results
```

---

# 8. Search Service

Yeni

```
worker/services/search/

semantic.ts

keyword.ts

hybrid.ts
```

---

Hybrid Search

```
Keyword Search

+

Semantic Search

↓

Merged Ranking
```

---

# 9. Queue Refactor

Queue aşağıdakı əməliyyatları idarə edəcək

- Email
- Notification
- XP
- Badge
- Analytics
- Search Index
- AI Summary
- Embedding
- Browser Render
- Audit Log

---

# 10. Browser Jobs

Yeni Job Types

```
Generate PDF

Generate Certificate

Generate Resume

Generate Portfolio

Generate Screenshot

Generate OpenGraph Image
```

---

# 11. AI Jobs

Yeni AI Pipeline

```
New Post

↓

Moderation

↓

Summary

↓

Tag Extraction

↓

Embedding

↓

Vectorize

↓

Recommendation
```

---

# 12. Event Bus

Yeni daxili Event sistemi

```
UserRegistered

UserVerified

PostCreated

CommentCreated

TaskCompleted

ContestStarted

ContestFinished

AchievementUnlocked

CertificateGenerated

PortfolioExported
```

Bütün Workflow-lar bu Event-lərlə işləyəcək.

---

# Yeni Qovluq Strukturu

```
worker/

services/
    ai/
    browser/
    vector/
    workflow/
    search/
    notification/
    queue/

providers/
    ai/

workflows/
    welcome.ts
    reminder.ts
    digest.ts
    contest.ts
    cleanup.ts

events/
    index.ts

jobs/
    render.ts
    ai.ts
```

---

# Qəbul Meyarları (Acceptance Criteria)

- Workflow-lar birbaşa API ilə başlamır.
- Workflow-lar yalnız Event-lərlə tetiklenir.
- AI Service provider-dən asılı deyil.
- AI Gateway yalnız Gateway rolunu daşıyır.
- Browser Rendering Queue vasitəsilə işləyir.
- Render nəticələri R2-də saxlanılır.
- Vectorize yalnız Search deyil, tam Index Pipeline kimi işləyir.
- AI Embedding Queue vasitəsilə yaradılır.
- Service Layer bütün Cloudflare servislərini abstraksiya edir.
- Yeni provider əlavə etmək mövcud biznes məntiqini dəyişdirmir.
- Bütün ağır əməliyyatlar asinxron işləyir.
- Sistem Event-Driven Architecture prinsiplərinə tam uyğun olur.

---

# Gözlənilən Nəticə

TASK-10 tamamlandıqdan sonra Collabix aşağıdakı xüsusiyyətlərə sahib olacaq:

- Tam Cloudflare Native arxitekturası
- Event-Driven Backend
- Service-Oriented Design
- AI Provider Agnostic quruluş
- Queue əsaslı ağır əməliyyatlar
- Workflow əsaslı uzunmüddətli proseslər
- AI ilə inteqrasiya olunmuş semantik indeksləmə
- Miqyaslana bilən Browser Rendering infrastrukturu
- Gələcək AI, Marketplace, Learning və Enterprise modullarına hazır platforma
- Minimal coupling və yüksək maintainability
