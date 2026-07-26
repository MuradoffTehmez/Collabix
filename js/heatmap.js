// GitHub-tipli aktivlik xəritəsi: 52 həftə × 7 gün, 5 intensivlik səviyyəsi,
// ay/həftə etiketləri, hover tooltip, legend, stagger-in animasiyası.
import { el, clear, onceInView } from './util.js';

const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'];
const WEEKDAYS = ['B.e', '', 'Çər', '', 'Cüm', '', 'Baz']; // hər 2-ci sətir boş (GitHub kimi)

function levelOf(c){
  if(!c) return 0;
  if(c <= 1) return 1;
  if(c <= 3) return 2;
  if(c <= 6) return 3;
  return 4;
}

export function renderHeatmapInto(container, activityDays = {}){
  clear(container);
  const today = new Date();
  // Başlanğıc: 52 həftə əvvəlki bazar ertəsi
  const start = new Date(today);
  start.setDate(start.getDate() - (52 * 7 - 1) - ((today.getDay() + 6) % 7));

  const grid = el('div', { class: 'hm-grid' });
  const monthsRow = el('div', { class: 'hm-months' });
  const tooltip = el('div', { class: 'hm-tooltip', role: 'tooltip' });

  let lastMonth = -1;
  let col = 0;
  const d = new Date(start);
  while(d <= today){
    const isMonday = ((d.getDay() + 6) % 7) === 0;
    if(isMonday){
      // yeni sütun — ay dəyişibsə etiket qoy
      if(d.getMonth() !== lastMonth){
        monthsRow.append(el('span', { class: 'hm-mlbl', style: `grid-column:${col + 1};` }, MONTHS[d.getMonth()]));
        lastMonth = d.getMonth();
      }
      col++;
    }
    const key = d.toISOString().slice(0, 10);
    const c = activityDays[key] || 0;
    const cell = el('div', {
      // Ana#4 — stagger yalnız xəritə viewport-a girəndə başlayır (aşağıda onceInView).
      // Gecikmə sütun indeksinə görə: sol→sağ dalğa effekti.
      class: 'hd lv' + levelOf(c),
      style: `--hd-delay:${Math.min(col * 6, 500)}ms;`,
      dataset: { date: key, count: c },
      tabindex: '0',
      'aria-label': `${c} fəaliyyət — ${key}`,
    });
    const showTip = () => {
      const dt = new Date(key);
      tooltip.textContent = `${c} fəaliyyət — ${dt.getDate()} ${MONTHS[dt.getMonth()].toLowerCase()} ${dt.getFullYear()}`;
      const r = cell.getBoundingClientRect();
      const wr = container.getBoundingClientRect();
      tooltip.style.left = (r.left - wr.left + r.width / 2) + 'px';
      tooltip.style.top = (r.top - wr.top - 30) + 'px';
      tooltip.classList.add('show');
    };
    cell.addEventListener('mouseenter', showTip);
    cell.addEventListener('focus', showTip);
    cell.addEventListener('mouseleave', () => tooltip.classList.remove('show'));
    cell.addEventListener('blur', () => tooltip.classList.remove('show'));
    grid.append(cell);
    d.setDate(d.getDate() + 1);
  }

  const weekdayCol = el('div', { class: 'hm-weekdays' },
    WEEKDAYS.map(w => el('span', {}, w)));

  const legend = el('div', { class: 'hm-legend' },
    'Az ',
    el('span', { class: 'hd lv0' }), el('span', { class: 'hd lv1' }),
    el('span', { class: 'hd lv2' }), el('span', { class: 'hd lv3' }),
    el('span', { class: 'hd lv4' }),
    ' Çox');

  container.append(
    el('div', { class: 'hm-scroll' },
      el('div', { class: 'hm-inner' },
        monthsRow,
        el('div', { class: 'hm-body' }, weekdayCol, grid),
      ),
    ),
    legend, tooltip,
  );
  // yeni məzmun yüklənəndə sağa (bu günə) sürüşdür
  const scroller = container.querySelector('.hm-scroll');
  requestAnimationFrame(() => { scroller.scrollLeft = scroller.scrollWidth; });

  // Ana#4 — xanalar yalnız xəritə görünəndə ardıcıl yanır, bir dəfə.
  // reduced-motion / IO yoxdursa onceInView dərhal çağırır → hamısı statik görünür.
  onceInView(container, () => grid.classList.add('hm-lit'), { threshold: 0.15 });
}
