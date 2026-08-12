// Statistika: vaxt filtrləri (1/7/14/30/custom), icma göstəriciləri,
// liderlər, sahə bölgüsü + yalnız adminə görünən detallı platforma statistikası.
import { state } from './store.js';
import { el, clear, tsToMillis, todayStr, bus } from './util.js';
import { getPosts } from './feed.js';
import { emptyState } from './ui.js';
import { api } from './api.js';

let leaderMode = 'xp';
/**
 * `days` HƏM rəqəm, HƏM `'custom'` ola bilər (aşağıdakı sıra seçicisi).
 * Elan tipini dar buraxsaq `range.days === 'custom'` müqayisəsi TypeScript
 * tərəfindən "heç vaxt doğru olmaz" kimi işarələnirdi (TS2367).
 * @type {{ days: number | 'custom', from: string | null, to: string | null }}
 */
let range = { days: 7, from: null, to: null };

function rangeBounds(){
  if(range.days === 'custom' && range.from && range.to){
    const from = new Date(range.from).getTime();
    const to = new Date(range.to).getTime() + 86400000; // "to" günü daxil
    return { from, to };
  }
  const days = typeof range.days === 'number' ? range.days : 7;
  return { from: Date.now() - days * 86400000, to: Date.now() + 1 };
}

/*
 * Gündəlik post sayı — SERVERDƏN.
 *
 * 🔴 Əvvəl bu qrafik `getPosts()` keşindən sayılırdı. Keşdə isə yalnız lentin
 *    YÜKLƏNMİŞ səhifəsi var (~20-60 post, hamısı son saatlardan), ona görə
 *    minlərlə postu olan bazada belə qrafik "bugün 60, qalan günlər 0"
 *    göstərirdi. Say indi `/api/stats/activity`-dən (COUNT + GROUP BY) gəlir;
 *    keş yalnız server cavabı gələnə qədər ehtiyat kimi qalır.
 */
let seriesCache = null;   // { key, map: Map<'YYYY-MM-DD', number> }

async function loadSeries(){
  const { from, to } = rangeBounds();
  const days = Math.min(90, Math.max(1, Math.ceil((to - from) / 86400000)));
  const key = 'd' + days;
  if(seriesCache?.key === key) return;
  try{
    const d = await api('/stats/activity?days=' + days);
    seriesCache = { key, map: new Map((d.series || []).map(r => [r.date, r.posts])) };
    renderBars();
  }catch(e){ /* server cavab vermədi — keşdən sayma qalır */ }
}

/** Yerli tarixi `YYYY-MM-DD` formatına salır (server UTC gün açarı işlədir). */
const dayKey = ms => new Date(ms).toISOString().slice(0, 10);

function renderBars(){
  const { from, to } = rangeBounds();
  const dayCount = Math.min(31, Math.max(1, Math.ceil((to - from) / 86400000)));
  const counts = new Array(dayCount).fill(0);
  const labels = new Array(dayCount).fill('');
  const start = to - dayCount * 86400000;
  for(let i = 0; i < dayCount; i++){
    const d = new Date(start + i * 86400000);
    labels[i] = dayCount <= 7
      ? ['B', 'B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş'][d.getDay()]
      : String(d.getDate());
  }
  if(seriesCache?.map){
    for(let i = 0; i < dayCount; i++) counts[i] = seriesCache.map.get(dayKey(start + i * 86400000)) || 0;
  } else {
    getPosts().forEach(p => {
      const ms = tsToMillis(p.createdAt);
      if(ms >= start && ms < to){
        const idx = Math.floor((ms - start) / 86400000);
        if(idx >= 0 && idx < dayCount) counts[idx]++;
      }
    });
  }
  const max = Math.max(1, ...counts);
  const barsEl = document.getElementById('statBars');
  clear(barsEl);
  counts.forEach((c, i) => {
    barsEl.append(el('div', { class: 'bar-col' },
      el('div', { class: 'bar', style: 'height:' + Math.max(4, (c / max * 100)) + '%', title: c + ' post' }),
      el('div', { class: 'lbl' }, labels[i]),
      dayCount <= 14 ? el('div', { class: 'cnt' }, c) : null,
    ));
  });
  document.getElementById('statBarsTitle').textContent =
    'Paylaşım sayı — ' + (range.days === 'custom' ? `${range.from} → ${range.to}` :
      range.days === 1 ? 'son 1 gün' : `son ${range.days} gün`);
}

function renderLeaders(){
  const users = [...state.users.values()].filter(u => !u.blocked);
  const cfg = {
    xp:     { key: u => u.xp || 0,             val: u => (u.xp || 0) + ' XP' },
    tasks:  { key: u => u.tasksCompleted || 0, val: u => String(u.tasksCompleted || 0) },
    streak: { key: u => u.streak || 0,         val: u => '🔥 ' + (u.streak || 0) + ' gün' },
  }[leaderMode];
  const sorted = users.sort((a, b) => cfg.key(b) - cfg.key(a)).slice(0, 7);
  const leaderEl = document.getElementById('leaderList');
  clear(leaderEl);
  if(!sorted.length){ leaderEl.append(emptyState('trophy', 'Hələ istifadəçi yoxdur')); return; }
  sorted.forEach((u, i) => {
    leaderEl.append(el('div', { class: 'leader-row' },
      el('div', { class: 'rank' }, i + 1),
      el('div', { class: 'name' }, u.name),
      el('div', { class: 'val' }, cfg.val(u)),
    ));
  });
}

function renderDist(){
  const tagCounts = {};
  let total = 0;
  state.users.forEach(u => {
    [...(u.prog || []), ...(u.langs || [])].forEach(x => { tagCounts[x] = (tagCounts[x] || 0) + 1; total++; });
  });
  const distEl = document.getElementById('langDist');
  clear(distEl);
  const entries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  if(!entries.length){ distEl.append(emptyState('chart', 'Hələ məlumat yoxdur')); return; }
  entries.forEach(([name, cnt]) => {
    const pct = total ? Math.round(cnt / total * 100) : 0;
    distEl.append(el('div', { class: 'row' },
      el('span', { class: 'name' }, name),
      el('div', { class: 'track' }, el('div', { class: 'fill', style: 'width:' + pct + '%' })),
      el('span', { class: 'pct' }, pct + '%'),
    ));
  });
}

/* ---------- yalnız admin: platforma statistikası ---------- */
function renderAdminStats(){
  const wrap = document.getElementById('adminStatsWrap');
  wrap.classList.toggle('hidden', !state.isAdmin);
  if(!state.isAdmin) return;
  const users = [...state.users.values()];
  const today = todayStr();
  const now = Date.now();
  const dau = users.filter(u => u.lastActiveDay === today).length;
  const mau = users.filter(u => {
    const d = u.lastActiveDay ? new Date(u.lastActiveDay).getTime() : 0;
    return now - d < 30 * 86400000;
  }).length;
  const newWeek = users.filter(u => now - tsToMillis(u.joinedAt) < 7 * 86400000).length;
  const cards = document.getElementById('adminStatsCards');
  clear(cards);
  const card = (num, lbl) => el('div', { class: 'stat-card' }, el('div', { class: 'num' }, num), el('div', { class: 'lbl' }, lbl));
  cards.append(
    card(users.length, 'ümumi istifadəçi'),
    card(dau, 'DAU (bu gün aktiv)'),
    card(mau, 'MAU (30 gün)'),
    card(newWeek, 'yeni (7 gün)'),
    card(users.filter(u => u.blocked).length, 'bloklanmış'),
    card(users.filter(u => u.verified).length, 'təsdiqlənmiş'),
  );

  const top = users.sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 5);
  const topEl = document.getElementById('adminTopContrib');
  clear(topEl);
  top.forEach((u, i) => topEl.append(el('div', { class: 'leader-row' },
    el('div', { class: 'rank' }, i + 1),
    el('div', { class: 'name' }, u.name + ' (@' + u.username + ')'),
    el('div', { class: 'val' }, (u.xp || 0) + ' XP · ' + (u.tasksCompleted || 0)),
  )));

  // artım: son 30 gündə qeydiyyat (həftəlik qruplar)
  const buckets = [0, 0, 0, 0];
  users.forEach(u => {
    const age = now - tsToMillis(u.joinedAt);
    if(age < 30 * 86400000) buckets[Math.min(3, Math.floor(age / (7 * 86400000)))]++;
  });
  buckets.reverse();
  const gb = document.getElementById('adminGrowthBars');
  clear(gb);
  const max = Math.max(1, ...buckets);
  ['-4h', '-3h', '-2h', 'bu h.'].forEach((lbl, i) => {
    gb.append(el('div', { class: 'bar-col' },
      el('div', { class: 'bar', style: 'height:' + Math.max(4, buckets[i] / max * 100) + '%' }),
      el('div', { class: 'lbl' }, lbl),
      el('div', { class: 'cnt' }, buckets[i]),
    ));
  });
}

/* ---------- COLLABIX_Seed.md §18 — demo etiketi ---------- */
// Bayraq YÜKLƏNMİŞ istifadəçi keşindən çıxarılır, ayrıca sorğu ilə YOX:
// `/api/config` hər səhifə açılışında çağırılır və D1 primary Buxarestdədir —
// oraya bir sorğu da əlavə etsək BÜTÜN səhifələr ~50-70 ms yavaşlayardı,
// halbuki bu etiket yalnız bir ekranda lazımdır. Admin panelində eyni bayraq
// serverdən gəlir (`/api/admin/stats-daily` → `demo`).
function renderDemoFlag(){
  const box = document.getElementById('statsDemoFlag');
  if(!box) return;
  const synthetic = [...state.users.values()].some(u => (u.username || '').startsWith('demo_'));
  box.classList.toggle('hidden', !synthetic);
}

function renderAll(){
  if(!document.getElementById('page-stats').classList.contains('active')) return;
  renderBars(); renderLeaders(); renderDist(); renderAdminStats(); renderDemoFlag();
  loadSeries();   // server sayı gələndə `renderBars` təkrar çağırılır
}

export function initStats(){
  document.getElementById('leaderTabs').addEventListener('click', e => {
    const btn = e.target.closest('button[data-lb]');
    if(!btn) return;
    leaderMode = btn.dataset.lb;
    document.querySelectorAll('#leaderTabs button').forEach(b => b.classList.toggle('active', b === btn));
    renderLeaders();
  });
  document.getElementById('statRangeTabs').addEventListener('click', e => {
    const btn = e.target.closest('button[data-range]');
    if(!btn) return;
    document.querySelectorAll('#statRangeTabs button').forEach(b => b.classList.toggle('active', b === btn));
    const v = btn.dataset.range;
    document.getElementById('statCustomRange').classList.toggle('hidden', v !== 'custom');
    if(v !== 'custom'){ range = { days: parseInt(v, 10), from: null, to: null }; renderBars(); loadSeries(); }
    else range.days = 'custom';
  });
  document.getElementById('statApplyBtn').addEventListener('click', () => {
    const from = document.getElementById('statFrom').value;
    const to = document.getElementById('statTo').value;
    if(!from || !to) return;
    range = { days: 'custom', from, to };
    renderBars(); loadSeries();
  });
}

export function mountStats(){
  renderAll();
  bus.addEventListener('feed-updated', renderAll);
  bus.addEventListener('users-updated', renderAll);
  return () => {
    bus.removeEventListener('feed-updated', renderAll);
    bus.removeEventListener('users-updated', renderAll);
  };
}
