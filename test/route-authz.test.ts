// Marşrut cədvəlində avtorizasiya bəyanının bütövlüyü — BACKEND AUDIT / BE-002.
//
// ════════════════════════════════════════════════════════════════════════════
// 🔴 NİYƏ BU TEST VAR
// ════════════════════════════════════════════════════════════════════════════
//
// Auditin tapıntısı: 273 marşrutdan yalnız 60-ında deklarativ `perm:` var idi;
// qalan 213 `auth: true` marşrutunda avtorizasiya handler-in İÇİNDƏ idi.
// İzlənən 18 handler-in hamısı düzgün qapı işlədirdi — yəni tapıntı mövcud
// kodda deyil, MODELDƏ idi: model unutmağa qarşı deyildi.
//
// `worker/index.ts`-dəki tip birləşməsi artıq sahənin YAZILMASINI məcbur edir
// (`tsc` sınır). Bu test isə yazılanın DOĞRU olmasını yoxlayır — yəni nişanın
// rezin möhürə çevrilməsinin qarşısını alır. İkisi ayrı qatdır:
//
//   tip → "bəyan var?"        (kompilyasiya vaxtı)
//   test → "bəyan düzgündür?" (mənbə mətnindən oxunur)
//
// ⚠ Test marşrut cədvəlini MƏNBƏDƏN oxuyur, ikinci siyahı saxlamır — əks halda
//   o siyahı köhnələr və test yalançı yaşıl verərdi.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(root, 'worker/index.ts'), 'utf8');

const MUTATION = ['POST', 'PUT', 'PATCH', 'DELETE'];

interface RouteLine {
  line: number;
  method: string;
  pattern: string;
  auth: boolean;
  perm: string | null;
  own: string | null;
}

/** Marşrut cədvəlinin sətirləri — şərhdəki nümunələr sayılmır. */
function routes(): RouteLine[] {
  const out: RouteLine[] = [];
  SRC.split('\n').forEach((l, i) => {
    if (!l.includes('pattern:') || !l.includes('method:')) return;
    if (l.trimStart().startsWith('*') || l.trimStart().startsWith('//')) return;
    out.push({
      line: i + 1,
      method: (l.match(/method:\s*'(\w+)'/) || [])[1] || '?',
      pattern: (l.match(/pattern:\s*(\/\^.*?\/),\s*handler:/) || [])[1] || '?',
      auth: /\bauth:\s*true/.test(l),
      perm: (l.match(/perm:\s*'([A-Z_]+)'/) || [])[1] || null,
      own: (l.match(/own:\s*'(\w+)'/) || [])[1] || null,
    });
  });
  return out;
}

const mutations = () => routes().filter(r => MUTATION.includes(r.method));

/**
 * QƏSDƏN AUTH-SUZ MUTASİYALAR.
 *
 * ⚠ BU SİYAHI TESTİN ƏSAS DƏYƏRİDİR. Yeni publik mutasiya marşrutu əlavə etmək
 *   üçün developer bu faylı da dəyişməlidir — yəni "auth yazmağı unutdum"
 *   halı yaşıl testdən KEÇMİR. Siyahıya əlavə etmək şüurlu qərardır.
 *
 * Hər birinin niyəsi: hesab hələ mövcud olmadığı (register), sessiya hələ
 * qurulmadığı (login, mfa, magic-link, password-reset) və ya çıxış/yeniləmə
 * cookie ilə işlədiyi (logout, refresh) üçün auth TƏLƏB EDİLƏ BİLMƏZ.
 * Newsletter və contact isə saytın publik formalarıdır — orada qoruma
 * rate-limit + Turnstile-dır, sessiya deyil.
 */
const EXPECTED_PUBLIC_MUTATIONS = [
  String.raw`/^\/api\/auth\/register$/`,
  String.raw`/^\/api\/auth\/login$/`,
  String.raw`/^\/api\/auth\/logout$/`,
  String.raw`/^\/api\/auth\/refresh$/`,
  String.raw`/^\/api\/auth\/mfa$/`,
  String.raw`/^\/api\/auth\/magic-link$/`,
  String.raw`/^\/api\/auth\/password-reset$/`,
  String.raw`/^\/api\/auth\/password-reset\/confirm$/`,
  String.raw`/^\/api\/public\/newsletter$/`,
  String.raw`/^\/api\/public\/contact$/`,
].sort();

describe('marşrut avtorizasiya bəyanı — BE-002', () => {
  it('🔴 HƏR mutasiya marşrutunda `perm` və ya `own` var', () => {
    // `tsc` bunu onsuz da tutur; test `as any` / `@ts-expect-error` ilə
    // yan keçilmə halı üçün ikinci qatdır.
    const bare = mutations()
      .filter(r => !r.perm && !r.own)
      .map(r => `${r.line}: ${r.method} ${r.pattern}`);
    expect(bare, 'avtorizasiya bəyanı olmayan mutasiya(lar)').toEqual([]);
  });

  it("🔴 `own: 'public'` YALNIZ auth-suz marşrutlarda", () => {
    // Ziddiyyət: marşrut "publikdir" deyir, amma giriş tələb edir. Bu, bəyanın
    // koddan qopduğunun ilk əlamətidir.
    const lying = mutations()
      .filter(r => r.own === 'public' && r.auth)
      .map(r => `${r.line}: ${r.pattern}`);
    expect(lying, "`own: 'public'` + `auth: true` bir yerdə ola bilməz").toEqual([]);
  });

  it("🔴 `own: 'handler'` marşrutu MÜTLƏQ `auth: true` daşıyır", () => {
    // Əks hal daha təhlükəlidir: "yoxlama handler-dədir" deyilir, halbuki
    // handler-ə çatan istifadəçi ümumiyyətlə tanınmır (`c.user` boşdur).
    const unauthenticated = mutations()
      .filter(r => r.own === 'handler' && !r.auth)
      .map(r => `${r.line}: ${r.pattern}`);
    expect(unauthenticated, "`own: 'handler'` auth-suz marşrutda mənasızdır").toEqual([]);
  });

  it('🔴 auth-suz mutasiyaların siyahısı SABİTDİR (yeni publik marşrut nəzərdən keçirilməlidir)', () => {
    const actual = mutations().filter(r => !r.auth).map(r => r.pattern).sort();
    expect(actual).toEqual(EXPECTED_PUBLIC_MUTATIONS);
  });

  it('`own` yalnız bilinən dəyərləri alır', () => {
    const bad = routes()
      .filter(r => r.own && r.own !== 'handler' && r.own !== 'public')
      .map(r => `${r.line}: own='${r.own}'`);
    expect(bad).toEqual([]);
  });

  it('oxu marşrutlarına `own` yazılmır (sahə yalnız mutasiyalar üçündür)', () => {
    const stray = routes()
      .filter(r => !MUTATION.includes(r.method) && r.own)
      .map(r => `${r.line}: ${r.method} ${r.pattern}`);
    expect(stray, 'GET/HEAD marşrutunda `own` — sahə səhv başa düşülüb').toEqual([]);
  });

  it('reqressiya: bəyan edilmiş mutasiya sayı azalmır', () => {
    // Kimsə `own`-ı kütləvi silsə say düşər və bu test onu tutar.
    expect(mutations().length).toBeGreaterThanOrEqual(176);
  });
});
