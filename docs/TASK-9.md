# Collabix — TASK-9: Complete Frontend Audit, Responsive Optimization & UI/UX Polish (Cloudflare)

## Role

Sən Senior Frontend Engineer, UI/UX Designer, Responsive Specialist və Frontend QA Engineer rolunda işləyirsən.

Məqsəd yalnız responsive problemləri tapmaq deyil, **bütün frontend-i Production Ready səviyyəsinə çatdırmaqdır.**

İş prinsipi **Detection First** olmalıdır:

1. Audit et
2. Problemləri aşkarlat
3. Səbəbini müəyyən et
4. Ən düzgün həlli tətbiq et
5. Yenidən audit et
6. Bütün testlər təmiz keçənə qədər prosesi təkrarla.

Kod yazmadan əvvəl plan hazırla və təsdiq gözlə.

Hər fazadan sonra:

* Audit hesabatı təqdim et
* `tsc`
* `vite build`
* Playwright E2E
* Console Errors

hamısı uğurlu olmalıdır.

---

# Stack

* Cloudflare Workers
* Cloudflare D1
* Cloudflare R2
* Cloudflare KV
* TypeScript
* Vite
* Playwright

Bu task yalnız frontend üçündür.

Dəyişdirilməməlidir:

* Backend
* API
* Auth
* Database
* D1 Schema
* Business Logic

Mövcud funksionallıq tam qorunmalıdır.

Mövcud 110 Playwright testi qırılmamalıdır.

---

# Responsive Audit

Bütün frontend aşağıdakı viewport-larda test olunmalıdır.

## Mobile

* 360×800
* 375×812
* 390×844
* 412×915

## Tablet

* 768×1024
* 820×1180
* 1024×768 (Landscape)

## Desktop

* 1280×720
* 1366×768
* 1440×900
* 1536×864
* 1920×1080

Landscape vəziyyətləri ayrıca yoxlanmalıdır.

---

# Audit olunacaq səhifələr

Heç biri buraxılmamalıdır.

* Home
* Authentication
* Login
* Register
* Feed
* Posts
* Post Detail
* Profile
* Search
* Notifications
* Messages
* Chat
* Dashboard
* Settings
* Admin Panel
* Moderator Panel

---

# Audit olunacaq komponentlər

Bütün reusable komponentlər.

* Navbar
* Sidebar
* Footer
* Cards
* Buttons
* Inputs
* Forms
* Tables
* Charts
* Images
* Avatar
* Dropdown
* Dialog
* Modal
* Drawer
* Tooltip
* Toast
* Tabs
* Pagination
* Markdown
* Code Blocks
* Empty States
* Error States
* Loading States
* Skeleton
* Progress
* Badges
* Tags

---

# Responsive problemləri tap

Tap və düzəlt.

* Horizontal Scroll
* Overflow X
* Overflow Y
* Hidden Content
* Text Overflow
* Image Overflow
* SVG Overflow
* Video Overflow
* Grid Problems
* Flex Problems
* Wrong Width
* Wrong Height
* Wrong Padding
* Wrong Margin
* Broken Alignment
* Responsive Typography
* Sticky Problems
* Fixed Problems
* Z-index Conflict
* Layout Shift
* CLS
* Sidebar Problems
* Navbar Problems
* Mobile Menu
* Drawer
* Modal
* Tables
* Long Text
* Long Username
* Long URL
* Long Code Block

Heç bir breakpoint-də horizontal scroll olmamalıdır.

---

# UI / UX Audit

Bütün dizayn peşəkar səviyyədə analiz edilməlidir.

Tap və düzəlt.

* Köhnə görünən UI
* Vizual uyğunsuzluq
* Düzgün olmayan spacing
* Margin problemləri
* Padding problemləri
* Radius consistency
* Shadow consistency
* Color consistency
* Typography hierarchy
* Icon consistency
* Card consistency
* Component consistency
* Visual hierarchy
* White Space balansı
* Alignment
* Responsive spacing
* Empty State dizaynı
* Error State dizaynı
* Success State dizaynı
* Loading State dizaynı

UI müasir SaaS məhsulu səviyyəsində olmalıdır.

---

# Buttons Audit

Bütün buttonlar analiz olunmalıdır.

Yoxla.

* Radius
* Padding
* Font
* Size
* Hover
* Active
* Focus
* Disabled
* Loading
* Icon Alignment
* Spinner
* Shadow
* Transition

Buttonlar vahid Design System istifadə etməlidir.

---

# Forms Audit

Yoxla.

* Input
* Textarea
* Select
* Checkbox
* Radio
* Switch

Analiz et.

* Validation
* Error
* Success
* Focus
* Placeholder
* Autofill
* Keyboard
* Mobile uyğunluğu

---

# Animations & Micro Interactions

Mövcud animasiyaları analiz et.

Lazım olduqda yenilə.

Lazım olan yerlərə peşəkar animasiyalar əlavə et.

Misal:

* Page Transition
* Fade
* Fade Up
* Slide
* Scale
* Cards Hover
* Buttons Hover
* Button Press
* Sidebar
* Drawer
* Dropdown
* Modal
* Dialog
* Toast
* Accordion
* Tabs
* Tooltip
* Skeleton
* Counter
* Progress
* Notification
* Loading
* Search
* Hover Effects

Animasiyalar:

* Smooth
* Minimal
* Premium
* GPU Accelerated
* 60 FPS
* prefers-reduced-motion uyğun

Heç bir animasiya istifadəçini narahat etməməlidir.

---

# Frontend Logic Audit

Frontend davranışı da analiz olunmalıdır.

Tap.

* Broken UI State
* Wrong Loading
* Infinite Loading
* Missing Skeleton
* Double Click
* Disabled olmayan button
* Race Condition
* Duplicate Request
* Modal bağlanmır
* Dropdown bağlanmır
* Drawer bağlanmır
* Outside Click
* ESC
* Keyboard Navigation
* Focus Trap
* Scroll Lock
* Search UI
* Filter UI
* Pagination UI
* Empty Results
* Error UI
* Retry UI
* Offline UI

Frontend davranışı peşəkar SaaS standartına uyğun olmalıdır.

---

# Accessibility

Yoxla.

* ARIA
* Keyboard Navigation
* Focus Visible
* Contrast
* Screen Reader
* prefers-reduced-motion
* Touch Target minimum 44×44

---

# Responsive Improvements

Lazım olduqda optimallaşdır.

* Grid
* Flex
* Layout
* Sidebar
* Navigation
* Cards
* Feed
* Dashboard
* Profile
* Hero
* Footer
* Chat
* Search
* Forms

İstifadə et.

* clamp()
* aspect-ratio
* minmax()
* min-width:0
* flex-wrap
* container queries
* 100dvh
* Safe Area Insets
* object-fit
* overflow-wrap

---

# Performance

Optimallaşdır.

* CLS
* LCP
* INP
* Lazy Loading
* Image Optimization
* Code Splitting
* Dynamic Import
* Tree Shaking
* Animation Performance
* ResizeObserver
* Re-render azaldılması

---

# Qaydalar

Dəyişdirilməməlidir.

* Backend
* API
* Database
* Business Logic
* Mövcud funksionallıq
* Mövcud Design Language

Yalnız frontend, responsive, UI/UX və performans təkmilləşdirilməlidir.

Desktop dizaynı pozulmamalıdır.

Yeni bug yaradılmamalıdır.

Kod təmiz, maintainable və reusable olmalıdır.

---

# Definition of Done

Layihə aşağıdakı vəziyyətə çatmalıdır.

* Responsive bütün ölçülərdə PASS
* Horizontal Scroll yoxdur
* Overflow yoxdur
* CLS < 0.1
* Responsive Typography
* Responsive Images
* Responsive Tables
* Responsive Navigation
* Responsive Sidebar
* Responsive Forms
* Responsive Cards
* Responsive Chat
* Responsive Dashboard
* Responsive Feed
* Responsive Profile
* Touch Target ≥ 44×44
* Professional UI
* Consistent Design System
* Smooth Animations
* Modern Micro Interactions
* Premium UX
* Accessibility PASS
* Zero Console Error
* `tsc` PASS
* `vite build` PASS
* Mövcud Playwright testləri PASS
* Yeni responsive testləri PASS
* Production Ready

---

# Final Report

İş tamamlandıqdan sonra təqdim et:

## Audit Summary

* Tapılan problemlərin sayı
* Düzəldilən problemlərin sayı
* Qalan problemlər

## Responsive Report

Hər viewport üçün:

* PASS / WARNING / FAIL
* Tapılan problemlər
* Edilən düzəlişlər

## UI/UX Report

* Təkmilləşdirilən komponentlər
* Dizayn optimallaşdırmaları
* Animasiya əlavələri
* UX təkmilləşdirmələri

## Changed Files

* Dəyişdirilən fayllar
* Dəyişiklik səbəbi

## Performance

* CLS
* LCP
* INP
* Lighthouse nəticələri

## Final Status

Layihənin bütün frontend hissəsi müasir SaaS standartlarına uyğun, tam responsive, yüksək performanslı, animasiyaları optimallaşdırılmış, UI/UX baxımından peşəkar və **Production Ready** vəziyyətə gətirilmiş olmalıdır.
