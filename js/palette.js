// Command palette (TASK-6 / İstifadəçilər#4) — Ctrl/Cmd+K.
// Tam klaviatura ilə idarə olunur: ↑/↓ hərəkət, ↵ aç, Esc bağla.
// Accessible: role=dialog + aria-modal, fokus tələsi, bağlananda fokus geri qayıdır.
import { el, clear, avatarNode, nameWithBadge, debounce, emit, bus } from './util.js';
import { api } from './api.js';
import { state } from './store.js';
import { t } from './i18n.js';

// Naviqasiya hədəfləri — nav-item-lərlə eyni dəst.
const PAGES = [
  ['home', 'nav.feed'], ['chat', 'nav.rooms'], ['dm', 'nav.dm'],
  ['notifs', 'nav.notifs'], ['users', 'nav.users'], ['tasks', 'nav.tasks'],
  ['stats', 'nav.stats'], ['saved', 'nav.saved'], ['profil', 'nav.profile'],
  ['settings', 'nav.settings'],
];

let open = false;
let items = [];      // [{type,label,sub,run,user}]
let active = 0;
let lastFocus = null;

const $bg = () => document.getElementById('paletteBg');
const $input = () => document.getElementById('paletteInput');
const $list = () => document.getElementById('paletteList');

function buildItems(q){
  const query = q.trim().toLowerCase();
  const out = [];

  // Səhifələr — sorğu boşdursa da göstərilir (sürətli naviqasiya).
  PAGES.forEach(([page, key]) => {
    if(page === 'admin' && !state.isAdmin) return;
    const label = t(key);
    if(query && !label.toLowerCase().includes(query) && !page.includes(query)) return;
    out.push({ type: 'page', label, sub: t('pal.pages'), run: () => emit('nav', { page }) });
  });

  // İstifadəçilər — yalnız sorğu varsa (boş palitrada 500 sətir göstərməyək).
  // Mənbə qlobal keşdir (state.users) — palitra ani olmalıdır, şəbəkə gözlətməsin.
  if(query){
    [...state.users.values()]
      .filter(u => u.uid !== state.authUser?.uid && !u.blocked)
      .filter(u => (u.name || '').toLowerCase().includes(query)
                || (u.username || '').toLowerCase().includes(query))
      .slice(0, 8)
      .forEach(u => out.push({
        type: 'user', user: u,
        label: u.name || u.username, sub: '@' + u.username,
        run: () => emit('nav', { page: 'u/' + u.username }),
      }));
  }
  return out.slice(0, 20);
}

/* ---------- qlobal FTS5 axtarışı (TASK-8 / Bənd 11) ----------
   Lokal keş (yuxarıda) YALNIZ istifadəçi adlarını və səhifələri tutur.
   Post/rəy məzmunu client-də yoxdur və ola da bilməz — ona görə server
   FTS5 indeksindən çəkilir.

   İki qatlı render QƏSDƏNDİR: lokal nəticələr ANİ görünür (şəbəkə gözlətmir),
   server nəticələri gələndə siyahıya əlavə olunur. Tək qat olsaydı hər hərfdə
   palitra boş qalıb "donmuş" görünərdi. */
let remoteItems = [];
let remoteQuery = '';
let remoteSeq = 0;   // yarış qoruması: gec gələn köhnə cavab yenisini əvəz etməsin

const fetchRemote = debounce(async q => {
  const query = q.trim();
  if(query.length < 2){ remoteItems = []; remoteQuery = ''; render(); return; }
  const seq = ++remoteSeq;
  let d;
  try{
    d = await api('/search?q=' + encodeURIComponent(query));
  }catch(e){
    return;   // axtarış köməkçi funksiyadır — sınsa lokal nəticələr qalır
  }
  // Palitra bağlanıbsa və ya daha yeni sorğu getdisə cavabı at.
  if(seq !== remoteSeq || !open) return;

  const out = [];
  // Serverdən gələn istifadəçilər lokal keşdə OLMAYANLARDIR — dublikat
  // göstərməmək üçün süzülür.
  const localUsernames = new Set(items.filter(i => i.type === 'user').map(i => i.user.username));
  d.users.forEach(u => {
    if(localUsernames.has(u.username)) return;
    out.push({
      type: 'user', user: { uid: u.uid, username: u.username, name: u.name, photoURL: u.photoURL },
      label: u.name || u.username, sub: '@' + u.username,
      run: () => emit('nav', { page: 'u/' + u.username }),
    });
  });
  d.posts.forEach(p => out.push({
    type: 'post', snippet: p.snippet,
    label: p.authorName, sub: t('pal.posts'),
    run: () => emit('nav', { page: 'post/' + p.id }),
  }));
  d.comments.forEach(cm => out.push({
    type: 'comment', snippet: cm.snippet,
    label: cm.authorName, sub: t('pal.comments'),
    run: () => emit('nav', { page: 'post/' + cm.postId }),
  }));

  remoteItems = out.slice(0, 12);
  remoteQuery = query;
  render();
}, 220);

// Snippet serverdən <mark> teqləri ilə gəlir. innerHTML İSTİFADƏ OLUNMUR —
// post mətni istifadəçi məzmunudur. Teqlər əl ilə parse olunub DOM node-larına
// çevrilir, yəni <script> və ya <img onerror> heç vaxt icra olunmur.
function snippetNode(s){
  const wrap = el('span', { class: 'pal-snip' });
  String(s || '').split(/(<mark>.*?<\/mark>)/g).forEach(part => {
    if(!part) return;
    const m = part.match(/^<mark>(.*?)<\/mark>$/);
    wrap.append(m ? el('mark', {}, m[1]) : document.createTextNode(part));
  });
  return wrap;
}

// Lokal (ani) + uzaq (FTS) nəticələr tək siyahıda. `active` indeksi məhz bu
// birləşmiş siyahıya aiddir — klaviatura naviqasiyası hər ikisini gəzir.
const allItems = () => items.concat(remoteItems);

function render(){
  const list = $list();
  clear(list);
  const rows = allItems();
  if(!rows.length){
    list.append(el('li', { class: 'pal-empty' }, t('pal.empty')));
    return;
  }
  rows.forEach((it, i) => {
    const row = el('li', {
      class: 'pal-item' + (i === active ? ' active' : ''),
      role: 'option',
      id: 'pal-opt-' + i,
      'aria-selected': String(i === active),
      onclick: () => choose(i),
      onmousemove: () => { if(active !== i){ active = i; render(); } },
    },
      it.type === 'user'
        ? avatarNode(it.user, 'avatar sm')
        : el('span', { class: 'pal-ic' }, it.type === 'post' ? '▤' : it.type === 'comment' ? '💬' : '⌘'),
      el('span', { class: 'pal-lbl' },
        it.type === 'user' ? nameWithBadge(it.user) : it.label,
        // Post/rəy sətrində uyğun gələn mətn parçası göstərilir — istifadəçi
        // nəticəni açmadan niyə tapıldığını görsün.
        it.snippet ? snippetNode(it.snippet) : null),
      el('span', { class: 'pal-sub' }, it.sub),
    );
    list.append(row);
  });
  $input().setAttribute('aria-activedescendant', rows.length ? 'pal-opt-' + active : '');
  // Seçilmiş sətir görünüş sahəsində qalsın.
  list.querySelector('.pal-item.active')?.scrollIntoView({ block: 'nearest' });
}

function choose(i){
  const it = allItems()[i];
  if(!it) return;
  closePalette();
  it.run();
}

const refresh = () => {
  const q = $input().value;
  items = buildItems(q);
  // Sorğu dəyişdi → köhnə server nəticələri artıq aid deyil, dərhal təmizlənir.
  // Əks halda yeni hərf yazılanda bir anlıq uyğunsuz sətirlər görünərdi.
  if(q.trim() !== remoteQuery){ remoteItems = []; }
  active = 0;
  render();
  fetchRemote(q);
};

export function openPalette(){
  if(open) return;
  if(!state.authUser) return;           // yalnız daxil olmuş istifadəçi üçün
  open = true;
  lastFocus = document.activeElement;
  const bg = $bg();
  bg.hidden = false;
  requestAnimationFrame(() => bg.classList.add('in'));
  const inp = $input();
  inp.value = '';
  refresh();
  inp.focus();
}

export function closePalette(){
  if(!open) return;
  open = false;
  const bg = $bg();
  bg.classList.remove('in');
  bg.hidden = true;
  // Fokus palitradan əvvəlki elementə qayıdır (klaviatura istifadəçisi itməsin).
  if(lastFocus && document.contains(lastFocus)) lastFocus.focus();
  lastFocus = null;
  // Server nəticələri sıfırlanır — palitra növbəti dəfə açılanda köhnə
  // sorğunun nəticələri bir anlıq görünməsin.
  remoteItems = []; remoteQuery = '';
}

export function initPalette(){
  const bg = $bg();
  const inp = $input();

  // Qlobal qısayol: Ctrl+K / Cmd+K.
  document.addEventListener('keydown', e => {
    if((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')){
      e.preventDefault();
      open ? closePalette() : openPalette();
      return;
    }
    if(e.key === 'Escape' && open){ e.preventDefault(); closePalette(); }
  });

  inp.addEventListener('input', debounce(refresh, 120));

  inp.addEventListener('keydown', e => {
    if(e.key === 'ArrowDown'){ e.preventDefault(); active = (active + 1) % (allItems().length || 1); render(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); active = (active - 1 + (allItems().length || 1)) % (allItems().length || 1); render(); }
    else if(e.key === 'Enter'){ e.preventDefault(); choose(active); }
    else if(e.key === 'Home'){ e.preventDefault(); active = 0; render(); }
    else if(e.key === 'End'){ e.preventDefault(); active = Math.max(0, allItems().length - 1); render(); }
  });

  // Fokus tələsi: palitra açıqkən Tab ondan kənara çıxmasın.
  // Yalnız bir fokuslanan element var (input), ona görə Tab söndürülür.
  bg.addEventListener('keydown', e => {
    if(e.key === 'Tab'){ e.preventDefault(); inp.focus(); }
  });

  // Fon klikində bağla (kartın özünə klik saymır).
  bg.addEventListener('click', e => { if(e.target === bg) closePalette(); });

  // Səhifə dəyişəndə palitra açıq qalmasın.
  bus.addEventListener('nav', () => closePalette());
}
