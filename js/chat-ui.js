/* chat-ui.js — Mesaj/çat bölməsinin PAYLAŞILAN UI qatı.
 *
 * ⚠ NİYƏ AYRICA MODUL: otaq çatı (`chat.js`) və DM (`dm.js`) eyni qabığı
 *   (`.chat-wrap`) işlədir, amma indiyə qədər başlığı, siyahı sətrini və
 *   kompozitoru HƏR BİRİ AYRICA qururdu. Nəticədə düzəlişlər birində edilib
 *   digərində unudulurdu (audit bunu DM-də emoji ikonlar və çatışmayan
 *   `aria-label`-lar şəklində tapdı). İndi hər ikisi buradan gəlir.
 *
 * ⚠ MODUL DÖVRÜ YOXDUR: bu fayl `chat.js`/`dm.js`-i İMPORT ETMİR — onlar
 *   davranışı callback kimi ötürür (`opts`). Əks istiqamətli import dövr
 *   yaradardı (`icon-set.js`-in ayrılma səbəbi ilə eyni).
 */
import { el, clear, avatarNode, isOnline, lastSeenText, nameWithBadge, levelFromXP } from './util.js';
import { t } from './i18n.js';
import { toast } from './ui.js';
import { api } from './api.js';
import { paintIcons } from './icons.js';
import { state } from './store.js';
import { markdownNode } from './markdown.js';

/* ══ 1. VAXT FORMATI ══════════════════════════════════════════════════════
 * Söhbət siyahısında tam tarix çox yer tutur. Messenger konvensiyası:
 * bu gün → saat, bu həftə → gün adı, daha köhnə → gün.ay. */
export function shortTime(ms){
  if(!ms) return '';
  const d = new Date(ms);
  if(Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if(sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  // ⚠ `getTime()` açıq çağırılır: `now - d` JS-də işləsə də `checkJs` onu
  //   TS2362 kimi rədd edir (Date arifmetik operand deyil).
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if(diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

/* ══ 2. SÖHBƏT SİYAHISI SƏTRİ ═════════════════════════════════════════════
 * 🔴 `<button>`-dur, `<div onclick>` DEYİL. Əvvəlki `.ch-item` div idi:
 *    klaviatura ilə fokuslana bilmirdi, deməli söhbət seçmək YALNIZ siçanla
 *    mümkün idi (`keyboard-nav`, Severity: High). */
/* ⚠ Bütün seçimlərin DEFAULT dəyəri var: `checkJs` destrukturu MƏCBURİ
 *   sahələr kimi çıxarır, default isə onları opsional edir (əks halda hər
 *   çağırış nöqtəsi istifadə etmədiyi sahələri də yazmalı olardı). */
export function conversationRow({
  avatar, name, preview = '', time = '',
  // `number | boolean`: rəqəm = say, `true` = rəqəmsiz nöqtə (aşağıdakı izaha bax).
  badge = /** @type {number|boolean} */ (0),
  active = false, unread = false, typing = false, onSelect, ariaLabel = '',
  // Zənginləşdirmə: username sətri, status, sabitlənmiş/susdurulmuş göstəriciləri.
  username = '', status = '', online = false, pinned = false, muted = false,
}){
  const row = el('button', {
    type: 'button',
    class: 'ch-item' + (active ? ' active' : '') + (unread ? ' unread-row' : ''),
    // Siyahı seçim vasitəsidir → hansı sətrin seçili olduğu elan olunmalıdır.
    'aria-current': active ? 'true' : 'false',
    'aria-label': ariaLabel || name,
    onclick: onSelect,
  });

  /* Ad sətri: ad + (sabitlənmiş/susdurulmuş ikonları).
   * ⚠ İkonlar ADIN YANINDADIR, ayrı sütunda yox: dar siyahıda ayrı sütun
   *   adı sıxıb kəsərdi, ikonlar isə yalnız bəzən mövcuddur. */
  const nameLine = el('span', { class: 'ci-name' }, el('span', { class: 'ci-nm' }, name));
  if(pinned){
    nameLine.append(el('span', {
      class: 'ci-flag', 'data-icon': 'pin', 'data-icon-size': '12',
      // Ekran oxuyucusu üçün ad — ikon tək başına məlumat daşımamalıdır.
      role: 'img', 'aria-label': t('conv.pinned'),
    }));
  }
  if(muted){
    nameLine.append(el('span', {
      class: 'ci-flag muted', 'data-icon': 'bell-off', 'data-icon-size': '12',
      role: 'img', 'aria-label': t('conv.muted'),
    }));
  }

  row.append(
    avatar,
    nameLine,
    el('span', { class: 'ci-time' }, time || ''),
    // İkinci sətir: @username · status. Status RƏNGDƏN BAŞQA mətnlə də verilir.
    el('span', { class: 'ci-sub' },
      username ? el('span', { class: 'ci-user' }, '@' + username) : null,
      status ? el('span', { class: 'ci-status' + (online ? ' online' : '') },
        el('span', { class: 'ci-dot' + (online ? ' on' : '') }), status) : null,
    ),
    el('span', { class: 'ci-preview' + (typing ? ' typing' : '') }, typing ? t('chat.typing') : (preview || '')),
  );
  /* Nişan YALNIZ oxunmamış varsa — sıfır nişan səs-küydür.
   * ⚠ `badge === true` → RƏQƏMSİZ nöqtə. Bu, DM siyahısı üçündür: server
   *   yalnız `readAt` damğası verir, oxunmamış SAYINI vermir. "1" yazmaq
   *   uydurma rəqəm olardı (5 oxunmamış varsa da "1" görünərdi). */
  if(badge === true){
    row.append(el('span', { class: 'ci-badge dot', 'aria-label': t('chat.unread_any') }));
  }else if(typeof badge === 'number' && badge > 0){
    row.append(el('span', { class: 'ci-badge', 'aria-label': t('chat.unread_n').replace('{n}', String(badge)) }, String(badge)));
  }
  // Sətir dinamik qurulur → statik boot-dakı `paintIcons()` ona çatmır.
  paintIcons(row);
  return row;
}

/**
 * Söhbət siyahısında ox düymələri ilə naviqasiya.
 *
 * ⚠ `roving tabindex` İŞLƏDİLMİR: sətirlər `<button>`-dur və hər render-də
 *   yenidən qurulur, ona görə tabindex-i sinxron saxlamaq əlavə vəziyyət
 *   tələb edərdi. Bunun əvəzinə konteyner səviyyəsində `keydown` tutulur —
 *   sətirlər normal Tab sırasında qalır, ↑/↓ isə sürətli keçid verir.
 * ⚠ Bir dəfə bağlanır (`dataset.navBound`): siyahı hər yeniləmədə yenidən
 *   qurulur, dinləyici isə KONTEYNERDƏDİR və təkrar bağlanmamalıdır.
 */
export function bindListKeyboardNav(list){
  if(!list || list.dataset.navBound === '1') return;
  list.dataset.navBound = '1';
  list.addEventListener('keydown', e => {
    if(e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const rows = [...list.querySelectorAll('.ch-item')];
    if(!rows.length) return;
    const cur = rows.indexOf(document.activeElement.closest('.ch-item'));
    e.preventDefault();
    let next;
    if(e.key === 'Home') next = 0;
    else if(e.key === 'End') next = rows.length - 1;
    else if(cur < 0) next = 0;
    // Dövrə vurur: son sətirdən ↓ ilk sətrə qayıdır (siyahı qısadır).
    else next = (cur + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
    rows[next].focus();
  });
}

/* ══ 3. BAŞLIQ ═══════════════════════════════════════════════════════════ */
/**
 * Söhbət başlığı.
 *
 * `user` verilibsə ZƏNGİN variant qurulur: avatar, ad + təsdiq nişanı,
 * XP səviyyəsi, rol nişanı, @username və status. Otaq üçün `user` yoxdur —
 * o halda sadə variant (başlıq + alt sətir) qalır.
 */
export function buildChatHead(host, {
  title, sub = '', subOnline = false, onBack, detailsBtn = null,
  user = null, actions = null,
}){
  clear(host);

  const main = el('div', { class: 'ch-head-main' });
  if(user){
    const nameLine = el('span', { class: 'ch-head-title' }, nameWithBadge(user));
    /* ⚠ Səviyyə YALNIZ `xp` sahəsi OLANDA göstərilir. Otaq da bu funksiyanı
     *   işlədir (avatar + ad üçün), amma otağın XP-si yoxdur —
     *   `levelFromXP(undefined)` 1 qaytarır və başlıqda mənasız "Lv 1"
     *   görünərdi. `typeof` yoxlaması 0 XP-li real istifadəçini də düzgün
     *   göstərir (`user.xp` falsy olsa belə sahə mövcuddur). */
    if(typeof user.xp === 'number'){
      const lvl = levelFromXP(user.xp);
      // Səviyyə nişanı — rəqəm MƏTNDƏDİR, yalnız rəngdən asılı deyil.
      nameLine.append(el('span', {
        class: 'ch-lvl', 'aria-label': t('hdr.level').replace('{n}', String(lvl)),
      }, 'Lv ' + lvl));
    }
    /* Rol nişanı yalnız ADİ istifadəçidən FƏRQLİDİRSƏ göstərilir:
     * hər sətirdə "USER" yazmaq məlumat daşımır, yalnız səs-küydür.
     * ⚠ `users.role` sütununun default-u kiçik hərflə `'user'`-dir (bax
     *   `users-role-default-trap`), ona görə müqayisə hərf həssaslığı
     *   OLMADAN aparılır. */
    const role = String(user.role || '').toUpperCase();
    if(role && role !== 'USER'){
      nameLine.append(el('span', { class: 'ch-role' }, role));
    }
    main.append(nameLine);
    main.append(el('span', { class: 'ch-head-sub' + (subOnline ? ' online' : '') },
      user.username ? el('span', {}, '@' + user.username) : null,
      user.username && sub ? el('span', { class: 'ch-sep' }, '·') : null,
      sub ? el('span', {}, sub) : null,
    ));
  }else{
    main.append(el('span', { class: 'ch-head-title' }, title));
    if(sub) main.append(el('span', { class: 'ch-head-sub' + (subOnline ? ' online' : '') }, sub));
  }

  /* ⚠ `null`-lar SÜZÜLÜR: `host.append()` NATİV DOM metodudur və `null`-u
   *   `"null"` SƏTRİNƏ çevirir (`el()` isə onu atır). Otaq başlığında `user`
   *   olmadığı üçün ekranda hərfi "null" yazısı çıxırdı. */
  const parts = [
    // Mobil master-detail geri düyməsi (CSS yalnız mobildə göstərir).
    el('button', { class: 'chat-back', type: 'button', 'aria-label': t('chat.back'), onclick: onBack }, '‹'),
    user ? avatarNode(user, 'avatar ch-head-av', subOnline) : null,
    main,
    el('div', { class: 'ch-head-actions' }, actions || detailsBtn || null),
  ].filter(Boolean);
  host.append(...parts);
  paintIcons(host);
}

/**
 * Başlığın sağ tərəfi: axtarış · sabitlə · info · daha çox.
 * ⚠ Hamısı ikon düyməsidir, ona görə HƏR BİRİNİN `aria-label`-ı var —
 *   əks halda ekran oxuyucusu dörd adsız düymə oxuyardı.
 */
export function headerActions({ onSearch, onPin, pinned = false, detailsBtn, menuItems = [] }){
  const wrap = el('div', { class: 'ch-head-actions' });

  if(onSearch) wrap.append(el('button', {
    type: 'button', class: 'ch-icon-btn',
    'aria-label': t('hdr.search'), title: t('hdr.search'), onclick: onSearch,
  }, el('span', { class: 'ic', 'data-icon': 'search', 'data-icon-size': '17' })));

  if(onPin) wrap.append(el('button', {
    type: 'button', class: 'ch-icon-btn' + (pinned ? ' on' : ''),
    'aria-pressed': String(pinned),
    'aria-label': pinned ? t('conv.unpin') : t('conv.pin'),
    title: pinned ? t('conv.unpin') : t('conv.pin'),
    onclick: onPin,
  }, el('span', { class: 'ic', 'data-icon': 'pin', 'data-icon-size': '17' })));

  if(detailsBtn) wrap.append(detailsBtn);

  if(menuItems.length){
    const mwrap = el('div', { class: 'mx-pop-wrap' });
    const menu = el('div', { class: 'mx-menu', role: 'menu', hidden: true });
    const btn = el('button', {
      type: 'button', class: 'ch-icon-btn', 'aria-haspopup': 'true', 'aria-expanded': 'false',
      'aria-label': t('a11y.more'), title: t('a11y.more'),
      onclick: e => {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
        btn.setAttribute('aria-expanded', String(!menu.hidden));
      },
    }, el('span', { class: 'ic', 'data-icon': 'more', 'data-icon-size': '17' }));
    menuItems.forEach(it => menu.append(el('button', {
      type: 'button', role: 'menuitem', class: 'mx-menu-item' + (it.danger ? ' danger' : ''),
      onclick: () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); it.onClick(); },
    }, el('span', { class: 'ic', 'data-icon': it.icon, 'data-icon-size': '14' }), el('span', {}, it.label))));
    // Bayıra klik menyunu bağlayır (mesaj pop-ları ilə eyni model).
    document.addEventListener('click', () => {
      if(!menu.hidden){ menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    });
    mwrap.append(btn, menu);
    wrap.append(mwrap);
  }
  paintIcons(wrap);
  return wrap;
}

/** Detallar panelini açan/bağlayan düymə — `aria-expanded` CSS-i də idarə edir. */
/**
 * @param {Element} wrap
 * @param {string} panelId
 * @param {(open:boolean)=>void} [onToggle] açılanda məzmunu təzələmək üçün —
 *   panel `lastMsgs`-dən qidalanır və açılış anında ən son vəziyyəti
 *   göstərməlidir (əks halda köhnə media/link sayları görünür).
 */
export function detailsToggleButton(wrap, panelId, onToggle){
  const btn = el('button', {
    type: 'button', class: 'ch-icon-btn', id: panelId + 'Toggle',
    'aria-expanded': String(wrap.dataset.details === 'open'),
    'aria-controls': panelId,
    'aria-label': t('cd.toggle'),
    title: t('cd.toggle'),
    /* ⚠ İkon `more` DEYİL, `info`-dur: `headerActions`-dakı "daha çox"
     *   menyusu da `more` işlədir və başlıqda iki eyni `⋯` görünürdü. */
  }, el('span', { class: 'ic', 'data-icon': 'info', 'data-icon-size': '18' }));
  btn.addEventListener('click', () => {
    const open = wrap.dataset.details !== 'open';
    if(open) onToggle?.(true);       // məzmun açılmadan ƏVVƏL təzələnir
    setDetailsOpen(wrap, open);
  });
  return btn;
}

/** Paneli açır/bağlayır və bütün əlaqəli `aria-expanded` düymələrini sinxronlaşdırır. */
export function setDetailsOpen(wrap, open){
  wrap.dataset.details = open ? 'open' : 'closed';
  wrap.querySelectorAll('[aria-controls]').forEach(b => b.setAttribute('aria-expanded', String(open)));
}

/* ══ 4. EMOJİ SEÇİCİ ══════════════════════════════════════════════════════
 * ⚠ Bunlar MƏZMUNDUR, ikon DEYİL: istifadəçi mesaj mətninə emoji daxil edir.
 *   `no-emoji-icons` qaydası interfeys ikonlarına aiddir — bura yox.
 * ⚠ Kitabxana əlavə edilmədi: tam emoji dəsti ~1800 simvoldur və seçici
 *   üçün axtarış indeksi + virtuallaşdırma tələb edərdi. Söhbətdə real
 *   işlədilən dəst kiçikdir; kurasiya olunmuş siyahı bundle-a 0 KB əlavə edir. */
const EMOJI = {
  'emoji.cat_smiley': ['😀','😃','😄','😁','😅','😂','🙂','😉','😊','😍','😘','😎','🤔','🤨','😐','😴','😢','😭','😤','😡','🥳','🤯','😱','🙃'],
  'emoji.cat_gesture': ['👍','👎','👌','✌️','🤝','👏','🙌','🙏','💪','🫶','👋','🤞'],
  'emoji.cat_object': ['❤️','🔥','⭐','✨','🎉','🚀','💡','📌','✅','❌','⚠️','📎'],
  'emoji.cat_dev': ['💻','⌨️','🐛','🔧','⚙️','📦','🗂️','🧪','📊','🔍','🧠','☕'],
};

function insertAtCursor(input, text){
  const s = input.selectionStart ?? input.value.length;
  const e = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, s) + text + input.value.slice(e);
  // Kursor daxil edilmiş mətndən SONRA qalır ki, yazmağa davam etmək mümkün olsun.
  const pos = s + text.length;
  input.focus();
  input.setSelectionRange(pos, pos);
  // `input` hadisəsi süni şəkildə göndərilir: "yazır…" siqnalı və qaralama
  // kimi dinləyicilər proqram yolu ilə dəyişikliyi görməzdi.
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function emojiPanel(input, close){
  const box = el('div', { class: 'cmp-pop', id: 'emojiPop', hidden: true });
  for(const [catKey, list] of Object.entries(EMOJI)){
    box.append(el('div', { class: 'emoji-cat' }, t(catKey)));
    const grid = el('div', { class: 'emoji-grid' });
    list.forEach(ch => grid.append(el('button', {
      type: 'button',
      // Əlçatan ad emojinin ÖZÜDÜR — ekran oxuyucusu emoji adını oxuyur
      // ("thumbs up"), bu isə burada doğru davranışdır.
      'aria-label': ch,
      onclick: () => { insertAtCursor(input, ch); close(); },
    }, ch)));
    box.append(grid);
  }
  return box;
}

/* ══ 5. AI ALƏTLƏRİ ═══════════════════════════════════════════════════════
 * 🔴 NƏTİCƏ HEÇ VAXT BİRBAŞA TƏTBİQ OLUNMUR. Model istifadəçinin yazdığını
 *    səhv başa düşə bilər; mətni səssizcə əvəz etmək yazılanı İTİRMƏK
 *    deməkdir. Ona görə nəticə əvvəlcə önbaxışda göstərilir və istifadəçi
 *    "Tətbiq et" deyir (geri qaytarma = sadəcə "Ləğv et").
 * ⚠ Xülasə istisnadır: o, kompozitora yazılmır, panelə çıxır. */
const AI_ACTIONS = [
  {
    key: 'improve', icon: 'zap', label: 'ai.improve', needsText: true,
    prompt: (txt) => `Aşağıdakı mesajı daha aydın, səlis və peşəkar et. Dili DƏYİŞMƏ, mənanı SAXLA. Yalnız düzəldilmiş mətni qaytar, izah yazma:\n\n${txt}`,
  },
  {
    key: 'translate', icon: 'globe', label: 'ai.translate', needsText: true, pickLang: true,
    prompt: (txt, lang) => `Aşağıdakı mesajı ${lang} dilinə tərcümə et. Yalnız tərcüməni qaytar, izah yazma:\n\n${txt}`,
  },
  {
    key: 'code', icon: 'code', label: 'ai.code', needsText: true,
    prompt: (txt) => `Aşağıdakı kodu nəzərdən keçir: qısa izah ver və varsa təkmilləşdirmə təklif et. Cavabı markdown ilə formatla:\n\n${txt}`,
  },
  {
    key: 'summary', icon: 'chart', label: 'ai.summary', needsText: false, toPanel: true,
  },
];

const LANGS = [['Azərbaycan', 'az'], ['English', 'en'], ['Русский', 'ru']];

/** `/api/ai/chat` çağırışı — xəta mesajı istifadəçiyə anlaşılan formada verilir. */
export async function askAI(prompt){
  const r = await api('/ai/chat', { method: 'POST', body: { prompt } });
  return (r && r.result) ? String(r.result).trim() : '';
}

/**
 * AI nəticəsini ÖNBAXIŞDA göstərir; təsdiqlənsə `onApply` çağırılır.
 * Modal deyil, kompozitorun üstündəki pop — kontekst (yazılan mətn) görünür qalır.
 */
function aiPreview(popHost, outText, onApply, close){
  clear(popHost);
  const out = el('div', { class: 'ai-out' }, outText);
  popHost.append(el('div', { class: 'ai-preview' },
    out,
    el('div', { class: 'ai-acts' },
      el('button', { type: 'button', class: 'btn-small', onclick: () => { onApply(outText); close(); } }, t('ai.apply')),
      el('button', { type: 'button', class: 'btn-mini', onclick: close }, t('ai.cancel')),
    ),
  ));
}

/**
 * Kompozitoru müasir redaktora çevirir: emoji, mövcud əlavə/kod düymələri,
 * AI alətləri və dairəvi göndər düyməsi.
 *
 * @param {HTMLElement} composer  `.chat-input` konteyneri
 * @param {object} opts
 *   - getContext(): son mesajları mətn kimi qaytarır (xülasə üçün)
 *   - onSummary(text): xülasəni panelə ötürür
 */
export function enhanceComposer(composer, opts = /** @type {{getContext?:()=>string, onSummary?:(s:string)=>void, onFiles?:(f:File[])=>void}} */ ({})){
  const input = /** @type {HTMLTextAreaElement} */ (composer.querySelector('textarea'));
  const sendBtn = composer.querySelector('button');
  if(!input || !sendBtn || composer.dataset.enhanced === '1') return;
  composer.dataset.enhanced = '1';

  // Mövcud giriş + göndər düyməsi yeni qabığın içinə KÖÇÜRÜLÜR (yenidən
  // yaradılmır) — onlara bağlı dinləyicilər (`send`, mention autocomplete,
  // "yazır…") olduğu kimi qalsın.
  const shell = el('div', { class: 'cmp-shell' });
  const tools = el('div', { class: 'cmp-tools' });
  input.replaceWith(shell);

  /* ── Markdown önbaxışı ────────────────────────────────────────────────
   * Göndərmədən ƏVVƏL nəticəni görmək üçün. Giriş sahəsini ƏVƏZ ETMİR,
   * yanında/altında görünür — istifadəçi yazmağa davam edə bilsin. */
  const preview = el('div', { class: 'cmp-preview', hidden: true });

  shell.append(input, preview, tools);

  /* ── Avto-genişlənmə ──────────────────────────────────────────────────
   * ⚠ `height='auto'` ÖNCƏ verilir: `scrollHeight` cari hündürlüklə
   *   məhdudlaşdığı üçün sıfırlamadan kiçilmə İŞLƏMİR (mətn silinəndə
   *   sahə böyük qalardı). Yuxarı hədd 40vh — kompozitor ekranı yeməsin. */
  const MAX_H = () => Math.round(window.innerHeight * 0.4);
  const autoGrow = () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, MAX_H()) + 'px';
  };

  /* ── Simvol sayğacı ───────────────────────────────────────────────────
   * Yalnız hədd YAXINLAŞANDA görünür — daim göstərmək səs-küydür
   * (`composer.js`-dəki eyni qərar). */
  const CAP = Number(input.getAttribute('maxlength')) || 2000;
  const counter = el('span', { class: 'cmp-count', 'aria-live': 'polite' });
  const syncCounter = () => {
    const n = input.value.length;
    counter.textContent = n > CAP * 0.8 ? `${n} / ${CAP}` : '';
    counter.classList.toggle('over', n >= CAP);
  };

  input.addEventListener('input', () => { autoGrow(); syncCounter(); if(!preview.hidden) paintPreview(); });
  requestAnimationFrame(autoGrow);

  /* 🔴 PROQRAMLA DƏYİŞİKLİYİ DƏ TUTMAQ (istifadəçi bildirdi: "uzun mesaj
   * yazandan sonra ölçü düzəlmir").
   *
   * Göndərmə kodu `input.value = ''` yazır. Bu, `input` hadisəsini
   * TETİKLƏMİR (yalnız istifadəçi girişi tetikləyir), ona görə `autoGrow`
   * işə düşmür və sahə böyük qalırdı; simvol sayğacı da köhnə rəqəmi
   * göstərirdi.
   *
   * Həlli çağıran tərəfə (chat.js/dm.js) buraxmaq olardı, amma o zaman HƏR
   * yeni göndərmə yolu bunu xatırlamalı olardı. Onun əvəzinə `value`
   * setter-i BURADA sarınır — sahə hansı yolla dəyişilsə də ölçü sinxron
   * qalır. */
  const proto = Object.getPrototypeOf(input);
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if(desc && desc.set){
    Object.defineProperty(input, 'value', {
      configurable: true,
      get(){ return desc.get.call(this); },
      set(v){
        desc.set.call(this, v);
        autoGrow();
        syncCounter();
        if(!preview.hidden) paintPreview();
      },
    });
  }

  function paintPreview(){
    clear(preview);
    const v = input.value.trim();
    preview.append(v ? markdownNode(v) : el('span', { class: 'cd-empty' }, t('cmp.preview_empty')));
  }

  sendBtn.classList.add('cmp-send');
  clear(sendBtn);
  sendBtn.setAttribute('aria-label', t('chat.send'));
  sendBtn.title = t('chat.send');
  sendBtn.append(el('span', { class: 'ic', 'data-icon': 'send', 'data-icon-size': '18' }));

  /* ── Emoji ── */
  const emojiWrap = el('div', { class: 'cmp-pop-wrap' });
  const emojiBtn = el('button', {
    type: 'button', class: 'cmp-btn', 'aria-expanded': 'false', 'aria-haspopup': 'true',
    'aria-label': t('emoji.open'), title: t('emoji.open'),
  }, el('span', { class: 'ic', 'data-icon': 'smile', 'data-icon-size': '16' }));
  const closeEmoji = () => { emojiPop.hidden = true; emojiBtn.setAttribute('aria-expanded', 'false'); };
  const emojiPop = emojiPanel(input, closeEmoji);
  emojiBtn.addEventListener('click', e => {
    e.stopPropagation();
    closeAI();
    emojiPop.hidden = !emojiPop.hidden;
    emojiBtn.setAttribute('aria-expanded', String(!emojiPop.hidden));
  });
  emojiWrap.append(emojiBtn, emojiPop);

  /* ── AI ── */
  const aiWrap = el('div', { class: 'cmp-pop-wrap' });
  const aiBtn = el('button', {
    type: 'button', class: 'cmp-btn', 'aria-expanded': 'false', 'aria-haspopup': 'true',
    'aria-label': t('ai.open'), title: t('ai.open'),
  }, el('span', { class: 'ic', 'data-icon': 'bot', 'data-icon-size': '16' }), el('span', {}, 'AI'));
  const aiPop = el('div', { class: 'cmp-pop', hidden: true });
  const closeAI = () => { aiPop.hidden = true; aiBtn.setAttribute('aria-expanded', 'false'); renderAIMenu(); };

  async function runAI(action, lang){
    const txt = input.value.trim();
    if(action.needsText && !txt){ toast(t('ai.need_text'), 'err'); return; }
    clear(aiPop);
    aiPop.append(el('div', { class: 'cd-empty' }, t('ai.working')));
    try{
      const prompt = action.toPanel
        ? `Aşağıdakı söhbəti 3-5 cümlə ilə xülasə et. Kim nə dedi — qısa və konkret:\n\n${(opts.getContext && opts.getContext()) || ''}`
        : action.prompt(txt, lang);
      const res = await askAI(prompt);
      if(!res){ clear(aiPop); aiPop.append(el('div', { class: 'cd-empty' }, t('ai.empty'))); return; }
      if(action.toPanel){
        opts.onSummary?.(res);
        closeAI();
        toast(t('ai.summary_ready'));
        return;
      }
      aiPreview(aiPop, res, out => {
        input.value = out;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      }, closeAI);
    }catch(e){
      clear(aiPop);
      // Səbəb göstərilir: AI sorğusu rate-limit-ə (`rl: 'ai'`) düşə bilər.
      aiPop.append(el('div', { class: 'cd-empty' }, e?.message || t('ai.fail')));
    }
  }

  function renderAIMenu(){
    clear(aiPop);
    const menu = el('div', { class: 'ai-menu' });
    AI_ACTIONS.forEach(a => {
      if(a.pickLang){
        // Tərcümə üçün dil seçimi — hər dil ayrıca sətir (alt-menyu əlavə
        // klik tələb edərdi, cəmi 3 variantdır).
        LANGS.forEach(([label, code]) => menu.append(el('button', {
          type: 'button', onclick: () => runAI(a, label),
          'data-lang': code,
        }, el('span', { class: 'ic', 'data-icon': a.icon, 'data-icon-size': '16' }),
           el('span', {}, t(a.label).replace('{lang}', label)))));
        return;
      }
      menu.append(el('button', { type: 'button', onclick: () => runAI(a) },
        el('span', { class: 'ic', 'data-icon': a.icon, 'data-icon-size': '16' }),
        el('span', {}, t(a.label))));
    });
    aiPop.append(menu, el('div', { class: 'ai-note' }, t('ai.note')));
    paintIcons(aiPop);
  }

  aiBtn.addEventListener('click', e => {
    e.stopPropagation();
    closeEmoji();
    if(aiPop.hidden) renderAIMenu();
    aiPop.hidden = !aiPop.hidden;
    aiBtn.setAttribute('aria-expanded', String(!aiPop.hidden));
  });
  aiWrap.append(aiBtn, aiPop);

  /* ── Markdown alət düymələri ──────────────────────────────────────────
   * Seçili mətni sintaksislə əhatələyir. `composer.js`-dəki eyni yanaşma,
   * amma burada kompakt ikon dəsti (çat sətri dardır). */
  const wrapSel = (before, after = before, placeholder = '') => {
    const s = input.selectionStart, e = input.selectionEnd;
    const sel = input.value.slice(s, e) || placeholder;
    input.value = input.value.slice(0, s) + before + sel + after + input.value.slice(e);
    input.focus();
    // Seçim əhatələnmiş mətnin İÇİNDƏ qalır ki, yazmağa davam etmək mümkün olsun.
    input.setSelectionRange(s + before.length, s + before.length + sel.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const mdBtn = (icon, labelKey, fn) => el('button', {
    type: 'button', class: 'cmp-btn', title: t(labelKey), 'aria-label': t(labelKey), onclick: fn,
  }, el('span', { class: 'ic', 'data-icon': icon, 'data-icon-size': '15' }));

  const mdWrap = el('div', { class: 'cmp-md' },
    mdBtn('type', 'cmp.bold', () => wrapSel('**', '**', t('comp.md_bold_ph'))),
    mdBtn('code', 'cmp.inline_code', () => wrapSel('`', '`', 'code')),
    mdBtn('link', 'cmp.link', () => wrapSel('[', '](https://)', t('comp.md_link_ph'))),
  );

  /* Önbaxış açarı — `aria-pressed` vəziyyəti bildirir. */
  const prevBtn = el('button', {
    type: 'button', class: 'cmp-btn', 'aria-pressed': 'false',
    title: t('cmp.preview'), 'aria-label': t('cmp.preview'),
    onclick: () => {
      preview.hidden = !preview.hidden;
      prevBtn.setAttribute('aria-pressed', String(!preview.hidden));
      prevBtn.classList.toggle('on', !preview.hidden);
      if(!preview.hidden) paintPreview();
    },
  }, el('span', { class: 'ic', 'data-icon': 'eye', 'data-icon-size': '15' }));

  tools.append(emojiWrap, aiWrap, mdWrap, prevBtn, el('span', { class: 'spacer' }), counter);

  /* ── Klaviatura qısayolları ───────────────────────────────────────────
   * ⚠ Enter/Shift+Enter BURADA idarə OLUNMUR: göndərmə məntiqi `chat.js`/
   *   `dm.js`-dədir (onlar `send()`-i bilir). Burada yalnız formatlaşdırma
   *   qısayolları var ki, iki yerdə eyni davranış təkrarlanmasın. */
  input.addEventListener('keydown', e => {
    if(!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if(k === 'b'){ e.preventDefault(); wrapSel('**', '**', t('comp.md_bold_ph')); }
    else if(k === 'i'){ e.preventDefault(); wrapSel('*', '*', t('comp.md_italic_ph')); }
    else if(k === 'e'){ e.preventDefault(); wrapSel('`', '`', 'code'); }
  });

  /* ── Şəkli birbaşa YAPIŞDIRMA (paste) ─────────────────────────────────
   * Ekran şəkli çəkib Ctrl+V etmək çatda ən çox istifadə olunan yoldur. */
  input.addEventListener('paste', e => {
    const files = [...(e.clipboardData?.items || [])]
      .filter(i => i.kind === 'file' && i.type.startsWith('image/'))
      .map(i => i.getAsFile())
      .filter(Boolean);
    if(!files.length) return;
    e.preventDefault();          // şəkil MƏTN kimi yapışdırılmasın
    opts.onFiles?.(files);
  });

  /* ── Drag & Drop ──────────────────────────────────────────────────────
   * ⚠ `dragenter`/`dragleave` sayğacla izlənilir: uşaq elementlərin üzərindən
   *   keçəndə `dragleave` yalançı şəkildə işə düşür və örtük titrəyərdi. */
  let dragDepth = 0;
  const overlay = el('div', { class: 'cmp-drop', hidden: true },
    el('span', { class: 'ic', 'data-icon': 'image', 'data-icon-size': '22' }),
    el('span', {}, t('cmp.drop_here')));
  composer.append(overlay);
  const showDrop = on => { overlay.hidden = !on; composer.classList.toggle('dragging', on); };

  composer.addEventListener('dragenter', e => { e.preventDefault(); if(++dragDepth === 1) showDrop(true); });
  composer.addEventListener('dragover', e => e.preventDefault());
  composer.addEventListener('dragleave', () => { if(--dragDepth <= 0){ dragDepth = 0; showDrop(false); } });
  composer.addEventListener('drop', e => {
    e.preventDefault();
    dragDepth = 0; showDrop(false);
    const files = [...(e.dataTransfer?.files || [])];
    if(files.length) opts.onFiles?.(files);
  });

  /* Bayıra klik / Escape — hər iki pop üçün.
   * ⚠ Escape SƏNƏD səviyyəsindədir: fokus pop-un içində olmaya bilər
   *   (düymədə qalır), o halda pop-a bağlı dinləyici işləməzdi. */
  document.addEventListener('click', () => { closeEmoji(); closeAI(); });
  composer.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    if(!emojiPop.hidden){ closeEmoji(); emojiBtn.focus(); }
    if(!aiPop.hidden){ closeAI(); aiBtn.focus(); }
  });

  paintIcons(composer);
  return { tools, input, sendBtn };
}

/* ══ 5b. SABİTLƏNMİŞ BANNER-İ ═════════════════════════════════════════════
 *
 * ⚠ PAYLAŞILAN FUNKSİYADIR: `chat.js` və `dm.js` əvvəl öz nüsxələrini
 *   saxlayırdı. Bu fayl boyu təkrarlanan dərs budur — iki nüsxə vaxtla
 *   ayrılır və düzəliş birində unudulur (audit bunu emoji ikonlar və
 *   tərcümə olunmayan `title`-lar şəklində tapmışdı).
 *
 * NAVİQASİYA MODELİ (Telegram-dakı kimi):
 *   Banner HƏMİŞƏ BİR sabitlənmiş mesajı göstərir. Klik → həmin mesaja
 *   tullanır və NÖVBƏTİSİNƏ keçir (sona çatanda əvvələ dövr edir).
 *   Sağdakı sayğac isə paneldəki tam siyahını açır.
 * ⚠ Sıra köhnədən yeniyə: server `pinned_at DESC` qaytarır, ona görə massiv
 *   TƏRSİNƏ gəzilir — istifadəçi ən köhnə sabitlənmişdən başlayıb irəli
 *   gedir, bu, oxu sırası ilə üst-üstə düşür.
 */
export function pinBanner({ pins, index, onJump, onShowAll }){
  const total = pins.length;
  const i = ((index % total) + total) % total;      // mənfi/aşan indeksi normallaşdırır
  const cur = pins[total - 1 - i];                  // köhnədən yeniyə
  const jump = () => onJump(cur, i);

  const bar = el('div', {
    class: 'pin-bar', role: 'button', tabIndex: 0,
    'aria-label': total > 1
      ? t('chat.jump_pinned_n').replace('{i}', String(i + 1)).replace('{n}', String(total))
      : t('chat.jump_pinned'),
    onclick: jump,
    onkeydown: e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); jump(); } },
  });

  /* Çoxlu sabitlənmiş varsa sol tərəfdə seqment göstəricisi olur — hansında
   * olduğun BİR BAXIŞDA görünür (rəqəm oxumaq lazım gəlmir).
   * ⚠ 6-dan çox olduqda seqmentlər oxunmaz nazikləşir → yalnız rəqəm qalır. */
  if(total > 1 && total <= 6){
    const seg = el('span', { class: 'pin-bar-seg', 'aria-hidden': 'true' });
    for(let k = 0; k < total; k++) seg.append(el('span', { class: 'pseg' + (k === i ? ' on' : '') }));
    bar.append(seg);
  }else{
    bar.append(el('span', { class: 'pin-bar-accent' }));
  }

  bar.append(
    el('span', { class: 'ic pin-bar-ic', 'data-icon': 'pin', 'data-icon-size': '15' }),
    el('span', { class: 'pin-bar-body' },
      el('span', { class: 'pin-bar-label' },
        t('chat.pinned_one') + (total > 1 ? ` · ${i + 1}/${total}` : '')),
      el('span', { class: 'pin-text' }, previewOf(cur)),
    ),
  );

  if(total > 1){
    bar.append(el('button', {
      type: 'button', class: 'pin-bar-count',
      'aria-label': t('chat.pinned_count').replace('{n}', String(total)),
      title: t('chat.pinned_count').replace('{n}', String(total)),
      onclick: e => { e.stopPropagation(); onShowAll(); },
    }, el('span', { class: 'ic', 'data-icon': 'menu', 'data-icon-size': '13' })));
  }

  paintIcons(bar);
  return bar;
}

/* ══ 6. DETALLAR PANELİ ═══════════════════════════════════════════════════ */

/**
 * Paneli qurur. Bölmələr `opts`-dan gəlir ki, otaq və DM fərqli məzmun
 * versin, amma quruluş və əlçatanlıq davranışı ORTAQ qalsın.
 */
/**
 * Söhbətdəki media/fayl/linkləri yüklənmiş mesajlardan çıxarır.
 *
 * ⚠ LOKAL-dır (server sorğusu yox): panelin məqsədi "bu söhbətdə gördüyüm
 *   faylı tap"-dır. Tam arxiv üçün ayrıca endpoint + indeks lazımdır.
 * ⚠ Ən yenidən köhnəyə — istifadəçi son paylaşılanı axtarır.
 */
export function collectShared(msgs){
  const images = [], files = [], links = [];
  for(let i = msgs.length - 1; i >= 0; i--){
    const m = msgs[i];
    if(m.type === 'image' && m.fileUrl) images.push(m);
    else if(m.type === 'file' && m.fileUrl) files.push(m);
    if(m.text){
      const found = m.text.match(/https?:\/\/\S+/gi);
      if(found) found.forEach(u => links.push({ url: u, m }));
    }
  }
  return { images, files, links };
}

/** Bayt → oxunaqlı ölçü. */
const fmtBytes = b => !b ? ''
  : b > 1048576 ? (b / 1048576).toFixed(1) + ' MB'
  : Math.max(1, Math.round(b / 1024)) + ' KB';

export function renderDetailsPanel(panel, wrap, {
  titleId, people = [], pins = [], summary = null, shared = null,
  onSearch = null, onUnpin = null, onJump = null, onSummarize = null,
}){
  clear(panel);

  const body = el('div', { class: 'cd-body' });

  panel.append(
    el('div', { class: 'cd-head' },
      el('span', { class: 'cd-title', id: titleId }, t('cd.title')),
      el('button', {
        type: 'button', class: 'ch-icon-btn', 'aria-label': t('cd.close'), title: t('cd.close'),
        onclick: () => {
          setDetailsOpen(wrap, false);
          // Fokus açan düyməyə qaytarılır — klaviatura istifadəçisi "itmir".
          wrap.querySelector('[aria-controls="' + panel.id + '"]')?.focus();
        },
      }, el('span', { class: 'ic', 'data-icon': 'x', 'data-icon-size': '16' })),
    ),
    body,
  );

  /* ── Axtarış + tip filtrləri ──────────────────────────────────────────
   * ⚠ Filtr mesajın TİPİNƏ görədir (`type`), mətnə görə yox. "Link" istisnadır:
   *   ayrıca tip yoxdur, ona görə mətndə URL naxışı axtarılır.
   * ⚠ Filtr seçiləndə axtarış sorğusu MƏCBURİ DEYİL: "bütün şəkillər" kimi
   *   sırf gözdən keçirmə ssenarisi ən çox istifadə olunandır. */
  const FILTERS = [
    { key: 'all', label: 'cd.f_all' },
    { key: 'text', label: 'cd.f_msg' },
    { key: 'image', label: 'cd.f_img' },
    { key: 'file', label: 'cd.f_file' },
    { key: 'code', label: 'cd.f_code' },
    { key: 'link', label: 'cd.f_link' },
  ];
  let activeFilter = 'all';

  const hits = el('div');
  const search = el('input', {
    class: 'cd-search', type: 'search', placeholder: t('cd.search_ph'), 'aria-label': t('cd.search_ph'),
  });

  const filterRow = el('div', { class: 'cd-filters', role: 'group', 'aria-label': t('cd.filters') });
  FILTERS.forEach(f => filterRow.append(el('button', {
    type: 'button', class: 'cd-chip' + (f.key === 'all' ? ' on' : ''),
    'aria-pressed': String(f.key === 'all'),
    onclick: e => {
      activeFilter = f.key;
      filterRow.querySelectorAll('.cd-chip').forEach(b => {
        b.classList.remove('on'); b.setAttribute('aria-pressed', 'false');
      });
      e.currentTarget.classList.add('on');
      e.currentTarget.setAttribute('aria-pressed', 'true');
      runSearch();
    },
  }, t(f.label))));

  function runSearch(){
    const q = search.value.trim();
    clear(hits);
    // Filtr "hamısı"dırsa ən azı 2 hərf lazımdır — əks halda bütün söhbət qayıdar.
    if(activeFilter === 'all' && q.length < 2) return;
    const found = (onSearch ? onSearch(q, activeFilter) : []);
    if(!found.length){ hits.append(el('div', { class: 'cd-empty' }, t('cd.no_hits'))); return; }
    found.slice(0, 40).forEach(h => {
      const btn = el('button', { class: 'cd-hit', type: 'button', onclick: () => onJump?.(h) });
      btn.append(el('span', { class: 'who' },
        el('span', { class: 'cd-hit-kind', 'data-icon': kindIcon(h.kind), 'data-icon-size': '11' }),
        h.who || ''));
      const txt = el('span', { class: 'txt' });
      /* Uyğun hissə <mark> ilə işarələnir — `textContent` ilə qurulur, yəni
       * istifadəçi mətni HEÇ VAXT HTML kimi şərh olunmur.
       * ⚠ Sorğu boş ola bilər (yalnız filtr seçilib) → vurğulama atlanır. */
      const i = q ? (h.text || '').toLowerCase().indexOf(q.toLowerCase()) : -1;
      if(i >= 0){
        txt.append(h.text.slice(0, i), el('mark', {}, h.text.slice(i, i + q.length)), h.text.slice(i + q.length));
      }else{ txt.textContent = h.text || ''; }
      btn.append(txt);
      hits.append(btn);
    });
    paintIcons(hits);
  }

  search.addEventListener('input', runSearch);

  body.append(el('div', { class: 'cd-section' },
    el('div', { class: 'cd-section-title' },
      el('span', { class: 'ic', 'data-icon': 'search', 'data-icon-size': '13' }), t('cd.search')),
    search, filterRow, hits,
  ));

  /* ── İştirakçılar ── */
  const peopleBox = el('div');
  if(!people.length){ peopleBox.append(el('div', { class: 'cd-empty' }, t('cd.no_people'))); }
  people.forEach(u => {
    const on = isOnline(u);
    peopleBox.append(el('div', { class: 'cd-person' },
      avatarNode(u, 'avatar', on),
      el('div', { class: 'cd-person-info' },
        el('div', { class: 'nm' }, u.name || u.username || ''),
        el('div', { class: 'st' + (on ? ' online' : '') }, on ? t('cd.online') : lastSeenText(u)),
      ),
    ));
  });
  body.append(el('div', { class: 'cd-section' },
    el('div', { class: 'cd-section-title' },
      el('span', { class: 'ic', 'data-icon': 'users', 'data-icon-size': '13' }),
      t('cd.people') + ' · ' + people.length),
    peopleBox,
  ));

  /* ── Paylaşılan media · fayllar · linklər ────────────────────────────── */
  if(shared){
    // Şəkillər — kvadrat şəbəkə, klik mesaja tullandırır.
    const mediaBox = el('div');
    if(!shared.images.length){
      mediaBox.append(el('div', { class: 'cd-empty' }, t('cd.no_media')));
    }else{
      const grid = el('div', { class: 'cd-media' });
      shared.images.slice(0, 12).forEach(m => {
        const img = document.createElement('img');
        img.src = m.fileUrl;
        img.loading = 'lazy';            // panel açılmadan yüklənməsin
        img.decoding = 'async';
        img.alt = m.fileName || t('chat.prev_image');
        grid.append(el('button', {
          type: 'button', class: 'cd-media-item',
          'aria-label': t('cd.jump_to_media'),
          onclick: () => onJump?.({ id: m.id }),
        }, img));
      });
      mediaBox.append(grid);
    }
    body.append(el('div', { class: 'cd-section' },
      el('div', { class: 'cd-section-title' },
        el('span', { class: 'ic', 'data-icon': 'image', 'data-icon-size': '13' }),
        t('cd.media') + ' · ' + shared.images.length),
      mediaBox,
    ));

    // Fayllar — ad + ölçü, klik mesaja tullandırır.
    const fileBox = el('div');
    if(!shared.files.length){
      fileBox.append(el('div', { class: 'cd-empty' }, t('cd.no_files')));
    }else{
      shared.files.slice(0, 20).forEach(m => fileBox.append(el('button', {
        type: 'button', class: 'cd-row', onclick: () => onJump?.({ id: m.id }),
      },
        el('span', { class: 'ic', 'data-icon': 'paperclip', 'data-icon-size': '14' }),
        el('span', { class: 'cd-row-body' },
          el('span', { class: 'cd-row-nm' }, m.fileName || t('chat.prev_file')),
          el('span', { class: 'cd-row-sub' }, fmtBytes(m.fileSize)),
        ),
      )));
    }
    body.append(el('div', { class: 'cd-section' },
      el('div', { class: 'cd-section-title' },
        el('span', { class: 'ic', 'data-icon': 'paperclip', 'data-icon-size': '13' }),
        t('cd.files') + ' · ' + shared.files.length),
      fileBox,
    ));

    // Linklər — xarici keçid, ona görə `<a>` (yeni tab + `noopener`).
    const linkBox = el('div');
    if(!shared.links.length){
      linkBox.append(el('div', { class: 'cd-empty' }, t('cd.no_links')));
    }else{
      shared.links.slice(0, 20).forEach(({ url }) => {
        let host = url;
        try{ host = new URL(url).hostname; }catch(e){ /* natamam URL — xam mətn qalır */ }
        linkBox.append(el('a', {
          class: 'cd-row', href: url, target: '_blank', rel: 'noopener noreferrer',
        },
          el('span', { class: 'ic', 'data-icon': 'link', 'data-icon-size': '14' }),
          el('span', { class: 'cd-row-body' },
            el('span', { class: 'cd-row-nm' }, host),
            el('span', { class: 'cd-row-sub' }, url),
          ),
        ));
      });
    }
    body.append(el('div', { class: 'cd-section' },
      el('div', { class: 'cd-section-title' },
        el('span', { class: 'ic', 'data-icon': 'link', 'data-icon-size': '13' }),
        t('cd.links') + ' · ' + shared.links.length),
      linkBox,
    ));
  }

  /* ── Sabitlənmiş mesajlar ── */
  const pinBox = el('div');
  if(!pins.length){ pinBox.append(el('div', { class: 'cd-empty' }, t('cd.no_pins'))); }
  pins.forEach(p => {
    const card = el('div', { class: 'cd-pin' },
      el('div', { class: 'who' }, (p.authorName || nameOf(p.fromUid) || '') + ' · ' + shortTime(p.createdAt)),
      el('div', { class: 'txt' }, previewOf(p)),
    );
    if(onUnpin){
      card.append(el('button', {
        type: 'button', class: 'unpin', 'aria-label': t('cd.unpin'), title: t('cd.unpin'),
        onclick: () => onUnpin(p),
      }, el('span', { class: 'ic', 'data-icon': 'x', 'data-icon-size': '13' })));
    }
    pinBox.append(card);
  });
  body.append(el('div', { class: 'cd-section' },
    el('div', { class: 'cd-section-title' },
      el('span', { class: 'ic', 'data-icon': 'pin', 'data-icon-size': '13' }), t('cd.pins')),
    pinBox,
  ));

  /* ── AI xülasə ── */
  const sumBox = el('div');
  if(summary) sumBox.append(el('div', { class: 'cd-summary' }, summary));
  body.append(el('div', { class: 'cd-section' },
    el('div', { class: 'cd-section-title' },
      el('span', { class: 'ic', 'data-icon': 'bot', 'data-icon-size': '13' }), t('cd.summary')),
    el('button', { type: 'button', class: 'btn-mini', onclick: () => onSummarize?.(sumBox) }, t('cd.summarize')),
    sumBox,
  ));

  paintIcons(panel);
}

/** Axtarış nəticəsində tipi bildirən ikon — rəng tək siqnal olmasın. */
const kindIcon = k => ({ image: 'image', file: 'paperclip', code: 'code', link: 'link' })[k] || 'message';

/**
 * Mesajı axtarış filtri ilə uzlaşdırır.
 * ⚠ AYRICA İXRAC OLUNUR ki, `chat.js` və `dm.js` eyni məntiqi təkrarlamasın.
 */
export const LINK_RE = /https?:\/\/\S+/i;
export function matchesFilter(m, filter){
  if(filter === 'all') return true;
  if(filter === 'link') return LINK_RE.test(m.text || '');
  // `type` boş olanda mesaj mətndir (sxem default-u).
  const type = m.type || 'text';
  return type === filter;
}

/** Mesajın siyahı/panel önbaxışı — tipdən asılı qısa mətn. */
export function previewOf(m){
  if(!m) return '';
  if(m.type === 'image') return t('chat.prev_image');
  if(m.type === 'file') return t('chat.prev_file') + ' ' + (m.fileName || '');
  if(m.type === 'code') return t('chat.prev_code');
  return m.text || '';
}

const nameOf = uid => state.users.get(uid)?.name || '';
