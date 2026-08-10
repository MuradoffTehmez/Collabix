// İdarəetmə paneli — PLATFORMA rolları, moderasiya və moderator namizədliyi.
//
// ════════════════════════════════════════════════════════════════════════════
// 🔴 PLATFORMA ROLU ≠ KOMANDA ROLU
// ════════════════════════════════════════════════════════════════════════════
//
// Layihədə İKİ ayrı rol sistemi var və onları qarışdırmaq ən böyük istifadəçi
// çaşqınlığı mənbəyidir:
//
//   PLATFORMA ROLU (bu fayl)      KOMANDA ROLU (js/teams.js)
//   ───────────────────────       ─────────────────────────────
//   OWNER…GUEST, 10 sabit rol     komanda özü yaradır, sərbəst ad
//   bütün sayta şamil olur        YALNIZ bir komandaya
//   `users.role`                  `team_members.permissions`
//   `roles`/`permissions`         `team_roles`
//   admin təyin edir              komanda sahibi təyin edir
//
// Bir istifadəçi qlobal `USER`, öz komandasında `Owner` ola bilər — bu,
// ziddiyyət DEYİL. UI hər iki yerdə mənbəni AÇIQ yazır ki, istifadəçi
// "mən Owner-əm, niyə admin panelinə girə bilmirəm?" sualını verməsin.
import { el, clear } from './util.js';
import { api } from './api.js';
import { toast, showModal, closeModal, confirmDialog, skeletons } from './ui.js';
import { state } from './store.js';
// ⚠ Bu modulun mətnləri ƏVVƏL SABİT azərbaycanca idi — dil dəyişəndə
//   moderasiya və dəvət bölmələri tərcümə olunmurdu (istifadəçi bildirdi).
import { t } from './i18n.js';

/* ═══════════════════════ ORTAQ KÖMƏKÇİLƏR ═══════════════════════ */

/**
 * Rolun vizual tonu — PRİORİTETƏ görə, ada görə YOX.
 *
 * ⚠ Ada görə seçsəydik (`if role === 'ADMIN'`) `roles` cədvəlinə yeni rol
 *   əlavə olunanda o, rəngsiz qalardı. Prioritet isə hər rolda var.
 */
export function roleTone(priority) {
  if (priority >= 90) return 'danger';    // OWNER / SUPER_ADMIN
  if (priority >= 80) return 'accent';    // ADMIN
  if (priority >= 60) return 'warn';      // moderatorlar
  if (priority >= 30) return 'info';      // PREMIUM / VERIFIED
  return '';
}

function userCell(u) {
  const initial = (u.name || u.username || '?').trim().charAt(0).toUpperCase();
  const av = u.photoURL
    ? el('img', { class: 'c-user__av', src: u.photoURL, alt: '', loading: 'lazy' })
    : el('div', { class: 'c-user__av' }, initial);
  return el('div', { class: 'c-user' }, av,
    el('div', { class: 'c-user__meta' },
      el('span', { class: 'c-user__name' }, u.name || u.username || '—'),
      el('span', { class: 'c-user__handle' }, '@' + (u.username || ''))));
}

const fmtDate = ts => ts ? new Date(Number(ts)).toLocaleDateString('az-AZ') : '—';

/** Boş vəziyyət — dizayn sistemi primitivi ilə. */
function empty(icon, title, text) {
  return el('div', { class: 'c-empty' },
    el('div', { class: 'c-empty__icon' }, icon),
    el('div', { class: 'c-empty__title' }, title),
    text ? el('div', { class: 'c-empty__text' }, text) : null);
}

/* ═══════════════════════ 1. PLATFORMA ROLLARI ═══════════════════════ */

let rolesCache = [];

async function loadRoles() {
  if (rolesCache.length) return rolesCache;
  const d = await api('/roles');
  rolesCache = d.roles || [];
  return rolesCache;
}

/**
 * Rol dəyişmə modalı.
 *
 * ⚠ SERVER SON SÖZÜ DEYİR: `assertCanAssignRole` özündən yüksək və ya bərabər
 *   rol təyinini rədd edir. UI həmin variantları GİZLƏTMİR — göstərir, lakin
 *   server rədd edərsə səbəbi toast-da görünür. Gizlətsəydik istifadəçi
 *   "niyə bu rol yoxdur?" sualına cavab tapmazdı.
 */
export async function openRoleEditor(user) {
  const roles = await loadRoles();
  const sel = el('select', { id: 'govRoleSel' });
  for (const r of roles) {
    sel.append(el('option', {
      value: r.name,
      ...(r.name === user.role ? { selected: '' } : {}),
    }, `${r.labelAz || r.name} (${r.name})`));
  }

  const note = el('p', { class: 'c-field__hint' },
    t('gov.role_note'));

  const save = el('button', { class: 'c-btn c-btn--primary' }, t('gov.role_save'));
  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      await api(`/users/${user.uid}/role`, { method: 'PUT', body: { role: sel.value } });
      toast(t('gov.role_ok'));
      closeModal();
      document.dispatchEvent(new CustomEvent('gov:role-changed', { detail: { uid: user.uid } }));
    } catch (e) {
      toast(e.message || t('gov.role_err'), 'err');
      save.disabled = false;
    }
  });

  showModal([
    el('div', { class: 'c-modal__head' },
      el('h3', { class: 'c-modal__title' }, t('gov.role_title'))),
    el('div', { class: 'c-modal__body' },
      userCell(user),
      el('div', { class: 'c-field', style: 'margin-top:16px' },
        el('label', { class: 'c-field__label', for: 'govRoleSel' }, 'Rol'),
        sel, note)),
    el('div', { class: 'c-modal__foot' },
      el('button', { class: 'c-btn c-btn--ghost', onclick: closeModal }, 'Ləğv et'),
      save),
  ]);
}

/* ═══════════════════════ 2. MODERATOR NAMİZƏDLƏRİ ═══════════════════════ */

let appFilter = 'pending';

function checkRow(label, ok, current, required) {
  return el('div', { class: `c-check ${ok ? 'c-check--ok' : 'c-check--fail'}` },
    // ⚠ İşarə RƏNGDƏN ƏLAVƏ siqnaldır — rəng korluğu üçün (WCAG 1.4.1).
    el('span', { class: 'c-check__icon' }, ok ? '✓' : '✗'),
    el('span', { class: 'c-check__label' }, label),
    el('span', { class: 'c-check__value' }, `${current} / ${required}`));
}

function appSnapshot(s) {
  return el('div', { class: 'c-checklist' },
    checkRow(t('gov.chk_age'), s.accountDays >= 90, s.accountDays, 90),
    checkRow(t('gov.chk_level'), s.level >= 10, 'Lv' + s.level, 'Lv10'),
    checkRow('Reputasiya', s.reputation >= 500, s.reputation, 500),
    checkRow(t('gov.chk_warn'), s.warnings30d === 0, s.warnings30d, 0),
    checkRow(t('gov.chk_verified'), s.verified, t(s.verified ? 'gov.yes' : 'gov.no'), t('gov.yes')));
}

async function reviewApp(app, approve) {
  const note = el('textarea', {
    id: 'govNote',
    placeholder: t(approve ? 'gov.note_ph' : 'gov.reject_ph'),
  });
  const btn = el('button', {
    class: `c-btn ${approve ? 'c-btn--primary' : 'c-btn--danger'}`,
  }, t(approve ? 'gov.approve_btn' : 'gov.reject_btn'));

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await api(`/admin/moderator-applications/${app.id}/review`, {
        method: 'POST', body: { approve, note: note.value },
      });
      toast(t(approve ? 'gov.approved_ok' : 'gov.rejected_ok'));
      closeModal();
      renderModApps();
    } catch (e) {
      toast(e.message || t('gov.act_err'), 'err');
      btn.disabled = false;
    }
  });

  showModal([
    el('div', { class: 'c-modal__head' },
      el('h3', { class: 'c-modal__title' },
        t(approve ? 'gov.approve_title' : 'gov.reject_title'))),
    el('div', { class: 'c-modal__body' },
      userCell(app),
      el('p', { class: 'c-panel__sub' }, app.message),
      el('div', { class: 'c-panel__head', style: 'margin-top:20px' },
        el('h4', { class: 'c-panel__title' }, 'Müraciət anındakı göstəricilər')),
      // ⚠ SNAPSHOT göstərilir, cari dəyər YOX: admin müraciətə bir həftə
      //   sonra baxa bilər və qərar müraciət anındakı vəziyyətə əsaslanmalıdır.
      appSnapshot(app.snapshot),
      el('div', { class: 'c-field', style: 'margin-top:20px' },
        el('label', { class: 'c-field__label', for: 'govNote' }, 'Qeyd'), note)),
    el('div', { class: 'c-modal__foot' },
      el('button', { class: 'c-btn c-btn--ghost', onclick: closeModal }, 'Bağla'),
      btn),
  ]);
}

export async function renderModApps() {
  const host = document.getElementById('govModApps');
  if (!host) return;
  clear(host);
  skeletons(host, 3);

  let apps;
  try {
    const d = await api(`/admin/moderator-applications?status=${appFilter}`);
    apps = d.applications || [];
  } catch (e) {
    clear(host);
    // ⚠ 403 BURADA NORMAL HALDIR, qüsur deyil: namizədləri görmək
    //   `MANAGE_ROLES` tələb edir və o, yalnız SUPER_ADMIN+ səviyyəsindədir.
    //   Adi ADMIN bu tabı açanda "xəta" görməməlidir — səbəbi aydın olmalıdır,
    //   əks halda "panel sınıqdır" deyə bildirəcək.
    if (e.status === 403 || e.code === 'forbidden') {
      host.append(empty('🔒', t('gov.forbidden_t'), t('gov.forbidden_d')));
    } else {
      host.append(empty('⚠', t('gov.list_err'), e.message || ''));
    }
    return;
  }

  clear(host);
  if (!apps.length) {
    host.append(empty('📭',
      t(appFilter === 'pending' ? 'gov.no_pending' : 'gov.no_status'),
      t('gov.apply_hint')));
    return;
  }

  const body = el('tbody');
  for (const a of apps) {
    const actions = el('td', { 'data-label': 'Əməliyyat' });
    if (a.status === 'pending') {
      const ok = el('button', { class: 'c-btn c-btn--sm c-btn--primary' }, 'Təsdiqlə');
      const no = el('button', { class: 'c-btn c-btn--sm c-btn--ghost' }, 'Rədd et');
      ok.addEventListener('click', () => reviewApp(a, true));
      no.addEventListener('click', () => reviewApp(a, false));
      actions.append(el('div', { class: 'c-table__actions' }, ok, no));
    } else {
      const tone = a.status === 'approved' ? 'ok' : 'danger';
      actions.append(el('span', { class: `c-badge c-badge--${tone}` }, a.status));
    }

    body.append(el('tr', {},
      el('td', { 'data-label': 'İstifadəçi' }, userCell(a)),
      el('td', { 'data-label': 'Səviyyə', class: 'c-table__num' }, 'Lv' + a.snapshot.level),
      el('td', { 'data-label': 'Reputasiya', class: 'c-table__num' }, String(a.snapshot.reputation)),
      el('td', { 'data-label': 'Xəbərdarlıq', class: 'c-table__num' }, String(a.snapshot.warnings30d)),
      el('td', { 'data-label': 'Müraciət' }, fmtDate(a.createdAt)),
      actions));
  }

  host.append(el('div', { class: 'c-table-wrap' },
    el('table', { class: 'c-table' },
      // AUDIT-UI: `scope="col"` əlavə olundu — başlıq/xana əlaqəsi ekran
      // oxuyucusu üçün. (Mətnlər hələ sabitdir; bu faylın i18n köçürməsi ayrıca iş.)
      el('thead', {}, el('tr', {},
        el('th', { scope: 'col' }, 'İstifadəçi'), el('th', { scope: 'col' }, 'Səviyyə'),
        el('th', { scope: 'col' }, 'Reputasiya'), el('th', { scope: 'col' }, 'Xəbərdarlıq'),
        el('th', { scope: 'col' }, 'Müraciət'), el('th', { scope: 'col' }, 'Əməliyyat'))),
      body)));
}

/* ═══════════════════════ 3. İSTİFADƏÇİ TƏRƏFİ ═══════════════════════ */

/**
 * "Moderator ol" bölməsi — profil səhifəsində.
 *
 * ⚠ ŞƏRTLƏR ÖDƏNMƏSƏ DƏ GÖSTƏRİLİR. Gizlətsəydik istifadəçi belə bir yolun
 *   mövcudluğundan xəbərsiz qalardı; indi isə "nə çatmır" aydındır və bu,
 *   məhsul üçün motivasiya mexanizmidir.
 */
export async function renderModeratorSection() {
  const host = document.getElementById('govModeratorBox');
  if (!host) return;
  clear(host);

  let d;
  try {
    d = await api('/me/moderator-eligibility');
  } catch {
    return;                       // səssiz: bu bölmə kritik deyil
  }

  if (d.alreadyModerator) {
    host.append(el('div', { class: 'c-panel' },
      el('div', { class: 'c-panel__head' },
        el('div', {},
          el('h3', { class: 'c-panel__title' }, t('gov.mod_title')),
          el('p', { class: 'c-panel__sub' },
            t('gov.mod_role').replace('{r}', d.role)))),
      el('span', { class: 'c-badge c-badge--accent' }, d.role)));
    return;
  }

  const checks = el('div', { class: 'c-checklist' });
  for (const ch of d.checks) {
    checks.append(checkRow(ch.label, ch.ok, ch.current, ch.required));
  }

  const foot = el('div', { style: 'margin-top:20px' });
  if (d.pendingId) {
    const wd = el('button', { class: 'c-btn c-btn--ghost' }, t('gov.withdraw_btn'));
    wd.addEventListener('click', async () => {
      if (!await confirmDialog(t('gov.withdraw_q'))) return;
      try {
        await api('/me/moderator-application', { method: 'DELETE' });
        toast(t('gov.withdraw_ok'));
        renderModeratorSection();
      } catch (e) { toast(e.message || t('gov.fail'), 'err'); }
    });
    foot.append(el('span', { class: 'c-badge c-badge--info' }, 'Müraciətiniz baxılır'), ' ', wd);
  } else if (d.cooldownDays > 0) {
    foot.append(el('p', { class: 'c-field__hint' },
      `Yenidən müraciət üçün ${d.cooldownDays} gün qalıb.`));
  } else if (d.eligible) {
    const btn = el('button', { class: 'c-btn c-btn--primary' }, 'Moderator olmaq üçün müraciət et');
    btn.addEventListener('click', openApplyModal);
    foot.append(btn);
  } else {
    foot.append(el('p', { class: 'c-field__hint' },
      t('gov.locked_hint')));
  }

  host.append(el('div', { class: 'c-panel' },
    el('div', { class: 'c-panel__head' },
      el('div', {},
        el('h3', { class: 'c-panel__title' }, 'Moderator olmaq'),
        el('p', { class: 'c-panel__sub' },
          t('gov.apply_note')))),
    checks, foot));
}

function openApplyModal() {
  const ta = el('textarea', {
    id: 'govApplyMsg',
    placeholder: t('gov.apply_ph'),
  });
  const counter = el('div', { class: 'c-field__hint' }, '0 / 1000 (minimum 30)');
  ta.addEventListener('input', () => {
    counter.textContent = `${ta.value.length} / 1000 (minimum 30)`;
  });

  const send = el('button', { class: 'c-btn c-btn--primary' }, 'Müraciəti göndər');
  send.addEventListener('click', async () => {
    if (ta.value.trim().length < 30) {
      toast(t('gov.apply_short'), 'err');
      return;
    }
    send.disabled = true;
    try {
      await api('/me/moderator-application', { method: 'POST', body: { message: ta.value } });
      toast(t('gov.apply_sent'));
      closeModal();
      renderModeratorSection();
    } catch (e) {
      toast(e.message || t('gov.send_err'), 'err');
      send.disabled = false;
    }
  });

  showModal([
    el('div', { class: 'c-modal__head' },
      el('h3', { class: 'c-modal__title' }, t('gov.apply_title'))),
    el('div', { class: 'c-modal__body' },
      el('div', { class: 'c-field' },
        el('label', { class: 'c-field__label', for: 'govApplyMsg' }, 'Motivasiya'),
        ta, counter)),
    el('div', { class: 'c-modal__foot' },
      el('button', { class: 'c-btn c-btn--ghost', onclick: closeModal }, 'Ləğv et'),
      send),
  ]);
}

/* ═══════════════════════ 4. DƏVƏTLƏR ═══════════════════════ */

export async function renderInvites() {
  const host = document.getElementById('govInviteBox');
  if (!host) return;
  clear(host);

  let d;
  try { d = await api('/me/invites'); } catch { return; }

  const list = el('div', { class: 'c-checklist' });
  const active = (d.invites || []).filter(i => i.active);

  if (!active.length) {
    list.append(el('p', { class: 'c-field__hint' }, t('gov.inv_none')));
  }
  for (const i of active) {
    const revoke = el('button', { class: 'c-btn c-btn--sm c-btn--quiet' }, 'Ləğv et');
    revoke.addEventListener('click', async () => {
      if (!await confirmDialog(`${i.code} kodu ləğv edilsin?`)) return;
      try {
        await api(`/me/invites/${i.code}`, { method: 'DELETE' });
        toast(t('gov.inv_revoked'));
        renderInvites();
      } catch (e) { toast(e.message || t('gov.fail'), 'err'); }
    });

    const copy = el('button', { class: 'c-btn c-btn--sm c-btn--ghost' }, 'Kopyala');
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(i.code);
        toast(t('gov.inv_copied'));
      } catch {
        // ⚠ Clipboard API HTTPS və istifadəçi jesti tələb edir; alınmasa
        //   kod onsuz da ekranda görünür (`user-select: all`).
        toast(t('gov.inv_copy_err'), 'err');
      }
    });

    list.append(el('div', { class: 'c-check' },
      el('span', { class: 'c-code' }, i.code),
      el('span', { class: 'c-check__label' },
        `${i.uses}${i.maxUses ? ' / ' + i.maxUses : ''} istifadə`),
      el('div', { class: 'c-table__actions' }, copy, revoke)));
  }

  const create = el('button', { class: 'c-btn c-btn--primary' }, 'Yeni dəvət kodu');
  create.addEventListener('click', async () => {
    create.disabled = true;
    try {
      const r = await api('/me/invites', { method: 'POST' });
      toast(t('gov.inv_created').replace('{c}', r.code));
      renderInvites();
    } catch (e) {
      toast(e.message || t('gov.inv_create_err'), 'err');
    } finally { create.disabled = false; }
  });

  host.append(el('div', { class: 'c-panel' },
    el('div', { class: 'c-panel__head' },
      el('div', {},
        el('h3', { class: 'c-panel__title' }, t('gov.inv_title')),
        el('p', { class: 'c-panel__sub' },
          t('gov.inv_sub').replace('{x}', String(d.xpPerInvite)).replace('{n}', String(d.totalInvited))))),
    list,
    el('div', { style: 'margin-top:16px' }, create)));
}

/* ═══════════════════════ MONTAJ ═══════════════════════ */

export function initGovernance() {
  const tabs = document.getElementById('govAppTabs');
  if (tabs) {
    tabs.addEventListener('click', e => {
      const btn = e.target.closest('button[data-appst]');
      if (!btn) return;
      appFilter = btn.dataset.appst;
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b === btn));
      renderModApps();
    });
  }
}

/** Admin panelinin idarəetmə tabı açılanda çağırılır. */
export function mountGovernanceAdmin() {
  if (!state.isAdmin) return;
  /* 🔴 İCAZƏ YOXDURSA SORĞU ÜMUMİYYƏTLƏ GETMİR.
   *
   *   Namizədləri görmək `MANAGE_ROLES` tələb edir və o, QƏSDƏN yalnız
   *   SUPER_ADMIN+ səviyyəsindədir. Adi ADMIN paneli açanda `renderModApps()`
   *   sorğunu yenə göndərirdi, server 403 qaytarırdı, UI isə onu düzgün
   *   emal edib kilid mesajı göstərirdi — yəni İSTİFADƏÇİ üçün hər şey
   *   qaydasında idi.
   *
   *   Görünməyən zərər konsoldadır: brauzer uğursuz şəbəkə sorğusunu ÖZÜ
   *   `console.error` kimi yazır və bunu heç bir `try/catch` susdura bilmir.
   *   Nəticədə hər admin ziyarətində konsol səbəbsiz qırmızı olurdu və əsl
   *   xətalar həmin fonda itirdi (E2E "sıfır konsol xətası" şərti də məhz
   *   buna görə sınırdı).
   *
   * ⚠ BU AVTORİZASİYA DEYİL. Server qapısı yerindədir və dəyişmir; buradakı
   *   yoxlama yalnız "hansı sorğunu göndərməyə dəyər" sualına cavab verir.
   *   `state.perms` boşdursa (köhnə client, hələ yüklənməmiş sessiya) köhnə
   *   davranış qalır — yəni yoxlama heç vaxt işləyən halı BAĞLAMIR.
   */
  if (state.perms?.length && !state.perms.includes('MANAGE_ROLES')) {
    const host = document.getElementById('govModApps');
    if (host) { clear(host); host.append(empty('🔒', t('gov.forbidden_t'), t('gov.forbidden_d'))); }
    return;
  }
  renderModApps();
}

/** Profil səhifəsi üçün. */
export function mountGovernanceUser() {
  renderModeratorSection();
  renderInvites();
}

// ⚠ Bu modulda `innerHTML` və `esc()` QƏSDƏN İŞLƏDİLMİR: bütün mətn `el()`
//   ilə TextNode kimi qoyulur, yəni istifadəçi məzmunu (ad, motivasiya mətni,
//   rədd səbəbi) heç vaxt HTML kimi parse olunmur — XSS vektoru yoxdur.
