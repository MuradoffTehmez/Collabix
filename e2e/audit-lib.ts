// Responsive audit kitabxanası — TASK-9 / FAZA 1, AUDIT-RESP-12-də yenidən qurulub.
//
// Detection-first: bütün ölçmələr BROWSER kontekstində aparılır (page.evaluate).
//
// ⚠ 2026-08-05 KÖK DÜZƏLİŞİ — ÖLÜ DETEKTORLAR:
//   Əvvəlki versiyada 6 yoxlama elementləri INLINE STYLE ATRİBUTU ilə sorğulayırdı:
//     document.querySelectorAll('[style*="display: flex"]')
//     document.querySelectorAll('[style*="position: fixed"]')
//     document.querySelectorAll('[style*="overflow-x: auto"]')  və s.
//   Bu kod bazasında layout YALNIZ siniflərlə qurulur, üstəlik CSP inline `style=`
//   atributunu bloklayır (bax `csp-blocks-inline-style-attributes` qeydi).
//   Nəticə: flex-wrap, grid-wrap, fixed-sticky-collision, horizontal-scroll-container
//   və safe-area yoxlamaları HEÇ VAXT bir dənə də element tapmayıb — audit "təmiz"
//   görünürdü, çünki heç nəyə baxmırdı.
//   İndi hamısı getComputedStyle üzərindən TƏK KEÇİDLİ snapshot ilə işləyir.
import type { Page, Browser } from '@playwright/test';
import { E2E_TEAM } from './fixtures';
import { AUTH_FILE } from './seed';
import * as fs from 'fs';
import * as path from 'path';

// ─── Pozuntu tipi ─────────────────────────────────────────────────────────────
export interface Violation {
  category:
  | 'overflow-x'
  | 'element-overflow'
  | 'touch-target'
  | 'text-clip'
  | 'layout-overlap'
  | 'flex-wrap'
  | 'grid-wrap'
  | 'fixed-sticky-collision'
  | 'horizontal-scroll-container'
  | 'media-overflow'
  | 'media-aspect'
  | 'table-overflow'
  | 'modal-responsive'
  | 'sidebar-collapse'
  | 'navbar-collapse'
  | 'cls'
  | 'safe-area'
  | 'accessibility';
  detail: string;
  selector: string;          // qısa seçici (göstərmək üçün)
  domPath?: string;          // tam DOM yolu
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
  cssCause?: string;         // təxmini səbəb (CSS xassələri)
  recommendation?: string;   // düzəliş tövsiyəsi
}

export interface AuditResult {
  page: string;
  theme: string;
  viewport: { w: number; h: number; label?: string };
  violations: Violation[];
  score: number;             // 0-100
  summary: {
    total: number;
    byPriority: { P0: number; P1: number; P2: number; P3: number };
    byCategory: Record<string, number>;
  };
}

// ─── Əsas yoxlama funksiyası ──────────────────────────────────────────────────
export async function collectViolations(page: Page): Promise<Violation[]> {
  return page.evaluate(() => {
    const out: Violation[] = [];
    const de = document.documentElement;

    // ⚠ innerWidth DEYİL: o, şaquli scrollbar-ı da sayır və hər elementi
    //   15px "daşan" kimi göstərib yalançı pozuntu seli yaradır.
    const vw = de.clientWidth;
    const vh = de.clientHeight;

    const CAP = 10;                      // kateqoriya başına maksimum qeyd
    const counts: Record<string, number> = {};

    // ═══════════ Köməkçilər ═══════════

    const PRIORITY: Record<string, 'P0' | 'P1' | 'P2' | 'P3'> = {
      'overflow-x': 'P0',
      'element-overflow': 'P0',
      'cls': 'P0',
      'text-clip': 'P1',
      'touch-target': 'P1',
      'layout-overlap': 'P1',
      'fixed-sticky-collision': 'P1',
      'modal-responsive': 'P1',
      'media-overflow': 'P1',
      'table-overflow': 'P1',
      'accessibility': 'P1',
      'flex-wrap': 'P2',
      'grid-wrap': 'P2',
      'horizontal-scroll-container': 'P2',
      'media-aspect': 'P2',
      'sidebar-collapse': 'P2',
      'navbar-collapse': 'P2',
      'safe-area': 'P2',
    };

    const RECS: Record<string, string> = {
      'overflow-x': 'Səhifə üfüqi sürüşür. Daşan elementi tapıb min-width/en məhdudiyyətini düzəldin (overflow:hidden ilə ÖRTMƏYİN).',
      'element-overflow': 'Element viewport-dan kənara çıxır. min-width:0 + max-width:100% + box-sizing:border-box tətbiq edin.',
      // ⚠ Dəqiqlik: WCAG 2.2 AA (SC 2.5.8) hədd 24×24-dür; 44×44 AAA-dır (SC 2.5.5).
      //   Layihə tələbi 44×44-dür (AA-dan sərt), ona görə hədd 44 saxlanılır.
      'touch-target': 'Toxunma hədəfi 44×44 px-dən kiçikdir (layihə tələbi; WCAG 2.2 SC 2.5.5 AAA — AA həddi 24×24-dür).',
      'text-clip': 'Mətn səssizcə kəsilir (overflow:hidden, ellipsis YOXDUR). word-break/overflow-wrap və ya min-width:0 əlavə edin.',
      'layout-overlap': 'Mətn daşıyan elementlər üst-üstə düşür.',
      'flex-wrap': 'nowrap flex uşaqları konteynerə sığmır. flex-wrap:wrap və ya min-width:0 lazımdır.',
      'grid-wrap': 'Grid treki konteynerdən geniş. auto-fit + minmax() istifadə edin.',
      'fixed-sticky-collision': 'Fixed/sticky element viewport-dan kənarda və ya digəri ilə toqquşur.',
      'horizontal-scroll-container': 'Qeyri-intentional üfüqi scroll konteyneri.',
      'media-overflow': 'Media konteynerindən daşır. max-width:100%; height:auto tətbiq edin.',
      'media-aspect': 'Şəkil aspekt nisbətini pozur (dartılıb). object-fit:cover/contain istifadə edin.',
      'table-overflow': 'Cədvəl sürüşdürülə bilən sarğı olmadan daşır. overflow-x:auto olan konteynerə sarın.',
      'modal-responsive': 'Modal/panel viewport-dan böyükdür. max-height:100dvh + overflow-y:auto lazımdır.',
      'sidebar-collapse': 'Sidebar kiçik ekranda yığılmır.',
      'navbar-collapse': 'Naviqasiya elementləri sığmır.',
      'cls': 'Layout shift (CLS > 0.1). Şəkil/şrift üçün yer ayırın.',
      'safe-area': 'Fixed element notch/home-indicator altında qala bilər (env(safe-area-inset-*) yoxdur).',
      'accessibility': 'Responsive WCAG tələbi pozulur.',
    };

    const sel = (el: Element): string => {
      const e = el as HTMLElement;
      const id = e.id ? '#' + e.id : '';
      const cn = typeof e.className === 'string' ? e.className.trim() : '';
      const cls = cn ? '.' + cn.split(/\s+/).slice(0, 2).join('.') : '';
      return (e.tagName.toLowerCase() + id + cls).slice(0, 90);
    };

    const domPath = (el: Element): string => {
      const parts: string[] = [];
      let cur: Element | null = el;
      while (cur && cur !== de) {
        let s = cur.tagName.toLowerCase();
        if (cur.id) { parts.unshift(s + '#' + cur.id); break; }
        const p: Element | null = cur.parentElement;
        if (p) s += `:nth-child(${Array.from(p.children).indexOf(cur) + 1})`;
        parts.unshift(s);
        cur = p;
      }
      return parts.join(' > ');
    };

    const add = (
      category: Violation['category'],
      detail: string,
      el: Element,
      cssCause = '',
    ) => {
      if ((counts[category] = (counts[category] || 0) + 1) > CAP) return;
      out.push({
        category,
        detail,
        selector: sel(el),
        domPath: domPath(el),
        priority: PRIORITY[category] || 'P3',
        cssCause,
        recommendation: RECS[category] || '',
      });
    };

    // ═══════════ TƏK KEÇİDLİ SNAPSHOT ═══════════
    // getBoundingClientRect + getComputedStyle bir dəfə oxunur; arada YAZI yoxdur,
    // ona görə layout thrashing baş vermir.
    interface Snap { el: HTMLElement; st: CSSStyleDeclaration; r: DOMRect; vis: boolean }
    const snaps: Snap[] = [];
    const byEl = new Map<Element, Snap>();

    // ⚠ `body` DƏ daxildir: `body *` onu buraxırdı, nəticədə body-nin
    //   overflow-x-i və birbaşa uşaqlarının valideyn ölçüsü oxunmurdu.
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body, body *'))) {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const vis =
        st.display !== 'none' &&
        st.visibility !== 'hidden' &&
        st.visibility !== 'collapse' &&
        parseFloat(st.opacity || '1') > 0.05 &&
        (r.width > 0 || r.height > 0) &&
        !el.hasAttribute('hidden') &&
        el.getAttribute('aria-hidden') !== 'true';
      const s: Snap = { el, st, r, vis };
      snaps.push(s);
      byEl.set(el, s);
    }

    const stOf = (el: Element | null): CSSStyleDeclaration | null =>
      el ? (byEl.get(el)?.st ?? null) : null;

    // Üfüqi olaraq kəsən/sürüşdürən ən yaxın əcdad (varsa, daşma səhifəyə çıxmır).
    //
    // 🔴 `body`/`html` QƏSDƏN İSTİSNADIR. `00-tokens-base.css`-də
    //    `html, body { overflow-x: hidden }` var — bu, DAŞMANI DÜZƏLTMİR,
    //    sadəcə GİZLƏDİR: məzmun səssizcə kəsilir və `scrollWidth` sıxılır.
    //    Onu qanuni saxlayıcı saysaq, audit hər şeyi "təmiz" göstərər —
    //    məhz bu kor nöqtə əvvəlki auditlərin daşmaları görməməsinin səbəbidir.
    const clipXAncestor = (el: HTMLElement): HTMLElement | null => {
      let p = el.parentElement;
      while (p && p !== de && p !== document.body) {
        const st = stOf(p);
        if (st && (st.overflowX === 'auto' || st.overflowX === 'scroll' || st.overflowX === 'hidden')) return p;
        p = p.parentElement;
      }
      return null;
    };

    // Ekran-oxuyucu üçün gizlədilmiş elementlər (clip/clip-path ilə) daşma sayılmır
    const isSrOnly = (st: CSSStyleDeclaration, r: DOMRect): boolean =>
      (r.width <= 1 && r.height <= 1) ||
      (st.clipPath !== 'none' && st.position === 'absolute') ||
      // `clip` köhnəlmişdir, amma klassik sr-only texnikası hələ onu işlədir;
      // deprecation xəbərdarlığı olmasın deyə property adı ilə oxunur.
      st.getPropertyValue('clip') === 'rect(0px, 0px, 0px, 0px)';

    // Qəsdən üfüqi sürüşən konteynerlər (dizayn qərarı — pozuntu deyil)
    const INTENTIONAL_X = /\b(ws-board|task-cat-tabs|testi-grid|admin-sidebar|admin-table-wrap|table-wrap|c-table-wrap|chat-messages|hm-grid|heatmap|pill-pick|scroll-x|codeshow|hljs)\b/;
    const isIntentionalScroll = (el: HTMLElement): boolean => {
      if (el.closest('pre, code, table, .table-wrap, .admin-table-wrap')) return true;
      let p: HTMLElement | null = el;
      while (p && p !== de) {
        const cn = typeof p.className === 'string' ? p.className : '';
        if (INTENTIONAL_X.test(cn)) return true;
        p = p.parentElement;
      }
      return false;
    };

    // ═══════════ 1) ÜFÜQİ DAŞMA (P0) ═══════════
    // ⚠ Element daşması SƏHİFƏ daşmasından ASILI OLMADAN yoxlanır.
    //   Əvvəl bu döngə `if (docW > vw)` şərtinin İÇİNDƏ idi; `body`-dəki
    //   `overflow-x:hidden` isə `scrollWidth`-i həmişə sıxdığı üçün şərt heç vaxt
    //   doğru olmurdu → daşma yoxlaması TAM ÖLÜ idi.
    const bodySt = stOf(document.body);
    const rootClipped = bodySt?.overflowX === 'hidden' || getComputedStyle(de).overflowX === 'hidden';

    const docW = de.scrollWidth;
    if (docW > vw + 1) {
      add('overflow-x', `scrollWidth ${docW} > clientWidth ${vw} (+${docW - vw}px)`, de,
        `body overflow-x:${bodySt?.overflowX}`);
    }

    for (const s of snaps) {
      if (!s.vis) continue;
      if (s.el === document.body) continue;
      if (s.st.position === 'fixed') continue;            // fixed səhifə enini artırmır
      const { r } = s;
      if (r.width === 0 && r.height === 0) continue;
      if (isSrOnly(s.st, r)) continue;
      if (r.right <= vw + 2 && r.left >= -2) continue;
      if (clipXAncestor(s.el)) continue;                  // əsl konteyner kəsir — səhifəyə çıxmır
      // Valideyn artıq daşıyırsa, günahkar odur — uşağı yazma
      const p = s.el.parentElement;
      const pr = p && p !== document.body ? byEl.get(p)?.r : null;
      if (pr && (pr.right > vw + 2 || pr.left < -2)) continue;
      add('element-overflow',
        `left=${Math.round(r.left)} right=${Math.round(r.right)} en=${Math.round(r.width)} vw=${vw}`
        + (rootClipped ? ' — kök overflow-x:hidden bunu GİZLƏDİR (məzmun kəsilir)' : ''),
        s.el,
        `width:${s.st.width}, min-width:${s.st.minWidth}, max-width:${s.st.maxWidth}, position:${s.st.position}`);
    }

    // ═══════════ 2) MƏTNİN SƏSSİZ KƏSİLMƏSİ (P1) ═══════════
    // Yalnız PLANLAŞDIRILMAMIŞ kəsilmə: ellipsis varsa qəsdəndir, buraxılır.
    for (const s of snaps) {
      if (!s.vis) continue;
      const { el, st } = s;
      if (st.overflowX === 'auto' || st.overflowX === 'scroll') continue;
      if (st.textOverflow === 'ellipsis') continue;       // qəsdən qısaltma
      if (el.children.length > 3) continue;               // konteyner deyil, mətn elementi axtarırıq
      const hasOwnText = Array.from(el.childNodes)
        .some(n => n.nodeType === 3 && (n.textContent || '').trim().length > 0);
      if (!hasOwnText) continue;
      if (st.overflowX !== 'hidden' && st.overflowX !== 'clip') continue;  // görünəndirsə kəsilmir
      if (el.scrollWidth > el.clientWidth + 2) {
        add('text-clip',
          `scrollW ${el.scrollWidth} > clientW ${el.clientWidth} — "${(el.textContent || '').trim().slice(0, 40)}"`,
          el,
          `white-space:${st.whiteSpace}, overflow-x:${st.overflowX}, text-overflow:${st.textOverflow}`);
      }
    }

    // ═══════════ 3) TOXUNMA HƏDƏFLƏRİ (P1, WCAG 2.2 AA — 2.5.8: 44×44) ═══════════
    if (vw <= 1024) {
      const INTERACTIVE = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch], [role=option], [tabindex]:not([tabindex="-1"])';
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(INTERACTIVE))) {
        const s = byEl.get(el);
        if (!s || !s.vis) continue;
        if (s.st.pointerEvents === 'none') continue;
        const t = (el as HTMLInputElement).type;
        if (el.tagName === 'INPUT' && (t === 'checkbox' || t === 'radio')) continue;
        // Mətn içi keçidlər (inline link) 2.5.8-dən istisnadır
        if (el.tagName === 'A' && el.closest('p, li, .md-body, .legal-body, .pub-body, .pub-page, footer, .pub-footer, .app-footer, .contact-info')) continue;
        const cn = typeof el.className === 'string' ? el.className : '';
        if (/\b(mg-name|msg-name|tech-badge|pal-lbl)\b/.test(cn)) continue;
        if (el.classList.contains('name') && el.closest('.msg-group, .chat-messages')) continue;
        const { r } = s;
        if (r.width <= 0 || r.height <= 0) continue;
        // ⚠ Viewport-dan TAM KƏNARDA duran element toxunma hədəfi deyil.
        //   Tipik hal: `.skip-to-content { top: -100% }` — yalnız klaviatura
        //   fokusunda görünən keçid. Toxunuşla ona heç vaxt çatılmır.
        if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
        if (r.width < 44 || r.height < 44) {
          add('touch-target', `${Math.round(r.width)}×${Math.round(r.height)} < 44×44`, el,
            `min-height:${s.st.minHeight}, min-width:${s.st.minWidth}, padding:${s.st.padding}`);
        }
      }
    }

    // ═══════════ 4) FLEX / GRID DAŞMASI (P2) — ARTIQ HƏQİQİ ═══════════
    for (const s of snaps) {
      if (!s.vis) continue;
      const { el, st } = s;
      const disp = st.display;

      // 🔴 YALNIZ SƏTİR İSTİQAMƏTİ. `flex-direction: column` konteynerdə uşaqlar
      //    ŞAQULİ yığılır — enləri toplamaq mənasızdır və hər sütun konteyneri
      //    yalançı "daşma" verir (ilk ölçmədə 10924 tapıntının böyük hissəsi məhz
      //    bu idi: .how-steps, .contact-form, .contact-info, .testi-content,
      //    .social-share-panel — hamısı column).
      const isRow = st.flexDirection === 'row' || st.flexDirection === 'row-reverse';
      if ((disp === 'flex' || disp === 'inline-flex') && st.flexWrap === 'nowrap' && isRow) {
        if (st.overflowX === 'auto' || st.overflowX === 'scroll') continue;
        if (st.pointerEvents === 'none') continue;        // dekorativ qat
        if (isIntentionalScroll(el)) continue;
        const gap = parseFloat(st.columnGap) || 0;
        let total = 0; let n = 0;
        for (const ch of Array.from(el.children) as HTMLElement[]) {
          const cs = byEl.get(ch);
          if (!cs || !cs.vis) continue;
          if (cs.st.position === 'absolute' || cs.st.position === 'fixed') continue;
          total += cs.r.width + (parseFloat(cs.st.marginLeft) || 0) + (parseFloat(cs.st.marginRight) || 0);
          n++;
        }
        if (n > 1) total += gap * (n - 1);
        if (n > 0 && total > el.clientWidth + 2) {
          add('flex-wrap', `nowrap uşaqlar sığmır: ${Math.round(total)} > ${el.clientWidth}`, el,
            `flex-wrap:nowrap, column-gap:${st.columnGap}, overflow-x:${st.overflowX}`);
        }
      }

      if (disp === 'grid' || disp === 'inline-grid') {
        if (st.overflowX === 'auto' || st.overflowX === 'scroll') continue;
        if (isIntentionalScroll(el)) continue;
        if (el.scrollWidth > el.clientWidth + 2) {
          add('grid-wrap', `grid daşır: scrollW ${el.scrollWidth} > clientW ${el.clientWidth}`, el,
            `grid-template-columns:${st.gridTemplateColumns}, column-gap:${st.columnGap}`);
        }
      }
    }

    // ═══════════ 5) FIXED / STICKY (P1) — ARTIQ HƏQİQİ ═══════════
    // ⚠ `pointer-events:none` = DEKORATİV qat (cyberpunk kursoru, fon canvas-ı,
    //   hero float-ları). Onlar qəsdən viewport kənarına/üstünə çıxır — qüsur deyil.
    const fixedish = snaps.filter(s =>
      s.vis && s.st.pointerEvents !== 'none' &&
      (s.st.position === 'fixed' || s.st.position === 'sticky'));
    for (const s of fixedish) {
      const { r, el } = s;
      if (r.width === 0 || r.height === 0) continue;
      if (r.left < -2 || r.right > vw + 2) {
        add('fixed-sticky-collision',
          `${s.st.position} element üfüqi olaraq kənarda: left=${Math.round(r.left)} right=${Math.round(r.right)} vw=${vw}`,
          el, `position:${s.st.position}, width:${s.st.width}, z-index:${s.st.zIndex}`);
      }
    }
    // safe-area: ekranın altına yapışan fixed panellər
    for (const s of fixedish) {
      if (s.st.position !== 'fixed') continue;
      const { st, el } = s;
      // Yalnız İNTERAKTİV alt panellər (bottom-nav, alt tool bar) əhəmiyyətlidir —
      // dekorativ fon qatının safe-area ilə işi yoxdur.
      if (st.bottom === '0px' && el.querySelector('button, a[href], input, select, textarea')) {
        const pb = el.style.paddingBottom + ' ' + st.paddingBottom;
        // env() computed-də artıq px-ə çevrilir; mənbədə axtarmaq üçün atributa baxırıq
        const raw = (el.getAttribute('class') || '');
        if (!/safe/.test(raw) && parseFloat(st.paddingBottom || '0') === 0 && !pb.includes('env')) {
          add('safe-area', `Alta yapışan fixed panel (${sel(el)}) safe-area-inset-bottom nəzərə almır`, el,
            `bottom:${st.bottom}, padding-bottom:${st.paddingBottom}`);
        }
      }
    }

    // ═══════════ 6) QEYRİ-İNTENTİONAL ÜFÜQİ SCROLL KONTEYNERİ (P2) ═══════════
    for (const s of snaps) {
      if (!s.vis) continue;
      const { el, st } = s;
      if (st.overflowX !== 'auto' && st.overflowX !== 'scroll') continue;
      if (el.scrollWidth <= el.clientWidth + 2) continue;
      if (isIntentionalScroll(el)) continue;
      add('horizontal-scroll-container',
        `scrollW ${el.scrollWidth} > clientW ${el.clientWidth}`, el,
        `overflow-x:${st.overflowX}, width:${st.width}`);
    }

    // ═══════════ 7) MEDİA (P1/P2) ═══════════
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('img, svg, video, canvas, iframe'))) {
      const s = byEl.get(el);
      if (!s || !s.vis) continue;
      const parent = el.parentElement;
      if (!parent) continue;
      const ps = byEl.get(parent);
      if (!ps) continue;
      if (s.st.position === 'absolute' || s.st.position === 'fixed') continue;
      const pClipped = ps.st.overflowX === 'hidden' || ps.st.overflowX === 'clip';
      if (!pClipped && s.r.width > ps.r.width + 2) {
        add('media-overflow',
          `${el.tagName} eni ${Math.round(s.r.width)} > konteyner ${Math.round(ps.r.width)}`, el,
          `max-width:${s.st.maxWidth}, width:${s.st.width}, object-fit:${s.st.objectFit}`);
      }
      // aspekt pozulması (yalnız yüklənmiş <img>)
      if (el.tagName === 'IMG') {
        const img = el as HTMLImageElement;
        if (img.naturalWidth > 0 && img.naturalHeight > 0 && s.r.width > 4 && s.r.height > 4) {
          const natural = img.naturalWidth / img.naturalHeight;
          const shown = s.r.width / s.r.height;
          const fit = s.st.objectFit;
          if ((fit === 'fill' || fit === 'none' || !fit) && Math.abs(shown - natural) / natural > 0.05) {
            add('media-aspect',
              `aspekt ${shown.toFixed(2)} ≠ təbii ${natural.toFixed(2)} (object-fit:${fit})`, el,
              `object-fit:${fit}, width:${s.st.width}, height:${s.st.height}`);
          }
        }
      }
    }

    // ═══════════ 8) CƏDVƏLLƏR (P1) ═══════════
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('table'))) {
      const s = byEl.get(el);
      if (!s || !s.vis) continue;
      const scroller = clipXAncestor(el);
      const scrollerSt = scroller ? stOf(scroller) : null;
      const canScroll = scrollerSt && (scrollerSt.overflowX === 'auto' || scrollerSt.overflowX === 'scroll');
      if (canScroll) continue;                            // sarğı var — düzgün davranış
      const host = el.parentElement;
      const hw = host ? (byEl.get(host)?.r.width ?? vw) : vw;
      if (el.scrollWidth > hw + 2) {
        add('table-overflow',
          `cədvəl ${Math.round(el.scrollWidth)}px, sürüşdürülə bilən sarğı YOXDUR (konteyner ${Math.round(hw)}px)`,
          el, `table-layout:${s.st.tableLayout}, valideyn overflow-x:${scrollerSt?.overflowX ?? 'visible'}`);
      }
    }

    // ═══════════ 9) MODAL / PANEL / OVERLAY (P1) ═══════════
    const OVERLAY_SEL = '.modal-card, .modal-bg, .palette, .drawer, .social-share-panel, .toast-wrap, [role="dialog"], [role="alertdialog"], [role="menu"], .ws-panel';
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(OVERLAY_SEL))) {
      const s = byEl.get(el);
      if (!s || !s.vis) continue;
      const { r } = s;
      if (r.width > vw + 2 || r.height > vh + 2) {
        add('modal-responsive',
          `${Math.round(r.width)}×${Math.round(r.height)} > viewport ${vw}×${vh}`, el,
          `max-width:${s.st.maxWidth}, max-height:${s.st.maxHeight}, overflow-y:${s.st.overflowY}`);
      }
    }

    // ═══════════ 10) SIDEBAR / NAVBAR (P2) ═══════════
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.sidebar, .admin-sidebar, .pub-sidebar'))) {
      const s = byEl.get(el);
      if (!s || !s.vis) continue;
      // ⚠ Sidebar dar ekranda TAM EN alıb məzmunun ALTINA yığılıbsa, bu düzgün
      //   davranışdır — pozuntu yalnız o, hələ də məzmunun YANINDA duranda var.
      //   Valideynlə eyni enə yaxındırsa (≥90%) deməli yığılıb.
      const parent = el.parentElement;
      const pw = parent ? (byEl.get(parent)?.r.width ?? 0) : 0;
      const stacked = pw > 0 && s.r.width / pw >= 0.9;
      if (vw < 768 && s.r.width > 250 && !stacked) {
        add('sidebar-collapse', `sidebar eni ${Math.round(s.r.width)}px, viewport ${vw}px`, el,
          `width:${s.st.width}, display:${s.st.display}`);
      }
    }
    if (vw < 1024) {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('nav, .ph-nav, .bottom-nav, .app-topbar'))) {
        const s = byEl.get(el);
        if (!s || !s.vis) continue;
        if (s.st.overflowX === 'auto' || s.st.overflowX === 'scroll') continue;
        if (el.scrollWidth > el.clientWidth + 2) {
          add('navbar-collapse', `naviqasiya sığmır: ${el.scrollWidth} > ${el.clientWidth}`, el,
            `display:${s.st.display}, flex-wrap:${s.st.flexWrap}, gap:${s.st.gap}`);
        }
      }
    }

    // ═══════════ 11) ÜST-ÜSTƏ DÜŞMƏ (P1) — YALNIZ MƏTN DAŞIYANLAR ═══════════
    // Dekorativ overlay-lar və backdrop-lar qəsdən üst-üstə düşür; yalnız
    // hər ikisi ÖZ mətnini daşıyan, biri digərinin əcdadı OLMAYAN cütlər sayılır.
    // ⚠ ÜZƏN QATLAR İSTİSNADIR. `position:fixed` panel (paylaşma raili, "yuxarı
    //   qayıt", toast) məzmunun ÜSTÜNDƏ durmaq üçün var — onu örtüşmə saymaq hər
    //   üzən düymə üçün yalançı tapıntı verir (ilk ölçmədə 1013 örtüşmənin
    //   HAMISI `.social-share-panel .share-btn`-ə bağlı idi).
    const hasFixedAncestor = (el: HTMLElement): boolean => {
      let p: HTMLElement | null = el;
      while (p && p !== de) {
        const st = stOf(p);
        if (st && st.position === 'fixed') return true;
        p = p.parentElement;
      }
      return false;
    };

    const textual = snaps.filter(s => {
      if (!s.vis) return false;
      if (s.st.pointerEvents === 'none') return false;
      if (s.r.width < 8 || s.r.height < 8) return false;
      if (parseFloat(s.st.opacity || '1') < 0.9) return false;
      if (hasFixedAncestor(s.el)) return false;
      return Array.from(s.el.childNodes).some(n => n.nodeType === 3 && (n.textContent || '').trim().length > 1);
    }).slice(0, 160);

    for (let i = 0; i < textual.length; i++) {
      for (let j = i + 1; j < textual.length; j++) {
        const a = textual[i], b = textual[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const ra = a.r, rb = b.r;
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ox <= 1 || oy <= 1) continue;
        const overlapArea = ox * oy;
        const minArea = Math.min(ra.width * ra.height, rb.width * rb.height);
        if (overlapArea / minArea < 0.3) continue;        // toxunma deyil, əsl örtmə
        add('layout-overlap',
          `${sel(a.el)} və ${sel(b.el)} ${Math.round(overlapArea / minArea * 100)}% örtüşür`, a.el,
          `a.position:${a.st.position}, b.position:${b.st.position}`);
        break;
      }
    }

    // ═══════════ 12) CLS ═══════════
    try {
      const entries = performance.getEntriesByType('layout-shift') as unknown as { value: number; hadRecentInput: boolean }[];
      let cls = 0;
      for (const e of entries) if (!e.hadRecentInput) cls += e.value;
      if (cls > 0.1) add('cls', `CLS ${cls.toFixed(3)} > 0.1`, de);
    } catch { /* dəstəklənməyə bilər */ }

    // ═══════════ 13) MƏTN ÖLÇÜSÜ (WCAG 1.4.4) ═══════════
    if (vw < 768) {
      for (const s of snaps) {
        if (!s.vis) continue;
        const hasText = Array.from(s.el.childNodes).some(n => n.nodeType === 3 && (n.textContent || '').trim().length > 1);
        if (!hasText) continue;
        const size = parseFloat(s.st.fontSize);
        if (size && size < 11) {
          add('accessibility', `mətn ölçüsü ${size}px < 11px (WCAG 1.4.4)`, s.el, `font-size:${s.st.fontSize}`);
        }
      }
    }

    return out;
  });
}

// ─── Skor ─────────────────────────────────────────────────────────────────────
export function computeScore(violations: Violation[]): number {
  const weights: Record<string, number> = { P0: 10, P1: 5, P2: 2, P3: 1 };
  let penalty = 0;
  for (const v of violations) penalty += weights[v.priority || 'P3'] || 1;
  return Math.round(Math.max(0, 100 - Math.min(penalty, 100)));
}

export function summarize(violations: Violation[]): AuditResult['summary'] {
  const byPriority = { P0: 0, P1: 0, P2: 0, P3: 0 };
  const byCategory: Record<string, number> = {};
  for (const v of violations) {
    const p = v.priority || 'P3';
    byPriority[p]++;
    byCategory[v.category] = (byCategory[v.category] || 0) + 1;
  }
  return { total: violations.length, byPriority, byCategory };
}

// ─── Tam audit ────────────────────────────────────────────────────────────────
export interface FullAuditResult {
  results: AuditResult[];
  overallScore: number;
  totalViolations: number;
  combos: number;
}

export interface AuditOptions {
  themes?: string[];
  viewports?: { w: number; h: number; label?: string }[];
}

export async function runFullAudit(
  browser: Browser,
  pages: AuditPage[] = AUDIT_PAGES,
  opts: AuditOptions = {},
): Promise<FullAuditResult> {
  const themes = opts.themes ?? ['dark'];
  const viewports = opts.viewports ?? ALL_VIEWPORTS;
  const results: AuditResult[] = [];
  let totalViolations = 0;
  let totalScores = 0;

  for (const pageInfo of pages) {
    for (const theme of themes) {
      const ctx = await browser.newContext(
        pageInfo.auth ? { storageState: AUTH_FILE } : { storageState: { cookies: [], origins: [] } },
      );
      // Tema YÜKLƏNMƏDƏN ƏVVƏL qoyulur ki, initTheme() onu götürsün (cyberpunk
      // şrifti yalnız bu yolla qoşulur — dataset-i sonradan dəyişmək kifayət etmir).
      await ctx.addInitScript((t) => {
        localStorage.setItem('collabix_theme', t as string);
        localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
        localStorage.setItem('collabix_onboarded', '1');
      }, theme);
      const page = await ctx.newPage();

      try {
        await page.goto(pageInfo.url, { waitUntil: 'networkidle' });
        if (pageInfo.open) await pageInfo.open(page);
        // ⚠ `document.fonts.ready` FontFaceSet-ə resolve olur — seriallaşdırıla
        //   bilmir. Nəticəni udub yalnız gözləyirik.
        await page.evaluate(async () => { await document.fonts?.ready; }).catch(() => { });

        for (const vp of viewports) {
          await page.setViewportSize({ width: vp.w, height: vp.h });
          await page.waitForTimeout(220);

          const violations = await collectViolations(page);
          const score = computeScore(violations);
          results.push({
            page: pageInfo.name,
            theme,
            viewport: vp,
            violations,
            score,
            summary: summarize(violations),
          });
          totalViolations += violations.length;
          totalScores += score;
        }
      } finally {
        await ctx.close();
      }
    }
  }

  return {
    results,
    overallScore: results.length ? Math.round(totalScores / results.length) : 0,
    totalViolations,
    combos: results.length,
  };
}

// ─── Hesabat ──────────────────────────────────────────────────────────────────
// ⚠ Əvvəl hər kombinasiya üçün fullPage base64 SCREENSHOT audit.json-a yazılırdı.
//   504 kombinasiyada bu, yüz MB-larla fayl deməkdir və hesabatı açılmaz edir.
//   İndi hesabat AQREQASİYA edir: eyni (kateqoriya + seçici) pozuntusu bir sətirdir,
//   təsirlənən ölçü/tema siyahısı ilə — yəni "kateqoriyalaşdırılmış reyestr".

interface AggRow {
  category: string;
  priority: string;
  selector: string;
  domPath: string;
  detail: string;
  cssCause: string;
  recommendation: string;
  pages: Set<string>;
  themes: Set<string>;
  widths: Set<number>;
  hits: number;
}

function aggregate(data: FullAuditResult): AggRow[] {
  const map = new Map<string, AggRow>();
  for (const res of data.results) {
    for (const v of res.violations) {
      const key = `${v.category}|${v.selector}`;
      let row = map.get(key);
      if (!row) {
        row = {
          category: v.category, priority: v.priority || 'P3', selector: v.selector,
          domPath: v.domPath || '', detail: v.detail, cssCause: v.cssCause || '',
          recommendation: v.recommendation || '',
          pages: new Set(), themes: new Set(), widths: new Set(), hits: 0,
        };
        map.set(key, row);
      }
      row.pages.add(res.page);
      row.themes.add(res.theme);
      row.widths.add(res.viewport.w);
      row.hits++;
    }
  }
  const order = { P0: 0, P1: 1, P2: 2, P3: 3 } as Record<string, number>;
  return [...map.values()].sort((a, b) =>
    (order[a.priority] - order[b.priority]) || (b.hits - a.hits));
}

export function generateReports(data: FullAuditResult, outputDir = './audit-reports'): void {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const rows = aggregate(data);
  const byPriority = { P0: 0, P1: 0, P2: 0, P3: 0 } as Record<string, number>;
  for (const r of rows) byPriority[r.priority] += r.hits;

  fs.writeFileSync(path.join(outputDir, 'audit.json'), JSON.stringify({
    overallScore: data.overallScore,
    totalViolations: data.totalViolations,
    combos: data.combos,
    byPriority,
    registry: rows.map(r => ({
      ...r, pages: [...r.pages], themes: [...r.themes], widths: [...r.widths].sort((a, b) => a - b),
    })),
  }, null, 2));

  const fmt = (r: AggRow) =>
    `| ${r.priority} | ${r.category} | \`${r.selector}\` | ${r.hits} | ${[...r.widths].sort((a, b) => a - b).join(', ')} | ${[...r.themes].join(', ')} | ${[...r.pages].slice(0, 6).join(', ')} | ${r.detail.replace(/\|/g, '\\|')} |`;

  let md = `# Responsive Audit — Kateqoriyalaşdırılmış Reyestr\n\n`;
  md += `- **Ümumi hesab:** ${data.overallScore}/100\n`;
  md += `- **Kombinasiya sayı:** ${data.combos}\n`;
  md += `- **Ümumi pozuntu:** ${data.totalViolations}\n`;
  md += `- **P0:** ${byPriority.P0} · **P1:** ${byPriority.P1} · **P2:** ${byPriority.P2} · **P3:** ${byPriority.P3}\n\n`;
  md += `| Pri | Kateqoriya | Seçici | Say | Enlər | Temalar | Səhifələr | Detal |\n`;
  md += `|-----|-----------|--------|-----|-------|---------|-----------|-------|\n`;
  for (const r of rows) md += fmt(r) + '\n';
  fs.writeFileSync(path.join(outputDir, 'audit.md'), md);

  let html = `<!DOCTYPE html><html lang="az"><head><meta charset="UTF-8"><title>Responsive Audit</title>`;
  html += `<style>body{font-family:system-ui,sans-serif;margin:2rem;background:#0d1117;color:#e6edf3}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #30363d;padding:6px 8px;text-align:left;vertical-align:top}th{background:#161b22;position:sticky;top:0}.P0{background:#3d1418}.P1{background:#3d2f14}.P2{background:#1c2b1c}.P3{background:#161b22}code{background:#161b22;padding:1px 4px;border-radius:3px}</style>`;
  html += `</head><body><h1>Responsive Audit — Kateqoriyalaşdırılmış Reyestr</h1>`;
  html += `<p>Hesab <b>${data.overallScore}/100</b> · ${data.combos} kombinasiya · ${data.totalViolations} pozuntu<br>`;
  html += `P0 <b>${byPriority.P0}</b> · P1 <b>${byPriority.P1}</b> · P2 <b>${byPriority.P2}</b> · P3 <b>${byPriority.P3}</b></p>`;
  html += `<table><tr><th>Pri</th><th>Kateqoriya</th><th>Seçici</th><th>Say</th><th>Enlər</th><th>Temalar</th><th>Səhifələr</th><th>Detal</th><th>Səbəb</th></tr>`;
  for (const r of rows) {
    html += `<tr class="${r.priority}"><td>${r.priority}</td><td>${r.category}</td><td><code>${r.selector.replace(/</g, '&lt;')}</code></td><td>${r.hits}</td><td>${[...r.widths].sort((a, b) => a - b).join(', ')}</td><td>${[...r.themes].join(', ')}</td><td>${[...r.pages].slice(0, 8).join(', ')}</td><td>${r.detail.replace(/</g, '&lt;')}</td><td><code>${r.cssCause.replace(/</g, '&lt;')}</code></td></tr>`;
  }
  html += `</table></body></html>`;
  fs.writeFileSync(path.join(outputDir, 'audit.html'), html);
}

// ─── Konfiqurasiya ────────────────────────────────────────────────────────────
// Tələb olunan 24 en. Hündürlüklər real cihaz nisbətlərinə uyğundur.
export const VIEWPORTS = {
  mobile: [
    { w: 320, h: 568, label: 'iPhone SE1' }, { w: 360, h: 800, label: 'Android dar' },
    { w: 375, h: 812, label: 'iPhone X' }, { w: 390, h: 844, label: 'iPhone 14' },
    { w: 414, h: 896, label: 'iPhone 11' }, { w: 430, h: 932, label: 'iPhone 15 PM' },
    { w: 480, h: 853, label: 'phablet' }, { w: 540, h: 960, label: 'Surface Duo' },
    { w: 576, h: 1024, label: 'bootstrap sm' }, { w: 640, h: 1136, label: 'kiçik tablet' },
  ],
  tablet: [
    { w: 768, h: 1024, label: 'iPad portret' }, { w: 820, h: 1180, label: 'iPad Air' },
    { w: 853, h: 1280, label: 'Nexus 9' }, { w: 912, h: 1368, label: 'Surface Pro' },
    { w: 1024, h: 1366, label: 'iPad Pro' },
  ],
  desktop: [
    { w: 1152, h: 864, label: 'dar desktop' }, { w: 1280, h: 720, label: 'HD' },
    { w: 1366, h: 768, label: 'laptop' }, { w: 1440, h: 900, label: 'MBP 15' },
    { w: 1536, h: 864, label: 'FHD@125%' }, { w: 1600, h: 900, label: 'HD+' },
    { w: 1728, h: 1117, label: 'MBP 16' }, { w: 1920, h: 1080, label: 'FHD' },
    { w: 2560, h: 1440, label: 'QHD ultra-wide' },
  ],
  // Landşaft: en/hündürlük çevrilir — qısa hündürlük modal/sticky üçün ən sərt hal.
  landscape: [
    { w: 568, h: 320, label: 'mobil landşaft dar' },
    { w: 812, h: 375, label: 'iPhone X landşaft' },
    { w: 932, h: 430, label: 'iPhone 15 PM landşaft' },
    { w: 1024, h: 768, label: 'tablet landşaft' },
    { w: 1180, h: 820, label: 'iPad Air landşaft' },
    { w: 1368, h: 912, label: 'Surface Pro landşaft' },
  ],
};
export const ALL_VIEWPORTS = [...VIEWPORTS.mobile, ...VIEWPORTS.tablet, ...VIEWPORTS.desktop];
export const ALL_VIEWPORTS_WITH_LANDSCAPE = [...ALL_VIEWPORTS, ...VIEWPORTS.landscape];
export const THEMES = ['dark', 'light', 'matrix', 'cyberpunk'];

export interface AuditPage { name: string; url: string; auth: boolean; open?: (page: Page) => Promise<void> }

export const AUDIT_PAGES: AuditPage[] = [
  // Publik qat — 9 səhifənin HAMISI (əvvəl security/cookies buraxılmışdı)
  { name: 'welcome', url: '/', auth: false },
  { name: 'about', url: '/about', auth: false },
  { name: 'faq', url: '/faq', auth: false },
  { name: 'contact', url: '/contact', auth: false },
  { name: 'privacy', url: '/privacy', auth: false },
  { name: 'terms', url: '/terms', auth: false },
  { name: 'security', url: '/security', auth: false },
  { name: 'cookies', url: '/cookies', auth: false },
  { name: 'changelog', url: '/changelog', auth: false },
  // Autentifikasiyalı qat
  { name: 'home', url: '/#home', auth: true },
  { name: 'chat', url: '/#chat', auth: true },
  { name: 'dm', url: '/#dm', auth: true },
  { name: 'notifs', url: '/#notifs', auth: true },
  { name: 'users', url: '/#users', auth: true },
  { name: 'tasks', url: '/#tasks', auth: true },
  { name: 'drills', url: '/#drills', auth: true },     // əvvəl BURAXILMIŞDI
  { name: 'stats', url: '/#stats', auth: true },
  { name: 'saved', url: '/#saved', auth: true },
  { name: 'profil', url: '/#profil', auth: true },
  { name: 'settings', url: '/#settings', auth: true },
  { name: 'admin', url: '/#admin', auth: true },
  { name: 'teams', url: '/#teams', auth: true },
  { name: 'team', url: `/#team/${E2E_TEAM.slug}`, auth: true },
];
