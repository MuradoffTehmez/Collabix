/* chat-message.js — Mesaj render qatı (balon · qruplaşdırma · əməliyyatlar ·
 * reaksiyalar · thread). Otaq çatı və DM ORTAQ işlədir.
 *
 * ⚠ NİYƏ AYRICA MODUL: `richmsg.js` mesajın MƏZMUNUNU (mətn/şəkil/fayl/kod)
 *   render edir və o, `feed.js`-dən də istifadə olunur. Bu modul isə mesajın
 *   ÇƏRÇİVƏSİNİ qurur (balon, alət paneli, reaksiya sətri, cavab sitatı).
 *   İkisini qarışdırsaq feed lazımsız çat kodunu bundle-a dartardı.
 *
 * ⚠ MODUL DÖVRÜ YOXDUR: `chat.js`/`dm.js` bura İMPORT OLUNMUR — davranış
 *   `ctx` obyekti ilə callback kimi ötürülür.
 */
import { el, clear, avatarNode, nameWithBadge, fmtTime } from './util.js';
import { t, fmtRelTime, getLang } from './i18n.js';
import { richContent } from './richmsg.js';
import { paintIcons } from './icons.js';
import { state } from './store.js';

/* ══ 1. REAKSİYALAR ═══════════════════════════════════════════════════════
 * Tiplər SERVERDƏKİ `CHECK` siyahısı ilə eyni olmalıdır (miqrasiya 0047).
 * Emoji burada MƏZMUNDUR (istifadəçi reaksiyası), interfeys ikonu deyil —
 * ona görə `no-emoji-icons` qaydası bura aid deyil. */
export const REACTIONS = [
  { type: 'like', ch: '👍' },
  { type: 'love', ch: '❤️' },
  { type: 'laugh', ch: '😂' },
  { type: 'wow', ch: '😮' },
  { type: 'fire', ch: '🔥' },
  { type: 'clap', ch: '👏' },
  { type: 'party', ch: '🎉' },
  { type: 'rocket', ch: '🚀' },
];
const REACTION_CH = Object.fromEntries(REACTIONS.map(r => [r.type, r.ch]));

/* ══ 2. DƏYİŞİKLİK İMZASI ═════════════════════════════════════════════════
 * Artımlı render üçün: mesaj node-u YALNIZ imzası dəyişəndə yenidən qurulur.
 * ⚠ `reactions` massivi hər cavabda YENİ obyektdir, ona görə referens
 *   müqayisəsi işləməz — dəyər əsaslı sətir imzası lazımdır. */
function signature(m){
  const rx = (m.reactions || []).map(r => `${r.type}:${r.count}:${r.mine ? 1 : 0}`).join(',');
  /* ⚠ DİL DƏ İMZADADIR. Mesaj node-unun içində TƏRCÜMƏ OLUNMUŞ mətnlər var
   * ("Daha çox oxu", alət panelinin `aria-label`-ları, "Sabitləyib: …").
   * Dil dəyişəndə məzmun eyni qaldığı üçün imza dəyişmirdi və keşlənmiş
   * node-lar KÖHNƏ DİLDƏ qalırdı — interfeys ingiliscə, düymələr rusca
   * görünürdü (ekranda müşahidə edildi). Dili imzaya qatmaq bütün mesajları
   * bir dəfə yenidən qurur və problem öz-özünə həll olunur. */
  return [getLang(), m.id, m.text || '', m.editedAt || '', m.pinnedAt || '', m.bookmarked ? 1 : 0,
    m.fileUrl || '', m.replyTo || '', rx].join('|');
}

/* ══ 3. AÇILAN PANELLƏRİN YERLƏŞDİRİLMƏSİ ════════════════════════════════
 *
 * 🔴 NİYƏ `position: fixed` VƏ JS İLƏ HESABLAMA:
 *    Pop-lar əvvəl `position: absolute` idi və mesaj balonuna nisbətən
 *    yerləşirdi. İki qüsur verdi (istifadəçi bildirdi):
 *      1) `.chat-messages` sürüşmə konteyneridir (`overflow: auto`) — o,
 *         hüdudundan kənara çıxan hər şeyi KƏSİR. Öz mesajlarında alət
 *         paneli balonun SOL kənarındadır, `right: 0` ilə lövbərlənən 273px-lik
 *         reaksiya seçicisi sola açılıb konteynerdən çıxırdı və GÖRÜNMÜRDÜ.
 *      2) Siyahının yuxarı/aşağı kənarındakı mesajlarda pop yuxarı/aşağı
 *         daşıb yenə kəsilirdi.
 *    `fixed` pop-u sürüşmə konteynerindən TAMAMİLƏ çıxarır; koordinatlar
 *    açılış anında hesablanır və ekran hüdudlarına SIXILIR (clamp).
 *
 * ⚠ Sürüşəndə pop BAĞLANIR: `fixed` element səhifə ilə birlikdə sürüşmür,
 *   ona görə açıq qalsaydı lövbərindən "qopardı". Bağlamaq yenidən
 *   hesablamaqdan sadə və gözləniləndir (Slack/Discord da belə edir).
 */
const VIEWPORT_PAD = 8;

function placeFixed(pop, anchor, { prefer = 'top' } = {}){
  // Ölçmək üçün əvvəlcə görünən olmalıdır, amma titrəməsin deyə şəffaf.
  pop.style.visibility = 'hidden';
  pop.style.position = 'fixed';
  pop.style.left = '0px';
  pop.style.top = '0px';
  pop.hidden = false;

  const a = anchor.getBoundingClientRect();
  const p = pop.getBoundingClientRect();

  // Üfüqi: lövbərin mərkəzinə görə, sonra ekrana sıxılır.
  let left = a.left + a.width / 2 - p.width / 2;
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - p.width - VIEWPORT_PAD));

  // Şaquli: üstdə yer yoxdursa ALTA çevrilir (flip).
  let top = prefer === 'top' ? a.top - p.height - 6 : a.bottom + 6;
  if(top < VIEWPORT_PAD) top = a.bottom + 6;
  if(top + p.height > window.innerHeight - VIEWPORT_PAD) top = a.top - p.height - 6;
  top = Math.max(VIEWPORT_PAD, top);

  pop.style.left = Math.round(left) + 'px';
  pop.style.top = Math.round(top) + 'px';
  pop.style.visibility = '';
}

/** Açıq pop-u bağlayır və mesajın "açıq" vəziyyətini sıfırlayır. */
function closePop(pop, btn){
  pop.hidden = true;
  btn.setAttribute('aria-expanded', 'false');
  btn.closest('.msg')?.classList.remove('actions-open');
}

/** Bütün açıq pop-ları bağlayır. */
function closeAllPops(){
  document.querySelectorAll('.mx-react-pop, .mx-menu').forEach(p => { p.hidden = true; });
  document.querySelectorAll('.mx-btn[aria-expanded="true"], .ch-icon-btn[aria-expanded="true"]')
    .forEach(b => b.setAttribute('aria-expanded', 'false'));
  document.querySelectorAll('.msg.actions-open').forEach(m => m.classList.remove('actions-open'));
}

/**
 * Pop-u açır/bağlayır: yerləşdirmə, digərlərinin bağlanması və
 * "alət paneli görünən qalsın" vəziyyəti bir yerdə.
 */
function togglePop(pop, btn, prefer){
  const willOpen = pop.hidden;
  closeAllPops();
  if(!willOpen) return;
  placeFixed(pop, btn, { prefer });
  btn.setAttribute('aria-expanded', 'true');
  /* 🔴 "TEZ İTİR" QÜSURUNUN DÜZƏLİŞİ: panel yalnız `:hover`/`:focus-within`
   *    ilə görünürdü, ona görə siçan balondan çıxan kimi — hətta pop AÇIQ
   *    olanda belə — panel yox olurdu. Bu sinif onu açıq saxlayır. */
  btn.closest('.msg')?.classList.add('actions-open');
}

/* ══ 4. ƏMƏLİYYAT PANELİ ══════════════════════════════════════════════════ */
const actionBtn = (icon, label, onclick, extra = {}) =>
  el('button', {
    type: 'button', class: 'mx-btn', title: label, 'aria-label': label, onclick, ...extra,
  }, el('span', { class: 'ic', 'data-icon': icon, 'data-icon-size': '15' }));

function reactionPicker(m, ctx, close){
  const box = el('div', { class: 'mx-react-pop', role: 'menu', 'aria-label': t('msg.react') });
  REACTIONS.forEach(r => {
    const mine = (m.reactions || []).some(x => x.type === r.type && x.mine);
    box.append(el('button', {
      type: 'button', role: 'menuitem', class: 'mx-react-opt' + (mine ? ' on' : ''),
      'aria-label': t('react.' + r.type), title: t('react.' + r.type),
      'aria-pressed': String(mine),
      onclick: () => { ctx.onReact?.(m, r.type, !mine); close(); },
    }, r.ch));
  });
  return box;
}

/**
 * Hover/fokus alət paneli.
 * ⚠ `opacity` ilə gizlədilir, `display:none` ilə YOX — əks halda düymələr
 *   klaviatura ilə fokuslana bilməz və `:focus-within` işləməz.
 */
function actionBar(m, ctx){
  const bar = el('div', { class: 'msg-actions', role: 'toolbar', 'aria-label': t('msg.actions') });
  const mine = ctx.isMine(m);

  /* ── Reaksiya (açılan seçici) ── */
  const reactWrap = el('div', { class: 'mx-pop-wrap' });
  const reactBtn = actionBtn('smile', t('msg.react'), e => {
    e.stopPropagation();
    togglePop(pop, reactBtn, 'top');
  }, { 'aria-expanded': 'false', 'aria-haspopup': 'true' });
  const pop = reactionPicker(m, ctx, () => closePop(pop, reactBtn));
  pop.hidden = true;
  reactWrap.append(reactBtn, pop);
  bar.append(reactWrap);

  bar.append(actionBtn('message', t('msg.reply'), () => ctx.onReply?.(m)));
  bar.append(actionBtn('copy', t('msg.copy'), async () => {
    try{ await navigator.clipboard.writeText(m.text || ''); ctx.toast?.(t('dyn.copied')); }
    catch(e){ ctx.toast?.(t('dyn.copy_fail'), 'err'); }
  }));

  /* ── "Daha çox" menyusu ── */
  const moreWrap = el('div', { class: 'mx-pop-wrap' });
  const menu = el('div', { class: 'mx-menu', role: 'menu', hidden: true });
  const moreBtn = actionBtn('more', t('a11y.more'), e => {
    e.stopPropagation();
    // Menyu ALTA üstünlük verir — o, siyahıda adətən aşağı açılır.
    togglePop(menu, moreBtn, 'bottom');
  }, { 'aria-expanded': 'false', 'aria-haspopup': 'true' });
  const closeMenu = () => closePop(menu, moreBtn);
  const item = (icon, label, fn, cls = '') => el('button', {
    type: 'button', role: 'menuitem', class: 'mx-menu-item' + (cls ? ' ' + cls : ''),
    onclick: () => { closeMenu(); fn(); },
  }, el('span', { class: 'ic', 'data-icon': icon, 'data-icon-size': '14' }), el('span', {}, label));

  menu.append(item('link', t('msg.copy_link'), () => ctx.onCopyLink?.(m)));
  menu.append(item('send', t('msg.forward'), () => ctx.onForward?.(m)));
  menu.append(item('bookmark', m.bookmarked ? t('msg.unbookmark') : t('msg.bookmark'),
    () => ctx.onBookmark?.(m, !m.bookmarked)));
  // Sabitləmə OTAQDA yalnız admin üçündür — server də eyni qaydanı tətbiq edir.
  if(ctx.canPin) menu.append(item('pin', m.pinnedAt ? t('chat.unpin') : t('chat.pin'),
    () => ctx.onPin?.(m, !m.pinnedAt)));
  if(mine && (!m.type || m.type === 'text')) menu.append(item('edit', t('a11y.edit'), () => ctx.onEdit?.(m)));
  if(mine || ctx.isAdmin) menu.append(item('trash', t('a11y.delete'), () => ctx.onDelete?.(m), 'danger'));

  moreWrap.append(moreBtn, menu);
  bar.append(moreWrap);
  paintIcons(bar);
  return bar;
}

/* ══ 4. REAKSİYA SƏTRİ (balonun altında) ══════════════════════════════════ */
function reactionRow(m, ctx){
  const list = (m.reactions || []).filter(r => r.count > 0);
  if(!list.length) return null;
  const row = el('div', { class: 'msg-reacts' });
  list.forEach(r => {
    row.append(el('button', {
      type: 'button',
      class: 'msg-react' + (r.mine ? ' mine' : ''),
      'aria-pressed': String(!!r.mine),
      // Əlçatan ad SAYI da bildirir — yalnız emoji oxunsa məlumat itir.
      'aria-label': `${t('react.' + r.type)} — ${r.count}`,
      title: t('react.' + r.type),
      onclick: () => ctx.onReact?.(m, r.type, !r.mine),
    }, el('span', { class: 'rc' }, REACTION_CH[r.type] || '•'), el('span', { class: 'rn' }, String(r.count))));
  });
  return row;
}

/* ══ 5. SABİTLƏNMİŞ GÖSTƏRİCİSİ ═══════════════════════════════════════════
 *
 * Əvvəl sabitlənmiş mesaj YALNIZ balonun sol kənarındakı 3px zolaqla
 * bildirilirdi: nə nişan, nə kim/nə vaxt məlumatı, nə də ekran oxuyucusu üçün
 * ad var idi — istifadəçi zolağın nə demək olduğunu bilmirdi.
 *
 * İndi kompakt "pill" nişanıdır: normal halda yalnız ikon, hover/fokusda isə
 * genişlənib "Sabitlənib · {kim}" mətnini açır.
 * ⚠ GENİŞLƏNMƏ `max-width` ilədir, `display` ilə YOX: `display` dəyişikliyi
 *   animasiya olunmur və nişan sıçrayışla peyda olardı.
 * ⚠ `tabindex="0"` — məlumat yalnız siçanla əlçatan olmamalıdır; klaviatura
 *   ilə fokuslananda da eyni mətn açılır (`:focus-visible`).
 */
function pinBadge(m){
  const who = state.users.get(m.pinnedBy)?.name || '';
  const label = who
    ? t('chat.pinned_by').replace('{who}', who)
    : t('chat.pinned_one');
  return el('span', {
    class: 'msg-pin', tabIndex: 0, role: 'note', 'aria-label': label, title: label,
  },
    el('span', { class: 'ic', 'data-icon': 'pin', 'data-icon-size': '11' }),
    el('span', { class: 'msg-pin-txt' }, label),
  );
}

/* ══ 6. CAVAB SİTATI ══════════════════════════════════════════════════════ */
function replyQuote(m, ctx){
  if(!m.replyTo) return null;
  const src = ctx.byId?.get(m.replyTo);
  /* ⚠ Valideyn TAPILMAYA BİLƏR: arxivləmə köhnə mesajları D1-dən silir
   *   (bax miqrasiya 0047 şərhi) və ya mesaj silinib. Bu, XƏTA DEYİL —
   *   istifadəçiyə səbəb açıq deyilir. */
  if(!src){
    return el('div', { class: 'msg-reply gone' },
      el('span', { class: 'ic', 'data-icon': 'message', 'data-icon-size': '12' }),
      el('span', {}, t('msg.reply_gone')));
  }
  const who = ctx.nameOf(src) || '';
  return el('button', {
    type: 'button', class: 'msg-reply',
    'aria-label': t('msg.jump_to_reply').replace('{who}', who),
    onclick: () => ctx.onJump?.(src.id),
  },
    el('span', { class: 'rq-who' }, who),
    el('span', { class: 'rq-txt' }, previewText(src)),
  );
}

/** Sitat/önbaxış üçün qısa mətn — tipdən asılı. */
export function previewText(m){
  if(!m) return '';
  if(m.type === 'image') return t('chat.prev_image');
  if(m.type === 'file') return t('chat.prev_file') + ' ' + (m.fileName || '');
  if(m.type === 'code') return t('chat.prev_code');
  return (m.text || '').slice(0, 140);
}

/* ══ 6. TƏK MESAJ ═════════════════════════════════════════════════════════ */
export function messageNode(m, ctx){
  const mine = ctx.isMine(m);
  const node = el('div', {
    class: 'msg ' + (mine ? 'out' : 'in')
      + (m.pinnedAt ? ' pinned' : '')
      + (m.bookmarked ? ' bookmarked' : ''),
    dataset: { mid: m.id, sig: signature(m) },
  });

  if(m.pinnedAt) node.append(pinBadge(m));

  const q = replyQuote(m, ctx);
  if(q) node.append(q);

  /* ══ UZUN MESAJ — "daha çox oxu" ═══════════════════════════════════════
   * Uzun mətn bütün söhbəti aşağı itələyir və qonşu mesajlar görünməz olur.
   *
   * ⚠ QƏRAR ÖLÇMƏ İLƏ VERİLİR, simvol sayına görə YOX: eyni 500 simvol dar
   *   balonda 14 sətir, geniş ekranda 5 sətir tutur — sabit hədd birində
   *   lazımsız düymə çıxarar, digərində kəsməyi qaçırardı.
   * ⚠ Ucuz ilkin süzgəc (`CLAMP_MIN_CHARS`) qəsdən var: HƏR mesajı ölçmək
   *   yüzlərlə `scrollHeight` oxusu deməkdir və render-i ləngidərdi
   *   (layout thrashing). Qısa mesajlar ölçülmür.
   * ⚠ Kod və şəkil mesajları KƏSİLMİR: kod blokunun öz yığma düyməsi var,
   *   şəkil isə onsuz da sabit hündürlükdədir. */
  const body = el('div', { class: 'msg-body' }, richContent(m));
  node.append(body);

  const CLAMP_MIN_CHARS = 320;
  const clampable = (!m.type || m.type === 'text') && (m.text || '').length > CLAMP_MIN_CHARS;
  if(clampable){
    body.classList.add('clampable');
    requestAnimationFrame(() => {
      // Yalnız HƏQİQƏTƏN kəsilibsə düymə əlavə olunur.
      if(body.scrollHeight - body.clientHeight < 8){
        body.classList.remove('clampable');
        return;
      }
      const more = el('button', {
        type: 'button', class: 'msg-more', 'aria-expanded': 'false',
        onclick: () => {
          const open = body.classList.toggle('open');
          more.setAttribute('aria-expanded', String(open));
          more.textContent = open ? t('msg.show_less') : t('msg.show_more');
        },
      }, t('msg.show_more'));
      body.after(more);
    });
  }

  if(m.editedAt) node.append(el('span', { class: 'edited-mark' }, t('feed.edited')));

  // Vaxt balonun içində, aşağı sağda — Telegram/WhatsApp konvensiyası.
  node.append(el('span', { class: 'msg-time', title: fmtTime(m.createdAt) }, shortClock(m.createdAt)));

  const rr = reactionRow(m, ctx);
  if(rr) node.append(rr);

  node.append(actionBar(m, ctx));
  paintIcons(node);
  return node;
}

const shortClock = ms => {
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/* ══ 7. QRUPLAŞDIRMA + ARTIMLI RENDER ═════════════════════════════════════
 *
 * 🔴 NİYƏ ARTIMLI: əvvəlki `paint()` HƏR yeni mesajda `clear(box)` edib bütün
 *    siyahını yenidən qururdu. Nəticələr:
 *      • açıq alət menyusu / reaksiya seçicisi bağlanırdı;
 *      • klaviatura fokusu itirdi;
 *      • seçilmiş mətn silinirdi;
 *      • 500 mesajda hər yeniləmə yüzlərlə node yaradırdı.
 *    İndi node-lar `data-mid` üzrə KEŞLƏNİR və yalnız imzası dəyişən mesaj
 *    yenidən qurulur.
 *
 * ⚠ PƏNCƏRƏLƏMƏ (virtualizasiya): tam virtual siyahı dəyişkən hündürlüklü
 *   balonlarla sürüşmə mövqeyini pozur (şəkil yüklənəndə hündürlük dəyişir).
 *   Ona görə sadə və etibarlı yol seçilib: yalnız SON `WINDOW` mesaj DOM-da
 *   saxlanılır, daha köhnəsi onsuz da mövcud "Daha köhnə mesajlar" zolağı
 *   ilə səhifələnir. Bu, DOM node sayını sabit saxlayır.
 */
const MSG_GROUP_GAP = 5 * 60 * 1000;
const WINDOW = 200;

export function renderMessageList(box, msgs, ctx){
  // Keş `box`-un özündə yaşayır — otaq dəyişəndə `clear(box)` onu da atır.
  if(!box._mcache) box._mcache = new Map();
  const cache = box._mcache;

  const shown = msgs.length > WINDOW ? msgs.slice(-WINDOW) : msgs;
  ctx.byId = new Map(msgs.map(m => [m.id, m]));

  const frag = document.createDocumentFragment();
  const seen = new Set();

  let i = 0;
  while(i < shown.length){
    const first = shown[i];
    const gid = ctx.uidOf(first);
    const group = [first];
    let j = i + 1;
    while(j < shown.length
      && ctx.uidOf(shown[j]) === gid
      && shown[j].createdAt - group[group.length - 1].createdAt < MSG_GROUP_GAP){
      group.push(shown[j]); j++;
    }
    i = j;

    const mine = ctx.isMine(first);
    const user = ctx.userOf(first) || { name: ctx.nameOf(first) };
    const bubbles = group.map(m => {
      seen.add(m.id);
      const cached = cache.get(m.id);
      // İmza eynidirsə node TƏKRAR İSTİFADƏ olunur (yenidən qurulmur).
      if(cached && cached.dataset.sig === signature(m)) return cached;
      let node;
      try{ node = messageNode(m, ctx); }
      catch(e){ console.error('mesaj render xətası', m.id, e); return null; }
      cache.set(m.id, node);
      return node;
    }).filter(Boolean);

    frag.append(el('div', { class: 'msg-group ' + (mine ? 'out' : 'in') },
      // Avatar QRUPDA BİR DƏFƏ — ardıcıl mesajlarda təkrarlanmır.
      avatarNode(user, 'avatar mg-avatar'),
      el('div', { class: 'mg-body' },
        el('div', { class: 'mg-head' },
          el('button', {
            type: 'button', class: 'mg-name',
            onclick: () => ctx.onName?.(ctx.uidOf(first)),
          }, nameWithBadge(user)),
          el('span', { class: 'mg-time', title: fmtTime(first.createdAt) }, fmtRelTime(first.createdAt)),
        ),
        ...bubbles,
      ),
    ));
  }

  // Artıq görünməyən mesajların node-ları keşdən çıxarılır (yaddaş sızması yox).
  for(const id of [...cache.keys()]) if(!seen.has(id)) cache.delete(id);

  clear(box);
  box.append(frag);
  return shown.length < msgs.length ? msgs.length - shown.length : 0;
}

/** Bayıra klik / Escape / sürüşmə hər açıq mesaj pop-unu bağlayır. */
let popCloserBound = false;
export function bindMessagePopClosers(){
  if(popCloserBound) return;
  popCloserBound = true;
  document.addEventListener('click', closeAllPops);
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeAllPops(); });
  /* ⚠ SÜRÜŞMƏDƏ BAĞLANIR: pop `position: fixed`-dir, yəni siyahı ilə birlikdə
   *   sürüşmür və açıq qalsaydı lövbərindən qoparaq "havada" asılardı.
   *   `capture: true` — hadisə sürüşən DAXİLİ konteynerdən (`.chat-messages`)
   *   gəlir və `document`-ə qabarmır (scroll qabarmayan hadisədir). */
  document.addEventListener('scroll', closeAllPops, { capture: true, passive: true });
  window.addEventListener('resize', closeAllPops);
}
