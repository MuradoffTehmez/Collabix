# COLLABIX — FULL FRONTEND PERFORMANCE, SECURITY & PRODUCTION HARDENING AUDIT

Sən senior səviyyəli **Frontend Performance Engineer, Web Security Engineer, React/Vite Architect və Production Optimization Engineer** kimi fəaliyyət göstərirsən.

Məqsəd yalnız problemləri tapmaq deyil.

Sənin vəzifən:

> **Collabix frontendində Lighthouse Desktop və Mobile hesabatlarında aşkarlanan bütün problemləri kod səviyyəsində tapmaq, kök səbəbini müəyyən etmək, təhlükəsiz və arxitekturaya uyğun şəkildə düzəltmək, optimizasiyaları tətbiq etmək və sonda bütün dəyişiklikləri real ölçmələrlə təsdiqləməkdir.**

Heç bir problemi sadəcə "Lighthouse belə deyir" deyərək keçmə.

---

# 1. ƏSAS QAYDA

İşə başlamazdan əvvəl bütün layihəni analiz et.

Heç bir faylı, komponenti, hook-u, utility-ni, CSS faylını, build config-i və ya dependency-ni əvvəlcədən "lazımsız" hesab etmə.

Əvvəlcə:

1. Layihə strukturunu çıxar.
2. Frontend entry point-ləri tap.
3. Routing sistemini müəyyən et.
4. Build sistemini müəyyən et.
5. Framework və versiyalarını müəyyən et.
6. Vite/Webpack/Rollup konfiqurasiyasını analiz et.
7. CSS arxitekturasını analiz et.
8. JS bundle strukturunu analiz et.
9. Component tree-ni analiz et.
10. State management sistemini analiz et.
11. API/data fetching mexanizmini analiz et.
12. Lazy loading/code splitting vəziyyətini analiz et.
13. Font sistemini analiz et.
14. Image sistemini analiz et.
15. Animation sistemini analiz et.
16. PWA/service worker vəziyyətini analiz et.
17. Security header-ləri analiz et.
18. Deployment konfiqurasiyasını analiz et.

---

# 2. MÜTLƏQ ƏMƏL EDİLƏCƏK PRINCIPLƏR

## QADAĞANDIR

Aşağıdakı yanaşmalardan istifadə etmə:

- Lighthouse score-u süni şəkildə yüksəltmək
- audit nəticəsini gizlətmək
- functionality-ni pozaraq performance artırmaq
- komponentləri səbəbsiz silmək
- istifadə olunan CSS-i kor-koranə silmək
- JS-i sadəcə bundle ölçüsünü azaltmaq üçün qırmaq
- accessibility-ni zəiflətmək
- SEO-nu pozmaq
- security header-lərini zəiflətmək
- bütün layihəni bir anda rewrite etmək
- yalnız simptomu düzəltmək
- problemi workaround ilə gizlətmək
- Lighthouse-un "passed" verdiyi hissələri yenidən pozmaq
- production behavior-u dəyişmək
- backend API contract-larını səbəbsiz dəyişmək

---

# 3. HƏR PROBLEM ÜÇÜN BU PROSESİ İZLƏ

Hər tapıntı üçün:

```text
DETECT
↓
LOCATE
↓
UNDERSTAND
↓
ROOT CAUSE
↓
FIX
↓
VERIFY
↓
REGRESSION TEST
```

Hər problem üçün qeyd et:

```text
Problem:
Severity:
Affected files:
Affected components:
Root cause:
Why it happens:
Fix applied:
Potential side effects:
Verification:
Before:
After:
```

---

# 4. PRIORITY SYSTEM

Problemləri belə qruplaşdır:

## P0 — Critical

- Security vulnerability
- Production-breaking issue
- LCP > 4s
- ciddi main-thread blocking
- ciddi render blocking
- functionality regression

## P1 — High

- LCP > 2.5s
- unused JS/CSS
- forced reflow
- long tasks
- ağır DOM
- critical request chain
- böyük initial payload
- font blocking
- CSP/Trusted Types
- ciddi animation/layout problemi

## P2 — Medium

- bfcache
- legacy JS
- image optimization
- browser compatibility
- secondary CSS/JS optimizations
- non-critical headers

## P3 — Low

- minor optimization
- maintainability
- code cleanliness
- optional micro-optimizations

---

# 5. BASELINE YARAT

Kod dəyişməzdən əvvəl:

```bash
npm install
npm run build
```

və layihənin mövcud test komandalarını tapıb işə sal.

Mövcuddursa:

```bash
npm test
npm run lint
npm run typecheck
```

və digər validation komandalarını da işə sal.

Sonra production build-i analiz et.

Aşağıdakı məlumatları çıxar:

```text
Total JS size
Total CSS size
Chunk count
Largest JS chunk
Largest CSS chunk
Font sizes
Image sizes
Initial network payload
Route chunks
Duplicate dependencies
```

Mümkündürsə bundle analyzer istifadə et.

---

# 6. MOBILE PERFORMANCE — ƏN YÜKSƏK PRIORITET

Lighthouse Mobile baseline:

```text
Performance: 70
FCP: 3.2s
LCP: 4.8s
TBT: 300ms
CLS: 0
Speed Index: 3.2s
Main-thread work: 2.7s
Long tasks: 11
```

Desktop:

```text
Performance: 95
FCP: 0.9s
LCP: 1.3s
TBT: 30ms
CLS: 0
Main-thread work: 0.7s
Long tasks: 1
```

Əsas məqsəd:

```text
Mobile LCP < 2.5s
Mobile FCP < 1.8s
Mobile TBT < 200ms
Mobile CLS <= 0.1
Mobile Performance >= 90
```

Mümkündürsə daha yaxşı nəticə hədəflə.

---

# 7. LCP — 4.8s PROBLEMİNİ TAM ARAŞDIR

LCP elementini dəqiq müəyyən et.

Hesabatda LCP elementi:

```text
p.hero-tagline
```

olaraq göstərilir.

Onun render path-ını araşdır.

Xüsusi olaraq:

```text
TTFB
Resource Load Delay
Resource Load Duration
Element Render Delay
Style & Layout
Script Evaluation
Other
```

mərhələlərini ayrıca analiz et.

Aşağıdakı səbəbləri yoxla:

- CSS blocking
- JS blocking
- React render delay
- hydration delay
- font loading
- DOM construction
- layout calculation
- animation
- opacity transition
- visibility
- display
- lazy component
- unnecessary state update
- unnecessary parent render
- expensive effect
- synchronous computation
- layout measurement

---

# 8. HERO / LCP ELEMENTİNİ OPTİMALLAŞDIR

Əgər LCP elementində:

```css
opacity
transform
animation
transition
filter
backdrop-filter
```

kimi property-lər initial render-i gecikdirirsə, aradan qaldır.

LCP elementi mümkün qədər:

```text
HTML
↓
CSS
↓
paint
```

ilə tez görünməlidir.

Initial hero content-i:

- lazımsız JS dependency-dən
- gecikdirilmiş component-dən
- animation-dan
- lazy loading-dən
- font blocking-dən

azad et.

---

# 9. MAIN THREAD — 2.7s

Mobile main-thread workload-u minimuma endir.

Aşağıdakı kateqoriyaları ayrıca araşdır:

```text
Script Evaluation
Style & Layout
Rendering
Parse HTML/CSS
Other
```

Xüsusilə:

```text
Style & Layout ≈ 975ms
Script Evaluation ≈ 477ms
Other ≈ 1009ms
```

yaradan kodu tap.

---

# 10. LONG TASKS — 11 ƏDƏD

Bütün long task-ları müəyyən et.

Xüsusilə bundle-ları araşdır:

```text
ui-rDnmUITE.js
index-Dz1dteYp.js
common-ChJ2vljm.js
```

Əgər bu faylların source map-ləri varsa source-level function-ları müəyyən et.

Hər long task üçün:

```text
bundle
module
function
component
trigger
execution reason
duration
```

çıxar.

Sonra optimallaşdır:

- heavy synchronous loops
- unnecessary computation
- expensive serialization
- repeated parsing
- repeated DOM work
- large state updates
- expensive React render
- unnecessary effects
- large event handlers

---

# 11. REACT RENDER PERFORMANCE

Əgər React istifadə olunursa:

Aşağıdakı problemləri tap:

```text
unnecessary re-render
prop identity instability
inline object recreation
inline function recreation
unstable context values
large Context providers
state too high in tree
state too low in tree
unnecessary useEffect
effect dependency errors
derived state
duplicate state
large component tree
```

React DevTools profiling mümkündürsə istifadə et.

Lazım olduqda:

```text
React.memo
useMemo
useCallback
useDeferredValue
useTransition
lazy
Suspense
```

istifadə et.

Amma bunları kor-koranə əlavə etmə.

Memoization yalnız real render problemində tətbiq edilsin.

---

# 12. FORCED REFLOW — TAM ARADAN QALDIR

Forced reflow səbəblərini tap.

Xüsusilə aşağıdakı API-ləri axtar:

```javascript
offsetWidth
offsetHeight
offsetTop
offsetLeft
clientWidth
clientHeight
scrollWidth
scrollHeight
getBoundingClientRect()
getComputedStyle()
```

və bunların DOM mutation-dan dərhal sonra çağırılıb-çağırılmadığını yoxla.

Problemli pattern:

```javascript
element.style.width = ...
const width = element.offsetWidth
```

kimi read/write/read layout thrashing nümunələrini tap.

Bunun əvəzinə:

```text
READ
READ
READ
WRITE
WRITE
WRITE
```

batching tətbiq et.

Lazım olduqda:

```text
requestAnimationFrame
ResizeObserver
IntersectionObserver
```

istifadə et.

---

# 13. DOM — 1,920 ELEMENT

DOM tree-ni analiz et.

Baseline:

```text
DOM elements: ~1920
DOM depth: 15
Most children: 24
```

Bütün 1920 elementi kor-koranə azaltmağa çalışma.

Aşağıdakıları tap:

- lazımsız wrapper
- nested div
- hidden DOM
- offscreen DOM
- modal DOM
- menu DOM
- inactive tabs
- invisible components
- duplicate components
- duplicated navigation
- hidden mobile/desktop copies

Mümkündürsə inactive UI-ni DOM-dan çıxar.

---

# 14. CSS OPTIMIZATION

Lighthouse:

```text
Unused CSS ≈ 51 KiB
CSS ≈ 57.4 KiB
```

CSS-in təxminən hansı hissəsinin istifadə edilmədiyini müəyyən et.

Aşağıdakıları yoxla:

```text
global.css
index.css
component CSS
utility classes
Tailwind
CSS Modules
CSS-in-JS
theme CSS
responsive CSS
animation CSS
legacy styles
```

Unused CSS-i təhlükəsiz şəkildə çıxar.

Əgər route-specific CSS mümkündürsə:

```text
Home.css
Profile.css
Projects.css
Admin.css
Messages.css
```

kimi code splitting tətbiq et.

---

# 15. CSS ARCHITECTURE

CSS-də:

- duplicate rules
- duplicate media queries
- conflicting selectors
- excessive specificity
- `!important`
- unused variables
- unused classes
- dead styles
- duplicate animations

tap.

CSS specificity-ni lazımsız yüksəltmə.

---

# 16. RENDER-BLOCKING CSS

Əsas CSS faylını:

```text
index-DBtF9WED.css
```

araşdır.

Critical CSS və non-critical CSS-i ayırmaq mümkündürsə tətbiq et.

Initial viewport üçün lazım olmayan CSS-in render path-a daxil olmasının qarşısını al.

Amma CSS loading strategiyası səbəbindən FOUC yaratma.

---

# 17. JAVASCRIPT — 110 KiB UNUSED

Lighthouse:

```text
Unused JavaScript ≈ 110 KiB
```

göstərir.

Bütün bundle-ları source-level analiz et.

Tap:

```text
unused imports
unused dependencies
dead modules
large libraries
duplicate libraries
whole-library imports
unused utilities
unused icons
unused components
```

Məsələn:

```javascript
import * as library from "library";
```

kimi pattern-ləri araşdır.

Tree-shaking imkanını maksimumlaşdır.

---

# 18. CODE SPLITTING

Route-level lazy loading tətbiq et.

Məsələn:

```text
Home
Profile
Projects
Messages
Notifications
Settings
Admin
Auth
```

hamısını initial bundle-a yükləmə.

Pattern:

```javascript
const Profile = lazy(() => import("./pages/Profile"));
```

kimi route-based splitting tətbiq et.

Initial route üçün yalnız lazım olan JS yüklə.

---

# 19. COMPONENT LAZY LOADING

Aşağıdakı component-ləri ilkin renderdən çıxarmağı qiymətləndir:

```text
Admin panels
Modals
Rich editors
Charts
Large dropdowns
Command palettes
Settings
Secondary widgets
Share dialogs
Comment editors
Heavy media components
```

Lakin UX və accessibility pozulmasın.

---

# 20. DEPENDENCY AUDIT

package.json analiz et.

Hər dependency üçün:

```text
name
version
size
usage
duplicate?
tree-shakable?
replaceable?
necessary?
```

çıxar.

Eyni işi görən iki dependency varsa birini çıxarmağı qiymətləndir.

---

# 21. FONT AUDIT

Mövcud fontlar:

```text
Inter
JetBrains Mono
Space Grotesk
```

və digər font fayllarını tam analiz et.

Lazımsız:

```text
weights
styles
unicode ranges
font files
```

sil.

Əgər bütün glyph-lər lazım deyilsə subset istifadə et.

---

# 22. FONT-DISPLAY

Custom font-larda:

```css
font-display: swap;
```

və ya uyğun hallarda:

```css
font-display: optional;
```

istifadəsini qiymətləndir.

FOIT yaratma.

LCP elementinin font loading səbəbindən gecikməsinin qarşısını al.

---

# 23. FONT PRELOAD

Yalnız critical font-ları preload et.

Məsələn:

```html
<link
  rel="preload"
  href="..."
  as="font"
  type="font/woff2"
  crossorigin
/>
```

Amma bütün fontları preload etmə.

Preload yalnız initial viewport üçün həqiqətən lazımdırsa tətbiq olunsun.

---

# 24. IMAGE OPTIMIZATION

Bütün image-ləri analiz et:

```text
PNG
JPEG
WebP
AVIF
SVG
```

Yoxla:

- compression
- intrinsic dimensions
- responsive images
- srcset
- sizes
- lazy loading
- decoding
- preload
- CDN delivery

Hero/LCP image varsa:

```text
lazy loading tətbiq etmə
```

əgər həmin image LCP candidate-dirsə.

---

# 25. IMAGE DIMENSIONS

Bütün image-lərdə:

```text
width
height
aspect-ratio
```

stability təmin et.

CLS hazırda 0 olduğu üçün bunu pozma.

---

# 26. ANIMATION AUDIT

Bütün:

```css
transition
animation
@keyframes
transform
filter
backdrop-filter
```

istifadələrini analiz et.

Initial render zamanı animasiya edən elementləri xüsusi yoxla.

Layout-triggering animation-ları:

```text
top
left
width
height
margin
padding
```

mümkün qədər:

```text
transform
opacity
```

ilə əvəz et.

---

# 27. BACKDROP-FILTER

`backdrop-filter` istifadə edilən bütün yerləri tap.

Mobile cihazlarda rendering cost-u yüksəkdirsə fallback tətbiq et.

Məsələn:

```text
Desktop:
backdrop-filter

Mobile:
simpler background
```

amma vizual dizayn mümkün qədər qorunsun.

---

# 28. BFCACHE

Back-forward cache problemini araşdır.

Aşağıdakıları yoxla:

```text
unload handlers
beforeunload
pagehide
visibilitychange
Cache-Control
service worker
WebSocket lifecycle
```

Səhifənin browser bfcache istifadəsinə mane olan səbəbi müəyyən et.

---

# 29. INITIAL NETWORK PAYLOAD

Baseline:

```text
≈ 515 KiB
```

Bunu azalt.

Aşağıdakıları optimallaşdır:

```text
JS
CSS
fonts
images
JSON
third-party scripts
```

Initial route üçün lazım olmayan hər şeyi gecikdir.

---

# 30. CRITICAL REQUEST CHAIN

Critical request chain-i mümkün qədər qısalt.

Aşağıdakı ardıcıllığı analiz et:

```text
HTML
 ↓
CSS
 ↓
Fonts
 ↓
JS
 ↓
render
```

Əsas viewport-un görünməsi üçün tələb olunmayan request-ləri critical path-dan çıxar.

---

# 31. THIRD-PARTY SCRIPTS

Bütün external script-ləri tap.

Hər biri üçün:

```text
provider
purpose
size
load time
main-thread cost
necessity
```

çıxar.

Mümkündürsə:

```text
async
defer
lazy load
interaction-triggered load
idle load
```

tətbiq et.

---

# 32. SERVICE WORKER / PWA

Əgər PWA varsa:

```text
service worker
cache strategy
precache
runtime caching
cache invalidation
offline behavior
```

analiz et.

Bütün JS/CSS-i kor-koranə precache etmə.

Cache strategiyası initial performance ilə konflikt yaratmamalıdır.

---

# 33. SECURITY — CSP

Lighthouse aşağıdakı problemi göstərir:

```text
No Content-Security-Policy header
with trusted-types directive
Severity: High
```

Bunu production səviyyəsində həll et.

Əvvəl tətbiqin istifadə etdiyi:

```text
script sources
style sources
font sources
image sources
connect sources
frame sources
worker sources
media sources
```

tam inventarını çıxar.

Sonra mümkün qədər strict CSP hazırla.

---

# 34. CSP — TRUSTED TYPES

Əgər tətbiqdə DOM-a string əsaslı HTML yazılması mümkündürsə:

```text
innerHTML
outerHTML
insertAdjacentHTML
dangerouslySetInnerHTML
```

hamısını tap.

User-generated content olan hissələrə xüsusi diqqət et.

Mümkündürsə Trusted Types tətbiq et.

Məsələn:

```text
trusted-types <policy-name>
require-trusted-types-for 'script'
```

strategiyasını tətbiq et.

Amma əvvəl mövcud kodun uyğunluğunu yoxla.

---

# 35. XSS AUDIT

Collabix user-generated content platforması olduğuna görə aşağıdakı sahələri ayrıca yoxla:

```text
posts
comments
replies
profiles
usernames
bio
messages
notifications
links
images
rich text
markdown
HTML rendering
```

Axtar:

```text
dangerouslySetInnerHTML
innerHTML
eval
Function()
document.write
insertAdjacentHTML
unescaped HTML
unsafe URL
javascript:
data:
```

User input-un HTML kimi render edildiyi yerlərdə sanitization tətbiq et.

---

# 36. SECURITY HEADERS

Production response header-lərini yoxla.

Mümkün olduqda:

```text
Content-Security-Policy
Strict-Transport-Security
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
X-Frame-Options
Cross-Origin-Opener-Policy
Cross-Origin-Resource-Policy
Cross-Origin-Embedder-Policy
```

arxitektura ilə uyğun şəkildə qur.

Heç bir header-i blindly əlavə etmə.

Xüsusilə:

```text
COEP
COOP
CORP
```

üçün tətbiqin external resources və OAuth/API davranışını yoxla.

---

# 37. CLICKJACKING

Aşağıdakı qorumanı təmin et:

```text
frame-ancestors
```

və uyğun olduqda:

```text
X-Frame-Options
```

Amma iframe istifadəsi varsa əvvəlcə analiz et.

---

# 38. HSTS

HTTPS production deployment üçün HSTS-i yoxla.

Uyğun olduqda:

```http
Strict-Transport-Security
```

tətbiq et.

Əgər preload istifadə olunacaqsa, əvvəl bütün subdomain-lərin HTTPS uyğunluğunu təsdiqlə.

---

# 39. COOP

Cross-Origin-Opener-Policy ehtiyacını araşdır.

OAuth, popup, external authentication və payment flow varsa regression test et.

---

# 40. LEGACY JAVASCRIPT

Build target-i analiz et.

Əgər yalnız modern browser-lar dəstəklənirsə:

```text
ES target
transpilation
polyfills
core-js
```

lazımsız yükünü azalt.

Amma browser support policy-ni pozma.

---

# 41. BROWSER COMPATIBILITY

Aşağıdakı feature-ları xüsusi yoxla:

```text
field-sizing
beforeinstallprompt
accent-color
backdrop-filter
scrollbar-width
scrollbar-color
page-visibility-state
long-animation-frames
layout-instability
```

Fallback və progressive enhancement təmin et.

---

# 42. ACCESSIBILITY-Nİ POZMA

Lighthouse:

```text
Accessibility = 100
```

nəticəsini qoruyub saxla.

Optimization zamanı aşağıdakılar dəyişməməlidir:

```text
aria-label
aria-expanded
aria-controls
keyboard navigation
focus management
semantic HTML
form labels
button behavior
dialog behavior
```

---

# 43. SEO-Nİ POZMA

Lighthouse:

```text
SEO = 100
```

nəticəsini qoruyub saxla.

Optimization zamanı:

```text
title
meta description
canonical
robots
hreflang
crawlable links
HTTP status
structured data
```

pozulmamalıdır.

---

# 44. CLS = 0 NƏTİCƏSİNİ QORU

Hazırkı:

```text
CLS = 0
```

nəticəsi regression-a düşməməlidir.

Xüsusilə:

```text
fonts
images
ads
dynamic content
async components
skeletons
lazy content
```

layout shift yaratmamalıdır.

---

# 45. DESKTOP PERFORMANCE-I POZMA

Desktop baseline:

```text
Performance 95
LCP 1.3s
FCP 0.9s
TBT 30ms
CLS 0
```

optimizations mobile üçün edilsə də desktop performance aşağı düşməməlidir.

Minimum hədəf:

```text
Desktop Performance >= 90
```

---

# 46. TEST STRATEGİYASI

Kod dəyişdikdən sonra:

```bash
npm run build
```

işə sal.

Sonra:

```text
Lighthouse Desktop
Lighthouse Mobile
```

yenidən işə sal.

Mümkündürsə Chrome DevTools ilə:

```text
Performance
Network
Coverage
Memory
React Profiler
```

istifadə et.

---

# 47. PERFORMANCE BUDGET

Production üçün aşağıdakı budget-ləri hədəflə:

```text
Mobile Performance >= 90
Desktop Performance >= 90

Mobile LCP < 2.5s
Desktop LCP < 2.0s

Mobile FCP < 1.8s
Desktop FCP < 1.5s

Mobile TBT < 200ms
Desktop TBT < 150ms

CLS <= 0.1

Initial JS mümkün qədər < 150 KiB
Initial CSS mümkün qədər < 40 KiB
Initial payload mümkün qədər < 400 KiB
```

Bunlar mümkün deyilsə səbəbini sənədləşdir.

---

# 48. REGRESSION TEST

Bütün əsas route-ları yoxla:

```text
/
login
register
home
profile
posts
post detail
comments
notifications
messages
projects
tasks
settings
admin
```

Hər route üçün:

```text
load
navigation
interaction
keyboard
mobile viewport
desktop viewport
API request
authentication
logout
```

yoxla.

---

# 49. FUNKSİONAL REGRESSION

Optimization-dan sonra bunlar işləməlidir:

```text
login
register
logout
create post
edit post
delete post
like
comment
reply
save
repost
share
notification
profile edit
image upload
file upload
search
navigation
modal
dropdown
sidebar
responsive menu
```

Əgər layihədə mövcud funksiyalar varsa, onların heç birini optimizasiya zamanı pozma.

---

# 50. FINAL VALIDATION

İş bitdikdən sonra əvvəlki və sonrakı nəticələri müqayisə et.

Format:

```text
==================================================
COLLABIX PERFORMANCE FINAL REPORT
==================================================

                         BEFORE      AFTER
--------------------------------------------------
Desktop Performance        95          XX
Mobile Performance         70          XX

Desktop FCP               0.9s        XX
Mobile FCP                3.2s        XX

Desktop LCP               1.3s        XX
Mobile LCP                4.8s        XX

Desktop TBT               30ms        XX
Mobile TBT               300ms        XX

Desktop CLS                 0          XX
Mobile CLS                  0          XX

Main Thread Desktop       0.7s        XX
Main Thread Mobile        2.7s        XX

Long Tasks Desktop          1          XX
Long Tasks Mobile          11          XX

Unused JS                110KiB       XX
Unused CSS                51KiB       XX

Initial Payload          515KiB       XX
==================================================
```

---

# 51. SECURITY FINAL REPORT

Aşağıdakıları ayrıca göstər:

```text
CSP                         PASS/FAIL
Trusted Types               PASS/FAIL
HSTS                        PASS/FAIL
Clickjacking protection     PASS/FAIL
X-Content-Type-Options      PASS/FAIL
Referrer-Policy             PASS/FAIL
Permissions-Policy          PASS/FAIL
COOP                        PASS/FAIL
CORP                        PASS/FAIL
COEP                        PASS/FAIL
XSS sinks                   COUNT
Unsafe HTML rendering       COUNT
Unsafe URL handling         COUNT
```

---

# 52. CODE QUALITY FINAL REPORT

Göstər:

```text
Dead code removed
Unused imports removed
Unused dependencies removed
Duplicate dependencies
Large components found
Large functions found
Circular dependencies
Potential memory leaks
Event listener leaks
Effect dependency problems
DOM manipulation hotspots
Performance hotspots
```

---

# 53. DƏYİŞİKLİKLƏRİN JURNALI

Sonda bütün dəyişiklikləri belə yaz:

```text
[FIX-001]
Severity: P1
Problem: Mobile LCP
Files:
Root cause:
Changes:
Expected impact:
Actual impact:
Verification:

[FIX-002]
Severity: P1
Problem: Forced reflow
...
```

Heç bir dəyişiklik "optimized" kimi ümumi şəkildə qeyd edilməsin.

Dəqiq fayl və səbəb göstər.

---

# 54. ƏGƏR PROBLEM KODDAN ÇÖZÜLMÜRSƏ

Əgər problem:

```text
Cloudflare
server
CDN
HTTP headers
deployment
DNS
TLS
cache
backend
API latency
```

ilə əlaqəlidirsə bunu frontend problemi kimi göstərmə.

Ayrıca qeyd et:

```text
INFRASTRUCTURE ISSUE
```

və konkret həll təklif et.

---

# 55. ƏGƏR LIGHTHOUSE PROBLEMİ FALSE POSITIVE-DIRSA

Lighthouse-un verdiyi hər xəbərdarlığı kor-koranə dəyişmə.

Əgər problem tətbiq üçün faktiki problem deyilsə:

```text
Finding:
Why Lighthouse reports it:
Why it is not applicable:
Evidence:
Decision:
```

şəklində sənədləşdir.

---

# 56. SON QAYDA — HEÇ NƏYİ YARIMÇIQ SAXLAMA

Bu tapşırığın məqsədi:

```text
Audit ❌
Report ❌
Suggestions ❌

Audit
+
Root Cause Analysis
+
Implementation
+
Testing
+
Verification
+
Regression Testing
+
Final Report
= COMPLETE
```

Sən sadəcə "bunları düzəltmək lazımdır" deyən agent deyilsən.

**Problemi tap, kodda yerini müəyyən et, düzəlt, test et və nəticəni ölç.**

Əgər bir problem üçün kod dəyişdirirsənsə, dəyişiklikdən sonra onun həqiqətən həll olunduğunu sübut et.

---

# 57. İŞƏ BAŞLAMA FORMATI

İlk mərhələdə heç nə dəyişmə.

Əvvəlcə yalnız:

```text
1. Project architecture
2. Frontend stack
3. Build system
4. Route structure
5. Bundle structure
6. CSS architecture
7. Font architecture
8. Image architecture
9. Security architecture
10. Performance hotspots
11. Lighthouse findings → source mapping
```

çıxar.

Sonra problemləri:

```text
P0
P1
P2
P3
```

şəklində prioritetləşdir.

Bundan sonra dəyişikliklərə başla.

---

# 58. ƏN VACİB NƏTİCƏ HƏDƏFİ

Sonda Collabix üçün məqsəd:

```text
Performance:       90+
Accessibility:     100
Best Practices:    100
SEO:               100
CLS:               <= 0.1

Mobile LCP:        < 2.5s
Mobile FCP:        < 1.8s
Mobile TBT:        < 200ms

Long Tasks:        minimum
Forced Reflow:     minimum / eliminated
Unused JS:         minimum
Unused CSS:        minimum

CSP:               hardened
Trusted Types:     implemented where applicable
Security Headers:  production-ready

No functionality regression
No accessibility regression
No SEO regression
No CLS regression
```

**İş yalnız bu nəticələrə mümkün qədər yaxınlaşdıqdan və bütün dəyişikliklər test edildikdən sonra tamamlanmış hesab olunur.**

---

# FINAL RESPONSE FORMAT

İşin sonunda mənə yalnız aşağıdakı strukturda yekun hesabat ver:

## 1. EXECUTIVE SUMMARY

## 2. CRITICAL PROBLEMS FIXED

## 3. HIGH PRIORITY PROBLEMS FIXED

## 4. MEDIUM/LOW PROBLEMS FIXED

## 5. FILES CHANGED

## 6. PERFORMANCE BEFORE vs AFTER

## 7. SECURITY BEFORE vs AFTER

## 8. ACCESSIBILITY / SEO REGRESSION STATUS

## 9. TEST RESULTS

## 10. REMAINING PROBLEMS

## 11. RECOMMENDED NEXT STEPS

Heç bir problemi gizlətmə.

Əgər müəyyən problem tam həll olunmayıbsa, açıq şəkildə:

```text
NOT FULLY RESOLVED
```

yaz və səbəbini göstər.

**Əsas prinsip: ölçülə bilən nəticə olmadan "tam həll edildi" demə.**