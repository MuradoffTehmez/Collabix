// Unit testlər — komanda RBAC (AUDIT-2026-07-26 / H-1).
//
// AUDIT-TASK-10 / Faza 1.5. Bu modul auditin ƏN KRİTİK saf funksiyalarını
// daşıyır: H-1 istismarı məhz burada bağlanıb və qüsur "üç sorğuluq zəncir"
// idi — yəni tək funksiyaya baxmaqla görünmürdü.
//
// 🔴 NİYƏ MƏHZ BU MODUL BİRİNCİDİR:
// `hasPermission` wildcard-ı QƏBUL EDİR, `sanitizePermissions` isə RƏDD EDİR.
// Bu asimmetriya QƏSDƏNDİR (giriş yolu ≠ qiymətləndirmə yolu) və çox asanlıqla
// "təmizlik" adı ilə pozula bilər — həmin an BÜTÜN Owner-lər öz komandalarından
// kilidlənərdi. Test bu invariantı maşınla təsbit edir.
import { describe, it, expect } from 'vitest';
import {
  TEAM_PERMISSIONS, OWNER_ROLE, DEFAULT_MEMBER_ROLE,
  hasPermission, expandPermissions, findEscalatedPermissions,
  parsePermissions, sanitizePermissions,
} from '../worker/services/team/permissions';

describe('hasPermission — QİYMƏTLƏNDİRMƏ yolu', () => {
  it('wildcard BÜTÜN icazələri verir (Owner invariantı)', () => {
    // 🔴 Bu sətir silinərsə hər komandanın Owner-i kilidlənir.
    for (const p of TEAM_PERMISSIONS) {
      expect(hasPermission(['*'], p), `Owner ${p} daşımalıdır`).toBe(true);
    }
  });

  it('konkret icazə yalnız özünü verir', () => {
    expect(hasPermission(['manage_members'], 'manage_members')).toBe(true);
    expect(hasPermission(['manage_members'], 'manage_team')).toBe(false);
  });

  it('null / undefined / boş dəst → false (fail-closed)', () => {
    expect(hasPermission(null, 'manage_team')).toBe(false);
    expect(hasPermission(undefined, 'manage_team')).toBe(false);
    expect(hasPermission([], 'manage_team')).toBe(false);
  });
});

describe('sanitizePermissions — GİRİŞ yolu (H-1 düzəlişi)', () => {
  it('🔴 wildcard RƏDD edilir — H-1 istismarının özəyi', () => {
    // Əvvəl `if (list.includes('*')) return ['*']` idi: `manage_roles` daşıyan
    // Admin `['*']` ilə rol yaradıb özünü ora keçirməklə Owner səlahiyyətini
    // ələ keçirirdi.
    expect(sanitizePermissions(['*'])).toEqual([]);
    expect(sanitizePermissions(['*', 'manage_members'])).toEqual(['manage_members']);
  });

  it('tanınmayan icazələr atılır (ağ siyahı)', () => {
    expect(sanitizePermissions(['uydurma', 'manage_team'])).toEqual(['manage_team']);
  });

  it('dublikatlar təkləşdirilir', () => {
    expect(sanitizePermissions(['manage_team', 'manage_team'])).toEqual(['manage_team']);
  });

  it('massiv olmayan giriş → boş siyahı', () => {
    expect(sanitizePermissions(null)).toEqual([]);
    expect(sanitizePermissions('manage_team')).toEqual([]);
    expect(sanitizePermissions({ a: 1 })).toEqual([]);
  });

  it('🔴 ASİMMETRİYA invariantı: hasPermission wildcard-ı qəbul edir, sanitize etmir', () => {
    expect(hasPermission(['*'], 'manage_team')).toBe(true);
    expect(sanitizePermissions(['*'])).not.toContain('*');
  });
});

describe('expandPermissions — altçoxluq müqayisəsi üçün', () => {
  it('wildcard tam kataloqa açılır', () => {
    expect(expandPermissions(['*']).sort()).toEqual([...TEAM_PERMISSIONS].sort());
  });

  it('tanınmayanlar süzülür', () => {
    expect(expandPermissions(['manage_team', 'uydurma'])).toEqual(['manage_team']);
  });

  it('boş/null → boş', () => {
    expect(expandPermissions([])).toEqual([]);
    expect(expandPermissions(null)).toEqual([]);
  });
});

describe('findEscalatedPermissions — H-1-in ikinci qatı', () => {
  it('🔴 Owner heç bir icazəni eskalasiya saymır', () => {
    // Owner `['*']` daşıyır; açılmasa Owner HEÇ BİR rol yarada bilməzdi.
    expect(findEscalatedPermissions(['*'], [...TEAM_PERMISSIONS])).toEqual([]);
  });

  it('çağıranda olmayan icazə eskalasiyadır', () => {
    expect(findEscalatedPermissions(['manage_roles'], ['manage_team']))
      .toEqual(['manage_team']);
  });

  it('çağıranda olan icazə eskalasiya deyil', () => {
    expect(findEscalatedPermissions(['manage_roles'], ['manage_roles'])).toEqual([]);
  });

  it('nəticə təkrarsızdır', () => {
    expect(findEscalatedPermissions([], ['manage_team', 'manage_team']))
      .toEqual(['manage_team']);
  });
});

describe('parsePermissions — bazadan oxu', () => {
  it('JSON sətri açılır', () => {
    expect(parsePermissions('["manage_team"]')).toEqual(['manage_team']);
  });

  it('hazır massiv olduğu kimi qalır', () => {
    expect(parsePermissions(['a'])).toEqual(['a']);
  });

  it('bozuk JSON → boş massiv (çökmür)', () => {
    expect(parsePermissions('{bozuk')).toEqual([]);
    expect(parsePermissions(null)).toEqual([]);
  });

  it('⚠ parsePermissions FİLTRLƏMİR — o, bazaya güvənir', () => {
    // Bu, `sanitizePermissions`-dan fərqidir və qəsdəndir: baza dəyəri
    // (Owner `['*']`) olduğu kimi oxunmalıdır.
    expect(parsePermissions('["*"]')).toEqual(['*']);
  });
});

describe('sabitlər', () => {
  it('rol adları dəyişməyib (seed və miqrasiya onlara bağlıdır)', () => {
    expect(OWNER_ROLE).toBe('Owner');
    expect(DEFAULT_MEMBER_ROLE).toBe('Developer');
  });

  it("TEAM_PERMISSIONS wildcard DAŞIMIR — filtrin özü ona güvənir", () => {
    expect(TEAM_PERMISSIONS).not.toContain('*');
  });
});
