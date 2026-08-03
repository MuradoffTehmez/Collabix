// Texnologiya nişanları (TASK-6 / Ana#7): rəsmi loqolu kiçik badge.
// Loqolar LOKAL bundle-dadır (techlogos.data.js — simple-icons-dan generasiya olunub);
// heç bir xarici CDN-ə sorğu getmir → perf + etibarlılıq + CSP təmizliyi.
import { TECH_ICONS } from './techlogos.data.js';
import { el, hashHue } from './util.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// #rrggbb → relativ luminans (WCAG). Brend rəngi fonla qaynayıb-qaynamadığını bilmək üçün.
function luminance(hex){
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if(!m) return 0.5;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

// Rust (#000000) və GitHub (#181717) kimi qara loqolar tünd temada görünmür,
// JavaScript (#F7DF1E) kimi çox açıqlar isə light temada itir. Belə hallarda
// brend rəngindən imtina edib currentColor-a keçirik — tema öz mətn rəngini verir.
function safeFill(hex){
  const l = luminance(hex);
  return (l < 0.06 || l > 0.85) ? 'currentColor' : hex;
}

function svgLogo(icon){
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', icon.d);
  path.setAttribute('fill', safeFill(icon.h));
  svg.append(path);
  return svg;
}

// Loqosu olmayan texnologiyalar (C#, Java, SQL — simple-icons-da trademark
// səbəbi ilə yoxdur) üçün: taksonomiyanın öz rəngi, yoxdursa ad-hash-ından
// determinist HSL. avatarNode()-dakı eyni məntiq — vizual dil bir qalır.
function initialBadge(item){
  const label = item.label || '?';
  const short = label.replace(/[^\p{L}\p{N}#+]/gu, '').slice(0, 2).toUpperCase() || '?';
  const dot = el('span', { class: 'tl-initial' }, short);
  // 🔴 KONTRAST: mətn `var(--text)`-ə BAĞLI qalmalıdır, brend rənginə yox.
  //
  //   Əvvəl mətn `color-mix(… 72%, var(--text))` idi, yəni brend rəngi
  //   üstünlük təşkil edirdi. Ölçmə (4 tema × 10 rəng) göstərdi ki, bu,
  //   30 kombinasiyanın 10-unu WCAG AA-dan kəsir: tünd brend rəngi (C#
  //   #68217A → 2.80:1) tünd temada, açıq rəng (Java #ED8B00 → 2.92:1)
  //   açıq temada oxunmur. Hash-fallback budağı daha pis idi — sabit
  //   `hsl(h 80% 78%)` açıq temada 1.02:1, yəni praktiki olaraq görünməz.
  //
  //   İndi hər iki budaq eyni düsturdadır: fon 26% (dizayn dəyişmir),
  //   mətn isə cəmi 35% brend çaları + 65% `--text`. Ölçülən ən pis hal:
  //   sabit rənglərdə 5.32:1, hash çalarlarında 5.50:1 — hamısı AA-dan yuxarı.
  //   Rəng kimliyi 35% çalarda hələ də seçilir.
  const base = /^#[0-9a-f]{6}$/i.test(item.color || '')
    ? item.color
    : `hsl(${hashHue(item.id || label)} 70% 50%)`;
  dot.style.background = `color-mix(in srgb, ${base} 26%, transparent)`;
  dot.style.color = `color-mix(in srgb, ${base} 35%, var(--text))`;
  return dot;
}

// Taksonomiya elementindən (prog və ya spoken) nişan qurur.
// prog → rəsmi loqo / initial fallback; spoken → bayraq emojisi.
// onClick verilsə <button>, verilməsə <span> qaytarır (Ana#10 klik-tag filtri).
export function techBadge(item, { onClick = null, size = 'md' } = {}){
  const icon = TECH_ICONS[item.id];
  const mark = item.flag
    ? el('span', { class: 'tl-flag' }, item.flag)
    : (icon ? svgLogo(icon) : initialBadge(item));

  const attrs = { class: `tech-badge tb-${size}` + (onClick ? ' tb-click' : '') };
  if(onClick){
    attrs.type = 'button';
    attrs.onclick = () => onClick(item);
  }
  return el(onClick ? 'button' : 'span', attrs, mark, el('span', { class: 'tl-label' }, item.label));
}

// Sosial loqo (footer — Ana#12). Discord/GitHub simple-icons-dadır;
// LinkedIn orada YOXDUR (trademark) → çağıran tərəf mətn-mark ötürür.
export function socialIcon(id, fallbackText){
  const icon = TECH_ICONS[id];
  if(!icon) return el('span', { class: 'pf-soc-mark' }, fallbackText || '?');
  const svg = svgLogo(icon);
  svg.setAttribute('width', '17');
  svg.setAttribute('height', '17');
  // Footer ikonları temaya uyğun rənglənir (hover-də brend rəngi CSS-dən gəlir).
  svg.querySelector('path').setAttribute('fill', 'currentColor');
  return svg;
}

export const hasTechLogo = id => Boolean(TECH_ICONS[id]);
