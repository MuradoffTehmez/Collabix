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
import { el, clear, avatarNode, isOnline, lastSeenText } from './util.js';
import { t } from './i18n.js';
import { toast } from './ui.js';
import { api } from './api.js';
import { paintIcons } from './icons.js';
import { state } from './store.js';

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
}){
  const row = el('button', {
    type: 'button',
    class: 'ch-item' + (active ? ' active' : '') + (unread ? ' unread-row' : ''),
    // Siyahı seçim vasitəsidir → hansı sətrin seçili olduğu elan olunmalıdır.
    'aria-current': active ? 'true' : 'false',
    'aria-label': ariaLabel || name,
    onclick: onSelect,
  });
  row.append(
    avatar,
    el('span', { class: 'ci-name' }, name),
    el('span', { class: 'ci-time' }, time || ''),
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
  return row;
}

/* ══ 3. BAŞLIQ ═══════════════════════════════════════════════════════════ */
export function buildChatHead(host, { title, sub = '', subOnline = false, onBack, detailsBtn = null }){
  clear(host);
  host.append(
    // Mobil master-detail geri düyməsi (CSS yalnız mobildə göstərir).
    el('button', { class: 'chat-back', type: 'button', 'aria-label': t('chat.back'), onclick: onBack }, '‹'),
    el('div', { class: 'ch-head-main' },
      el('span', { class: 'ch-head-title' }, title),
      sub ? el('span', { class: 'ch-head-sub' + (subOnline ? ' online' : '') }, sub) : null,
    ),
    el('div', { class: 'ch-head-actions' }, detailsBtn || null),
  );
  paintIcons(host);
}

/** Detallar panelini açan/bağlayan düymə — `aria-expanded` CSS-i də idarə edir. */
export function detailsToggleButton(wrap, panelId){
  const btn = el('button', {
    type: 'button', class: 'ch-icon-btn', id: panelId + 'Toggle',
    'aria-expanded': String(wrap.dataset.details === 'open'),
    'aria-controls': panelId,
    'aria-label': t('cd.toggle'),
    title: t('cd.toggle'),
  }, el('span', { class: 'ic', 'data-icon': 'more', 'data-icon-size': '18' }));
  btn.addEventListener('click', () => setDetailsOpen(wrap, wrap.dataset.details !== 'open'));
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
export function enhanceComposer(composer, opts = /** @type {{getContext?:()=>string, onSummary?:(s:string)=>void}} */ ({})){
  const input = composer.querySelector('input');
  const sendBtn = composer.querySelector('button');
  if(!input || !sendBtn || composer.dataset.enhanced === '1') return;
  composer.dataset.enhanced = '1';

  // Mövcud giriş + göndər düyməsi yeni qabığın içinə KÖÇÜRÜLÜR (yenidən
  // yaradılmır) — onlara bağlı dinləyicilər (`send`, mention autocomplete,
  // "yazır…") olduğu kimi qalsın.
  const shell = el('div', { class: 'cmp-shell' });
  const tools = el('div', { class: 'cmp-tools' });
  input.replaceWith(shell);
  shell.append(input, tools);

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

  tools.append(emojiWrap, aiWrap, el('span', { class: 'spacer' }));

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

/* ══ 6. DETALLAR PANELİ ═══════════════════════════════════════════════════ */

/**
 * Paneli qurur. Bölmələr `opts`-dan gəlir ki, otaq və DM fərqli məzmun
 * versin, amma quruluş və əlçatanlıq davranışı ORTAQ qalsın.
 */
export function renderDetailsPanel(panel, wrap, {
  titleId, people = [], pins = [], summary = null,
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

  /* ── Axtarış ── */
  const hits = el('div');
  const search = el('input', {
    class: 'cd-search', type: 'search', placeholder: t('cd.search_ph'), 'aria-label': t('cd.search_ph'),
  });
  search.addEventListener('input', () => {
    const q = search.value.trim();
    clear(hits);
    if(q.length < 2) return;                   // 1 hərf bütün söhbəti qaytarardı
    const found = onSearch ? onSearch(q) : [];
    if(!found.length){ hits.append(el('div', { class: 'cd-empty' }, t('cd.no_hits'))); return; }
    found.slice(0, 30).forEach(h => {
      const btn = el('button', { class: 'cd-hit', type: 'button', onclick: () => onJump?.(h) });
      btn.append(el('span', { class: 'who' }, h.who || ''));
      const txt = el('span', { class: 'txt' });
      // Uyğun hissə <mark> ilə işarələnir — `textContent` ilə qurulur,
      // yəni istifadəçi mətni HEÇ VAXT HTML kimi şərh olunmur.
      const i = (h.text || '').toLowerCase().indexOf(q.toLowerCase());
      if(i >= 0){
        txt.append(h.text.slice(0, i), el('mark', {}, h.text.slice(i, i + q.length)), h.text.slice(i + q.length));
      }else{ txt.textContent = h.text || ''; }
      btn.append(txt);
      hits.append(btn);
    });
  });

  body.append(el('div', { class: 'cd-section' },
    el('div', { class: 'cd-section-title' },
      el('span', { class: 'ic', 'data-icon': 'search', 'data-icon-size': '13' }), t('cd.search')),
    search, hits,
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

/** Mesajın siyahı/panel önbaxışı — tipdən asılı qısa mətn. */
export function previewOf(m){
  if(!m) return '';
  if(m.type === 'image') return t('chat.prev_image');
  if(m.type === 'file') return t('chat.prev_file') + ' ' + (m.fileName || '');
  if(m.type === 'code') return t('chat.prev_code');
  return m.text || '';
}

const nameOf = uid => state.users.get(uid)?.name || '';
