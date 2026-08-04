// İş sahəsi — tapşırıq detalı (sürüşən panel), yaratma modalı və
// sprint / etiket / avtomatlaşdırma panelləri.
//
// ⚠ AYRICA MODUL: panel öz vəziyyətini (açıq tapşırıq, redaktə rejimi)
//   saxlayır və `workspace.js`-in vəziyyətindən ASILI DEYİL. Belədə panel
//   lövhədən, siyahıdan, təqvimdən — hər yerdən eyni cür açılır.
//
// ⚠ `workspace.js`-i IMPORT ETMİR (dövr). Dəyişiklikdən sonra siyahının
//   yenilənməsi `emit('ws-changed')` hadisəsi ilə bildirilir.
import { api } from './api.js';
import { el, clear, avatarNode, emit } from './util.js';
import { t, tOr, fmtRelTime } from './i18n.js';
import { toast, showModal, closeModal, confirmDialog, emptyState } from './ui.js';
import { paintIcons } from './icon-set.js';
import { PRIO, ST_TONE } from './workspace-views.js';
import { markdownNode } from './markdown.js';

const ico = (n, s = 14) => el('span', { class: 'ic', 'data-icon': n, 'data-icon-size': String(s) });
const slug = v => String(v).toLowerCase().replace(/\s+/g, '_');
const dateVal = ts => (ts ? new Date(ts).toISOString().slice(0, 10) : '');
const tsOf = v => (v ? new Date(v + 'T12:00:00').getTime() : null);

/** Meta `workspace.js`-dən gəlir — panel onu ÖZÜ çəkmir (təkrar sorğu olardı). */
let META = { statuses: [], priorities: [], members: [], projects: [], sprints: [], labels: [], teams: [] };
export function setDetailMeta(m){ META = { ...META, ...m }; }

let panel = null;
/* 🔴 FON ÖRTÜYÜ AYRICA SAXLANILIR. Əvvəl o, yalnız lokal dəyişən idi və
   `closeTaskDetail()` yalnız paneli silirdi — örtük DOM-da qalıb BÜTÜN
   səhifəni kliklənməz edirdi (audit tapdı: hər klik `.ws-panel__back`-ə
   düşürdü). Açılan hər şey bağlanmalıdır; bağlama funksiyası ONA da
   çatmalıdır. */
let backdrop = null;
let currentId = null;

/* ═══════════════════════ PANEL QABIĞI ═══════════════════════ */

export function closeTaskDetail(){
  if(backdrop){ backdrop.remove(); backdrop = null; }
  if(!panel) return;
  panel.remove();
  panel = null;
  currentId = null;
  document.removeEventListener('keydown', onEsc);
}

function onEsc(e){ if(e.key === 'Escape') closeTaskDetail(); }

/**
 * Detal panelini açır.
 *
 * ⚠ PANEL `body`-yə YAZILIR, səhifənin içinə YOX: iş sahəsi `overflow`
 *   konteynerləri ilə doludur (Kanban sütunları yan sürüşür) və panel
 *   onların içində qalsaydı KƏSİLƏRDİ.
 */
/**
 * @param {string} id
 * @param {boolean} [force] eyni tapşırıq açıq olsa belə YENİDƏN çək.
 *
 * 🔴 `force` OLMADAN PANEL ÖZÜNÜ YENİLƏYƏ BİLMİRDİ: asılılıq silinəndə,
 *    taymer dayananda və əl ilə vaxt yazılanda kod `openTaskDetail(x.id)`
 *    çağırırdı, lakin `currentId === id` yoxlaması dərhal geri qayıdırdı —
 *    yəni əməliyyat serverdə icra olunurdu, ekranda isə HEÇ NƏ dəyişmirdi.
 */
export async function openTaskDetail(id, force = false){
  if(currentId === id && panel && !force) return;
  closeTaskDetail();
  currentId = id;

  panel = el('aside', {
    class: 'ws-panel', role: 'dialog', 'aria-modal': 'false',
    'aria-label': t('ws.detail'),
  }, el('div', { class: 'ws-panel__sk' }));
  backdrop = el('div', { class: 'ws-panel__back', onclick: closeTaskDetail });
  document.body.append(backdrop, panel);
  document.addEventListener('keydown', onEsc);
  // Fokus panelə keçir — klaviatura istifadəçisi orada qalsın.
  requestAnimationFrame(() => panel && panel.focus && panel.focus());

  try{
    const d = await api('/ws/tasks/' + id);
    if(currentId !== id) return;             // istifadəçi başqasını açıb
    renderDetail(d);
  }catch(e){
    if(!panel) return;
    clear(panel);
    panel.append(closeBtn(), emptyState('info', t('users.err')));
  }
}

const closeBtn = () => el('button', {
  class: 'c-icon-btn ws-panel__x', type: 'button',
  'aria-label': t('ws.close'), onclick: closeTaskDetail,
}, ico('x', 16));

/** Sahə dəyişikliyi — optimist deyil, cavab gözlənilir (data bütövlüyü). */
async function patch(id, body){
  await api('/ws/tasks/' + id, { method: 'PATCH', body });
  emit('ws-changed');
}

/* ═══════════════════════ DETAL MƏZMUNU ═══════════════════════ */

function renderDetail(d){
  const x = d.task;
  clear(panel);
  const p = PRIO[x.priority] || PRIO.Medium;

  /* ── Başlıq ── */
  const titleIn = el('textarea', { class: 'ws-d__title', rows: '1', maxLength: 200 });
  titleIn.value = x.title;
  titleIn.addEventListener('blur', () => {
    const v = titleIn.value.trim();
    if(v && v !== x.title) patch(x.id, { title: v }).catch(() => toast(t('ws.no_perm'), 'err'));
  });

  /* ── Sahə sətirləri ── */
  const row = (lblKey, node) => el('div', { class: 'ws-d__row' },
    el('span', { class: 'ws-d__l' }, t(lblKey)), node);

  const sel = (opts, val, onChange, phKey) => {
    const s = el('select', { class: 'ws-d__sel', onchange: () => onChange(s.value) });
    if(phKey) s.append(el('option', { value: '' }, t(phKey)));
    opts.forEach(o => s.append(el('option', { value: o.v }, o.l)));
    s.value = val || '';
    return s;
  };

  const statusSel = sel(
    META.statuses.map(v => ({ v, l: t('ws.st_' + slug(v)) })), x.status,
    v => patch(x.id, { status: v }).then(() => { statusSel.className = 'ws-d__sel ws-s--' + (ST_TONE[v] || 'slate'); })
      .catch(() => toast(t('ws.no_perm'), 'err')));
  statusSel.classList.add('ws-s--' + (ST_TONE[x.status] || 'slate'));

  const dateIn = (val, key) => {
    const i = el('input', { type: 'date', class: 'ws-d__date', value: dateVal(val) });
    i.addEventListener('change', () => patch(x.id, { [key]: tsOf(i.value) })
      .catch(() => toast(t('ws.no_perm'), 'err')));
    return i;
  };

  const estIn = el('input', {
    type: 'number', min: '0', step: '15', class: 'ws-d__num',
    value: x.estimatedMinutes || '', placeholder: t('ws.min'),
  });
  estIn.addEventListener('change', () => patch(x.id, { estimatedMinutes: Number(estIn.value) || null })
    .catch(() => toast(t('ws.no_perm'), 'err')));

  /* ── Təsvir ── */
  const desc = el('textarea', { class: 'ws-d__desc', rows: '4', maxLength: 5000, placeholder: t('ws.desc_ph') });
  desc.value = x.description || '';
  desc.addEventListener('blur', () => {
    if(desc.value !== (x.description || '')) patch(x.id, { description: desc.value }).catch(() => {});
  });

  panel.append(
    el('header', { class: 'ws-panel__h' },
      el('span', { class: 'ws-key ws-key--lg' }, x.key || '—'),
      el('span', { class: 'ws-prio ws-p--' + p.tone }, ico(p.icon, 12), t('ws.pr_' + x.priority.toLowerCase())),
      el('span', { class: 'ws-d__sp' }),
      el('button', {
        class: 'c-icon-btn', type: 'button', title: t('ws.watch'), 'aria-label': t('ws.watch'),
        onclick: async e => {
          try{
            const r = await api('/ws/tasks/' + x.id + '/watch', { method: 'POST' });
            e.currentTarget.classList.toggle('is-on', r.watching);
            toast(t(r.watching ? 'ws.watching' : 'ws.unwatched'));
          }catch(err){ toast(t('dyn.err_generic'), 'err'); }
        },
      }, ico('eye', 15)),
      closeBtn(),
    ),
    el('div', { class: 'ws-panel__b' },
      titleIn,
      el('div', { class: 'ws-d__crumb' },
        ico('folder', 12), x.projectName, ' · ', x.teamName),

      el('div', { class: 'ws-d__grid' },
        row('ws.f_status', statusSel),
        row('ws.f_priority', sel(META.priorities.map(v => ({ v, l: t('ws.pr_' + v.toLowerCase()) })),
          x.priority, v => patch(x.id, { priority: v }).catch(() => toast(t('ws.no_perm'), 'err')))),
        row('ws.f_assignee', sel(META.members.map(m => ({ v: m.uid, l: m.name || m.username })),
          x.assigneeId, v => patch(x.id, { assigneeId: v || null }).catch(() => toast(t('ws.no_perm'), 'err')),
        'ws.unassigned')),
        row('ws.f_sprint', sel(META.sprints.map(s => ({ v: s.id, l: s.name })),
          x.sprintId, v => patch(x.id, { sprintId: v || null }).catch(() => toast(t('ws.no_perm'), 'err')),
        'ws.no_sprint')),
        row('ws.start', dateIn(x.startDate, 'startDate')),
        row('ws.due', dateIn(x.deadline, 'deadline')),
        row('ws.estimate', estIn),
        row('ws.spent', el('span', { class: 'ws-d__v' }, String(x.spentMinutes) + ' ' + t('ws.min'))),
      ),

      labelBlock(x, d.labels),
      section('ws.description', desc),
      checklistBlock(x, d.checklist),
      attachBlock(x, d.attachments || []),
      subtaskBlock(x, d.subtasks),
      depBlock(x, d),
      timeBlock(x, d.timeLogs),
      commentBlock(x, d.comments),
      activityBlock(d.activity),

      el('div', { class: 'ws-d__danger' },
        el('button', {
          class: 'c-btn c-btn--ghost c-btn--sm', type: 'button',
          onclick: () => patch(x.id, { archived: !x.archivedAt })
            .then(() => { toast(t('ws.archived_ok')); closeTaskDetail(); })
            .catch(() => toast(t('ws.no_perm'), 'err')),
        }, ico('archive', 14), t(x.archivedAt ? 'ws.unarchive' : 'ws.archive')),
        el('button', {
          class: 'c-btn c-btn--ghost c-btn--sm ws-d__del', type: 'button',
          onclick: async () => {
            if(!await confirmDialog(t('ws.delete_q'))) return;
            try{
              await api('/ws/bulk', { method: 'POST', body: { ids: [x.id], op: 'delete' } });
              toast(t('ws.deleted')); closeTaskDetail(); emit('ws-changed');
            }catch(e){ toast(t('ws.no_perm'), 'err'); }
          },
        }, ico('trash', 14), t('ws.delete')),
      ),
    ),
  );
  paintIcons(panel);
  if(backdrop) backdrop.classList.add('is-on');
}

const section = (lblKey, ...body) => el('section', { class: 'ws-d__sec' },
  el('h3', { class: 'ws-d__h' }, t(lblKey)), ...body);

/* ── Etiketlər ── */
function labelBlock(x, labels){
  const box = el('div', { class: 'ws-labels ws-labels--lg' });
  const draw = () => {
    clear(box);
    labels.forEach(l => box.append(el('button', {
      class: 'ws-label ws-l--' + l.color, type: 'button', title: t('ws.label_remove'),
      onclick: async () => {
        await api('/ws/tasks/' + x.id + '/labels', { method: 'POST', body: { labelId: l.id } });
        labels.splice(labels.findIndex(y => y.id === l.id), 1);
        draw(); emit('ws-changed');
      },
    }, l.name, ico('x', 10))));
    // Yalnız EYNİ komandanın etiketləri təklif olunur (server də bunu yoxlayır).
    const avail = META.labels.filter(l => l.teamId === x.teamId && !labels.some(y => y.id === l.id));
    if(avail.length){
      const add = el('select', { class: 'ws-label-add' });
      add.append(el('option', { value: '' }, '+ ' + t('ws.label')));
      avail.forEach(l => add.append(el('option', { value: l.id }, l.name)));
      add.addEventListener('change', async () => {
        if(!add.value) return;
        const lab = avail.find(l => l.id === add.value);
        try{
          await api('/ws/tasks/' + x.id + '/labels', { method: 'POST', body: { labelId: add.value } });
          labels.push(lab); draw(); emit('ws-changed');
        }catch(e){ toast(t('dyn.err_generic'), 'err'); }
      });
      box.append(add);
    }
    paintIcons(box);
  };
  draw();
  return section('ws.labels', box);
}

/* ── Qoşmalar ── */

/** Şəkil MIME-ları — yalnız onlar üçün kiçik önizləmə çəkilir. */
const IMG = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const fmtSize = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB'
  : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B');

/**
 * Qoşma bloku — sürüşdürüb-buraxma + fayl seçimi.
 *
 * ⚠ YÜKLƏMƏ MÖVCUD `/api/upload` YOLUNDAN KEÇİR (`kind=task`). Ayrıca
 *   endpoint yazsaydıq, üç təhlükəsizlik yoxlaması (əsl ölçü, magic byte,
 *   piksel bombası) təkrarlanmalı olardı — bax `worker/routes/upload.ts`.
 *
 * ⚠ SÜRÜŞDÜRMƏ HADİSƏLƏRİNDƏ `preventDefault` MƏCBURİDİR: əks halda brauzer
 *   faylı YENİ TABDA açır və istifadəçi səhifədən çıxır.
 */
function attachBlock(x, items){
  const list = el('div', { class: 'ws-att-list' });
  const zone = el('div', { class: 'ws-att-zone', tabindex: '0', role: 'button',
    'aria-label': t('ws.attach_add') },
  ico('paperclip', 15), el('span', {}, t('ws.attach_drop')));
  const input = el('input', { type: 'file', class: 'u-display-none', multiple: true });

  const draw = () => {
    clear(list);
    if(!items.length){ list.append(el('p', { class: 'ws-d__none' }, t('ws.no_attach'))); return; }
    items.forEach(f => {
      const isImg = IMG.includes(f.mime);
      list.append(el('div', { class: 'ws-att' },
        isImg
          ? el('img', { class: 'ws-att__th', src: f.url, alt: f.name, loading: 'lazy' })
          : el('span', { class: 'ws-att__th ws-att__th--f' }, ico('paperclip', 14)),
        el('a', { class: 'ws-att__n', href: f.url, target: '_blank', rel: 'noopener noreferrer' }, f.name),
        el('span', { class: 'ws-att__s' }, fmtSize(f.size)),
        el('button', {
          class: 'c-icon-btn ws-mini', type: 'button', 'aria-label': t('ws.delete'),
          onclick: async () => {
            if(!await confirmDialog(t('ws.attach_del_q'))) return;
            try{
              await api(`/ws/tasks/${x.id}/attachments/${f.id}`, { method: 'DELETE' });
              items.splice(items.indexOf(f), 1);
              draw(); emit('ws-changed');
            }catch(e){ toast(t('ws.no_perm'), 'err'); }
          },
        }, ico('x', 12)),
      ));
    });
    paintIcons(list);
  };

  const send = async files => {
    for(const file of [...files].slice(0, 5)){
      zone.classList.add('is-busy');
      try{
        const fd = new FormData();
        fd.append('file', file);
        /* ⚠ `form:`, `body:` YOX — `api()` `body`-ni JSON-a çevirir və
           FormData `{}` kimi gedirdi (server «Fayl yoxdur» → 400). */
        const r = await api('/upload?kind=task&taskId=' + encodeURIComponent(x.id), {
          method: 'POST', form: fd,
        });
        items.push({ id: r.key, name: r.fileName, size: r.fileSize, mime: r.mimeType, url: r.url });
        draw(); emit('ws-changed');
      }catch(e){
        toast(e && e.message ? e.message : t('dyn.err_generic'), 'err');
      }
      zone.classList.remove('is-busy');
    }
    // ⚠ Panel yenidən açılır: server qoşmanın ƏSL `id`-sini verir, yuxarıdakı
    //   `r.key` isə müvəqqəti göstəricidir — silmə düyməsi onunla işləməzdi.
    openTaskDetail(x.id, true);
  };

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', e => {
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); input.click(); }
  });
  input.addEventListener('change', () => { if(input.files.length) send(input.files); });
  ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => {
    e.preventDefault(); zone.classList.add('is-over');
  }));
  ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => {
    e.preventDefault(); zone.classList.remove('is-over');
  }));
  zone.addEventListener('drop', e => {
    if(e.dataTransfer && e.dataTransfer.files.length) send(e.dataTransfer.files);
  });

  draw();
  return section('ws.attachments', list, zone, input);
}

/* ── Yoxlama siyahısı ── */
function checklistBlock(x, items){
  const list = el('div', { class: 'ws-check-list' });
  const bar = el('div', { class: 'ws-prog ws-prog--lg' }, el('i', {}), el('span', {}));

  const sync = () => {
    const done = items.filter(i => i.done).length;
    const pct = items.length ? Math.round((done / items.length) * 100) : 0;
    bar.querySelector('i').style.setProperty('--p', pct + '%');
    bar.querySelector('span').textContent = done + '/' + items.length + ' · ' + pct + '%';
    bar.hidden = !items.length;
  };

  const draw = () => {
    clear(list);
    items.forEach(it => {
      const cb = el('input', { type: 'checkbox', checked: it.done });
      cb.addEventListener('change', async () => {
        it.done = cb.checked;
        sync();
        try{
          await api(`/ws/tasks/${x.id}/checklist/${it.id}`, { method: 'PATCH', body: { done: cb.checked } });
          emit('ws-changed');
        }catch(e){ it.done = !cb.checked; cb.checked = it.done; sync(); toast(t('dyn.err_generic'), 'err'); }
      });
      list.append(el('div', { class: 'ws-check-item' + (it.done ? ' is-done' : '') },
        cb, el('span', {}, it.text),
        el('button', {
          class: 'c-icon-btn ws-mini', type: 'button', 'aria-label': t('ws.delete'),
          onclick: async () => {
            try{
              await api(`/ws/tasks/${x.id}/checklist/${it.id}`, { method: 'DELETE' });
              items.splice(items.indexOf(it), 1); draw(); sync(); emit('ws-changed');
            }catch(e){ toast(t('dyn.err_generic'), 'err'); }
          },
        }, ico('x', 12)),
      ));
    });
    paintIcons(list);
  };

  const input = el('input', { class: 'ws-check-add', placeholder: t('ws.check_ph'), maxLength: 300 });
  input.addEventListener('keydown', async e => {
    if(e.key !== 'Enter' || !input.value.trim()) return;
    const text = input.value.trim();
    input.value = '';
    try{
      const r = await api('/ws/tasks/' + x.id + '/checklist', { method: 'POST', body: { text } });
      items.push({ id: r.id, text, done: false });
      draw(); sync(); emit('ws-changed');
    }catch(err){ toast(t('dyn.err_generic'), 'err'); }
  });

  draw(); sync();
  return section('ws.checklist', bar, list, input);
}

/* ── Alt-tapşırıqlar ── */
function subtaskBlock(x, subs){
  const list = el('div', { class: 'ws-sub-list' });
  subs.forEach(s => list.append(el('button', {
    class: 'ws-sub-item', type: 'button', onclick: () => openTaskDetail(s.id),
  },
    el('span', { class: 'ws-stat ws-s--' + (ST_TONE[s.status] || 'slate') }, t('ws.st_' + slug(s.status))),
    el('span', { class: 'ws-key' }, s.task_key || ''),
    el('span', { class: 'ws-sub-item__t' }, s.title),
  )));
  const add = el('button', {
    class: 'c-btn c-btn--ghost c-btn--sm', type: 'button',
    onclick: () => openCreateModal({ projectId: x.projectId, parentId: x.id }),
  }, ico('edit', 13), t('ws.add_subtask'));
  if(!subs.length) list.append(el('p', { class: 'ws-d__none' }, t('ws.no_subtasks')));
  return section('ws.subtasks', list, add);
}

/* ── Asılılıqlar ── */
function depBlock(x, d){
  const row = (arr, lblKey, removable) => {
    const box = el('div', { class: 'ws-dep-list' });
    if(!arr.length) box.append(el('p', { class: 'ws-d__none' }, t('ws.no_deps')));
    arr.forEach(dep => box.append(el('div', { class: 'ws-dep' },
      el('span', { class: 'ws-stat ws-s--' + (ST_TONE[dep.status] || 'slate') }, t('ws.st_' + slug(dep.status))),
      el('button', { class: 'ws-dep__t', type: 'button', onclick: () => openTaskDetail(dep.id) },
        (dep.task_key ? dep.task_key + ' · ' : '') + dep.title),
      removable ? el('button', {
        class: 'c-icon-btn ws-mini', type: 'button', 'aria-label': t('ws.delete'),
        onclick: async () => {
          try{
            await api(`/ws/tasks/${x.id}/deps/${dep.id}`, { method: 'DELETE' });
            arr.splice(arr.indexOf(dep), 1);
            openTaskDetail(x.id, true);   // sadə yenidən çəkim
          }catch(e){ toast(t('dyn.err_generic'), 'err'); }
        },
      }, ico('x', 12)) : null,
    )));
    return el('div', {}, el('h4', { class: 'ws-d__h4' }, t(lblKey)), box);
  };
  return section('ws.dependencies', row(d.dependsOn, 'ws.depends_on', true), row(d.blocks, 'ws.blocks', false));
}

/* ── Vaxt izləmə ── */
function timeBlock(x, logs){
  const total = logs.reduce((s, l) => s + l.minutes, 0);
  const est = x.estimatedMinutes || 0;
  const pct = est ? Math.min(100, Math.round((total / est) * 100)) : 0;
  const bar = el('div', { class: 'ws-prog ws-prog--lg' }, el('i', {}), el('span', {},
    total + ' / ' + (est || '—') + ' ' + t('ws.min')));
  bar.querySelector('i').style.setProperty('--p', pct + '%');

  const startBtn = el('button', { class: 'c-btn c-btn--sm', type: 'button' }, ico('clock', 13), t('ws.timer_start'));
  startBtn.addEventListener('click', async () => {
    try{
      const r = await api('/ws/tasks/' + x.id + '/timer/' + (startBtn.dataset.on ? 'stop' : 'start'), { method: 'POST' });
      if(r.running){ startBtn.dataset.on = '1'; startBtn.lastChild.textContent = t('ws.timer_stop'); }
      else { delete startBtn.dataset.on; startBtn.lastChild.textContent = t('ws.timer_start'); openTaskDetail(x.id, true); }
      emit('ws-changed');
    }catch(e){ toast(t('dyn.err_generic'), 'err'); }
  });

  const manual = el('input', { type: 'number', min: '1', max: '1440', placeholder: t('ws.min'), class: 'ws-in ws-d__num' });
  const manualBtn = el('button', { class: 'c-btn c-btn--ghost c-btn--sm', type: 'button', onclick: async () => {
    const m = Number(manual.value);
    if(!m) return;
    try{
      await api('/ws/tasks/' + x.id + '/time', { method: 'POST', body: { minutes: m } });
      manual.value = ''; openTaskDetail(x.id, true); emit('ws-changed');
    }catch(e){ toast(t('dyn.err_generic'), 'err'); }
  } }, t('ws.time_add'));

  const list = el('div', { class: 'ws-time-list' }, logs.slice(0, 6).map(l =>
    el('div', { class: 'ws-time' }, el('b', {}, l.minutes + t('ws.m')),
      el('span', {}, l.username || ''), el('span', { class: 'ws-d__sp' }),
      el('time', {}, fmtRelTime(l.startedAt)))));

  return section('ws.time', bar, el('div', { class: 'ws-d__inline' }, startBtn, manual, manualBtn), list);
}

/* ── Şərhlər ── */
function commentBlock(x, comments){
  const list = el('div', { class: 'ws-cm-list' });
  const draw = () => {
    clear(list);
    if(!comments.length) list.append(el('p', { class: 'ws-d__none' }, t('ws.no_comments')));
    comments.forEach(cm => list.append(el('div', { class: 'ws-cm' },
      avatarNode({ name: cm.authorName, photoURL: cm.photoURL, username: cm.username }, 'avatar ws-av'),
      el('div', { class: 'ws-cm__b' },
        el('div', { class: 'ws-cm__h' },
          el('b', {}, cm.authorName || cm.username),
          el('time', {}, fmtRelTime(cm.createdAt)),
          cm.editedAt ? el('i', {}, t('ws.edited')) : null,
        ),
        /* ⚠ MARKDOWN + SANİTASİYA: `markdownNode` marked + DOMPurify cütündən
           keçir (layihə qaydası). Xam `textContent` qoysaydıq kod bloku və
           istinad formatlanmazdı; xam `innerHTML` isə stored-XSS olardı. */
        markdownNode(cm.text),
      ),
      el('button', {
        class: 'c-icon-btn ws-mini', type: 'button', 'aria-label': t('ws.delete'),
        onclick: async () => {
          if(!await confirmDialog(t('ws.comment_del_q'))) return;
          try{
            await api(`/ws/tasks/${x.id}/comments/${cm.id}`, { method: 'DELETE' });
            comments.splice(comments.indexOf(cm), 1); draw(); emit('ws-changed');
          }catch(e){ toast(t('ws.no_perm'), 'err'); }
        },
      }, ico('x', 12)),
    )));
    paintIcons(list);
  };
  draw();

  const ta = el('textarea', { class: 'ws-cm__in', rows: '2', placeholder: t('ws.comment_ph'), maxLength: 4000 });
  const send = el('button', { class: 'c-btn c-btn--primary c-btn--sm', type: 'button', onclick: async () => {
    const text = ta.value.trim();
    if(!text) return;
    send.disabled = true;
    try{
      const r = await api('/ws/tasks/' + x.id + '/comments', { method: 'POST', body: { text } });
      comments.push({ id: r.id, text, authorName: t('app.you'), createdAt: Date.now() });
      ta.value = ''; draw(); emit('ws-changed');
    }catch(e){ toast(t('dyn.err_generic'), 'err'); }
    send.disabled = false;
  } }, t('chat.send'));

  return section('ws.comments', list, el('div', { class: 'ws-cm__form' }, ta, send));
}

/* ── Tarixçə ── */
function activityBlock(acts){
  if(!acts.length) return null;
  return section('ws.activity', el('ol', { class: 'ws-act' }, acts.map(a =>
    el('li', {}, el('b', {}, a.actorName || ''), ' ', tOr('ws.act_' + a.kind, a.kind), ' ',
      a.detail ? el('i', {}, a.detail) : null,
      el('time', {}, fmtRelTime(a.createdAt))))));
}

/* ═══════════════════════ YARATMA MODALI ═══════════════════════ */

export function openCreateModal(preset = {}){
  const proj = el('select', { class: 'ws-d__sel' });
  META.projects.forEach(p => proj.append(el('option', { value: p.id }, p.name)));
  if(preset.projectId) proj.value = preset.projectId;

  const title = el('input', { placeholder: t('ws.title_ph'), maxLength: 200 });
  const desc = el('textarea', { rows: '3', placeholder: t('ws.desc_ph'), maxLength: 5000 });
  const prio = el('select', { class: 'ws-d__sel' });
  META.priorities.forEach(v => prio.append(el('option', { value: v }, t('ws.pr_' + v.toLowerCase()))));
  prio.value = preset.priority || 'Medium';
  const status = el('select', { class: 'ws-d__sel' });
  META.statuses.forEach(v => status.append(el('option', { value: v }, t('ws.st_' + slug(v)))));
  status.value = preset.status || 'To Do';
  const assignee = el('select', { class: 'ws-d__sel' });
  assignee.append(el('option', { value: '' }, t('ws.unassigned')));
  META.members.forEach(m => assignee.append(el('option', { value: m.uid }, m.name || m.username)));
  const due = el('input', { type: 'date' });
  const est = el('input', { type: 'number', min: '0', step: '15', placeholder: t('ws.min') });

  const fld = (lblKey, node) => el('div', { class: 'field' }, el('label', {}, t(lblKey)), node);
  const err = el('div', { class: 'form-err' });

  const save = el('button', { class: 'c-btn c-btn--primary', onclick: async () => {
    err.textContent = '';
    if(!title.value.trim()){ err.textContent = t('ws.err_title'); return; }
    if(!proj.value){ err.textContent = t('ws.err_project'); return; }
    save.disabled = true;
    try{
      await api('/ws/tasks', { method: 'POST', body: {
        projectId: proj.value, title: title.value.trim(), description: desc.value.trim(),
        priority: prio.value, status: status.value, assigneeId: assignee.value || null,
        deadline: tsOf(due.value), estimatedMinutes: Number(est.value) || null,
        parentId: preset.parentId || null,
      } });
      closeModal();
      toast(t('ws.created'));
      emit('ws-changed');
    }catch(e){ err.textContent = t('dyn.err_generic'); }
    save.disabled = false;
  } }, t('ws.create'));

  showModal([
    el('div', { class: 'section-title' }, t(preset.parentId ? 'ws.add_subtask' : 'ws.create')),
    fld('ws.f_project', proj),
    fld('ws.title', title),
    fld('ws.description', desc),
    el('div', { class: 'row2' }, fld('ws.f_status', status), fld('ws.f_priority', prio)),
    el('div', { class: 'row2' }, fld('ws.f_assignee', assignee), fld('ws.due', due)),
    fld('ws.estimate', est),
    err, save,
  ], { wide: true });
  setTimeout(() => title.focus(), 30);
}

/* ═══════════════════════ İDARƏETMƏ PANELLƏRİ ═══════════════════════
 *
 * Sprint · etiket · avtomatlaşdırma — üçü də EYNİ quruluşu paylaşır:
 *   başlıq → mövcud sətirlərin siyahısı → ayırıcı → yaratma formu → düymə.
 *
 * 🔴 ORTAQ QABIQ (`adminPanel`) MƏCBURİDİR. Əvvəl hər panel öz markup-unu
 *    qururdu və nəticə istifadəçi tərəfindən bildirildi: sahələr ETİKETSİZ
 *    idi (yalnız placeholder), enləri fərqli idi, düymə sətrin ortasında
 *    qalırdı. Üç ayrı quruluş üç ayrı dizayn deməkdir — qabıq tək olanda
 *    fərq mümkün deyil.
 */

/** Etiketli sahə — modal daxilində HƏMİŞƏ bu işlədilir. */
const fld = (lblKey, node, hint) => el('label', { class: 'ws-fld' },
  el('span', { class: 'ws-fld__l' }, t(lblKey)),
  node,
  hint ? el('span', { class: 'ws-fld__h' }, t(hint)) : null);

/**
 * @param {string} titleKey
 * @param {Node[]} rows mövcud sətirlər
 * @param {string} emptyKey siyahı boşdursa göstərilən mətn
 * @param {Node[]} form yaratma sahələri
 * @param {Node} action yaratma düyməsi
 */
function adminPanel(titleKey, rows, emptyKey, form, action){
  const list = el('div', { class: 'ws-adm-list' });
  if(rows.length) rows.forEach(r => list.append(r));
  else list.append(el('p', { class: 'ws-d__none' }, t(emptyKey)));
  return [
    el('div', { class: 'section-title' }, t(titleKey)),
    list,
    el('div', { class: 'ws-adm__sep' }),
    el('div', { class: 'ws-adm__form' }, ...form),
    el('div', { class: 'ws-adm__foot' }, action),
  ];
}

/** Komanda seçicisi — üç panelin hamısında eynidir. */
function teamSelect(){
  const sel = el('select', { class: 'ws-in' });
  META.teams.forEach(x => sel.append(el('option', { value: x.id }, x.name)));
  return sel;
}

export function openSprintPanel(){
  const rows = META.sprints.map(sp => el('div', { class: 'ws-adm' },
    el('div', { class: 'ws-adm__b' },
      el('b', {}, sp.name),
      el('span', { class: 'ws-adm__m' },
        new Date(sp.startsAt).toLocaleDateString() + ' → ' + new Date(sp.endsAt).toLocaleDateString()),
    ),
    el('span', { class: 'ws-stat ws-s--' + (sp.status === 'active' ? 'green' : 'slate') }, t('ws.sp_' + sp.status)),
    el('button', {
      class: 'c-icon-btn ws-mini', type: 'button', 'aria-label': t('ws.delete'),
      onclick: async () => {
        if(!await confirmDialog(t('ws.sprint_del_q'))) return;
        try{
          await api('/ws/sprints/' + sp.id, { method: 'DELETE' });
          META.sprints.splice(META.sprints.indexOf(sp), 1);
          emit('ws-changed');
          openSprintPanel();
        }catch(e){ toast(t('ws.no_perm'), 'err'); }
      },
    }, ico('x', 12)),
  ));

  const team = teamSelect();
  const name = el('input', { class: 'ws-in', placeholder: t('ws.sprint_name'), maxLength: 80 });
  const from = el('input', { class: 'ws-in', type: 'date', value: dateVal(Date.now()) });
  const to = el('input', { class: 'ws-in', type: 'date', value: dateVal(Date.now() + 14 * 86400000) });
  const err = el('div', { class: 'form-err' });

  const create = el('button', { class: 'c-btn c-btn--primary', type: 'button', onclick: async () => {
    err.textContent = '';
    if(!name.value.trim()){ err.textContent = t('ws.err_name'); return; }
    if(!team.value){ err.textContent = t('ws.err_team'); return; }
    if(tsOf(to.value) <= tsOf(from.value)){ err.textContent = t('ws.err_dates'); return; }
    create.disabled = true;
    try{
      const r = await api('/ws/sprints', { method: 'POST', body: {
        teamId: team.value, name: name.value.trim(), startsAt: tsOf(from.value), endsAt: tsOf(to.value),
      } });
      META.sprints.unshift({ id: r.id, teamId: team.value, name: name.value.trim(),
        startsAt: tsOf(from.value), endsAt: tsOf(to.value), status: 'planned' });
      emit('ws-changed');
      openSprintPanel();
    }catch(e){ err.textContent = t('ws.no_perm'); }
    create.disabled = false;
  } }, ico('edit', 14), t('ws.sprint_create'));

  showModal(adminPanel('ws.sprints', rows, 'ws.no_sprints', [
    fld('ws.f_team', team),
    fld('ws.sprint_name', name),
    el('div', { class: 'ws-adm__row2' }, fld('ws.sp_from', from), fld('ws.sp_to', to)),
    err,
  ], create), { wide: true });
}

export function openLabelPanel(){
  const rows = META.labels.map(l => el('div', { class: 'ws-adm' },
    el('span', { class: 'ws-label ws-l--' + l.color }, l.name),
    el('span', { class: 'ws-adm__m' }, (META.teams.find(x => x.id === l.teamId) || {}).name || ''),
    el('span', { class: 'ws-d__sp' }),
    el('button', {
      class: 'c-icon-btn ws-mini', type: 'button', 'aria-label': t('ws.delete'),
      onclick: async () => {
        try{
          await api('/ws/labels/' + l.id, { method: 'DELETE' });
          META.labels.splice(META.labels.indexOf(l), 1);
          emit('ws-changed');
          openLabelPanel();
        }catch(e){ toast(t('ws.no_perm'), 'err'); }
      },
    }, ico('x', 12)),
  ));

  const team = teamSelect();
  const name = el('input', { class: 'ws-in', placeholder: t('ws.label_name'), maxLength: 40 });
  const err = el('div', { class: 'form-err' });

  /* Rəng seçimi — `<select>` DEYİL, görünən nümunələr.
     ⚠ Açar adları («slate», «rose») istifadəçiyə heç nə demir; rəngi
       seçərkən onu GÖRMƏK lazımdır. Açılan siyahıda isə rəng görünmür. */
  let color = 'blue';
  const swatches = el('div', { class: 'ws-swatches' },
    ['slate', 'blue', 'violet', 'green', 'amber', 'rose', 'teal', 'cyan', 'lime', 'orange'].map(cv =>
      el('button', {
        class: 'ws-sw ws-l--' + cv + (cv === color ? ' is-on' : ''),
        type: 'button', 'aria-label': cv, title: cv,
        onclick: e => {
          color = cv;
          swatches.querySelectorAll('.ws-sw').forEach(n => n.classList.remove('is-on'));
          e.currentTarget.classList.add('is-on');
        },
      })));

  const create = el('button', { class: 'c-btn c-btn--primary', type: 'button', onclick: async () => {
    err.textContent = '';
    if(!name.value.trim()){ err.textContent = t('ws.err_name'); return; }
    if(!team.value){ err.textContent = t('ws.err_team'); return; }
    create.disabled = true;
    try{
      const l = await api('/ws/labels', { method: 'POST', body: {
        teamId: team.value, name: name.value.trim(), color,
      } });
      META.labels.push(l);
      emit('ws-changed');
      openLabelPanel();
    }catch(e){ err.textContent = (e && e.message) || t('ws.no_perm'); }
    create.disabled = false;
  } }, ico('edit', 14), t('ws.label_create'));

  showModal(adminPanel('ws.labels', rows, 'ws.no_labels', [
    fld('ws.f_team', team),
    fld('ws.label_name', name),
    fld('ws.label_color', swatches),
    err,
  ], create), { wide: true });
}

export function openAutomationPanel(){
  const list = el('div', { class: 'ws-adm-list' }, el('p', { class: 'ws-d__none' }, t('ws.loading')));
  showModal([
    el('div', { class: 'section-title' }, t('ws.automation')),
    el('p', { class: 'ws-adm__note' }, ico('info', 13), t('ws.automation_hint')),
    list,
  ], { wide: true });

  api('/ws/automations').then(d => {
    clear(list);
    if(!d.rules.length){ list.append(el('p', { class: 'ws-d__none' }, t('ws.no_rules'))); return; }
    d.rules.forEach(r => list.append(el('div', { class: 'ws-adm' },
      el('div', { class: 'ws-adm__b' },
        el('b', {}, r.name),
        el('span', { class: 'ws-adm__m' }, tOr('ws.trg_' + r.trigger, r.trigger)),
      ),
      el('span', { class: 'ws-stat ws-s--' + (r.enabled ? 'green' : 'slate') },
        t(r.enabled ? 'ws.on' : 'ws.off')),
      el('button', {
        class: 'c-icon-btn ws-mini', type: 'button', 'aria-label': t('ws.delete'),
        onclick: async () => {
          try{ await api('/ws/automations/' + r.id, { method: 'DELETE' }); openAutomationPanel(); }
          catch(e){ toast(t('ws.no_perm'), 'err'); }
        },
      }, ico('x', 12)),
    )));
    paintIcons(list);
  }).catch(() => { clear(list); list.append(el('p', { class: 'ws-d__none' }, t('users.err'))); });
}
