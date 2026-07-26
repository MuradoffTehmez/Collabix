import { test, expect, type Page } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { AUTH_FILE } from './seed';
import { collectViolations, ALL_VIEWPORTS, AUDIT_PAGES, type Violation } from './audit-lib';

// TASK-9 / FAZA 1 — audit HESABATI (detection).
//
// Bu, "test" deyil — MATRİS üzərində gəzib pozuntuları TOPLAYAN və
// `test-results/responsive-audit.{json,md}` çıxaran hesabat generatorudur.
// Yalnız `desktop` layihəsində bir dəfə işləyir (viewport-u özü dəyişir).
// `npm run audit:responsive` bunu çağırır.
//
// Assertion YOXDUR — məqsəd xətaları TAPMAQDIR, sınmaq deyil. Sınaq həddi
// ayrıca `responsive-audit.spec.ts`-dədir (P0 overflow → fail).

test.describe.configure({ mode: 'serial' });

interface Row {
  page: string; w: number; h: number;
  violations: Violation[];
}

async function auditPage(page: Page, url: string): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  // Layout stabilləşsin (şəkil/şrift yüklənməsi CLS yaradır).
  await page.waitForTimeout(400);
}

test('responsive audit hesabatı', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Audit bir dəfə (desktop layihəsi)');
  test.setTimeout(15 * 60_000);   // matris böyükdür

  const rows: Row[] = [];

  for (const pg of AUDIT_PAGES) {
    // Auth səhifələr üçün storageState, public üçün təmiz kontekst.
    const ctx = await browser.newContext(
      pg.auth ? { storageState: AUTH_FILE } : { storageState: { cookies: [], origins: [] } },
    );
    const page = await ctx.newPage();
    try {
      for (const vp of ALL_VIEWPORTS) {
        await page.setViewportSize({ width: vp.w, height: vp.h });
        try {
          await auditPage(page, pg.url);
          const violations = await collectViolations(page);
          if (violations.length) rows.push({ page: pg.name, w: vp.w, h: vp.h, violations });
        } catch (e: any) {
          rows.push({ page: pg.name, w: vp.w, h: vp.h,
            violations: [{ category: 'overflow-x', detail: 'AUDIT XƏTASI: ' + (e?.message || e), selector: '(naməlum)' }] });
        }
      }
    } finally {
      await ctx.close();
    }
  }

  /* ---------- hesabat ---------- */
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/responsive-audit.json', JSON.stringify(rows, null, 2));

  // Kateqoriya üzrə xülasə.
  const byCat: Record<string, number> = {};
  const byPage: Record<string, number> = {};
  for (const r of rows) for (const v of r.violations) {
    byCat[v.category] = (byCat[v.category] || 0) + 1;
    byPage[r.page] = (byPage[r.page] || 0) + 1;
  }

  const P0 = rows.flatMap(r => r.violations.filter(v =>
    v.category === 'overflow-x' || v.category === 'element-overflow')
    .map(v => ({ ...r, v })));

  const lines: string[] = [
    '# Responsive Audit Hesabatı (TASK-9)',
    '',
    `Tarix: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    `Matris: ${AUDIT_PAGES.length} səhifə × ${ALL_VIEWPORTS.length} ölçü = ${AUDIT_PAGES.length * ALL_VIEWPORTS.length} yoxlama`,
    '',
    '## Xülasə (kateqoriya üzrə)',
    '',
    '| Kateqoriya | Say | Prioritet |',
    '| --- | --- | --- |',
    `| overflow-x (səhifə daşması) | ${byCat['overflow-x'] || 0} | P0 |`,
    `| element-overflow (günahkar element) | ${byCat['element-overflow'] || 0} | P0 |`,
    `| touch-target (<44px) | ${byCat['touch-target'] || 0} | P1 |`,
    `| text-clip (mətn daşması) | ${byCat['text-clip'] || 0} | P2 |`,
    '',
    `**Ümumi pozuntu: ${rows.reduce((s, r) => s + r.violations.length, 0)}**`,
    '',
    '## Səhifə üzrə',
    '',
    '| Səhifə | Pozuntu |',
    '| --- | --- |',
    ...Object.entries(byPage).sort((a, b) => b[1] - a[1]).map(([p, n]) => `| ${p} | ${n} |`),
    '',
    '## P0 — üfüqi daşma (əvvəlcə bunlar)',
    '',
  ];

  if (!P0.length) {
    lines.push('✅ Heç bir üfüqi daşma yoxdur.');
  } else {
    lines.push('| Səhifə | Ölçü | Kateqoriya | Element | Detal |', '| --- | --- | --- | --- | --- |');
    for (const p of P0.slice(0, 100)) {
      lines.push(`| ${p.page} | ${p.w}×${p.h} | ${p.v.category} | \`${p.v.selector}\` | ${p.v.detail} |`);
    }
  }

  lines.push('', '## P1/P2 — touch target & mətn daşması', '');
  const rest = rows.flatMap(r => r.violations
    .filter(v => v.category === 'touch-target' || v.category === 'text-clip')
    .map(v => ({ ...r, v })));
  if (!rest.length) {
    lines.push('✅ Yoxdur.');
  } else {
    lines.push('| Səhifə | Ölçü | Kateqoriya | Element | Detal |', '| --- | --- | --- | --- | --- |');
    for (const p of rest.slice(0, 150)) {
      lines.push(`| ${p.page} | ${p.w}×${p.h} | ${p.v.category} | \`${p.v.selector}\` | ${p.v.detail} |`);
    }
  }

  writeFileSync('test-results/responsive-audit.md', lines.join('\n'));

  // Konsola qısa xülasə — CLI-də dərhal görünsün.
  console.log('\n===== RESPONSIVE AUDIT =====');
  console.log('overflow-x:', byCat['overflow-x'] || 0, '| element-overflow:', byCat['element-overflow'] || 0,
    '| touch:', byCat['touch-target'] || 0, '| text-clip:', byCat['text-clip'] || 0);
  console.log('Hesabat: test-results/responsive-audit.md');
  console.log('============================\n');

  expect(rows).toBeDefined();
});
