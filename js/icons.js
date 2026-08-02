// Ortaq SVG ikon fabriki + təkrar-istifadə olunan "Kopyala" komponenti.
// Əvvəllər bunlar feed.js-in içində idi və ixrac olunmurdu; public qat (homepage)
// feed.js-i import edə bilmir (o, store.js/auth zəncirini bundle-a dartır).
// Buraya çıxarıldı → feed.js və public.js EYNİ implementasiyanı işlədir.
import { el, clear } from './util.js';
// SVG/ICONS/paintIcons ayrıca saf modulda (dövr qırıldı) — buradan yenidən ixrac.
import { SVG } from './icon-set.js';
export { SVG, ICONS, paintIcons } from './icon-set.js';
import { toast } from './ui.js';
import { t } from './i18n.js';


export const iconCopy = () => SVG(
  '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  { w: '14', h: '14' },
);

export const iconCheck = () => SVG('<polyline points="20 6 9 17 4 12"/>', { w: '14', h: '14' });

/* ---------- əməliyyat ikonları (AUDIT-UI) ----------
 * Əvvəl bu yerlərdə emoji/simvol qlifləri idi ('🗑' '✎' '➤' '✕'). Emoji
 * platformadan-platformaya dəyişir, `currentColor` ilə rənglənmir və ekran
 * oxuyucusunda "wastebasket" kimi oxunur. Lucide SVG-yə keçirildi. */
export const iconTrash = () => SVG(
  '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>'
  + '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  { w: '14', h: '14' },
);

export const iconEdit = () => SVG(
  '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  { w: '14', h: '14' },
);

export const iconSend = () => SVG(
  '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  { w: '14', h: '14' },
);

export const iconX = () => SVG(
  '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  { w: '14', h: '14' },
);

/* AUDIT-UI: admin panelindəki "müvəqqəti şifrə" düyməsi '🔑' emojisi idi,
 * halbuki bir sətir yuxarıdakı redaktə düyməsi artıq SVG işlədirdi. */
export const iconLock = () => SVG(
  '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  { w: '14', h: '14' },
);

/* AUDIT-UI: komanda sahibliyinin köçürülməsi düyməsi '👑' emojisi idi. */
export const iconAward = () => SVG(
  '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>',
  { w: '14', h: '14' },
);


/* ---------- addım ikonları (Ana#8) — vahid Lucide üslubu ---------- */
export const STEP_ICONS = [
  // Qeydiyyatdan keç (user-plus)
  () => SVG('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>', { w: '20', h: '20' }),
  // İcmaya qoşul (users)
  () => SVG('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', { w: '20', h: '20' }),
  // Öyrən və paylaş (code)
  () => SVG('<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>', { w: '20', h: '20' }),
  // İnkişafını izlə (trending-up)
  () => SVG('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>', { w: '20', h: '20' }),
];

/* ---------- "Kopyala" düyməsi ---------- */
// getText: kopyalanacaq mətni qaytaran funksiya (və ya birbaşa string).
// Klikdə: clipboard → ✓ "Kopyalandı" state (2s) → toast. Xəta olsa err toast.
export function copyButton(getText, { cls = 'code-copy', label = null } = {}){
  const text = () => (typeof getText === 'function' ? getText() : getText);
  const lbl = () => label ?? t('feed.copy_btn');
  let resetTimer = null;

  const btn = el('button', {
    class: cls,
    type: 'button',
    'aria-label': lbl(),
    onclick: async e => {
      const b = e.currentTarget;
      try{
        await navigator.clipboard.writeText(text());
        clearTimeout(resetTimer);
        b.classList.add('copied');
        clear(b);
        b.append(iconCheck(), t('dyn.copied'));
        resetTimer = setTimeout(() => {
          b.classList.remove('copied');
          clear(b);
          b.append(iconCopy(), lbl());
        }, 2000);
        toast(t('dyn.copy_ok'));
      }catch(err){
        toast(t('dyn.copy_fail'), 'err');
      }
    },
  }, iconCopy(), lbl());
  return btn;
}
