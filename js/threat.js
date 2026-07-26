// Təhlükə Monitorinqi paneli (TASK-8 / Bənd 1).
//
// Real-time DO fazası (FAZA 5) gələnə qədər canlılıq qısa POLLING ilə verilir —
// `startPoll` onsuz da `document.hidden` olanda dayanır, ona görə açıq olmayan
// tabda boş sorğu getmir.
import { api, startPoll } from './api.js';
import { el, clear, fmtTime } from './util.js';
import { sparklineBlock } from './sparkline.js';
import { t, fmtRelTime } from './i18n.js';

const POLL_MS = 20_000;

// Hadisə tipi → (etiket açarı, ton). Ton HƏM rəng, HƏM mətn etiketi verir —
// rəng tək siqnal deyil (rəng korluğu üçün, admin panelinin mövcud qaydası).
const TYPE_TONE = {
  token_reuse:      'danger',
  login_failed:     'warn',
  turnstile_failed: 'warn',
  rate_limit:       'warn',
  upload_rejected:  'warn',
  geo_change:       'info',
  session_revoked:  'info',
  password_changed: 'info',
  login_ok:         'ok',
};

const SEV_TONE = { critical: 'danger', warning: 'warn', info: 'info' };

let cursor = null;
let filters = { type: '', severity: '' };

/* ---------- xülasə kartları ---------- */
function renderSummary(d){
  const box = document.getElementById('threatSummary');
  if(!box) return;
  clear(box);

  const card = (num, label, tone) =>
    el('div', { class: 'stat-card adm-stat tone-' + tone },
      el('div', { class: 'num' }, String(num)),
      el('div', { class: 'lbl' }, label));

  box.append(
    card(d.critical, t('thr.c_critical'), 'danger'),
    card(d.warning, t('thr.c_warning'), 'warn'),
    card(d.byType.login_failed || 0, t('thr.c_failed'), 'alert'),
    card(d.total24h, t('thr.c_total'), 'info'),
  );

  // Uğursuz giriş trendi (24 saat) — mövcud sparkline komponenti.
  if(d.sparkline?.some(n => n > 0)){
    const hour = new Date().getHours();
    const labels = d.sparkline.map((_, i) => `${(hour - 23 + i + 24) % 24}:00`);
    const trend = el('div', { class: 'threat-trend' }, [
      el('div', { class: 'lbl' }, t('thr.trend')),
    ]);
    trend.append(sparklineBlock(d.sparkline, { labels, tone: 'danger' }));
    box.append(trend);
  }

  // Top IP-lər — auto-blok namizədləri.
  if(d.topIps?.length){
    const list = el('div', { class: 'threat-ips' }, el('div', { class: 'lbl' }, t('thr.top_ips')));
    d.topIps.forEach(r => {
      list.append(el('div', { class: 'threat-ip-row' }, [
        // IP-yə klik → həmin ünvan üzrə filtr. Ən çox istənilən əməliyyat budur.
        el('button', {
          class: 'link-btn', title: t('thr.filter_ip'),
          onclick: () => { filters.ip = r.ip; reload(); },
        }, r.ip),
        el('span', { class: 'threat-ip-meta' },
          `${[r.city, r.country].filter(Boolean).join(', ') || '—'} · ` +
          `${r.count} ${t('thr.attempts')} · ${r.targets} ${t('thr.targets')}`),
      ]));
    });
    box.append(list);
  }
}

/* ---------- hadisə sətri ---------- */
function eventRow(e){
  const tone = SEV_TONE[e.severity] || TYPE_TONE[e.type] || 'info';
  const who = e.username || e.uid || '—';
  const place = [e.city, e.country].filter(Boolean).join(', ');

  const metaTxt = Object.entries(e.meta || {})
    .map(([k, v]) => `${k}=${v}`).join(' ');

  const badgeClass = 'badge badge-' + (tone === 'danger' ? 'error' : tone === 'warn' ? 'warning' : 'info');

  return el('tr', {}, [
    el('td', {}, el('time', { datetime: new Date(e.createdAt).toISOString(), title: fmtTime(e.createdAt) }, fmtRelTime(e.createdAt))),
    el('td', {}, el('span', { class: badgeClass }, t('thr.sev_' + e.severity))),
    el('td', {}, el('b', {}, t('thr.t_' + e.type))),
    el('td', {}, who),
    el('td', { style: 'color:var(--text-sec); font-size:13px;' }, [e.ip, place, metaTxt].filter(Boolean).join(' · '))
  ]);
}

/* ---------- yükləmə ---------- */
async function loadEvents({ append = false } = {}){
  const box = document.getElementById('threatEvents');
  const more = document.getElementById('threatMore');
  if(!box) return;

  const q = new URLSearchParams();
  if(filters.type) q.set('type', filters.type);
  if(filters.severity) q.set('severity', filters.severity);
  if(filters.ip) q.set('ip', filters.ip);
  if(append && cursor) q.set('cursor', cursor);

  let d;
  try{
    d = await api('/admin/security/events?' + q.toString());
  }catch(e){
    if(!append) box.textContent = t('thr.err');
    return;
  }

  if(!append) clear(box);
  if(!d.events.length && !append){
    box.append(el('div', { class: 'threat-empty' }, t('thr.empty')));
  }
  d.events.forEach(e => box.appendChild(eventRow(e)));

  cursor = d.cursor;
  if(more) more.classList.toggle('hidden', !cursor);
}

function reload(){ cursor = null; loadEvents(); }

/* ---------- mount ---------- */
export function mountThreatPanel(){
  const typeSel = document.getElementById('threatType');
  const sevSel = document.getElementById('threatSeverity');
  const refresh = document.getElementById('threatRefresh');
  const more = document.getElementById('threatMore');
  if(!typeSel) return () => {};

  const onType = () => { filters.type = typeSel.value; reload(); };
  const onSev = () => { filters.severity = sevSel.value; reload(); };
  // Təzələmə IP filtrini də sıfırlayır — "hər şeyi göstər" gözləntisi budur.
  const onRefresh = () => { filters.ip = ''; reload(); };
  const onMore = () => loadEvents({ append: true });

  typeSel.addEventListener('change', onType);
  sevSel.addEventListener('change', onSev);
  refresh.addEventListener('click', onRefresh);
  more.addEventListener('click', onMore);

  loadEvents();
  // Xülasə pollanır; hadisə siyahısı filtrlə idarə olunduğu üçün əl ilə təzələnir
  // (avtomatik dəyişsəydi admin oxuduğu sətri itirərdi).
  const stopPoll = startPoll({
    fetcher: () => api('/admin/security/summary'),
    onData: renderSummary,
    interval: POLL_MS,
  });

  return () => {
    stopPoll();
    typeSel.removeEventListener('change', onType);
    sevSel.removeEventListener('change', onSev);
    refresh.removeEventListener('click', onRefresh);
    more.removeEventListener('click', onMore);
  };
}
