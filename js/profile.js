// Öz profil: redaktə (ad, bio, avatar, tag-lar, sosial), heatmap, nişanlar,
// sahələr üzrə irəliləyiş, öz postlarının idarəsi.
import { api } from './api.js';
import {
  state, updateMyProfile, uploadAvatar, deleteMyAvatar, watchTasks, watchMySubmissions,
  updateMySettings, fetchProgressOf, fetchFollowingOf, fetchFollowersOf, isMutual,
} from './store.js';
import { changePassword, changeUsername } from './auth.js';
import {
  el, clear, avatarNode, nameWithBadge, resizeImage, levelFromXP, BADGES,
  authErrMessage, bus,
} from './util.js';
import { toast, showModal, closeModal, emptyState, setTheme, getTheme, THEMES } from './ui.js';
import { t, setLang, getLang, LANGS } from './i18n.js';
import { getPosts, postCard } from './feed.js';
import { openFollowList } from './users.js';
import { tax, SKILL_LEVELS } from './taxonomy.js';
import { skillLevelPicker, ageFromBirthDate } from './wizard.js';
import { renderCompleteness } from './completeness.js';
import { renderHeatmapInto } from './heatmap.js';

let unsubTasks = null, unsubSubs = null;
let cachedTasks = [], cachedSubs = [];

function renderCard(){
  const me = state.me;
  const av = document.getElementById('profAvatar');
  av.replaceWith(Object.assign(avatarNode(me, 'avatar'), { id: 'profAvatar' }));
  document.getElementById('profAvatar').style.cssText = 'width:74px;height:74px;border-radius:18px;font-size:1.4rem;';
  const nameEl = document.getElementById('profName');
  clear(nameEl);
  nameEl.append(nameWithBadge(me));
  const loc = [me.city, me.country].filter(Boolean).join(', ');
  const tag = document.getElementById('profTag');
  clear(tag);
  tag.append('<user @', me.username || '', loc ? ` · ${loc}` : '', ' />');
  
  const bioContainer = document.getElementById('profBio');
  clear(bioContainer);
  bioContainer.textContent = me.bio || '';
  
  if (me.showProjectOnProfile && me.activeProjectId) {
    bioContainer.appendChild(el('div', { style: 'margin-top:10px; font-size:0.9rem; color:var(--primary); font-weight:500;' }, 
      '🚀 Hazırda aktiv layihə üzərində işləyir'
    ));
  }

  // İzləyənlər / izlədiklərim sayğacları (klik → siyahı)
  const fc = document.getElementById('profFollowCounts');
  clear(fc);
  fc.append(
    el('button', { onclick: () => openFollowList(me.uid, 'followers') },
      el('b', {}, state.myFollowers.size), ' ' + t('soc.followers')),
    el('button', { onclick: () => openFollowList(me.uid, 'following') },
      el('b', {}, state.myFollowing.size), ' ' + t('soc.following')),
  );

  // Səviyyəli skill çipləri
  const chips = document.getElementById('profSkillChips');
  clear(chips);
  const levels = { ...(me.progLevels || {}), ...(me.langLevels || {}) };
  const plain = [...(me.prog || []), ...(me.langs || [])];
  const shown = new Set();
  plain.forEach(label => {
    if(shown.has(label)) return;
    shown.add(label);
    chips.append(el('span', { class: 'skill-chip-view' }, label,
      levels[label] ? el('span', { class: 'lvl' }, '· ' + levels[label]) : null));
  });
  (me.lookingFor || []).forEach(x => chips.append(el('span', { class: 'tag on' }, '⌕ ' + x)));

  document.getElementById('profStreakNum').textContent = me.streak || 0;
  document.getElementById('profXPNum').textContent = me.xp || 0;
  document.getElementById('profLevel').textContent = 'Lv ' + levelFromXP(me.xp);
  document.getElementById('profTaskNum').textContent = me.tasksCompleted || 0;

  const track = document.getElementById('profStreakTrack');
  clear(track);
  for(let i = 0; i < 7; i++){
    track.append(el('div', { class: 'd' + (i < Math.min(me.streak || 0, 7) ? ' on' : '') }));
  }

  const social = document.getElementById('profSocial');
  clear(social);
  const socials = [
    ['Instagram', me.instagram], ['GitHub', me.github],
    ['LinkedIn', me.linkedin], ['Telegram', me.telegram], ['Sayt', me.website],
  ].filter(([, v]) => v);
  socials.forEach(([plat, v]) => social.append(el('span', { class: 'social-chip' }, el('span', { class: 'plat' }, plat), ' ' + v)));
  if(!socials.length) social.append(el('span', { class: 'social-chip' }, el('span', { class: 'plat' }, '—'), ' hələ sosial hesab əlavə edilməyib'));
}

function renderBadges(){
  const me = state.me;
  const stats = {
    posts: getPosts().filter(p => p.authorUid === me.uid).length,
    streak: me.streak || 0, xp: me.xp || 0, tasksCompleted: me.tasksCompleted || 0,
  };
  const row = document.getElementById('badgeRow');
  clear(row);
  BADGES.forEach(b => {
    row.append(el('div', { class: 'badge-chip' + (b.test(stats) ? '' : ' locked'), title: t(b.nameKey) },
      el('span', { class: 'b-ic' }, b.ic),
      el('span', { class: 'b-name' }, t(b.nameKey)),
    ));
  });
}

// Heatmap datası ARTIQ normalized `user_activity` cədvəlindən gəlir (Bənd 9),
// `users.activity_days` JSON blob-undan yox. Fərq: blob hər fəaliyyətdə tam
// oxunub geri yazılırdı və illər keçdikcə böyüyürdü.
//
// Keş dərhal göstərilir, server datası gələndə üzərinə yazılır — profil
// açılışı şəbəkəni gözləmir.
function renderHeatmap(){
  const box = document.getElementById('activityHeatmap');
  renderHeatmapInto(box, state.me.activityDays || {});
  if(!state.me.username) return;
  api('/users/' + encodeURIComponent(state.me.username) + '/activity')
    .then(d => renderHeatmapInto(box, d.activityDays || {}))
    .catch(() => {});   // heatmap bəzəkdir — alınmasa keş qalır
}

// Sahə üzrə irəliləyiş — real fəaliyyətdən: postlar (tag üzrə) + təsdiqlənmiş
// task-lar + XP. Bal = post×10 + task×50; səviyyə hədləri: 0/50/150/300.
let progressCache = {};
const PROG_THRESHOLDS = [0, 50, 150, 300];
function progressLevel(points){
  if(points >= PROG_THRESHOLDS[3]) return SKILL_LEVELS[2] + ' +';
  if(points >= PROG_THRESHOLDS[2]) return SKILL_LEVELS[2];
  if(points >= PROG_THRESHOLDS[1]) return SKILL_LEVELS[1];
  return SKILL_LEVELS[0];
}
function renderProgress(){
  const box = document.getElementById('progressList');
  clear(box);
  // Taksonomiyadakı bütün sahələr + istifadəçinin seçdikləri + data olanlar
  const myCats = new Set([...(state.me.prog || []), ...(state.me.langs || []), ...Object.keys(progressCache)]);
  const cats = [...myCats];
  if(!cats.length){ box.append(el('p', { style: 'color:var(--muted); font-size:.8rem;' }, t('prof.no_prog'))); return; }
  cats.forEach(c => {
    const d = progressCache[c] || {};
    const points = (d.posts || 0) * 10 + (d.tasks || 0) * 50 + (d.xp || 0);
    const nextCap = PROG_THRESHOLDS.find(x => x > points) || (points + 100);
    const pct = Math.min(100, Math.round(points / nextCap * 100));
    box.append(el('div', { class: 'row' },
      el('span', { class: 'name' }, c),
      el('div', { class: 'track' }, el('div', { class: 'fill', style: 'width:' + pct + '%' })),
      el('span', { class: 'pct', title: `${d.posts || 0} post · ${d.tasks || 0} task` }, progressLevel(points)),
    ));
  });
}

function renderMyPosts(){
  const box = document.getElementById('myPosts');
  clear(box);
  const mine = getPosts().filter(p => p.authorUid === state.authUser.uid);
  if(!mine.length){ box.append(emptyState('message', t('usr.no_posts'))); return; }

  // Paylaşım statistikası: orijinal / re-post / sitat sayı + alınan ümumi paylaşım (shareCount).
  const orig = mine.filter(p => (p.postType || 'original') === 'original').length;
  const reposts = mine.filter(p => p.postType === 'repost').length;
  const quotes = mine.filter(p => p.postType === 'quote').length;
  const sharesReceived = mine.reduce((s, p) => s + (p.shareCount || 0), 0);
  const statChip = (label, val) => el('div', { class: 'share-stat', style: 'display:flex; flex-direction:column; align-items:center; padding:6px 12px; background:var(--surface-2); border:1px solid var(--border); border-radius:10px; min-width:64px;' },
    el('span', { style: 'font-size:1.05rem; font-weight:700;' }, String(val)),
    el('span', { style: 'font-size:.66rem; color:var(--muted);' }, label));
  box.append(el('div', { class: 'share-stats-row', style: 'display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;' },
    statChip(t('prof.stat_orig'), orig),
    statChip(t('prof.stat_repost'), reposts),
    statChip(t('prof.stat_quote'), quotes),
    statChip(t('prof.stat_shares'), sharesReceived),
  ));

  // Redaktə/silmə daxil tam idarə üçün feed kartından istifadə olunur.
  mine.forEach(p => box.append(postCard(p)));
}

/* ---------- tab-lı profil redaktoru ---------- */
const fld = (label, node, hint) => el('div', { class: 'field' },
  el('label', {}, label), node,
  hint ? el('div', { style: 'font-size:.68rem; color:var(--muted); margin-top:3px;' }, hint) : null);
const inp = (val, ph = '', max = 60, type = 'text') => el('input', { value: val || '', placeholder: ph, maxLength: max, type });

function openEditModal(initialTab = 'general'){
  const me = state.me;
  let newAvatarBlob = null;
  let removeAvatar = false;

  /* --- Tab: Ümumi --- */
  const avPreview = avatarNode(me, 'avatar');
  avPreview.style.cssText = 'width:56px;height:56px;border-radius:14px;font-size:1.1rem;';
  const fileIn = el('input', { type: 'file', accept: 'image/*', style: 'display:none;' });
  fileIn.addEventListener('change', async e => {
    const f = e.target.files[0];
    if(!f) return;
    try{
      newAvatarBlob = await resizeImage(f, 300, 0.78);
      removeAvatar = false;
      clear(avPreview);
      const img = document.createElement('img');
      img.src = URL.createObjectURL(newAvatarBlob);
      avPreview.append(img);
    }catch(err){ toast(t('dyn.err_img'), 'err'); }
  });
  const nameIn = inp(me.name, 'Ad Soyad');
  const bioIn = el('textarea', { maxLength: 400, placeholder: 'Özün haqqında qısa yaz...' });
  bioIn.value = me.bio || '';
  const bdIn = el('input', { type: 'date', value: me.birthDate || '' });
  const genderBox = el('div', { class: 'gender-pick' });
  let gender = me.gender || '';
  ['Kişi', 'Qadın'].forEach(g => {
    const b = el('button', { type: 'button', class: 'genBtn' + (gender === g ? ' sel' : ''), onclick: () => {
      gender = g;
      genderBox.querySelectorAll('.genBtn').forEach(x => x.classList.toggle('sel', x === b));
    } }, g);
    genderBox.append(b);
  });
  const countryIn = inp(me.country, 'Azərbaycan', 40);
  const cityIn = inp(me.city, 'Bakı', 40);
  const tabGeneral = el('div', {},
    el('div', { class: 'photo-pick' }, avPreview,
      el('label', {}, 'Şəkli dəyiş', fileIn),
      el('button', { type: 'button', class: 'btn-mini block', onclick: () => {
        removeAvatar = true; newAvatarBlob = null;
        clear(avPreview); avPreview.textContent = (me.name || '?').charAt(0).toUpperCase();
      } }, 'Şəkli sil')),
    fld('Ad', nameIn),
    fld('Bio / Haqqımda', bioIn),
    el('div', { class: 'row2' }, fld('Doğum tarixi', bdIn), fld('Cins', genderBox)),
    el('div', { class: 'row2' }, fld('Ölkə', countryIn), fld('Şəhər', cityIn)),
  );

  /* --- Tab: Bacarıqlar --- */
  const progPick = skillLevelPicker(tax.prog, me.progLevels || {});
  const langPick = skillLevelPicker(tax.spoken, me.langLevels || {});
  const goalsIn = el('textarea', { maxLength: 300, placeholder: 'Öyrənmə hədəflərin...' });
  goalsIn.value = me.goals || '';
  const lfBox = el('div', { class: 'pill-pick' });
  ['Study partner', 'Mentor', 'Layihə komandası'].forEach(x => {
    lfBox.append(el('button', { type: 'button', class: 'pp' + ((me.lookingFor || []).includes(x) ? ' sel' : ''),
      onclick: e => e.target.classList.toggle('sel') }, x));
  });
  const tabSkills = el('div', {},
    fld('Proqramlaşdırma dilləri', progPick, 'Klik: Başlanğıc → Orta → Qabaqcıl → çıxart'),
    fld('Öyrəndiyi / bildiyi dillər', langPick),
    fld('Öyrənmə hədəfləri', goalsIn),
    fld('Nə axtarıram?', lfBox),
  );

  /* --- Tab: Sosial --- */
  const instaIn = inp(me.instagram, '@istifadəçi', 40);
  const ghIn = inp(me.github, 'istifadəçi', 40);
  const liIn = inp(me.linkedin, 'in/istifadəçi', 60);
  const tgIn = inp(me.telegram, '@istifadəçi', 40);
  const webIn = inp(me.website, 'https://...', 100);
  const tabSocial = el('div', {},
    el('div', { class: 'row2' }, fld('Instagram', instaIn), fld('GitHub', ghIn)),
    el('div', { class: 'row2' }, fld('LinkedIn', liIn), fld('Telegram', tgIn)),
    fld('Şəxsi sayt', webIn),
  );

  /* --- Tab: Təhlükəsizlik --- */
  const curPass1 = el('input', { type: 'password', placeholder: t('prof.cur_pass') });
  const newPass = el('input', { type: 'password', placeholder: t('prof.new_pass') });
  const passErr = el('div', { class: 'form-err' });
  const curPass2 = el('input', { type: 'password', placeholder: t('prof.cur_pass') });
  const newUname = el('input', { placeholder: 'yeni_istifadeci_adi', maxLength: 20, autocapitalize: 'none' });
  const unameErr = el('div', { class: 'form-err' });
  const tabSecurity = el('div', {},
    el('div', { class: 'section-title', style: 'font-size:.9rem;' }, t('prof.ch_pass')),
    fld(t('prof.cur_pass'), curPass1), fld(t('prof.new_pass'), newPass),
    el('button', { class: 'btn-small', onclick: async e => {
      passErr.textContent = '';
      if(!curPass1.value || newPass.value.length < 6){ passErr.textContent = t('prof.err_pass_fld'); return; }
      e.target.disabled = true;
      try{ await changePassword(curPass1.value, newPass.value); curPass1.value = newPass.value = ''; toast(t('dyn.pass_upd')); }
      catch(ex){ passErr.textContent = authErrMessage(ex, t); }
      e.target.disabled = false;
    } }, t('prof.btn_pass')),
    passErr,
    el('div', { class: 'section-title', style: 'font-size:.9rem; margin-top:20px;' }, t('prof.new_uname')),
    fld(t('prof.new_uname'), newUname, t('prof.new_uname_hint')),
    fld(t('prof.pass_confirm'), curPass2),
    el('button', { class: 'btn-small', onclick: async e => {
      unameErr.textContent = '';
      if(!newUname.value.trim() || !curPass2.value){ unameErr.textContent = 'Hər iki sahəni doldur.'; return; }
      e.target.disabled = true;
      try{
        await changeUsername(curPass2.value, newUname.value);
        toast(t('dyn.username_ok'));
        newUname.value = curPass2.value = '';
        closeModal();
      }catch(ex){
        unameErr.textContent = ex.code === 'app/bad-username'
          ? t('dyn.err_uname_fmt')
          : ex.code === 'auth/email-already-in-use' ? t('wiz.err_uname_taken') : authErrMessage(ex, t);
      }
      e.target.disabled = false;
    } }, 'Adı dəyiş'),
    unameErr,
    el('p', { style: 'font-size:.76rem; color:var(--muted); margin-top:18px;' },
      'Hesabı silmək üçün ', el('b', {}, 'Parametrlər → Təhlükəli zona'), ' bölməsinə keç.'),
  );

  /* --- Tab: Parametrlər (schema-driven — yeni parametr = sxemə 1 sətir) --- */
  const SETTINGS_SCHEMA = [
    { key: 'theme', type: 'select', lbl: t('set.theme'),
      options: THEMES.map(th => [th, t('set.theme.' + th)]),
      get: () => getTheme(), set: v => setTheme(v) },
    { key: 'lang', type: 'select', lbl: t('set.lang'),
      options: LANGS.map(l => [l, l.toUpperCase()]),
      get: () => getLang(), set: v => { setLang(v); updateMySettings({ lang: v }).catch(() => {}); } },
    { key: 'privacy.whoCanMessage', type: 'select', lbl: t('set.whoMsg'),
      options: [['everyone', t('set.whoMsg.everyone')], ['following', t('set.whoMsg.following')], ['mutual', t('set.whoMsg.mutual')]],
      get: () => me.settings?.privacy?.whoCanMessage || 'everyone',
      set: v => updateMySettings({ privacy: { whoCanMessage: v } }) },
    { key: 'privacy.showFollowing', type: 'toggle', lbl: t('set.showFollowing'),
      get: () => me.settings?.privacy?.showFollowing !== false,
      set: v => updateMySettings({ privacy: { showFollowing: v } }) },
    { key: 'privacy.showOnlineStatus', type: 'toggle', lbl: t('set.showOnline'),
      get: () => me.settings?.privacy?.showOnlineStatus !== false,
      set: v => updateMySettings({ privacy: { showOnlineStatus: v } }) },
    { key: 'notifications.likes', type: 'toggle', lbl: t('set.notif.likes'),
      get: () => me.settings?.notifications?.likes !== false,
      set: v => updateMySettings({ notifications: { likes: v } }) },
    { key: 'notifications.comments', type: 'toggle', lbl: t('set.notif.comments'),
      get: () => me.settings?.notifications?.comments !== false,
      set: v => updateMySettings({ notifications: { comments: v } }) },
    { key: 'notifications.follows', type: 'toggle', lbl: t('set.notif.follows'),
      get: () => me.settings?.notifications?.follows !== false,
      set: v => updateMySettings({ notifications: { follows: v } }) },
    { key: 'showProjectOnProfile', type: 'toggle', lbl: 'Aktiv layihəmi profilimdə göstər',
      get: () => me.showProjectOnProfile !== false,
      set: async v => { await api('/me', { method: 'PATCH', body: { showProjectOnProfile: v } }); me.showProjectOnProfile = v; } },
  ];
  const tabSettings = el('div', {});
  SETTINGS_SCHEMA.forEach(s => {
    if(s.type === 'select'){
      const sel = el('select', { style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:9px 11px; border-radius:8px;' });
      s.options.forEach(([v, lbl2]) => sel.append(el('option', { value: v }, lbl2)));
      sel.value = s.get();
      sel.addEventListener('change', async () => {
        try{ await s.set(sel.value); toast(t('set.saved')); }catch(e){ toast(t('dyn.err_generic'), 'err'); }
      });
      tabSettings.append(fld(s.lbl, sel));
    } else {
      const cb = el('input', { type: 'checkbox', checked: s.get() });
      cb.addEventListener('change', async () => {
        try{ await s.set(cb.checked); toast(t('set.saved')); }catch(e){ toast(t('dyn.err_generic'), 'err'); }
      });
      tabSettings.append(el('label', { class: 'remember-row' }, cb, ' ' + s.lbl));
    }
  });
  tabSettings.append(el('p', { style: 'font-size:.74rem; color:var(--muted); margin-top:12px;' },
    t('prof.warn_set')));

  /* --- tab keçidi --- */
  const TABS = [
    { id: 'general', lbl: 'Ümumi', node: tabGeneral },
    { id: 'skills', lbl: 'Bacarıqlar', node: tabSkills },
    { id: 'social', lbl: 'Sosial', node: tabSocial },
    { id: 'settings', lbl: t('nav.settings'), node: tabSettings },
    { id: 'security', lbl: 'Təhlükəsizlik', node: tabSecurity },
  ];
  const body = el('div', {});
  const tabsBar = el('div', { class: 'task-cat-tabs' });
  let activeTab = initialTab;
  const show = id => {
    activeTab = id;
    tabsBar.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    clear(body);
    body.append(TABS.find(t => t.id === id).node);
  };
  TABS.forEach(t => tabsBar.append(el('button', { dataset: { tab: t.id }, onclick: () => show(t.id) }, t.lbl)));

  const saveBtn = el('button', { class: 'btn-primary', onclick: async e => {
    const name = nameIn.value.trim();
    if(!name){ toast(t('dyn.err_name'), 'err'); return; }
    if(bdIn.value && ageFromBirthDate(bdIn.value) < 18){ toast(t('dyn.err_age'), 'err'); return; }
    if(webIn.value.trim() && !/^https?:\/\/.+\..+/.test(webIn.value.trim())){ toast(t('dyn.err_url'), 'err'); return; }
    e.target.disabled = true;
    try{
      const progLevels = progPick.getSelection();
      const langLevels = langPick.getSelection();
      const fields = {
        name, bio: bioIn.value.trim(),
        birthDate: bdIn.value, age: bdIn.value ? ageFromBirthDate(bdIn.value) : (me.age || 18),
        gender, country: countryIn.value.trim(), city: cityIn.value.trim(),
        progLevels, langLevels,
        prog: Object.keys(progLevels), langs: Object.keys(langLevels),
        goals: goalsIn.value.trim(),
        lookingFor: [...lfBox.querySelectorAll('.pp.sel')].map(b => b.textContent),
        instagram: instaIn.value.trim(), github: ghIn.value.trim(),
        linkedin: liIn.value.trim(), telegram: tgIn.value.trim(), website: webIn.value.trim(),
      };
      if(newAvatarBlob) fields.photoURL = await uploadAvatar(newAvatarBlob);
      else if(removeAvatar){ fields.photoURL = null; deleteMyAvatar().catch(() => {}); }
      await updateMyProfile(fields);
      closeModal();
      toast(t('prof.upd_ok'));
    }catch(err){ console.error(err); toast(t('dyn.err_try'), 'err'); }
    e.target.disabled = false;
  } }, 'Yadda saxla');

  showModal([
    el('div', { class: 'section-title' }, t('prof.edit_title')),
    tabsBar, body, saveBtn,
  ], { wide: true });
  show(activeTab);
}

/* ---------- init / mount ---------- */
export function initProfile(){
  document.getElementById('profEditBtn').addEventListener('click', () => openEditModal());
}

function renderAll(){
  if(!document.getElementById('page-profil').classList.contains('active')) return;
  renderCard(); renderBadges(); renderHeatmap(); renderProgress(); renderMyPosts();
  // TASK-8 / Bənd 6 — tamlıq indikatoru. Çatışmayan sahə çipi redaktoru açır.
  renderCompleteness(document.getElementById('profCompleteness'), state.me, () => openEditModal());
}

function onProfileBonus(){
  toast(t('cmp.bonus_earned'));
}

export function mountProfile(){
  renderAll();
  bus.addEventListener('profile-bonus', onProfileBonus);
  fetchProgressOf(state.authUser.uid).then(p => { progressCache = p; renderProgress(); }).catch(() => {});
  unsubTasks = watchTasks(list => { cachedTasks = list; });
  unsubSubs = watchMySubmissions(list => { cachedSubs = list; });
  bus.addEventListener('feed-updated', renderAll);
  bus.addEventListener('users-updated', renderAll);
  return () => {
    if(unsubTasks){ unsubTasks(); unsubTasks = null; }
    if(unsubSubs){ unsubSubs(); unsubSubs = null; }
    bus.removeEventListener('feed-updated', renderAll);
    bus.removeEventListener('users-updated', renderAll);
    bus.removeEventListener('profile-bonus', onProfileBonus);
  };
}
