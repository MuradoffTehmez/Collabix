// Profil ekranı — ÖZ PROFİL və PUBLİK PROFİL üçün TƏK renderer.
//
// ════════════════════════════════════════════════════════════════════════════
// 🔴 NİYƏ TƏK MODUL
// ════════════════════════════════════════════════════════════════════════════
//
// Əvvəl eyni səhifə İKİ yerdə qurulurdu: `profile.js` (öz profil, HTML
// şablonundan) və `users.js → mountPubProfile` (publik, tam JS-dən). Nəticə:
//   • öz profilində olan blok publikdə yox idi (nişanlar, tərəqqi)
//   • saylar iki mənbədən gəlirdi və uyğunsuz görünürdü
//   • hər düzəliş İKİ yerdə edilməli idi, biri unudulurdu
//
// İndi fərq YALNIZ `mode`-dadır: `self` redaktə/sancaq/insights əlavə edir,
// `public` isə izlə/mesaj/menyu. Struktur, sıra və vizual qat EYNİDİR —
// istifadəçi öz profilini kənardan necə göründüyünü bilir.
//
// ⚠ VERİ ÜÇ MƏRHƏLƏDƏ GƏLİR (bax `worker/routes/profile.ts`):
//   1. başlıq (`/profile`)  → çağıran tərəf verir, burada gözlənilmir
//   2. `/overview`          → statistika, nişan, layihə, sancaq, insights
//   3. `/timeline`, `/posts`, `/activity` → görünəndə
//   Skelet HƏR bölmə üçün ayrıdır: bir yavaş sorğu bütün səhifəni saxlamır.
import { api } from './api.js';
import {
  el, clear, avatarNode, nameWithBadge, lastSeenText, levelFromXP,
  countUp, prefersReducedMotion, onceInView, emit, bus,
} from './util.js';
import { t, tOr, fmtMonthYear, fmtRelTime } from './i18n.js';
import { toast, emptyState, openPopover, closePopover } from './ui.js';
import { paintIcons } from './icon-set.js';
import {
  rankOf, xpProgress, statusOf, skillCatClass, skillCatOf, SKILL_CAT_ORDER,
  coverClass, activityStats, COVERS,
} from './profile-kit.js';
import { renderHeatmapInto } from './heatmap.js';

/* ═══════════════════════ STATİSTİKA KARTLARI ═══════════════════════
 *
 * ⚠ `tone` HƏR KARTDA FƏRQLİDİR — spesifikasiyanın "statistikalar eyni
 *   görünməsin" tələbi. Rəng DEKOR DEYİL: eyni ton həmişə eyni məna daşıyır
 *   (mavi = sosial, bənövşəyi = irəliləyiş, yaşıl = məzmun, sarı = nüfuz).
 *
 * ⚠ `hero: true` olanlar BÖYÜK sətirdədir. Onlar profilin "bir baxışda nə
 *   deyir" cavabıdır; qalanları ikinci dərəcəli şəbəkədədir.
 */
const HERO_STATS = [
  { key: 'followers', icon: 'users',  tone: 'blue',   lbl: 'soc.followers', act: 'followers' },
  { key: 'xp',        icon: 'zap',    tone: 'violet', lbl: 'usr.xp' },
  { key: 'contribution', icon: 'chart', tone: 'green', lbl: 'pf.st_contrib' },
  { key: 'reputation', icon: 'shield', tone: 'amber', lbl: 'pf.st_rep' },
];
const GRID_STATS = [
  { key: 'following',     icon: 'userPlus', tone: 'blue',   lbl: 'soc.following', act: 'following' },
  { key: 'posts',         icon: 'type',     tone: 'green',  lbl: 'usr.posts' },
  { key: 'comments',      icon: 'message',  tone: 'green',  lbl: 'pf.st_comments' },
  { key: 'likesReceived', icon: 'heart',    tone: 'rose',   lbl: 'pf.st_likes' },
  { key: 'projects',      icon: 'folder',   tone: 'teal',   lbl: 'users.c_projects' },
  { key: 'teams',         icon: 'users',    tone: 'teal',   lbl: 'users.c_teams' },
  { key: 'streak',        icon: 'flame',    tone: 'amber',  lbl: 'usr.streak' },
  { key: 'tasks',         icon: 'tasks',    tone: 'violet', lbl: 'usr.tasks' },
];

/** Taymlayn hadisə tipi → ikon + ton + etiket açarı. */
const TL_META = {
  joined:      { icon: 'userPlus', tone: 'blue',   lbl: 'pf.tl_joined' },
  badge:       { icon: 'award',    tone: 'amber',  lbl: 'pf.tl_badge' },
  achievement: { icon: 'trophy',   tone: 'violet', lbl: 'pf.tl_ach' },
  post:        { icon: 'type',     tone: 'green',  lbl: 'pf.tl_post' },
  team:        { icon: 'users',    tone: 'teal',   lbl: 'pf.tl_team' },
  level_up:    { icon: 'crown',    tone: 'gold',   lbl: 'pf.tl_level' },
};
const tlMeta = k => TL_META[k] || { icon: 'chart', tone: 'blue', lbl: 'pf.tl_other' };

/**
 * Nişan/nailiyyət adı — DİL AYARINA TABE.
 *
 * ⚠ Server yalnız `label_az` saxlayır (`badges.label_az`), ona görə etiketi
 *   olduğu kimi göstərsəydik EN/RU seçilsə belə azərbaycanca qalardı —
 *   istifadəçinin bildirdiyi qüsur məhz bu idi. Tərcümə `code` üzrə
 *   axtarılır; tapılmasa server mətni göstərilir (yeni nişan tərcüməsiz
 *   əlavə oluna bilər və yenə düzgün görünər).
 */
const badgeLabel = a => tOr('bdg.' + a.code, a.label);

/**
 * Sosial link → ikon + URL qurucu. Boş sahə göstərilmir.
 *
 * ⚠ İKONLAR MARKA İKONU DEYİL: `icon-set.js`-də GitHub/LinkedIn qlifi yoxdur
 *   və onları əlavə etmək lisenziya + 5 yeni SVG demək idi. Bunun əvəzinə
 *   MƏNAYA görə seçilib (kod / iş / göndər / şəkil / sayt) — ad hər halda
 *   yanında yazılır, ona görə tanınma ikondan asılı deyil.
 */
const SOCIALS = [
  { key: 'github',    icon: 'code',      lbl: 'GitHub',    url: v => 'https://github.com/' + strip(v) },
  { key: 'linkedin',  icon: 'briefcase', lbl: 'LinkedIn',  url: v => 'https://linkedin.com/' + (strip(v).startsWith('in/') ? strip(v) : 'in/' + strip(v)) },
  { key: 'telegram',  icon: 'send',      lbl: 'Telegram',  url: v => 'https://t.me/' + strip(v) },
  { key: 'instagram', icon: 'image',     lbl: 'Instagram', url: v => 'https://instagram.com/' + strip(v) },
  { key: 'website',   icon: 'globe',     lbl: 'pf.link_site', url: v => /^https?:/.test(v) ? v : 'https://' + v },
];
const strip = v => String(v || '').trim().replace(/^@/, '').replace(/^https?:\/\/[^/]+\//, '');

/** Bölmə naviqasiyası — sticky tab sətri. */
const SECTIONS = [
  { id: 'stats',  lbl: 'pf.nav_overview' },
  { id: 'ach',    lbl: 'pf.nav_ach' },
  { id: 'skills', lbl: 'pf.nav_skills' },
  { id: 'act',    lbl: 'pf.nav_activity' },
  { id: 'proj',   lbl: 'pf.nav_projects' },
  { id: 'posts',  lbl: 'pf.nav_posts' },
  { id: 'tl',     lbl: 'pf.nav_timeline' },
];

const ico = (name, size = 14) => el('span', { class: 'ic', 'data-icon': name, 'data-icon-size': String(size) });
const num = v => Number(v) || 0;

/* ═══════════════════════ GİRİŞ NÖQTƏSİ ═══════════════════════ */

/**
 * Profili `host` elementinə çəkir.
 *
 * @param {HTMLElement} host
 * @param {object} o
 * @param {object} o.user         `/api/users/:u/profile` cavabındakı `user`
 * @param {Array}  o.sharedTeams  ortaq komandalar (yalnız publik rejim)
 * @param {'self'|'public'} o.mode
 * @param {Function} [o.actions]      əməliyyat düymələri (redaktə vs izlə/mesaj)
 * @param {Function} [o.onCover]      örtük seçicisini açır (yalnız `self`)
 * @param {Function} [o.onFollowList] `(uid, tab)` — izləyici siyahısını açır
 * @returns {{ destroy: Function, refresh: Function }}
 */
export function renderProfile(host, o){
  const u = o.user || {};
  const isSelf = o.mode === 'self';
  let stopped = false;
  const cleanups = [];

  clear(host);
  const root = el('div', { class: 'pf' });
  host.append(root);

  /* ── 1. Başlıq ─────────────────────────────────────────────────────── */
  const secStats = section('stats', 'pf.nav_overview', 'chart');
  const secAch = section('ach', 'pf.nav_ach', 'award');
  const secSkills = section('skills', 'pf.nav_skills', 'code');
  const secAct = section('act', 'pf.nav_activity', 'calendar');
  const secProj = section('proj', 'pf.nav_projects', 'folder');
  const secPosts = section('posts', 'pf.nav_posts', 'type');
  const secTl = section('tl', 'pf.nav_timeline', 'clock');
  const rail = el('aside', { class: 'pf-rail' });

  root.append(
    heroNode(u, isSelf, o),
    tabsNode(),
    el('div', { class: 'pf-layout' },
      el('div', { class: 'pf-main' },
        secStats.node, secAch.node, secSkills.node, secAct.node,
        secProj.node, secPosts.node, secTl.node),
      rail,
    ),
  );

  // İlkin skeletlər — hər bölmə öz datasını ayrıca gözləyir.
  secStats.body.append(statSkeleton());
  [secAch, secProj].forEach(s => s.body.append(blockSkeleton(3)));
  secTl.body.append(blockSkeleton(4));

  /* ⚠ BACARIQLAR DƏRHAL ÇƏKİLİR: onlar YALNIZ `user` obyektindən asılıdır və
     o, artıq əlimizdədir. Xülasə sorğusunun içində saxlasaydıq, mövcud
     məlumat şəbəkəni gözləyərdi — səbəbsiz skelet. */
  let progressMap = {};
  renderSkills(secSkills, u, progressMap);
  // Sahə üzrə irəliləyiş (post/task sayı) gələndə bacarıqlar zolaqla yenilənir.
  api('/users/' + encodeURIComponent(u.uid || '') + '/progress')
    .then(d => {
      if(stopped) return;
      progressMap = d.progress || {};
      renderSkills(secSkills, u, progressMap);
    })
    .catch(() => {});   // zolaq bəzəkdir — bacarıqlar onsuz da görünür

  /* ⚠ TAKSONOMİYA GEC GƏLƏ BİLƏR: kateqoriya SERVERDƏN yüklənir və default
     siyahıda `category` sahəsi YOXDUR. Profil taksonomiyadan əvvəl çəkilsə,
     hər bacarıq "Digər" qrupuna düşür. `profile-kit` indeksi sıfırlayır,
     lakin ARTIQ ÇƏKİLMİŞ DOM özü yenilənmir — ona görə burada yenidən çəkilir. */
  const onTax = () => { if(!stopped) renderSkills(secSkills, u, progressMap); };
  bus.addEventListener('taxonomy-updated', onTax);
  cleanups.push(() => bus.removeEventListener('taxonomy-updated', onTax));

  paintIcons(root);

  /* ── 2. Xülasə ─────────────────────────────────────────────────────── */
  api('/users/' + encodeURIComponent(u.username || '') + '/overview')
    .then(d => {
      if(stopped) return;
      renderStats(secStats, d, u, o.onFollowList);
      renderAchievements(secAch, d, isSelf);
      renderProjects(secProj, d, isSelf);
      renderPinned(secPosts, d, isSelf, () => refreshOverview());
      if(d.insights) renderInsights(secStats, d.insights);
      renderRail(rail, d, u, o.sharedTeams || []);
      paintIcons(root);
    })
    .catch(() => {
      if(stopped) return;
      // ⚠ BACARIQLAR SİYAHIDA YOXDUR: onlar `user`-dən çəkilib və xülasənin
      //   uğursuzluğu ilə əlaqəsi yoxdur. Onları da xəta ilə əvəz etmək
      //   mövcud məlumatı SİLMƏK olardı.
      [secStats, secAch, secProj].forEach(s => {
        clear(s.body);
        s.body.append(emptyState('info', t('users.err')));
      });
      paintIcons(root);
    });

  const refreshOverview = () => {
    api('/users/' + encodeURIComponent(u.username || '') + '/overview')
      .then(d => { if(!stopped){ renderPinned(secPosts, d, isSelf, () => refreshOverview()); paintIcons(root); } })
      .catch(() => {});
  };

  /* ── 3. Aktivlik xəritəsi ──────────────────────────────────────────── */
  const heatBox = el('div', { class: 'heatmap' });
  const streakBox = el('div', { class: 'pf-streaks' });
  secAct.body.append(streakBox, heatBox);
  renderActivity(streakBox, heatBox, u.activityDays || {});
  api('/users/' + encodeURIComponent(u.username || '') + '/activity')
    .then(d => { if(!stopped) renderActivity(streakBox, heatBox, d.activityDays || {}); })
    .catch(() => {});   // xəritə bəzəkdir — keş qalır

  /* ── 4. Paylaşımlar + taymlayn (görünəndə) ─────────────────────────── */
  const posts = postsFeed(secPosts, u, isSelf, () => stopped, () => refreshOverview());
  cleanups.push(posts.destroy);
  const tl = timelineFeed(secTl, u, () => stopped);
  cleanups.push(tl.destroy);

  return {
    destroy(){
      stopped = true;
      closePopover();
      cleanups.forEach(fn => { try{ fn(); }catch(e){ /* təmizlik səssizdir */ } });
    },
    refresh: refreshOverview,
  };

  /* ── Bölmə qabığı ───────────────────────────────────────────────── */
  function section(id, lblKey, icon){
    const body = el('div', { class: 'pf-sec__body' });
    const head = el('div', { class: 'pf-sec__head' },
      el('h2', { class: 'pf-sec__h' }, ico(icon, 16), t(lblKey)));
    const node = el('section', { class: 'pf-sec', id: 'pf-' + id }, head, body);
    return { node, head, body, id };
  }

  function tabsNode(){
    const bar = el('nav', { class: 'pf-tabs', 'aria-label': t('pf.nav_overview') });
    SECTIONS.forEach(s => bar.append(el('a', {
      class: 'pf-tab', href: '#pf-' + s.id,
      onclick: e => {
        e.preventDefault();
        const target = document.getElementById('pf-' + s.id);
        if(!target) return;
        target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        bar.querySelectorAll('.pf-tab').forEach(x => x.classList.remove('is-on'));
        e.currentTarget.classList.add('is-on');
      },
    }, t(s.lbl))));
    return bar;
  }
}

/* ═══════════════════════ BAŞLIQ ═══════════════════════ */

function heroNode(u, isSelf, o){
  const r = rankOf(u.xp);
  const p = xpProgress(u.xp);
  const s = statusOf(u);
  const loc = [u.city, u.country].filter(Boolean).join(', ');

  /* Örtük — naxış açarı sinifə çevrilir (şəkil yüklənmir, bax miqrasiya 0052). */
  const cover = el('div', { class: 'pf-cover ' + coverClass(u.cover) });
  if(isSelf && typeof o.onCover === 'function'){
    cover.append(el('button', {
      class: 'pf-cover__edit c-btn c-btn--ghost c-btn--sm', type: 'button',
      onclick: () => o.onCover(),
    }, ico('image', 14), t('pf.cover_change')));
  }

  const meta = [];
  if(u.company) meta.push(['building', u.company]);
  if(loc) meta.push(['mapPin', loc]);
  if(u.joinedAt) meta.push(['calendar', t('users.c_joined').replace('{d}', fmtMonthYear(u.joinedAt))]);
  const seen = lastSeenText(u);
  if(seen) meta.push(['clock', seen]);

  const xpFill = el('span', { class: 'pf-xp__fill pf-r--' + r.tone });
  // CSSOM — CSP HTML `style="…"` atributunu bloklayır (layihə qeydi).
  // Animasiya: eni 0-dan başlayıb hədəfə açılır (reduced-motion-da dərhal).
  xpFill.style.setProperty('--pf-xp-pct', prefersReducedMotion() ? p.pct + '%' : '0%');
  if(!prefersReducedMotion()){
    requestAnimationFrame(() => requestAnimationFrame(() => {
      xpFill.style.setProperty('--pf-xp-pct', p.pct + '%');
    }));
  }

  return el('section', { class: 'pf-hero' },
    cover,
    el('div', { class: 'pf-hero__body' },
      el('div', { class: 'pf-ava' },
        avatarNode(u, 'avatar'),
        el('span', {
          class: 'ud-status pf-status ud-s--' + s.tone,
          title: t(s.key), 'aria-label': t(s.key),
        }),
      ),
      el('div', { class: 'pf-id' },
        el('div', { class: 'pf-nameline' },
          el('h1', { class: 'pf-name' }, nameWithBadge(u)),
          el('span', { class: 'pf-rank pf-r--' + r.tone },
            ico('crown', 11), r.label, el('i', {}, 'Lv' + r.lvl)),
        ),
        el('div', { class: 'pf-handle' },
          el('span', { class: 'pf-at' }, '@' + (u.username || '')),
          s.tone === 'hiring' ? el('span', { class: 'ud-badge ud-s--hiring' }, t('users.st_hiring')) : null,
          u.followsMe && !isSelf ? el('span', { class: 'ud-mutual ud-mutual--f' }, t('users.c_follows_you')) : null,
        ),
        meta.length ? el('div', { class: 'pf-meta' }, meta.map(([i, txt]) =>
          el('span', { class: 'pf-meta__i' }, ico(i, 13), txt))) : null,
        u.bio ? el('p', { class: 'pf-bio' }, u.bio) : null,
        u.goals ? el('p', { class: 'pf-goals' }, ico('flag', 13), u.goals) : null,
        socialRow(u),
      ),
      el('div', { class: 'pf-actions' }, o.actions ? o.actions() : null),
    ),
    /* XP zolağı — başlığın altında TAM ENDƏ: səviyyə profilin əsas
       "irəliləyiş" siqnalıdır və sağ sütunda sıxılmamalıdır. */
    el('div', { class: 'pf-xp' },
      el('div', { class: 'pf-xp__top' },
        el('span', { class: 'pf-xp__lvl' }, t('pf.level').replace('{n}', String(r.lvl))),
        el('span', { class: 'pf-xp__num' },
          p.isMax ? t('users.rk_max') : t('users.rk_next').replace('{n}', String(p.remaining))),
      ),
      el('div', {
        class: 'pf-xp__bar', role: 'progressbar',
        'aria-valuenow': String(p.pct), 'aria-valuemin': '0', 'aria-valuemax': '100',
        'aria-label': t('pf.nav_overview'),
      }, xpFill),
    ),
  );
}

function socialRow(u){
  const items = SOCIALS.filter(x => u[x.key]);
  if(!items.length) return null;
  return el('div', { class: 'pf-links' }, items.map(x => el('a', {
    class: 'pf-link', href: x.url(u[x.key]), target: '_blank', rel: 'noopener noreferrer',
    title: x.lbl.includes('.') ? t(x.lbl) : x.lbl,
  }, ico(x.icon, 14), el('span', {}, x.lbl.includes('.') ? t(x.lbl) : x.lbl))));
}

/* ═══════════════════════ STATİSTİKA ═══════════════════════ */

/**
 * @param {Function} [onFollowList] izləyici/izlənilən siyahısını açır.
 *   ⚠ CALLBACK, İMPORT YOX: siyahı `users.js`-dədir və bu modul ondan asılı
 *     OLMAMALIDIR — `users.js` bu modulu import edir (publik profil), tərs
 *     istiqamət dövr yaradardı ([[icon-layer-architecture]] naxışı).
 */
function renderStats(sec, d, u, onFollowList){
  clear(sec.body);
  const s = d.stats || {};
  /* ⚠ `teams`/`projects` ARTIQ `d.stats`-dədir (server hesablayır).
     Əvvəl `u.teamsCount`/`u.projectsCount` oxunurdu — həmin sahələr YALNIZ
     `/profile` endpoint-inin cavabında var. Öz profil `state.me` ilə
     çağırıldığı üçün orada həmişə `undefined` idi və kart "0" yazırdı,
     halbuki sağ sütun eyni layihələri sadalayırdı. */
  const vals = { ...s, level: levelFromXP(s.xp) };

  const clickable = def => !!(def.act && typeof onFollowList === 'function');
  const card = (def, big) => {
    const numNode = el('b', { class: 'pf-stat__n' }, '0');
    const node = el(clickable(def) ? 'button' : 'div', {
      class: 'pf-stat' + (big ? ' pf-stat--hero' : '') + ' pf-t--' + def.tone,
      type: clickable(def) ? 'button' : null,
      onclick: clickable(def) ? () => onFollowList(u.uid, def.act) : null,
    },
      el('span', { class: 'pf-stat__ic' }, ico(def.icon, big ? 18 : 15)),
      el('span', { class: 'pf-stat__txt' }, numNode, el('span', { class: 'pf-stat__l' }, t(def.lbl))),
    );
    // Sayğac YALNIZ görünəndə işə düşür — ekrandan kənarda animasiya
    // görünmür, amma yenə də kadr yeyir.
    onceInView(node, () => countUp(numNode, num(vals[def.key]), { duration: 520 }));
    return node;
  };

  sec.body.append(
    el('div', { class: 'pf-stats pf-stats--hero' }, HERO_STATS.map(x => card(x, true))),
    el('div', { class: 'pf-stats' }, GRID_STATS.map(x => card(x, false))),
    xpBreakdown(s),
  );
}

/**
 * Həftəlik / aylıq XP — "irəliləyirmi" sualının cavabı.
 *
 * ⚠ DƏYƏR MƏNFİ OLA BİLƏR: pəncərə cəmi kompensasiyaları da daxil edir
 *   (silinən post XP-ni geri alır). Ona görə işarə şərtidir — sabit `'+'`
 *   yazsaydıq "+-50" kimi mətn çıxardı.
 */
function xpBreakdown(s){
  const sign = v => (num(v) >= 0 ? '+' : '−') + Math.abs(num(v));
  const row = (lblKey, v, tone) => el('div', { class: 'pf-xpb__i pf-t--' + tone },
    el('b', {}, sign(v)), el('span', {}, t(lblKey)));
  return el('div', { class: 'pf-xpb' },
    row('pf.xp_week', s.xpWeek, 'violet'),
    row('pf.xp_month', s.xpMonth, 'blue'),
    el('div', { class: 'pf-xpb__i pf-t--amber' },
      el('b', {}, String(num(s.xp))), el('span', {}, t('pf.xp_total'))),
  );
}

/**
 * Sahibə xas göstəricilər.
 *
 * ⚠ YALNIZ SAHİBİNƏ GƏLİR (server qərarı) — burada `if` yoxdur, çünki blok
 *   yalnız `d.insights` mövcud olduqda çağırılır. Client tərəfli gizlətmə
 *   olsaydı, data yenə şəbəkədə gedərdi.
 */
function renderInsights(sec, ins){
  const tile = (lblKey, v, icon, tone) => el('div', { class: 'pf-ins__i pf-t--' + tone },
    ico(icon, 15), el('b', {}, String(num(v))), el('span', {}, t(lblKey)));
  sec.body.append(el('div', { class: 'pf-ins' },
    el('div', { class: 'pf-ins__h' }, ico('eye', 14), t('pf.ins_title'),
      el('span', { class: 'pf-ins__note' }, t('pf.ins_private'))),
    el('div', { class: 'pf-ins__grid' },
      tile('pf.ins_views', ins.views, 'eye', 'blue'),
      tile('pf.ins_views7', ins.viewsWeek, 'chart', 'violet'),
      tile('pf.ins_views30', ins.viewsMonth, 'calendar', 'teal'),
      tile('pf.ins_f7', ins.followersWeek, 'userPlus', 'green'),
      tile('pf.ins_f30', ins.followersMonth, 'users', 'amber'),
    ),
  ));
}

/* ═══════════════════════ NİŞANLAR ═══════════════════════ */

/**
 * ⚠ MƏNBƏ SERVERDİR (`badges` / `achievements` cədvəlləri).
 *   Əvvəl `js/util.js` → `BADGES` statik massivi işlədilirdi — yəni istifadəçi
 *   öz brauzerində massivi dəyişib istənilən nişanı "qazana" bilirdi və
 *   serverdə qazandığı 11 nişandan yalnız 7-si göstərilirdi (PRD §19 pozuntusu).
 */
function renderAchievements(sec, d, isSelf){
  clear(sec.body);
  const all = [
    ...(d.badges || []).map(x => ({ ...x, type: 'badge' })),
    ...(d.achievements || []).map(x => ({ ...x, type: 'ach' })),
  ];
  if(!all.length){ sec.body.append(emptyState('award', t('pf.no_ach'))); return; }

  const earned = all.filter(x => x.earnedAt);
  const locked = all.filter(x => !x.earnedAt);

  sec.head.append(el('span', { class: 'pf-count' }, earned.length + '/' + all.length));

  const chip = a => {
    const done = !!a.earnedAt;
    const pct = done ? 100
      : Math.min(100, Math.round((num(a.have) / Math.max(1, num(a.ruleValue))) * 100));
    const bar = el('span', { class: 'pf-ach__fill' });
    bar.style.setProperty('--pf-ach-pct', pct + '%');
    return el('div', {
      class: 'pf-ach' + (done ? ' is-on' : ' is-off') + (a.type === 'ach' ? ' pf-ach--gold' : ''),
      // Rəng/solğunluq TƏK siqnal deyil (WCAG) — vəziyyət mətndə də var.
      'aria-label': badgeLabel(a) + ' — ' + (done ? t('badge.earned') : t('badge.locked')),
      title: done
        ? badgeLabel(a) + ' · ' + fmtRelTime(a.earnedAt)
        : badgeLabel(a) + ' · ' + Math.min(num(a.have), num(a.ruleValue)) + '/' + num(a.ruleValue),
    },
      el('span', { class: 'pf-ach__ic' }, a.icon || (a.type === 'ach' ? '🏆' : '🎖')),
      el('span', { class: 'pf-ach__b' },
        el('span', { class: 'pf-ach__n' }, badgeLabel(a)),
        done
          ? el('span', { class: 'pf-ach__d' }, fmtRelTime(a.earnedAt))
          /* ⚠ `have` HƏDDƏ SIXILIR: server nişanları TƏNBƏL qiymətləndirir
             (`evaluateProgression` XP hadisələrindən sonra işləyir), ona görə
             qısa müddət "300 / 20" kimi mənasız cüt görünə bilərdi. */
          : el('span', { class: 'pf-ach__p' },
            Math.min(num(a.have), num(a.ruleValue)) + ' / ' + num(a.ruleValue)),
        done ? null : el('span', { class: 'pf-ach__bar' }, bar),
      ),
      a.unlocks ? el('span', { class: 'pf-ach__u', title: t('pf.unlocks') }, ico('lock', 11)) : null,
    );
  };

  if(earned.length) sec.body.append(el('div', { class: 'pf-achs' }, earned.map(chip)));
  if(locked.length){
    sec.body.append(
      el('div', { class: 'pf-sub' }, t(isSelf ? 'pf.ach_next' : 'pf.ach_locked')),
      el('div', { class: 'pf-achs pf-achs--off' }, locked.map(chip)),
    );
  }
}

/* ═══════════════════════ BACARIQLAR ═══════════════════════ */

/**
 * Kateqoriya üzrə qruplaşdırılmış bacarıqlar: səviyyə + təcrübə ili +
 * sertifikat göstəricisi (miqrasiya 0052 → `users.skill_meta`).
 *
 * ⚠ META OPSİONALDIR: köhnə profillərdə `skillMeta` boşdur və bacarıq sadəcə
 *   səviyyə ilə göstərilir. "0 il" yazmaq YANLIŞ olardı — məlumat yoxdur,
 *   sıfır deyil.
 */
function renderSkills(sec, u, progress){
  clear(sec.body);
  const oldCount = sec.head.querySelector('.pf-count');
  if(oldCount) oldCount.remove();
  const levels = { ...(u.progLevels || {}), ...(u.langLevels || {}) };
  const meta = u.skillMeta || {};
  const prog = progress || {};
  const names = [...new Set([...(u.prog || []), ...(u.langs || [])])];
  if(!names.length && !(u.lookingFor || []).length){
    sec.body.append(emptyState('code', t('pf.no_skills')));
    return;
  }

  const groups = new Map();
  names.forEach(name => {
    const cat = skillCatOf(name);
    if(!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(name);
  });

  const order = SKILL_CAT_ORDER.filter(c => groups.has(c));
  sec.head.append(el('span', { class: 'pf-count' }, String(names.length)));

  order.forEach(cat => {
    const list = groups.get(cat).sort((a, b) => num(meta[b]?.y) - num(meta[a]?.y));
    sec.body.append(el('div', { class: 'pf-skgrp' },
      el('div', { class: 'pf-skgrp__h ' + skillCatClass(list[0]) },
        el('i', { class: 'pf-dot' }), t('pf.cat_' + cat), el('b', {}, String(list.length))),
      el('div', { class: 'pf-skills' }, list.map(name => skillChip(name, levels, meta, prog))),
    ));
  });

  if((u.lookingFor || []).length){
    sec.body.append(el('div', { class: 'pf-skgrp' },
      el('div', { class: 'pf-skgrp__h cat-spoken' }, el('i', { class: 'pf-dot' }), t('pf.looking')),
      el('div', { class: 'pf-skills' }, (u.lookingFor || []).map(x =>
        el('span', { class: 'pf-skill cat-spoken' },
          ico('search', 11), el('span', { class: 'pf-skill__n' }, x)))),
    ));
  }
}

/**
 * Bir bacarıq çipi: ad + səviyyə + təcrübə ili + sertifikat + fəaliyyət zolağı.
 *
 * ⚠ ZOLAQ REAL FƏALİYYƏTDƏNDİR (`progress` cədvəli: həmin sahədə post/task),
 *   istifadəçinin öz iddiasından YOX. "Qabaqcıl" yazmaq asandır; 30 post
 *   yazmaq deyil. İkisi yan-yana göstərilir və bir-birini əvəz etmir.
 *
 * ⚠ ZOLAQ YALNIZ DATA VARSA görünür — "0%" göstərmək yeni başlayanı
 *   cəzalandırardı və çipləri lazımsız uzadardı.
 */
const SKILL_POINT_CAP = 300;   // zolağın 100%-i — `profile.js`-dəki köhnə astana

function skillChip(name, levels, meta, prog){
  const m = meta[name];
  const p = prog[name];
  const points = p ? (p.posts || 0) * 10 + (p.tasks || 0) * 50 + (p.xp || 0) : 0;
  const pct = Math.min(100, Math.round((points / SKILL_POINT_CAP) * 100));
  const fill = points ? el('span', { class: 'pf-skill__fill' }) : null;
  if(fill) fill.style.setProperty('--pf-sk-pct', pct + '%');
  return el('div', {
    class: 'pf-skill ' + skillCatClass(name),
    title: points ? name + ' · ' + t('pf.sk_points').replace('{n}', String(points)) : name,
  },
    el('span', { class: 'pf-skill__n' }, name),
    levels[name] ? el('span', { class: 'pf-skill__lv' }, levels[name]) : null,
    m && m.y ? el('span', { class: 'pf-skill__y', title: t('pf.sk_years') },
      ico('clock', 10), t('pf.sk_y').replace('{n}', String(m.y))) : null,
    m && m.c ? el('span', { class: 'pf-skill__c', title: t('pf.sk_cert') }, ico('check', 10)) : null,
    fill ? el('span', { class: 'pf-skill__bar' }, fill) : null,
  );
}

/* ═══════════════════════ AKTİVLİK ═══════════════════════ */

const WEEKDAY_KEYS = ['pf.wd_sun', 'pf.wd_mon', 'pf.wd_tue', 'pf.wd_wed', 'pf.wd_thu', 'pf.wd_fri', 'pf.wd_sat'];

function renderActivity(streakBox, heatBox, days){
  const st = activityStats(days);
  clear(streakBox);
  const tile = (lblKey, val, icon, tone) => el('div', { class: 'pf-streak pf-t--' + tone },
    ico(icon, 15), el('b', {}, val), el('span', {}, t(lblKey)));
  streakBox.append(
    tile('pf.ac_total', String(st.total), 'chart', 'green'),
    tile('pf.ac_cur', String(st.current), 'flame', 'amber'),
    tile('pf.ac_long', String(st.longest), 'trophy', 'violet'),
    tile('pf.ac_best', st.topWeekday >= 0 ? t(WEEKDAY_KEYS[st.topWeekday]) : '—', 'calendar', 'blue'),
  );
  paintIcons(streakBox);
  renderHeatmapInto(heatBox, days);
}

/* ═══════════════════════ LAYİHƏLƏR ═══════════════════════ */

const PROJ_STATUS_TONE = { active: 'green', paused: 'amber', done: 'blue', archived: 'muted' };

function renderProjects(sec, d, isSelf){
  clear(sec.body);
  const list = d.projects || [];
  if(!list.length){
    sec.body.append(emptyState('folder', t(isSelf ? 'pf.no_proj_self' : 'pf.no_proj')));
    return;
  }
  sec.head.append(el('span', { class: 'pf-count' }, String(list.length)));
  sec.body.append(el('div', { class: 'pf-projs' }, list.map(p => el('button', {
    class: 'pf-proj', type: 'button',
    onclick: () => emit('nav', { page: 'team/' + p.teamSlug }),
  },
    el('div', { class: 'pf-proj__top' },
      el('span', { class: 'pf-proj__logo' }, (p.name || '?').charAt(0).toUpperCase()),
      el('span', { class: 'pf-proj__name' }, p.name),
      p.isOwner ? el('span', { class: 'pf-tag pf-tag--own' }, ico('crown', 10), t('pf.pr_owner')) : null,
    ),
    p.description ? el('p', { class: 'pf-proj__d' }, p.description) : null,
    el('div', { class: 'pf-proj__foot' },
      el('span', { class: 'pf-tag pf-t--' + (PROJ_STATUS_TONE[p.status] || 'muted') }, p.status),
      el('span', { class: 'pf-proj__m' }, ico('users', 11), String(p.members)),
      el('span', { class: 'pf-proj__m' }, ico('flag', 11), p.teamName),
      el('span', { class: 'pf-proj__t' }, fmtRelTime(p.updatedAt)),
    ),
  ))));
}

/* ═══════════════════════ SANCILMIŞ ═══════════════════════ */

function renderPinned(sec, d, isSelf, onChange){
  const old = sec.body.querySelector('.pf-pins');
  if(old) old.remove();
  const list = d.pinned || [];
  if(!list.length) return;

  const box = el('div', { class: 'pf-pins' },
    el('div', { class: 'pf-sub' }, ico('pin', 12), t('pf.pinned')),
    list.map(p => el('div', { class: 'pf-pin' },
      el('button', {
        class: 'pf-pin__body', type: 'button',
        onclick: () => emit('nav', { page: 'post/' + p.id }),
      },
        el('p', {}, p.text || t('pf.pin_media')),
        el('div', { class: 'pf-pin__meta' },
          el('span', {}, ico('heart', 11), String(p.likeCount)),
          el('span', {}, ico('message', 11), String(p.commentCount)),
          p.imageCount ? el('span', {}, ico('image', 11), String(p.imageCount)) : null,
          p.visibility !== 'public' ? el('span', { class: 'pf-tag' }, t('pf.vis_' + p.visibility)) : null,
          el('span', { class: 'pf-pin__t' }, fmtRelTime(p.createdAt)),
        ),
      ),
      isSelf ? el('button', {
        class: 'c-icon-btn pf-pin__x', type: 'button', 'aria-label': t('pf.unpin'), title: t('pf.unpin'),
        onclick: async e => {
          e.currentTarget.disabled = true;
          try{
            await api('/posts/' + p.id + '/profile-pin', { method: 'POST' });
            toast(t('pf.unpinned'));
            onChange();
          }catch(err){ toast(t('dyn.err_generic'), 'err'); }
        },
      }, ico('x', 14)) : null,
    )),
  );
  sec.body.prepend(box);
  paintIcons(box);
}

/* ═══════════════════════ PAYLAŞIMLAR ═══════════════════════ */

/**
 * Müəllif postları — SERVERDƏN, `feedCache`-dən YOX.
 *
 * 🔴 ƏVVƏLKİ QÜSUR: publik profil `feedCache.filter(...).slice(0, 10)` edirdi.
 *    Yəni profil YALNIZ lentə onsuz da yüklənmiş postları göstərirdi: lent
 *    açılmamışdan əvvəl profil "paylaşım yoxdur" deyirdi və 10-dan çoxu heç
 *    vaxt görünmürdü.
 *
 * ⚠ Sonsuz sürüşmə `IntersectionObserver` ilə — kataloq və bildiriş
 *   mərkəzindəki eyni naxış.
 */
function postsFeed(sec, u, isSelf, isStopped, onPinChange){
  const box = el('div', { class: 'pf-posts' });
  const sentinel = el('div', { class: 'pf-sentinel' });
  // ⚠ Skelet DƏRHAL qoyulur, `load()` içində yox: bölmə ekranın aşağısındadır
  //   və IO işə düşənə qədər BOŞ ÇƏRÇİVƏ kimi görünürdü.
  box.append(blockSkeleton(2));
  sec.body.append(box, sentinel);

  let cursor = null, loading = false, done = false, first = true;
  let io = null;

  const load = async () => {
    if(loading || done || isStopped()) return;
    loading = true;
    try{
      const qs = new URLSearchParams({ author: u.uid || '', limit: '10' });
      if(cursor) qs.set('cursor', cursor);
      // ⚠ `/feed`, `/posts` YOX: lent endpoint-i budur və müəllif filtri ora
      //   əlavə olunub (`?author=`). Ayrıca `/posts` marşrutu MÖVCUD DEYİL.
      const d = await api('/feed?' + qs.toString());
      if(isStopped()) return;
      if(first){ clear(box); first = false; }   // skeleti əvəz edir
      const list = d.posts || [];
      if(!list.length && !box.children.length){
        box.append(emptyState('message', t(isSelf ? 'pf.no_posts_self' : 'usr.no_posts')));
      }
      /* 🔴 DİNAMİK İMPORT QƏSDƏNDİR — STATİKƏ ÇEVİRMƏ.
       *
       * Statik olsaydı dövr yaranardı:
       *   `profile-view.js → feed.js → users.js → profile-view.js`
       * (`feed.js` `openProfileModal`-ı, `users.js` isə `renderProfile`-ı
       * import edir). ESM dövrü çökdürmür, lakin modul qiymətləndirmə sırası
       * asılı olur və `postCard` bəzi giriş nöqtələrində `undefined` gələ
       * bilər. Dinamik import halqanı qiymətləndirmə vaxtından ÇIXARIR.
       *
       * ⚠ Build "dynamic import will not move module into another chunk"
       *   xəbərdarlığı verir — bu, GÖZLƏNİLƏNDİR: məqsəd kod bölmək deyil,
       *   dövrü qırmaqdır. `feed.js` onsuz da əsas paketdədir. */
      const { postCard } = await import('./feed.js');
      if(isStopped()) return;
      list.forEach(p => {
        const card = postCard(p);
        if(isSelf) card.prepend(pinToggle(p, onPinChange));
        if(p.profilePinnedAt) card.classList.add('pf-post--pinned');
        box.append(card);
      });
      cursor = d.nextCursor;
      done = !d.hasMore || !cursor;
      if(done && io){ io.disconnect(); io = null; }
    }catch(e){
      if(first){ clear(box); first = false; box.append(emptyState('info', t('users.err'))); }
      done = true;
    }finally{ loading = false; }
  };

  if(typeof IntersectionObserver !== 'undefined'){
    io = new IntersectionObserver(es => { if(es.some(x => x.isIntersecting)) load(); },
      { rootMargin: '300px 0px' });
    io.observe(sentinel);
  } else {
    load();
  }

  return { destroy(){ if(io){ io.disconnect(); io = null; } } };
}

/** Post kartındakı "profilə sancaqla" düyməsi — YALNIZ müəllifə. */
function pinToggle(p, onPinChange){
  const on = !!p.profilePinnedAt;
  return el('button', {
    class: 'pf-post__pin' + (on ? ' is-on' : ''), type: 'button',
    title: t(on ? 'pf.unpin' : 'pf.pin'), 'aria-label': t(on ? 'pf.unpin' : 'pf.pin'),
    onclick: async e => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try{
        const d = await api('/posts/' + p.id + '/profile-pin', { method: 'POST' });
        p.profilePinnedAt = d.pinned ? Date.now() : null;
        btn.classList.toggle('is-on', !!d.pinned);
        btn.title = t(d.pinned ? 'pf.unpin' : 'pf.pin');
        toast(t(d.pinned ? 'pf.pinned_ok' : 'pf.unpinned'));
        // Sancaq siyahısı bölmənin BAŞINDADIR — dəyişiklik ora da yansımalıdır.
        // ⚠ Callback, hadisə YOX: `postsFeed` ilə `renderPinned` arasında
        //   birbaşa əlaqə var, qlobal hadisə şinindən keçmək lazımsızdır.
        if(typeof onPinChange === 'function') onPinChange();
      }catch(err){
        toast(err && err.code === 'pin_limit' ? t('pf.pin_limit') : t('dyn.err_generic'), 'err');
      }
      btn.disabled = false;
    },
  }, ico('pin', 13));
}

/* ═══════════════════════ TAYMLAYN ═══════════════════════ */

function timelineFeed(sec, u, isStopped){
  const list = el('ol', { class: 'pf-tl' });
  const more = el('button', { class: 'c-btn c-btn--ghost c-btn--sm pf-more', type: 'button' }, t('pf.more'));
  more.hidden = true;
  sec.body.append(list, more);

  let cursor = null, loading = false, first = true;

  const load = async () => {
    if(loading || isStopped()) return;
    loading = true;
    more.disabled = true;
    try{
      const qs = cursor ? '?cursor=' + encodeURIComponent(cursor) : '';
      const d = await api('/users/' + encodeURIComponent(u.username || '') + '/timeline' + qs);
      if(isStopped()) return;
      if(first){ clear(sec.body); sec.body.append(list, more); first = false; }
      const events = d.events || [];
      if(!events.length && !list.children.length){
        clear(sec.body);
        sec.body.append(emptyState('clock', t('pf.no_tl')));
        return;
      }
      events.forEach((e, i) => list.append(tlItem(e, u, i)));
      cursor = d.nextCursor;
      more.hidden = !d.hasMore;
      paintIcons(list);
    }catch(err){
      if(first){ clear(sec.body); sec.body.append(emptyState('info', t('users.err'))); }
      more.hidden = true;
    }finally{ loading = false; more.disabled = false; }
  };
  more.addEventListener('click', load);

  // Taymlayn səhifənin aşağısındadır — görünənə qədər sorğu göndərilmir.
  const stopWatch = onceInView(sec.node, () => load(), { threshold: 0.05 });

  return { destroy(){ try{ stopWatch(); }catch(e){ /* IO yoxdursa no-op */ } } };
}

function tlItem(e, u, i){
  const m = tlMeta(e.kind);
  /* ⚠ Nişan/nailiyyət hadisəsində `e.ref` KODDUR — etiket ondan tərcümə
     olunur (server yalnız azərbaycanca saxlayır, bax `badgeLabel`). */
  const label = e.kind === 'joined' ? t('pf.tl_joined_txt').replace('{n}', u.name || u.username || '')
    : e.kind === 'level_up' ? t('pf.tl_level_txt').replace('{n}', e.label || e.ref)
      : (e.kind === 'badge' || e.kind === 'achievement')
        ? tOr('bdg.' + e.ref, e.label || t(m.lbl))
        : e.label || t(m.lbl);
  const node = el('li', { class: 'pf-tli pf-t--' + m.tone },
    el('span', { class: 'pf-tli__ic' }, ico(m.icon, 13)),
    el('div', { class: 'pf-tli__b' },
      el('span', { class: 'pf-tli__k' }, t(m.lbl)),
      el('span', { class: 'pf-tli__t' }, label),
    ),
    el('time', { class: 'pf-tli__d', dateTime: new Date(e.ts).toISOString() }, fmtRelTime(e.ts)),
  );
  // Stagger — sətirlər ardıcıl görünür (yalnız ilk səhifə hiss olunur).
  node.style.setProperty('--pf-d', Math.min(i * 28, 400) + 'ms');
  if(e.kind === 'post'){
    node.classList.add('is-link');
    node.addEventListener('click', () => emit('nav', { page: 'post/' + e.ref }));
  }
  return node;
}

/* ═══════════════════════ SAĞ SÜTUN ═══════════════════════ */

/**
 * ⚠ YALNIZ ≥1280px-də görünür (CSS). Burada həmişə qurulur, çünki gizli
 *   sütunun DOM-u ucuzdur, amma sorğu ETMİR — tövsiyələr onsuz da
 *   `overview` cavabında yoxdur, ayrıca `/users/suggested` çağırılır və o,
 *   yalnız geniş ekranda işə düşür.
 */
function renderRail(rail, d, u, sharedTeams){
  clear(rail);

  if(sharedTeams.length){
    rail.append(railBlock('pf.rail_shared', 'users',
      el('div', { class: 'pf-chips' }, sharedTeams.map(x => el('button', {
        class: 'ud-mutual pf-teamchip', type: 'button',
        onclick: () => emit('nav', { page: 'team/' + x.slug }),
      }, ico('users', 11), x.name)))));
  }

  const recent = (d.badges || []).filter(x => x.earnedAt).slice(0, 4);
  if(recent.length){
    rail.append(railBlock('pf.rail_ach', 'award',
      el('div', { class: 'pf-rail__list' }, recent.map(a => el('div', { class: 'pf-rail__i' },
        el('span', { class: 'pf-ach__ic' }, a.icon || '🎖'),
        el('span', {}, badgeLabel(a)),
        el('span', { class: 'pf-rail__t' }, fmtRelTime(a.earnedAt)),
      )))));
  }

  const projects = (d.projects || []).slice(0, 4);
  if(projects.length){
    rail.append(railBlock('pf.rail_proj', 'folder',
      el('div', { class: 'pf-rail__list' }, projects.map(p => el('button', {
        class: 'pf-rail__i pf-rail__i--btn', type: 'button',
        onclick: () => emit('nav', { page: 'team/' + p.teamSlug }),
      },
        el('span', { class: 'pf-proj__logo pf-proj__logo--sm' }, (p.name || '?').charAt(0).toUpperCase()),
        el('span', {}, p.name),
      )))));
  }

  // Tövsiyələr — geniş ekranda, ayrıca sorğu ilə.
  // ⚠ `matchMedia` ilə yoxlanılır: dar ekranda sütun onsuz da gizlidir,
  //   sorğu göndərmək lazımsız trafikdir.
  if(window.matchMedia && window.matchMedia('(min-width: 1280px)').matches){
    const box = el('div', { class: 'pf-rail__list' });
    rail.append(railBlock('pf.rail_sugg', 'userPlus', box));
    api('/users/suggested')
      .then(s => {
        const people = [...(s.known || []), ...(s.topXp || [])]
          .filter(x => x.uid !== u.uid).slice(0, 5);
        if(!people.length){ box.append(el('p', { class: 'pf-rail__empty' }, t('pf.rail_none'))); return; }
        people.forEach(x => box.append(el('button', {
          class: 'pf-rail__i pf-rail__i--btn', type: 'button',
          onclick: () => emit('nav', { page: 'u/' + x.username }),
        }, avatarNode(x, 'avatar pf-rail__av'), el('span', {}, x.name || x.username))));
        paintIcons(box);
      })
      .catch(() => { box.append(el('p', { class: 'pf-rail__empty' }, t('pf.rail_none'))); });
  }

  paintIcons(rail);
}

function railBlock(lblKey, icon, body){
  return el('section', { class: 'pf-rail__b' },
    el('h3', { class: 'pf-rail__h' }, ico(icon, 13), t(lblKey)), body);
}

/* ═══════════════════════ SKELETLƏR ═══════════════════════ */

/**
 * ⚠ SPINNER DEYİL, SKELET: yüklənən blokun FORMASI göstərilir, yəni səhifə
 *   data gələndə "sıçramır" (CLS). Spesifikasiyanın açıq tələbi.
 */
function statSkeleton(){
  const cell = big => el('div', { class: 'pf-sk pf-sk--stat' + (big ? ' pf-sk--big' : '') });
  return el('div', { class: 'pf-skwrap' },
    el('div', { class: 'pf-stats pf-stats--hero' }, [0, 1, 2, 3].map(() => cell(true))),
    el('div', { class: 'pf-stats' }, [0, 1, 2, 3, 4, 5, 6, 7].map(() => cell(false))),
  );
}
function blockSkeleton(n){
  return el('div', { class: 'pf-skwrap' },
    Array.from({ length: n }, () => el('div', { class: 'pf-sk pf-sk--row' })));
}

/* ═══════════════════════ ÖRTÜK SEÇİCİSİ ═══════════════════════ */

/**
 * Örtük naxışı seçimi — redaktordan çağırılır.
 *
 * ⚠ `openPopover` işlədilir, kart daxilində `position: absolute` YOX:
 *   profil bölmələri `content-visibility` ilə optimallaşdırılıb və o,
 *   `contain: paint` tətbiq edərək daxildəki paneli KƏSİR (layihə qeydi).
 */
export function openCoverPicker(anchor, current, onPick){
  const grid = el('div', { class: 'pf-covpick' }, COVERS.map(key => el('button', {
    class: 'pf-covopt ' + coverClass(key) + (key === (current || '') ? ' is-on' : ''),
    type: 'button', 'aria-label': t('pf.cover_change'),
    onclick: () => { closePopover(); onPick(key); },
  })));
  openPopover(anchor, el('div', { class: 'pf-pop' },
    el('div', { class: 'pf-pop__h' }, t('pf.cover_pick')), grid), { align: 'left' });
  paintIcons(grid);
}
