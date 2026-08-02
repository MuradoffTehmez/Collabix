// Zəngin mesajlar (otaq + DM üçün ortaq): şəkil / fayl / kod göndərmə və render.
import { uploadMessageFile, MSG_FILE_MAX } from './store.js';
import { el, isSafeFileURL, highlightEl, avatarNode, nameWithBadge, fmtTime } from './util.js';
import { toast, showModal, closeModal } from './ui.js';
import { t, fmtRelTime } from './i18n.js';
import { highlightOptions } from './taxonomy.js';
import { mentionify } from './mention.js';
import { openImageModal } from './feed.js';
import { paintIcons } from './icons.js';

const fmtSize = b => b > 1024 * 1024 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

// Mesajın məzmun node-u — type-a görə (text/image/file/code).
export function richContent(m){
  const frag = document.createDocumentFragment();
  // Əlavə konteksti → `isSafeFileURL` (`msgfiles/` daxil). Serverdə `canReadKey`
  // açarı yalnız sahibinə və söhbət iştirakçılarına verir (AUDIT C-1).
  if(m.type === 'image' && isSafeFileURL(m.fileUrl)){
    const img = document.createElement('img');
    img.className = 'msg-img'; img.src = m.fileUrl; img.alt = m.fileName || '';
    /* AUDIT-UI: feed qalereyası ilə eyni qüsur — lightbox YALNIZ siçanla
     * açılırdı (`keyboard-nav`) və şəkil həvəslə (eager) yüklənirdi. */
    img.loading = 'lazy';
    img.decoding = 'async';
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', t('a11y.openImage').replace('{n}', '1'));
    const openImg = () => openImageModal(m.fileUrl);
    img.addEventListener('click', openImg);
    img.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openImg(); }
    });
    frag.append(img);
  } else if(m.type === 'file' && isSafeFileURL(m.fileUrl)){
    // AUDIT-UI: '📎' emoji → SVG ikon qatı (`no-emoji-icons`).
    const link = el('a', { class: 'msg-file', href: m.fileUrl, target: '_blank', rel: 'noopener noreferrer' },
      el('span', { class: 'ic', 'data-icon': 'paperclip', 'data-icon-size': '14' }),
      el('span', {}, m.fileName || 'fayl'),
      el('span', { class: 'mf-size' }, m.fileSize ? fmtSize(m.fileSize) : ''));
    paintIcons(link);
    frag.append(link);
  } else if(m.type === 'code' && m.text){
    const code = document.createElement('code');
    code.textContent = m.text;
    if(m.language) code.className = 'language-' + m.language;
    const pre = el('pre', {}, code);
    frag.append(el('div', { class: 'feed-code' }, pre));
    highlightEl(code);
  } else {
    frag.append(mentionify(m.text));
  }
  return frag;
}

// Input sətrinə 📎 və </> düymələri əlavə edir; send(payload) callback-i ilə göndərir.
export function attachRichControls(inputRow, send){
  const fileIn = el('input', { type: 'file', style: 'display:none;',
    accept: 'image/*,.pdf,.txt,.zip,.json,.csv' });
  fileIn.addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if(!f) return;
    if(f.size > MSG_FILE_MAX){ toast(t('msg.tooBig'), 'err'); return; }
    try{
      const meta = await uploadMessageFile(f);
      await send(meta);
    }catch(err){
      toast(err.message === 'Bu fayl tipi dəstəklənmir' ? t('msg.badType') : (err.message || t('msg.badType')), 'err');
    }
  });
  const attachBtn = el('button', { type: 'button', class: 'chat-attach-btn', title: t('msg.attach'),
    onclick: () => fileIn.click() }, '📎');
  const codeBtn = el('button', { type: 'button', class: 'chat-attach-btn', title: t('msg.code'),
    onclick: () => openCodeModal(send) }, '</>');
  inputRow.prepend(attachBtn, codeBtn, fileIn);
}

// Ardıcıl eyni-göndərən mesajları qruplaşdırıb render edir (TASK-7 / Bənd 9,
// Slack/LinkedIn üslubu): initials-avatar + ad(+verified badge) + vaxt QRUP başında
// bir dəfə; hər mesaj bubble-ında isə hover-də tam tarix (title). Otaq və DM ortaq.
// o: { uidOf, mineOf, userOf, nameOf, onName, bubbleOf, tsOf? }
const MSG_GROUP_GAP = 5 * 60 * 1000;   // 5 dəq-dən böyük ara → yeni qrup
export function renderGroupedMessages(box, msgs, o){
  const tsOf = o.tsOf || (m => m.createdAt);
  let i = 0;
  while(i < msgs.length){
    const first = msgs[i];
    const gid = o.uidOf(first);
    const group = [first];
    let j = i + 1;
    while(j < msgs.length && o.uidOf(msgs[j]) === gid && tsOf(msgs[j]) - tsOf(group[group.length - 1]) < MSG_GROUP_GAP){
      group.push(msgs[j]); j++;
    }
    i = j;
    const mine = o.mineOf(first);
    const user = o.userOf(first);
    const fallback = { name: o.nameOf(first) };
    const bubbles = group.map(m => {
      // Tək mesajın render xətası bütün qrupu kəsməsin.
      try{ return o.bubbleOf(m); }catch(e){ console.error('mesaj render xətası', m.id, e); return null; }
    });
    box.append(el('div', { class: 'msg-group ' + (mine ? 'out' : 'in') },
      avatarNode(user || fallback, 'avatar mg-avatar'),
      el('div', { class: 'mg-body' },
        el('div', { class: 'mg-head' },
          el('button', { type: 'button', class: 'mg-name', onclick: () => o.onName && o.onName(o.uidOf(first)) },
            nameWithBadge(user || fallback)),
          el('span', { class: 'mg-time', title: fmtTime(tsOf(first)) }, fmtRelTime(tsOf(first))),
        ),
        ...bubbles,
      ),
    ));
  }
}

function openCodeModal(send){
  const sel = el('select', { class: 'code-lang-sel show', style: 'margin-bottom:8px;' });
  highlightOptions().forEach(o => sel.append(el('option', { value: o.highlightId }, o.label)));
  const ta = el('textarea', { placeholder: '// kodu bura yaz...', maxLength: 4000,
    style: 'font-family:var(--mono); min-height:150px;' });
  showModal([
    el('div', { class: 'section-title' }, '</> ' + t('msg.code')),
    sel, ta,
    el('button', { class: 'btn-small', onclick: async e => {
      const text = ta.value.trim();
      if(!text) return;
      e.target.disabled = true;
      try{ await send({ type: 'code', text, language: sel.value }); closeModal(); }
      catch(err){ toast('Göndərilə bilmədi', 'err'); }
      e.target.disabled = false;
    } }, '➤ Göndər'),
  ], { wide: true });
}
