// İstifadəçi kataloqu — kəşf, süzgəc, üç görünüş rejimi, tövsiyə raili;
// izləmə, profil modalı, public profil səhifəsi (#u/{username}) və şikayət.
//
// ⚠ İKİ AYRI DATA YOLU VAR:
//   • `state.users` — QLOBAL identifikasiya keşi (post müəllifi, DM, mention).
//     `listUsers()`-dan gəlir və tam profil sətrini daşıyır.
//   • `dir.items`   — YALNIZ bu səhifənin sorğusu. Serverdə süzülür, sıralanır
//     və sosial kontekstlə zənginləşir (`teamsCount`, `mutualTeams`, `iFollow`).
//   İkisini qarışdırmaq olmaz: kataloq nüsxəsində `settings` yoxdur.
import { api } from './api.js';
import { lsGet, lsSet } from './storage.js';
import {
  state, createReport, toggleFollow, isMutual,
  fetchFollowingOf, fetchFollowersOf, canMessage, fetchUserDirectory,
  fetchDirectoryStats, fetchSuggestedUsers, directoryExportUrl,
} from './store.js';
import {
  el, clear, avatarNode, nameWithBadge, isOnline, lastSeenText, debounce,
  bus, emit, updateDynamicSEO, resetDynamicSEO, hashParams, prefersReducedMotion, countUp,
} from './util.js';
import { showModal, closeModal, toast, emptyState, skeletons, openPopover, closePopover } from './ui.js';
import { paintIcons } from './icon-set.js';
import { t, fmtMonthYear } from './i18n.js';
import { tax } from './taxonomy.js';
// Rank/status/kateqoriya məntiqi SAF moduldadır — profil səhifəsi də onu
// işlədir və eyni istifadəçi iki ekranda eyni görünməlidir.
import { rankOf, xpProgress, statusOf, skillCatClass, rebuildCatIndex } from './profile-kit.js';
// Publik profil ekranı — ÖZ profillə ORTAQ renderer (bax həmin faylın başlığı).
import { renderProfile } from './profile-view.js';

/* ⚠ `setFeedCache` SİLİNDİ (və `feedCache` ilə birlikdə): publik profil
   paylaşımları ƏVVƏL həmin keşdən süzülürdü — yəni yalnız lentə onsuz da
   yüklənmiş son 10 post görünürdü və lent açılmamışdan əvvəl profil
   "paylaşım yoxdur" deyirdi. İndi postlar serverdən `?author=` filtri ilə
   səhifələnir, keşə ehtiyac qalmır. */

/* ═══════════════════════ İZLƏMƏ DÜYMƏSİ ═══════════════════════ */

function followBtn(u, cls = 'c-btn c-btn--ghost c-btn--sm'){
  // ⚠ Mənbə İKİDİR: kataloq cavabındakı `iFollow` (server, dəqiq) və
  //   `state.myFollowing` (client keşi, ani). Optimistik yeniləmə üçün
  //   ikincisi lazımdır, ilk render üçün isə birincisi daha etibarlıdır.
  const following = u.iFollow !== undefined ? u.iFollow : state.myFollowing.has(u.uid);
  const btn = el('button', {
    class: cls + (following ? ' is-following' : ''),
    'aria-pressed': String(following),
    onclick: async e => {
      e.stopPropagation();
      const b = e.currentTarget;
      b.disabled = true;
      try{
        const nowFollowing = await toggleFollow(u.uid);
        u.iFollow = nowFollowing;
        b.classList.toggle('is-following', nowFollowing);
        b.setAttribute('aria-pressed', String(nowFollowing));
        const lbl = b.querySelector('.fb-label');
        if(lbl) lbl.textContent = t(nowFollowing ? 'users.a_unfollow' : 'users.a_follow');
        toast(nowFollowing ? '@' + u.username + ' izlənilir' : 'İzləmə dayandırıldı');
      }catch(err){ toast(t('dyn.err_generic'), 'err'); }
      b.disabled = false;
    },
  },
    el('span', { class: 'ic', 'data-icon': following ? 'check' : 'userPlus', 'data-icon-size': '14' }),
    el('span', { class: 'fb-label' }, t(following ? 'users.a_unfollow' : 'users.a_follow')),
  );
  paintIcons(btn);
  return btn;
}

// Mesaj icazəsi: qəbul edənin whoCanMessage siyasətinə hörmət (client tərəf; rules da qoruyur).
function tryOpenDM(u){
  if(!canMessage(u)){ toast(t('soc.msgBlocked'), 'err'); return; }
  emit('open-dm', { uid: u.uid });
}

/* ═══════════════════════ İZLƏYƏN/İZLƏDİKLƏRİ MODALI ═══════════════════════ */

export async function openFollowList(uid, kind){
  const isSelf = uid === state.authUser.uid;
  const owner = state.users.get(uid);
  // Məxfilik: başqasının izlədikləri yalnız icazə ilə
  // M-9: kənar istifadəçi üçün mənbə `publicSettings`-dir.
  if(!isSelf && (owner?.publicSettings ?? owner?.settings)?.privacy?.showFollowing === false && !state.isAdmin){
    toast(t('soc.hidden'), 'err');
    return;
  }
  const title = kind === 'followers' ? t('soc.followers') : (isSelf ? t('soc.following') : t('soc.followingOf'));
  const listBox = el('div', {});
  showModal([el('div', { class: 'section-title' }, title), listBox]);
  skeletons(listBox, 2, true);
  try{
    const uids = kind === 'followers' ? await fetchFollowersOf(uid) : await fetchFollowingOf(uid);
    clear(listBox);
    const users = uids.map(x => state.users.get(x)).filter(Boolean);
    if(!users.length){ listBox.append(emptyState('userSearch', '—')); return; }
    users.forEach(u => {
      listBox.append(el('div', { class: 'admin-user-row' },
        avatarNode(u, 'avatar', isOnline(u)),
        el('div', { class: 'name u-cursor-pointer', onclick: () => { closeModal(); emit('nav', { page: 'u/' + u.username }); } },
          nameWithBadge(u), ' ', el('span', { class: 'sub' }, '@' + u.username)),
        isMutual(u.uid) ? el('span', { class: 'mutual-tag' }, '⇄') : null,
        u.uid !== state.authUser.uid ? followBtn(u) : null,
      ));
    });
  }catch(e){
    clear(listBox);
    listBox.append(emptyState('userSearch', t('soc.hidden')));
  }
}

/* ═══════════════════════ KATALOQ VƏZİYYƏTİ ═══════════════════════ */

const VIEW_KEY = 'collabix_users_view';    // grid | list | compact — yadda qalır
const VISIBLE_SKILLS = 4;                  // qalanı "+N" nişanında

const dir = {
  cursor: null,
  loading: false,
  done: false,
  reqId: 0,        // gec gələn cavabın yenisini əzməməsi üçün
  count: 0,
  emptyStreak: 0,  // ardıcıl boş səhifə sayı (client süzgəcindən sonra)
};

let view = 'grid';
let stats = null;
let suggest = null;
let hoverCard = null;
let hoverTimer = 0;

/** Sürətli pill → server/client filtr dəyərləri. */
const QUICK = [
  { key: 'all',      icon: 'users' },
  { key: 'online',   icon: 'zap',    extra: 'online' },
  { key: 'hiring',   icon: 'briefcase', status: 'hiring' },
  { key: 'mentor',   icon: 'award',  looking: 'Mentor' },
  { key: 'verified', icon: 'check',  extra: 'verified' },
  { key: 'mutual',   icon: 'userPlus', extra: 'mutual' },
];
let quickKey = 'all';

const $ = id => document.getElementById(id);

function currentQuery(){
  const q = {
    q: ($('userSearch').value || '').trim(),
    skill: $('userSkillFilter').value,
    level: $('userLevelFilter').value,
    looking: $('userLookingFilter').value,
    extra: $('userExtraFilter').value,
    company: ($('userCompanyFilter').value || '').trim(),
    loc: ($('userLocFilter').value || '').trim(),
    status: $('userStatusFilter').value,
    sort: $('userSortSelect').value,
  };
  // Sürətli pill panel filtrlərini ƏZİR (istifadəçi son toxunduğu idarəetmə
  // qalib gəlməlidir). `all` heç nə əlavə etmir.
  const qk = QUICK.find(x => x.key === quickKey);
  if(qk){
    if(qk.extra) q.extra = qk.extra;
    if(qk.status) q.status = qk.status;
    if(qk.looking) q.looking = qk.looking;
  }
  return q;
}

/** Neçə filtr aktivdir — düymə nişanı üçün. */
function activeFilterCount(){
  const q = currentQuery();
  return ['skill', 'level', 'looking', 'extra', 'company', 'loc', 'status']
    .filter(k => !!q[k]).length;
}

// `extra` filtrlərindən `verified`, `following`, `followers`, `mutual` ARTIQ
// serverdədir (miqrasiya 0051 + `directory.ts`). `online` isə presence
// sistemindən gəlir və yalnız client-də mövcuddur.
function clientSideExtra(users, extra){
  if(extra === 'online') return users.filter(u => isOnline(u));
  return users;
}

function setStatus(text){ $('userDirStatus').textContent = text || ''; }

/* ═══════════════════════ STATİSTİKA KARTLARI ═══════════════════════ */

const STAT_CARDS = [
  { key: 'total',    icon: 'users',      tone: 'accent' },
  { key: 'online',   icon: 'zap',        tone: 'online',  field: 'activeDay' },
  { key: 'following', icon: 'userPlus',  tone: 'follow' },
  { key: 'teams',    icon: 'users',      tone: 'team' },
  { key: 'projects', icon: 'folder',     tone: 'project' },
  { key: 'verified', icon: 'check',      tone: 'verified' },
  { key: 'mentors',  icon: 'award',      tone: 'mentor' },
  { key: 'hiring',   icon: 'briefcase',  tone: 'hiring' },
];

function renderStats(){
  const box = $('userStats');
  if(!box || !stats) return;
  clear(box);
  for(const c of STAT_CARDS){
    const value = stats[c.field || c.key] || 0;
    const num = el('span', { class: 'ud-stat__num' }, '0');
    box.append(el('div', { class: 'ud-stat ud-t--' + c.tone },
      el('span', { class: 'ud-stat__ic ic', 'data-icon': c.icon, 'data-icon-size': '16' }),
      el('span', { class: 'ud-stat__body' },
        num,
        el('span', { class: 'ud-stat__lbl' }, t('users.s_' + c.key)),
        // Trend yalnız "üzvlər" kartındadır — qalanları üçün həftəlik artım
        // ölçülmür və uydurma rəqəm göstərmək yanlış olardı.
        c.key === 'total' && stats.newWeek
          ? el('span', { class: 'ud-stat__trend' }, t('users.s_new_week').replace('{n}', String(stats.newWeek)))
          : null,
      ),
    ));
    countUp(num, value, { duration: 420 });
  }
  paintIcons(box);
}

/* ═══════════════════════ SÜRƏTLİ PİLLƏR ═══════════════════════ */

function renderQuick(){
  const box = $('userQuick');
  if(!box) return;
  clear(box);
  for(const q of QUICK){
    const active = quickKey === q.key;
    box.append(el('button', {
      class: 'ud-pill' + (active ? ' is-active' : ''),
      type: 'button', role: 'tab', 'aria-selected': String(active),
      onclick: () => {
        quickKey = quickKey === q.key ? 'all' : q.key;
        renderQuick();
        reloadDirectory();
      },
    },
      el('span', { class: 'ud-pill__ic ic', 'data-icon': q.icon, 'data-icon-size': '15' }),
      el('span', {}, t('users.q_' + q.key)),
    ));
  }
  paintIcons(box);
}

/* ═══════════════════════ KART ═══════════════════════ */

function skillChips(u, max){
  const levels = { ...(u.progLevels || {}), ...(u.langLevels || {}) };
  const all = [...(u.prog || []), ...(u.langs || [])];
  if(!all.length) return null;

  // ⚠ Səviyyə TƏK HƏRFLƏ göstərilir (B/O/Q) — nişan dar olmalıdır, tam söz
  //   ("Qabaqcıl") kartı sındırırdı. Hərf təkbaşına şifrəlidir, ona görə tam
  //   dəyər `title`-dədir: siçanla üstünə gələn və ekran oxuyucusu onu alır.
  const chip = lbl => el('span', {
    class: 'ud-skill ' + skillCatClass(lbl),
    title: levels[lbl] ? lbl + ' · ' + levels[lbl] : lbl,
  }, lbl, levels[lbl] ? el('i', {}, levels[lbl].slice(0, 1)) : null);

  const row = el('div', { class: 'ud-skills' });
  all.slice(0, max).forEach(lbl => row.append(chip(lbl)));

  const rest = all.slice(max);
  if(!rest.length) return row;

  const pop = el('div', { class: 'ud-skillpop', role: 'tooltip' },
    el('div', { class: 'ud-skillpop__t' }, t('users.all_skills')),
    el('div', { class: 'ud-skillpop__b' }, all.map(chip)));

  // ⚠ HOVER İLƏ AÇILMIR, yalnız KLİKLƏ: (a) toxunuş cihazında hover yoxdur
  //   (`hover-vs-tap`), (b) panel `body`-yə portal edilir və hover-la
  //   idarə olunan portal siçan paneldən çıxanda ilişib qalırdı.
  const more = el('button', {
    class: 'ud-skill ud-skill--more', type: 'button',
    'aria-label': t('users.more_skills').replace('{0}', String(rest.length)),
    'aria-expanded': 'false',
    onclick: e => {
      e.stopPropagation();
      more.setAttribute('aria-expanded', 'true');
      openPopover(more, pop, { align: 'left' });
    },
  }, '+' + rest.length);

  row.append(el('span', { class: 'ud-morewrap' }, more));
  return row;
}

function statusDot(u){
  const s = statusOf(u);
  return el('span', {
    class: 'ud-status ud-s--' + s.tone,
    title: t(s.key), 'aria-label': t(s.key),
  });
}

function xpBlock(u){
  const r = rankOf(u.xp);
  const p = xpProgress(u.xp);
  const fill = el('span', { class: 'ud-xp__fill ud-r--' + r.tone });
  // ⚠ CSSOM ilə yazılır, HTML `style="…"` atributu ilə YOX: CSP `style-src`
  //   atribut formasını bloklayır və zolaq prod-da SƏSSİZCƏ sıfır enində
  //   qalardı (layihə qeydi: `csp-blocks-inline-style-attributes`).
  fill.style.setProperty('--ud-xp-pct', p.pct + '%');
  return el('div', { class: 'ud-xp' },
    el('div', { class: 'ud-xp__top' },
      el('span', { class: 'ud-rank ud-r--' + r.tone },
        el('span', { class: 'ic', 'data-icon': 'crown', 'data-icon-size': '11' }),
        r.label, el('i', {}, 'Lv' + r.lvl)),
      el('span', { class: 'ud-xp__num' }, (u.xp || 0).toLocaleString(), ' XP'),
    ),
    el('div', {
      class: 'ud-xp__bar', role: 'progressbar',
      'aria-valuenow': String(p.pct), 'aria-valuemin': '0', 'aria-valuemax': '100',
      'aria-label': p.isMax ? t('users.rk_max') : t('users.rk_next').replace('{n}', String(p.remaining)),
      title: p.isMax ? t('users.rk_max') : t('users.rk_next').replace('{n}', String(p.remaining)),
    }, fill),
  );
}

/** Meta sətri — şirkət · yer · qoşulma. Boş sahələr TAMAM buraxılır. */
function metaRow(u){
  const bits = [];
  if(u.company) bits.push(['building', u.company]);
  const loc = [u.city, u.country].filter(Boolean).join(', ');
  if(loc) bits.push(['mapPin', loc]);
  // ⚠ `month: 'short'` İŞLƏDİLMİR: `az-AZ` ICU məlumatında qısa ay adı
  //   "M07" formasındadır və kartda "Qoşulub 2026 M07" kimi oxunmaz çıxırdı.
  //   `long` hər üç dildə düzgün ay adı verir.
  if(!bits.length && u.joinedAt) bits.push(['calendar', t('users.c_joined').replace('{d}', fmtMonthYear(u.joinedAt))]);
  if(!bits.length) return null;
  return el('div', { class: 'ud-meta' }, bits.map(([ic, txt]) =>
    el('span', { class: 'ud-meta__i' },
      el('span', { class: 'ic', 'data-icon': ic, 'data-icon-size': '13' }), txt)));
}

/** Sosial sətir — izləyici / komanda / layihə + ortaqlıqlar. */
function socialRow(u){
  const row = el('div', { class: 'ud-social' });
  const n = (v, key) => el('span', { class: 'ud-social__i' },
    el('b', {}, String(v || 0)), ' ' + t(key));
  row.append(n(u.followersCount, 'users.c_followers'));
  if(u.teamsCount) row.append(n(u.teamsCount, 'users.c_teams'));
  if(u.projectsCount) row.append(n(u.projectsCount, 'users.c_projects'));

  if(u.mutualTeams) row.append(el('span', { class: 'ud-mutual' },
    el('span', { class: 'ic', 'data-icon': 'users', 'data-icon-size': '11' }),
    t('users.c_mutual_t').replace('{n}', String(u.mutualTeams))));
  if(u.mutualProjects) row.append(el('span', { class: 'ud-mutual' },
    el('span', { class: 'ic', 'data-icon': 'folder', 'data-icon-size': '11' }),
    t('users.c_mutual_p').replace('{n}', String(u.mutualProjects))));
  if(u.followsMe) row.append(el('span', { class: 'ud-mutual ud-mutual--f' }, t('users.c_follows_you')));
  return row;
}

function actionRow(u, compact){
  const box = el('div', { class: 'ud-actions' });
  box.append(el('button', {
    class: 'c-btn c-btn--primary c-btn--sm ud-actions__msg',
    onclick: e => { e.stopPropagation(); tryOpenDM(u); },
  },
    el('span', { class: 'ic', 'data-icon': 'send', 'data-icon-size': '14' }),
    compact ? null : el('span', {}, t('users.a_msg'))));
  box.append(followBtn(u));
  if(!compact) box.append(el('button', {
    class: 'c-btn c-btn--ghost c-btn--sm',
    onclick: e => { e.stopPropagation(); emit('nav', { page: 'u/' + u.username }); },
  }, t('users.a_profile')));
  box.append(el('button', {
    class: 'c-icon-btn ud-more', type: 'button',
    'aria-label': t('users.a_more'),
    onclick: function(e){ e.stopPropagation(); openUserMenu(this, u); },
  }, el('span', { class: 'ic', 'data-icon': 'more', 'data-icon-size': '16' })));
  paintIcons(box);
  return box;
}

function userCard(u){
  const compact = view === 'compact';
  const maxSkills = compact ? 2 : VISIBLE_SKILLS;
  const s = statusOf(u);

  const card = el('article', {
    class: 'ud-card' + (u.verified ? ' is-verified' : ''),
    dataset: { uid: u.uid },
    tabindex: '0',
    'aria-label': u.name + ' @' + u.username,
    onclick: e => {
      if(e.target.closest('.ud-actions, .ud-morewrap, .ud-menu')) return;
      emit('nav', { page: 'u/' + u.username });
    },
    onkeydown: e => {
      if(e.key === 'Enter'){ e.preventDefault(); emit('nav', { page: 'u/' + u.username }); }
    },
  });

  // ── Avatar sütunu
  const avWrap = el('div', { class: 'ud-card__av' },
    avatarNode(u, 'avatar'),
    statusDot(u),
  );
  // Hover mini-profil YALNIZ avatarda açılır (spesifikasiya) — bütün kartda
  // açılsaydı siyahını sürüşdürərkən dayanmadan görünərdi.
  avWrap.addEventListener('mouseenter', () => scheduleHover(avWrap, u));
  avWrap.addEventListener('mouseleave', cancelHover);
  card.append(avWrap);

  // ── Əsas sütun
  const body = el('div', { class: 'ud-card__body' });
  body.append(el('div', { class: 'ud-id' },
    el('span', { class: 'ud-name' }, nameWithBadge(u)),
    el('span', { class: 'ud-handle' }, '@' + u.username),
    s.tone === 'hiring' ? el('span', { class: 'ud-badge ud-s--hiring' }, t('users.st_hiring')) : null,
  ));

  const meta = metaRow(u);
  if(meta) body.append(meta);

  if(!compact){
    body.append(el('p', { class: 'ud-bio' }, u.bio || t('users.c_no_bio')));
  }
  body.append(xpBlock(u));
  const chips = skillChips(u, maxSkills);
  if(chips) body.append(chips);
  if(!compact) body.append(socialRow(u));
  card.append(body);

  // ── Əməliyyat sütunu
  card.append(el('div', { class: 'ud-card__side' },
    el('span', { class: 'ud-seen' }, lastSeenText(u) || ''),
    actionRow(u, compact),
  ));

  paintIcons(card);
  return card;
}

/* ═══════════════════════ HOVER MİNİ-PROFİL ═══════════════════════ */

function scheduleHover(anchor, u){
  // ⚠ 380 ms GECİKMƏ: onsuz siyahı boyu siçan hərəkəti onlarla panel açırdı
  //   (`hover-vs-tap` qaydası — hover təsadüfi ola bilər). Toxunuş
  //   cihazlarında `mouseenter` ümumiyyətlə atılır.
  if(window.matchMedia('(pointer: coarse)').matches) return;
  cancelHover();
  hoverTimer = window.setTimeout(() => showHover(anchor, u), 380);
}

function cancelHover(){
  clearTimeout(hoverTimer);
  if(hoverCard){ hoverCard = null; closePopover(); }
}

function showHover(anchor, u){
  const r = rankOf(u.xp);
  const loc = [u.city, u.country].filter(Boolean).join(', ');
  hoverCard = el('div', { class: 'ud-hover', role: 'tooltip' },
    el('div', { class: 'ud-hover__head' },
      avatarNode(u, 'avatar'),
      el('div', {},
        el('b', {}, nameWithBadge(u)),
        el('span', { class: 'ud-handle' }, '@' + u.username),
      ),
    ),
    u.company || loc ? el('div', { class: 'ud-hover__meta' },
      [u.company, loc].filter(Boolean).join(' · ')) : null,
    el('p', { class: 'ud-hover__bio' }, u.bio || t('users.c_no_bio')),
    el('div', { class: 'ud-hover__row' },
      el('span', { class: 'ud-rank ud-r--' + r.tone }, r.label, el('i', {}, 'Lv' + r.lvl)),
      el('span', { class: 'ud-hover__xp' }, (u.xp || 0).toLocaleString() + ' XP'),
    ),
    skillChips(u, 5),
    el('div', { class: 'ud-hover__act' },
      el('button', { class: 'c-btn c-btn--primary c-btn--sm', onclick: () => tryOpenDM(u) }, t('users.a_msg')),
      followBtn(u),
    ),
  );
  // ⚠ Kartın İÇİNƏ qoyula BİLMƏZ: `content-visibility: auto` paint
  //   containment tətbiq edir və kartdan kənara çıxan panel kəsilir
  //   (menyu ilə eyni səbəb). Portal + `position: fixed`.
  paintIcons(hoverCard);
  openPopover(anchor, hoverCard, { align: 'left', gap: 8 });
}

/* ═══════════════════════ "DAHA ÇOX" MENYUSU ═══════════════════════ */

// 🔴 Menyu BODY-yə portal edilir. `.ud-card` `content-visibility: auto`
//    işlədir və o, HƏMİŞƏ `contain: paint` tətbiq edir — kartdan kənara çıxan
//    `absolute` panel KƏSİLİR. Menyu DOM-da var idi, ekranda yox idi.
//    Açıq panelin vəziyyətini `ui.js` portalı saxlayır — yerli dəyişən yox.
function closeMenu(){ closePopover(); }

function openUserMenu(anchor, u){
  closeMenu();
  /** @type {Array<{key: string, icon: string, run: () => void}>} */
  const items = [
    { key: 'users.a_profile', icon: 'profile', run: () => emit('nav', { page: 'u/' + u.username }) },
    { key: 'users.a_copy', icon: 'copy', run: () => copyProfileLink(u) },
    { key: 'users.a_share', icon: 'share', run: () => shareProfile(u) },
    { key: 'users.a_report', icon: 'flag', run: () => openReportForm(u) },
  ];
  const menu = el('div', { class: 'ud-menu', role: 'menu' },
    items.map(it => el('button', {
      class: 'ud-menu__item', role: 'menuitem', type: 'button',
      onclick: e => { e.stopPropagation(); closeMenu(); it.run(); },
    },
      el('span', { class: 'ic', 'data-icon': it.icon, 'data-icon-size': '15' }),
      el('span', {}, t(it.key)),
    )),
  );
  paintIcons(menu);
  openPopover(anchor, menu);
}

const profileUrl = u => location.origin + '/#u/' + u.username;

async function copyProfileLink(u){
  try{ await navigator.clipboard.writeText(profileUrl(u)); toast(t('users.a_copied')); }
  catch(e){ toast(t('dyn.err_generic'), 'err'); }
}

async function shareProfile(u){
  // `navigator.share` yalnız HTTPS + istifadəçi jesti ilə işləyir və
  // masaüstü brauzerlərin çoxunda yoxdur — kopyalamaya geri düşür.
  if(navigator.share){
    try{ await navigator.share({ title: u.name, url: profileUrl(u) }); return; }
    catch(e){ /* istifadəçi ləğv etdi — səssiz */ }
  }
  copyProfileLink(u);
}

/* ═══════════════════════ TÖVSİYƏ RAİLİ ═══════════════════════ */

const RAIL_GROUPS = [
  { key: 'known',  field: 'known' },
  { key: 'topxp',  field: 'topXp' },
  { key: 'fresh',  field: 'fresh' },
  { key: 'active', field: 'active' },
];

function renderRail(){
  const box = $('userRail');
  if(!box) return;
  clear(box);
  if(!suggest){
    box.append(el('div', { class: 'ud-rail__box' },
      el('span', { class: 'c-skeleton c-skeleton--title' }),
      el('span', { class: 'c-skeleton c-skeleton--line' }),
      el('span', { class: 'c-skeleton c-skeleton--line' })));
    return;
  }

  const groups = RAIL_GROUPS.filter(g => (suggest[g.field] || []).length);
  if(!groups.length){
    box.append(el('div', { class: 'ud-rail__box' },
      el('p', { class: 'ud-rail__empty' }, t('users.r_empty'))));
    return;
  }

  box.append(el('h2', { class: 'ud-rail__title' }, t('users.r_title')));
  for(const g of groups){
    const list = el('div', { class: 'ud-rail__list' });
    for(const u of suggest[g.field]){
      list.append(el('div', { class: 'ud-mini' },
        el('button', {
          class: 'ud-mini__id', type: 'button',
          onclick: () => emit('nav', { page: 'u/' + u.username }),
        },
          avatarNode(u, 'avatar'),
          el('span', { class: 'ud-mini__txt' },
            el('b', {}, u.name),
            el('span', {}, u.company || ('@' + u.username)),
          ),
        ),
        followBtn(u, 'c-btn c-btn--ghost c-btn--sm ud-mini__f'),
      ));
    }
    box.append(el('section', { class: 'ud-rail__box' },
      el('h3', { class: 'ud-rail__h' }, t('users.r_' + g.key)), list));
  }
  paintIcons(box);
}

/* ═══════════════════════ SİYAHI ═══════════════════════ */

function renderEmpty(grid){
  grid.append(el('div', { class: 'c-empty ud-empty' },
    el('div', { class: 'ud-empty__art' },
      el('span', { class: 'ic', 'data-icon': 'userSearch', 'data-icon-size': '32' })),
    el('div', { class: 'c-empty__title' }, t('users.none_title')),
    el('div', { class: 'c-empty__text' }, t('users.none_text')),
    el('div', { class: 'ud-empty__act' },
      el('button', { class: 'c-btn c-btn--ghost c-btn--sm', onclick: resetFilters }, t('users.flt_reset')),
      el('button', { class: 'c-btn c-btn--primary c-btn--sm', onclick: openInvite }, t('users.invite')),
    ),
  ));
  paintIcons(grid);
}

/**
 * Skeleton — spinner YOX.
 * ⚠ Ölçü real karta yaxındır: uzaq olsa skeleton sıçrayışı gizlədib sonra
 *   geri qaytarar (CLS). Rejim dəyişəndə skeleton da dəyişir.
 */
function renderSkeletons(grid, n = 6){
  clear(grid);
  for(let i = 0; i < n; i++){
    grid.append(el('div', { class: 'ud-card ud-card--sk' },
      el('div', { class: 'c-skeleton ud-sk-av' }),
      el('div', { class: 'ud-card__body' },
        el('div', { class: 'c-skeleton c-skeleton--line ud-sk-1' }),
        el('div', { class: 'c-skeleton c-skeleton--line ud-sk-2' }),
        el('div', { class: 'c-skeleton c-skeleton--line ud-sk-3' }),
      ),
    ));
  }
}

async function loadDirectory({ reset = false } = {}){
  if(!state.authUser) return;            // logout keçidində gec gələn event-lər
  if(dir.loading || (dir.done && !reset)) return;

  const grid = $('userGrid');
  if(reset){
    dir.cursor = null; dir.done = false; dir.count = 0; dir.emptyStreak = 0;
    renderSkeletons(grid, view === 'compact' ? 10 : 6);
  }

  dir.loading = true;
  const my = ++dir.reqId;
  setStatus(t('users.loading'));

  try{
    const params = currentQuery();
    const d = await fetchUserDirectory({ ...params, cursor: dir.cursor });
    if(my !== dir.reqId) return;          // daha yeni sorğu var — bunu at

    if(reset) clear(grid);
    const rows = clientSideExtra(d.users, params.extra);
    rows.forEach(u => grid.append(userCard(u)));
    dir.count += rows.length;
    dir.cursor = d.nextCursor;
    dir.done = !d.nextCursor;

    if(dir.done){
      setStatus(dir.count ? t('users.count_n').replace('{n}', String(dir.count)) : '');
      if(!dir.count){ clear(grid); renderEmpty(grid); }
    } else {
      setStatus('');
      // Server səhifəsi client süzgəcindən (`online`) sonra tam boşala bilər —
      // belə halda sentinel görünmür və scroll dayanır, ona görə növbəti
      // səhifəni özümüz çəkirik.
      // ⚠ Zəncir məhdudlaşdırılıb: "onlayn" filtri ilə heç kim uyğun gəlmirsə
      // bu, bütün bazanı ard-arda sorğulaya bilərdi. 5 boş səhifədən sonra
      // dayanır və istifadəçi scroll edərək davam edə bilər.
      // ⚠ ZƏNCİR ARTIQ QISADIR: `mutual`/`following`/`verified` serverə
      //   köçürüldüyü üçün yalnız `online` bu yola düşür.
      if(!rows.length){
        dir.emptyStreak = (dir.emptyStreak || 0) + 1;
        dir.loading = false;
        if(dir.emptyStreak < 5) return loadDirectory();
        setStatus(dir.count ? '' : t('users.none'));
        if(!dir.count){ clear(grid); renderEmpty(grid); }
        return;
      }
      dir.emptyStreak = 0;
    }
  }catch(e){
    if(my !== dir.reqId) return;
    console.error('kataloq yüklənmədi', e);
    if(reset) clear(grid);
    setStatus(t('users.err'));
  }finally{
    if(my === dir.reqId) dir.loading = false;
  }
}

const reloadDirectory = () => { updateFilterBadge(); loadDirectory({ reset: true }); };

/* ═══════════════════════ GÖRÜNÜŞ REJİMİ ═══════════════════════ */

function applyView(v){
  view = ['grid', 'list', 'compact'].includes(v) ? v : 'grid';
  const grid = $('userGrid');
  grid.classList.remove('view-grid', 'view-list', 'view-compact');
  grid.classList.add('view-' + view);
  document.querySelectorAll('#userViewToggle button').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view));
  lsSet(VIEW_KEY, view);
}

/* ═══════════════════════ FİLTR PANELİ ═══════════════════════ */

function updateFilterBadge(){
  const n = activeFilterCount();
  const badge = $('userFilterCount');
  if(!badge) return;
  badge.textContent = String(n);
  badge.hidden = n === 0;
  const btn = $('userFilterBtn');
  if(btn) btn.setAttribute('aria-label', t('users.flt_n').replace('{n}', String(n)));
}

function toggleFilters(force){
  const panel = $('userFilters');
  const btn = $('userFilterBtn');
  const open = force !== undefined ? force : panel.hidden;
  panel.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
}

function resetFilters(){
  ['userSkillFilter', 'userLevelFilter', 'userLookingFilter', 'userExtraFilter', 'userStatusFilter']
    .forEach(id => { const s = $(id); if(s) s.value = ''; });
  ['userCompanyFilter', 'userLocFilter', 'userSearch'].forEach(id => { const i = $(id); if(i) i.value = ''; });
  $('userSortSelect').value = 'recent';
  quickKey = 'all';
  renderQuick();
  reloadDirectory();
}

function rebuildSkillFilter(){
  const sel = $('userSkillFilter');
  if(!sel) return;
  const cur = sel.value;
  clear(sel);
  sel.append(el('option', { value: '' }, t('users.flt_skill')));
  [...tax.prog, ...tax.spoken].forEach(i => sel.append(el('option', { value: i.label }, i.label)));
  sel.value = cur;
  rebuildCatIndex();
}

/* ═══════════════════════ AXTARIŞ + AVTOTAMAMLAMA ═══════════════════════ */

let suggestIdx = -1;

function closeSuggest(){
  const box = $('userSuggest');
  if(!box) return;
  box.hidden = true;
  clear(box);
  suggestIdx = -1;
  $('userSearch').setAttribute('aria-expanded', 'false');
}

/**
 * Avtotamamlama — YÜKLƏNMİŞ nəticələrdən + taksonomiyadan.
 *
 * ⚠ AYRICA SORĞU GÖNDƏRMİR: hər hərfdə ikinci endpoint çağırmaq limit
 *   səbətini iki dəfə sürətlə yeyərdi. Siyahı onsuz da 250 ms debounce ilə
 *   serverdən yenilənir; təklif isə həmin nəticələrin üzərində qurulur.
 */
function renderSuggest(term){
  const box = $('userSuggest');
  const input = $('userSearch');
  if(!box) return;
  const q = term.toLowerCase();
  if(q.length < 2){ closeSuggest(); return; }

  const people = [...state.users.values()]
    .filter(u => u.uid !== state.authUser.uid
      && ((u.name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q)))
    .slice(0, 5);
  const skills = [...tax.prog, ...tax.spoken]
    .filter(i => i.label.toLowerCase().includes(q)).slice(0, 3);

  if(!people.length && !skills.length){ closeSuggest(); return; }

  clear(box);
  suggestIdx = -1;
  people.forEach(u => box.append(el('button', {
    class: 'ud-suggest__i', type: 'button', role: 'option', 'aria-selected': 'false',
    onclick: () => { closeSuggest(); emit('nav', { page: 'u/' + u.username }); },
  },
    avatarNode(u, 'avatar'),
    el('span', {}, el('b', {}, u.name), ' ', el('i', {}, '@' + u.username)),
  )));
  skills.forEach(s => box.append(el('button', {
    class: 'ud-suggest__i ud-suggest__i--skill', type: 'button', role: 'option', 'aria-selected': 'false',
    onclick: () => {
      closeSuggest();
      input.value = '';
      $('userSkillFilter').value = s.label;
      reloadDirectory();
    },
  },
    el('span', { class: 'ic', 'data-icon': 'code', 'data-icon-size': '15' }),
    el('span', {}, s.label),
  )));
  box.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  paintIcons(box);
}

function moveSuggest(delta){
  const box = $('userSuggest');
  if(!box || box.hidden) return;
  const items = [...box.querySelectorAll('.ud-suggest__i')];
  if(!items.length) return;
  suggestIdx = (suggestIdx + delta + items.length) % items.length;
  items.forEach((n, i) => {
    n.classList.toggle('is-active', i === suggestIdx);
    n.setAttribute('aria-selected', String(i === suggestIdx));
  });
  items[suggestIdx].scrollIntoView({ block: 'nearest' });
}

/* ═══════════════════════ DƏVƏT ═══════════════════════ */

/**
 * Dəvət modalı — mövcud `/api/me/invites` axını (miqrasiya 0037).
 *
 * ⚠ YENİ ENDPOINT YARADILMADI: dəvət kodu sistemi artıq var idi, sadəcə
 *   İstifadəçilər səhifəsindən əlçatan deyildi.
 */
async function openInvite(){
  const box = el('div', {}, el('span', { class: 'c-skeleton c-skeleton--line' }));
  showModal([el('div', { class: 'section-title' }, t('users.invite')), box]);
  try{
    const d = await api('/me/invites');
    const list = (d.invites || []).filter(x => x.active);
    clear(box);
    const show = code => {
      const url = location.origin + '/?invite=' + code;
      box.append(el('div', { class: 'ud-invite' },
        el('code', {}, url),
        el('button', {
          class: 'c-btn c-btn--ghost c-btn--sm',
          onclick: async () => {
            try{ await navigator.clipboard.writeText(url); toast(t('users.a_copied')); }
            catch(e){ toast(t('dyn.err_generic'), 'err'); }
          },
        }, t('users.a_copy'))));
    };
    if(list.length) list.slice(0, 3).forEach(x => show(x.code));
    else box.append(el('button', {
      class: 'c-btn c-btn--primary c-btn--sm',
      onclick: async e => {
        e.currentTarget.disabled = true;
        try{
          const r = await api('/me/invites', { method: 'POST', body: {} });
          clear(box); show(r.invite.code);
        }catch(err){ toast(t('dyn.err_generic'), 'err'); }
      },
    }, t('users.invite')));
  }catch(e){
    clear(box);
    box.append(el('p', { class: 'ud-rail__empty' }, t('dyn.err_generic')));
  }
}

/* ═══════════════════════ İXRAC ═══════════════════════ */

function exportCsv(){
  // ⚠ `<a download>` işlədilir, `fetch` YOX: fayl Worker-dən stream gəlir və
  //   brauzer endirməni özü aparır (admin CSV ixracı ilə eyni naxış). `fetch`
  //   ilə bütün faylı yaddaşa yığmaq lazım gələrdi.
  const a = el('a', { href: directoryExportUrl(currentQuery()), download: '' });
  document.body.append(a);
  a.click();
  a.remove();
  toast(t('users.export_ok'));
}

/* ═══════════════════════ YAPIŞQAN QAT OFSETLƏRİ ═══════════════════════ */

let stickyRO = null;

/**
 * İki yapışqan qat üst-üstə düzülür: topbar → idarəetmə zolağı; tövsiyə raili
 * də topbar-ın altında dayanır.
 *
 * 🔴 DƏYƏRLƏR ÖLÇÜLÜR, CSS-də SABİT YAZILMIR. `.app-topbar` hündürlüyü şrift
 *    ölçüsündən asılıdır, `.ud-controls` isə 480px-dən dar ekranda sarılıb
 *    hündürləşir. Sabit `top: 108px` yazılanda axtarış sahəsi topbar-ın
 *    ALTINDA gizlənirdi (bildiriş mərkəzində ölçülmüş eyni qüsur).
 *
 * ⚠ `style.setProperty` CSSOM yoluyladır — CSP atribut formasını bloklayır.
 */
function syncUsersSticky(){
  const root = document.getElementById('page-users');
  const controls = $('userControls');
  if(!root || !controls) return;
  const topbar = document.querySelector('.app-topbar');
  const h = node => (node ? Math.round(node.getBoundingClientRect().height) : 0);
  root.style.setProperty('--ud-topbar', h(topbar) + 'px');
  root.style.setProperty('--ud-controls-h', h(controls) + 'px');
}

function initStickyWatcher(){
  const controls = $('userControls');
  if(!controls || stickyRO) return;
  syncUsersSticky();
  // Filtr paneli açılıb-bağlandıqda, dil dəyişəndə və şrift yüklənəndə
  // hündürlük dəyişir — `resize` hadisəsi bunların HEÇ BİRİNİ tutmur.
  stickyRO = new ResizeObserver(syncUsersSticky);
  stickyRO.observe(controls);
  const topbar = document.querySelector('.app-topbar');
  if(topbar) stickyRO.observe(topbar);
}

/* ═══════════════════════ MOUNT ═══════════════════════ */

// Ana#10 — homepage-dən gələn öncədən-seçilmiş skill.
// İki mənbə: URL param (#users?skill=Python, paylaşıla bilən) və sessionStorage
// (qonaq nişana klikləyib qeydiyyatdan keçəndə seçim itməsin deyə).
const PENDING_SKILL_KEY = 'collabix_pending_skill';
function applyPendingSkill(){
  let skill = hashParams().get('skill');
  if(!skill){
    try{
      skill = sessionStorage.getItem(PENDING_SKILL_KEY);
      if(skill) sessionStorage.removeItem(PENDING_SKILL_KEY);
    }catch(e){}
  }
  if(!skill) return;
  const sel = $('userSkillFilter');
  // Yalnız taksonomiyada həqiqətən mövcud olan dəyəri tətbiq et
  // (uydurma param filtri "heç nə tapılmadı" vəziyyətinə salmasın).
  if([...sel.options].some(o => o.value === skill)) sel.value = skill;
}

export function mountUsers(){
  rebuildSkillFilter();
  applyPendingSkill();
  renderQuick();
  updateFilterBadge();

  applyView(lsGet(VIEW_KEY, 'grid'));

  reloadDirectory();

  // Xülasə və tövsiyələr — siyahıdan ASILI DEYİL, ona görə paralel çəkilir
  // və uğursuzluğu siyahını bloklamır.
  fetchDirectoryStats().then(d => { stats = d; renderStats(); }).catch(() => {});
  renderRail();
  fetchSuggestedUsers().then(d => { suggest = d; renderRail(); }).catch(() => { suggest = {}; renderRail(); });

  /* ---- axtarış ---- */
  const input = $('userSearch');
  const onSearch = debounce(reloadDirectory, 250);
  const onInput = e => { onSearch(); renderSuggest(e.target.value.trim()); };
  input.addEventListener('input', onInput);
  const onSearchKey = e => {
    if(e.key === 'ArrowDown'){ e.preventDefault(); moveSuggest(1); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); moveSuggest(-1); }
    else if(e.key === 'Enter' && suggestIdx >= 0){
      e.preventDefault();
      $('userSuggest').querySelectorAll('.ud-suggest__i')[suggestIdx]?.click();
    }
    else if(e.key === 'Escape'){ closeSuggest(); input.value = ''; reloadDirectory(); }
  };
  input.addEventListener('keydown', onSearchKey);
  input.addEventListener('blur', () => setTimeout(closeSuggest, 150));

  // Ctrl/Cmd + K — axtarışa fokus.
  // ⚠ `preventDefault` MƏCBURİDİR: Firefox-da Ctrl+K brauzerin öz axtarış
  //   sətrini açır və hadisə bizə çatsa da səhifə fokusu itirirdi.
  const onHotkey = e => {
    if((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')){
      if(!document.getElementById('page-users').classList.contains('active')) return;
      e.preventDefault();
      input.focus();
      input.select();
    }
  };
  document.addEventListener('keydown', onHotkey);

  /* ---- filtrlər ---- */
  const selIds = ['userSkillFilter', 'userLevelFilter', 'userLookingFilter',
    'userExtraFilter', 'userStatusFilter', 'userSortSelect'];
  const sels = selIds.map(id => $(id));
  sels.forEach(s => s.addEventListener('change', reloadDirectory));

  const textIds = ['userCompanyFilter', 'userLocFilter'];
  const texts = textIds.map(id => $(id));
  const onTextFilter = debounce(reloadDirectory, 300);
  texts.forEach(i => i.addEventListener('input', onTextFilter));

  const filterBtn = $('userFilterBtn');
  const onFilterBtn = () => toggleFilters();
  filterBtn.addEventListener('click', onFilterBtn);
  const resetBtn = $('userFilterReset');
  resetBtn.addEventListener('click', resetFilters);
  const applyBtn = $('userFilterApply');
  const onApply = () => { toggleFilters(false); reloadDirectory(); };
  applyBtn.addEventListener('click', onApply);

  /* ---- görünüş ---- */
  const toggle = $('userViewToggle');
  const onToggle = e => {
    const b = e.target.closest('button[data-view]');
    if(!b) return;
    applyView(b.dataset.view);
    // Rejim dəyişəndə kartların strukturu dəyişir → yenidən çəkilir.
    loadDirectory({ reset: true });
  };
  toggle.addEventListener('click', onToggle);

  /* ---- başlıq əməliyyatları ---- */
  const inviteBtn = $('userInviteBtn');
  inviteBtn.addEventListener('click', openInvite);
  const exportBtn = $('userExportBtn');
  exportBtn.addEventListener('click', exportCsv);

  /* ---- yuxarı qayıt ---- */
  const toTop = $('userToTop');
  const onScroll = () => {
    toTop.hidden = window.scrollY < 600;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  const onToTop = () => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  toTop.addEventListener('click', onToTop);

  /* ---- canlı yeniləmələr ---- */
  // Follow/presence dəyişiklikləri bütün siyahını yenidən çəkməməlidir —
  // yalnız client-side süzgəc aktivdirsə nəticə dəyişə bilər.
  const onSoft = () => {
    if(currentQuery().extra === 'online') reloadDirectory();
  };
  bus.addEventListener('follows-updated', onSoft);
  bus.addEventListener('presence-updated', onSoft);
  bus.addEventListener('taxonomy-updated', rebuildSkillFilter);

  /* ---- sonsuz sürüşmə ---- */
  const sentinel = $('userSentinel');
  const io = new IntersectionObserver(entries => {
    if(entries.some(e => e.isIntersecting)) loadDirectory();
  }, { rootMargin: '300px' });
  io.observe(sentinel);

  initStickyWatcher();

  return () => {
    io.disconnect();
    if(stickyRO){ stickyRO.disconnect(); stickyRO = null; }
    dir.reqId++;                 // uçuşdakı cavablar DOM-a toxunmasın
    dir.loading = false;
    cancelHover();
    closeMenu();
    closeSuggest();
    input.removeEventListener('input', onInput);
    input.removeEventListener('keydown', onSearchKey);
    document.removeEventListener('keydown', onHotkey);
    sels.forEach(s => s.removeEventListener('change', reloadDirectory));
    texts.forEach(i => i.removeEventListener('input', onTextFilter));
    filterBtn.removeEventListener('click', onFilterBtn);
    resetBtn.removeEventListener('click', resetFilters);
    applyBtn.removeEventListener('click', onApply);
    toggle.removeEventListener('click', onToggle);
    inviteBtn.removeEventListener('click', openInvite);
    exportBtn.removeEventListener('click', exportCsv);
    window.removeEventListener('scroll', onScroll);
    toTop.removeEventListener('click', onToTop);
    bus.removeEventListener('follows-updated', onSoft);
    bus.removeEventListener('presence-updated', onSoft);
    bus.removeEventListener('taxonomy-updated', rebuildSkillFilter);
  };
}

/* ═══════════════════════ PUBLİK PROFİL (#u/{username}) ═══════════════════════
 *
 * 🔴 MƏNBƏ DƏYİŞDİ: səhifə ƏVVƏL `state.users` keşindən oxuyurdu. Keş
 *    `listUsers()`-dan gəlir və `LIMIT 500` daşıyır — 500-dən kənarda qalan
 *    hesabın profil linki "tapılmadı" verirdi; keş dolmamış açılan dərin link
 *    (bildirişdən, paylaşılmış URL-dən) isə HƏMİŞƏ boş səhifə göstərirdi.
 *    İndi `/api/users/:username/profile` çağırılır — sosial saylar, komanda
 *    və ortaqlıqlar da həmin cavabdadır.
 *
 * ⚠ `el()` NULL-LARI SÜZÜR, xam `node.append()` isə YOX — o, `null`-u
 *   `"null"` MƏTNİNƏ çevirir. Əvvəlki versiyada məhz bu səbəbdən səhifədə
 *   üç yerdə "null" yazısı görünürdü. Bu funksiya artıq HƏR ŞEYİ `el()` ilə
 *   qurur; xam `append` yalnız NULL OLA BİLMƏYƏN qovşaqlar üçün işlədilir.
 */
export function mountPubProfile(username){
  const box = document.getElementById('pubProfile');
  clear(box);
  skeletons(box, 3);

  let stopped = false;
  let view = null;

  api('/users/' + encodeURIComponent(username || '') + '/profile')
    .then(d => {
      if(stopped) return;
      const u = d.user;
      // Keşi də yenilə — DM/mention kimi başqa ekranlar ondan oxuyur.
      if(u && u.uid) state.users.set(u.uid, { ...(state.users.get(u.uid) || {}), ...u });

      updateDynamicSEO({
        title: u.name + ' (@' + u.username + ')',
        description: u.bio || ('Collabix profile of ' + u.name),
        url: location.origin + '/#u/' + u.username,
        schema: {
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          dateCreated: new Date(u.joinedAt || Date.now()).toISOString(),
          mainEntity: {
            '@type': 'Person',
            name: u.name,
            alternateName: u.username,
            description: u.bio || '',
            image: location.origin + (u.photoURL ? u.photoURL : '/favicon.svg'),
          },
        },
      });

      /* 🔴 ÖZ PROFİLLƏ EYNİ RENDERER: `js/profile-view.js`. Əvvəl bu funksiya
         səhifəni özü qururdu və nəticədə publik profildə nişanlar, layihələr,
         taymlayn və statistika YOX idi — eyni istifadəçi iki səhifədə iki
         fərqli məhsul kimi görünürdü. */
      view = renderProfile(box, {
        user: u,
        sharedTeams: d.sharedTeams || [],
        mode: u.isSelf ? 'self' : 'public',
        onFollowList: (uid, tab) => openFollowList(uid, tab),
        actions: () => u.isSelf
          ? [el('button', {
            class: 'c-btn c-btn--primary c-btn--sm',
            onclick: () => emit('nav', { page: 'profil' }),
          }, el('span', { class: 'ic', 'data-icon': 'edit', 'data-icon-size': '15' }), t('pub.edit'))]
          : [
            el('button', { class: 'c-btn c-btn--primary c-btn--sm', onclick: () => tryOpenDM(u) },
              el('span', { class: 'ic', 'data-icon': 'send', 'data-icon-size': '15' }), t('users.a_msg')),
            followBtn(u),
            el('button', {
              class: 'c-icon-btn', type: 'button', 'aria-label': t('users.a_more'),
              onclick: function(e){ e.stopPropagation(); openUserMenu(this, u); },
            }, el('span', { class: 'ic', 'data-icon': 'more', 'data-icon-size': '16' })),
          ],
      });

      /* Baxış sayğacı — SESSİYA BAŞINA BİR DƏFƏ.
         ⚠ Mühafizə `sessionStorage`-dədir, yəni keçilə bilər. Bu, qəsdəndir:
           baxış sayı NÜFUZ göstəricisidir, icazə qərarı deyil (bax server
           şərhi). Server öz-özünə baxışı onsuz da saymır. */
      recordView(u);
    })
    .catch(e => {
      if(stopped) return;
      clear(box);
      box.append(emptyState('userSearch',
        e && e.status === 404 ? t('pub.not_found').replace('{u}', '@' + (username || '?')) : t('users.err')));
    });

  return () => {
    stopped = true;
    if(view){ view.destroy(); view = null; }
    // 🔴 SEO SIFIRLANIR: `updateDynamicSEO` başlığı dəyişirdi, lakin heç nə
    //    onu geri qaytarmırdı — profildən çıxdıqdan sonra da tab başlığı
    //    "@filan | Collabix" qalırdı və əlfəcin YANLIŞ adla saxlanılırdı.
    resetDynamicSEO();
  };
}

/** Profil baxışını qeyd edir — sessiya başına bir dəfə, öz profilində heç vaxt. */
function recordView(u){
  if(!u || !u.username || u.isSelf) return;
  const key = 'cbx_pv_' + u.username;
  try{
    if(sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  }catch(e){ /* private rejimdə sessionStorage ata bilər — sayğac yenə göndərilir */ }
  api('/users/' + encodeURIComponent(u.username) + '/view', { method: 'POST' }).catch(() => {});
}

/* ---------- profil modalı (köhnə keçidlər üçün — səhifəyə yönləndirir) ---------- */
export function openProfileModal(uid){
  const u = state.users.get(uid);
  if(!u){ toast(t('dyn.err_user'), 'err'); return; }
  emit('nav', { page: 'u/' + u.username });
}

function openReportForm(u){
  const ta = el('textarea', { placeholder: 'Şikayət səbəbi...', maxLength: 1000 });
  showModal([
    el('div', { class: 'section-title' }, 'İstifadəçini şikayət et'),
    el('p', { style: 'color:var(--muted); font-size:.85rem; margin-bottom:12px;' },
      '@' + u.username + ' haqqında şikayətinizi yazın, admin nəzərdən keçirəcək.'),
    ta,
    el('button', {
      class: 'btn-small',
      onclick: async () => {
        const reason = ta.value.trim();
        if(!reason) return;
        try{
          await createReport(u.uid, u.username, reason);
          closeModal();
          toast(t('dyn.reported'));
        }catch(e){ toast(t('dyn.report_fail'), 'err'); }
      },
    }, 'Göndər'),
  ]);
}
