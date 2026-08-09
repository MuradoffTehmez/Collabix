// i18n dil paketlərinin bütövlüyü (2026-08-09 perf fazası).
//
// 🔴 NİYƏ TEST LAZIMDIR: lüğət əvvəl TƏK obyekt idi —
//   `'key': { az: …, en: …, ru: … }` — və bir dili unutmaq gözlə görünürdü.
//   İndi üç AYRI fayl var; birinə açar əlavə edib digərini unutmaq mümkündür və
//   qüsur TAMAMİLƏ SƏSSİZDİR: `t()` çatışmayan açarda AZ-a düşür, yəni EN/RU
//   istifadəçisi sadəcə azərbaycanca mətn görür. Nə xəta, nə konsol yazısı.
//
// ⚠ AZ ETALON DƏSTDİR: o həm default dil, həm də geri düşmə mənbəyidir, ona
//   görə hər iki digər paket onunla TAM üst-üstə düşməlidir (nə çatışmazlıq,
//   nə artıq açar).
import { describe, it, expect } from 'vitest';
import AZ from '../js/i18n.dict.az.js';
import EN from '../js/i18n.dict.en.js';
import RU from '../js/i18n.dict.ru.js';

const PACKS: Record<string, Record<string, string>> = { az: AZ, en: EN, ru: RU };

describe('i18n dil paketləri', () => {
  it('AZ paketi boş deyil', () => {
    expect(Object.keys(AZ).length).toBeGreaterThan(1000);
  });

  for (const lang of ['en', 'ru']) {
    it(`${lang}: AZ-da olan HƏR açar var (çatışmayan açar səssizcə AZ görünər)`, () => {
      const missing = Object.keys(AZ).filter(k => !(k in PACKS[lang]));
      expect(missing, `${lang} paketində çatışmayan açarlar`).toEqual([]);
    });

    it(`${lang}: AZ-da OLMAYAN açar yoxdur (ölü tərcümə)`, () => {
      const extra = Object.keys(PACKS[lang]).filter(k => !(k in AZ));
      expect(extra, `${lang} paketindəki artıq açarlar`).toEqual([]);
    });
  }

  it('heç bir paketdə boş və ya sətir olmayan dəyər yoxdur', () => {
    const bad: string[] = [];
    for (const [lang, pack] of Object.entries(PACKS)) {
      for (const [k, v] of Object.entries(pack)) {
        if (typeof v !== 'string' || v === '') bad.push(`${lang}:${k}`);
      }
    }
    expect(bad).toEqual([]);
  });

  // ⚠ Açar sırası da eynidir: paketlər eyni mənbədən generasiya olunub və
  //   sıranı saxlamaq diff-i oxunaqlı edir. Sıra pozulsa bu, ƏL İLƏ edilmiş
  //   redaktənin yanlış bölməyə düşdüyünün siqnalıdır.
  it('açar sırası üç paketdə eynidir', () => {
    const azKeys = Object.keys(AZ);
    expect(Object.keys(EN)).toEqual(azKeys);
    expect(Object.keys(RU)).toEqual(azKeys);
  });
});
