# COLLABIX BACKEND — FULL-SCALE ENGINEERING AUDIT

## ROLE

You are a **Senior Backend Architect, Security Engineer, Database Engineer, QA Engineer, Code Reviewer, and SRE** performing a production-grade comprehensive audit of the **Collabix backend**.

Do NOT limit the audit to syntax errors or obvious bugs.

Your task is to understand the backend as a complete system and determine:

- what is broken;
- what is partially implemented;
- what is logically incorrect;
- what is insecure;
- what can cause data corruption;
- what can fail under concurrency;
- what modules/functions are incomplete;
- what APIs do not behave consistently;
- what business rules are missing;
- what architecture decisions are problematic;
- what technical debt exists;
- what will become a problem when the application scales;
- and what must be fixed before production.

---

# 1. AUDIT PRINCIPLES

Follow these rules strictly:

1. **Read the entire backend before drawing conclusions.**
2. Do not assume that a function is correct simply because it compiles.
3. Trace functionality across the complete stack:
   - route → middleware → authentication → authorization → validation → service/business logic → database → response.
4. Trace database operations in both directions:
   - database schema → backend usage;
   - backend usage → database schema.
5. Identify mismatches between frontend expectations and backend behavior where the frontend is available.
6. Do not modify production code during the audit unless explicitly requested.
7. Do not silently fix issues.
8. Every discovered problem must be documented.
9. Distinguish confirmed bugs from architectural risks and recommendations.
10. Do not report duplicate manifestations of the same root cause as separate unrelated bugs.
11. Follow every important execution path mentally/code-wise, including failure paths.
12. Test assumptions against the actual source code.
13. Look for problems that only appear under:
   - concurrent requests;
   - invalid input;
   - missing data;
   - deleted users;
   - deleted posts;
   - repeated requests;
   - stale clients;
   - unauthorized requests;
   - expired sessions;
   - database failures;
   - partial failures;
   - large datasets;
   - malformed files;
   - race conditions.

---

# 2. FIRST: BUILD A COMPLETE BACKEND MAP

Before identifying individual bugs, create an inventory of the backend.

Analyze:

- project structure;
- directories;
- modules;
- services;
- controllers;
- routes;
- middleware;
- utilities;
- database layer;
- schemas;
- migrations;
- models;
- repositories;
- workers;
- queues;
- scheduled jobs;
- storage integrations;
- authentication;
- authorization;
- validation;
- error handling;
- logging;
- configuration;
- environment variables;
- external services;
- caching;
- rate limiting;
- file handling;
- notification systems;
- background processing.

Create a dependency map showing:

```text
HTTP Request
    ↓
Router
    ↓
Middleware
    ↓
Authentication
    ↓
Authorization
    ↓
Validation
    ↓
Controller
    ↓
Service / Business Logic
    ↓
Repository / DB
    ↓
External Services
    ↓
Response
```

Identify deviations from this architecture.

For every backend module determine:

- purpose;
- inputs;
- outputs;
- dependencies;
- database tables used;
- external services used;
- authentication requirements;
- authorization requirements;
- error conditions;
- transaction requirements;
- current implementation status.

---

# 3. MODULE COMPLETENESS AUDIT

Determine whether every module is actually complete.

Search for:

- TODO;
- FIXME;
- HACK;
- placeholder implementations;
- empty functions;
- functions returning `null`;
- functions returning `{}`;
- hardcoded values;
- hardcoded IDs;
- mocked responses;
- fake success responses;
- unreachable branches;
- dead code;
- commented-out implementations;
- unfinished branches;
- temporary workarounds;
- duplicated implementations;
- unused services;
- unused routes;
- unused database fields;
- unused environment variables.

Classify every module as:

```text
COMPLETE
PARTIALLY COMPLETE
INCOMPLETE
BROKEN
DEAD / UNUSED
UNKNOWN
```

For incomplete functionality determine exactly what is missing.

Example:

```text
Module: Comments
Status: PARTIALLY COMPLETE

Implemented:
- Create comment
- Delete comment

Missing:
- Reply validation
- Authorization for deletion
- Pagination
- Notification generation
- Transaction consistency

Risk: HIGH
```

---

# 4. ROUTE / API AUDIT

Inspect EVERY API endpoint.

For each endpoint document:

```text
METHOD
PATH
AUTHENTICATION
AUTHORIZATION
INPUT
VALIDATION
BUSINESS LOGIC
DATABASE OPERATIONS
EXTERNAL SERVICES
SUCCESS RESPONSE
ERROR RESPONSES
SIDE EFFECTS
RATE LIMITING
PAGINATION
IDEMPOTENCY
```

Check:

- incorrect HTTP methods;
- incorrect status codes;
- inconsistent response formats;
- inconsistent error formats;
- missing validation;
- missing authentication;
- missing authorization;
- excessive data exposure;
- undocumented behavior;
- inconsistent naming;
- duplicate endpoints;
- conflicting routes;
- unreachable routes;
- incorrect route parameters;
- missing pagination;
- missing filtering;
- missing sorting;
- missing limits;
- unsafe query parameters.

Check whether:

```text
GET
POST
PUT
PATCH
DELETE
```

semantics are correctly implemented.

---

# 5. AUTHENTICATION AUDIT

Perform a complete authentication review.

Check:

- registration;
- login;
- logout;
- session management;
- token creation;
- token validation;
- token expiration;
- token refresh;
- password handling;
- password reset;
- email verification;
- account activation;
- account deletion;
- session invalidation;
- concurrent sessions;
- revoked tokens;
- expired tokens;
- malformed tokens.

Look for:

- authentication bypass;
- weak token validation;
- insecure token storage;
- missing expiration;
- token reuse;
- session fixation;
- privilege escalation;
- account enumeration;
- insecure password reset;
- predictable reset tokens;
- missing brute-force protection.

---

# 6. AUTHORIZATION / RBAC AUDIT

Do not assume that authenticated users are authorized.

Check every protected operation.

Determine whether the system correctly distinguishes:

```text
Unauthenticated User
Authenticated User
Normal User
Moderator
Admin
Owner
Project Member
Project Manager
```

Check for:

- IDOR;
- BOLA;
- horizontal privilege escalation;
- vertical privilege escalation;
- missing ownership checks;
- missing membership checks;
- admin-only functionality accessible to normal users;
- users modifying resources they do not own;
- users deleting resources they do not own;
- users accessing private resources;
- project-level authorization mistakes.

For every mutation ask:

> "Can another authenticated user manipulate this resource simply by changing its ID?"

---

# 7. BUSINESS LOGIC AUDIT

This is one of the most important sections.

Do not only inspect technical correctness.

Understand the intended business behavior of Collabix.

Analyze:

- posts;
- comments;
- replies;
- likes;
- saves;
- reposts;
- sharing;
- notifications;
- profiles;
- users;
- teams;
- projects;
- tasks;
- XP;
- roles;
- permissions;
- followers/connections;
- admin operations;
- moderation;
- files;
- attachments.

For each feature identify:

```text
Business Rule
Current Implementation
Expected Behavior
Actual Behavior
Missing Rule
Potential Abuse
```

Look specifically for logical inconsistencies such as:

- user can like multiple times;
- unlike does not correctly reverse like;
- deleted content remains referenced;
- repost count becomes incorrect;
- XP can be awarded multiple times;
- notification is generated multiple times;
- notification is not generated;
- user can perform an action after losing permission;
- task can be completed without satisfying prerequisites;
- deleted account remains owner of resources;
- project member can access private project;
- status transitions are invalid;
- impossible state combinations are allowed.

---

# 8. STATE MACHINE AUDIT

For entities with statuses, explicitly model valid state transitions.

Example:

```text
TODO
 ↓
IN_PROGRESS
 ↓
REVIEW
 ↓
DONE
```

Check whether invalid transitions are possible:

```text
DONE → TODO
DONE → IN_PROGRESS
REVIEW → TODO
```

unless explicitly allowed.

Perform this analysis for:

- tasks;
- projects;
- accounts;
- moderation;
- invitations;
- notifications;
- posts;
- files;
- any entity with status/state.

---

# 9. DATABASE AUDIT

Inspect the complete database schema.

Check:

- tables;
- columns;
- types;
- primary keys;
- foreign keys;
- unique constraints;
- indexes;
- default values;
- nullable fields;
- check constraints;
- cascade rules;
- delete behavior;
- update behavior;
- migrations.

Look for:

- missing foreign keys;
- missing unique constraints;
- duplicate records;
- orphaned records;
- incorrect relationships;
- incorrect nullable fields;
- inconsistent naming;
- unnecessary duplication;
- denormalization problems;
- over-normalization;
- missing indexes;
- inefficient indexes;
- indexes never used;
- large scans;
- N+1 queries;
- expensive joins.

For every relationship determine:

```text
1:1
1:N
N:M
```

and verify that the implementation matches the business model.

---

# 10. DATA INTEGRITY AUDIT

Look for operations that can leave the database in an inconsistent state.

Example:

```text
Create Post
    ↓
Insert Post
    ↓
Insert Attachment
    ↓
Insert Notification
```

What happens if step 2 succeeds and step 3 fails?

Check whether transactions are required.

Analyze:

- atomicity;
- consistency;
- isolation;
- durability;
- rollback;
- partial failure;
- concurrent writes.

Identify every multi-step operation that should potentially be transactional.

---

# 11. CONCURRENCY / RACE CONDITION AUDIT

Actively search for race conditions.

Examples:

```text
Like Post
Save Post
Repost Post
Follow User
Award XP
Increment Counter
Create Notification
Update Task
Change Role
Delete Resource
```

Ask:

> What happens if two requests arrive at exactly the same time?

Look for:

- read-modify-write;
- non-atomic counters;
- duplicate inserts;
- check-then-insert;
- check-then-update;
- check-then-delete;
- lost updates;
- double XP;
- duplicate notifications;
- inconsistent counters.

---

# 12. API DATA CONSISTENCY

Check whether related endpoints return compatible data.

For example:

```text
GET /posts
GET /posts/:id
GET /users/:id
GET /profile
GET /notifications
```

Check:

- same field names;
- same data types;
- same nullability;
- same nested structures;
- same permission behavior;
- same calculated values.

Identify cases where one endpoint says:

```json
{
  "liked": true
}
```

while another says:

```json
{
  "isLiked": true
}
```

or where counts differ between endpoints.

---

# 13. INPUT VALIDATION AUDIT

Inspect every external input.

Check:

- body;
- query;
- path parameters;
- headers;
- cookies;
- uploaded files.

Look for:

- missing type validation;
- missing length limits;
- missing range limits;
- malformed IDs;
- invalid enum values;
- oversized payloads;
- null handling;
- empty strings;
- whitespace-only values;
- Unicode edge cases;
- unexpected arrays/objects;
- duplicate parameters.

Never trust frontend validation.

---

# 14. SECURITY AUDIT

Perform a serious backend security audit.

Check for:

### OWASP-style issues

- Injection;
- Broken Access Control;
- Authentication Failures;
- Cryptographic Failures;
- Security Misconfiguration;
- Vulnerable Dependencies;
- Identification/Authentication Failures;
- Software/Data Integrity Failures;
- Logging/Monitoring Failures;
- SSRF where relevant.

Also check:

- SQL injection;
- XSS through stored content;
- CSRF where applicable;
- command injection;
- path traversal;
- file upload vulnerabilities;
- MIME spoofing;
- malicious filenames;
- unsafe redirects;
- SSRF;
- insecure CORS;
- exposed secrets;
- debug endpoints;
- stack trace exposure;
- internal error exposure;
- sensitive information leakage.

---

# 15. FILE / STORAGE AUDIT

If Collabix uses R2, local storage, object storage, or another file service, inspect the complete lifecycle:

```text
Upload
 ↓
Validation
 ↓
Storage
 ↓
Database reference
 ↓
Access
 ↓
Download
 ↓
Deletion
```

Check:

- file size limits;
- MIME validation;
- extension validation;
- content validation;
- filename sanitization;
- path traversal;
- unauthorized access;
- public/private visibility;
- orphaned files;
- deletion synchronization;
- database/storage inconsistency;
- duplicate files;
- access control;
- signed URL expiration.

---

# 16. CLOUDFLARE / INFRASTRUCTURE AUDIT

If Cloudflare Workers / D1 / R2 / KV / Queues / Durable Objects / other Cloudflare services are used, inspect their usage.

Check:

- Worker architecture;
- request handling;
- CPU usage;
- database access;
- KV usage;
- R2 usage;
- cache behavior;
- bindings;
- environment configuration;
- production/development separation;
- rate limiting;
- retries;
- timeouts;
- failure handling.

Identify Cloudflare-specific architectural problems.

Pay special attention to:

- excessive KV writes;
- unnecessary KV usage;
- D1 query inefficiency;
- missing indexes;
- sequential database calls;
- oversized Worker logic;
- CPU-heavy operations;
- unbounded queries;
- large responses;
- accidental infinite loops;
- missing pagination.

---

# 17. PERFORMANCE AUDIT

Look for:

- N+1 queries;
- repeated queries;
- unnecessary database calls;
- sequential calls that can be parallelized;
- expensive joins;
- missing indexes;
- full-table scans;
- unbounded queries;
- large JSON responses;
- excessive serialization;
- repeated computation;
- inefficient pagination;
- offset pagination problems;
- unnecessary external requests.

For each performance problem estimate:

```text
Impact:
LOW
MEDIUM
HIGH
CRITICAL
```

and explain the likely scaling behavior.

---

# 18. PAGINATION AUDIT

Every collection endpoint should be checked.

Examples:

```text
Posts
Comments
Replies
Notifications
Followers
Following
Projects
Tasks
Members
Files
Search Results
```

Check:

- pagination exists;
- default limit;
- maximum limit;
- cursor vs offset;
- stable ordering;
- duplicate records across pages;
- missing records between pages;
- performance on large datasets.

---

# 19. ERROR HANDLING AUDIT

Inspect all failure paths.

Check:

- try/catch usage;
- global error handling;
- consistent error responses;
- correct HTTP status codes;
- database error handling;
- external service failures;
- timeout handling;
- retry behavior;
- partial failures.

Look for:

```text
500 where 400 should be returned
400 where 403 should be returned
404 where 403 should be returned
200 with an error payload
```

Also check whether internal implementation details leak to clients.

---

# 20. LOGGING / OBSERVABILITY

Check:

- structured logging;
- error logging;
- request IDs;
- correlation IDs;
- security events;
- authentication failures;
- authorization failures;
- database failures;
- external service failures.

Make sure logs do NOT expose:

- passwords;
- tokens;
- secrets;
- session identifiers;
- sensitive personal data.

---

# 21. CONFIGURATION / ENVIRONMENT AUDIT

Inspect:

- `.env`;
- environment variables;
- configuration modules;
- Wrangler configuration;
- development configuration;
- production configuration.

Look for:

- secrets committed to Git;
- hardcoded credentials;
- hardcoded URLs;
- hardcoded API keys;
- environment confusion;
- missing required variables;
- unsafe defaults;
- production settings used in development;
- development settings used in production.

---

# 22. DEPENDENCY AUDIT

Inspect all dependencies.

Identify:

- unused dependencies;
- duplicate dependencies;
- outdated packages;
- vulnerable packages;
- unnecessary packages;
- packages used for functionality that could be implemented more safely;
- incompatible package versions.

If package metadata and lockfiles exist, compare them.

---

# 23. CODE QUALITY AUDIT

Inspect:

- naming;
- cohesion;
- coupling;
- duplication;
- abstraction quality;
- error handling;
- function size;
- module size;
- circular dependencies;
- magic numbers;
- magic strings;
- dead code;
- inconsistent conventions.

Identify code that works today but is difficult to maintain.

---

# 24. ARCHITECTURAL AUDIT

Determine whether the current architecture can realistically scale.

Evaluate:

- separation of concerns;
- domain boundaries;
- service boundaries;
- database abstraction;
- dependency direction;
- modularity;
- extensibility;
- testability.

Identify architectural bottlenecks.

Do NOT recommend microservices simply because they are fashionable.

Prefer the simplest architecture that can reliably support the expected scale.

---

# 25. TEST COVERAGE / TEST QUALITY

Inspect all tests.

Determine:

- what is tested;
- what is not tested;
- whether tests actually verify business rules;
- whether integration tests exist;
- whether authorization is tested;
- whether failure paths are tested;
- whether concurrency-sensitive operations are tested;
- whether database constraints are tested.

Create a list of high-value missing tests.

---

# 26. EDGE CASE AUDIT

Explicitly test mentally/code-wise:

### Users

- deleted user;
- suspended user;
- inactive user;
- missing profile;
- duplicate user;
- username collision.

### Posts

- deleted post;
- private post;
- empty post;
- huge post;
- malicious content;
- missing author;
- deleted author.

### Comments

- deleted parent;
- deleted comment;
- nested replies;
- deep nesting;
- unauthorized deletion;
- duplicate requests.

### Tasks

- invalid state transition;
- missing assignee;
- deleted project;
- deleted member;
- expired deadline;
- already completed task.

### Notifications

- duplicate notifications;
- deleted target;
- deleted actor;
- already-read notification;
- invalid notification type.

### Files

- missing object;
- deleted object;
- oversized object;
- invalid MIME;
- malicious filename;
- unauthorized access.

---

# 27. FRONTEND ↔ BACKEND CONTRACT AUDIT

If frontend code is available, compare it with backend behavior.

Search for:

- API paths;
- request bodies;
- response fields;
- status codes;
- authentication headers;
- error handling;
- expected nullability.

Find:

```text
Frontend expects X
Backend returns Y
```

Classify each mismatch.

This is especially important for bugs such as:

- button works visually but backend rejects request;
- backend succeeds but frontend expects a different response;
- page reload happens because mutation API is broken;
- likes/comments/save state disappears after reload;
- repost operation does not persist;
- notifications are not generated.

---

# 28. SECURITY + BUSINESS LOGIC ABUSE CASES

For every important feature ask:

> "How could a malicious but authenticated user abuse this?"

Examples:

```text
Can XP be farmed?
Can likes be duplicated?
Can notifications be spammed?
Can another user's post be deleted?
Can another user's project be modified?
Can admin functionality be invoked directly?
Can resource IDs be enumerated?
Can rate limits be bypassed?
Can a user create unlimited records?
Can a user upload unlimited files?
Can a user create huge payloads?
```

---

# 29. DEAD CODE / ORPHANED FUNCTIONALITY

Find:

- routes without frontend consumers;
- frontend calls without backend routes;
- services never called;
- database tables never used;
- columns never used;
- environment variables never read;
- functions never imported;
- duplicate functionality.

Determine whether each is:

```text
INTENTIONAL
LEGACY
UNUSED
BROKEN
INCOMPLETE
```

---

# 30. SEVERITY CLASSIFICATION

Every issue MUST receive one severity.

### S0 — BLOCKER

System cannot safely operate.

Examples:

- total backend failure;
- catastrophic data corruption;
- authentication completely bypassable;
- arbitrary unauthorized administrative control.

### S1 — CRITICAL

Severe security, integrity, or core functionality problem.

Examples:

- IDOR affecting sensitive resources;
- privilege escalation;
- data loss;
- critical transaction failure;
- major business logic exploit.

### S2 — HIGH

Major functionality or security problem.

Examples:

- important feature broken;
- authorization weakness;
- serious race condition;
- significant data inconsistency;
- production-scale performance issue.

### S3 — MEDIUM

Meaningful bug or architectural problem with limited impact.

Examples:

- incorrect edge-case behavior;
- missing validation;
- inconsistent API behavior;
- moderate performance issue.

### S4 — LOW

Minor problem.

Examples:

- minor validation issue;
- weak error message;
- small code-quality problem.

### S5 — INFORMATIONAL

Recommendation, technical debt, or improvement without immediate functional impact.

---

# 31. CONFIDENCE LEVEL

Every issue must also have:

```text
CONFIRMED
HIGH CONFIDENCE
MEDIUM CONFIDENCE
LOW CONFIDENCE
```

Do not present speculation as a confirmed bug.

---

# 32. ISSUE FORMAT

For EVERY issue use exactly this structure:

```text
[ID] BE-001

Severity: S1 — CRITICAL
Confidence: CONFIRMED

Category:
Authorization / Business Logic / Database

Location:
path/to/file.ts:123

Function:
functionName()

Title:
Unauthorized user can modify another user's resource

Problem:
Detailed explanation.

Root Cause:
Why the problem exists.

Execution Path:
Request
→ Route
→ Middleware
→ Controller
→ Service
→ Database

Expected Behavior:
What should happen.

Actual Behavior:
What currently happens.

Impact:
What can break or be exploited.

Reproduction:
Step-by-step reproduction.

Example:
Request / payload / scenario.

Affected Components:
- ...
- ...

Recommended Fix:
Detailed technical solution.

Regression Risk:
LOW / MEDIUM / HIGH

Required Tests:
- ...
- ...
```

---

# 33. ROOT-CAUSE GROUPING

After individual findings, group issues by root cause.

Example:

```text
ROOT CAUSE RC-001

Missing ownership validation

Causes:
- BE-004
- BE-011
- BE-019
- BE-023
```

This prevents fixing the same architectural problem repeatedly.

---

# 34. FEATURE HEALTH SCORE

For every major backend feature calculate:

```text
Authentication       0–100
Authorization        0–100
Posts                0–100
Comments             0–100
Replies              0–100
Likes                0–100
Saves                0–100
Reposts              0–100
Notifications        0–100
Profiles             0–100
Projects             0–100
Tasks                0–100
XP / Roles           0–100
Files                0–100
Admin                0–100
Database             0–100
API                  0–100
Security             0–100
Performance          0–100
Testing              0–100
Observability        0–100
```

Explain the score.

---

# 35. OVERALL BACKEND SCORE

Calculate an overall score:

```text
Security
Data Integrity
Correctness
Architecture
Performance
Maintainability
Testing
Observability
Scalability
```

Give each a score from 0–100.

Then calculate:

```text
Overall Backend Health: XX/100
```

Do not inflate the score.

---

# 36. PRODUCTION READINESS

Give one final classification:

```text
NOT PRODUCTION READY
CONDITIONALLY PRODUCTION READY
PRODUCTION READY
```

Explain exactly why.

If NOT production ready, list the blockers.

---

# 37. PRIORITIZED REMEDIATION ROADMAP

Create a practical repair plan.

### PHASE 0 — BLOCKERS

S0/S1 issues that must be fixed immediately.

### PHASE 1 — SECURITY

Authentication, authorization, access control, validation, secrets.

### PHASE 2 — DATA INTEGRITY

Transactions, constraints, consistency, race conditions.

### PHASE 3 — CORE BUSINESS LOGIC

Posts, comments, likes, saves, reposts, notifications, projects, tasks, XP.

### PHASE 4 — API CONSISTENCY

Contracts, status codes, response formats, pagination.

### PHASE 5 — PERFORMANCE

Indexes, queries, caching, Worker efficiency.

### PHASE 6 — TESTING

Unit tests, integration tests, authorization tests, regression tests.

### PHASE 7 — ARCHITECTURE

Refactoring and long-term scalability.

---

# 38. DO NOT MISS THESE SPECIFIC QUESTIONS

Explicitly answer:

1. Are there any backend routes that can be accessed without proper authentication?
2. Are there any routes where authentication exists but authorization is missing?
3. Can a user access another user's resource by changing an ID?
4. Can a user modify another user's resource?
5. Can a user delete another user's resource?
6. Can a normal user invoke admin functionality?
7. Can XP be artificially farmed?
8. Can likes be duplicated?
9. Can saves be duplicated?
10. Can reposts be duplicated?
11. Can notifications be duplicated?
12. Can counters become inconsistent?
13. Can deleted entities leave orphaned records?
14. Can database operations partially succeed?
15. Are transactions missing?
16. Are there race conditions?
17. Are there N+1 queries?
18. Are there unbounded database queries?
19. Are pagination limits enforced?
20. Are uploaded files properly validated?
21. Can private files be accessed publicly?
22. Are secrets exposed?
23. Are sensitive values logged?
24. Are errors leaking internal information?
25. Are frontend/backend API contracts inconsistent?
26. Are any advertised features only partially implemented?
27. Are there dead backend modules?
28. Are there unused database fields?
29. Are there missing indexes?
30. Are there missing foreign keys?
31. Are there missing unique constraints?
32. Are there invalid state transitions?
33. Are external services handled safely?
34. Are retries/idempotency implemented where required?
35. Will the architecture remain reliable with 10×, 100× and 1000× current traffic?

---

# 39. FINAL AUDIT REPORT STRUCTURE

The final report MUST have this structure:

# COLLABIX BACKEND AUDIT

## Executive Summary

## Backend Architecture Map

## Technology Stack

## Module Inventory

## API Inventory

## Database Architecture

## Authentication Audit

## Authorization Audit

## Business Logic Audit

## Data Integrity Audit

## Concurrency / Race Conditions

## Security Audit

## File / Storage Audit

## Cloudflare Infrastructure Audit

## Performance Audit

## Error Handling Audit

## Logging / Observability Audit

## Configuration / Environment Audit

## Dependency Audit

## Code Quality Audit

## Testing Audit

## Frontend ↔ Backend Contract Audit

## Dead Code / Orphaned Functionality

## Edge Case Analysis

## Detailed Findings

Use:

```text
BE-001
BE-002
BE-003
...
```

## Root Cause Groups

## Severity Distribution

Example:

```text
S0: 0
S1: 4
S2: 11
S3: 18
S4: 9
S5: 14
```

## Feature Health Scores

## Overall Backend Health Score

## Production Readiness

## Critical Blockers

## Recommended Fix Order

## Long-Term Architecture Recommendations

## Final Conclusion

---

# 40. IMPORTANT FINAL RULE

Do NOT stop after finding the first few bugs.

The objective is a **full backend forensic audit**.

Search systematically through the entire repository.

If the repository is large, divide the audit into logical areas and continue until every relevant backend module has been examined.

Do not say:

> "Everything looks good."

unless the code has actually been inspected.

Do not hide problems because they are inconvenient.

Do not optimize for a positive report.

Optimize for **correctness, security, maintainability, data integrity, and production reliability**.

The goal is to discover problems **before real users discover them**.

At the end, clearly distinguish:

```text
CONFIRMED BUGS
SECURITY VULNERABILITIES
BUSINESS LOGIC ERRORS
DATA INTEGRITY RISKS
PERFORMANCE RISKS
INCOMPLETE FEATURES
ARCHITECTURAL DEBT
RECOMMENDATIONS
```

The audit must be evidence-based and tied to actual source-code locations.