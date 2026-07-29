// Unit testlər — rate limit taksonomiyası (H-4/H-3) və XP qaydaları (H-5).
//
// AUDIT-TASK-10 / Faza 1.5.
//
// 🔴 Bu testlər DAVRANIŞI deyil, QƏRARI qoruyur. Task 4 səbətləri iki sinifə
// böldü (təhlükəsizlik / xərc) və Task 9 həmin bölgüyə görə YALNIZ təhlükəsizlik
// sinfini atomik DO-ya köçürdü. `critical` bayrağı bu qərarın maşınla oxunan
// yeganə izidir — kimsə onu dəyişsə, səbət sükutla mexanizm dəyişir.
import { describe, it, expect } from 'vitest';
import { RL, normalizeIp } from '../worker/auth';
import { XP_RULES, XP_DAILY_TOTAL, utcDayStart } from '../worker/xp';

describe('RL taksonomiyası — Task 4 §4.1 / Task 9 Faza A', () => {
  it('🔴 TƏHLÜKƏSİZLİK səbətləri `critical` işarəlidir (→ atomik DO)', () => {
    for (const b of ['auth', 'refresh', 'upload'] as const) {
      expect(RL[b].critical, `${b} təhlükəsizlik kontroludur`).toBe(true);
    }
  });

  it('🔴 XƏRC qoruyucuları `critical` DEYİL (→ KV-də qalır, qəsdən)', () => {
    for (const b of ['read', 'write', 'ai', 'presence', 'admin', 'heavy', 'asset', 'archive', 'form', 'search'] as const) {
      expect(RL[b].critical, `${b} xərc qoruyucusudur`).toBe(false);
    }
  });

  it('login/qeydiyyat açarı IP üzrədir — orada uid HƏLƏ məlum deyil', () => {
    expect(RL.auth.key).toBe('ip');
    expect(RL.refresh.key).toBe('ip');
    expect(RL.form.key).toBe('ip');
  });

  it('qalan səbətlər uid üzrə açarlanır (NAT arxasındakılar bir-birini bloklamasın)', () => {
    for (const b of ['read', 'write', 'ai', 'presence', 'admin', 'heavy', 'asset', 'archive', 'upload', 'search'] as const) {
      expect(RL[b].key, `${b}`).toBe('auto');
    }
  });

  it('🔴 AI səbəti saatda 20 — REAL PUL qoruyucusu', () => {
    expect(RL.ai.limit).toBe(20);
    expect(RL.ai.windowSec).toBe(3600);
  });

  it('presence limiti normal polling tezliyini KƏSMİR', () => {
    // Heartbeat POST 30 s + izləmə GET 30 s = pəncərədə 20 sorğu (Task 4 ölçməsi).
    const pollsPerWindow = (RL.presence.windowSec / 30) * 2;
    expect(RL.presence.limit).toBeGreaterThanOrEqual(pollsPerWindow * 5);
  });

  it('hər səbətin limiti və pəncərəsi müsbətdir (konfiq sağlamlığı)', () => {
    for (const [name, cfg] of Object.entries(RL)) {
      expect(cfg.limit, name).toBeGreaterThan(0);
      expect(cfg.windowSec, name).toBeGreaterThan(0);
    }
  });
});

describe('normalizeIp — IPv6 /64 qruplaşdırması', () => {
  it('IPv4 olduğu kimi qalır', () => {
    expect(normalizeIp('192.0.2.10')).toBe('192.0.2.10');
  });

  it('🔴 IPv6 /64 prefiksinə endirilir', () => {
    // Bir istifadəçiyə /64 daxilində milyonlarla ünvan düşür; tam ünvan üzrə
    // açarlamaq limiti mənasızlaşdırır (hücumçu hər sorğuda ünvan dəyişir).
    const a = normalizeIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd');
    const b = normalizeIp('2001:db8:1:2:1111:2222:3333:4444');
    expect(a).toBe(b);
    expect(a).toContain('::/64');
  });

  it('qısaldılmış (::) forma da eyni prefiksə düşür', () => {
    expect(normalizeIp('2001:db8:1:2::1')).toBe(normalizeIp('2001:db8:1:2:0:0:0:99'));
  });

  it('boş dəyər → "unknown" (fail-safe açar)', () => {
    expect(normalizeIp('')).toBe('unknown');
  });

  it('böyük hərflər normallaşır', () => {
    expect(normalizeIp('2001:DB8:1:2::1')).toBe(normalizeIp('2001:db8:1:2::1'));
  });
});

describe('XP qaydaları — H-5 (Task 9 Faza B)', () => {
  it('tavanlı mənbələr: post və comment', () => {
    expect(XP_RULES.post.daily).toBe(100);
    expect(XP_RULES.comment.daily).toBe(100);
  });

  it('🔴 imtiyazlı təsdiq tələb edən mənbələr TAVANSIZDIR', () => {
    // Tavan qoysaydıq, çoxlu həll təsdiqləyən admin qanuni istifadəçiləri
    // XP-siz qoyardı — sui-istifadə modeli orada tamam başqadır.
    expect(XP_RULES.solution.daily).toBeNull();
    expect(XP_RULES.team_task.daily).toBeNull();
    expect(XP_RULES.admin.daily).toBeNull();
  });

  it('kompensasiya tavana daxil deyil — dövrəni bərpa etməməlidir', () => {
    expect(XP_RULES.compensation.daily).toBeNull();
  });

  it('ümumi gündəlik tavan mənbə tavanlarından böyükdür (son müdafiə xətti)', () => {
    const capped = Object.values(XP_RULES)
      .map(r => r.daily).filter((d): d is number => d !== null);
    expect(capped.length).toBeGreaterThan(0);
    expect(XP_DAILY_TOTAL).toBeGreaterThanOrEqual(Math.max(...capped));
  });

  it('hər mənbə üçün qayda mövcuddur (yeni mənbə sükutla tavansız qalmasın)', () => {
    for (const src of ['post', 'comment', 'solution', 'team_task',
      'profile_bonus', 'admin', 'compensation'] as const) {
      expect(XP_RULES[src], src).toBeDefined();
    }
  });
});

describe('utcDayStart — gün sərhədi', () => {
  it('UTC gecə yarısına yuvarlaqlaşdırır', () => {
    const ts = Date.UTC(2026, 6, 29, 13, 45, 30);
    expect(utcDayStart(ts)).toBe(Date.UTC(2026, 6, 29, 0, 0, 0));
  });

  it('eyni gün daxilində sabit qalır (tavan pəncərəsi sürüşməsin)', () => {
    const morning = Date.UTC(2026, 6, 29, 0, 0, 1);
    const evening = Date.UTC(2026, 6, 29, 23, 59, 59);
    expect(utcDayStart(morning)).toBe(utcDayStart(evening));
  });

  it('🔴 gün dəyişəndə sərhəd irəliləyir', () => {
    const d1 = utcDayStart(Date.UTC(2026, 6, 29, 23, 59, 59));
    const d2 = utcDayStart(Date.UTC(2026, 6, 30, 0, 0, 0));
    expect(d2 - d1).toBe(86_400_000);
  });
});
