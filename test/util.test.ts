// Unit testlər — saf köməkçilər (AUDIT-TASK-10 / Faza 1.5).
//
// Bu funksiyalar audit tapıntılarının ÖZƏYİNDƏDİR:
//   `chunkForD1`  → D-1 (D1 100 parametr limiti, Task 9)
//   `clampStr`    → M-5 (storage DoS)
//   `extractMentions` + `chunkForD1` → notifyMentions çökməsi
//   `searchNormalize` / `likePattern` → axtarış inyeksiyası
import { describe, it, expect } from 'vitest';
import {
  D1_MAX_VARS, chunkForD1, placeholders,
  clampStr, normalizeUsername, validUsername,
  extractMentions, pairIdFor, toJSON, fromJSON, likePattern,
} from '../worker/util';

describe('chunkForD1 — D1 dəyişən limiti (AUDIT-9 / D-1)', () => {
  it('limit sənədlə uyğundur', () => {
    // developers.cloudflare.com/d1/platform/limits → 100 bound parameters.
    expect(D1_MAX_VARS).toBe(100);
  });

  it('limitin altındakı siyahı bölünmür', () => {
    expect(chunkForD1(Array.from({ length: 50 }, (_, i) => i))).toHaveLength(1);
  });

  it('🔴 limitin ÜSTÜNDƏKİ siyahı bölünür', () => {
    // Task 8 §9/2 dərsi: test datası limitin ÜSTÜNDƏ olmalıdır.
    const chunks = chunkForD1(Array.from({ length: 150 }, (_, i) => i));
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[1]).toHaveLength(50);
  });

  it('`reserved` əlavə bağlanan parametrləri nəzərə alır', () => {
    // `WHERE user_id = ? AND id IN (...)` → reserved: 1.
    // Olmasa hissə tam 100 olanda ümumi say 101-ə çatıb sorğunu çökdürərdi.
    const chunks = chunkForD1(Array.from({ length: 100 }, (_, i) => i), 1);
    expect(chunks[0]).toHaveLength(99);
    for (const c of chunks) expect(c.length + 1).toBeLessThanOrEqual(D1_MAX_VARS);
  });

  it('HEÇ BİR hissə limiti aşmır — sərhədsiz girişdə də', () => {
    for (const n of [1, 99, 100, 101, 1000, 5000]) {
      for (const c of chunkForD1(Array.from({ length: n }, (_, i) => i))) {
        expect(c.length).toBeLessThanOrEqual(D1_MAX_VARS);
      }
    }
  });

  it('boş siyahı → boş nəticə (çağıran `IN ()` qurmamalıdır)', () => {
    expect(chunkForD1([])).toEqual([]);
  });

  it('`reserved` limitə bərabər olsa da ən azı 1 element qalır (sonsuz döngü olmasın)', () => {
    expect(chunkForD1([1, 2, 3], D1_MAX_VARS)[0]).toHaveLength(1);
  });
});

describe('placeholders', () => {
  it('düzgün sayda yer tutucu qurur', () => {
    expect(placeholders(1)).toBe('?');
    expect(placeholders(3)).toBe('?,?,?');
  });
  it('0 → boş sətir', () => {
    expect(placeholders(0)).toBe('');
  });
});

describe('clampStr — M-5 storage DoS qapısı', () => {
  it('limitdən uzun mətn kəsilir', () => {
    expect(clampStr('abcdef', 3)).toBe('abc');
  });
  it('null/undefined boş sətrə çevrilir (çökmür)', () => {
    expect(clampStr(null, 5)).toBe('');
    expect(clampStr(undefined, 5)).toBe('');
  });
  it('rəqəm sətrə çevrilir', () => {
    expect(clampStr(12345, 3)).toBe('123');
  });
});

describe('normalizeUsername / validUsername', () => {
  it('böyük hərf və boşluq təmizlənir', () => {
    expect(normalizeUsername('  TeStUser  ')).toBe('testuser');
  });
  it('qaydaya uyğun ad qəbul olunur', () => {
    expect(validUsername('test.user_1')).toBe(true);
  });
  it('çox qısa / çox uzun / qadağan simvol rədd olunur', () => {
    expect(validUsername('ab')).toBe(false);
    expect(validUsername('a'.repeat(21))).toBe(false);
    expect(validUsername('Test')).toBe(false);      // böyük hərf
    expect(validUsername('test user')).toBe(false); // boşluq
    expect(validUsername('test-user')).toBe(false); // tire
  });
});

describe('extractMentions — notifyMentions girişi', () => {
  it('@qeydləri çıxarır və təkləşdirir', () => {
    expect(extractMentions('salam @ali və @vali və yenə @ali')).toEqual(['ali', 'vali']);
  });
  it('qeyd yoxdursa boş massiv', () => {
    expect(extractMentions('mətn')).toEqual([]);
  });
  it('🔴 çox sayda qeyd D1 limitini aşır — hissələmə MƏCBURİDİR', () => {
    // Bu, `notifyMentions`-dakı D-1 düzəlişinin əsaslandırmasıdır.
    const text = Array.from({ length: 150 }, (_, i) => `@user${i}`).join(' ');
    const names = extractMentions(text);
    expect(names.length).toBeGreaterThan(D1_MAX_VARS);
    for (const c of chunkForD1(names)) expect(c.length).toBeLessThanOrEqual(D1_MAX_VARS);
  });
});

describe('pairIdFor — DM cütü', () => {
  it('sıradan ASILI DEYİL (eyni söhbət, eyni açar)', () => {
    expect(pairIdFor('b', 'a')).toBe(pairIdFor('a', 'b'));
  });
});

describe('toJSON / fromJSON — fail-safe serializasiya', () => {
  it('bozuk JSON fallback qaytarır, çökmür', () => {
    expect(fromJSON('{bozuk', { a: 1 })).toEqual({ a: 1 });
    expect(fromJSON(null, [])).toEqual([]);
    expect(fromJSON(undefined, 'x')).toBe('x');
  });
  it('düzgün JSON açılır', () => {
    expect(fromJSON('[1,2]', [])).toEqual([1, 2]);
  });
  it('toJSON dövrəvi obyektdə fallback verir', () => {
    const cyclic: any = {}; cyclic.self = cyclic;
    expect(toJSON(cyclic, '[]')).toBe('[]');
  });
});

describe('likePattern — LIKE wildcard qaçırılması', () => {
  it('istifadəçi girişindəki % və _ hərfi mənada işlənir', () => {
    // Qaçırılmasa `%` bütün sətirləri qaytarardı (axtarış səthi).
    const p = likePattern('50%_a');
    expect(p).toContain('\\%');
    expect(p).toContain('\\_');
  });
});
