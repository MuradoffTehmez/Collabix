// Tətbiq qabığı: auth formaları, naviqasiya, qlobal listener-lərin idarəsi.
import 'highlight.js/styles/atom-one-dark.css';
import { watchAuthState, login, logout } from './auth.js';
import { lsGet, lsSet } from './storage.js';
import { ensureWidget } from './turnstile.js';
import { mountOAuthButtons, handleOAuthReturn, loadLinkedAccounts } from './oauth.js';
import { openMagicLinkModal, handleMagicReturn } from './magic.js';
import { openPasswordResetModal, handlePasswordResetReturn } from './password-reset.js';
import { loadMfaPanel } from './mfa.js';
import { applyOAuthTicket } from './wizard.js';
import {
  state, watchUsers, watchMyLikes, watchMyBookmarks, watchMyFollowing, watchMyFollowers,
  setFeedSort,
  watchPendingSubmissions, touchActivity, updateMySettings, updateMyProfile,
} from './store.js';
import { changePassword } from './auth.js';
import { el, clear, avatarNode, authErrMessage, bus, emit } from './util.js';
import { initWizard } from './wizard.js';
import { initTheme, toast, showModal, closeModal, toggleTheme, onThemeChange } from './ui.js';
import { initErrorBoundary } from './error-boundary.js';
import { paintIcons } from './icons.js';
import { startPresence, stopPresence } from './presence.js';
import { t, setLang, getLang, applyI18n } from './i18n.js';
// Parol bərpasının son ehtiyat variantı real əlaqə kanalını göstərir.
import { SITE } from './legal.js';
import { attachParticles } from './particles.js';
import { initCyberpunkFX } from './cyberpunk_fx.js';
import { initPalette } from './palette.js';
import { mountHome, mountSaved, mountPost, subscribeFeed, setFeedTab } from './feed.js';
import { initComposer } from './composer.js';
import { loadTaxonomies } from './taxonomy.js';
import { initPublic, showPublicPage, hidePublic, setPublicAuthState, PUBLIC_PAGES, PUB_PATHS } from './public.js';
/* 🔴 O-03 — ADMIN PANELİ TƏLƏB ÜZRƏ YÜKLƏNİR.
 *
 *   `admin.js` 52 KB, `governance.js` 19 KB-dır və hər ikisi statik idxal
 *   olunurdu — yəni HƏR istifadəçi, o cümlədən heç vaxt admin panelini
 *   açmayacaq minlərlə adi hesab, onları giriş paketində yükləyirdi.
 *   Auditin O-03 tapıntısında `admin.js` "tənbəl yükləmə üçün ən aydın
 *   namizəd" adlandırılmışdı.
 *
 * ⚠ NAXIŞ LAYİHƏDƏ ARTIQ VAR (`js/public.js` → `techMod`): promise BİR DƏFƏ
 *   qurulur və keşlənir, yəni ikinci ziyarətdə şəbəkə sorğusu getmir.
 *
 * ⚠ `governance.js` ADMIN-Ə XAS DEYİL — `mountGovernanceUser` adi istifadəçinin
 *   profilində də işləyir. Ona görə ayrı tənbəl modul kimi saxlanılır; admin
 *   panelini açanda onsuz da `admin.js` onu özü idxal edir.
 */
let adminModP = null;
const adminMod = () => (adminModP ??= import('./admin.js'));
let govModP = null;
const govMod = () => (govModP ??= import('./governance.js'));
let adminInited = false;

// Lazy modules for routes
let chatModP = null; const chatMod = () => (chatModP ??= import('./chat.js'));
let dmModP = null; const dmMod = () => (dmModP ??= import('./dm.js'));
let notifModP = null; const notifMod = () => (notifModP ??= import('./notify.js'));
let usersModP = null; const usersMod = () => (usersModP ??= import('./users.js'));
let workspaceModP = null; const workspaceMod = () => (workspaceModP ??= import('./workspace.js'));
let drillsModP = null; const drillsMod = () => (drillsModP ??= import('./drills.js'));
let teamsModP = null; const teamsMod = () => (teamsModP ??= import('./teams.js'));
let statsModP = null; const statsMod = () => (statsModP ??= import('./stats.js'));
let profileModP = null; const profileMod = () => (profileModP ??= import('./profile.js'));
let settingsModP = null; const settingsMod = () => (settingsModP ??= import('./settings.js'));
let sessionsModP = null; const sessionsMod = () => (sessionsModP ??= import('./sessions.js'));

let chatInited = false;
let dmInited = false;
let drillsInited = false;
let teamsInited = false;
let statsInited = false;
let profileInited = false;
let settingsInited = false;
let sessionsInited = false;
let notifInited = false;

const $ = id => document.getElementById(id);

/* ================= auth ekranı ================= */
function switchAuthTab(tab){
  $('tabRegBtn').classList.toggle('active', tab === 'reg');
  $('tabLoginBtn').classList.toggle('active', tab === 'login');
  // ⚠ Konteynerə sinif: sürüşən göstərici (`.tabs-switch::before`) mövqeyini
  //   buradan alır. Əvvəl aktiv fon birbaşa düymənin üzərində idi və keçid
  //   ANİ tullanırdı — hansı tabdan hansına keçildiyi hiss olunmurdu.
  document.querySelector('.tabs-switch')?.classList.toggle('t-login', tab === 'login');
  $('regForm').classList.toggle('hidden', tab !== 'reg');
  $('loginForm').classList.toggle('hidden', tab !== 'login');
  const lines = { reg: t('auth.term_reg'), login: t('auth.term_login') };
  const term = $('termLine');
  clear(term);
  term.append(lines[tab], el('span', { class: 'blink' }));
}

function initAuthUI(){
  $('tabRegBtn').addEventListener('click', () => switchAuthTab('reg'));
  $('tabLoginBtn').addEventListener('click', () => switchAuthTab('login'));

  initWizard();
  document.addEventListener('lang-changed', () => {
    switchAuthTab($('tabRegBtn').classList.contains('active') ? 'reg' : 'login');
  });
  initPalette();   // Ctrl/Cmd+K — qlobal qısayol

  // Login cilalanması: göz ikonası, spinner, remember me, parol reset məlumatı.
  $('loginEyeBtn').addEventListener('click', () => {
    const p = $('loginPass');
    const shown = p.type === 'password';   // klikdən SONRAKI vəziyyət
    p.type = shown ? 'text' : 'password';
    // ⚠ Düymə əvvəl `👁` EMOJİSİ idi — platformadan asılı çəkilirdi,
    //   `currentColor`-a tabe deyildi və vəziyyət dəyişəndə eyni qalırdı
    //   (yəni parol açıqdırmı, bağlıdırmı — bilinmirdi). İndi reyestrdəki
    //   SVG-dir və vəziyyətə görə `eye` ↔ `eyeOff` arasında keçir.
    const slot = $('loginEyeBtn').querySelector('.ic');
    if(slot){
      slot.dataset.icon = shown ? 'eyeOff' : 'eye';
      slot.querySelector('svg')?.remove();
      paintIcons($('loginEyeBtn'));
    }
  });
  // İlkin SVG-ni yerləşdir (markup-da yalnız `data-icon` yuvası var).
  paintIcons($('loginEyeBtn'));
  $('forgotBtn').addEventListener('click', async () => {
    // AUDIT-TASK-10 / Faza 5/#5 — ƏSL parol bərpası.
    //
    // ⚠ Əvvəl bura yalnız MAGIC LINK açırdı. O, sessiya verir, lakin parolu
    //   DƏYİŞMİR — istifadəçi növbəti cihazda yenə bloklanırdı. İndi əsl
    //   sıfırlama axını birinci gəlir; magic link "parolsuz giriş" kimi
    //   ikinci variant olaraq qalır.
    if(await openPasswordResetModal()) return;
    if(await openMagicLinkModal()) return;
    /* SON EHTİYAT — yuxarıdakı iki avtomatik yol mümkün olmayanda.
     * ⚠ Əvvəl bu blok SABİT AZƏRBAYCANCA mətn idi (EN/RU istifadəçi də onu
     *   görürdü), başlıqda `🔑` emojisi vardı və mövcud OLMAYAN Instagram
     *   səhifəsinə yönləndirirdi — `SITE.social` qəsdən boşdur (bax
     *   `js/legal.js`). İndi tərcümə olunur, ikon reyestrdəndir və göstərilən
     *   kanal REALDIR: `SITE.email`. */
    const icon = el('span', { class: 'ic', 'data-icon': 'lock', 'data-icon-size': '18' });
    const head = el('div', { class: 'section-title fp-head' }, icon, el('span', {}, t('auth.forgot_t')));
    showModal([
      head,
      el('p', { class: 'fp-body' }, t('auth.forgot_d')),
      el('a', { class: 'btn-mini fp-mail', href: 'mailto:' + SITE.email }, SITE.email),
    ]);
    paintIcons(head);
  });
  $('loginBtn').addEventListener('click', doLogin);
  $('loginPass').addEventListener('keydown', e => { if(e.key === 'Enter') doLogin(); });
}

async function doLogin(){
  const err = $('loginErr');
  const btn = $('loginBtn');
  err.textContent = '';
  btn.disabled = true;
  btn.querySelector('.btn-label').textContent = t('dyn.checking');
  btn.querySelector('.btn-spinner').classList.remove('hidden');
  try{
    await login($('loginUser').value, $('loginPass').value, $('rememberMe').checked);
    err.textContent = '';
  }catch(e){
    err.textContent = authErrMessage(e);
  }
  btn.disabled = false;
  btn.querySelector('.btn-label').textContent = t('dyn.login');
  btn.querySelector('.btn-spinner').classList.add('hidden');
}

/* ================= naviqasiya ================= */
const MOUNTS = {
  home: mountHome, 
  saved: mountSaved, 
  post: mountPost, 
  chat: (p) => {
    let stop = null;
    chatMod().then(m => {
      if(!chatInited) { m.initChat(); chatInited = true; }
      stop = m.mountChat(p);
    });
    return () => { stop?.(); stop = null; };
  },
  dm: (p) => {
    let stop = null;
    dmMod().then(m => {
      if(!dmInited) { m.initDM(); dmInited = true; }
      stop = m.mountDM(p);
    });
    return () => { stop?.(); stop = null; };
  },
  notifs: (p) => {
    let stop = null;
    notifMod().then(m => {
      if(!notifInited) { m.initNotifs(); notifInited = true; }
      stop = m.mountNotifs(p);
    });
    return () => { stop?.(); stop = null; };
  },
  users: (p) => {
    let stop = null;
    usersMod().then(m => {
      stop = m.mountUsers(p);
    });
    return () => { stop?.(); stop = null; };
  },
  u: (p) => {
    let stop = null;
    usersMod().then(m => {
      stop = m.mountPubProfile(p);
    });
    return () => { stop?.(); stop = null; };
  },
  tasks: (p) => {
    let stop = null;
    workspaceMod().then(m => {
      stop = m.mountWorkspace(p);
    });
    return () => { stop?.(); stop = null; };
  },
  drills: (p) => {
    let stop = null;
    drillsMod().then(m => {
      if(!drillsInited) { m.initDrills(); drillsInited = true; }
      stop = m.mountDrills(p);
    });
    return () => { stop?.(); stop = null; };
  },
  teams: (p) => {
    let stop = null;
    teamsMod().then(m => {
      if(!teamsInited) { m.initTeams(); teamsInited = true; }
      stop = m.mountTeams(p);
    });
    return () => { stop?.(); stop = null; };
  },
  team: (p) => {
    let stop = null;
    teamsMod().then(m => {
      if(!teamsInited) { m.initTeams(); teamsInited = true; }
      stop = m.mountTeam(p);
    });
    return () => { stop?.(); stop = null; };
  },
  stats: (p) => {
    let stop = null;
    statsMod().then(m => {
      if(!statsInited) { m.initStats(); statsInited = true; }
      stop = m.mountStats(p);
    });
    return () => { stop?.(); stop = null; };
  },
  profil: (p) => {
    let stop = null;
    Promise.all([profileMod(), govMod()]).then(([pM, gM]) => {
      if(!profileInited) { pM.initProfile(); profileInited = true; }
      stop = pM.mountProfile(p);
      gM.mountGovernanceUser();
    });
    return () => { stop?.(); stop = null; };
  },
  settings: (p) => {
    Promise.all([settingsMod(), sessionsMod()]).then(([setM, sesM]) => {
      if(!settingsInited) { setM.initSettings(); settingsInited = true; }
      if(!sessionsInited) { sesM.initSessions(); sessionsInited = true; }
      sesM.loadSessions();
      loadLinkedAccounts(); // still static for now
      loadMfaPanel(); // still static for now
    });
    return () => {};
  },
  admin: () => {
    let stop = null;
    adminMod().then(async m => {
      if(!adminInited){ m.initAdmin(); (await govMod()).initGovernance(); adminInited = true; }
      stop = m.mountAdmin();
      (await govMod()).mountGovernanceAdmin();
    });
    return () => { stop?.(); stop = null; };
  },
};
const VALID_PAGES = Object.keys(MOUNTS);
let pageCleanup = null;
let currentPage = 'home';
// Hazırda HƏQİQƏTƏN mount olunmuş marşrut. `pageCleanup`-dan ayrıdır, çünki
// bəzi mount-lar təmizləyici funksiya qaytarmır (null olur) — ona görə guard
// üçün etibarlı göstərici deyil.
let mountedPage = null;

// Dil dəyişəndə: cari app səhifəsini yenidən mount et ki, dinamik məzmun
// (feed, chat, users, bildirişlər...) da dərhal yeni dildə render olunsun.
// Statik data-i18n elementləri artıq applyI18n() ilə yenilənir; bu isə
// artıq DOM-a yazılmış dinamik mətnləri yeniləyir.
function remountCurrentPage(){
  if(!state.me || !$('app').classList.contains('active')) return;
  const seg = String(currentPage || 'home').split('/');
  const base = seg[0];
  const param = seg.slice(1).join('/') || undefined;
  if(!MOUNTS[base]) return;
  if(pageCleanup){ pageCleanup(); pageCleanup = null; }
  pageCleanup = MOUNTS[base](param) || null;
}

// Marşrut: "home", "post/abc123", "u/username" — parametrli deep-link dəstəyi.
/**
 * Sənədin yeganə `<h1>`-ini aktiv səhifənin başlığı ilə uzlaşdırır — O-04.
 *
 * ⚠ SPA-da `<h1>` mətni NAVİQASİYA İLƏ DƏYİŞMƏLİDİR. Sabit qalsaydı ekran
 *   oxuyucusu istifadəçi "Parametrlər"ə keçəndən sonra da "Collabix" oxuyardı
 *   və başlıq siyahısı (rotor) yanlış yol göstərərdi.
 *
 * ⚠ Mətn səhifənin ÖZ başlığından oxunur, ayrı sabit siyahıdan yox: ikinci
 *   siyahı saxlasaydıq, başlıq dəyişəndə biri köhnəlirdi və uyğunsuzluğu heç
 *   nə tutmurdu. Başlıq tapılmasa dəyər TOXUNULMAZ qalır — boş `<h1>` ən pis
 *   nəticədir.
 */
function syncDocHeading(pageEl){
  const h1 = $('docH1');
  if(!h1 || !pageEl) return;
  const title = pageEl.querySelector('h2.page-title, h2.nc-title, h2.ud-title, h2');
  const text = (title?.textContent || '').trim();
  if(text) h1.textContent = text;
}

function nav(pageRaw, replace = false){
  if(!state.me) return; // sessiyasız naviqasiya yoxdur
  // App qatı artıq görünürdümü — guard bunu dəyişiklikdən ƏVVƏL bilməlidir.
  const wasInApp = $('app').classList.contains('active');
  hidePublic();
  $('landing').classList.add('hidden');
  $('app').classList.add('active');
  // "users?skill=python" — query hissəsi marşrutdan ayrılır, URL-də saxlanılır
  // (Ana#10 klik-tag filtri, İstifadəçilər#3/#5 deep-link üçün).
  const raw = String(pageRaw || 'home');
  const qIdx = raw.indexOf('?');
  const query = qIdx >= 0 ? raw.slice(qIdx) : '';
  const seg = (qIdx >= 0 ? raw.slice(0, qIdx) : raw).split('/');
  let base = seg[0];
  const param = seg.slice(1).join('/') || undefined;
  if(!VALID_PAGES.includes(base)){ base = 'home'; }
  if(base === 'admin' && !state.isAdmin) base = 'home'; // UI qoruması; əsl qoruma rules-dadır
  const full = param ? base + '/' + param : base;

  // URL: post/profil = real crawlable path (/post/abc, /u/name); qalan app səhifələri hash-də.
  const syncUrl = () => {
    if(base === 'post' || base === 'u'){
      const rp = '/' + full;
      if(location.pathname + location.hash !== rp) {
        if (replace) history.replaceState(null, '', rp); else history.pushState(null, '', rp);
      }
    } else {
      const hp = '/#' + full + query;
      if(location.pathname + location.hash !== hp) {
        if (replace) history.replaceState(null, '', hp); else history.pushState(null, '', hp);
      }
    }
  };

  // ⛔ Eyni marşruta təkrar naviqasiya REMOUNT ETMİR.
  // Naviqasiya düyməsinə təkrar klik, hashchange+popstate cütü və ya
  // route()-un yenidən çağırılması əvvəl səhifəni tam yenidən qururdu —
  // scroll, fokus və açıq modal itirdi (TASK-7 / Bənd 3). Marşrut həqiqətən
  // dəyişməyibsə yalnız URL uzlaşdırılır.
  if(wasInApp && full === mountedPage){
    syncUrl();
    return;
  }

  if(pageCleanup){ pageCleanup(); pageCleanup = null; }
  currentPage = full;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item, .bottom-nav button').forEach(n => n.classList.toggle('active', n.dataset.page === base));
  const pg = $('page-' + base);
  if(pg) pg.classList.add('active');
  syncDocHeading(pg);
  const mount = MOUNTS[base];
  if(mount) pageCleanup = mount(param) || null;
  mountedPage = full;
  syncUrl();
  const main = document.querySelector('.main');
  if(main) main.scrollTop = 0;
  window.scrollTo({ top: 0 });
}

// path → public page adı (real path, hash deyil). Tapılmasa null.
const PATH_TO_PUB = Object.fromEntries(Object.entries(PUB_PATHS).map(([k, v]) => [v, k]));

// Mərkəzi marşrutlaşdırıcı: real path public/post/profil, hash isə app səhifələri.
function route(){
  const clean = location.pathname.replace(/^\/(en|ru)(?=\/|$)/, '') || '/';

  // 1) post/profil real-path deep-link (SSR meta artıq düzgündür).
  const mPost = clean.match(/^\/post\/([\w-]+)$/);
  const mUser = clean.match(/^\/u\/([\w.]+)$/);
  if(mPost || mUser){
    const target = mPost ? ('post/' + mPost[1]) : ('u/' + mUser[1]);
    if(state.me){ nav(target, true); }
    else { showPublicPage('welcome'); emit('open-auth', { tab: 'login' }); }
    return;
  }

  // 2) statik public real-path səhifə (/about, /faq ...) — daxil olmuşlar da baxa bilər.
  if(clean !== '/' && (clean in PATH_TO_PUB)){
    $('app').classList.remove('active');
    $('landing').classList.add('hidden');
    showPublicPage(PATH_TO_PUB[clean]);
    return;
  }

  // 3) kök "/" — daxil olmuşlar üçün hash app səhifəsini (yoxdursa home), qonaqlar üçün vitrin.
  if(clean === '/'){
    const h = location.hash.replace(/^#\/?/, '');
    if(state.me){ nav(h || 'home', true); return; }
    if(h && PUBLIC_PAGES.includes(h)){ showPublicPage(h); return; }
    showPublicPage('welcome');
    return;
  }

  // 4) fallback
  if(state.me) nav('home', true); else showPublicPage('welcome');
}

// Auth ekranını göstər (CTA-lardan çağırılır)
let authFlowActive = false; // giriş/qeydiyyat auth ekranından başlayıbsa → uğurda app-a keç
// OAuth-dan yeni istifadəçi kimi qayıdılıb: sihirbaz doldurulub, auth ekranı
// `endSession` içində açılır (bax oradakı izah).
let pendingOAuthSignup = false;
function showAuth(tab){
  authFlowActive = true;
  hidePublic();
  $('app').classList.remove('active');
  $('landing').classList.remove('hidden');
  switchAuthTab(tab || 'login');
  // Turnstile widget-ləri auth ekranı GÖRÜNƏNDƏ qoşulur, boot-da yox:
  // ziyarətçilərin çoxu heç vaxt bura çatmır, xarici skripti onlara
  // yükləmək mənasız yükdür. `ensureWidget` təkrar çağırışda no-op-dur.
  ensureWidget('login', $('loginTurnstile'), 'login');
  ensureWidget('register', $('regTurnstile'), 'register');
  // OAuth düymələri də burada qoşulur — qurulmuş provayder yoxdursa
  // `mountOAuthButtons` heç nə render etmir.
  mountOAuthButtons($('loginOAuth'));
  mountOAuthButtons($('regOAuth'));
}

// Geri/irəli (popstate) + hash əl ilə dəyişmə — bir frame-də birləşdirilir ki,
// eyni anda hər ikisi işə düşəndə ikiqat route() olmasın.
let routeScheduled = false;
function scheduleRoute(){
  if(routeScheduled) return;
  routeScheduled = true;
  requestAnimationFrame(() => { routeScheduled = false; route(); });
}
window.addEventListener('popstate', scheduleRoute);
window.addEventListener('hashchange', scheduleRoute);

/* ================= sessiya listener-ləri ================= */
let sessionUnsubs = [];

function startSession(){
  $('landing').classList.add('hidden');
  document.body.classList.add('authed');
  setPublicAuthState(true);
  renderSidebar();
  $('adminNavBtn').classList.toggle('hidden', !state.isAdmin);

  sessionUnsubs = [
    watchUsers(() => { renderSidebar(); emit('users-updated'); }),
    subscribeFeed(),
    watchMyLikes(() => emit('likes-updated')),
    watchMyBookmarks(() => emit('bookmarks-updated')),
    watchMyFollowing(() => emit('follows-updated')),
    watchMyFollowers(() => emit('follows-updated')),
    dmMod().then(m => m.subscribeThreads()),
    notifMod().then(m => m.subscribeNotifs()),
    startPresence(),
  ];
  // İstifadəçinin yadda saxlanmış dil/tema tərcihi
  if(state.me.settings?.lang && state.me.settings.lang !== getLang()) setLang(state.me.settings.lang);
  // Admin üçün: yoxlama gözləyən həllərin sayı sidebar/mobil badge-də görünür.
  if(state.isAdmin){
    sessionUnsubs.push(watchPendingSubmissions(list => emit('admin-pending', { count: list.length })));
  }
  touchActivity().catch(e => console.error('touchActivity', e));
  loadTaxonomies(); // fire-and-forget; bitəndə 'taxonomy-updated' ilə UI yenilənir
  if(authFlowActive){
    // CTA-dan gələn giriş/qeydiyyat — birbaşa app-a keç (körpü)
    authFlowActive = false;
    nav('home');
  } else {
    // F5/sessiya bərpası: URL public səhifədirsə orada qal, yoxsa app-a keç.
    route();
  }
  if(state.me.mustResetPassword) showForceResetModal();
  else maybeShowOnboarding();
}

// Admin müvəqqəti şifrə veribsə — girişdə məcburi dəyişmə (bağlanmayan modal).
function showForceResetModal(){
  const curIn = el('input', { type: 'password', placeholder: t('app.temp_pass_ph'),
    style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:10px 12px; border-radius:9px; margin-bottom:10px;' });
  const newIn = el('input', { type: 'password', placeholder: t('app.new_pass_ph'),
    style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:10px 12px; border-radius:9px; margin-bottom:10px;' });
  const errEl = el('div', { class: 'form-err' });
  const form = el('form', { onsubmit: 'return false;' }, curIn, newIn, errEl,
    el('button', { type: 'submit', class: 'btn-primary', onclick: async e => {
      if(newIn.value.length < 6){ errEl.textContent = t('dyn.pass_err'); return; }
      e.target.disabled = true;
      try{
        await changePassword(curIn.value, newIn.value);
        
        await updateMyProfile({ mustResetPassword: false });
        state.me.mustResetPassword = false;
        closeModal();
        toast(t('dyn.pass_upd'), 'success');
        maybeShowOnboarding();
      }catch(ex){ errEl.textContent = t('dyn.err_try'); e.target.disabled = false; console.error(ex); }
    } }, t('set.pass_ch'))
  );
  showModal([
    el('div', { class: 'section-title' }, t('app.change_pass_title')),
    el('p', { style: 'color:var(--muted); font-size:.85rem; margin-bottom:12px; line-height:1.5;' },
      t('app.change_pass_desc')),
    form
  ]);
  // bağlama düyməsini gizlət — məcburidir
  const closeBtn = document.querySelector('#modalCard .modal-close');
  if(closeBtn) closeBtn.style.display = 'none';
}

/* ---------- onboarding tour (ilk giriş) ---------- */
function maybeShowOnboarding(){
  if(lsGet('collabix_onboarded')) return;
  const steps = [
    [t('app.ob_t1'), t('app.ob_d1', { name: (state.me.name || '').split(' ')[0] })],
    [t('app.ob_t2'), t('app.ob_d2')],
    [t('app.ob_t3'), t('app.ob_d3')],
    [t('app.ob_t4'), t('app.ob_d4')],
    [t('app.ob_t5'), t('app.ob_d5')],
  ];
  let i = 0;
  const show = () => {
    const [title, text] = steps[i];
    const isLast = i === steps.length - 1;
    showModal([
      el('div', { class: 'section-title' }, title),
      el('p', { style: 'color:var(--muted); font-size:.9rem; line-height:1.6; margin-bottom:18px;' }, text),
      el('div', { style: 'display:flex; justify-content:space-between; align-items:center;' },
        el('span', { style: 'font-size:.72rem; color:var(--muted); font-family:var(--mono);' }, (i + 1) + '/' + steps.length),
        el('div', { style: 'display:flex; gap:8px;' },
          el('button', { class: 'btn-mini', onclick: done }, t('app.ob_skip')),
          el('button', { class: 'btn-small', onclick: () => { if(isLast){ done(); } else { i++; show(); } } }, isLast ? t('app.ob_start') : t('app.ob_next')),
        ),
      ),
    ]);
  };
  const done = () => { lsSet('collabix_onboarded', '1'); closeModal(); };
  setTimeout(show, 600);
}

function endSession(message){
  sessionUnsubs.forEach(u => { try{ u(); }catch(e){} });
  sessionUnsubs = [];
  if(pageCleanup){ pageCleanup(); pageCleanup = null; }
  mountedPage = null;
  state.me = null; state.authUser = null; state.isAdmin = false;
  state.users.clear(); state.myLikes.clear(); state.myBookmarks.clear(); state.myFollowing.clear();
  $('app').classList.remove('active');
  document.body.classList.remove('authed');
  setPublicAuthState(false);
  $('loginUser').value = '';
  $('loginPass').value = '';
  $('loginErr').textContent = '';
  if(message){
    // bloklanma və s. — auth ekranında səbəbi göstər
    showAuth('login');
    $('loginErr').textContent = message;
  } else if(pendingOAuthSignup){
    // OAuth ilə YENİ istifadəçi: hesab hələ yaradılmayıb (18+ qapısı sihirbazdadır),
    // ona görə `watchAuthState` təbii olaraq "sessiya yoxdur" deyir. `route()`
    // çağırsaydıq doldurulmuş sihirbaz vitrinlə əvəz olunardı.
    pendingOAuthSignup = false;
    showAuth('reg');
  } else {
    // adi çıxış / qonaq → public vitrin (hash public səhifədirsə orada qal)
    route();
  }
}

function renderSidebar(){
  if(!state.me) return;
  const av = $('sideAvatar');
  const fresh = avatarNode(state.me, 'avatar');
  fresh.id = 'sideAvatar';
  av.replaceWith(fresh);
  $('sideName').textContent = state.me.name;
  // AUDIT-UI: əvvəl '🔥 N · ⚡M' tək mətn idi. İndi ikon yuvaları + rəqəm.
  const streak = $('sideStreak');
  clear(streak);
  streak.append(
    el('span', { class: 'ic', 'data-icon': 'flame', 'data-icon-size': '13' }),
    el('span', {}, String(state.me.streak || 0)),
    el('span', { class: 'streak-sep' }, '·'),
    el('span', { class: 'ic', 'data-icon': 'zap', 'data-icon-size': '13' }),
    el('span', {}, String(state.me.xp || 0)),
  );
  paintIcons(streak);
  $('adminNavBtn').classList.toggle('hidden', !state.isAdmin);
  // topbar avatarı
  const btn = $('avatarMenuBtn');
  clear(btn);
  btn.append(avatarNode(state.me, 'avatar'));
  
  const pDisp = $('activeProjectDisplay');
  if (pDisp) {
      if(state.me.activeProjectId) {
        const pDisp = el('div', { style: 'font-size:.7rem; color:var(--muted); margin-top:2px;' });
        pDisp.textContent = t('app.active_project', { id: state.me.activeProjectId.substring(0,6) });
        badgeEl.append(pDisp);
      } else {
        pDisp.classList.add('hidden');
      }
    }
}

function setBadge(ids, count){
  ids.forEach(id => {
    const b = $(id);
    if(!b) return;
    b.textContent = count > 99 ? '99+' : count;
    b.classList.toggle('show', count > 0);
  });
}

/* ================= boot ================= */
// 🔴 ƏN ƏVVƏL — AUDIT-TASK-10 / Faza 2.2.
// Boot-un qalan hissəsində atılan hər tutulmayan xəta bu qatdan keçir; sonraya
// qoysaq, məhz boot xətaları (ən kritikləri) tutulmamış qalardı.
initErrorBoundary();
initTheme();
/**
 * Boot-u qeyd edən köməkçi.
 *
 * 🔴 NİYƏ SADƏ `addEventListener('DOMContentLoaded')` KİFAYƏT ETMİR
 *    (2026-08-09-da istehsalda üzə çıxdı): modul skriptləri adətən
 *    DOMContentLoaded-dən ƏVVƏL icra olunur, ona görə köhnə yazılış illərlə
 *    işləyirdi. Vite 8 (Rolldown) paketi daha çox chunk-a bölür və giriş
 *    kodunun bir hissəsi hadisə ARTIQ BAŞ VERDİKDƏN sonra icra olunmağa
 *    başladı. Dinləyici gec qeyd olunduğu üçün HEÇ VAXT işə düşmədi:
 *      • `watchAuthState` çağırılmadı, yəni `/api/auth/me` ümumiyyətlə
 *        sorğulanmadı,
 *      • sessiya qurulmadı və istifadəçi daxil olsa belə publik səhifədə
 *        qaldı — onun başlığı isə sənədlə birlikdə sürüşür.
 *    Qüsur TAMAMİLƏ SƏSSİZ idi: nə xəta, nə rədd edilmiş promise — sadəcə
 *    icra olunmayan kod.
 *
 * ⚠ Yeni boot kodu HƏMİŞƏ bu köməkçidən keçməlidir; birbaşa
 *   `addEventListener('DOMContentLoaded')` yazmaq eyni tələni geri qaytarır.
 */
function onReady(fn){
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}

onReady(() => {
  // Statik markup-dakı `[data-icon]` yuvalarını SVG ilə doldur (AUDIT-UI).
  // `icons-dirty` — tema dəyişəndə ui.js göndərir (ora import etmək dövr yaradardı).
  paintIcons();
  document.addEventListener('icons-dirty', () => paintIcons());

  // SSR locale prefix (/en/..., /ru/...) → dili tətbiq et, sonra path-dan təmizlə.
  // Crawler prefiksli URL-i görür; insan təmiz path-da qalır (dil localStorage-da).
  const lm = location.pathname.match(/^\/(en|ru)(\/|$)/);
  if(lm){
    if(lm[1] !== getLang()) setLang(lm[1]);
    const stripped = (location.pathname.slice(lm[1].length + 1) || '/');
    history.replaceState(null, '', stripped + location.search + location.hash);
  }
  initPublic();
  bus.addEventListener('open-auth', e => showAuth(e.detail.tab));
  bus.addEventListener('pub-nav', e => {
    const page = e.detail.page;
    if(state.me && page === 'welcome'){ nav('home'); return; }
    $('app').classList.remove('active');
    $('landing').classList.add('hidden');
    showPublicPage(page);
  });
  $('landingBackBtn').addEventListener('click', () => {
    $('landing').classList.add('hidden');
    showPublicPage('welcome');
  });

  initAuthUI();
  initComposer();
  
  // init methods for routes are now called on-demand in MOUNTS
  // except those that might be needed globally at boot.
  // Notifs need to run their init because there might be topbar UI bindings.
  notifMod().then(m => {
    if(!notifInited) { m.initNotifs(); notifInited = true; }
  });

  document.querySelectorAll('.sidebar .nav-item, .bottom-nav button').forEach(btn => {
    if(btn.dataset.page) btn.addEventListener('click', () => nav(btn.dataset.page));
  });
  $('sideUserChip').addEventListener('click', () => nav('profil'));
  $('logoutBtn').addEventListener('click', async () => {
    await logout();
    toast(t('dyn.logout'));
  });

  bus.addEventListener('nav', e => nav(e.detail.page));
  $('postBackBtn').addEventListener('click', () => nav('home'));
  $('pubBackBtn').addEventListener('click', () => nav('users'));

  /* ---- app topbar ---- */
  $('appLogo').addEventListener('click', () => nav('home'));
  $('bellBtn').addEventListener('click', () => nav('notifs'));
  $('appThemeBtn').addEventListener('click', toggleTheme);
  $('afYear').textContent = new Date().getFullYear();
  // qlobal axtarış → Enter: istifadəçi axtarışına yönləndir
  $('appSearch').addEventListener('keydown', e => {
    if(e.key !== 'Enter') return;
    const qv = e.target.value.trim();
    nav('users');
    setTimeout(() => {
      const inp = $('userSearch');
      if(inp){ inp.value = qv; inp.dispatchEvent(new Event('input')); }
    }, 120);
  });
  // dil switcher (app)
  const appSw = $('appLangSwitch');
  const syncAppLang = () => appSw.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.lang === getLang()));
  appSw.addEventListener('click', e => {
    const b = e.target.closest('button[data-lang]');
    if(!b) return;
    setLang(b.dataset.lang);
    syncAppLang();
    if(state.me) updateMySettings({ lang: b.dataset.lang }).catch(() => {});
  });
  syncAppLang();
  document.addEventListener('lang-changed', () => { syncAppLang(); remountCurrentPage(); });
  // tema seçimini settings-ə də yaz
  onThemeChange(themeVal => { if(state.me) updateMySettings({ theme: themeVal }).catch(() => {}); });
  // avatar menyusu
  const menu = $('avatarMenu');
  $('avatarMenuBtn').addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
  document.addEventListener('click', () => menu.classList.remove('open'));
  menu.querySelectorAll('button[data-page]').forEach(b => b.addEventListener('click', () => { menu.classList.remove('open'); nav(b.dataset.page); }));
  $('menuLogoutBtn').addEventListener('click', async () => { menu.classList.remove('open'); await logout(); toast(t('dyn.logout')); });
  // particle fonları (welcome hero + login ekranı)
  attachParticles(document.querySelector('#pub-welcome .hero'));
  attachParticles($('landing'));
  $('feedTabs').addEventListener('click', e => {
    const btn = e.target.closest('button[data-ftab]');
    if(!btn) return;
    document.querySelectorAll('#feedTabs button').forEach(b => b.classList.toggle('active', b === btn));
    setFeedTab(btn.dataset.ftab);
  });

  // Sıralama seçicisi. ⚠ Tab-dan FƏRQLİ qat: tab klientdə filtrləyir
  // (`setFeedTab` → renderFeed), sıralama isə SERVERƏ gedir, ona görə
  // `refresh-feed` ilə poll dərhal yenidən sorğu atmalıdır.
  $('feedSort').addEventListener('click', e => {
    const btn = e.target.closest('button[data-fsort]');
    if(!btn || btn.classList.contains('active')) return;
    document.querySelectorAll('#feedSort button').forEach(b => b.classList.toggle('active', b === btn));
    setFeedSort(btn.dataset.fsort);
    emit('refresh-feed');
  });
  bus.addEventListener('dm-unread', e => setBadge(['dmBadge', 'dmBadgeM'], e.detail.count));
  bus.addEventListener('notif-unread', e => setBadge(['notifBadge', 'notifBadgeM', 'notifBadgeTop'], e.detail.count));
  bus.addEventListener('admin-pending', e => setBadge(['adminBadge', 'adminBadgeM'], e.detail.count));

  // Mobil "Daha çox" menyusu — sidebar-da olan, bottom nav-a sığmayan səhifələr.
  document.getElementById('moreNavBtn').addEventListener('click', () => {
    const item = (ic, label, page, cls = '') => el('button', {
      class: cls,
      onclick: () => { closeModal(); nav(page); },
    }, el('span', { class: 'ic' }, ic), label);
    const menu = el('div', { class: 'context-menu' },
      item('◎', t('nav.users'), 'users'),
      item('☑', t('nav.tasks'), 'tasks'),
      item('✎', t('nav.drills'), 'drills'),
      item('★', t('nav.saved'), 'saved'),
      item('⚙', t('nav.settings'), 'settings'),
      el('div', { class: 'cm-sep' }),
      state.isAdmin ? item('⚑', 'Admin panel', 'admin', 'admin') : null,
      el('button', { class: 'cm-item', style: 'color:var(--danger);', onclick: () => { closeModal(); logout(); } },
      el('span', { class: 'ic' }, '⏻'), t('nav.logout')),
    );
    showModal([el('div', { class: 'section-title' }, t('nav.more')), menu]);
  });

  // OAuth qayıdışı (Bənd 5) — `watchAuthState`-dən ƏVVƏL emal olunur.
  // Səbəb: yeni istifadəçi bileti varsa sihirbaz doldurulmalı və auth ekranı
  // açılmalıdır; `watchAuthState` isə sessiyasız istifadəçini vitrinə atardı
  // və bilet ünvandan silindiyi üçün itərdi.
  initCyberpunkFX();
  handleMagicReturn();
  // ⚠ SIRA: parol sıfırlama qayıdışı `handleOAuthReturn`-dən ƏVVƏL oxunmalıdır.
  //   O, öz parametrlərini təmizləyərkən `history.replaceState` çağırır və
  //   ünvandakı `?reset=` nişanını da silərdi — istifadəçi linki bir dəfə
  //   açır, ikinci şans yoxdur.
  handlePasswordResetReturn();
  handleOAuthReturn().then(async ticket => {
    // Bayraq qoyulur, ekran DƏYİŞDİRİLMİR: `watchAuthState` az sonra
    // `endSession`-u çağıracaq və auth ekranını məhz orada açacaq.
    pendingOAuthSignup = !!(ticket && await applyOAuthTicket(ticket));
    // Auth state persistence — F5-dən sonra istifadəçi daxil qalır.
    watchAuthState(startSession, endSession);
  });
});
