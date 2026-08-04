// ÇALIŞMALAR (öyrənmə tapşırıqları): kateqoriya tabları, həll göndərmə,
// admin yoxlaması (approve/reject).
//
// 🔴 BU, KOMANDA TAPŞIRIQLARI DEYİL. Repoda iki ayrı sistem var:
//   BU FAYL          → `tasks` + `submissions` cədvəlləri, öyrənmə çalışması
//   `js/workspace.js`→ `team_tasks`, layihə idarəetməsi (Kanban, sprint)
// Modul əvvəl `js/tasks.js` adlanırdı və «Tapşırıqlar» səhifəsini tuturdu;
// iş sahəsi qurulanda ad qarışıqlıq yaradırdı, ona görə `drills` oldu.
// Səhifə: `#page-drills`, marşrut: `#drills`.
import {
  state, watchTasks, createTask, deleteTask, reviewTask,
  watchMyPendingTasks, watchPendingTasks,
  submitSolution, watchMySubmissions, watchPendingSubmissions, reviewSubmission,
} from './store.js';
import { el, clear, fmtTime, bus } from './util.js';
import { allCategoryLabels } from './taxonomy.js';
import { t } from './i18n.js';
import { toast, confirmDialog, showModal, closeModal, emptyState, skeletons } from './ui.js';

let tasks = [];
let mySubs = new Map(); // taskId -> submission
let currentCat = 'all';
let unsubTasks = null, unsubMine = null, unsubPending = null;
let unsubMyTasks = null, unsubPendingTasks = null;

const STATUS_TAG = {
  pending:  { cls: 'tag warn', txt: '⏳ yoxlanılır' },
  approved: { cls: 'tag ok',   txt: '✓ təsdiqləndi' },
  rejected: { cls: 'tag bad',  txt: '✗ rədd edildi' },
};

function buildTabs(){
  const tabs = document.getElementById('taskTabs');
  clear(tabs);
  const mk = (val, label) => el('button', {
    class: currentCat === val ? 'active' : '',
    onclick: () => { currentCat = val; buildTabs(); renderTasks(); },
  }, label);
  tabs.append(mk('all', 'Hamısı'));
  allCategoryLabels().forEach(c => tabs.append(mk(c, c)));
}

function taskCard(t){
  const sub = mySubs.get(t.id);
  const card = el('div', { class: 'task-card' },
    el('div', { class: 'head' },
      el('span', { class: 'tag on' }, t.category),
      el('b', {}, t.title),
      sub ? el('span', { class: STATUS_TAG[sub.status].cls }, STATUS_TAG[sub.status].txt) : null,
    ),
    el('p', {}, t.desc),
    el('div', { class: 'meta' },
      el('span', { style: 'color:var(--muted); font-size:.74rem;' }, fmtTime(t.createdAt)),
      (!sub || sub.status === 'rejected')
        ? el('button', { class: 'btn-small', onclick: () => openSubmitForm(t) }, sub ? 'Yenidən göndər' : 'Həll göndər')
        : null,
      state.isAdmin ? el('button', { class: 'btn-mini block', onclick: async () => {
        if(await confirmDialog(`"${t.title}" tapşırığı silinsin?`)){
          try{ await deleteTask(t.id); toast('Tapşırıq silindi'); }catch(e){ toast('Silinə bilmədi', 'err'); }
        }
      } }, '🗑') : null,
    ),
  );
  return card;
}

function renderTasks(){
  const listEl = document.getElementById('taskList');
  const filtered = currentCat === 'all' ? tasks : tasks.filter(t => t.category === currentCat);
  clear(listEl);
  if(!filtered.length){ listEl.append(emptyState('tasks', 'Bu sahə üzrə hələ tapşırıq yoxdur')); return; }
  filtered.forEach(t => listEl.append(taskCard(t)));
}

function openSubmitForm(t){
  const ta = el('textarea', { placeholder: 'Həllini / cavabını bura yaz...', maxLength: 5000, style: 'min-height:110px;' });
  const link = el('input', { placeholder: 'Link (GitHub, CodePen və s. — könüllü)', maxLength: 300,
    style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:9px 11px; border-radius:8px; font-size:.85rem; margin-bottom:10px;' });
  showModal([
    el('div', { class: 'section-title' }, '☑ ' + t.title),
    el('p', { style: 'color:var(--muted); font-size:.82rem; margin-bottom:12px; white-space:pre-wrap;' }, t.desc),
    ta, link,
    el('button', { class: 'btn-small', onclick: async () => {
      const text = ta.value.trim();
      const linkVal = link.value.trim();
      if(!text && !linkVal){ toast('Həll boş ola bilməz', 'err'); return; }
      if(linkVal && !/^https:\/\//.test(linkVal)){ toast('Link https:// ilə başlamalıdır', 'err'); return; }
      try{
        await submitSolution(t, { text, link: linkVal });
        closeModal();
        toast('Həll göndərildi — admin yoxlayacaq');
      }catch(e){ console.error(e); toast('Göndərilə bilmədi', 'err'); }
    } }, 'Göndər'),
  ], { wide: true });
}

/* ---------- admin: pending submissions ---------- */
function renderPending(subs){
  const box = document.getElementById('pendingSubList');
  clear(box);
  if(!subs.length){ box.append(el('p', { style: 'color:var(--muted); font-size:.8rem; padding:6px 0 14px;' }, 'Yoxlama gözləyən həll yoxdur.')); return; }
  subs.forEach(s => {
    box.append(el('div', { class: 'submission-row' },
      el('div', { class: 'txt' },
        el('b', {}, '@' + (s.username || '?') + ' → ' + (s.taskTitle || s.taskId)),
        s.text ? el('p', {}, s.text) : null,
        s.link && /^https:\/\//.test(s.link) ? el('a', { href: s.link, target: '_blank', rel: 'noopener noreferrer' }, s.link) : null,
      ),
      el('div', { class: 'actions' },
        el('button', { class: 'btn-mini dismiss', onclick: async () => {
          try{ await reviewSubmission(s, 'approved'); toast('Təsdiqləndi (+50 XP)'); }catch(e){ toast('Alınmadı', 'err'); }
        } }, '✓ Təsdiqlə'),
        el('button', { class: 'btn-mini block', onclick: async () => {
          try{ await reviewSubmission(s, 'rejected'); toast('Rədd edildi'); }catch(e){ toast('Alınmadı', 'err'); }
        } }, '✗ Rədd et'),
      ),
    ));
  });
}

/* ---------- init / mount ---------- */
function rebuildTaskCatSelect(){
  const sel = document.getElementById('taskCat');
  const cur = sel.value;
  clear(sel);
  allCategoryLabels().forEach(c => sel.append(el('option', { value: c }, c)));
  if(cur) sel.value = cur;
}

/* ---------- gözləyən tapşırıqlar (təklif workflow-u) ---------- */
const STATUS_TASK_TAG = {
  pending:  { cls: 'tag warn', txt: '⏳ təsdiq gözləyir' },
  rejected: { cls: 'tag bad',  txt: '✗ rədd edilib' },
};
function renderPendingTasks(list, isAdminView){
  const box = document.getElementById('pendingTaskList');
  clear(box);
  document.getElementById('pendingTasksWrap').classList.toggle('hidden', !list.length);
  list.forEach(tk => {
    box.append(el('div', { class: 'submission-row' },
      el('div', { class: 'txt' },
        el('b', {}, tk.title + ' '),
        el('span', { class: (STATUS_TASK_TAG[tk.status] || STATUS_TASK_TAG.pending).cls },
          (STATUS_TASK_TAG[tk.status] || STATUS_TASK_TAG.pending).txt),
        el('p', {}, tk.desc),
        el('span', { style: 'font-size:.7rem; color:var(--muted);' },
          tk.category + ' · @' + (tk.createdByName || '?') + ' · ' + fmtTime(tk.createdAt)),
      ),
      isAdminView && tk.status === 'pending' ? el('div', { class: 'actions' },
        el('button', { class: 'btn-mini dismiss', onclick: async () => {
          try{ await reviewTask(tk, true); toast('Təsdiqləndi'); }catch(e){ toast('Alınmadı', 'err'); }
        } }, '✓ Təsdiqlə'),
        el('button', { class: 'btn-mini block', onclick: async () => {
          try{ await reviewTask(tk, false); toast('Rədd edildi'); }catch(e){ toast('Alınmadı', 'err'); }
        } }, '✗ Rədd et'),
      ) : null,
    ));
  });
}

export function initDrills(){
  rebuildTaskCatSelect();
  bus.addEventListener('taxonomy-updated', () => { rebuildTaskCatSelect(); buildTabs(); });
  document.getElementById('proposeTaskBtn').addEventListener('click', () => {
    const form = document.getElementById('taskForm');
    form.classList.toggle('hidden');
    document.getElementById('taskFormTtl').textContent = state.isAdmin
      ? 'Yeni tapşırıq (admin — dərhal dərc olunur)'
      : 'Tapşırıq təklif et (admin təsdiqindən sonra dərc olunur)';
    if(!form.classList.contains('hidden')) document.getElementById('taskTitle').focus();
  });
  document.getElementById('taskCreateBtn').addEventListener('click', async () => {
    const title = document.getElementById('taskTitle').value.trim();
    const desc = document.getElementById('taskDesc').value.trim();
    if(!title || !desc){ toast('Başlıq və təsvir doldurulmalıdır', 'err'); return; }
    try{
      await createTask({ title, desc, category: document.getElementById('taskCat').value });
      document.getElementById('taskTitle').value = '';
      document.getElementById('taskDesc').value = '';
      document.getElementById('taskForm').classList.add('hidden');
      toast(state.isAdmin ? 'Tapşırıq dərc olundu' : t('task.proposed'));
    }catch(e){ console.error(e); toast('Əlavə oluna bilmədi', 'err'); }
  });
}

export function mountDrills(){
  document.getElementById('taskForm').classList.add('hidden');
  document.getElementById('adminSubmissions').classList.toggle('hidden', !state.isAdmin);
  buildTabs();
  skeletons(document.getElementById('taskList'), 2);
  unsubTasks = watchTasks(list => { tasks = list; renderTasks(); });
  unsubMine = watchMySubmissions(list => {
    mySubs = new Map(list.map(s => [s.taskId, s]));
    renderTasks();
  });
  if(state.isAdmin){
    unsubPending = watchPendingSubmissions(renderPending);
    unsubPendingTasks = watchPendingTasks(list => renderPendingTasks(list, true));
  } else {
    unsubMyTasks = watchMyPendingTasks(list => renderPendingTasks(list, false));
  }
  return () => {
    if(unsubTasks){ unsubTasks(); unsubTasks = null; }
    if(unsubMine){ unsubMine(); unsubMine = null; }
    if(unsubPending){ unsubPending(); unsubPending = null; }
    if(unsubMyTasks){ unsubMyTasks(); unsubMyTasks = null; }
    if(unsubPendingTasks){ unsubPendingTasks(); unsubPendingTasks = null; }
  };
}
