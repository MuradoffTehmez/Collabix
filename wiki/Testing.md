# 🧪 Test Strategiyası (Testing)

> Collabix-in xətaya qarşı dayanıqlığını təmin edən geniş test infrastrukturu.

---

## 🎯 Test Prinsipləri

Platforma mürəkkəb real-vaxt (real-time) xüsusiyyətlərə və ciddi təhlükəsizlik qatlarına sahib olduğu üçün testləşdirmə bir neçə mərhələdən (Layer) ibarətdir:
1. **Unit Testlər (Vitest):** Funksiyaların tək-tək (izolyasiya olunmuş) yoxlanılması.
2. **E2E Testlər (Playwright):** Həqiqi brauzerdə istifadəçi hərəkətlərinin avtomatlaşdırılmış simulyasiyası.
3. **Audit/Responsive Testlər:** Fərqli ekran ölçülərində qüsursuz UI və dizayn yoxlaması.

---

## 🛠️ Vitest (Unit Testing)

Təməl biznes məntiqlərinin və utilitlərin yoxlanması üçün istifadə olunur.
- **İşə salmaq:** `npm run test:unit`
- İzləmə rejimi (Faylı dəyişdikcə avtomatik çalışır): `npm run test:unit:watch`

Burada, xüsusilə Rate-limit hesablamaları, Şifrələmə kriptoqrafiya alqoritmləri (PBKDF2) və Mətn/Markdown təmizləyiciləri (DOMPurify funksiyaları) test edilir.

---

## 🎭 Playwright (E2E Testing)

Collabix Playwright vasitəsilə tam funksional, başsız (headless) brauzer testlərinə malikdir. Ssenarilər (Scenarios) tam bir dövrü əhatə edir.

### Test Ssenari Nümunələri
- **Authentication:** Qeydiyyat prosesinin yoxlanması, yanlış parolla girişdəki xətalar, JWT tokenin cookie-yə oturması.
- **WebSocket / Chat:** 2 fərqli Playwright pəncərəsi açılır, biri mesaj yazır, digərində onun anında peyda olub-olmaması (`RoomDO`) sınaqdan keçirilir.
- **Workspace:** Komanda yaradılması, dəvət göndərilməsi, tapşırığın lövhədə sürüklənib buraxılması.

### Playwright Əmrləri
- `npm run e2e` — Bütün E2E testlərini tam gizli rejimdə işlədir.
- `npm run e2e:ui` — Playwright-ın vizual UI ekranını açır, testləri addım-addım izləməyə imkan verir. Dəbbək (Debug) etmək üçün idealdır.

---

## 📱 Responsive & UI Audit (Cihaz Testləri)

Collabix fərqli ekran ölçülərində (Mobile, Tablet, Desktop) işləmək məcburiyyətindədir. 
- Xüsusi Playwright konfiqurasiyası var ki, ekranı iPhone və ya Android cihazlara uyğun kiçildir, CSS Grid/Flexbox dəyişikliklərinin doğru baş verdiyini və ya menunun (Hamburger menu) düzgün çıxdığını yoxlayır.
- `npm run audit:responsive` xüsusi audit raporları çəkmək üçün.

---

**Əvvəlki:** [← Töhfə Vermə Təlimatı](Contributing) | **Növbəti:** [Deploy Təlimatı →](Deployment)
