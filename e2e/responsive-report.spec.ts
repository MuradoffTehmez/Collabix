import { test, expect } from '@playwright/test';
import {
  runFullAudit, generateReports, AUDIT_PAGES, VIEWPORTS, ALL_VIEWPORTS,
  type FullAuditResult,
} from './audit-lib';

// Responsive audit HESABATI (detection) — `npm run audit:responsive`.
//
// Bu "test" deyil: matris üzərində gəzib pozuntuları TOPLAYAN və
// `audit-reports/` qovluğuna kateqoriyalaşdırılmış reyestr çıxaran generatordur.
// Assertion yoxdur — məqsəd tapmaqdır, sınmaq deyil. Sınaq həddi
// `responsive-audit.spec.ts`-dədir.
//
// MATRİS SEÇİMİ (niyə hər tema × hər ölçü DEYİL):
//   23 səhifə × 24 en × 4 tema = 2208 kombinasiya ≈ 25+ dəqiqə, üstəlik
//   dark/light/matrix arasındakı fərq YALNIZ rəngdir — layout həndəsəsi eynidir.
//   Cyberpunk isə ŞRİFTİ dəyişir (Orbitron, `75-touch.css`), yəni mətn metrikləri
//   və deməli daşma riski FƏRQLİDİR — ona görə o, tam en dəsti alır.
//   light/matrix kritik enlərdə yoxlanır ki, rəng dəyişikliyinin gətirdiyi
//   border/shadow qalınlığı fərqləri də tutulsun.

test.describe.configure({ mode: 'serial' });

const CRITICAL_WIDTHS = ALL_VIEWPORTS.filter(v =>
  [320, 360, 480, 768, 1024, 1440, 2560].includes(v.w));

test('responsive audit hesabatı', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Audit bir dəfə (desktop layihəsi)');
  test.setTimeout(90 * 60_000);

  const merged: FullAuditResult = { results: [], overallScore: 0, totalViolations: 0, combos: 0 };
  const absorb = (r: FullAuditResult) => {
    merged.results.push(...r.results);
    merged.totalViolations += r.totalViolations;
  };

  // 1) Struktur baseline — bütün səhifələr × 24 en × dark
  absorb(await runFullAudit(browser, AUDIT_PAGES, { themes: ['dark'], viewports: ALL_VIEWPORTS }));

  // 2) Cyberpunk — şrift metrikləri fərqli, tam en dəsti
  absorb(await runFullAudit(browser, AUDIT_PAGES, { themes: ['cyberpunk'], viewports: ALL_VIEWPORTS }));

  // 3) light + matrix — kritik enlər
  absorb(await runFullAudit(browser, AUDIT_PAGES, { themes: ['light', 'matrix'], viewports: CRITICAL_WIDTHS }));

  // 4) Landşaft oriyentasiyası — qısa hündürlük sticky/modal üçün ən sərt haldır
  absorb(await runFullAudit(browser, AUDIT_PAGES, { themes: ['dark'], viewports: VIEWPORTS.landscape }));

  merged.combos = merged.results.length;
  merged.overallScore = merged.results.length
    ? Math.round(merged.results.reduce((s, r) => s + r.score, 0) / merged.results.length)
    : 0;

  generateReports(merged, 'audit-reports');

  const p0 = merged.results.reduce((s, r) => s + r.summary.byPriority.P0, 0);
  const p1 = merged.results.reduce((s, r) => s + r.summary.byPriority.P1, 0);
  const p2 = merged.results.reduce((s, r) => s + r.summary.byPriority.P2, 0);

  console.log('\n===== RESPONSIVE AUDIT TAMAMLANDI =====');
  console.log(`Kombinasiya: ${merged.combos}`);
  console.log(`Ümumi hesab: ${merged.overallScore}/100`);
  console.log(`Pozuntu: ${merged.totalViolations}  (P0=${p0} P1=${p1} P2=${p2})`);
  console.log('Hesabat: audit-reports/audit.html · audit.md · audit.json');
  console.log('=======================================\n');

  expect(merged.results.length).toBeGreaterThan(0);
});
