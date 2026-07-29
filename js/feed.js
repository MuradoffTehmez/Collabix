// Feed: block-based post render (mətn/kod/şəkil), like, şərh, bookmark,
// "daha çox oxu" + post detal səhifəsi (#post/{id}), Saxlanılanlar, axtarış.
// Premium Card Redesign — Lucide SVG icons, glassmorphism, ARIA.
import {
  state, watchFeed, updatePost, deletePost, getPostById,
  toggleLike, toggleBookmark, watchComments, addComment, editComment, deleteComment, toggleCommentLike,
  toggleRepost, deriveMyReposts
} from './store.js';
import {
  el, clear, avatarNode, nameWithBadge, fmtTime, isSafeImageURL, isSafeFileURL, highlightEl,
  debounce, bus, emit, updateDynamicSEO, levelFromXP
} from './util.js';
import { toast, confirmDialog, showModal, closeModal, skeletons, emptyState } from './ui.js';
import { openProfileModal, setFeedCache } from './users.js';
import { markdownNode } from './markdown.js';
import { highlightOptions } from './taxonomy.js';
import { mentionify, attachMentionAutocomplete } from './mention.js';
import { t, fmtRelTime } from './i18n.js';
import { attachQuotedPost } from './composer.js';
// Ortaq ikon fabriki + kopyala komponenti (public qat da eynisini işlədir).
import { SVG, iconCopy, iconCheck, copyButton } from './icons.js';

// Heart (like)
const iconHeart = (filled) => SVG(
  filled
    ? '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'
    : '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  { fill: filled ? 'currentColor' : 'none' }
);

// MessageCircle (comment)
const iconComment = () => SVG(
  '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'
);

// Bookmark
const iconBookmark = (filled) => SVG(
  '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  { fill: filled ? 'currentColor' : 'none' }
);

// Repeat2 (share/repost)
const iconShare = () => SVG(
  '<path d="m2 9 3-3 3 3"/><path d="M13 18H7a2 2 0 0 1-2-2V6"/><path d="m22 15-3 3-3-3"/><path d="M11 6h6a2 2 0 0 1 2 2v10"/>'
);

// MoreHorizontal (menu)
const iconMore = () => SVG(
  '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>'
);

// ChevronDown (collapse)
const iconChevron = () => SVG(
  '<path d="m6 9 6 6 6-6"/>',
  { w: '14', h: '14' }
);

// Pencil (edit)
const iconEdit = () => SVG(
  '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  { w: '16', h: '16' }
);

// Trash2 (delete)
const iconTrash = () => SVG(
  '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  { w: '16', h: '16' }
);

// Flag (report)
const iconFlag = () => SVG(
  '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  { w: '16', h: '16' }
);

// Link (copy link)
const iconLink = () => SVG(
  '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  { w: '16', h: '16' }
);

// Paylaşma linklərinin bazası — `location.origin`-dən gəlir (AUDIT-TASK-2 / 2.5).
// Əvvəl bura domen HARDCODED yazılmışdı və `worker/seo.ts`-dəki dəyərin
// ikinci nüsxəsi idi: domen dəyişəndə biri yenilənib, digəri köhnə qalırdı.
// Frontend öz origin-ini onsuz da bilir — server var-ına ehtiyac yoxdur və
// bu, custom domen / staging / lokal dev-də avtomatik düzgün işləyir.
const SITE = location.origin;

// `onRepostChange(reposted, delta)` — repost toggle-ından sonra çağırılır ki,
// çağıran kart sayğacı YERİNDƏ yeniləsin (feed remount olunmur).
// Modern paylaş modalı: ikon+təsvirli əsas əməliyyatlar, URL kopyala sətri,
// kompakt xarici-platforma şəbəkəsi. Rənglər tema dəyişənlərindən → 3 tema uyğun.
function openShareModal(p, onRepostChange) {
  // Hədəf: p re-post/quote-dursa orijinala, yoxsa özünə istinad et.
  const targetPost = (p.sharedPost && !p.sharedPost.deleted) ? p.sharedPost : p;
  const rootId = p.sharedPostId || p.id;           // toggle üçün kök orijinal
  const url = SITE + '/post/' + targetPost.id;
  const shareText = (targetPost.authorName || 'Collabix') + ' — Collabix';
  const mine = targetPost.authorUid === state.authUser.uid;
  const already = state.myReposts.has(rootId);

  const body = el('div', { class: 'share-modal' });

  // Əsas əməliyyatlar (repost + quote) — yalnız başqasının postu üçün.
  if(!mine){
    const repostAction = el('button', { type: 'button', class: 'share-action' + (already ? ' active' : ''),
      onclick: async () => {
        closeModal();
        const next = !already;   // optimistic; xətada geri qaytarılır
        if(onRepostChange) onRepostChange(next, next ? 1 : -1);
        try{
          const on = await toggleRepost(rootId);
          if(on !== next && onRepostChange) onRepostChange(on, on === next ? 0 : (on ? 1 : -1));
          toast(on ? t('share.done') : t('share.undone'));
        }catch(e){
          if(onRepostChange) onRepostChange(already, next ? -1 : 1);
          toast(e.message || t('share.fail'), 'err');
        }
      } },
      el('span', { class: 'sa-icon' }, iconShare()),
      el('span', { class: 'sa-text' },
        el('b', {}, already ? t('share.reposted_do') : t('share.repost_do')),
        el('small', {}, t('share.repost_hint'))),
      already ? el('span', { class: 'sa-check' }, iconCheck()) : null,
    );
    const quoteAction = el('button', { type: 'button', class: 'share-action',
      onclick: () => { closeModal(); attachQuotedPost(targetPost); } },
      el('span', { class: 'sa-icon quote' }, '❝'),
      el('span', { class: 'sa-text' },
        el('b', {}, t('share.quote_do')),
        el('small', {}, t('share.quote_hint'))),
    );
    body.append(el('div', { class: 'share-actions' }, repostAction, quoteAction));
  }

  // Link kopyala sətri (URL göstərilir).
  body.append(el('div', { class: 'share-copy' },
    el('span', { class: 'sc-url' }, url.replace(/^https?:\/\//, '')),
    el('button', { type: 'button', class: 'sc-btn', onclick: async () => {
      try{ await navigator.clipboard.writeText(url); toast(t('share.copied')); }
      catch(e){ toast(t('share.fail'), 'err'); }
    } }, iconLink(), t('share.copy_do')),
  ));

  // Xarici platformalar — kompakt ikon şəbəkəsi (marka rəngləri hover-də).
  const ext = (label, cls, href, glyph) => el('a', { class: 'share-ext ' + cls, href,
    target: '_blank', rel: 'noopener noreferrer', title: label, 'aria-label': label }, glyph);
  const extRow = el('div', { class: 'share-ext-grid' },
    ext(t('share.wa'), 'wa', `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + url)}`, '💬'),
    ext(t('share.tg'), 'tg', `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`, '✈'),
    ext(t('share.fb'), 'fb', `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '📘'),
    ext(t('share.x'), 'x', `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`, '𝕏'),
    ext(t('share.li'), 'li', `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, 'in'),
  );
  if(navigator.share){
    extRow.append(el('button', { type: 'button', class: 'share-ext native', title: t('share.native'), 'aria-label': t('share.native'),
      onclick: async () => { closeModal(); try{ await navigator.share({ title: 'Collabix', text: shareText, url }); }catch(e){} } }, '⤴'));
  }
  body.append(el('div', { class: 'share-divider' }, el('span', {}, t('share.external'))), extRow);

  showModal([
    el('div', { class: 'section-title', style: 'margin-bottom:2px;' }, t('share.title')),
    body,
  ]);
}

let posts = [];

// Kart menyusunun kənara klikdə bağlanması — document-ə BİR dəfə bağlanır.
// (Əvvəl hər `postCard()` çağırışı öz listener-ini əlavə edir və heç vaxt
// silmirdi; 10 saniyəlik feed təzələnməsi ilə birlikdə listener sayı
// dayanmadan artırdı və səhifə tədricən ağırlaşırdı.)
document.addEventListener('click', e => {
  document.querySelectorAll('.card-menu-dropdown.open').forEach(d => {
    const wrap = d.closest('.card-menu-wrap');
    if(!wrap || !wrap.contains(e.target)) d.classList.remove('open');
  });
}, { passive: true });

/* ---------- blok render ---------- */
function codeBlockNode(content, language){
  const code = document.createElement('code');
  if(language) code.className = 'language-' + language;

  // Wrap each line in a span for CSS counter-based line numbers
  const lines = content.split('\n');
  lines.forEach(line => {
    const span = document.createElement('span');
    span.className = 'code-line';
    span.textContent = line;
    code.append(span);
    code.append(document.createTextNode('\n'));
  });

  const pre = el('pre', {}, code);
  const langLbl = (highlightOptions().find(o => o.highlightId === language) || {}).label || language || 'kod';

  // Copy button with animated state (ortaq komponent — icons.js)
  const copyBtn = copyButton(content);

  // Collapse button
  const collapseBtn = el('button', {
    class: 'code-collapse-btn',
    'aria-label': 'Collapse code',
    onclick: () => {
      wrap.classList.toggle('collapsed');
    }
  }, iconChevron());

  const wrap = el('div', { class: 'feed-code show-lines' },
    el('div', { class: 'code-head' },
      el('span', { class: 'code-lang-badge' }, langLbl),
      el('div', { class: 'code-head-actions' }, collapseBtn, copyBtn)),
    pre);

  // Detect horizontal scroll for fade indicator
  requestAnimationFrame(() => {
    if(pre.scrollWidth > pre.clientWidth) {
      wrap.classList.add('has-scroll');
    }
    pre.addEventListener('scroll', () => {
      const atEnd = pre.scrollLeft + pre.clientWidth >= pre.scrollWidth - 4;
      wrap.classList.toggle('has-scroll', !atEnd && pre.scrollWidth > pre.clientWidth);
    }, { passive: true });
  });

  highlightEl(code);
  return wrap;
}

function imageGalleryNode(urls, caption){
  const safe = (urls || []).filter(isSafeImageURL);
  if(!safe.length) return null;
  const grid = el('div', { class: 'img-gallery' + (safe.length === 1 ? ' single' : '') });
  safe.forEach(u => {
    const img = document.createElement('img');
    img.src = u; img.alt = caption || ''; img.loading = 'lazy';
    img.addEventListener('click', () => openImageModal(u));
    grid.append(img);
  });
  const box = el('div', {}, grid);
  if(caption) box.append(el('div', { class: 'img-caption' }, caption));
  return box;
}

// Həm yeni block-based, həm köhnə (text/code/imageURL) postları render edir.
export function postBodyNode(p){
  const body = el('div', { class: 'post-body' });
  if(Array.isArray(p.blocks) && p.blocks.length){
    p.blocks.forEach(b => {
      if(b.type === 'text' && b.content) body.append(markdownNode(b.content));
      else if(b.type === 'code' && b.content) body.append(codeBlockNode(b.content, b.language));
      else if(b.type === 'image'){
        const g = imageGalleryNode(b.urls, b.caption);
        if(g) body.append(g);
      }
    });
  } else {
    if(p.text) body.append(el('div', { class: 'feed-body' }, p.text));
    if(p.code) body.append(codeBlockNode(p.code, p.codeLang));
    if(isSafeImageURL(p.imageURL)){
      const img = document.createElement('img');
      img.className = 'feed-img'; img.src = p.imageURL; img.alt = '';
      img.addEventListener('click', () => openImageModal(p.imageURL));
      body.append(img);
    }
  }
  return body;
}

/* ---------- post kartı ---------- */
export function postCard(p, { full = false } = {}){
  const author = state.users.get(p.authorUid);
  const mine = p.authorUid === state.authUser.uid;
  const canManage = mine || state.isAdmin;

  const card = el('div', { class: 'feed-card' });

  // "[İstifadəçi] re-post etdi" atribusiya sətri
  if(p.postType === 'repost'){
    card.append(el('div', { class: 'repost-attrib' },
      iconShare(),
      el('button', { class: 'name', style: 'font-size:.76rem; color:var(--muted); border:none; background:none; cursor:pointer;',
        onclick: () => emit('nav', { page: 'u/' + ((author && author.username) || '') }) }, p.authorName || '—'),
      el('span', {}, t('share.by')),
    ));
  }

  // Header
  // Səviyyə nişanı ayrıca saxlanılır: XP tez-tez dəyişir və bunun üçün kartı
  // yenidən qurmaq lazım deyil — `_cxPatch` onu yerində yeniləyir.
  const lvlBadge = author ? el('span', { class: 'role-badge' }, `LVL ${levelFromXP(author.xp)}`) : null;
  const headerInfo = el('div', { class: 'feed-head-info' },
    el('div', { class: 'feed-head-top' },
      el('button', { type: 'button', class: 'name', onclick: () => emit('nav', { page: 'u/' + ((author && author.username) || '') }) }, p.authorName || '—'),
      lvlBadge
    ),
    el('div', { class: 'feed-head-meta' },
      el('span', { class: 'when' }, fmtTime(p.createdAt)),
      p.editedAt ? el('span', { class: 'dot-sep' }, '•') : null,
      p.editedAt ? el('span', { class: 'edited-mark' }, t('feed.edited')) : null,
      p.postType === 'quote' ? el('span', { class: 'dot-sep' }, '•') : null,
      p.postType === 'quote' ? el('span', { class: 'quote-mark', style: 'font-size:.7rem; color:var(--primary);' }, '❝') : null,
    )
  );

  // 3-dot Menu dropdown
  const menuWrap = el('div', { class: 'card-menu-wrap' });
  const menuBtn = el('button', { class: 'card-menu-btn', 'aria-label': 'More options' }, iconMore());
  const menuDropdown = el('div', { class: 'card-menu-dropdown' });
  
  menuBtn.onclick = (e) => {
    e.stopPropagation();
    document.querySelectorAll('.card-menu-dropdown.open').forEach(d => {
      if(d !== menuDropdown) d.classList.remove('open');
    });
    menuDropdown.classList.toggle('open');
  };

  // Kənara klikdə bağlanma qlobal delegated listener-dədir (yuxarıda).

  const copyLinkBtn = el('button', { type: 'button', onclick: () => {
    navigator.clipboard.writeText(`${SITE}/post/${p.id}`);
    toast(t('share.copied'));
    menuDropdown.classList.remove('open');
  } }, iconLink(), t('feed.menu_copy'));
  menuDropdown.append(copyLinkBtn);

  if(canManage){
    if(mine) {
      const editBtn = el('button', { type: 'button', onclick: () => { openPostEdit(p); menuDropdown.classList.remove('open'); } }, iconEdit(), t('feed.menu_edit'));
      menuDropdown.append(editBtn);
    }
    const delBtn = el('button', { type: 'button', class: 'danger', onclick: async () => {
      menuDropdown.classList.remove('open');
      const ok = await confirmDialog(t('dyn.post_del_conf'));
      if(!ok) return;
      try{
        // `p` (id deyil) ötürülür — store `post.id` gözləyir. Əvvəl bura `p.id`
        // verilirdi və `"abc".id === undefined` olduğu üçün sorğu
        // `/api/posts/undefined`-ə gedirdi; Worker sətir tapmayıb 200 qaytarırdı,
        // ona görə "silindi" yazılır, amma post D1-də qalırdı.
        await deletePost(p);
        removePostLocally(p.id);   // feed keşi + DOM — remount olmadan
        toast(t('dyn.post_del'));
        // Post detal marşrutu real path-dır (/post/{id}), hash deyil.
        if(location.pathname === '/post/' + p.id) emit('nav', { page: 'home' });
      }catch(e){
        if(e && e.status === 404){
          // Artıq silinib (başqa sessiya/admin) — nəticə eynidir, UI-dan çıxar.
          removePostLocally(p.id);
          toast(t('dyn.post_del'));
          if(location.pathname === '/post/' + p.id) emit('nav', { page: 'home' });
          return;
        }
        toast(t('dyn.del_fail'), 'err');
      }
    } }, iconTrash(), t('feed.menu_del'));
    menuDropdown.append(delBtn);
  } else {
    const repBtn = el('button', { type: 'button', class: 'danger', onclick: () => {
      toast(t('feed.reported'));
      menuDropdown.classList.remove('open');
    } }, iconFlag(), t('feed.menu_report'));
    menuDropdown.append(repBtn);
  }

  menuWrap.append(menuBtn, menuDropdown);

  card.append(el('div', { class: 'feed-head' },
    avatarNode(author || { name: p.authorName }, 'avatar'),
    headerInfo,
    menuWrap
  ));

  const body = postBodyNode(p);
  card.append(body);

  if (p.sharedPostId) {
    if (p.sharedPost && !p.sharedPost.deleted) {
      const sp = p.sharedPost;
      const sCard = el('div', { class: 'feed-card', style: 'margin-top:12px; padding:12px 16px; margin-bottom:0; box-shadow:none; cursor:pointer;' });
      sCard.onclick = () => emit('nav', { page: 'post/' + sp.id });
      sCard.append(el('div', { class: 'feed-head', style: 'margin-bottom:8px;' },
        // 🔴 AUDIT-TASK-10 / Faza 1.4 — `checkJs` ƏSL QÜSUR tapdı:
        // burada stil obyekti `avatarNode`-un ÜÇÜNCÜ parametrinə (`online`)
        // ötürülürdü. Obyekt truthy olduğu üçün sitat gətirilən postun
        // müəllifinə HƏMİŞƏ yanlış "onlayn" nöqtəsi əlavə olunurdu, stillər
        // isə sükutla itirdi. Ölçü indi `.avatar-mini` sinfi ilə verilir.
        avatarNode({ name: sp.authorName }, 'avatar avatar-mini'),
        el('div', { class: 'feed-head-info' },
          el('div', { class: 'feed-head-top' },
            el('span', { class: 'name', style: 'font-size:0.85em;' }, sp.authorName)
          )
        ),
        el('div', { class: 'feed-head-meta', style: 'margin-left:auto;' },
          el('span', { class: 'when' }, fmtTime(sp.createdAt))
        )
      ));
      sCard.append(postBodyNode(sp));
      card.append(sCard);
    } else {
      card.append(el('div', { class: 'shared-post-deleted', style: 'margin-top:10px; padding:10px; border:1px dashed var(--card-border); border-radius:8px; color:var(--muted); font-style:italic;' }, '⚠ ' + t('share.deleted')));
    }
  }

  if(!full){
    // uzun postları kəs: render sonrası hündürlüyə bax
    requestAnimationFrame(() => {
      if(body.scrollHeight > 420){
        body.classList.add('clamped');
        card.insertBefore(
          el('button', { class: 'read-more', onclick: () => emit('nav', { page: 'post/' + p.id }) }, t('dyn.read_more'), iconChevron()),
          body.nextSibling);
      }
    });
  }

  if(p.tags && p.tags.length){
    card.append(el('div', { class: 'feed-tags' }, p.tags.map(t => el('span', { class: 'tag on' }, t))));
  }

  const liked = state.myLikes.has(p.id);
  const marked = state.myBookmarks.has(p.id);
  const reposted = state.myReposts.has(p.sharedPostId || p.id);

  // İkonlar `replaceWith` ilə yerində əvəzlənir (klonlanmır) — belədə düymənin
  // DOM quruluşu (svg + span.count) və fokusu toxunulmaz qalır, yalnız görünüş
  // dəyişir. Bu, aşağıdakı `_cxPatch`-in kartı yenidən qurmadan işləməsini
  // mümkün edir.
  let likeIcon = iconHeart(liked);
  const likeCountEl = el('span', { class: 'count' }, p.likeCount || 0);
  const setLikeUI = (on, n) => {
    likeBtn.classList.toggle('on', on);
    likeBtn.setAttribute('aria-pressed', String(on));
    const next = iconHeart(on);
    likeIcon.replaceWith(next);
    likeIcon = next;
    likeCountEl.textContent = n;
  };

  const likeBtn = el('button', {
    type: 'button',
    class: 'act-btn like-btn' + (liked ? ' on' : ''),
    'aria-label': 'Like',
    'aria-pressed': String(liked),
    onclick: async e => {
      e.preventDefault();
      e.stopPropagation();
      const btn = e.currentTarget;
      if(btn.disabled) return;
      btn.disabled = true;
      const wasLiked = state.myLikes.has(p.id);
      const nextLiked = !wasLiked;

      // Optimistic: sayğac + ikon dərhal; naviqasiya/remount YOX.
      p.likeCount = Math.max(0, (p.likeCount || 0) + (nextLiked ? 1 : -1));
      setLikeUI(nextLiked, p.likeCount);
      if(nextLiked){
        btn.classList.add('pop');
        setTimeout(() => btn.classList.remove('pop'), 300);
      }
      likeCountEl.classList.add('bump');
      setTimeout(() => likeCountEl.classList.remove('bump'), 300);

      try{
        await toggleLike(p);
      }catch(err){
        // rollback — server qəbul etmədi
        p.likeCount = Math.max(0, (p.likeCount || 0) + (nextLiked ? -1 : 1));
        setLikeUI(wasLiked, p.likeCount);
        toast(t('dyn.err_generic'), 'err');
      }
      btn.disabled = false;
    }
  }, likeIcon, likeCountEl);

  const commentCountEl = el('span', { class: 'count' }, p.commentCount || 0);
  const commentBtn = el('button', {
    type: 'button',
    class: 'act-btn comment-btn',
    'aria-label': 'Comment',
    onclick: e => { e.preventDefault(); emit('nav', { page: 'post/' + p.id }); }
  }, iconComment(), commentCountEl);

  const shareCountEl = el('span', { class: 'count' }, p.shareCount || 0);
  const setShareUI = (on, n) => {
    shareBtn.classList.toggle('on', on);
    shareBtn.setAttribute('aria-pressed', String(on));
    shareCountEl.textContent = n;
  };
  const shareBtn = el('button', {
    type: 'button',
    class: 'act-btn share-btn' + (reposted ? ' on' : ''),
    'aria-label': 'Share',
    'aria-pressed': String(reposted),
    title: t('share.title'),
    // Repost nəticəsi kartı yenidən qurmadan yerində əks olunur.
    onclick: e => { e.preventDefault(); openShareModal(p, (on, delta) => {
      p.shareCount = Math.max(0, (p.shareCount || 0) + delta);
      setShareUI(on, p.shareCount);
    }); }
  }, iconShare(), shareCountEl);

  let bmIcon = iconBookmark(marked);
  const setBookmarkUI = on => {
    bookmarkBtn.classList.toggle('on', on);
    bookmarkBtn.setAttribute('aria-pressed', String(on));
    const next = iconBookmark(on);
    bmIcon.replaceWith(next);
    bmIcon = next;
  };
  const bookmarkBtn = el('button', {
    type: 'button',
    class: 'act-btn bm' + (marked ? ' on' : ''),
    'aria-label': 'Save',
    'aria-pressed': String(marked),
    onclick: async e => {
      e.preventDefault();
      e.stopPropagation();
      const btn = e.currentTarget;
      if(btn.disabled) return;
      btn.disabled = true;
      const wasMarked = state.myBookmarks.has(p.id);
      setBookmarkUI(!wasMarked);
      try{
        await toggleBookmark(p.id);
        toast(wasMarked ? t('dyn.unsaved') : t('dyn.saved'));
      }catch(err){
        setBookmarkUI(wasMarked);
        toast(t('dyn.err_generic'), 'err');
      }
      btn.disabled = false;
    }
  }, bmIcon);

  const actions = el('div', { class: 'feed-actions' },
    likeBtn,
    commentBtn,
    shareBtn,
    el('div', { class: 'act-spacer' }),
    bookmarkBtn
  );

  card.append(actions);

  // Feed poll-u gələndə kart YENİDƏN QURULMUR — yalnız dəyişkən hissələr
  // (sayğaclar + like/bookmark/repost vəziyyəti) yerində yenilənir. Beləliklə
  // scroll mövqeyi, fokus və açıq dropdown qorunur.
  card._cxPatch = np => {
    p = np;
    setLikeUI(state.myLikes.has(p.id), p.likeCount || 0);
    setBookmarkUI(state.myBookmarks.has(p.id));
    setShareUI(state.myReposts.has(p.sharedPostId || p.id), p.shareCount || 0);
    commentCountEl.textContent = p.commentCount || 0;
    if(lvlBadge){
      const a = state.users.get(p.authorUid);
      if(a) lvlBadge.textContent = `LVL ${levelFromXP(a.xp)}`;
    }
  };

  return card;
}

/* ---------- feed ---------- */
function postSearchText(p){
  const blockText = Array.isArray(p.blocks)
    ? p.blocks.map(b => (b.content || '') + ' ' + (b.caption || '')).join(' ')
    : (p.text || '') + ' ' + (p.code || '');
  return (blockText + ' ' + (p.authorName || '') + ' ' + (p.tags || []).join(' ')).toLowerCase();
}

function filteredPosts(){
  const qStr = (document.getElementById('feedSearch').value || '').trim().toLowerCase();
  let list = posts;
  if(feedTab === 'following'){
    list = list.filter(p => state.myFollowing.has(p.authorUid));
  }
  if(qStr) list = list.filter(p => postSearchText(p).includes(qStr));
  return list;
}

let feedTab = 'all'; // 'all' | 'following'
export function setFeedTab(t){ feedTab = t; renderFeed(); }
export function getFeedTab(){ return feedTab; }

/* ---------- keyed reconciliation ----------
   Feed hər 10 saniyədə poll olunur. Əvvəl hər poll `clear(feed)` edib bütün
   kartları sıfırdan qururdu: scroll atılır, açıq dropdown bağlanır, fokus itir,
   giriş animasiyası təkrar oynayırdı — istifadəçi üçün bu, səhifənin öz-özünə
   yenidən yüklənməsi kimi görünürdü (TASK-7 / Bənd 3).

   İndi kartlar `id` üzrə açarlanır: məzmun imzası dəyişməyibsə DOM-a heç
   toxunulmur, dəyişkən hissələr isə `_cxPatch` ilə yerində yenilənir.        */

// Yalnız bu imza dəyişəndə kart yenidən qurulur. Sayğaclar və like/bookmark/
// repost vəziyyəti QƏSDƏN buraya daxil deyil — onlar patch ilə idarə olunur.
function postSig(p){
  return [
    p.id,
    p.editedAt || 0,
    p.postType || 'original',
    p.originalDeleted ? 1 : 0,
    (p.sharedPost && p.sharedPost.deleted) ? 'del' : (p.sharedPostId || ''),
    (p.tags || []).join(','),
  ].join('|');
}

// container → Map(postId → { node, sig }). Hər siyahı öz indeksini saxlayır.
const cardIndexes = new WeakMap();

function reconcilePosts(container, list, emptyNode){
  let index = cardIndexes.get(container);
  if(!index){ index = new Map(); cardIndexes.set(container, index); }

  if(!list.length){
    index.clear();
    clear(container);
    if(emptyNode) container.append(emptyNode);
    return;
  }
  // skeleton / empty-state qalığı varsa təmizlə (kart olmayan uşaqlar).
  if(container.querySelector(':scope > .skeleton, :scope > .empty-state')){
    clear(container);
    index.clear();
  }

  const seen = new Set();
  let prev = null;
  list.forEach((p, i) => {
    seen.add(p.id);
    const sig = postSig(p);
    let entry = index.get(p.id);
    if(entry && entry.sig !== sig){
      // məzmun həqiqətən dəyişib (redaktə, orijinalın silinməsi...) → bu TƏK kartı yenilə
      const fresh = postCard(p);
      entry.node.replaceWith(fresh);
      entry = { node: fresh, sig };
      index.set(p.id, entry);
    } else if(!entry){
      const node = postCard(p);
      node.style.animationDelay = Math.min(i * 40, 300) + 'ms';
      entry = { node, sig };
      index.set(p.id, entry);
    }
    if(entry.node._cxPatch) entry.node._cxPatch(p);
    // Sıra: yalnız mövqe səhvdirsə DOM-a toxun.
    const shouldBeAt = prev ? prev.nextSibling : container.firstChild;
    if(entry.node !== shouldBeAt) container.insertBefore(entry.node, shouldBeAt);
    prev = entry.node;
  });

  index.forEach((entry, id) => {
    if(seen.has(id)) return;
    entry.node.remove();
    index.delete(id);
  });
}

// Silinən postu keşdən + açıq siyahılardan çıxarır (remount/reload olmadan).
function removePostLocally(postId){
  posts = posts.filter(x => x.id !== postId);
  setFeedCache(posts);
  [document.getElementById('homeFeed'), document.getElementById('savedFeed')].forEach(box => {
    if(!box) return;
    const index = cardIndexes.get(box);
    const entry = index && index.get(postId);
    if(entry){ entry.node.remove(); index.delete(postId); }
  });
  renderFeed();
}

function renderFeed(){
  const feed = document.getElementById('homeFeed');
  if(!document.getElementById('page-home').classList.contains('active')) return;
  reconcilePosts(feed, filteredPosts(),
    emptyState('✎', feedTab === 'following' ? t('feed.empty_following') : t('feed.empty_all')));
}

function renderHomeStats(){
  document.getElementById('homeGreeting').textContent = t('feed.greeting') + ', ' + (state.me.name || '').split(' ')[0] + '!';
  document.getElementById('homeStreakNum').textContent = state.me.streak || 0;
  document.getElementById('homeXPNum').textContent = state.me.xp || 0;
  document.getElementById('homeUserCount').textContent = state.users.size;
}

/* ---------- post redaktə (bloklar daxil) ---------- */
function openPostEdit(p){
  const editors = [];
  const body = el('div', {});
  if(Array.isArray(p.blocks) && p.blocks.length){
    p.blocks.forEach((b, i) => {
      if(b.type === 'image'){
        body.append(el('p', { style: 'font-size:.74rem; color:var(--muted); margin-bottom:8px;' }, t('feed.img_edit_note') + ` (#${i + 1})`));
        editors.push(null);
        return;
      }
      const ta = el('textarea', { maxLength: b.type === 'code' ? 8000 : 4000 });
      ta.value = b.content || '';
      if(b.type === 'code') ta.style.fontFamily = 'var(--mono)';
      body.append(el('div', { style: 'font-size:.7rem; color:var(--muted); margin-bottom:3px;' }, b.type === 'code' ? t('comp.type_code') : t('comp.type_text')), ta);
      editors.push(ta);
    });
  } else {
    const ta = el('textarea', { maxLength: 4000 });
    ta.value = p.code || p.text || '';
    if(p.code) ta.style.fontFamily = 'var(--mono)';
    body.append(ta);
    editors.push(ta);
  }
  showModal([
    el('div', { class: 'section-title' }, t('feed.edit_title')),
    body,
    el('button', { class: 'btn-small', onclick: async () => {
      try{
        if(Array.isArray(p.blocks) && p.blocks.length){
          const newBlocks = p.blocks.map((b, i) => editors[i] ? { ...b, content: editors[i].value } : b);
          await updatePost(p.id, { blocks: newBlocks, text: ((newBlocks.find(x => x.type === 'text') || {}).content || '').slice(0, 300) });
        } else {
          const v = editors[0].value.trim();
          if(!v) return;
          await updatePost(p.id, p.code ? { code: v } : { text: v });
        }
        closeModal();
        toast(t('dyn.post_upd'));
      }catch(e){ console.error(e); toast(t('dyn.upd_fail'), 'err'); }
    } }, t('dyn.save')),
  ], { wide: true });
}

/* ---------- post detal səhifəsi (#post/{id}) ---------- */
let detailUnsub = null;
export function mountPost(postId){
  const box = document.getElementById('postDetail');
  clear(box);
  if(!postId){ box.append(emptyState('✎', t('feed.not_found'))); return () => {}; }
  skeletons(box, 2);

  (async () => {
    let p = posts.find(x => x.id === postId);
    if(!p) p = await getPostById(postId).catch(() => null);
    clear(box);
    if(!p){ box.append(emptyState('✎', t('feed.not_found_del'))); return; }

    const postText = (p.text || p.code || '').substring(0, 150).replace(/\n/g, ' ') + '...';
    updateDynamicSEO({
      title: p.authorName + ' — Collabix',
      description: postText,
      url: SITE + '/post/' + p.id,
      schema: {
        "@context": "https://schema.org",
        "@type": "SocialMediaPosting",
        "headline": postText,
        "author": { "@type": "Person", "name": p.authorName },
        "datePublished": new Date(p.createdAt).toISOString()
      }
    });

    box.append(postCard(p, { full: true }));
    mountComments(box, p);
  })();

  return () => { if(detailUnsub){ detailUnsub(); detailUnsub = null; } };
}

/* ---------- rəylər: LinkedIn üslubu (thread + reaksiya + sort + daha çox) ----------
   Poll ilə uzlaşan anti-flash: məzmun imzası dəyişməyibsə DOM-a toxunulmur; açıq
   cavab/redaktə kompozeri varsa poll re-render etmir (yazılan mətn, fokus qorunur —
   Bənd 3 prinsipi rəylərə də şamil). */
function mountComments(box, p){
  let cSort = 'new';                 // 'new' | 'top'
  let cLimit = 20;
  let cData = { comments: [], replies: {}, total: 0, hasMore: false };
  let lastSig = '';
  let composerOpen = false;

  const sortBar = el('div', { class: 'comment-sortbar' });
  const commentsBox = el('div', { class: 'comments-thread' });
  const moreWrap = el('div', { class: 'c-more-wrap' });

  const input = el('input', { placeholder: t('feed.ph_comment'), maxLength: 1000 });
  const send = async () => {
    const text = input.value.trim();
    if(!text) return;
    input.value = '';
    try{ await addComment(p, text); }
    catch(e){ toast(t('feed.comment_fail'), 'err'); input.value = text; }
  };
  input.addEventListener('keydown', e => { if(e.key === 'Enter' && !e.defaultPrevented) send(); });
  attachMentionAutocomplete(input);

  const renderSortBar = () => {
    clear(sortBar);
    const mk = (val, lbl) => el('button', { type: 'button', class: 'csort' + (cSort === val ? ' active' : ''),
      onclick: () => { if(cSort === val) return; cSort = val; resubscribe(); } }, lbl);
    sortBar.append(
      el('span', { class: 'c-head-title' }, t('feed.comments'),
        cData.total ? el('span', { class: 'c-count-badge' }, cData.total) : null),
      el('div', { class: 'csort-group' }, mk('new', t('feed.sort_new')), mk('top', t('feed.sort_top'))),
    );
  };

  const likeBtn = (c) => {
    let liked = !!c.likedByMe, count = c.likeCount || 0;
    let ic = iconHeart(liked);
    const countEl = el('span', { class: 'count' }, count);
    const btn = el('button', { type: 'button', class: 'c-like' + (liked ? ' on' : ''), 'aria-pressed': String(liked),
      onclick: async e => {
        e.preventDefault();
        if(btn.disabled) return;
        btn.disabled = true;
        const was = liked;
        liked = !liked; count = Math.max(0, count + (liked ? 1 : -1));
        const paint = () => { const nx = iconHeart(liked); ic.replaceWith(nx); ic = nx; btn.classList.toggle('on', liked); btn.setAttribute('aria-pressed', String(liked)); countEl.textContent = count; };
        paint();
        try{ await toggleCommentLike(p.id, c.id, was); }
        catch(err){ liked = was; count = Math.max(0, count + (was ? 1 : -1)); paint(); toast(t('dyn.err_generic'), 'err'); }
        btn.disabled = false;
      } }, ic, countEl);
    return btn;
  };

  const openReply = (parent, parentAuthor) => {
    const holder = document.getElementById('creply-' + parent.id);
    if(!holder) return;
    if(holder.firstChild){ clear(holder); composerOpen = false; return; }   // toggle bağla
    composerOpen = true;
    const rin = el('input', { class: 'c-reply-input', placeholder: t('feed.ph_reply'), maxLength: 1000 });
    if(parentAuthor && parentAuthor.username && parentAuthor.uid !== state.authUser.uid) rin.value = '@' + parentAuthor.username + ' ';
    const rsend = async () => {
      const text = rin.value.trim();
      if(!text) return;
      rin.disabled = true;
      try{ await addComment(p, text, parent.id); clear(holder); composerOpen = false; }
      catch(e){ toast(t('feed.comment_fail'), 'err'); rin.disabled = false; }
    };
    rin.addEventListener('keydown', e => { if(e.key === 'Enter' && !e.defaultPrevented) rsend(); });
    holder.append(el('div', { class: 'c-reply-row' }, rin,
      el('button', { type: 'button', class: 'btn-small', onclick: rsend }, '➤'),
      el('button', { type: 'button', class: 'btn-mini', onclick: () => { clear(holder); composerOpen = false; } }, '✕')));
    attachMentionAutocomplete(rin);
    rin.focus();
    rin.setSelectionRange(rin.value.length, rin.value.length);
  };

  const openEdit = (c, textEl) => {
    if(textEl.nextSibling && textEl.nextSibling.classList && textEl.nextSibling.classList.contains('c-edit-row')) return;
    composerOpen = true;
    const ta = el('textarea', { class: 'c-edit-ta', maxLength: 1000 });
    ta.value = c.text;
    const close = () => { editRow.remove(); textEl.style.display = ''; composerOpen = false; };
    const save = async () => {
      const v = ta.value.trim();
      if(!v) return;
      try{ await editComment(p.id, c.id, v); composerOpen = false; }
      catch(e){ toast(t('dyn.upd_fail'), 'err'); }
    };
    const editRow = el('div', { class: 'c-edit-row' }, ta,
      el('div', { class: 'c-edit-btns' },
        el('button', { type: 'button', class: 'btn-small', onclick: save }, t('dyn.save')),
        el('button', { type: 'button', class: 'btn-mini', onclick: close }, t('dyn.cancel'))));
    textEl.style.display = 'none';
    textEl.after(editRow);
    attachMentionAutocomplete(ta);
    ta.focus();
  };

  const doDelete = async (c) => {
    const hasReplies = (cData.replies[c.id] || []).length > 0;
    if(!await confirmDialog(hasReplies ? t('feed.comment_del_replies_conf') : t('feed.comment_del_conf'))) return;
    try{ await deleteComment(p.id, c.id); }catch(e){ toast(t('dyn.del_fail'), 'err'); }
  };

  const commentRow = (c, isReply) => {
    const author = state.users.get(c.authorUid);
    const mine = c.authorUid === state.authUser.uid;
    const canManage = mine || state.isAdmin || p.authorUid === state.authUser.uid;
    const textEl = el('p', { class: 'cm-text' }, mentionify(c.text));
    return el('div', { class: 'comment-row' + (isReply ? ' is-reply' : '') },
      avatarNode(author || { name: c.authorName }, 'avatar c-avatar'),
      el('div', { class: 'c-body' },
        el('div', { class: 'c-meta' },
          el('button', { type: 'button', class: 'c-name', onclick: () => author && emit('nav', { page: 'u/' + author.username }) },
            nameWithBadge(author || { name: c.authorName })),
          el('span', { class: 'c-when', title: fmtTime(c.createdAt) }, fmtRelTime(c.createdAt)),
          c.editedAt ? el('span', { class: 'edited-mark' }, ' ' + t('feed.edited')) : null,
        ),
        textEl,
        el('div', { class: 'c-actions' },
          likeBtn(c),
          el('button', { type: 'button', class: 'c-act', onclick: () => openReply(c, author) }, t('feed.reply')),
          mine ? el('button', { type: 'button', class: 'c-act', onclick: () => openEdit(c, textEl) }, t('feed.menu_edit')) : null,
          canManage ? el('button', { type: 'button', class: 'c-act danger', onclick: () => doDelete(c) }, t('feed.menu_del')) : null,
        ),
      ),
    );
  };

  const renderComments = () => {
    renderSortBar();
    clear(commentsBox);
    if(!cData.comments.length){
      commentsBox.append(el('p', { class: 'c-empty' }, t('feed.no_comments')));
    } else {
      cData.comments.forEach(c => {
        const kids = cData.replies[c.id] || [];
        commentsBox.append(el('div', { class: 'comment-thread' },
          commentRow(c, false),
          el('div', { class: 'c-reply-holder', id: 'creply-' + c.id }),
          kids.length ? el('div', { class: 'c-replies' }, ...kids.map(k => commentRow(k, true))) : null,
        ));
      });
    }
    clear(moreWrap);
    if(cData.hasMore){
      moreWrap.append(el('button', { type: 'button', class: 'btn-mini block c-more', onclick: () => { cLimit += 20; resubscribe(); } }, t('feed.load_more_comments')));
    }
  };

  box.append(
    el('div', { class: 'comment-head' }, sortBar),
    el('div', { class: 'comment-input-row' }, input, el('button', { type: 'button', class: 'btn-small', onclick: send }, '➤')),
    commentsBox,
    moreWrap,
  );
  renderSortBar();

  const sigOf = d => JSON.stringify([
    cSort, d.total, d.hasMore,
    d.comments.map(c => [c.id, c.likeCount, c.editedAt || 0, c.text]),
    Object.keys(d.replies).sort().map(pid => [pid, d.replies[pid].map(r => [r.id, r.likeCount, r.editedAt || 0, r.text])]),
  ]);

  const onComments = d => {
    cData = d;
    if(composerOpen) return;                 // yazılan cavab/redaktə itməsin
    const sig = sigOf(d);
    if(sig === lastSig){ renderSortBar(); return; }
    lastSig = sig;
    renderComments();
  };

  const resubscribe = () => {
    if(detailUnsub){ detailUnsub(); detailUnsub = null; }
    lastSig = '';
    detailUnsub = watchComments(p.id, { sort: cSort, limit: cLimit }, onComments);
  };
  resubscribe();
}

// ⚠ Bu modal HƏM feed şəkilləri, HƏM DƏ söhbət əlavələri üçün işlədilir
// (`richmsg.js` çağırır), ona görə burada `isSafeFileURL` lazımdır —
// `isSafeImageURL` DM şəkil önizləməsini sındırardı (AUDIT-TASK-7 §5.2/tələ 2).
export function openImageModal(src){
  if(!isSafeFileURL(src)) return;
  const img = document.createElement('img');
  img.className = 'modal-img'; img.src = src; img.alt = '';
  showModal([img], { wide: true });
}

/* ---------- mount ---------- */
export function mountHome(){
  renderHomeStats();
  // Skeleton yalnız ilk yükləmədə: mövcud kartlar varsa onları silmirik,
  // əks halda hər dəfə home-a qayıdanda süni "flash" yaranırdı.
  const feedBox = document.getElementById('homeFeed');
  if(!feedBox.querySelector('.feed-card')) skeletons(feedBox, 3);
  renderFeed();
  const rerender = () => { renderHomeStats(); renderFeed(); };
  ['feed-updated', 'users-updated', 'likes-updated', 'bookmarks-updated', 'follows-updated'].forEach(ev => bus.addEventListener(ev, rerender));
  const input = document.getElementById('feedSearch');
  const onSearch = debounce(renderFeed, 200);
  input.addEventListener('input', onSearch);
  return () => {
    ['feed-updated', 'users-updated', 'likes-updated', 'bookmarks-updated', 'follows-updated'].forEach(ev => bus.removeEventListener(ev, rerender));
    input.removeEventListener('input', onSearch);
  };
}

/* ---------- Saxlanılanlar səhifəsi ---------- */
let savedRun = 0;   // üst-üstə düşən çağırışlarda yalnız sonuncusu render etsin
async function renderSaved(){
  const box = document.getElementById('savedFeed');
  if(!document.getElementById('page-saved').classList.contains('active')) return;
  const run = ++savedRun;
  const ids = [...state.myBookmarks];
  if(!ids.length){ reconcilePosts(box, [], emptyState('★', t('feed.empty_saved'))); return; }
  const cached = new Map(posts.map(p => [p.id, p]));
  const items = [];
  for(const id of ids){
    if(cached.has(id)) items.push(cached.get(id));
    else{
      const p = await getPostById(id).catch(() => null);
      if(p) items.push(p);
    }
  }
  if(run !== savedRun) return;   // daha yeni çağırış başlayıb — bunu at
  // createdAt epoch ms-dir (INTEGER). Əvvəl burada Firestore-dan qalma
  // `createdAt?.toMillis?.()` çağırılırdı — həmişə undefined olduğu üçün
  // müqayisə 0-0 olur və sıralama heç işləmirdi.
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  reconcilePosts(box, items, emptyState('★', t('feed.empty_del')));
}

export function mountSaved(){
  const savedBox = document.getElementById('savedFeed');
  if(!savedBox.querySelector('.feed-card')) skeletons(savedBox, 2);
  renderSaved();
  const savedEvents = ['bookmarks-updated', 'bookmarks-changed', 'feed-updated'];
  savedEvents.forEach(ev => bus.addEventListener(ev, renderSaved));
  return () => savedEvents.forEach(ev => bus.removeEventListener(ev, renderSaved));
}

// Qlobal feed listener-i (login müddətində aktiv).
export function subscribeFeed(){
  return watchFeed(items => {
    posts = items;
    deriveMyReposts(items);
    setFeedCache(items);
    emit('feed-updated');
  });
}
export function getPosts(){ return posts; }
