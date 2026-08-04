// Responsive audit kitabxanası (TASK-9 / FAZA 1 – genişləndirilmiş).
//
// Detection‑first: bütün ölçmələr BROWSER kontekstində aparılır (page.evaluate).
// Yeni yoxlamalar: layout overlap, flex/grid wrapping, fixed/sticky collision,
// horizontal scroll containers, responsive media, table, modal/drawer, sidebar,
// navbar, z‑index conflicts, scrollbar, CLS, safe‑area, landscape, zoom,
// accessibility (WCAG), visual regression hook.
import type { Page } from '@playwright/test';
import { E2E_TEAM } from './fixtures';
import * as fs from 'fs';
import * as path from 'path';

// ─── Genişləndirilmiş pozuntu tipi ────────────────────────────────────────────
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
  | 'table-overflow'
  | 'modal-responsive'
  | 'drawer-responsive'
  | 'sidebar-collapse'
  | 'navbar-collapse'
  | 'z-index-conflict'
  | 'scrollbar-detection'
  | 'cls'
  | 'safe-area'
  | 'landscape'
  | 'zoom'
  | 'accessibility'
  | 'visual-regression';
  detail: string;
  selector: string;          // qısa seçici (göstərmək üçün)
  domPath?: string;          // tam DOM yolu (məs. html body div#main ...)
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
  cssCause?: string;         // təxmini səbəb (CSS xassələri)
  recommendation?: string;   // düzəliş tövsiyəsi
}

// ─── Yeni audit nəticəsi ──────────────────────────────────────────────────────
export interface AuditResult {
  page: string;
  viewport: { w: number; h: number };
  violations: Violation[];
  score: number;             // 0‑100
  summary: {
    total: number;
    byPriority: { P0: number; P1: number; P2: number; P3: number };
    byCategory: Record<string, number>;
  };
  screenshot?: string;       // base64 (visual regression üçün)
}

// ─── Köməkçi funksiyalar (browser daxilində) ──────────────────────────────

function buildDomPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += '#' + current.id;
      parts.unshift(selector);
      break; // ID unikal olduğu üçün dayan
    }
    // index əlavə et (nth‑child)
    const parent = current.parentElement;
    if (parent) {
      const children = Array.from(parent.children);
      const index = children.indexOf(current) + 1;
      selector += `:nth-child(${index})`;
    }
    parts.unshift(selector);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

function getCssCause(el: HTMLElement, category: Violation['category']): string {
  const st = getComputedStyle(el);
  switch (category) {
    case 'overflow-x':
    case 'element-overflow':
      return `width:${st.width}, max-width:${st.maxWidth}, overflow-x:${st.overflowX}`;
    case 'text-clip':
      return `white-space:${st.whiteSpace}, overflow:${st.overflow}, text-overflow:${st.textOverflow}`;
    case 'touch-target':
      return `min-width:${st.minWidth}, min-height:${st.minHeight}, padding:${st.padding}`;
    case 'flex-wrap':
      return `flex-wrap:${st.flexWrap}, flex-shrink:${st.flexShrink}`;
    case 'grid-wrap':
      return `grid-template-columns:${st.gridTemplateColumns}, overflow:${st.overflow}`;
    case 'fixed-sticky-collision':
      return `position:${st.position}, top:${st.top}, z-index:${st.zIndex}`;
    case 'z-index-conflict':
      return `z-index:${st.zIndex}, position:${st.position}`;
    default:
      return '';
  }
}

function getRecommendation(category: Violation['category'], detail: string): string {
  const recs: Record<Violation['category'], string> = {
    'overflow-x': 'Səhifədə üfüqi scroll yaranır. "overflow-x: hidden" əlavə edin və ya daşan elementi kiçildin.',
    'element-overflow': 'Element viewportdan kənara çıxır. "max-width: 100%" və "box-sizing: border-box" tətbiq edin.',
    'touch-target': 'Toxunma hədəfi çox kiçikdir (minimum 44×44 px). Padding və ya ölçü artırın.',
    'text-clip': 'Mətn kəsilir. "white-space: normal", "overflow: visible" və ya "word-break: break-word" istifadə edin.',
    'layout-overlap': 'Elementlər üst‑üstə düşür. Z‑index və ya mövqe tənzimləyin.',
    'flex-wrap': 'Flex elementlər konteynerə sığmır. "flex-wrap: wrap" əlavə edin və ya flex‑baza azaldın.',
    'grid-wrap': 'Grid elementlər daşır. "grid-template-columns: repeat(auto‑fit, minmax(...))" istifadə edin.',
    'fixed-sticky-collision': 'Fixed/sticky elementlər toqquşur. "top", "bottom" dəyərlərini nəzərdən keçirin.',
    'horizontal-scroll-container': 'Horizontal scroll konteyneri qeyri‑intentionaldır. "max-width: 100%" və "overflow-x: hidden" yoxlayın.',
    'media-overflow': 'Media element (img, svg, video) konteynerdən daşır. "max-width: 100%; height: auto" tətbiq edin.',
    'table-overflow': 'Cədvəl ekrandan kənara çıxır. "overflow-x: auto" olan konteynerə sarın və ya "table-layout: fixed" istifadə edin.',
    'modal-responsive': 'Modal/drawer ekrandan böyükdür. "max-height: 90vh; overflow-y: auto" əlavə edin.',
    'drawer-responsive': 'Drawer tam görünmür. "width: 100%; max-width: 400px" kimi məhdudiyyət qoyun.',
    'sidebar-collapse': 'Sidebar kiçik ekranda daralmır. "display: none" və ya "transform: translateX" ilə gizlədin.',
    'navbar-collapse': 'Navbar elementləri sığmır. "flex-wrap: wrap" və ya hamburger menyu əlavə edin.',
    'z-index-conflict': 'Z‑index toqquşması var. Üst‑üstə düşən elementlərin z‑index səviyyələrini tənzimləyin.',
    'scrollbar-detection': 'Scrollbar görünür və layout dəyişir. "overflow: auto" əvəzinə "overlay" və ya sabit en ayırın.',
    'cls': 'Layout shift baş verir (CLS > 0.1). Şəkillərə ölçü verin, reklamlar üçün yer ayırın.',
    'safe-area': 'iPhone notch/status bar altında qalır. "padding: env(safe-area-inset-*)" əlavə edin.',
    'landscape': 'Landscape rejimində layout pozulur. Media query ilə fərqli tənzimləmə edin.',
    'zoom': '200% zoom-da mətn və elementlər sığmır. "rem" və "vw/vh" istifadə edin, sabit px azaldın.',
    'accessibility': 'Responsive WCAG tələbləri pozulur. Kontrast, toxunma hədəfi, mətn ölçüsü yoxlayın.',
    'visual-regression': 'Görünüş fərqlidir (baseline ilə müqayisə). Ekran görüntüsü yoxlayın.',
  };
  return recs[category] || 'Tövsiyə: CSS xassələrini nəzərdən keçirin.';
}

function getPriority(category: Violation['category']): 'P0' | 'P1' | 'P2' | 'P3' {
  const map: Record<Violation['category'], 'P0' | 'P1' | 'P2' | 'P3'> = {
    'overflow-x': 'P0',
    'element-overflow': 'P0',
    'touch-target': 'P1',
    'text-clip': 'P1',
    'layout-overlap': 'P1',
    'flex-wrap': 'P2',
    'grid-wrap': 'P2',
    'fixed-sticky-collision': 'P1',
    'horizontal-scroll-container': 'P1',
    'media-overflow': 'P2',
    'table-overflow': 'P2',
    'modal-responsive': 'P1',
    'drawer-responsive': 'P1',
    'sidebar-collapse': 'P2',
    'navbar-collapse': 'P2',
    'z-index-conflict': 'P2',
    'scrollbar-detection': 'P2',
    'cls': 'P0',
    'safe-area': 'P1',
    'landscape': 'P2',
    'zoom': 'P1',
    'accessibility': 'P1',
    'visual-regression': 'P3',
  };
  return map[category] || 'P3';
}

// ─── Əsas yoxlama funksiyası (page.evaluate daxilində işləyir) ────────────

export async function collectViolations(page: Page): Promise<Violation[]> {
  return page.evaluate(() => {
    const out: Violation[] = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // ── Seçici yaratma ──
    const sel = (el: Element): string => {
      const e = el as HTMLElement;
      const id = e.id ? '#' + e.id : '';
      const cls = (e.className && typeof e.className === 'string')
        ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
      return (e.tagName.toLowerCase() + id + cls).slice(0, 80);
    };

    // ── Görünənlik ──
    const visible = (el: Element): boolean => {
      const e = el as HTMLElement;
      const r = e.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      const st = getComputedStyle(e);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
      if (e.offsetParent === null && st.position !== 'fixed') return false;
      return true;
    };

    // ── DOM yolu ──
    const domPath = (el: Element): string => {
      const parts: string[] = [];
      let cur: Element | null = el;
      while (cur && cur !== document.documentElement) {
        let selector = cur.tagName.toLowerCase();
        if (cur.id) {
          selector += '#' + cur.id;
          parts.unshift(selector);
          break;
        }
        const parent = cur.parentElement;
        if (parent) {
          const children = Array.from(parent.children);
          const index = children.indexOf(cur) + 1;
          selector += `:nth-child(${index})`;
        }
        parts.unshift(selector);
        cur = cur.parentElement;
      }
      return parts.join(' > ');
    };

    // ── Ümumi köməkçi: pozuntu əlavə et ──
    const addViolation = (
      category: Violation['category'],
      detail: string,
      element: Element,
      extra?: Partial<Violation>
    ) => {
      const e = element as HTMLElement;
      const v: Violation = {
        category,
        detail,
        selector: sel(element),
        domPath: domPath(element),
        priority: getPriority(category),
        cssCause: getCssCause(e, category),
        recommendation: getRecommendation(category, detail),
        ...extra,
      };
      out.push(v);
    };

    // ════════════════════════════════════════════════════════════
    // 1) Mövcud yoxlamalar (saxlanılır)
    // ════════════════════════════════════════════════════════════

    // 1.1 overflow-x
    const docW = document.documentElement.scrollWidth;
    if (docW > vw + 1) {
      addViolation('overflow-x', `scrollWidth ${docW} > innerWidth ${vw}`, document.documentElement);
    }

    // 1.2 element-overflow
    if (docW > vw + 1) {
      const all = document.querySelectorAll('body *');
      let found = 0;
      for (const el of all) {
        if (found >= 12) break;
        if (!visible(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.right > vw + 2 || r.left < -2) {
          const parent = el.parentElement;
          if (parent && parent.getBoundingClientRect().right > vw + 2) continue;
          addViolation('element-overflow', `right=${Math.round(r.right)} left=${Math.round(r.left)} vw=${vw}`, el);
          found++;
        }
      }
    }

    // 1.3 touch-target
    if (vw <= 1024) {
      const interactive = document.querySelectorAll(
        'button, a, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=option]'
      );
      let touchFound = 0;
      for (const el of interactive) {
        if (touchFound >= 20) break;
        if (!visible(el)) continue;
        const e = el as HTMLElement;
        if (getComputedStyle(e).pointerEvents === 'none') continue;
        const inputType = (e as HTMLInputElement).type;
        if (e.tagName === 'INPUT' && (inputType === 'checkbox' || inputType === 'radio')) continue;
        if (e.tagName === 'A' && e.closest(
          'p, .md-body, .legal-body, .app-footer, .pub-footer, footer, li, .pub-page, .pub-body, .contact-info'
        )) continue;
        const cls = typeof e.className === 'string' ? e.className : '';
        if (/\b(mg-name|msg-name|tech-badge|pal-lbl)\b/.test(cls)) continue;
        if (e.classList.contains('name') && e.closest('.msg-group, .chat-messages')) continue;
        const r = e.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 40)) {
          addViolation('touch-target', `${Math.round(r.width)}×${Math.round(r.height)} < 40`, el);
          touchFound++;
        }
      }
    }

    // 1.4 text-clip
    const clipCandidates = document.querySelectorAll(
      'h1, h2, h3, .page-title, .num, .stat-card, button, .ch-item b, .pal-lbl'
    );
    let clipFound = 0;
    for (const el of clipCandidates) {
      if (clipFound >= 12) break;
      if (!visible(el)) continue;
      const e = el as HTMLElement;
      const st = getComputedStyle(e);
      if (st.overflowX === 'auto' || st.overflowX === 'scroll') continue;
      const hasAbsChild = Array.from(e.children).some(ch => {
        const p = getComputedStyle(ch).position;
        return p === 'absolute' || p === 'fixed';
      });
      if (hasAbsChild) continue;
      if (e.scrollWidth > e.clientWidth + 2) {
        addViolation('text-clip', `scrollW ${e.scrollWidth} > clientW ${e.clientWidth}`, el);
        clipFound++;
      }
    }

    // ════════════════════════════════════════════════════════════
    // 2) YENİ YOXLAMALAR
    // ════════════════════════════════════════════════════════════

    // 2.1 Layout overlap (üst‑üstə düşmə)
    // Sadə yanaşma: bütün position: absolute/fixed elementləri yoxla
    const positioned = document.querySelectorAll('[style*="position: absolute"], [style*="position: fixed"]');
    // Daha etibarlı: getComputedStyle ilə
    const allEls = document.querySelectorAll('*');
    const positionedEls: HTMLElement[] = [];
    for (const el of allEls) {
      const e = el as HTMLElement;
      const st = getComputedStyle(e);
      if ((st.position === 'absolute' || st.position === 'fixed') && visible(e)) {
        positionedEls.push(e);
      }
    }
    // Cüt‑cüt yoxla (məhdud sayda)
    for (let i = 0; i < positionedEls.length && i < 30; i++) {
      for (let j = i + 1; j < positionedEls.length && j < 30; j++) {
        const a = positionedEls[i];
        const b = positionedEls[j];
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        if (
          ra.left < rb.right && ra.right > rb.left &&
          ra.top < rb.bottom && ra.bottom > rb.top
        ) {
          // Əgər biri digərinin içindədirsə, əhəmiyyət vermə (məsələn, dropdown içindəki menu)
          if (ra.width * ra.height > rb.width * rb.height && a.contains(b)) continue;
          if (rb.width * rb.height > ra.width * ra.height && b.contains(a)) continue;
          addViolation('layout-overlap', `Elementlər üst‑üstə düşür: ${sel(a)} və ${sel(b)}`, a);
          break;
        }
      }
    }

    // 2.2 Flex/Grid wrapping validation
    const flexContainers = document.querySelectorAll('[style*="display: flex"], [style*="display: inline-flex"]');
    for (const el of flexContainers) {
      const e = el as HTMLElement;
      const st = getComputedStyle(e);
      if (st.display === 'flex' || st.display === 'inline-flex') {
        if (st.flexWrap === 'nowrap') {
          // Əgər uşaqların cəmi eni konteynerdən çoxdursa
          let totalWidth = 0;
          for (const child of e.children) {
            const r = (child as HTMLElement).getBoundingClientRect();
            totalWidth += r.width + parseFloat(getComputedStyle(child as HTMLElement).marginLeft || '0') +
              parseFloat(getComputedStyle(child as HTMLElement).marginRight || '0');
          }
          if (totalWidth > e.clientWidth + 2) {
            addViolation('flex-wrap', `Uşaqlar konteynerə sığmır (${Math.round(totalWidth)} > ${e.clientWidth})`, el);
          }
        }
      }
    }
    // Grid
    const gridContainers = document.querySelectorAll('[style*="display: grid"], [style*="display: inline-grid"]');
    for (const el of gridContainers) {
      const e = el as HTMLElement;
      const st = getComputedStyle(e);
      if (st.display === 'grid' || st.display === 'inline-grid') {
        const cols = st.gridTemplateColumns;
        if (cols && cols !== 'none' && !cols.includes('auto') && !cols.includes('fr')) {
          // Sabit enli grid – daşma ola bilər
          let totalColWidth = 0;
          // sadə: bütün uşaqların enini yığ
          for (const child of e.children) {
            const r = (child as HTMLElement).getBoundingClientRect();
            totalColWidth += r.width + parseFloat(getComputedStyle(child as HTMLElement).marginLeft || '0') +
              parseFloat(getComputedStyle(child as HTMLElement).marginRight || '0');
          }
          if (totalColWidth > e.clientWidth + 2) {
            addViolation('grid-wrap', `Grid uşaqları daşır (${Math.round(totalColWidth)} > ${e.clientWidth})`, el);
          }
        }
      }
    }

    // 2.3 Fixed/Sticky collision
    const fixedSticky = document.querySelectorAll('[style*="position: fixed"], [style*="position: sticky"]');
    for (const el of fixedSticky) {
      const e = el as HTMLElement;
      if (!visible(e)) continue;
      const st = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      // Əgər fixed element viewportun xaricindədirsə
      if (r.top < -10 || r.bottom > vh + 10 || r.left < -10 || r.right > vw + 10) {
        addViolation('fixed-sticky-collision', `Fixed/sticky element viewportdan kənar: top=${Math.round(r.top)}`, el);
      }
      // Başqa fixed/sticky ilə toqquşma (sadə)
      for (const other of fixedSticky) {
        if (other === el) continue;
        const ro = (other as HTMLElement).getBoundingClientRect();
        if (
          r.left < ro.right && r.right > ro.left &&
          r.top < ro.bottom && r.bottom > ro.top
        ) {
          addViolation('fixed-sticky-collision', `Fixed/sticky elementlər toqquşur: ${sel(el)} və ${sel(other)}`, el);
          break;
        }
      }
    }

    // 2.4 Horizontal scroll containers (qeyri‑intentional)
    const scrollContainers = document.querySelectorAll('[style*="overflow-x: auto"], [style*="overflow-x: scroll"]');
    for (const el of scrollContainers) {
      const e = el as HTMLElement;
      if (e.scrollWidth > e.clientWidth + 2) {
        // Əgər kod bloku, cədvəl və ya xüsusi class varsa, burax
        if (e.closest('pre, code, .table-wrap, .data-table, .heatmap, .chart')) continue;
        addViolation('horizontal-scroll-container', `Konteyner üfüqi scroll edir (scrollW ${e.scrollWidth} > clientW ${e.clientWidth})`, el);
      }
    }

    // 2.5 Responsive media overflow
    const media = document.querySelectorAll('img, svg, video, canvas, iframe');
    for (const el of media) {
      if (!visible(el)) continue;
      const e = el as HTMLElement;
      const parent = e.parentElement;
      if (!parent) continue;
      const pRect = parent.getBoundingClientRect();
      const eRect = e.getBoundingClientRect();
      if (eRect.width > pRect.width + 2 || eRect.height > pRect.height + 2) {
        addViolation('media-overflow', `Media ${eRect.width}x${eRect.height} konteynerdən (${pRect.width}x${pRect.height}) böyükdür`, el);
      }
    }

    // 2.6 Table responsiveness
    const tables = document.querySelectorAll('table');
    for (const table of tables) {
      const e = table as HTMLElement;
      const parent = e.parentElement;
      if (!parent) continue;
      const pWidth = parent.getBoundingClientRect().width;
      if (e.scrollWidth > pWidth + 2) {
        addViolation('table-overflow', `Cədvəl ${Math.round(e.scrollWidth)}px eni ilə konteynerdən (${Math.round(pWidth)}px) kənara çıxır`, table);
      }
    }

    // 2.7 Modal & Drawer responsiveness
    const modals = document.querySelectorAll('.modal, .drawer, [role="dialog"], [role="alertdialog"]');
    for (const el of modals) {
      if (!visible(el)) continue;
      const e = el as HTMLElement;
      const r = e.getBoundingClientRect();
      if (r.height > vh + 2 || r.width > vw + 2) {
        addViolation('modal-responsive', `Modal/drawer ölçüsü ${Math.round(r.width)}x${Math.round(r.height)} viewportdan (${vw}x${vh}) böyükdür`, el);
      }
    }

    // 2.8 Sidebar collapse
    const sidebars = document.querySelectorAll('.sidebar, .side-nav, .drawer-left, [class*="sidebar"]');
    for (const el of sidebars) {
      if (!visible(el)) continue;
      const e = el as HTMLElement;
      const st = getComputedStyle(e);
      // Əgər sidebar eni > 250px və ekran kiçikdirsə
      if (vw < 768 && e.offsetWidth > 250) {
        addViolation('sidebar-collapse', `Sidebar eni ${Math.round(e.offsetWidth)}px kiçik ekranda çox böyükdür`, el);
      }
    }

    // 2.9 Navbar collapse
    const navbars = document.querySelectorAll('nav, .navbar, .header-nav, [class*="navbar"]');
    for (const el of navbars) {
      if (!visible(el)) continue;
      const e = el as HTMLElement;
      // Əgər navbar uşaqları sığmırsa
      const children = Array.from(e.children);
      let totalChildWidth = 0;
      for (const child of children) {
        const r = (child as HTMLElement).getBoundingClientRect();
        totalChildWidth += r.width + parseFloat(getComputedStyle(child as HTMLElement).marginLeft || '0') +
          parseFloat(getComputedStyle(child as HTMLElement).marginRight || '0');
      }
      if (totalChildWidth > e.clientWidth + 2 && vw < 1024) {
        addViolation('navbar-collapse', `Navbar elementləri sığmır (${Math.round(totalChildWidth)} > ${e.clientWidth})`, el);
      }
    }

    // 2.10 Z-index conflicts
    const zIndexEls = document.querySelectorAll('*');
    const zMap: Record<string, HTMLElement[]> = {};
    for (const el of zIndexEls) {
      const e = el as HTMLElement;
      const st = getComputedStyle(e);
      const z = parseInt(st.zIndex);
      if (!isNaN(z) && z > 0) {
        if (!zMap[st.position]) zMap[st.position] = [];
        zMap[st.position].push(e);
      }
    }
    // Əgər eyni position-da z-index fərqi > 10 olan elementlər üst‑üstə düşürsə
    for (const pos of ['absolute', 'fixed', 'relative', 'sticky']) {
      const list = zMap[pos] || [];
      for (let i = 0; i < list.length && i < 20; i++) {
        for (let j = i + 1; j < list.length && j < 20; j++) {
          const a = list[i];
          const b = list[j];
          const za = parseInt(getComputedStyle(a).zIndex);
          const zb = parseInt(getComputedStyle(b).zIndex);
          if (Math.abs(za - zb) > 10) {
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();
            if (
              ra.left < rb.right && ra.right > rb.left &&
              ra.top < rb.bottom && ra.bottom > rb.top
            ) {
              addViolation('z-index-conflict', `Yüksək z-index fərqi (${za} vs ${zb}) və üst‑üstə düşmə`, a);
              break;
            }
          }
        }
      }
    }

    // 2.11 Scrollbar detection (viewport scrollbar görünürsə)
    const hasScrollbar = document.documentElement.scrollHeight > vh || document.documentElement.scrollWidth > vw;
    if (hasScrollbar) {
      // Əgər scrollbar səbəbiylə layout dəyişibsə (məsələn, body eni dəyişib)
      const bodyWidth = document.body.getBoundingClientRect().width;
      if (bodyWidth > vw && document.documentElement.scrollWidth > vw) {
        addViolation('scrollbar-detection', 'Scrollbar görünür və layout dəyişir (body eni viewportdan böyük)', document.body);
      }
    }

    // 2.12 CLS (Cumulative Layout Shift)
    try {
      const entries = performance.getEntriesByType('layout-shift') as any[];
      let totalCLS = 0;
      for (const entry of entries) {
        if (!entry.hadRecentInput) totalCLS += entry.value;
      }
      if (totalCLS > 0.1) {
        addViolation('cls', `CLS dəyəri ${totalCLS.toFixed(3)} (limit 0.1)`, document.documentElement);
      }
    } catch (_) { /* bəzi brauzerlər dəstəkləməyə bilər */ }

    // 2.13 Safe-area (iPhone notch)
    // Əgər fixed element top:0 və padding-top: env(safe-area-inset-top) yoxdursa
    const fixedTop = document.querySelectorAll('[style*="position: fixed"][style*="top: 0"]');
    for (const el of fixedTop) {
      const e = el as HTMLElement;
      const st = getComputedStyle(e);
      if (st.top === '0px' && !st.paddingTop.includes('safe-area-inset')) {
        addViolation('safe-area', 'Fixed element notch altında qala bilər (safe-area padding yoxdur)', el);
      }
    }

    // 2.14 Landscape orientation
    if (window.matchMedia('(orientation: landscape)').matches) {
      // Landscape-də layout pozuntusu: məsələn, elementlər çox hündürdür
      const tallEls = document.querySelectorAll('*');
      for (const el of tallEls) {
        const e = el as HTMLElement;
        if (!visible(e)) continue;
        const r = e.getBoundingClientRect();
        if (r.height > vh * 0.9 && r.width > vw * 0.5) {
          addViolation('landscape', `Element ${Math.round(r.width)}x${Math.round(r.height)} landscape-də çox böyükdür`, el);
          break;
        }
      }
    }

    // 2.15 Zoom (200%) – emulyasiya edilmir, yalnız xəbərdarlıq
    // Həqiqi zoom-u yoxlamaq üçün devicePixelRatio istifadə edilə bilər, amma bu etibarlı deyil.
    // Biz sadəcə mətn ölçülərini yoxlayırıq: əgər 1rem > 16px deyilsə, zoom ola bilər.
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    if (rootFontSize > 20) {
      addViolation('zoom', 'Zoom səviyyəsi yüksəkdir (root font-size > 20px). 200% zoom-da layout pozula bilər.', document.documentElement);
    }

    // 2.16 Accessibility responsive checks (WCAG)
    // a) Contrast: sadə yoxlama – mətnin fonu ilə kontrastı? Çox mürəkkəb, buraxırıq.
    // b) Text resizing: mətn ölçüsü px ilə verilibsə
    const textEls = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, a, button, label');
    for (const el of textEls) {
      const e = el as HTMLElement;
      const st = getComputedStyle(e);
      const fs = st.fontSize;
      if (fs && fs.endsWith('px')) {
        const size = parseFloat(fs);
        if (size < 12 && vw < 768) {
          addViolation('accessibility', `Mətn ölçüsü ${size}px çox kiçikdir (WCAG 1.4.4)`, el);
          break;
        }
      }
      // Touch target artıq yoxlanılıb.
    }

    // 2.17 Visual regression hook – screenshot tutulur (xaricdə)
    // Burada yalnız işarə qoyuruq, faktiki screenshot page.screenshot() ilə xaricdə çəkiləcək.
    // Heç bir pozuntu əlavə etmirik, amma nəticəyə əlavə edə bilərik.

    // ─── Nəticə ──────────────────────────────────────────────────────────────
    return out;
  });
}

// ─── Skor hesablaması ──────────────────────────────────────────────────────

export function computeScore(violations: Violation[]): number {
  const weights: Record<string, number> = { P0: 10, P1: 5, P2: 2, P3: 1 };
  let penalty = 0;
  for (const v of violations) {
    const p = v.priority || 'P3';
    penalty += weights[p] || 1;
  }
  const maxPenalty = 100; // 10 * 10 max
  const score = Math.max(0, 100 - Math.min(penalty, maxPenalty));
  return Math.round(score);
}

export function summarize(violations: Violation[]): AuditResult['summary'] {
  const byPriority = { P0: 0, P1: 0, P2: 0, P3: 0 };
  const byCategory: Record<string, number> = {};
  for (const v of violations) {
    const p = v.priority || 'P3';
    byPriority[p] = (byPriority[p] || 0) + 1;
    byCategory[v.category] = (byCategory[v.category] || 0) + 1;
  }
  return {
    total: violations.length,
    byPriority,
    byCategory,
  };
}

// ─── Tam audit (bütün səhifələr × bütün ölçülər) ──────────────────────────

export interface FullAuditResult {
  results: AuditResult[];
  overallScore: number;
  totalViolations: number;
}

export async function runFullAudit(
  page: Page,
  pages: AuditPage[] = AUDIT_PAGES,
  viewports: { w: number; h: number }[] = ALL_VIEWPORTS
): Promise<FullAuditResult> {
  const allResults: AuditResult[] = [];
  let totalViolations = 0;
  let totalScores = 0;

  for (const pageInfo of pages) {
    // Giriş tələb olunarsa, əvvəlcədən hazır olmalıdır (storageState)
    // Burada sadəcə navigation edirik.
    await page.goto(pageInfo.url, { waitUntil: 'networkidle' });
    if (pageInfo.open) {
      await pageInfo.open(page);
    }

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.waitForTimeout(300); // layout stabilləşməsi üçün

      const violations = await collectViolations(page);
      const score = computeScore(violations);
      const summary = summarize(violations);

      // Screenshot (opsional) – base64
      let screenshot: string | undefined;
      try {
        const buffer = await page.screenshot({ fullPage: true });
        screenshot = buffer.toString('base64');
      } catch (_) { }

      allResults.push({
        page: pageInfo.name,
        viewport: vp,
        violations,
        score,
        summary,
        screenshot,
      });

      totalViolations += violations.length;
      totalScores += score;
    }
  }

  const overallScore = allResults.length > 0 ? Math.round(totalScores / allResults.length) : 0;
  return { results: allResults, overallScore, totalViolations };
}

// ─── Hesabat generasiyası (JSON, Markdown, HTML) ──────────────────────────

export function generateReports(
  data: FullAuditResult,
  outputDir: string = './audit-reports'
): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // JSON
  fs.writeFileSync(
    path.join(outputDir, 'audit.json'),
    JSON.stringify(data, null, 2)
  );

  // Markdown
  let md = `# Responsive Audit Report\n\n`;
  md += `**Overall Score:** ${data.overallScore}/100\n`;
  md += `**Total Violations:** ${data.totalViolations}\n\n`;
  md += `## Results by Page & Viewport\n\n`;
  for (const res of data.results) {
    md += `### ${res.page} (${res.viewport.w}×${res.viewport.h})\n`;
    md += `- Score: ${res.score}\n`;
    md += `- Violations: ${res.violations.length}\n`;
    if (res.violations.length > 0) {
      md += `| Priority | Category | Detail | Selector | DOM Path | Recommendation |\n`;
      md += `|----------|----------|--------|----------|----------|----------------|\n`;
      for (const v of res.violations) {
        const dom = v.domPath || v.selector;
        md += `| ${v.priority || 'P3'} | ${v.category} | ${v.detail} | ${v.selector} | ${dom} | ${v.recommendation || '-'} |\n`;
      }
    }
    md += '\n';
  }
  fs.writeFileSync(path.join(outputDir, 'audit.md'), md);

  // HTML
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Responsive Audit</title>`;
  html += `<style>body{font-family:sans-serif;margin:2em}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f4}.P0{background:#ffdddd}.P1{background:#ffeeaa}.P2{background:#ffffcc}.P3{background:#f0f0f0}.score{font-size:2em;font-weight:bold}</style>`;
  html += `</head><body><h1>Responsive Audit Report</h1>`;
  html += `<p><strong>Overall Score:</strong> <span class="score">${data.overallScore}</span>/100</p>`;
  html += `<p><strong>Total Violations:</strong> ${data.totalViolations}</p>`;
  for (const res of data.results) {
    html += `<h2>${res.page} (${res.viewport.w}×${res.viewport.h}) – Score: ${res.score}</h2>`;
    if (res.violations.length === 0) {
      html += `<p>✅ No violations.</p>`;
    } else {
      html += `<table><tr><th>Priority</th><th>Category</th><th>Detail</th><th>Selector</th><th>DOM Path</th><th>Recommendation</th></tr>`;
      for (const v of res.violations) {
        const cls = v.priority || 'P3';
        html += `<tr class="${cls}"><td>${cls}</td><td>${v.category}</td><td>${v.detail}</td><td>${v.selector}</td><td>${v.domPath || v.selector}</td><td>${v.recommendation || '-'}</td></tr>`;
      }
      html += `</table>`;
    }
    html += `<hr>`;
  }
  html += `</body></html>`;
  fs.writeFileSync(path.join(outputDir, 'audit.html'), html);
}

// ─── Konfiqurasiya (əvvəlki kimi) ──────────────────────────────────────────

export const VIEWPORTS = {
  mobile: [
    { w: 320, h: 568 }, { w: 360, h: 800 }, { w: 375, h: 812 }, { w: 390, h: 844 },
    { w: 414, h: 896 }, { w: 430, h: 932 }, { w: 480, h: 853 }, { w: 540, h: 960 },
    { w: 576, h: 1024 }, { w: 640, h: 1136 }
  ],
  tablet: [
    { w: 768, h: 1024 }, { w: 820, h: 1180 }, { w: 853, h: 1280 }, { w: 912, h: 1368 }, { w: 1024, h: 1366 }
  ],
  desktop: [
    { w: 1152, h: 864 }, { w: 1280, h: 720 }, { w: 1366, h: 768 }, { w: 1440, h: 900 },
    { w: 1536, h: 864 }, { w: 1600, h: 900 }, { w: 1728, h: 1117 }, { w: 1920, h: 1080 },
    { w: 2560, h: 1440 }
  ],
};
export const ALL_VIEWPORTS = [...VIEWPORTS.mobile, ...VIEWPORTS.tablet, ...VIEWPORTS.desktop];

export interface AuditPage { name: string; url: string; auth: boolean; open?: (page: Page) => Promise<void> }

export const AUDIT_PAGES: AuditPage[] = [
  { name: 'welcome', url: '/', auth: false },
  { name: 'about', url: '/about', auth: false },
  { name: 'faq', url: '/faq', auth: false },
  { name: 'contact', url: '/contact', auth: false },
  { name: 'privacy', url: '/privacy', auth: false },
  { name: 'terms', url: '/terms', auth: false },
  { name: 'changelog', url: '/changelog', auth: false },
  { name: 'home', url: '/#home', auth: true },
  { name: 'feed', url: '/#home', auth: true },
  { name: 'chat', url: '/#chat', auth: true },
  { name: 'dm', url: '/#dm', auth: true },
  { name: 'notifs', url: '/#notifs', auth: true },
  { name: 'users', url: '/#users', auth: true },
  { name: 'tasks', url: '/#tasks', auth: true },
  { name: 'stats', url: '/#stats', auth: true },
  { name: 'saved', url: '/#saved', auth: true },
  { name: 'profil', url: '/#profil', auth: true },
  { name: 'settings', url: '/#settings', auth: true },
  { name: 'admin', url: '/#admin', auth: true },
  { name: 'teams', url: '/#teams', auth: true },
  { name: 'team', url: `/#team/${E2E_TEAM.slug}`, auth: true },
];