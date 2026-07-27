// User directory (filtered search), follow, profile modal,
// public profile page (#u/{username}) and report form.
import { api } from './api.js';
import {
  state, createReport, toggleFollow, isMutual,
  fetchFollowingOf, fetchFollowersOf, canMessage, fetchUserDirectory,
} from './store.js';
import { el, clear, avatarNode, nameWithBadge, isOnline, lastSeenText, fmtTime, debounce, bus, emit, updateDynamicSEO, hashParams } from './util.js';
import { showModal, closeModal, toast, emptyState, skeletons } from './ui.js';
import { t } from './i18n.js';
import { tax } from './taxonomy.js';
import { renderHeatmapInto } from './heatmap.js';

let feedCache = []; // Filled by feed.js
export function setFeedCache(posts){ feedCache = posts; }

function followBtn(u, cls = 'btn-mini'){
  const following = state.myFollowing.has(u.uid);
  return el('button', {
    class: cls + (following ? ' dismiss' : ''),
    onclick: async e => {
      e.stopPropagation();
      const btn = e.currentTarget;
      btn.disabled = true;
      try{
        const now = await toggleFollow(u.uid);
        toast(now ? '@' + u.username + ' izlənilir' : 'İzləmə dayandırıldı');
      }catch(err){ toast(t('dyn.err_generic'), 'err'); }
      btn.disabled = false;
    },
  }, following ? '✓ İzlənilir' : '+ İzlə');
}

/* ---------- İstifadəçilər#2: "+N" bacarıq nişanı ---------- */
// Ən vacib 2-3 bacarıq göstərilir, qalanı "+N" nişanında toplanır.
// Klik/hover → popover ilə tam siyahı. Klaviatura ilə də açılır (button + Esc).
const VISIBLE_SKILLS = 3;

function skillTag(label, level){
  return el('span', { class: 'tag teal' }, label + (level ? ' · ' + level.slice(0, 1) : ''));
}

function skillRow(u){
  const levels = { ...(u.progLevels || {}), ...(u.langLevels || {}) };
  const all = [...(u.prog || []), ...(u.langs || [])];
  if(!all.length) return null;

  const row = el('div', { class: 'user-card-tags' },
    all.slice(0, VISIBLE_SKILLS).map(lbl => skillTag(lbl, levels[lbl])));

  const rest = all.slice(VISIBLE_SKILLS);
  if(!rest.length) return row;

  const pop = el('div', { class: 'skill-pop', role: 'tooltip' },
    el('div', { class: 'sp-title' }, t('users.all_skills')),
    el('div', { class: 'sp-tags' }, all.map(lbl => skillTag(lbl, levels[lbl]))));

  const more = el('button', {
    class: 'tag more-tag',
    type: 'button',
    'aria-label': t('users.more_skills').replace('{0}', rest.length),
    'aria-expanded': 'false',
    onclick: e => {
      e.stopPropagation();
      const open = wrap.classList.toggle('open');
      more.setAttribute('aria-expanded', String(open));
    },
  }, '+' + rest.length);

  const wrap = el('span', { class: 'more-wrap' }, more, pop);
  row.append(wrap);
  return row;
}

function userCard(u){
  return el('div', { class: 'user-card' },
    el('div', { class: 'user-card-head' },
      avatarNode(u, 'avatar', isOnline(u)),
      el('div', { class: 'uc-id' },
        el('b', {}, nameWithBadge(u)),
        el('span', {}, '@' + u.username + ' · 🔥' + (u.streak || 0) + ' · ' + (u.xp || 0) + ' XP'),
        isMutual(u.uid) ? el('span', { class: 'mutual-tag' }, '⇄ ' + t('soc.mutual')) : null,
      ),
      followBtn(u),
    ),
    skillRow(u),
    el('div', { class: 'user-card-actions' },
      el('button', { onclick: () => emit('nav', { page: 'u/' + u.username }) }, t('usr.view')),
      el('button', { class: 'primary', onclick: () => tryOpenDM(u) }, t('usr.msg')),
    ),
  );
}

// Mesaj icazəsi: qəbul edənin whoCanMessage siyasətinə hörmət (client tərəf; rules da qoruyur).
function tryOpenDM(u){
  if(!canMessage(u)){ toast(t('soc.msgBlocked'), 'err'); return; }
  emit('open-dm', { uid: u.uid });
}

/* ---------- izləyən/izlədiklər siyahısı modalı ---------- */
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
    if(!users.length){ listBox.append(emptyState('◎', '—')); return; }
    users.forEach(u => {
      listBox.append(el('div', { class: 'admin-user-row' },
        avatarNode(u, 'avatar', isOnline(u)),
        el('div', { class: 'name', style: 'cursor:pointer;', onclick: () => { closeModal(); emit('nav', { page: 'u/' + u.username }); } },
          nameWithBadge(u), ' ', el('span', { class: 'sub' }, '@' + u.username)),
        isMutual(u.uid) ? el('span', { class: 'mutual-tag' }, '⇄') : null,
        u.uid !== state.authUser.uid ? followBtn(u) : null,
      ));
    });
  }catch(e){
    clear(listBox);
    listBox.append(emptyState('◎', t('soc.hidden')));
  }
}

function rebuildSkillFilter(){
  const sel = document.getElementById('userSkillFilter');
  const cur = sel.value;
  clear(sel);
  sel.append(el('option', { value: '' }, 'Bütün skill-lər'));
  [...tax.prog, ...tax.spoken].forEach(i => sel.append(el('option', { value: i.label }, i.label)));
  sel.value = cur;
}

/* ================= kataloq: server-side sıralama + səhifələmə =================
   Əvvəllər bütün siyahı `state.users`-dən client-də süzülüb sıralanırdı.
   İndi sorğu D1-ə gedir (ORDER BY + index, 0006) və nəticə hissə-hissə gəlir.
   `state.users` qlobal keş kimi qalır — feed/DM/mention ondan asılıdır.       */

const VIEW_KEY = 'collabix_users_view';   // İstifadəçilər#3 — grid|list yadda qalır

const dir = {
  cursor: null,
  loading: false,
  done: false,
  reqId: 0,        // gec gələn cavabın yenisini əzməməsi üçün
  count: 0,
  emptyStreak: 0,  // ardıcıl boş səhifə sayı (client süzgəcindən sonra)
};

function currentQuery(){
  return {
    q: (document.getElementById('userSearch').value || '').trim(),
    skill: document.getElementById('userSkillFilter').value,
    level: document.getElementById('userLevelFilter').value,
    looking: document.getElementById('userLookingFilter').value,
    extra: document.getElementById('userExtraFilter').value,
    sort: document.getElementById('userSortSelect').value,
  };
}

// `extra` filtrlərindən yalnız `verified` serverdədir; `online` presence
// xəritəsindən, `mutual` isə izləmə dəstlərindən — hər ikisi yalnız client-də
// mövcuddur, ona görə gələn səhifə üzərində süzülür.
function clientSideExtra(users, extra){
  if(extra === 'online') return users.filter(u => isOnline(u));
  if(extra === 'mutual') return users.filter(u => isMutual(u.uid));
  return users;
}

function setStatus(text){
  document.getElementById('userDirStatus').textContent = text || '';
}

async function loadDirectory({ reset = false } = {}){
  if(!state.authUser) return;            // logout keçidində gec gələn event-lər
  if(dir.loading || (dir.done && !reset)) return;

  const grid = document.getElementById('userGrid');
  if(reset){
    dir.cursor = null; dir.done = false; dir.count = 0; dir.emptyStreak = 0;
    clear(grid);
    skeletons(grid, 6);
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
      setStatus(dir.count ? t('users.end') : '');
      if(!dir.count){ clear(grid); grid.append(emptyState('◎', t('users.none'))); }
    } else {
      setStatus('');
      // Server səhifəsi client süzgəcindən (online/mutual) sonra tam boşala
      // bilər — belə halda sentinel görünmür və scroll dayanır, ona görə
      // növbəti səhifəni özümüz çəkirik.
      // ⚠ Zəncir məhdudlaşdırılıb: "onlayn" filtri ilə heç kim uyğun gəlmirsə
      // bu, bütün bazanı ard-arda sorğulaya bilərdi. 5 boş səhifədən sonra
      // dayanır və istifadəçi scroll edərək davam edə bilər.
      if(!rows.length){
        dir.emptyStreak = (dir.emptyStreak || 0) + 1;
        dir.loading = false;
        if(dir.emptyStreak < 5) return loadDirectory();
        setStatus(dir.count ? '' : t('users.none'));
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

const reloadDirectory = () => loadDirectory({ reset: true });

/* ---------- İstifadəçilər#3: grid ⇄ list ---------- */
function applyView(view){
  const grid = document.getElementById('userGrid');
  grid.classList.toggle('list-view', view === 'list');
  document.querySelectorAll('#userViewToggle button').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view));
  try{ localStorage.setItem(VIEW_KEY, view); }catch(e){}
}

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
  const sel = document.getElementById('userSkillFilter');
  // Yalnız taksonomiyada həqiqətən mövcud olan dəyəri tətbiq et
  // (uydurma param filtri "heç nə tapılmadı" vəziyyətinə salmasın).
  if([...sel.options].some(o => o.value === skill)) sel.value = skill;
}

export function mountUsers(){
  rebuildSkillFilter();
  applyPendingSkill();

  let view = 'grid';
  try{ view = localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'; }catch(e){}
  applyView(view);

  reloadDirectory();

  // Sıra/filtr dəyişəndə sorğu yenidən qurulur (serverə gedir).
  const input = document.getElementById('userSearch');
  const onSearch = debounce(reloadDirectory, 250);
  input.addEventListener('input', onSearch);

  const selIds = ['userSkillFilter', 'userLevelFilter', 'userLookingFilter', 'userExtraFilter', 'userSortSelect'];
  const sels = selIds.map(id => document.getElementById(id));
  sels.forEach(s => s.addEventListener('change', reloadDirectory));

  const toggle = document.getElementById('userViewToggle');
  const onToggle = e => {
    const b = e.target.closest('button[data-view]');
    if(b) applyView(b.dataset.view);
  };
  toggle.addEventListener('click', onToggle);

  // Follow/presence dəyişiklikləri bütün siyahını yenidən çəkməməlidir —
  // yalnız client-side süzgəc aktivdirsə nəticə dəyişə bilər.
  const onSoft = () => {
    const extra = document.getElementById('userExtraFilter').value;
    if(extra === 'online' || extra === 'mutual') reloadDirectory();
  };
  bus.addEventListener('follows-updated', onSoft);
  bus.addEventListener('presence-updated', onSoft);
  bus.addEventListener('taxonomy-updated', rebuildSkillFilter);

  // İnfinite scroll: sentinel görünəndə növbəti səhifə.
  const sentinel = document.getElementById('userSentinel');
  const io = new IntersectionObserver(entries => {
    if(entries.some(e => e.isIntersecting)) loadDirectory();
  }, { rootMargin: '300px' });
  io.observe(sentinel);

  // "+N" popover-ini kənara klikləyəndə bağla.
  const onDocClick = e => {
    document.querySelectorAll('#userGrid .more-wrap.open').forEach(w => {
      if(w.contains(e.target)) return;
      w.classList.remove('open');
      w.querySelector('.more-tag')?.setAttribute('aria-expanded', 'false');
    });
  };
  document.addEventListener('click', onDocClick);

  return () => {
    io.disconnect();
    dir.reqId++;                 // uçuşdakı cavablar DOM-a toxunmasın
    dir.loading = false;
    input.removeEventListener('input', onSearch);
    sels.forEach(s => s.removeEventListener('change', reloadDirectory));
    toggle.removeEventListener('click', onToggle);
    document.removeEventListener('click', onDocClick);
    bus.removeEventListener('follows-updated', onSoft);
    bus.removeEventListener('presence-updated', onSoft);
    bus.removeEventListener('taxonomy-updated', rebuildSkillFilter);
  };
}

/* ---------- public profil səhifəsi (#u/{username}) ---------- */
export function mountPubProfile(username){
  const box = document.getElementById('pubProfile');
  clear(box);
  skeletons(box, 2);

  const render = () => {
    const u = [...state.users.values()].find(x => x.username === username);
    clear(box);
    if(!u){ box.append(emptyState('◎', '@' + (username || '?') + ' tapılmadı')); return; }

    updateDynamicSEO({
      title: u.name + ' (@' + u.username + ')',
      description: u.bio || ('Collabix profile of ' + u.name),
      url: location.origin + '/#u/' + u.username,
      schema: {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "dateCreated": new Date(u.joinedAt || Date.now()).toISOString(),
        "mainEntity": {
          "@type": "Person",
          "name": u.name,
          "alternateName": u.username,
          "description": u.bio || "",
          "image": location.origin + (u.avatar ? "/files/" + u.avatar : "/favicon.svg")
        }
      }
    });

    const isSelf = u.uid === state.authUser.uid;
    const levels = { ...(u.progLevels || {}), ...(u.langLevels || {}) };
    const loc = [u.city, u.country].filter(Boolean).join(', ');

    const chips = el('div', { class: 'skill-pick', style: 'margin-top:10px;' });
    [...(u.prog || []), ...(u.langs || [])].forEach(label => {
      chips.append(el('span', { class: 'skill-chip-view' }, label,
        levels[label] ? el('span', { class: 'lvl' }, '· ' + levels[label]) : null));
    });
    (u.lookingFor || []).forEach(x => chips.append(el('span', { class: 'tag on' }, '⌕ ' + x)));

    const socials = [
      ['Instagram', u.instagram], ['GitHub', u.github],
      ['LinkedIn', u.linkedin], ['Telegram', u.telegram], ['Sayt', u.website],
    ].filter(([, v]) => v);

    const heatBox = el('div', { class: 'heatmap' });
    const posts = feedCache.filter(p => p.authorUid === u.uid).slice(0, 10);

    const followCounts = el('div', { class: 'follow-counts' });
    Promise.all([fetchFollowersOf(u.uid).catch(() => []), fetchFollowingOf(u.uid).catch(() => [])]).then(([fers, fing]) => {
      clear(followCounts);
      followCounts.append(
        el('button', { onclick: () => openFollowList(u.uid, 'followers') }, el('b', {}, fers.length), ' ' + t('soc.followers')),
        el('button', { onclick: () => openFollowList(u.uid, 'following') }, el('b', {}, fing.length), ' ' + t('soc.followingOf')),
        isMutual(u.uid) && !isSelf ? el('span', { class: 'mutual-tag' }, '⇄ ' + t('soc.mutual')) : null,
      );
    });

    box.append(
      el('div', { class: 'profile-card pub-cover' },
        avatarNode(u, 'avatar', isOnline(u)),
        el('div', { style: 'flex:1; min-width:220px;' },
          el('h2', {}, nameWithBadge(u)),
          el('span', { class: 'code-tag' },
            '@' + u.username + (loc ? ' · ' + loc : '') + ' · ' + (lastSeenText(u) || '')),
          u.bio ? el('div', { class: 'profile-bio' }, u.bio) : null,
          u.goals ? el('div', { class: 'profile-bio', style: 'margin-top:4px;' }, '🎯 ' + u.goals) : null,
          chips,
          followCounts,
        ),
        isSelf ? null : el('div', { style: 'display:flex; flex-direction:column; gap:8px;' },
          followBtn(u, 'btn-small'),
          el('button', { class: 'btn-mini', onclick: () => tryOpenDM(u) }, '✉ Mesaj yaz'),
          el('button', { class: 'btn-mini block', onclick: () => openReportForm(u) }, '⚑ Şikayət'),
        ),
      ),
      el('div', { class: 'stat-row' },
        el('div', { class: 'stat-card flame' }, el('div', { class: 'num' }, u.streak || 0), el('div', { class: 'lbl' }, t('usr.streak'))),
        el('div', { class: 'stat-card' }, el('div', { class: 'num' }, u.xp || 0), el('div', { class: 'lbl' }, 'XP')),
        el('div', { class: 'stat-card' }, el('div', { class: 'num' }, u.tasksCompleted || 0), el('div', { class: 'lbl' }, t('usr.tasks'))),
      ),
      socials.length ? el('div', { class: 'social-row' },
        socials.map(([plat, v]) => el('span', { class: 'social-chip' }, el('span', { class: 'plat' }, plat), ' ' + v))) : null,
      el('div', { class: 'section-title' }, t('usr.act_map')),
      heatBox,
      el('div', { class: 'section-title' }, t('usr.posts')),
      posts.length ? null : emptyState('✎', t('usr.no_posts')),
    );
    // Keşdən ani render, sonra normalized cədvəldən dəqiq data (Bənd 9).
    renderHeatmapInto(heatBox, u.activityDays || {});
    api('/users/' + encodeURIComponent(u.username) + '/activity')
      .then(d => renderHeatmapInto(heatBox, d.activityDays || {}))
      .catch(() => {});
    if(posts.length){
      import('./feed.js').then(({ postCard }) => {
        posts.forEach(p => box.append(postCard(p)));
      });
    }
  };

  render();
  const rerender = () => { if(document.getElementById('page-u').classList.contains('active')) render(); };
  bus.addEventListener('users-updated', rerender);
  bus.addEventListener('follows-updated', rerender);
  return () => {
    bus.removeEventListener('users-updated', rerender);
    bus.removeEventListener('follows-updated', rerender);
  };
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
