// DM avtorizasiyası və onun dayandığı id invariantı — BACKEND AUDIT / BE-007.
//
// ════════════════════════════════════════════════════════════════════════════
// 🔴 NİYƏ BU TEST VAR
// ════════════════════════════════════════════════════════════════════════════
//
// `dmMember()` bazaya sorğu GÖNDƏRMİR — `pairId`-ni `_` ilə parçalayıb çağıranın
// uid-ini axtarır. Bu, şüurlu mübadilədir (D1 Buxarestdədir, hər ardıcıl gediş
// ~50-70 ms), lakin avtorizasiyanı `uuid()`-in FORMATINA bağlayır.
//
// Şərt: uid `_` EHTİVA ETMİR. Bu gün doğrudur — `uuid()` 32 simvolluq hex
// qaytarır. Sabah kimsə uid formatını dəyişsə (prefiks `usr_…`, ULID, e-poçt
// əsaslı id), qapı SƏSSİZCƏ yanlış qərar verməyə başlayar: heç bir tip, lint
// və ya mövcud test bunu tutmaz, çünki funksiya hələ də "işləyir".
//
// Test məhz bu gizli asılılığı GÖRÜNƏN edir: format dəyişəndə burada sınır və
// dəyişikliyi edən adam `dmMember`-i də yenidən düşünməli olur.
import { describe, it, expect } from 'vitest';
import { uuid, pairIdFor } from '../worker/util';
import { dmMember } from '../worker/routes/room';

/** `dmMember` yalnız `c.user.id`-ni oxuyur — qalan Ctx sahələri lazım deyil. */
const asUser = (id: string) => ({ user: { id } }) as any;

describe('🔴 uid format invariantı — `dmMember` buna söykənir', () => {
  it('uuid() `_` EHTİVA ETMİR', () => {
    // 200 nümunə: təsadüfi generatorda nadir simvolu bir çağırışla tutmaq olmaz.
    for (let i = 0; i < 200; i++) {
      expect(uuid()).not.toContain('_');
    }
  });

  it('uuid() dəqiq 32 simvol hex-dir', () => {
    expect(uuid()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('pairIdFor() dəqiq bir ayırıcı qoyur və sıralayır', () => {
    const a = uuid(), b = uuid();
    const pair = pairIdFor(a, b);
    expect(pair.split('_')).toHaveLength(2);
    // Kanonik sıra: hansı tərəfdən çağırılsa da eyni id.
    expect(pairIdFor(b, a)).toBe(pair);
  });
});

describe('dmMember — qapı davranışı', () => {
  const a = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const b = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const c = 'cccccccccccccccccccccccccccccccc';
  const pair = pairIdFor(a, b);

  it('iştirakçı keçir', () => {
    expect(dmMember(asUser(a), pair)).toBe(true);
    expect(dmMember(asUser(b), pair)).toBe(true);
  });

  it('🔴 kənar şəxs keçmir', () => {
    expect(dmMember(asUser(c), pair)).toBe(false);
  });

  it('🔴 normallaşdırılmamış sıra rədd olunur', () => {
    // `b_a` heç vaxt mövcud söhbətə işarə etmir (bütün yazı yolları
    // `pairIdFor` ilə keçir), yəni 403 boş 200-dən dürüstdür.
    expect(dmMember(asUser(a), `${b}_${a}`)).toBe(false);
  });

  it('🔴 iki hissədən fərqli id rədd olunur (fail-closed)', () => {
    expect(dmMember(asUser(a), a)).toBe(false);
    expect(dmMember(asUser(a), `${a}_${b}_${c}`)).toBe(false);
    expect(dmMember(asUser(a), '')).toBe(false);
  });

  it('🔴 hissə uyğunluğu TAMDIR — prefiks kifayət etmir', () => {
    // `includes` element bərabərliyi ilə işləyir; bu test onun `indexOf`
    // kimi alt-sətir axtarışına çevrilməməsini qoruyur.
    expect(dmMember(asUser(a.slice(0, 8)), pair)).toBe(false);
  });
});
