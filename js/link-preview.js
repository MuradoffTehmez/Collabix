/* link-preview.js — Link önizləmə kartı (OG unfurl) — ÇAT, POST və ŞƏRH ortaq.
 *
 * ⚠ NİYƏ AYRICA MODUL: ilk versiya `chat-message.js`-in içində idi və yalnız
 *   çat mesajlarında işləyirdi. Eyni davranış postda və şərhdə də lazımdır
 *   (istifadəçi istəyi) — nüsxələmək əvəzinə bir yerə çıxarılıb. Bu layihədə
 *   təkrarlanan dərs budur: iki nüsxə vaxtla ayrılır.
 *
 * ⚠ Server tərəfi `worker/link-preview.ts`-dədir və SSRF qapıları oradadır
 *   (daxili host, `file:` sxemi, timeout, ölçü həddi). Client HEÇ NƏ
 *   yoxlamır — yoxlama serverdə olmalıdır.
 */
import { el } from './util.js';
import { api } from './api.js';

/** Mətndəki İLK http(s) linki. */
export const firstUrl = (text) => (String(text || '').match(/https?:\/\/\S+/i) || [])[0] || null;

/* Eyni link səhifədə təkrarlana bilər — nəticə səhifə ömrü boyu keşlənir
 * (server də KV-də 24 saat saxlayır, bu isə şəbəkə sorğusunu tamam kəsir).
 * `null` dəyəri "önizləmə YOXDUR" deməkdir və təkrar sorğunu dayandırır. */
const cache = new Map();

/**
 * `host` elementinin altına link kartı əlavə edir.
 *
 * @param {Element} observeEl  görünürlük izlənən element (adətən kart/balon)
 * @param {Element} mountAfter kartın YERLƏŞDİRİLƏCƏYİ element (onun ardınca)
 * @param {string}  url
 *
 * ⚠ Sorğu TƏNBƏLDİR (`IntersectionObserver`): ekrana çıxmayan post/mesaj üçün
 *   xarici sayta sorğu atmaq həm yavaş, həm nəzakətsizdir. Feed uzun olduğu
 *   üçün bu, xüsusilə vacibdir.
 * ⚠ Uğursuzluq SƏSSİZDİR: önizləmə əlavə bəzəkdir, məzmun onsuz da görünür.
 */
export function attachLinkPreview(observeEl, mountAfter, url){
  if(!url || !observeEl || !mountAfter) return;
  const io = new IntersectionObserver(async entries => {
    if(!entries.some(e => e.isIntersecting)) return;
    io.disconnect();
    try{
      let p = cache.get(url);
      if(p === undefined){
        const r = await api('/link-preview?url=' + encodeURIComponent(url));
        p = r?.preview || null;
        cache.set(url, p);
      }
      // Node bu arada silinmiş ola bilər (otaq dəyişdi, feed yeniləndi).
      if(!p || !mountAfter.isConnected) return;
      mountAfter.after(buildCard(p));
    }catch(e){
      // Xəta da keşlənir ki, sürüşdükcə eyni sorğu təkrarlanmasın.
      cache.set(url, null);
    }
  }, { rootMargin: '200px' });
  io.observe(observeEl);
}

function buildCard(p){
  const card = el('a', {
    class: 'msg-link-card', href: p.url, target: '_blank', rel: 'noopener noreferrer',
    'aria-label': p.title + ' — ' + p.site,
  });
  if(p.image){
    const img = document.createElement('img');
    img.src = p.image; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    // Şəkil yüklənməsə kart mətnlə qalsın (sınıq ikon görünməsin).
    img.addEventListener('error', () => img.remove());
    card.append(img);
  }
  card.append(el('span', { class: 'lc-body' },
    el('span', { class: 'lc-site' }, p.site),
    el('span', { class: 'lc-title' }, p.title),
    p.desc ? el('span', { class: 'lc-desc' }, p.desc) : null,
  ));
  return card;
}
