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
  if(/^#[0-9a-f]{6}$/i.test(item.color || '')){
    dot.style.background = `color-mix(in srgb, ${item.color} 26%, transparent)`;
    dot.style.color = `color-mix(in srgb, ${item.color} 72%, var(--text))`;
  } else {
    const hue = hashHue(item.id || label);
    dot.style.background = `hsl(${hue} 45% 32% / .35)`;
    dot.style.color = `hsl(${hue} 80% 78%)`;
  }
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
