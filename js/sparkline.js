// Sparkline (TASK-6 / Admin#8) — inline SVG, sıfır asılılıq.
// Xülasə kartının arxa planında kiçik trend qrafiki + hover tooltip.
import { el } from './util.js';

const NS = 'http://www.w3.org/2000/svg';

// values: ədədlər massivi (köhnədən yeniyə). labels: hover üçün mətnlər.
// Qrafik viewBox ilə ölçülür → kartın eninə uyğunlaşır, retina-da da kəskindir.
export function sparkline(values, { labels = [], w = 100, h = 28, tone = 'coral' } = {}){
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'spark spark-' + tone);
  svg.setAttribute('aria-hidden', 'true');   // dəyərlər kartda rəqəmlə onsuz da var
  svg.setAttribute('focusable', 'false');

  const nums = (values || []).map(v => Number(v) || 0);
  if(nums.length < 2) return svg;            // tək nöqtədən trend çıxmır

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;               // düz xətt halında sıfıra bölünmə
  const stepX = w / (nums.length - 1);
  // Yuxarı/aşağı 2px boşluq — xətt kənara yapışmasın.
  const pad = 2;
  const y = v => h - pad - ((v - min) / span) * (h - pad * 2);
  const pts = nums.map((v, i) => [i * stepX, y(v)]);

  const line = document.createElementNS(NS, 'path');
  line.setAttribute('d', pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '));
  line.setAttribute('class', 'spark-line');
  line.setAttribute('fill', 'none');

  // Xəttin altındakı sahə — trendi gözlə tutmağı asanlaşdırır.
  const area = document.createElementNS(NS, 'path');
  area.setAttribute('d',
    `M0 ${h} L` + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + ` L${w} ${h} Z`);
  area.setAttribute('class', 'spark-area');
  area.setAttribute('stroke', 'none');

  svg.append(area, line);
  return svg;
}

// Kart üçün hazır blok: sparkline + hover-də dəyər göstərən tooltip.
// Tooltip qrafikin özündə deyil, kartın küncündə göstərilir — kiçik SVG-də
// nöqtəyə tuş gətirmək çətindir, ona görə ən yaxın indeks hesablanır.
export function sparklineBlock(values, { labels = [], tone = 'coral' } = {}){
  const wrap = el('div', { class: 'spark-wrap' });
  const svg = sparkline(values, { labels, tone });
  const tip = el('span', { class: 'spark-tip' });
  wrap.append(svg, tip);

  const nums = (values || []).map(v => Number(v) || 0);
  if(nums.length > 1){
    wrap.addEventListener('mousemove', e => {
      const r = wrap.getBoundingClientRect();
      const ratio = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
      const i = Math.round(ratio * (nums.length - 1));
      tip.textContent = (labels[i] ? labels[i] + ': ' : '') + nums[i];
      tip.classList.add('on');
    });
    wrap.addEventListener('mouseleave', () => tip.classList.remove('on'));
  }
  return wrap;
}
