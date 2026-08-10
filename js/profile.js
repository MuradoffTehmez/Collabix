import '../css/35-stats-profile.css';
import '../css/91-profile.css';
// Öz profil səhifəsi — redaktor, tamlıq nudge-i və idarəetmə blokları.
//
// 🔴 EKRANIN ÖZÜ BURADA DEYİL: `js/profile-view.js` (publik profil ilə ORTAQ).
//    Bax həmin faylın başlığı — iki ayrı quruluşun niyə birləşdirildiyi orada
//    izah olunub.
import { api } from './api.js';
import {
  state, updateMyProfile, uploadAvatar, deleteMyAvatar, watchTasks, watchMySubmissions,
  updateMySettings,
} from './store.js';
import { changePassword, changeUsername } from './auth.js';
import { el, clear, avatarNode, resizeImage, authErrMessage, bus } from './util.js';
import { toast, showModal, closeModal, setTheme, getTheme, THEMES } from './ui.js';
import { t, setLang, getLang, LANGS } from './i18n.js';
// Profil ekranı + örtük seçicisi — publik profillə ORTAQ renderer.
import { renderProfile, openCoverPicker } from './profile-view.js';

import { tax } from './taxonomy.js';
import { skillLevelPicker, ageFromBirthDate } from './wizard.js';
import { renderCompleteness } from './completeness.js';

let unsubTasks = null, unsubSubs = null;
let view = null;          // aktiv `renderProfile` nəticəsi
let lastRenderKey = '';   // təkrar render-in qarşısını alır (aşağıya bax)

/* ═══════════════════════ ÖZ PROFİL ═══════════════════════
 *
 * 🔴 SƏHİFƏ ARTIQ BURADA QURULMUR — `js/profile-view.js`.
 *    Əvvəl öz profil `index.html`-dəki şablondan, publik profil isə tam
 *    JS-dən qurulurdu. İki quruluş = iki həqiqət: nişanlar yalnız burada,
 *    ortaq komandalar yalnız orada idi; saylar iki mənbədən gəlib fərqlənirdi.
 *    İndi hər ikisi EYNİ renderer-dir, fərq yalnız `mode`-dadır.
 *
 * ⚠ BU MODULDA QALANLAR: redaktor (modal), tamlıq nudge-i və idarəetmə
 *   blokları — hamısı YALNIZ sahibinə aiddir və publik profildə yeri yoxdur.
 */

/**
 * Render açarı — profilin GÖRÜNƏN hissəsini təsvir edən sətir.
 *
 * 🔴 NİYƏ LAZIMDIR: `renderAll` iki hadisəyə bağlıdır (`feed-updated`,
 *    `users-updated`) və onlar lentdə hər dəyişiklikdə atəşlənir. Hər dəfə
 *    `renderProfile()` çağırsaydıq, səhifə tam yenidən qurulardı: sürüşmə
 *    mövqeyi itərdi, sonsuz sürüşmə ilə yüklənmiş postlar silinərdi və
 *    şəbəkəyə eyni sorğular təkrar gedərdi. Açar dəyişməyibsə render atlanır.
 */
function renderKey(me){
  return [
    me.uid, me.name, me.username, me.photoURL, me.bio, me.company, me.status,
    me.cover, me.xp, me.streak, me.tasksCompleted,
    JSON.stringify(me.progLevels || {}), JSON.stringify(me.langLevels || {}),
    JSON.stringify(me.skillMeta || {}), JSON.stringify(me.lookingFor || []),
    me.github, me.linkedin, me.telegram, me.instagram, me.website, me.goals,
  ].join('|');
}

function mountView(){
  const host = document.getElementById('profHost');
  if(!host) return;
  const me = state.me;

  if(view){ view.destroy(); view = null; }
  view = renderProfile(host, {
    user: me,
    mode: 'self',
    sharedTeams: [],
    // İzləyici/izlənilən siyahısı `users.js`-dədir — callback ilə ötürülür,
    // çünki `profile-view.js` ondan asılı OLMAMALIDIR (dövr riski).
    onFollowList: (uid, tab) => import('./users.js').then(m => m.openFollowList(uid, tab)),
    onCover: () => {
      const anchor = host.querySelector('.pf-cover__edit');
      openCoverPicker(anchor, me.cover || '', async key => {
        try{
          await updateMyProfile({ cover: key });
          toast(t('pf.cover_saved'));
          renderAll(true);
        }catch(e){ toast(t('dyn.err_generic'), 'err'); }
      });
    },
    actions: () => [
      el('button', { class: 'c-btn c-btn--primary c-btn--sm', id: 'profEditBtn', onclick: () => openEditModal() },
        el('span', { class: 'ic', 'data-icon': 'edit', 'data-icon-size': '15' }),
        el('span', {}, t('prof.edit'))),
      el('button', {
        class: 'c-btn c-btn--ghost c-btn--sm', type: 'button',
        onclick: () => shareOwnProfile(me),
      }, el('span', { class: 'ic', 'data-icon': 'share', 'data-icon-size': '15' }),
      el('span', {}, t('pf.share'))),
      el('button', {
        class: 'c-icon-btn', type: 'button', 'aria-label': t('nav.settings'), title: t('nav.settings'),
        onclick: () => openEditModal('settings'),
      }, el('span', { class: 'ic', 'data-icon': 'settings', 'data-icon-size': '16' })),
    ],
  });
}

/**
 * Profil linkinin paylaşılması — `navigator.share`, yoxdursa kopyalama.
 *
 * ⚠ `share` YALNIZ istifadəçi JEStİNDƏN çağırıla bilər, ona görə burada
 *   `await` ilə dərinə getmirik: `catch` sükutla kopyalamaya keçir.
 */
async function shareOwnProfile(me){
  const url = location.origin + '/#u/' + (me.username || '');
  try{
    if(navigator.share){ await navigator.share({ title: me.name || me.username, url }); return; }
  }catch(e){ /* istifadəçi ləğv etdi və ya dəstək yoxdur → kopyala */ }
  try{
    await navigator.clipboard.writeText(url);
    toast(t('users.a_copied'));
  }catch(e){ toast(t('dyn.err_generic'), 'err'); }
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
  const bioIn = el('textarea', { maxLength: 400, placeholder: t('pf.bio_ph') });
  bioIn.value = me.bio || '';
  const bdIn = el('input', { type: 'date', value: me.birthDate || '' });
  const genderBox = el('div', { class: 'gender-pick' });
  let gender = me.gender || '';
  /* ⚠ SAXLANILAN DƏYƏR TƏRCÜMƏ OLUNMUR. Massivin birinci elementi bazaya
   *   yazılan dəyərdir (`users.gender`), ikincisi yalnız ETİKETDİR. Etiketi
   *   dəyərə çevirsəydik, dili dəyişən istifadəçinin profili başqa cins
   *   dəyəri ilə yazılardı və köhnə sətirlər heç bir düymə ilə uyğunlaşmazdı. */
  [['Kişi', 'pf.male'], ['Qadın', 'pf.female']].forEach(([g, gKey]) => {
    const b = el('button', { type: 'button', class: 'genBtn' + (gender === g ? ' sel' : ''), onclick: () => {
      gender = g;
      genderBox.querySelectorAll('.genBtn').forEach(x => x.classList.toggle('sel', x === b));
    } }, t(gKey));
    genderBox.append(b);
  });
  const countryIn = inp(me.country, t('pf.country_ph'), 40);
  const cityIn = inp(me.city, t('pf.city_ph'), 40);

  // Miqrasiya 0050 — kataloqda göstərilən iş yeri və əl ilə status.
  // ⚠ Sahə OLMADAN sütun ölü olardı: kataloq onu göstərir, amma heç kim
  //   doldura bilməzdi. Sxem dəyişikliyi həmişə doldurma yolu ilə birlikdə
  //   gəlməlidir.
  const companyIn = inp(me.company, t('set.company_ph'), 60);
  const statusIn = el('select', {},
    el('option', { value: '' }, t('set.status_none')),
    ...['hiring', 'away', 'busy', 'dnd'].map(v =>
      el('option', { value: v, selected: (me.status || '') === v }, t('users.st_' + v))),
  );

  const tabGeneral = el('div', {},
    el('div', { class: 'photo-pick' }, avPreview,
      el('label', {}, t('pf.photo_change'), fileIn),
      el('button', { type: 'button', class: 'btn-mini block', onclick: () => {
        removeAvatar = true; newAvatarBlob = null;
        clear(avPreview); avPreview.textContent = (me.name || '?').charAt(0).toUpperCase();
      } }, t('pf.photo_remove'))),
    fld('Ad', nameIn),
    fld(t('pf.bio'), bioIn),
    el('div', { class: 'row2' }, fld(t('pf.birthdate'), bdIn), fld(t('pf.gender'), genderBox)),
    el('div', { class: 'row2' }, fld(t('pf.country'), countryIn), fld(t('pf.city'), cityIn)),
    el('div', { class: 'row2' },
      fld(t('set.company'), companyIn),
      fld(t('set.status'), statusIn, t('set.status_hint'))),
  );

  /* --- Tab: Bacarıqlar --- */
  const progPick = skillLevelPicker(tax.prog, me.progLevels || {});
  const langPick = skillLevelPicker(tax.spoken, me.langLevels || {});
  const goalsIn = el('textarea', { maxLength: 300, placeholder: t('pf.goals_ph') });
  goalsIn.value = me.goals || '';
  const lfBox = el('div', { class: 'pill-pick' });
  /* ⚠ Cins ilə eyni qayda: birinci element SAXLANILAN dəyər, ikincisi etiket. */
  [['Study partner', 'pf.lf_partner'], ['Mentor', 'pf.lf_mentor'], ['Layihə komandası', 'pf.lf_team']].forEach(([x, lfKey]) => {
    lfBox.append(el('button', { type: 'button', class: 'pp' + ((me.lookingFor || []).includes(x) ? ' sel' : ''),
      dataset: { val: x },
      onclick: e => e.target.classList.toggle('sel') }, t(lfKey)));
  });
  /* Təcrübə ili + sertifikat (miqrasiya 0052 → `users.skill_meta`).
   *
   * ⚠ SƏVİYYƏ İLƏ EYNİ ŞEY DEYİL: səviyyə ("Qabaqcıl") özünüqiymətdir, il isə
   *   faktdır. Spesifikasiya hər ikisini istəyir və onlar bir-birini əvəz
   *   etmir — 1 illik "Qabaqcıl" ilə 8 illik "Orta" fərqli mesajdır.
   *
   * ⚠ SİYAHI SEÇİMDƏN TÖRƏYİR: yalnız seçilmiş bacarıqlar üçün sətir olur.
   *   Bütün taksonomiya üçün sətir yaratsaydıq, redaktorda 23 boş sahə olardı.
   */
  const metaBox = el('div', { class: 'skill-meta' });
  const metaState = { ...(me.skillMeta || {}) };
  const rebuildMeta = () => {
    const chosen = [...Object.keys(progPick.getSelection()), ...Object.keys(langPick.getSelection())];
    clear(metaBox);
    if(!chosen.length){
      metaBox.append(el('p', { class: 'skill-meta__empty' }, t('pf.meta_none')));
      return;
    }
    chosen.forEach(name => {
      const cur = metaState[name] || { y: 0, c: 0 };
      const years = el('input', {
        type: 'number', min: '0', max: '30', value: String(cur.y || ''),
        placeholder: '0', 'aria-label': name + ' — ' + t('pf.sk_years'),
      });
      years.addEventListener('input', () => {
        metaState[name] = { ...(metaState[name] || { c: 0 }), y: Math.max(0, Math.min(30, parseInt(years.value, 10) || 0)) };
      });
      const cert = el('input', { type: 'checkbox', checked: !!cur.c, 'aria-label': name + ' — ' + t('pf.sk_cert') });
      cert.addEventListener('change', () => {
        metaState[name] = { ...(metaState[name] || { y: 0 }), c: cert.checked ? 1 : 0 };
      });
      metaBox.append(el('div', { class: 'skill-meta__row' },
        el('span', { class: 'skill-meta__n' }, name),
        el('label', { class: 'skill-meta__y' }, years, el('span', {}, t('pf.sk_unit'))),
        el('label', { class: 'skill-meta__c' }, cert, el('span', {}, t('pf.sk_cert'))),
      ));
    });
  };
  // Seçim dəyişəndə sətirlər yenilənir. Hadisə çipdən QALXIR, ona görə
  // valideyndə dinləmək kifayətdir (`skillLevelPicker`-in öz `onchange`-i yoxdur).
  progPick.addEventListener('click', rebuildMeta);
  langPick.addEventListener('click', rebuildMeta);
  rebuildMeta();

  const tabSkills = el('div', {},
    fld(t('pf.prog_langs'), progPick, t('pf.level_hint')),
    fld(t('pf.spoken_langs'), langPick),
    fld(t('pf.meta_title'), metaBox, t('pf.meta_hint')),
    fld(t('pf.goals'), goalsIn),
    fld(t('pf.looking_for'), lfBox),
  );

  /* --- Tab: Sosial --- */
  const instaIn = inp(me.instagram, '@' + t('pf.username_ph'), 40);
  const ghIn = inp(me.github, t('pf.username_ph'), 40);
  const liIn = inp(me.linkedin, 'in/' + t('pf.username_ph'), 60);
  const tgIn = inp(me.telegram, '@' + t('pf.username_ph'), 40);
  const webIn = inp(me.website, 'https://...', 100);
  const tabSocial = el('div', {},
    el('div', { class: 'row2' }, fld('Instagram', instaIn), fld('GitHub', ghIn)),
    el('div', { class: 'row2' }, fld('LinkedIn', liIn), fld('Telegram', tgIn)),
    fld(t('pf.website'), webIn),
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
    el('form', { onsubmit: 'return false;' },
      fld(t('prof.cur_pass'), curPass1), fld(t('prof.new_pass'), newPass),
      el('button', { class: 'btn-small', type: 'submit', onclick: async e => {
        passErr.textContent = '';
        if(!curPass1.value || newPass.value.length < 6){ passErr.textContent = t('prof.err_pass_fld'); return; }
        e.target.disabled = true;
        try{ await changePassword(curPass1.value, newPass.value); curPass1.value = newPass.value = ''; toast(t('dyn.pass_upd'), 'success'); }
        catch(ex){ passErr.textContent = authErrMessage(ex, t); }
        e.target.disabled = false;
      } }, t('prof.btn_pass')),
      passErr
    ),
    el('div', { class: 'section-title', style: 'font-size:.9rem; margin-top:20px;' }, t('prof.new_uname')),
    fld(t('prof.new_uname'), newUname, t('prof.new_uname_hint')),
    fld(t('prof.pass_confirm'), curPass2),
    el('button', { class: 'btn-small', onclick: async e => {
      unameErr.textContent = '';
      if(!newUname.value.trim() || !curPass2.value){ unameErr.textContent = t('pf.both_fields'); return; }
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
    } }, t('pf.change_username')),
    unameErr,
    el('p', { style: 'font-size:.76rem; color:var(--muted); margin-top:18px;' },
      t('pf.delete_hint_a'), el('b', {}, t('pf.delete_hint_b')), t('pf.delete_hint_c')),
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
    { key: 'showProjectOnProfile', type: 'toggle', lbl: t('pf.show_project'),
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
    { id: 'general', lbl: t('pf.tab_general'), node: tabGeneral },
    { id: 'skills', lbl: t('pf.tab_skills'), node: tabSkills },
    { id: 'social', lbl: 'Sosial', node: tabSocial },
    { id: 'settings', lbl: t('nav.settings'), node: tabSettings },
    { id: 'security', lbl: t('pf.tab_security'), node: tabSecurity },
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
        // Miqrasiya 0050 — kataloq sahələri.
        company: companyIn.value.trim(), status: statusIn.value,
        progLevels, langLevels,
        // ⚠ META SEÇİMƏ GÖRƏ SÜZÜLÜR: istifadəçi bacarığı çıxarıbsa, onun ili
        //   də getməlidir. Süzməsəydik, sətir bazada YETİM qalar və bacarıq
        //   geri əlavə olunanda köhnə il "birdən" peyda olardı.
        skillMeta: Object.fromEntries(Object.entries(metaState)
          .filter(([k, v]) => (k in progLevels || k in langLevels) && (v.y || v.c))),
        prog: Object.keys(progLevels), langs: Object.keys(langLevels),
        goals: goalsIn.value.trim(),
        /* ⚠ `dataset.val` OXUNUR, `textContent` YOX: düymənin mətni indi tərcümə
         *   olunur, saxlanılan dəyər isə dəyişməməlidir. `textContent` işlətsəydik
         *   EN interfeysdə profil "Project team", AZ-da "Layihə komandası"
         *   yazardı — eyni istifadəçi dilindən asılı olaraq iki fərqli dəyər
         *   saxlayardı və heç bir filtr onları uyğunlaşdıra bilməzdi. */
        lookingFor: [...lfBox.querySelectorAll('.pp.sel')].map(b => b.dataset.val),
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

/**
 * ⚠ ARTIQ `profEditBtn`-Ə BAĞLANMIR: düymə hər render-də YENİDƏN yaradılır
 *   (profil qatı JS-dən qurulur), ona görə bir dəfəlik `addEventListener`
 *   ilk render-dən sonra ölü qalardı. `onclick` indi düymənin özündədir.
 */
export function initProfile(){ /* bağlama lazım deyil — bax yuxarıdakı qeyd */ }

function renderAll(force = false){
  if(!document.getElementById('page-profil').classList.contains('active')) return;
  const key = renderKey(state.me);
  if(force || key !== lastRenderKey){
    lastRenderKey = key;
    mountView();
  }
  // TASK-8 / Bənd 6 — tamlıq indikatoru. Çatışmayan sahə çipi redaktoru açır.
  renderCompleteness(document.getElementById('profCompleteness'), state.me, () => openEditModal());
}

function onProfileBonus(){
  toast(t('cmp.bonus_earned'));
}

/* 🔴 SARĞI MƏCBURİDİR, `renderAll`-u BİRBAŞA VERMƏK OLMAZ: `addEventListener`
 *    dinləyiciyə `Event` obyektini ötürür və o, TRUTHY-dir — yəni `force`
 *    parametri hər lent yeniləməsində `true` olardı və profil hər dəfə
 *    tamamilə yenidən qurulardı (sürüşmə mövqeyi + yüklənmiş postlar itərdi).
 *    Məhz `renderKey` mexanizminin qarşısını almaq istədiyi hal. */
const onBusUpdate = () => renderAll(false);

export function mountProfile(){
  lastRenderKey = '';
  renderAll(true);
  bus.addEventListener('profile-bonus', onProfileBonus);
  unsubTasks = watchTasks(() => {});
  unsubSubs = watchMySubmissions(() => {});
  // ⚠ `feed-updated` HƏLƏ DƏ dinlənilir (post silinsə sancaq siyahısı köhnəlir),
  //   lakin `renderKey` dəyişməyibsə render ATLANIR — bax `renderKey` şərhi.
  bus.addEventListener('feed-updated', onBusUpdate);
  bus.addEventListener('users-updated', onBusUpdate);
  return () => {
    if(unsubTasks){ unsubTasks(); unsubTasks = null; }
    if(unsubSubs){ unsubSubs(); unsubSubs = null; }
    if(view){ view.destroy(); view = null; }
    bus.removeEventListener('feed-updated', onBusUpdate);
    bus.removeEventListener('users-updated', onBusUpdate);
    bus.removeEventListener('profile-bonus', onProfileBonus);
  };
}
