/* code-block.js — Kod bloku komponenti: syntax highlighting · dil nişanı ·
 * kopyala · sətir nömrələri · yığma (folding) · üfüqi sürüşmə göstəricisi.
 *
 * ⚠ NİYƏ AYRICA MODUL: bu komponent `feed.js`-in içində qapalı idi və
 *   YALNIZ post axını onu işlədirdi. Çat mesajları (`richmsg.js`) isə sadə
 *   `<pre><code>` çəkirdi — yəni eyni platformada kod İKİ FƏRQLİ görünüşdə
 *   idi: postda sətir nömrəli, nişanlı, kopyalana bilən; çatda quru mətn.
 *   Kod paylaşımı Collabix-in əsas ssenarisi olduğu üçün bu fərq qəbuledilməz
 *   idi. İndi hər iki yol eyni funksiyanı çağırır.
 *
 * ⚠ `feed.js`-dən İMPORT ETMİR: `richmsg.js` onsuz da `feed.js`-dən
 *   `openImageModal` alır; kod blokunu da oradan almaq bağlılığı daha da
 *   sıxlaşdırardı. Bu modul yalnız saf köməkçilərdən asılıdır.
 */
import { el, highlightEl } from './util.js';
import { highlightOptions } from './taxonomy.js';
import { copyButton, iconChevron } from './icons.js';
import { t } from './i18n.js';

/**
 * @param {string} content  kodun mətni
 * @param {string} [language] `highlight.js` dil id-si
 * @param {{compact?: boolean}} [opts] `compact` — çat balonu üçün daha dar variant
 */
export function codeBlockNode(content, language, opts = {}){
  const code = document.createElement('code');
  if(language) code.className = 'language-' + language;
  code.textContent = content;

  /* 🔴 SƏTİR NÖMRƏLƏRİ AYRICA SÜTUNDADIR ("gutter"), kodun İÇİNDƏ DEYİL.
   *
   * Əvvəlki variant hər sətri `<span class="code-line">`-a bükür və CSS
   * sayğacı ilə nömrələyirdi. Bu, SƏSSİZCƏ SINIQ idi: `highlightEl` →
   * `hljs.highlightElement()` kod elementinin `innerHTML`-ini TAM ƏVƏZ EDİR
   * və həmin span-ları silir. Ölçüldü: render-dən sonra `.code-line` sayı 0.
   * (Qüsur `feed.js`-də də vardı — nömrələr heç vaxt görünmürdü.)
   *
   * Highlight-dan SONRA yenidən bükmək də etibarsızdır: hljs çıxışında span
   * blok şərh və şablon sətirlərində SƏTİRLƏRİ KƏSİR, ona görə `\n` üzrə
   * bölmək markup-ı pozar.
   *
   * ⚠ Gutter `aria-hidden` — ekran oxuyucusu rəqəmləri kodla qarışdırmasın.
   * ⚠ Nömrələr `<pre>`-dən KƏNARDADIR, deməli kodu seçib kopyalayanda
   *   nömrələr köçürülmür (yapışdırılan kod işlək qalır). */
  const lineCount = content.split('\n').length;
  const gutter = el('div', { class: 'code-gutter', 'aria-hidden': 'true' },
    Array.from({ length: lineCount }, (_, i) => String(i + 1)).join('\n'));

  const pre = el('pre', {}, code);
  const langLbl = (highlightOptions().find(o => o.highlightId === language) || {}).label
    || language || t('code.plain');

  const copyBtn = copyButton(content);

  const collapseBtn = el('button', {
    type: 'button', class: 'code-collapse-btn',
    'aria-label': t('code.toggle'), title: t('code.toggle'),
    'aria-expanded': 'true',
    onclick: () => {
      const on = wrap.classList.toggle('collapsed');
      collapseBtn.setAttribute('aria-expanded', String(!on));
    },
  }, iconChevron());

  /* ⚠ `show-lines` sinfi QƏSDƏN VERİLMİR: o, `20-feed.css`-dəki KÖHNƏ
   * sətir-nömrəsi üsulunu (CSS sayğacı + `code { padding-left: 52px }`)
   * işə salır. Həmin üsul hljs `innerHTML`-i əvəz etdiyi üçün onsuz da
   * sınıq idi, amma padding qalıb kodu gutter-dən 12px aşağı sürüşdürürdü
   * (ölçüldü). Nömrələr indi ayrıca `.code-gutter` sütunundadır. */
  const wrap = el('div', { class: 'feed-code' + (opts.compact ? ' compact' : '') },
    el('div', { class: 'code-head' },
      el('span', { class: 'code-lang-badge' }, langLbl),
      el('div', { class: 'code-head-actions' }, collapseBtn, copyBtn)),
    // Gutter + kod yan-yana; `pre` yalnız ÜFÜQİ sürüşür, şaquli sürüşmə
    // bütöv gövdəyə aiddir ki, nömrələr kodla sinxron qalsın.
    el('div', { class: 'code-body' }, gutter, pre));

  /* Üfüqi sürüşmə göstəricisi: sağ kənarda solğunlaşma yalnız DAHA ÇOX
   * məzmun varsa görünür (sona çatanda itir) — istifadəçi sağa sürüşə
   * biləcəyini bilməlidir. */
  requestAnimationFrame(() => {
    const sync = () => {
      const atEnd = pre.scrollLeft + pre.clientWidth >= pre.scrollWidth - 4;
      wrap.classList.toggle('has-scroll', !atEnd && pre.scrollWidth > pre.clientWidth);
    };
    sync();
    pre.addEventListener('scroll', sync, { passive: true });
  });

  highlightEl(code);
  return wrap;
}
