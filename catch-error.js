import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => {
    console.log('BROWSER_CONSOLE:', msg.text());
  });
  page.on('response', resp => {
    if (resp.status() >= 400) console.log('HTTP_ERROR:', resp.status(), resp.url());
  });
  await page.route('**/api/auth/me', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 1, handle: 'admin', settings: { lang: 'az' } },
        isAdmin: true
      })
    });
  });

  await page.goto('https://collabix.muradofftehmez01.workers.dev/', { waitUntil: 'networkidle' });
  
  // Səhifə app-a keçməlidir çünki biz login olduq (mock).
  // Bir az gözləyək ki, render olunsun.
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'live-loggedin-screenshot.png' });
  
  const classes = await page.evaluate(() => {
    return {
      app: document.getElementById('app')?.className || '',
      landing: document.getElementById('landing')?.className || '',
      publicLayer: document.getElementById('publicLayer')?.className || '',
      body: document.body.className || ''
    }
  });
  console.log("CLASSES:", classes);
  await browser.close();
})();
