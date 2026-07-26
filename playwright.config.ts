import { defineConfig, devices } from '@playwright/test';

// E2E: real Worker (wrangler dev) üzərində — dist/ + D1/KV/R2 lokal state ilə.
// Məqsəd tam funksional əhatə deyil, TASK-6 UI bəndlərinin smoke doğrulaması
// + "sıfır konsol xətası" şərtinin maşınla yoxlanması.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,       // tək wrangler dev instansı paylaşılır
  workers: 1,
  reporter: [['list']],
  // Test hesablarını hazırlayır + bir dəfə giriş edib sessiyanı saxlayır
  // (auth rate-limit-i: 5 dəq / 10 sorğu).
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:8788',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // İki var override-ı — hər ikisi YALNIZ test mühitinə aiddir:
    //
    // 1. `ENVIRONMENT:test` — rate-limit çarpanını açır (worker/auth.ts `rlFactor`).
    //    Dəst tək IP-dən onlarla giriş edir (çox hesab, paralel kontekstlər, uğursuz
    //    giriş ssenariləri) və prod limiti ilə öz-özünü bloklayır. Prod-da bu çarpan
    //    heç vaxt tətbiq olunmur — ENVIRONMENT orada 'production'-dır.
    //
    // 2. Turnstile — Cloudflare-in RƏSMİ test açar CÜTÜ (site + secret, hər ikisi
    //    "həmişə keçir"). İkisi də override olunmalıdır: `.dev.vars`-dakı əsl
    //    secret test site key-i ilə CÜTLƏŞMİR və hər doğrulama sınardı.
    //    Real site key isə domenə bağlıdır — `127.0.0.1`-də Turnstile xəta verib
    //    konsolu çirkləndirər və "sıfır konsol xətası" şərtini yalançı pozardı.
    //    Bu cütlə server doğrulaması ƏSL kod yolundan keçir (siteverify çağırılır),
    //    sadəcə nəticə deterministik olur.
    command: 'npm run build && npx wrangler dev --port 8788 --persist-to .wrangler/state'
      + ' --var ENVIRONMENT:test'
      + ' --var TURNSTILE_SITE_KEY:1x00000000000000000000BB'
      + ' --var TURNSTILE_SECRET:1x0000000000000000000000000000000AA'
      // 3. `ARCHIVE_HOT_DAYS:90` — İSTEHSAL dəyəri müvəqqəti olaraq "3650"-dir
      //    (AUDIT-TASK-1 / C-3: arxiv OXU yolu qurulmayıb, ona görə D1-dən
      //    silmə dayandırılıb). Amma arxivləmə KODU özü düzgündür və
      //    `archive.spec.ts` onu 200 gün əvvəlki mesajlarla yoxlayır —
      //    3650 günlük pəncərədə heç nə arxivlənmir və test səbəbsiz sınır.
      //    Burada 90 qoymaqla İKİ tələb birlikdə ödənilir: istehsalda silmə
      //    dayanır, testdə isə D1→R2 invariantı ("mesaj YALNIZ R2-yə
      //    yazıldıqdan sonra silinir") sınanmağa davam edir.
      //    AUDIT-TASK-8 bitib istehsal "90"-a qaytarıldıqda bu override
      //    artıq lazımsız olacaq, lakin zərərsizdir.
      + ' --var ARCHIVE_HOT_DAYS:90'
      // Cron handler-ini `GET /__scheduled` kimi açır. Arxiv işi D1-dən mesaj
      // SİLİR — canlıda gecə-gecə işlədiyi üçün testsiz buraxıla bilməz.
      + ' --test-scheduled',
    url: 'http://127.0.0.1:8788',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
