# TASK-11 — Team Workspace & Collaboration Platform (PDR)

**Task ID:** TASK-11  
**Priority:** 🔴 Critical  
**Category:** Collaboration / Team Workspace / Project Management  
**Status:** Əsasən İcra Olunub (82%)  
**Depends On:** TASK-01 ~ TASK-10

---

# Məqsəd

Collabix platformasını sadəcə sosial şəbəkədən çıxarıb **tam proqramçı əməkdaşlıq platformasına** çevirmək.

TASK-11 tamamlandıqdan sonra istifadəçilər:

- Komanda yarada biləcək
- Komandaya qoşula biləcək
- Layihələr idarə edə biləcək
- Task bölüşdürə biləcək
- Komanda daxili paylaşım edə biləcək
- Komanda Chat istifadə edə biləcək
- GitHub Repository bağlaya biləcək (TASK-12)
- XP və Reputation komanda səviyyəsində hesablanacaq

Bu modul gələcəkdə Marketplace, GitHub Integration, Learning Workspace və Enterprise Organization modullarının əsasını təşkil edəcək.

---

# Məqsəd Arxitekturası

```
Organization
        │
        ▼
      Team
        │
 ┌──────┼───────────────┐
 ▼      ▼               ▼
Members Projects      Chat
 │        │             │
 ▼        ▼             ▼
Roles   Tasks      Team Feed
 │
 ▼
Permissions
```

---

# Mövcud Problemlər

Hazırda Collabix-də

✔ İstifadəçi var

✔ Post var

✔ Chat var

✔ Task var

Amma

❌ Team yoxdur

❌ Collaboration yoxdur

❌ Workspace yoxdur

❌ Shared Project yoxdur

❌ Shared Files yoxdur

❌ Team Roles yoxdur

❌ Team XP yoxdur

---

# Məqsəd

Collabix istifadəçiləri artıq

sadəcə paylaşım etməyəcək.

Onlar

birlikdə layihə hazırlayacaqlar.

---

# Yeni Database Cədvəlləri

## teams

```
id

slug

name

description

avatar

banner

visibility

owner_id

created_at

updated_at
```

---

## team_members

```
id

team_id

user_id

role

status

joined_at
```

---

## team_roles

```
id

team_id

name

permissions

priority
```

---

## team_invites

```
id

team_id

email

user_id

invited_by

status

expires_at
```

---

## team_projects

```
id

team_id

name

description

status

visibility

created_by
```

---

## team_tasks

```
id

project_id

assignee_id

title

description

priority

status

deadline

estimated_hours
```

---

## team_posts

```
id

team_id

author_id

content

visibility
```

---

## team_chat_rooms

```
id

team_id

name

type
```

---

## team_files

```
id

team_id

uploaded_by

path

type

size
```

---

## team_activity

```
id

team_id

actor_id

event_type

metadata

created_at
```

---

# Team Visibility

```
Public

Private

Invite Only
```

---

# Team Roles

Standart Rollar

```
Owner

Admin

Manager

Developer

Designer

QA

DevOps

Mentor

Moderator

Viewer
```

---

# Permission System

Hər rol üçün granular permission sistemi.

Misal

```
Create Project

Delete Project

Manage Members

Invite Users

Kick Users

Manage Tasks

Manage Files

Manage Roles

Manage Team

Manage Chat

Manage Feed

Manage Settings
```

---

# Team Dashboard

Yeni Dashboard

```
Overview

Activity

Projects

Tasks

Members

Chat

Files

Statistics

Settings
```

---

# Team Feed

Komandaya aid

- Announcement
- Post
- Update
- Release Note
- Progress Report

yalnız komanda üzvlərinə görünəcək.

---

# Team Chat

Durable Objects üzərində

Realtime Chat

Dəstəklənəcək

```
General

Development

Design

QA

Random
```

---

# Team Activity Feed

Bütün əməliyyatlar loglanacaq.

Misal

```
Task Created

Task Completed

User Joined

Project Created

Role Changed

Repository Connected

File Uploaded

Release Published
```

---

# Team Statistics

Dashboard

```
Members

Projects

Tasks

Completed Tasks

XP

Activity

Commits

Reputation

Growth
```

---

# Team XP

XP artıq

yalnız istifadəçi üçün deyil.

Komanda üçün də hesablanacaq.

Misal

```
Task Completed

+20 XP

Bug Fixed

+30 XP

Project Finished

+100 XP

Hackathon Winner

+500 XP
```

---

# Team Reputation

Komanda Reputation

```
Bronze

Silver

Gold

Diamond

Legend
```

---

# Team Files

R2 istifadə olunacaq.

Folder strukturu

```
/team_id/

documents/

design/

assets/

source/

exports/
```

---

# Team Notifications

Realtime

```
New Member

Task Assigned

Mention

Announcement

Project Update

Role Changed

Invitation

Repository Connected
```

---

# Search

Axtarış

```
Teams

Members

Projects

Tasks

Files
```

---

# API

```
POST   /api/teams

GET    /api/teams

GET    /api/teams/:id

PATCH  /api/teams/:id

DELETE /api/teams/:id
```

---

```
POST /api/teams/:id/invite

POST /api/teams/:id/join

POST /api/teams/:id/leave
```

---

```
GET /api/teams/:id/members

PATCH /api/teams/:id/members/:id

DELETE /api/teams/:id/members/:id
```

---

```
GET /api/teams/:id/projects

POST /api/teams/:id/projects
```

---

```
GET /api/teams/:id/tasks

POST /api/teams/:id/tasks
```

---

```
GET /api/teams/:id/feed

POST /api/teams/:id/feed
```

---

```
GET /api/teams/:id/activity
```

---

# Queue

Queue istifadə olunacaq

```
Invite Email

Notifications

XP Update

Activity Log

Analytics

Search Index

Statistics
```

---

# Workflow

Workflow

```
Team Created

↓

Welcome

↓

Setup

↓

Invite Members

↓

First Project

↓

First Task
```

---

# Event Bus

Yeni Eventlər

```
TeamCreated

TeamUpdated

TeamDeleted

MemberJoined

MemberLeft

RoleChanged

ProjectCreated

TaskAssigned

TaskCompleted

TeamPostCreated

FileUploaded

InvitationSent
```

---

# Service Layer

Yeni servislər

```
services/team/

team.service.ts

member.service.ts

role.service.ts

invite.service.ts

project.service.ts

task.service.ts

feed.service.ts

activity.service.ts

statistics.service.ts
```

---

# Cloudflare İnteqrasiyası

## D1

- Teams
- Members
- Projects
- Tasks

---

## R2

- Team Files
- Team Assets
- Documents

---

## Durable Objects

- Team Chat
- Presence

---

## Queues

- Notifications
- XP
- Search
- Analytics

---

## Workflows

- Team Onboarding
- Reminder
- Weekly Digest

---

## Vectorize

Team Search

Project Search

Documentation Search

---

## Workers AI

```
Task Summary

Meeting Summary

Auto Tags

Project Summary

Documentation Summary
```

---

# Təhlükəsizlik

- Team Permission Middleware
- Role Based Access Control (RBAC)
- Audit Log
- Rate Limit
- Invite Expiration
- Ownership Transfer
- Soft Delete

---

# Acceptance Criteria

- Team yaratmaq mümkündür.
- Komandaya dəvət göndərmək mümkündür.
- İstifadəçi komandaya qoşula bilir.
- Team Dashboard işləyir.
- Team Feed işləyir.
- Team Chat realtime işləyir.
- Team Projects işləyir.
- Team Tasks işləyir.
- Team Files R2 üzərində işləyir.
- Team Activity loglanır.
- Team XP hesablanır.
- Permission sistemi tam işləyir.
- Queue və Workflow inteqrasiyası tamamlanır.
- Bütün əməliyyatlar Event Bus vasitəsilə işləyir.

---

# Gələcək TASK-lar

Bu modul aşağıdakı tapşırıqlar üçün baza olacaq:

- **TASK-12** — GitHub / GitLab Integration
- **TASK-13** — Project Management (Sprint, Kanban, Milestone)
- **TASK-14** — AI Team Assistant
- **TASK-15** — Enterprise Organizations
- **TASK-16** — Marketplace & Team Recruitment

---

# Gözlənilən Nəticə

TASK-11 tamamlandıqdan sonra Collabix artıq yalnız proqramçılar üçün sosial platforma deyil, **GitHub, Jira, Discord və Slack arasında yerləşən müasir əməkdaşlıq (collaboration) platformasına** çevriləcək. Komandalar vahid iş məkanı (Workspace) daxilində layihələrini, tapşırıqlarını, fayllarını, daxili ünsiyyətlərini və fəaliyyət tarixçələrini idarə edə biləcəklər. Bu modul platformanın gələcək Enterprise və Professional ekosisteminin əsas təməlini təşkil edəcək.
