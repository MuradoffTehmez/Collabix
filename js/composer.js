// Block-based paylaşım composer-i: bir post çoxlu mətn / kod / şəkil blokundan
// ibarət ola bilir; bloklar sıralanır, redaktə/silinir. Notion-vari yanaşma.
import { createPost } from './store.js';
import { el, clear, resizeImage, bus } from './util.js';
import { toast } from './ui.js';
import { allCategoryLabels, highlightOptions } from './taxonomy.js';
import { markdownNode } from './markdown.js';
import { t } from './i18n.js';

let blocks = []; // { id, type:'text'|'code'|'image', content, language, images:[{blob,previewURL,caption}] }
let idSeq = 0;
let attachedQuotedPost = null;

export function attachQuotedPost(p) {
  attachedQuotedPost = p;
  renderBlocks();
  document.getElementById('nav-btn-composer').click(); // Switch to composer tab
}

function newBlock(type){
  return { id: ++idSeq, type, content: '', language: (highlightOptions()[0] || {}).highlightId || 'python', images: [] };
}

function blockNode(b){
  const wrap = el('div', { class: 'c-block', dataset: { bid: b.id } });
  const tools = el('div', { class: 'c-block-tools' },
    el('button', { title: t('comp.up'), onclick: () => moveBlock(b.id, -1) }, '↑'),
    el('button', { title: t('comp.down'), onclick: () => moveBlock(b.id, +1) }, '↓'),
    el('button', { title: t('comp.del'), class: 'del', onclick: () => removeBlock(b.id) }, '✕'),
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

    const tbBtn = (label, title, fn) =>
      el('button', { type: 'button', class: 'md-tb-btn', title, onclick: fn }, label);

    const previewBtn = el('button', {
      type: 'button', class: 'md-tb-btn md-tb-toggle', title: t('comp.md_preview'),
      onclick: () => {
        b.showPreview = !b.showPreview;
        wrap.classList.toggle('preview-on', b.showPreview);
        previewBtn.classList.toggle('active', b.showPreview);
        if(b.showPreview) renderPreview();
      },
    }, '👁 ' + t('comp.md_preview'));

    const toolbar = el('div', { class: 'md-toolbar' },
      tbBtn('B', t('comp.md_bold'), () => wrapSel('**', '**', t('comp.md_bold_ph'))),
      tbBtn('I', t('comp.md_italic'), () => wrapSel('*', '*', t('comp.md_italic_ph'))),
      tbBtn('</>', t('comp.md_code'), () => wrapSel('`', '`', 'code')),
      tbBtn('🔗', t('comp.md_link'), () => wrapSel('[', '](https://)', t('comp.md_link_ph'))),
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
        grid.append(el('div', { class: 'c-img-item' }, img,
          el('button', { class: 'img-remove-btn', onclick: () => { b.images.splice(i, 1); renderImgs(); } }, '✕')));
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
  const last = document.querySelector('#blockList .c-block:last-child textarea, #blockList .c-block:last-child input[type=file]');
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

function rebuildTags(){
  const tagBox = document.getElementById('composerTags');
  const selected = new Set([...tagBox.querySelectorAll('.pp.sel')].map(x => x.textContent));
  clear(tagBox);
  allCategoryLabels().forEach(c => tagBox.append(
    el('button', { type: 'button', class: 'pp' + (selected.has(c) ? ' sel' : ''), onclick: e => e.target.classList.toggle('sel') }, c)
  ));
}

async function publish(){
  const meaningful = blocks.filter(b =>
    (b.type === 'image' && b.images.length) ||
    ((b.type === 'text' || b.type === 'code') && b.content.trim()));
  // Sitat (quote) həmişə öz mətn/məzmununu tələb edir — mətnsiz "paylaşım" birbaşa
  // re-post-dur və feed-dəki ↺ düyməsi ilə edilir.
  if(attachedQuotedPost && !meaningful.length){ toast(t('comp.quote_need_text'), 'err'); return; }
  if(!meaningful.length){ toast(t('comp.empty'), 'err'); return; }
  const btn = document.getElementById('shareBtn');
  btn.disabled = true;
  try{
    const tags = [...document.querySelectorAll('#composerTags .pp.sel')].map(b => b.textContent);
    await createPost({ blocks: meaningful, tags, sharedPostId: attachedQuotedPost ? attachedQuotedPost.id : null });
    blocks = [newBlock('text')];
    attachedQuotedPost = null;
    renderBlocks();
    document.querySelectorAll('#composerTags .pp.sel').forEach(b => b.classList.remove('sel'));
    toast(t('comp.published'));
  }catch(e){
    console.error('publish', e);
    toast(t('comp.fail'), 'err');
  }
  btn.disabled = false;
}

export function initComposer(){
  blocks = [newBlock('text')];
  renderBlocks();
  rebuildTags();
  bus.addEventListener('taxonomy-updated', () => { rebuildTags(); });
  document.getElementById('addTextBlockBtn').addEventListener('click', () => addBlock('text'));
  document.getElementById('addCodeBlockBtn').addEventListener('click', () => addBlock('code'));
  document.getElementById('addImageBlockBtn').addEventListener('click', () => addBlock('image'));
  document.getElementById('shareBtn').addEventListener('click', publish);
}
