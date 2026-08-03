// Public qat: header (nav/axtarış/CTA/dil), homepage (hero/features/sidebar/
// testimonials), FAQ (akkordeon+axtarış), About/Privacy/Terms, Contact, Footer.
import {
  fetchPublicFaqs, fetchPublicTestimonials, fetchPublicStats,
  subscribeNewsletter, sendContactMessage,
} from './store.js';
import { el, clear, debounce, emit, onceInView, countUp, prefersReducedMotion } from './util.js';
import { toast, toggleTheme } from './ui.js';
import { t, tf, setLang, getLang, applyI18n, initI18n } from './i18n.js';
import { markdownNode } from './markdown.js';
import { LEGAL, SITE, DEFAULT_FAQS, DEFAULT_TESTIMONIALS, EEAT_CONTENT } from './legal.js';
import { DEFAULT_PROG, DEFAULT_SPOKEN } from './taxonomy.js';
import { STEP_ICONS, copyButton, paintIcons } from './icons.js';
import { initCookieBanner } from './cookies.js';

// Loqo dəsti (~18 KB path datası) yalnız PUBLIC qatda lazımdır — daxil olmuş
// istifadəçi onu heç vaxt görmür. Dinamik import ilə ayrı chunk-a düşür ki,
// giriş bundle-ı ağırlaşmasın. Promise bir dəfə qurulur, sonra keşlənir.
let techModPromise = null;
const techMod = () => (techModPromise ??= import('./techlogos.js'));

export const PUBLIC_PAGES = ['welcome', 'about', 'faq', 'privacy', 'terms', 'contact', 'security', 'cookies', 'changelog'];
// Real path-lar (hash deyil) — SEO/crawlability üçün. welcome = "/".
export const PUB_PATHS = {
  welcome: '/', about: '/about', faq: '/faq', privacy: '/privacy', terms: '/terms',
  contact: '/contact', security: '/security', cookies: '/cookies', changelog: '/changelog',
};
export function pubPathFor(page){ return PUB_PATHS[page] || '/'; }
let currentPub = 'welcome';
let faqs = [];
let faqsLoaded = false;

/* ================= görünüş idarəsi ================= */
export function showPublicPage(page){
  if(!PUBLIC_PAGES.includes(page)) page = 'welcome';
  currentPub = page;
  document.getElementById('publicLayer').classList.remove('hidden');
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('app').classList.remove('active');
  document.querySelectorAll('.pub-page').forEach(p => p.classList.toggle('active', p.id === 'pub-' + page));
  document.querySelectorAll('#pubNav a, #mobileMenu a').forEach(a => a.classList.toggle('active', a.dataset.pub === page));
  document.getElementById('mobileMenu').classList.remove('open');
  // Real path yaz (yalnız fərqli olduqda → popstate/boot-da təkrar push olmasın).
  const path = pubPathFor(page);
  if(location.pathname !== path) history.pushState(null, '', path);
  window.scrollTo({ top: 0 });
  renderPage(page);
  updateBreadcrumb(page);
  updateDynamicMeta(page);
  updateSocialSharePanel(page);
}

export function hidePublic(){
  document.getElementById('publicLayer').classList.add('hidden');
}

// Auth vəziyyətinə görə header CTA-ları
export function setPublicAuthState(isAuthed){
  document.querySelectorAll('.ph-guest').forEach(b => b.classList.toggle('hidden', isAuthed));
  document.getElementById('pubAppBtn').classList.toggle('hidden', !isAuthed);
}

/* ================= səhifə renderləri ================= */
function renderPage(page){
  if(page === 'welcome') renderWelcome();
  else if(page === 'about') renderMd('aboutBody', LEGAL.about);
  else if(page === 'privacy') renderMd('privacyBody', LEGAL.privacy);
  else if(page === 'terms') renderMd('termsBody', LEGAL.terms);
  else if(page === 'faq') renderFaqPage();
  else if(page === 'contact') renderContactInfo();
  else if(page === 'security') renderMd('securityBody', EEAT_CONTENT.security);
  else if(page === 'cookies') renderMd('cookiesBody', EEAT_CONTENT.cookies);
  else if(page === 'changelog') renderMd('changelogBody', EEAT_CONTENT.changelog);
}

function renderMd(elId, contentObj){
  const box = document.getElementById(elId);
  clear(box);
  box.append(markdownNode(tf(contentObj)));
}

/* ---------- homepage ---------- */
// AUDIT-UI: əvvəl rəngli emoji idi (🤝 💻 ☑️ 🔥 💬 🌍). Emoji platformadan
// asılıdır, `currentColor`-a tabe olmur və dörd temanın heç birinə uyğunlaşmır.
// ICONS reyestrindəki adlar — `f-ic` yuvası SVG ilə doldurulur.
const FEATURES = [
  ['users', 'feat.1t', 'feat.1d'], ['code', 'feat.2t', 'feat.2d'], ['tasks', 'feat.3t', 'feat.3d'],
  ['flame', 'feat.4t', 'feat.4d'], ['message', 'feat.5t', 'feat.5d'], ['globe', 'feat.6t', 'feat.6d'],
];

function renderWelcome(){
  const grid = document.getElementById('featGrid');
  clear(grid);
  FEATURES.forEach(([ic, tt, dd], i) => {
    grid.append(el('div', { class: 'feat-card', style: `animation-delay:${i * 70}ms;` },
      el('div', { class: 'f-ic', 'data-icon': ic, 'data-icon-size': '26' }),
      el('h3', {}, t(tt)),
      el('p', {}, t(dd)),
    ));
  });
  paintIcons(grid);

  // Ana#8 — hər mərhələyə vahid üslublu SVG ikon (nömrə ilə yanaşı).
  const steps = document.getElementById('howSteps');
  clear(steps);
  [['how.1t', 'how.1d'], ['how.2t', 'how.2d'], ['how.3t', 'how.3d'], ['how.4t', 'how.4d']].forEach(([tt, dd], i) => {
    steps.append(el('div', { class: 'how-step' + (i % 2 ? ' rev' : '') },
      el('div', { class: 'hs-num' }, el('span', { class: 'hs-ic' }, STEP_ICONS[i]()), el('b', {}, i + 1)),
      el('div', { class: 'hs-body' }, el('h3', {}, t(tt)), el('p', {}, t(dd))),
    ));
  });

  renderCodeShowcase();
  renderSidebarWidgets();
  renderTestimonials();
}

/* ---------- Ana#9: kod paylaşımı vitrini + "Kopyala" ---------- */
// Nümunə kod blokları — homepage-də platformanın kod təcrübəsini göstərir.
// Kopyala düyməsi feed.js-dəki EYNİ komponentdir (icons.js).
const CODE_SAMPLES = [
  { lang: 'python', label: 'Python', code: 'def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        yield a\n        a, b = b, a + b\n\nprint(list(fib(10)))' },
  { lang: 'javascript', label: 'JavaScript', code: 'const streak = days =>\n  days.reduce((n, d) => d.active ? n + 1 : 0, 0);\n\nconsole.log(streak(activity));' },
];

function renderCodeShowcase(){
  const box = document.getElementById('codeShowcase');
  if(!box) return;
  clear(box);
  CODE_SAMPLES.forEach(s => {
    const code = el('code', { class: 'language-' + s.lang });
    s.code.split('\n').forEach(line => {
      code.append(el('span', { class: 'code-line' }, line), document.createTextNode('\n'));
    });
    box.append(el('div', { class: 'feed-code show-lines' },
      el('div', { class: 'code-head' },
        el('span', { class: 'code-lang-badge' }, s.label),
        el('div', { class: 'code-head-actions' }, copyButton(s.code)),
      ),
      el('pre', {}, code),
    ));
  });
}

/* ---------- Ana#2: canlı statistika (count-up, görünəndə bir dəfə) ---------- */
let trendsGen = 0;

async function renderSidebarWidgets(){
  const statsBox = document.getElementById('sbStats');
  clear(statsBox);
  let stats = null;
  try{ stats = await fetchPublicStats(); }catch(e){}
  const vals = [
    [stats?.users ?? 40, 'sb.users'],
    [stats?.posts ?? 25, 'sb.posts'],
    [DEFAULT_PROG.length + DEFAULT_SPOKEN.length, 'sb.langs'],
  ];
  vals.forEach(([num, lbl]) => {
    const numEl = el('div', { class: 'sb-num' }, '0');
    statsBox.append(el('div', { class: 'sb-stat' }, numEl, el('span', {}, t(lbl))));
  });
  // Bütün sayğaclar bir yerdə — bölmə viewport-a girəndə işə düşür, yalnız bir dəfə.
  onceInView(statsBox, () => {
    [...statsBox.querySelectorAll('.sb-num')].forEach((n, i) => countUp(n, vals[i][0]));
  });

  /* ---------- Ana#7 + Ana#10: loqolu nişan → filtrlənmiş keçid ---------- */
  const trends = document.getElementById('sbTrends');
  clear(trends);
  const hint = document.getElementById('sbTrendsHint');
  if(hint) hint.textContent = t('sb.trends_hint');

  const items = [...DEFAULT_PROG.slice(0, 8), ...DEFAULT_SPOKEN.slice(0, 4)];
  // Dil dəyişikliyi bu funksiyanı yenidən çağıra bilər. İki çağırış eyni anda
  // await-də gözləyirsə, gec bitən KÖHNƏ çağırış yenisinin üstünə yazmamalıdır —
  // nəsil sayğacı ilə yalnız ən son çağırış DOM-a toxunur.
  const gen = ++trendsGen;
  const { techBadge } = await techMod();
  if(gen !== trendsGen) return;
  clear(trends);
  items.forEach(item => trends.append(techBadge(item, { size: 'sm', onClick: gotoUsersWithSkill })));
}

// Klik-tag filtri: seçilmiş skill İstifadəçilər səhifəsinə ötürülür.
// Qonaq üçün səhifə bağlıdır → seçim yadda saxlanılır, qeydiyyatdan sonra tətbiq olunur.
const PENDING_SKILL_KEY = 'collabix_pending_skill';
function gotoUsersWithSkill(item){
  try{ sessionStorage.setItem(PENDING_SKILL_KEY, item.label); }catch(e){}
  if(document.getElementById('pubAppBtn').classList.contains('hidden')){
    emit('open-auth', { tab: 'reg' });   // qonaq
  } else {
    emit('nav', { page: 'users?skill=' + encodeURIComponent(item.label) });
  }
}

function starRow(rating){
  const row = el('span', { class: 'stars', 'aria-label': rating + '/5' });
  for(let i = 1; i <= 5; i++) row.append(el('span', { class: i <= rating ? 'st on' : 'st' }, '★'));
  return row;
}

/* ---------- Ana#5: rəylər karuseli ---------- */
// Auto-advance + oxlar + nöqtələr, translateX slide, hover/fokusda dayanır,
// mobildə swipe. Reduced-motion → auto-advance YOX, yalnız əl ilə idarə.
let testiTimer = null;

async function renderTestimonials(){
  const root = document.getElementById('testiGrid');
  clear(root);
  clearInterval(testiTimer);

  let items = [];
  try{ items = await fetchPublicTestimonials(); }catch(e){}
  if(!items.length) items = DEFAULT_TESTIMONIALS;
  items = items.slice(0, 6);
  if(!items.length) return;

  const track = el('div', { class: 'testi-track' });
  items.forEach(x => {
    track.append(el('div', { class: 'testi-card', role: 'group' },
      starRow(x.rating || 5),
      el('p', { class: 'testi-text' }, '"' + tf(x.text) + '"'),
      el('div', { class: 'testi-author' },
        el('div', { class: 'avatar' }, (x.authorName || '?').charAt(0)),
        el('div', {}, el('b', {}, x.authorName || '—'), el('span', {}, tf(x.authorTitle))),
      ),
    ));
  });

  const dots = el('div', { class: 'testi-dots', role: 'tablist' });
  const viewport = el('div', { class: 'testi-viewport' }, track);
  let idx = 0;

  const go = n => {
    idx = (n + items.length) % items.length;
    track.style.transform = `translateX(-${idx * 100}%)`;
    [...dots.children].forEach((d, i) => {
      d.classList.toggle('on', i === idx);
      d.setAttribute('aria-selected', String(i === idx));
    });
    [...track.children].forEach((c, i) => {
      // Görünməyən slaydlar klaviatura/ekran-oxuyucudan gizlədilir.
      c.setAttribute('aria-hidden', String(i !== idx));
    });
  };

  items.forEach((_, i) => {
    dots.append(el('button', {
      class: 'testi-dot' + (i === 0 ? ' on' : ''),
      type: 'button', role: 'tab',
      'aria-label': t('testi.goto') + ' ' + (i + 1),
      'aria-selected': String(i === 0),
      onclick: () => { go(i); restart(); },
    }));
  });

  const prev = el('button', { class: 'testi-arrow prev', type: 'button',
    'aria-label': t('testi.prev'), onclick: () => { go(idx - 1); restart(); } }, '‹');
  const next = el('button', { class: 'testi-arrow next', type: 'button',
    'aria-label': t('testi.next'), onclick: () => { go(idx + 1); restart(); } }, '›');

  const auto = items.length > 1; // Auto advance enabled regardless of reduced motion for this specific component
  const restart = () => {
    clearInterval(testiTimer);
    if(auto) testiTimer = setInterval(() => go(idx + 1), 6000);
  };

  const wrap = el('div', { class: 'testi-carousel', 'aria-label': t('testi.carousel'), 'aria-roledescription': 'carousel' },
    prev, viewport, next, dots);

  // Hover / klaviatura fokusunda auto-advance dayanır (oxumağa mane olmasın).
  if(auto){
    wrap.addEventListener('mouseenter', () => clearInterval(testiTimer));
    wrap.addEventListener('mouseleave', restart);
    wrap.addEventListener('focusin', () => clearInterval(testiTimer));
    wrap.addEventListener('focusout', restart);
  }

  // Mobil swipe — yalnız üfüqi jest slayd sayılır (şaquli scroll pozulmasın).
  let sx = 0, sy = 0, swiping = false;
  viewport.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; swiping = true;
    clearInterval(testiTimer);
  }, { passive: true });
  viewport.addEventListener('touchend', e => {
    if(!swiping) return;
    swiping = false;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if(Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(idx + (dx < 0 ? 1 : -1));
    restart();
  }, { passive: true });

  root.append(wrap);
  go(0);
  restart();
}

/* ---------- FAQ ---------- */
async function loadFaqs(){
  if(faqsLoaded) return;
  try{
    faqs = await fetchPublicFaqs();
  }catch(e){ faqs = []; }
  if(!faqs.length) faqs = DEFAULT_FAQS;
  faqsLoaded = true;
  updateFaqSchema(faqs);
}

async function renderFaqPage(prefill){
  await loadFaqs();
  const input = document.getElementById('faqSearch');
  if(prefill !== undefined) input.value = prefill;
  renderFaqList();
}

function renderFaqList(){
  const box = document.getElementById('faqList');
  const qStr = (document.getElementById('faqSearch').value || '').trim().toLowerCase();
  clear(box);
  const list = faqs.filter(f => {
    if(!qStr) return true;
    return (tf(f.q) + ' ' + tf(f.a)).toLowerCase().includes(qStr);
  });
  if(!list.length){
    box.append(el('p', { class: 'faq-empty' }, t('faq.empty')));
    return;
  }
  list.forEach(f => {
    const answer = el('div', { class: 'faq-a' }, el('p', {}, tf(f.a)));
    const item = el('div', { class: 'faq-item' },
      el('button', { class: 'faq-q', onclick: e => {
        const open = item.classList.toggle('open');
        e.currentTarget.setAttribute('aria-expanded', open);
      }, 'aria-expanded': 'false' }, el('span', {}, tf(f.q)), el('span', { class: 'faq-arrow' }, '⌄')),
      answer,
    );
    box.append(item);
  });
}

/* ---------- contact ---------- */
function renderContactInfo(){
  const box = document.getElementById('contactInfo');
  clear(box);
  box.append(
    el('div', { class: 'ci-row' }, el('b', {}, t('contact.addr')), el('span', {}, SITE.address)),
    el('div', { class: 'ci-row' }, el('b', {}, 'E-poçt'), el('a', { href: 'mailto:' + SITE.email }, SITE.email)),
    el('div', { class: 'ci-row' }, el('b', {}, t('contact.hours')), el('span', {}, SITE.hours)),
    el('a', { class: 'btn-mini dismiss', href: SITE.mapsURL, target: '_blank', rel: 'noopener noreferrer' }, '📍 ' + t('contact.map')),
  );
}

/* ---------- footer ---------- */
function renderFooterStatic(){
  document.getElementById('pfYear').textContent = new Date().getFullYear();
  // Ana#12 — sosial ikonlar SITE.social-dan konfiqurativ (Discord/GitHub/LinkedIn).
  // Linklər dərhal qurulur (klik edilə bilən), loqolar gələndə mətn-nişanı əvəz edir.
  const soc = document.getElementById('pfSocial');
  clear(soc);
  // ⚠ `SITE.social` BOŞ ola bilər (AUDIT-TASK-2 / 2.3 — mövcud olmayan
  // profillər silindi). `[].map()` özü təhlükəsizdir, lakin boş konteyner
  // footer-də mənasız boşluq yaradır → gizlədilir. `Array.isArray` qoruması
  // sahə səhvən obyekt/undefined-a çevrilsə render-in çökməsini də bağlayır.
  const socialList = Array.isArray(SITE.social) ? SITE.social : [];
  soc.hidden = socialList.length === 0;
  const anchors = socialList.map(s => {
    const a = el('a', {
      class: 'pf-soc-ic soc-' + s.id,
      href: s.url, target: '_blank', rel: 'noopener noreferrer',
      'aria-label': s.label, title: s.label,
    }, el('span', { class: 'pf-soc-mark' }, s.mark || s.label.slice(0, 2)));
    soc.append(a);
    return a;
  });
  if(socialList.length) techMod().then(({ socialIcon }) => {
    socialList.forEach((s, i) => {
      if(!s.icon || !anchors[i].isConnected) return;
      clear(anchors[i]);
      anchors[i].append(socialIcon(s.icon, s.mark));
    });
  });
  const pc = document.getElementById('pfContact');
  clear(pc);
  pc.append(
    el('span', {}, SITE.address),
    el('a', { href: 'mailto:' + SITE.email }, SITE.email),
    el('span', {}, SITE.hours),
    el('a', { href: SITE.mapsURL, target: '_blank', rel: 'noopener noreferrer' }, '📍 Google Maps'),
  );
}

/* ================= init ================= */
export function initPublic(){
  initI18n();
  renderFooterStatic();

  // dil seçici
  const sw = document.getElementById('langSwitch');
  const syncLangBtns = () => sw.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.lang === getLang()));
  sw.addEventListener('click', e => {
    const b = e.target.closest('button[data-lang]');
    if(!b) return;
    setLang(b.dataset.lang);
    syncLangBtns();
  });
  syncLangBtns();
  document.addEventListener('lang-changed', () => {
    renderFooterStatic();
    renderPage(currentPub); // dinamik hissələr yeni dildə
  });

  // nav linkləri (header + mobil + footer)
  //
  // ⚠ Bu `<a>`-ların indi REAL `href`-i var (`PUB_PATHS`). Səbəb ölçülüb:
  //   href-siz `<a>` nə crawl olunur (PageSpeed SEO: "Links are not crawlable"),
  //   nə də klaviatura ilə fokuslana bilir — yəni həm SEO, həm a11y qüsuru idi.
  //   href SPA-nı əvəz etmir, onu YEDƏKLƏYİR: JS işləməsə də səhifə açılır.
  document.querySelectorAll('[data-pub]').forEach(a => {
    a.addEventListener('click', /** @param {MouseEvent} e */ e => {
      // Modifikatorlu klik (Ctrl/Cmd/Shift/orta düymə) brauzerin öz işidir —
      // "yeni tabda aç" gözləntisini sındırmırıq.
      if(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      emit('pub-nav', { page: a.dataset.pub });
    });
  });
  document.getElementById('pubLogo').addEventListener('click', () => emit('pub-nav', { page: 'welcome' }));
  document.getElementById('burgerBtn').addEventListener('click', () => {
    document.getElementById('mobileMenu').classList.toggle('open');
  });
  document.getElementById('pubThemeBtn').addEventListener('click', toggleTheme);

  // CTA-lar
  const openAuth = tab => emit('open-auth', { tab });
  ['pubLoginBtn', 'pubLoginBtnM'].forEach(id => document.getElementById(id).addEventListener('click', () => openAuth('login')));
  ['pubRegBtn', 'pubRegBtnM', 'heroRegBtn', 'sbJoinBtn', 'faqRegBtn'].forEach(id => document.getElementById(id).addEventListener('click', () => openAuth('reg')));
  document.getElementById('pubAppBtn').addEventListener('click', () => emit('nav', { page: 'home' }));
  document.getElementById('heroHowBtn').addEventListener('click', () => {
    document.getElementById('howAnchor').scrollIntoView({ behavior: 'smooth' });
  });

  // Ana#6 — sticky header: threshold-dan sonra güclü blur + yarımşəffaf fon + kölgə.
  // rAF ilə throttle (scroll hadisəsi hər frame-dən çox işə düşməsin).
  const hdr = document.getElementById('pubHeader');
  let hdrTick = false;
  window.addEventListener('scroll', () => {
    if(hdrTick) return;
    hdrTick = true;
    requestAnimationFrame(() => {
      hdr.classList.toggle('scrolled', window.scrollY > 24);
      hdrTick = false;
    });
  }, { passive: true });

  // Ana#13 — cookie razılıq banneri (qərar verilməyibsə görünür).
  initCookieBanner();

  // public axtarış → FAQ
  const search = document.getElementById('pubSearch');
  search.addEventListener('keydown', async e => {
    if(e.key !== 'Enter') return;
    const qv = search.value.trim();
    showPublicPage('faq');
    await renderFaqPage(qv);
    renderFaqList();
  });
  document.getElementById('faqSearch').addEventListener('input', debounce(renderFaqList, 200));

  // contact form
  document.getElementById('contactForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('cfName').value.trim();
    const email = document.getElementById('cfEmail').value.trim();
    const message = document.getElementById('cfMsg').value.trim();
    if(!name || !email || !message) return;
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try{
      await sendContactMessage({ name, email, message });
      e.target.reset();
      toast(t('contact.ok'));
    }catch(ex){ console.error(ex); toast(t('contact.err'), 'err'); }
    btn.disabled = false;
  });

  // newsletter
  document.getElementById('newsletterForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('newsEmail').value.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast(t('ft.newsErr'), 'err'); return; }
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try{
      await subscribeNewsletter(email, getLang());
      e.target.reset();
      toast(t('ft.newsOk'));
    }catch(ex){ toast(t('ft.newsErr'), 'err'); }
    btn.disabled = false;
  });

  // SXO: Scroll progress bar
  window.addEventListener('scroll', () => {
    const bar = document.getElementById('scrollProgress');
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const pct = h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0;
    bar.style.width = pct + '%';
    bar.setAttribute('aria-valuenow', Math.round(pct));
  }, { passive: true });

  // SXO: Back to top button
  const topBtn = document.getElementById('backToTopBtn');
  window.addEventListener('scroll', () => {
    topBtn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
  topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // SMO: Social share buttons
  document.getElementById('shareCopyBtn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(location.href).then(() => toast(t('a11y.copyLink')));
  });
  document.getElementById('shareTwitterBtn')?.addEventListener('click', () => {
    window.open(`https://x.com/intent/tweet?url=${encodeURIComponent(location.href)}&text=${encodeURIComponent(document.title)}`, '_blank');
  });
  document.getElementById('shareLinkedInBtn')?.addEventListener('click', () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(location.href)}`, '_blank');
  });
  document.getElementById('shareTelegramBtn')?.addEventListener('click', () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(location.href)}&text=${encodeURIComponent(document.title)}`, '_blank');
  });
  document.getElementById('shareFBBtn')?.addEventListener('click', () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.href)}`, '_blank');
  });
}

/* ================= SXO: Breadcrumb ================= */
const PAGE_LABELS = {
  welcome: 'nav.home', about: 'pg.about', faq: 'faq.title',
  privacy: 'pg.privacy', terms: 'pg.terms', contact: 'contact.title',
  security: 'pg.security', cookies: 'pg.cookies', changelog: 'pg.changelog',
};
function updateBreadcrumb(page){
  const crumb = document.getElementById('breadcrumbCurrent');
  const label = document.getElementById('breadcrumbLabel');
  if(page === 'welcome'){
    crumb.classList.add('hidden');
  } else {
    crumb.classList.remove('hidden');
    label.textContent = t(PAGE_LABELS[page] || page);
  }
}

/* ================= SMO: Dynamic Meta Tags ================= */
const PAGE_META = {
  welcome: {
    title: { az: 'Collabix — Proqramlaşdırma və Dil Öyrənmə Platforması', en: 'Collabix — Coding & Language Learning Platform', ru: 'Collabix — Платформа для изучения программирования' },
    desc:  { az: 'Birgə öyrən, kod paylaş, XP qazan.', en: 'Learn together, share code, earn XP.', ru: 'Учись вместе, делись кодом, зарабатывай XP.' },
  },
  about: {
    title: { az: 'Haqqımızda — Collabix', en: 'About Us — Collabix', ru: 'О нас — Collabix' },
    desc:  { az: 'Collabix icma platformasının hekayəsi, missiyası və komandası.', en: 'The story, mission and team behind Collabix.', ru: 'История, миссия и команда Collabix.' },
  },
  faq: {
    title: { az: 'FAQ — Tez-tez verilən suallar — Collabix', en: 'FAQ — Frequently Asked Questions — Collabix', ru: 'FAQ — Частые вопросы — Collabix' },
    desc:  { az: 'Collabix haqqında ən çox soruşulan suallar.', en: 'Most commonly asked questions about Collabix.', ru: 'Часто задаваемые вопросы о Collabix.' },
  },
  contact: {
    title: { az: 'Əlaqə — Collabix', en: 'Contact — Collabix', ru: 'Контакты — Collabix' },
    desc:  { az: 'Bizimlə əlaqə saxlayın.', en: 'Get in touch with us.', ru: 'Свяжитесь с нами.' },
  },
  privacy: {
    title: { az: 'Məxfilik siyasəti — Collabix', en: 'Privacy Policy — Collabix', ru: 'Политика конфиденциальности — Collabix' },
    desc:  { az: 'Məlumatlarınızın necə qorunduğu.', en: 'How your data is protected.', ru: 'Как защищены ваши данные.' },
  },
  terms: {
    title: { az: 'İstifadə şərtləri — Collabix', en: 'Terms & Conditions — Collabix', ru: 'Условия использования — Collabix' },
    desc:  { az: 'Platformanın istifadə qaydaları.', en: 'Platform usage rules.', ru: 'Правила использования платформы.' },
  },
  security: {
    title: { az: 'Təhlükəsizlik — Collabix', en: 'Security — Collabix', ru: 'Безопасность — Collabix' },
    desc:  { az: 'Təhlükəsizlik siyasəti və məlumat qoruması.', en: 'Security policy and data protection.', ru: 'Политика безопасности и защита данных.' },
  },
  cookies: {
    title: { az: 'Cookie siyasəti — Collabix', en: 'Cookie Policy — Collabix', ru: 'Cookies — Collabix' },
    desc:  { az: 'Cookie-lərin istifadəsi barədə.', en: 'How we use cookies.', ru: 'Как мы используем cookies.' },
  },
  changelog: {
    title: { az: 'Yenilik jurnalı — Collabix', en: 'Changelog — Collabix', ru: 'Изменения — Collabix' },
    desc:  { az: 'Platform yenilikləri və yol xəritəsi.', en: 'Platform updates and roadmap.', ru: 'Обновления и план развития.' },
  },
};

function updateDynamicMeta(page){
  const meta = PAGE_META[page] || PAGE_META.welcome;
  const lang = getLang();
  // Update page title
  document.title = tf(meta.title);
  // Update meta description
  const descEl = document.querySelector('meta[name="description"]');
  if(descEl) descEl.setAttribute('content', tf(meta.desc));
  // Update OpenGraph
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if(ogTitle) ogTitle.setAttribute('content', tf(meta.title));
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if(ogDesc) ogDesc.setAttribute('content', tf(meta.desc));
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if(ogUrl) ogUrl.setAttribute('content', location.href);
  // Update Twitter Card
  const twTitle = document.querySelector('meta[name="twitter:title"]');
  if(twTitle) twTitle.setAttribute('content', tf(meta.title));
  const twDesc = document.querySelector('meta[name="twitter:description"]');
  if(twDesc) twDesc.setAttribute('content', tf(meta.desc));
  // Update breadcrumb JSON-LD
  const bcSchema = document.getElementById('breadcrumbSchema');
  if(bcSchema && page !== 'welcome'){
    try{
      bcSchema.textContent = JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: location.origin + '/' },
          { '@type': 'ListItem', position: 2, name: tf(meta.title).replace(' — Collabix', '') },
        ],
      });
    }catch(e){}
  }
}

function updateSocialSharePanel(page){
  const panel = document.getElementById('socialSharePanel');
  if(panel) panel.classList.toggle('hidden', page === 'welcome');
}

/* ================= GEO/AEO: FAQ JSON-LD Schema ================= */
export function updateFaqSchema(faqItems){
  const schema = document.getElementById('faqSchema');
  if(!schema || !faqItems?.length) return;
  try{
    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': faqItems.slice(0, 20).map(f => ({
        '@type': 'Question',
        'name': tf(f.q),
        'acceptedAnswer': { '@type': 'Answer', 'text': tf(f.a) },
      })),
    });
  }catch(e){ console.error('FAQ schema error', e); }
}
