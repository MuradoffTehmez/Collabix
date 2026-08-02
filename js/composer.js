// Block-based paylaşım composer-i: bir post çoxlu mətn / kod / şəkil blokundan
// ibarət ola bilir; bloklar sıralanır, redaktə/silinir. Notion-vari yanaşma.
import { createPost, state } from './store.js';
import { el, clear, resizeImage, bus, avatarNode } from './util.js';
import { toast, showModal, closeModal } from './ui.js';
import { allCategoryLabels, highlightOptions } from './taxonomy.js';
import { markdownNode } from './markdown.js';
import { t } from './i18n.js';
import { iconX, paintIcons } from './icons.js';

let blocks = []; // { id, type:'text'|'code'|'image', content, language, images:[{blob,previewURL,caption}] }
let idSeq = 0;
let attachedQuotedPost = null;
let scheduledAt = null;   // planlaşdırılmış yayım vaxtı (epoch ms) və ya null

export function attachQuotedPost(p) {
  attachedQuotedPost = p;
  renderBlocks();
  document.getElementById('nav-btn-composer').click(); // Switch to composer tab
}

function newBlock(type){
  return { id: ++idSeq, type, content: '', language: (highlightOptions()[0] || {}).highlightId || 'python', images: [] };
}

/* ══ QARALAMA (auto-save) ══════════════════════════════════════════════════
 * Yazılan mətn brauzer bağlananda İTİRDİ — indi `localStorage`-a yazılır.
 *
 * ⚠ ŞƏKİLLƏR SAXLANILMIR. Onlar `Blob` obyektləridir; JSON-a çevrilə bilmir
 *   və base64 kimi yazmaq kvotanı (≈5 MB) bir postla doldurardı. Qaralama
 *   yalnız MƏTN/KOD/tag/sorğu bərpa edir — bu, açıq şəkildə sənədləşdirilib
 *   ki, sonradan "şəkillərim itdi" sualı yaranmasın.
 *
 * ⚠ Server tərəfli qaralama cədvəli QƏSDƏN qurulmadı: o, sinxronizasiya,
 *   münaqişə həlli və təmizlik cronu tələb edir. Lokal saxlama tək cihazda
 *   problemi 90% həll edir. */
const DRAFT_KEY = 'collabix_draft_v1';
const DRAFT_DEBOUNCE = 800;
let draftTimer = null;

function setSaveStatus(key){
  const n = document.getElementById('cxSave');
  if(n) n.textContent = key ? t(key) : '';
}

/** Qaralamanı DƏRHAL yazır (debounce yoxdur). */
function writeDraft(){
  {
    try{
      const payload = {
        blocks: blocks
          .filter(b => b.type !== 'image')          // bax yuxarıdakı izah
          .map(b => ({ type: b.type, content: b.content, language: b.language })),
        tags: [...document.querySelectorAll('#composerTags .pp.sel')].map(b => b.textContent),
        poll,
        visibility: document.getElementById('cxVisibility')?.value || 'public',
        at: Date.now(),
      };
      const boş = !payload.blocks.some(b => (b.content || '').trim()) && !payload.poll;
      if(boş){ localStorage.removeItem(DRAFT_KEY); setSaveStatus(null); return; }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      setSaveStatus('cx.saved');
    }catch(e){
      // Kvota dolu və ya private rejim — qaralama İTİR, amma yazı axını
      // pozulmamalıdır. İstifadəçiyə status vasitəsilə bildirilir.
      setSaveStatus('cx.save_failed');
    }
  }
}

/** Yazma ilə eyni, amma debounce ilə — hər klaviatura vuruşunda çağırılır. */
function saveDraft(){
  clearTimeout(draftTimer);
  draftTimer = setTimeout(writeDraft, DRAFT_DEBOUNCE);
}

function restoreDraft(){
  let d = null;
  try{ d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); }catch(e){ /* zədəli JSON — atılır */ }
  if(!d || !Array.isArray(d.blocks) || !d.blocks.length) return false;
  blocks = d.blocks.map(b => ({ ...newBlock(b.type || 'text'), content: b.content || '', language: b.language }));
  if(d.poll) poll = d.poll;
  const vis = document.getElementById('cxVisibility');
  if(vis && d.visibility) vis.value = d.visibility;
  // Tag-lar `rebuildTags`-dan SONRA bərpa olunur (çiplər hələ yaradılmayıb).
  pendingDraftTags = Array.isArray(d.tags) ? d.tags : [];
  setSaveStatus('cx.restored');
  return true;
}
let pendingDraftTags = [];

function clearDraft(){
  clearTimeout(draftTimer);
  try{ localStorage.removeItem(DRAFT_KEY); }catch(e){ /* əhəmiyyətsiz */ }
  setSaveStatus(null);
}

/** Simvol sayğacı — yalnız hədd yaxınlaşanda görünür (daim göstərmək səs-küydür). */
const TEXT_CAP = 4000;
function updateCounter(){
  const n = document.getElementById('cxCount');
  if(!n) return;
  const used = blocks.reduce((s, b) => s + (b.content || '').length, 0);
  n.textContent = used > TEXT_CAP * 0.75 ? `${used} / ${TEXT_CAP}` : '';
  n.classList.toggle('over', used > TEXT_CAP);
}

/* ── Sorğu (poll) ─────────────────────────────────────────────────────────
 * ⚠ Sorğu BLOK DEYİL: API-də post səviyyəsində ayrıca sahədir (`poll`), çünki
 *   bir postda ən çox bir sorğu olur (`polls.post_id` UNIQUE). Blok modelinə
 *   salsaydıq, `meaningful` filtri və blok sırası məntiqi lazımsız yerə
 *   mürəkkəbləşərdi. Ona görə tag-lar kimi ayrıca bölmədir. */
let poll = null;   // null = sorğu yoxdur; { question, options, hideResults, multiChoice, anonymous, days }

function renderPoll(){
  const box = document.getElementById('composerPoll');
  if(!box) return;
  clear(box);
  box.classList.toggle('hidden', !poll);
  if(!poll) return;

  const q = el('input', { class: 'poll-in', maxLength: 200, value: poll.question,
    placeholder: t('poll.question_ph'), oninput: e => { poll.question = e.target.value; } });

  const opts = el('div', { class: 'poll-opts' });
  poll.options.forEach((val, i) => {
    const inp = el('input', { class: 'poll-in', maxLength: 80, value: val,
      placeholder: t('poll.option_ph').replace('{n}', String(i + 1)),
      oninput: e => { poll.options[i] = e.target.value; } });
    // Silmə yalnız 2-dən çox variant olanda — 2 minimumdur (server də tələb edir).
    const del = poll.options.length > 2
      ? el('button', { type: 'button', class: 'poll-del', 'aria-label': t('comp.del'),
          onclick: () => { poll.options.splice(i, 1); renderPoll(); } }, iconX())
      : null;
    opts.append(el('div', { class: 'poll-opt-row' }, inp, del));
  });

  const addOpt = poll.options.length < 6
    ? el('button', { type: 'button', class: 'btn-mini',
        onclick: () => { poll.options.push(''); renderPoll(); } }, t('poll.add_option'))
    : null;

  const hide = el('input', { type: 'checkbox', checked: !!poll.hideResults,
    onchange: e => { poll.hideResults = e.target.checked; } });
  const multi = el('input', { type: 'checkbox', checked: !!poll.multiChoice,
    onchange: e => { poll.multiChoice = e.target.checked; } });
  const anon = el('input', { type: 'checkbox', checked: !!poll.anonymous,
    onchange: e => { poll.anonymous = e.target.checked; } });

  // Müddət GÜN ilə seçilir, tarix seçici ilə deyil: sorğular qısamüddətlidir
  // və "3 gün" seçmək təqvimdən tarix tapmaqdan sürətlidir.
  // ⚠ Dəyər `days`-dir; `closesAt` mütləq zaman damğasına PAYLAŞMA anında
  //   çevrilir — kompozitor açıq qalarsa müddət sürüşməsin.
  const dur = el('select', { class: 'poll-dur',
    onchange: e => { poll.days = Number(e.target.value) || 0; } });
  for(const [v, key] of [[0, 'poll.dur_none'], [1, 'poll.dur_1'], [3, 'poll.dur_3'], [7, 'poll.dur_7']]){
    dur.append(el('option', { value: String(v), selected: (poll.days || 0) === v }, t(key)));
  }

  box.append(
    el('div', { class: 'poll-head' },
      el('span', { class: 'ic', 'data-icon': 'poll', 'data-icon-size': '15' }),
      el('b', {}, t('poll.add')),
      el('button', { type: 'button', class: 'poll-close', 'aria-label': t('comp.del'),
        onclick: () => { poll = null; renderPoll(); } }, iconX()),
    ),
    q, opts,
    el('div', { class: 'poll-foot' },
      addOpt,
      el('label', { class: 'poll-hide' }, dur, t('poll.duration')),
      el('label', { class: 'poll-hide' }, multi, t('poll.multi')),
      el('label', { class: 'poll-hide' }, anon, t('poll.anonymous')),
      el('label', { class: 'poll-hide' }, hide, t('poll.hide_results')),
    ),
  );
  paintIcons(box);
}

/** Yayımlanacaq sorğu — natamamsa `undefined` (server də 2 variant tələb edir). */
function pollPayload(){
  if(!poll) return undefined;
  const question = (poll.question || '').trim();
  const options = poll.options.map(o => (o || '').trim()).filter(Boolean);
  if(!question || options.length < 2) return undefined;
  // Gün → mütləq zaman damğası (server keçmiş tarixi rədd edir).
  const closesAt = poll.days ? Date.now() + poll.days * 86400000 : undefined;
  return {
    question, options,
    hideResults: !!poll.hideResults,
    multiChoice: !!poll.multiChoice,
    anonymous: !!poll.anonymous,
    closesAt,
  };
}

function blockNode(b){
  const wrap = el('div', { class: 'c-block', dataset: { bid: b.id } });
  // AUDIT-UI: ↑/↓ düymələrində yalnız `title` var idi. Əlçatan ad hesablanarkən
  // MƏZMUN `title`-dan ÜSTÜNDÜR (accname spesifikasiyası), ona görə ekran
  // oxuyucusu "yuxarı köçür" yox, sadəcə "↑" oxuyurdu. `aria-label` hər ikisini basır.
  const tools = el('div', { class: 'c-block-tools' },
    el('button', { type: 'button', title: t('comp.up'), 'aria-label': t('comp.up'),
      onclick: () => moveBlock(b.id, -1) }, '↑'),
    el('button', { type: 'button', title: t('comp.down'), 'aria-label': t('comp.down'),
      onclick: () => moveBlock(b.id, +1) }, '↓'),
    el('button', { type: 'button', title: t('comp.del'), 'aria-label': t('comp.del'), class: 'del',
      onclick: () => removeBlock(b.id) }, iconX()),
  );

  if(b.type === 'text'){
    // TASK-8 / Bənd 16 — markdown redaktoru: toolbar + canlı önbaxış.
    const ta = el('textarea', { class: 'c-text', placeholder: t('comp.md_ph'), maxLength: 4000 });
    ta.value = b.content;

    // Canlı önbaxış — `markdownNode` (marked + DOMPurify) təkrar-istifadə.
    // Yan-yana (geniş ekran) / toggle (dar ekran) CSS ilə idarə olunur.
    const preview = el('div', { class: 'c-md-preview' });
    const renderPreview = () => {
      clear(preview);
      preview.append(b.content.trim()
        ? markdownNode(b.content)
        : el('div', { class: 'c-md-empty' }, t('comp.md_empty')));
    };

    ta.addEventListener('input', () => {
      b.content = ta.value;
      autoGrow(ta);
      updateCounter();
      saveDraft();
      if(b.showPreview) renderPreview();
    });
    requestAnimationFrame(() => autoGrow(ta));

    // Toolbar düymələri seçili mətni markdown sintaksisi ilə əhatələyir.
    const wrapSel = (before, after = before, placeholder = '') => {
      const s = ta.selectionStart, e = ta.selectionEnd;
      const sel = ta.value.slice(s, e) || placeholder;
      ta.value = ta.value.slice(0, s) + before + sel + after + ta.value.slice(e);
      b.content = ta.value;
      // Seçimi əhatələnmiş mətnin içində saxla ki, istifadəçi yazmağa davam etsin.
      ta.focus();
      ta.selectionStart = s + before.length;
      ta.selectionEnd = s + before.length + sel.length;
      autoGrow(ta);
      if(b.showPreview) renderPreview();
    };
    const prefixLines = (prefix) => {
      const s = ta.selectionStart, e = ta.selectionEnd;
      const startLine = ta.value.lastIndexOf('\n', s - 1) + 1;
      const block = ta.value.slice(startLine, e);
      const replaced = block.split('\n').map(l => prefix + l).join('\n');
      ta.value = ta.value.slice(0, startLine) + replaced + ta.value.slice(e);
      b.content = ta.value;
      ta.focus();
      autoGrow(ta);
      if(b.showPreview) renderPreview();
    };

    // Ctrl/Cmd+B / +I — toolbar title-larında vəd edilən qısayollar.
    // `wrapSel` yuxarıda təyin olunduğu üçün burada təhlükəsiz istinad edilir.
    ta.addEventListener('keydown', e => {
      if(!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if(k === 'b'){ e.preventDefault(); wrapSel('**', '**', t('comp.md_bold_ph')); }
      else if(k === 'i'){ e.preventDefault(); wrapSel('*', '*', t('comp.md_italic_ph')); }
    });

    // AUDIT-UI: `aria-label` əlavə edildi. Əvvəl əlçatan ad MƏZMUNDAN gəlirdi
    // ("B", "I", "</>", "•", "“") — ekran oxuyucusunda "Qalın"/"Sitat" əvəzinə
    // tək hərf/durğu işarəsi səslənirdi. `title` bu halda nəzərə alınmır.
    const tbBtn = (label, title, fn) =>
      el('button', { type: 'button', class: 'md-tb-btn', title, 'aria-label': title, onclick: fn }, label);

    const previewBtn = el('button', {
      type: 'button', class: 'md-tb-btn md-tb-toggle', title: t('comp.md_preview'),
      onclick: () => {
        b.showPreview = !b.showPreview;
        wrap.classList.toggle('preview-on', b.showPreview);
        previewBtn.classList.toggle('active', b.showPreview);
        if(b.showPreview) renderPreview();
      },
    }, el('span', { class: 'ic', 'data-icon': 'eye', 'data-icon-size': '14' }), ' ' + t('comp.md_preview'));

    const toolbar = el('div', { class: 'md-toolbar' },
      tbBtn('B', t('comp.md_bold'), () => wrapSel('**', '**', t('comp.md_bold_ph'))),
      tbBtn('I', t('comp.md_italic'), () => wrapSel('*', '*', t('comp.md_italic_ph'))),
      tbBtn('</>', t('comp.md_code'), () => wrapSel('`', '`', 'code')),
      // B / I / • / “ QƏSDƏN tipoqrafik qalır — mətn panelində konvensiyadır.
      // Yalnız emoji olan 🔗 SVG-yə keçirilib (`currentColor`-a tabe olmurdu).
      tbBtn(el('span', { class: 'ic', 'data-icon': 'link', 'data-icon-size': '14' }),
        t('comp.md_link'), () => wrapSel('[', '](https://)', t('comp.md_link_ph'))),
      tbBtn('•', t('comp.md_list'), () => prefixLines('- ')),
      tbBtn('“', t('comp.md_quote'), () => prefixLines('> ')),
      previewBtn,
    );

    if(b.showPreview){ wrap.classList.add('preview-on'); previewBtn.classList.add('active'); }
    const editArea = el('div', { class: 'c-md-editarea' }, ta, preview);
    if(b.showPreview) renderPreview();

    wrap.append(
      el('div', { class: 'c-block-head' }, el('span', { class: 'c-type' }, t('comp.type_text')), tools),
      toolbar, editArea,
    );
  }
  else if(b.type === 'code'){
    const sel = el('select', { class: 'code-lang-sel show' });
    highlightOptions().forEach(o => sel.append(el('option', { value: o.highlightId }, o.label)));
    sel.value = b.language;
    sel.addEventListener('change', () => { b.language = sel.value; });
    const ta = el('textarea', { class: 'c-text c-code', placeholder: t('comp.code_ph'), maxLength: 8000, spellcheck: 'false' });
    ta.value = b.content;
    ta.addEventListener('input', () => { b.content = ta.value; autoGrow(ta); });
    requestAnimationFrame(() => autoGrow(ta));
    wrap.append(el('div', { class: 'c-block-head' }, el('span', { class: 'c-type' }, t('comp.type_code')), sel, tools), ta);
  }
  else if(b.type === 'image'){
    const grid = el('div', { class: 'c-img-grid' });
    const renderImgs = () => {
      clear(grid);
      b.images.forEach((im, i) => {
        const img = document.createElement('img');
        img.src = im.previewURL;
        // AUDIT-UI: `alt` YOX idi — ekran oxuyucusu fayl URL-ini (blob:…) oxuyurdu.
        // Önbaxış şəkli məzmun deyil, redaktə obyektidir → sıra nömrəsi kifayətdir.
        img.alt = t('comp.img_preview_alt').replace('{n}', String(i + 1));
        grid.append(el('div', { class: 'c-img-item' }, img,
          el('button', { class: 'img-remove-btn', 'aria-label': t('a11y.removeImage') + ' ' + (i + 1),
            onclick: () => { b.images.splice(i, 1); renderImgs(); } }, iconX())));
      });
    };
    const fileIn = el('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none;' });
    fileIn.addEventListener('change', async e => {
      for(const f of [...e.target.files].slice(0, 6 - b.images.length)){
        try{
          const blob = await resizeImage(f, 900, 0.72);
          b.images.push({ blob, previewURL: URL.createObjectURL(blob) });
        }catch(err){ toast(t('comp.img_fail'), 'err'); }
      }
      e.target.value = '';
      renderImgs();
    });
    const capIn = el('input', { class: 'c-caption', placeholder: t('comp.cap_ph'), maxLength: 200, value: b.caption || '' });
    capIn.addEventListener('input', () => { b.caption = capIn.value; });
    renderImgs();
    wrap.append(
      el('div', { class: 'c-block-head' }, el('span', { class: 'c-type' }, t('comp.type_img')), tools),
      grid,
      el('label', { class: 'img-pick-btn', style: 'align-self:flex-start;' }, t('comp.img_add'), fileIn),
      capIn,
    );
  }
  // Blok dinamik qurulur → statik boot-dakı paintIcons() ona çatmır.
  // Panel ikonları (link, göz) burada boyanır.
  paintIcons(wrap);
  return wrap;
}

function autoGrow(ta){
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight + 2, 420) + 'px';
}

function renderBlocks(){
  const list = document.getElementById('blockList');
  clear(list);
  blocks.forEach(b => list.append(blockNode(b)));
  updateCounter();
  
  if (attachedQuotedPost) {
    const qBox = el('div', { class: 'composer-quote-preview', style: 'margin:10px; padding:10px; border-left:3px solid var(--accent); background:var(--bg-card);' },
      el('div', { style: 'font-size:0.85em; opacity:0.8; margin-bottom:5px;' }, t('comp.quote_on') + ': @' + attachedQuotedPost.authorName),
      el('div', { style: 'font-size:0.9em;' }, (attachedQuotedPost.text || attachedQuotedPost.code || '').substring(0, 100) + '...'),
      el('button', { style: 'margin-top:8px; font-size:0.8em;', class: 'act-btn danger', onclick: () => { attachedQuotedPost = null; renderBlocks(); } }, t('comp.quote_cancel'))
    );
    list.append(qBox);
  }
}

function addBlock(type){
  blocks.push(newBlock(type));
  renderBlocks();
  // AUDIT-UI: burada oxunmayan `last` dəyişəni var idi (ts6133 + eslint) — silindi.
  const ta = document.querySelector('#blockList .c-block:last-child textarea');
  if(ta) ta.focus();
}
function removeBlock(id){
  blocks = blocks.filter(b => b.id !== id);
  if(!blocks.length) blocks.push(newBlock('text'));
  renderBlocks();
}
function moveBlock(id, dir){
  const i = blocks.findIndex(b => b.id === id);
  const j = i + dir;
  if(i < 0 || j < 0 || j >= blocks.length) return;
  [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  renderBlocks();
}

/**
 * Tag çipləri — axtarışla filtrlənir.
 *
 * ⚠ SEÇİLMİŞLƏR HƏMİŞƏ GÖRÜNÜR, axtarışa uyğun gəlməsə belə: əks halda
 *   istifadəçi "Python" seçib sonra "rus" yazanda seçimini itirdiyini
 *   düşünərdi. Seçilmiş çip filtrdən kənardır.
 */
function rebuildTags(){
  const tagBox = document.getElementById('composerTags');
  const selected = new Set([...tagBox.querySelectorAll('.pp.sel')].map(x => x.textContent));
  // Qaralamadan gələn tag-lar bir dəfə tətbiq olunur.
  if(pendingDraftTags.length){
    pendingDraftTags.forEach(x => selected.add(x));
    pendingDraftTags = [];
  }
  const q = (document.getElementById('cxTagSearch')?.value || '').trim().toLowerCase();
  clear(tagBox);
  const all = allCategoryLabels();
  const görünən = all.filter(c => selected.has(c) || !q || c.toLowerCase().includes(q));
  görünən.forEach(c => tagBox.append(
    el('button', {
      type: 'button', class: 'pp' + (selected.has(c) ? ' sel' : ''),
      'aria-pressed': String(selected.has(c)),
      onclick: e => {
        e.target.classList.toggle('sel');
        e.target.setAttribute('aria-pressed', String(e.target.classList.contains('sel')));
        saveDraft();
      },
    }, c)
  ));
  if(!görünən.length){
    tagBox.append(el('span', { class: 'cx-tag-empty' }, t('cx.tag_none')));
  }
}

async function publish(){
  const meaningful = blocks.filter(b =>
    (b.type === 'image' && b.images.length) ||
    ((b.type === 'text' || b.type === 'code') && b.content.trim()));
  // Sitat (quote) həmişə öz mətn/məzmununu tələb edir — mətnsiz "paylaşım" birbaşa
  // re-post-dur və feed-dəki ↺ düyməsi ilə edilir.
  if(attachedQuotedPost && !meaningful.length){ toast(t('comp.quote_need_text'), 'err'); return; }
  const pollData = pollPayload();
  // Sorğu AÇIQ, amma natamamdırsa səssizcə atmaq olmaz — istifadəçi onu
  // doldurduğunu düşünür. Açıq xəbərdarlıq verilir.
  if(poll && !pollData){ toast(t('poll.incomplete'), 'err'); return; }
  // Sorğu tək başına da mənalı postdur (mətn məcburi deyil).
  if(!meaningful.length && !pollData){ toast(t('comp.empty'), 'err'); return; }
  /* AUDIT-UI: hədd aşımı SƏSSİZ idi — sayğac qırmızıya keçirdi, amma paylaşım
   * yenə də göndərilirdi və server 400 qaytarınca ümumi "alınmadı" toast-ı
   * çıxırdı (`error-clarity`: səbəb bilinmirdi). İndi səbəb dəqiq deyilir. */
  const used = blocks.reduce((s, b) => s + (b.content || '').length, 0);
  if(used > TEXT_CAP){
    toast(t('comp.too_long').replace('{n}', String(used)).replace('{max}', String(TEXT_CAP)), 'err');
    return;
  }
  const btn = document.getElementById('shareBtn');
  const spin = btn.querySelector('.btn-spinner');
  btn.disabled = true;
  spin?.classList.remove('hidden');   // görünən yüklənmə siqnalı (`loading-buttons`)
  try{
    const tags = [...document.querySelectorAll('#composerTags .pp.sel')].map(b => b.textContent);
    await createPost({
      blocks: meaningful, tags,
      sharedPostId: attachedQuotedPost ? attachedQuotedPost.id : null,
      poll: pollData,
      visibility: document.getElementById('cxVisibility')?.value || 'public',
      scheduledAt: scheduledAt || undefined,
    });
    blocks = [newBlock('text')];
    attachedQuotedPost = null;
    poll = null;
    scheduledAt = null;
    clearDraft();          // uğurlu yayımdan sonra qaralama qalmamalıdır
    renderPoll();
    renderBlocks();
    document.querySelectorAll('#composerTags .pp.sel').forEach(b => b.classList.remove('sel'));
    toast(t('comp.published'));
  }catch(e){
    console.error('publish', e);
    toast(t('comp.fail'), 'err');
  }
  btn.disabled = false;
  spin?.classList.add('hidden');
}

export function initComposer(){
  blocks = [newBlock('text')];
  renderBlocks();
  rebuildTags();
  bus.addEventListener('taxonomy-updated', () => { rebuildTags(); });

  /* 🔴 DİL DƏYİŞİKLİYİ — kompozitor blokları JS ilə qurulur, ona görə
   *   `applyI18n` (yalnız `data-i18n` atributlarını yeniləyir) onlara ÇATMIR.
   *   Nəticə: dil rus/ingilis edilsə də blok başlığı ("¶ Mətn"), markdown
   *   placeholder-i və "Önbaxış" düyməsi AZƏRBAYCANCA qalırdı.
   *   `remountCurrentPage` səhifələri yeniləyir, kompozitor isə səhifə deyil —
   *   ona görə burada açıq şəkildə yenidən çəkilir.
   *   ⚠ `blocks` massivi TOXUNULMUR: yazılmış mətn qorunur, yalnız DOM
   *     yenidən qurulur. */
  document.addEventListener('lang-changed', () => {
    renderBlocks();
    renderPoll();
    rebuildTags();
  });
  document.getElementById('addTextBlockBtn').addEventListener('click', () => addBlock('text'));
  document.getElementById('addCodeBlockBtn').addEventListener('click', () => addBlock('code'));
  document.getElementById('addImageBlockBtn').addEventListener('click', () => addBlock('image'));
  document.getElementById('addPollBtn')?.addEventListener('click', () => {
    // Toggle: açıqdırsa bağlayır (ikinci sorğu mümkün deyil).
    poll = poll ? null : { question: '', options: ['', ''], hideResults: false };
    renderPoll();
  });
  document.getElementById('shareBtn').addEventListener('click', publish);

  /* ── Yeni nəzarətlər (kompozitor yenidən dizaynı) ─────────────────────── */
  const av = document.getElementById('cxAvatar');
  if(av && state.me) av.replaceWith(Object.assign(avatarNode(state.me, 'avatar cx-avatar'), { id: 'cxAvatar' }));

  // Tag axtarışı — hər hərfdə filtr. Debounce LAZIM DEYİL: siyahı ~25
  // elementdir və filtr sinxron massiv əməliyyatıdır.
  document.getElementById('cxTagSearch')?.addEventListener('input', rebuildTags);

  document.getElementById('cxVisibility')?.addEventListener('change', saveDraft);

  // Yayım menyusu (Planlaşdır / Qaralama saxla).
  const moreBtn = document.getElementById('cxMoreBtn');
  const menu = document.getElementById('cxPublishMenu');
  const closeMenu = () => { if(menu){ menu.hidden = true; moreBtn?.setAttribute('aria-expanded', 'false'); } };
  moreBtn?.addEventListener('click', e => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    moreBtn.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', closeMenu);
  /* AUDIT-UI: `keydown` YALNIZ `menu`-nun üzərində idi. Menyu açılanda fokus
   * hələ `cxMoreBtn`-də qalır (menyuya köçürülmür), ona görə Escape HEÇ NƏ
   * etmirdi — `escape-routes` pozuntusu. Dinləyici sənəd səviyyəsinə qaldırıldı
   * və fokus açan düyməyə qaytarılır (klaviatura istifadəçisi "itmir"). */
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && menu && !menu.hidden){ closeMenu(); moreBtn?.focus(); }
  });

  document.getElementById('cxScheduleBtn')?.addEventListener('click', () => {
    closeMenu();
    openScheduleModal();
  });
  document.getElementById('cxDraftBtn')?.addEventListener('click', () => {
    closeMenu();
    // Debounce-u gözləmədən DƏRHAL yaz — istifadəçi açıq şəkildə istəyib.
    clearTimeout(draftTimer);
    writeDraft();
    toast(t('cx.saved'));
  });

  // Qaralama bərpası — bloklar çəkilməzdən ƏVVƏL, sonra render.
  if(restoreDraft()){ renderBlocks(); renderPoll(); rebuildTags(); }
}

/* Planlaşdırma modalı — `datetime-local` ilə.
 * ⚠ Server keçmiş tarixi rədd edir (dərhal yayım sayır), ona görə burada da
 *   minimum "indi"dir: istifadəçi keçmiş seçib sonra "niyə dərhal getdi?"
 *   deməsin. */
function openScheduleModal(){
  const inp = el('input', { type: 'datetime-local', class: 'poll-in',
    min: new Date(Date.now() + 60000).toISOString().slice(0, 16) });
  const errEl = el('div', { class: 'form-err' });
  const ok = el('button', { class: 'btn-primary', onclick: () => {
    const ms = new Date(inp.value).getTime();
    if(!inp.value || !Number.isFinite(ms) || ms <= Date.now()){
      errEl.textContent = t('cx.schedule_future'); return;
    }
    scheduledAt = ms;
    closeModal();
    toast(t('cx.scheduled_for').replace('{t}', new Date(ms).toLocaleString()));
  } }, t('cx.schedule'));
  showModal([
    el('div', { class: 'section-title' }, t('cx.schedule')),
    el('p', { class: 'c-report-quote' }, t('cx.schedule_hint')),
    inp, errEl,
    el('div', { class: 'c-report-btns' }, ok),
  ]);
  inp.focus();
}


