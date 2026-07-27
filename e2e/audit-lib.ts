// Responsive audit kitabxanası (TASK-9 / FAZA 1).
//
// Detection-first: səhifədə responsive pozuntularını PROQRAMLA ölçür.
// Bütün ölçmə funksiyaları BROWSER kontekstində icra olunur (page.evaluate) —
// çünki `getBoundingClientRect`, `scrollWidth` və s. yalnız real DOM-da mövcuddur.
import type { Page } from '@playwright/test';
import { E2E_TEAM } from './fixtures';

export interface Violation {
  category: 'overflow-x' | 'element-overflow' | 'touch-target' | 'text-clip';
  detail: string;
  selector: string;
}

// Bir səhifə + ölçüdə bütün pozuntuları toplayır.
// Nəticə səhifə daxilində hesablanır və seriallaşdırıla bilən massiv qaytarır.
export async function collectViolations(page: Page): Promise<Violation[]> {
  return page.evaluate(() => {
    const out: Array<{ category: string; detail: string; selector: string }> = [];
    const vw = window.innerWidth;

    // Elementə oxunaqlı seçici yaratmaq (hesabatda günahkarı tapmaq üçün).
    const sel = (el: Element): string => {
      const e = el as HTMLElement;
      const id = e.id ? '#' + e.id : '';
      const cls = (e.className && typeof e.className === 'string')
        ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      return (e.tagName.toLowerCase() + id + cls).slice(0, 80);
    };

    // Yalnız GÖRÜNƏN elementlər sayılır — gizli elementlərin rect-i yalançı
    // pozuntu verərdi (məs. `display:none` dropdown/modal içindəki düymələr).
    const visible = (el: Element): boolean => {
      const e = el as HTMLElement;
      const r = e.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      const st = getComputedStyle(e);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
      // `offsetParent === null` = element və ya VALİDEYN zənciri display:none
      // (dropdown/modal açıq deyil). `position:fixed` istisna — orada offsetParent
      // təbii null-dur, amma element görünə bilər.
      if (e.offsetParent === null && st.position !== 'fixed') return false;
      return true;
    };

    /* ---------- 1) Səhifə səviyyəsində üfüqi overflow (P0) ---------- */
    const docW = document.documentElement.scrollWidth;
    if (docW > vw + 1) {
      out.push({ category: 'overflow-x', detail: `scrollWidth ${docW} > innerWidth ${vw}`, selector: 'html' });
    }

    /* ---------- 2) Viewport-dan çıxan konkret elementlər ---------- */
    // Yalnız docW > vw olduqda axtarırıq — əks halda hər sağ kənar elementi
    // "pozuntu" kimi göstərməzik (normal layout). Günahkarı tapmaq üçün.
    if (docW > vw + 1) {
      const all = document.querySelectorAll('body *');
      let found = 0;
      for (const el of all) {
        if (found >= 12) break;   // hesabatı boğmamaq üçün ilk 12 günahkar
        if (!visible(el)) continue;
        const r = el.getBoundingClientRect();
        // 2px tolerantlıq: sub-piksel yuvarlaqlaşma yalançı pozuntu verməsin.
        if (r.right > vw + 2 || r.left < -2) {
          // Valideyni artıq daşırsa uşağı sayma (kök səbəbə fokuslan).
          const parent = el.parentElement;
          if (parent && parent.getBoundingClientRect().right > vw + 2) continue;
          out.push({
            category: 'element-overflow',
            detail: `right=${Math.round(r.right)} left=${Math.round(r.left)} vw=${vw}`,
            selector: sel(el),
          });
          found++;
        }
      }
    }

    /* ---------- 3) Touch target < 44×44 ---------- */
    // Touch target YALNIZ touch cihazlarında (mobil/tablet ≤1024px) məna kəsb
    // edir — desktop-da siçan var, 40px düymə tam əlçatandır. Bütün 13 ölçüdə
    // yoxlamaq desktop üçün yalançı pozitiv verərdi.
    if (vw <= 1024) {
      const interactive = document.querySelectorAll(
        'button, a, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=option]',
      );
      let touchFound = 0;
      for (const el of interactive) {
        if (touchFound >= 20) break;
        if (!visible(el)) continue;
        const e = el as HTMLElement;

        // İNTERAKTİV OLMAYAN elementlər istisna. `pointer-events` valideyndən
        // MİRAS alınır, ona görə bağlı dropdown/menu (`opacity:0; pointer-events:none`)
        // içindəki düymələrdə `getComputedStyle(button).pointerEvents === 'none'`
        // olur — düymə görünsə də (öz opacity-si 1) KLİK QƏBUL ETMİR, yəni
        // toxunma hədəfi deyil. Bu, elementin öz opacity-sinin valideyn opacity-sini
        // əks etdirməməsi boşluğunu bağlayır.
        if (getComputedStyle(e).pointerEvents === 'none') continue;

        // Checkbox/radio istisna: native form kontrolları həmişə kiçikdir
        // (~16-20px) və WCAG 2.5.5 onları toxunma hədəfi tələbindən azad edir
        // (label-ları da klik qəbul edir). 44px etmək qutunu deformasiya edərdi.
        const inputType = (e as HTMLInputElement).type;
        if (e.tagName === 'INPUT' && (inputType === 'checkbox' || inputType === 'radio')) continue;

        // İnline mətn linkləri istisna: paraqraf/hüquqi mətn/markdown/footer/
        // public məzmun içindəki linklər mətn axınının hissəsidir — 44px tələb
        // etmək mətni pozar. `pub-page`/`pub-body` public səhifə mətn blokudur.
        if (e.tagName === 'A' && e.closest(
          'p, .md-body, .legal-body, .app-footer, .pub-footer, footer, li, .pub-page, .pub-body, .contact-info',
        )) {
          continue;
        }
        // Mətn-içi düymələr istisna: mesaj başlığındakı göndərən adı, dense
        // texnologiya nişanları — bunlar funksional olaraq inline mətn linkidir
        // (adın/nişanın üstünə klik → profil/filtr), mətn axınının hissəsidir.
        // 44px tələb etmək qrup başlığını və nişan sırasını pozar.
        const cls = typeof e.className === 'string' ? e.className : '';
        if (/\b(mg-name|msg-name|tech-badge|pal-lbl)\b/.test(cls)) continue;
        // Qrup başlığındakı ad düyməsi (renderGroupedMessages `.name`).
        if (e.classList.contains('name') && e.closest('.msg-group, .chat-messages')) continue;

        const r = e.getBoundingClientRect();
        // 40px alt həddi (RESPONSIVE.md kiçik ikonlar üçün 40px icazə verir).
        if (r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 40)) {
          out.push({
            category: 'touch-target',
            detail: `${Math.round(r.width)}×${Math.round(r.height)} < 40`,
            selector: sel(e),
          });
          touchFound++;
        }
      }
    }

    /* ---------- 4) Mətn daşması / kəsilməsi ---------- */
    // Bir sətrə sığmalı elementlərdə üfüqi mətn daşması. `overflow-x:auto` olan
    // konteynerlər (heatmap, kod bloku, tab) QƏSDƏN scroll edir — onlar istisna.
    const clipCandidates = document.querySelectorAll('h1, h2, h3, .page-title, .num, .stat-card, button, .ch-item b, .pal-lbl');
    let clipFound = 0;
    for (const el of clipCandidates) {
      if (clipFound >= 12) break;
      if (!visible(el)) continue;
      const e = el as HTMLElement;
      const st = getComputedStyle(e);
      if (st.overflowX === 'auto' || st.overflowX === 'scroll') continue;
      // Absolute pozisiyalı uşağı olan element istisna: bildiriş badge-i
      // (`.nav-badge` "26") düymədən bir az çıxır və scrollWidth-i şişirdir,
      // amma bu, MƏTN daşması deyil — dizayn elementidir.
      const hasAbsChild = Array.from(e.children).some(ch => {
        const p = getComputedStyle(ch).position;
        return p === 'absolute' || p === 'fixed';
      });
      if (hasAbsChild) continue;
      // scrollWidth clientWidth-dən çox = məzmun sığmır (kəsilir və ya daşır).
      if (e.scrollWidth > e.clientWidth + 2) {
        out.push({
          category: 'text-clip',
          detail: `scrollW ${e.scrollWidth} > clientW ${e.clientWidth}`,
          selector: sel(e),
        });
        clipFound++;
      }
    }

    return out;
  });
}

/* ---------- ölçü matrisi ---------- */
export const VIEWPORTS = {
  mobile: [
    { w: 360, h: 800 }, { w: 375, h: 812 }, { w: 390, h: 844 }, { w: 412, h: 915 },
  ],
  tablet: [
    { w: 768, h: 1024 }, { w: 820, h: 1180 }, { w: 1024, h: 768 },
  ],
  desktop: [
    { w: 1280, h: 720 }, { w: 1366, h: 768 }, { w: 1440, h: 900 },
    { w: 1536, h: 864 }, { w: 1920, h: 1080 },
  ],
};
export const ALL_VIEWPORTS = [...VIEWPORTS.mobile, ...VIEWPORTS.tablet, ...VIEWPORTS.desktop];

// Audit edilən səhifələr. `auth: true` = storageState (giriş) tələb edir.
export interface AuditPage { name: string; url: string; auth: boolean; open?: (page: Page) => Promise<void> }

export const AUDIT_PAGES: AuditPage[] = [
  // Public (sessiyasız)
  { name: 'welcome', url: '/', auth: false },
  { name: 'about', url: '/about', auth: false },
  { name: 'faq', url: '/faq', auth: false },
  { name: 'contact', url: '/contact', auth: false },
  { name: 'privacy', url: '/privacy', auth: false },
  { name: 'terms', url: '/terms', auth: false },
  { name: 'changelog', url: '/changelog', auth: false },
  // App (giriş tələb edir)
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
  // TASK-11 — komanda iş sahəsi (siyahı + 10 tab-lı detal səhifəsi).
  { name: 'teams', url: '/#teams', auth: true },
  { name: 'team', url: `/#team/${E2E_TEAM.slug}`, auth: true },
];
