import { test, expect, type Page } from '@playwright/test';
import { AUTH_FILE } from './seed';
import { collectViolations, AUDIT_PAGES } from './audit-lib';

// TASK-9 — DAİMİ responsive sınaq testi (reqressiya toru).
//
// `responsive-report.spec.ts` (hesabat generatoru) xətaları TOPLAYIR; bu isə
// P0/P1 pozuntularda FAIL edir. Gələcək dəyişiklik responsive-i sındırsa
// dərhal qırmızı olur.
//
// Ağıllı matris: ədədi yoxlamalar hər ölçüdə çox bahalıdır, ona görə burada
// TƏMSİLÇİ ölçülər seçilir — ən dar mobil (360), tipik mobil (390), tablet
// portret (768), tablet landşaft (1024). Tam 13-ölçü sırağı `npm run
// audit:responsive` hesabatındadır.
const CHECK_VIEWPORTS = [
  { w: 360, h: 800, label: 'mobil-dar' },
  { w: 390, h: 844, label: 'mobil' },
  { w: 768, h: 1024, label: 'tablet-portret' },
  { w: 1024, h: 768, label: 'tablet-landşaft' },
];

// Reprezentativ səhifələr (hər kateqoriyadan) — tam siyahı audit hesabatındadır.
const CHECK_PAGES = AUDIT_PAGES.filter(p =>
  ['welcome', 'about', 'contact', 'home', 'chat', 'dm', 'users', 'tasks', 'profil', 'settings', 'admin',
   'teams', 'team'].includes(p.name));

async function open(page: Page, url: string) {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
}

test.describe('Responsive audit (TASK-9)', () => {
  // Yalnız desktop layihəsi — test öz viewport-unu dəyişir, iki dəfə lazım deyil.
  test.beforeEach(({ }, info) => {
    test.skip(info.project.name !== 'desktop', 'Audit viewport-u özü idarə edir');
  });

  for (const pg of CHECK_PAGES) {
    test(`${pg.name} — bütün ölçülərdə responsive`, async ({ browser }) => {
      const ctx = await browser.newContext(
        pg.auth ? { storageState: AUTH_FILE } : { storageState: { cookies: [], origins: [] } },
      );
      const page = await ctx.newPage();
      const problems: string[] = [];
      try {
        for (const vp of CHECK_VIEWPORTS) {
          await page.setViewportSize({ width: vp.w, height: vp.h });
          await open(page, pg.url);
          const v = await collectViolations(page);
          // P0 (üfüqi daşma) və touch/text-clip — hamısı fail.
          for (const item of v) {
            problems.push(`[${vp.label} ${vp.w}px] ${item.category}: ${item.selector} (${item.detail})`);
          }
        }
      } finally {
        await ctx.close();
      }
      expect(problems, `${pg.name} responsive pozuntuları:\n` + problems.join('\n')).toEqual([]);
    });
  }
});
