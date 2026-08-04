// E2E seed-inin ayrıca girişi — AUDIT-TASK-5 §5.4/4.
//
//   npm run e2e:seed
//
// Playwright-dən ASILI DEYİL: lokal bazanı sıfırladıqdan sonra dəsti işə
// salmadan da test datasını bərpa etmək üçün. `seedTestUsers` idempotentdir
// (hər ifadə `INSERT OR IGNORE`), ona görə istənilən vaxt təkrar işlədilə bilər.
//
// ⚠ `wrangler dev` İŞLƏK OLMALIDIR: istifadəçilər real `/api/auth/register`
// endpoint-i ilə yaradılır — parol heşi məntiqi burada təkrarlanmır.
import { seedTestUsers } from './seed.ts';

const base = process.argv[2] || process.env.E2E_BASE_URL || 'http://127.0.0.1:8788';

try {
  await fetch(base + '/api/config');
} catch {
  console.error(`✗ Server cavab vermir: ${base}\n  → əvvəlcə: npm run dev`);
  process.exit(1);
}

await seedTestUsers(base);
console.log(`✓ E2E seed tətbiq olundu (${base}) — idempotent, təkrar icra zərərsizdir`);
