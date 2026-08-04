import { test, expect } from '@playwright/test';
import { runFullAudit, generateReports } from './audit-lib';

// TASK-9 / FAZA 1 — audit HESABATI (detection).
//
// Bu, "test" deyil — MATRİS üzərində gəzib pozuntuları TOPLAYAN və
// `audit-reports/` qovluğunda HTML/Markdown/JSON hesabatlar çıxaran hesabat generatorudur.
// Yalnız `desktop` layihəsində bir dəfə işləyir (viewport-u özü dəyişir).
// `npm run audit:responsive` bunu çağırır.
//
// Assertion YOXDUR — məqsəd xətaları TAPMAQDIR, sınmaq deyil. Sınaq həddi
// ayrıca `responsive-audit.spec.ts`-dədir.

test.describe.configure({ mode: 'serial' });

test('responsive audit hesabatı', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Audit bir dəfə (desktop layihəsi)');
  test.setTimeout(60 * 60_000);   // matris çox böyükdür (24 viewport * N page) - 1 saat limiti

  // 1. Yeni audit-lib funksiyası ilə yoxlamaları toplayırıq
  const auditResult = await runFullAudit(browser);

  // 2. Hesabatları yaradırıq (HTML, Markdown, JSON)
  generateReports(auditResult, 'audit-reports');

  // Konsola qısa xülasə
  console.log('\n===== RESPONSIVE AUDIT TAMAMLANDI =====');
  console.log(`Ümumi hesab: ${auditResult.overallScore}/100`);
  console.log(`Pozuntuların sayı: ${auditResult.totalViolations}`);
  console.log('Hesabatlar `audit-reports` qovluğunda yaradıldı.');
  console.log('Xüsusilə `audit-reports/audit.html` faylını brauzerdə aça bilərsiniz.');
  console.log('=======================================\n');

  expect(auditResult.results.length).toBeGreaterThan(0);
});
