// TASK-11 — Komanda İş Sahəsi (Team Workspace).
//
// Səhifələr:
//   #teams            → komandalarım / kəşf et / dəvətlər
//   #team/:slug?tab=… → Overview, Activity, Projects, Tasks, Members, Chat,
//                       Feed, Files, Statistics, Settings
//
// TƏHLÜKƏSİZLİK QAYDASI: `innerHTML` şablonuna düşən HƏR istifadəçi mətni
// `esc()`-dən keçir. Uzun mətnlər (feed postu) `markdownNode()` ilə render
// olunur — o, DOMPurify ilə sanitizasiya edir.
import { api } from './api.js';
import { el, esc, emit } from './util.js';
import { t } from './i18n.js';
import { showModal, closeModal, toast, confirmDialog } from './ui.js';
import { markdownNode } from './markdown.js';
import { state, watchRoomMessages, sendRoomMessage, uploadMessageFile, uploadTeamFile } from './store.js';
import { sparklineBlock } from './sparkline.js';

let initialized = false;
let scope = 'mine';
let searchTimer = null;

const FILE_CATEGORY_LABELS = {
  documents: '📄 Sənədlər',
  design: '🎨 Dizayn',
  assets: '🖼 Asset-lər',
  source: '💻 Mənbə',
  exports: '📦 Export',
};

const EVENT_LABELS = {
  TeamCreated: 'komanda yaratdı',
  TeamUpdated: 'komandanı yenilədi',
  TeamDeleted: 'komandanı sildi',
  MemberJoined: 'komandaya qoşuldu',
  MemberLeft: 'komandadan ayrıldı',
  RoleChanged: 'rol dəyişdirdi',
  ProjectCreated: 'yeni layihə yaratdı',
  ProjectCompleted: 'layihəni tamamladı',
  ProjectDeleted: 'layihəni sildi',
  TaskAssigned: 'tapşırıq təyin etdi',
  TeamTaskCompleted: 'tapşırığı tamamladı',
  TeamPostCreated: 'lentə paylaşım etdi',
  FileUploaded: 'fayl yüklədi',
  InvitationSent: 'dəvət göndərdi',
};

const POST_KIND_LABELS = {
  post: '💬 Paylaşım',
  announcement: '📢 Elan',
  update: '🔄 Yenilik',
  release: '🚀 Buraxılış',
  progress: '📈 İrəliləyiş',
};

const fmtBytes = (n) => {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

const fmtDate = (ms) => {
  const n = Number(ms) || 0;
  // Bəzi sətirlərdə vaxt saniyə ilə yazılıb (köhnə seed) — hər ikisini tanıyırıq.
  const t = n < 1e12 ? n * 1000 : n;
  return new Date(t).toLocaleString();
};

const displayName = (u) => u?.name || u?.username || 'İstifadəçi';

/* ================= giriş nöqtələri ================= */

export function initTeams() {
  if (initialized) return;
  initialized = true;

  const btnCreate = document.getElementById('btnCreateTeam');
  if (btnCreate) {
    btnCreate.style.display = 'inline-block';
    btnCreate.onclick = openCreateTeamModal;
  }

  const tabs = document.getElementById('teamsScopeTabs');
  if (tabs) {
    tabs.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => {
        tabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        scope = btn.dataset.scope;
        const wrap = document.getElementById('teamsSearchWrap');
        if (wrap) wrap.hidden = scope !== 'discover';
        renderTeamsList();
      };
    });
  }

  const search = document.getElementById('teamsSearchInput');
  if (search) {
    search.oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderTeamsList, 300);
    };
  }

  // `initTeams()` app qurulanda — YƏNİ GİRİŞDƏN ƏVVƏL də — çağırılır.
  // Sessiya yoxdursa dəvət sorğusu göndərmirik: 401 konsola xəta kimi düşür
  // və "sıfır konsol xətası" şərtini pozur.
  if (state.me) refreshInviteBadge();
}

export function mountTeams() {
  const container = document.getElementById('teamsList');
  if (!container) return null;

  // `#teams?scope=invites` — dəvət emailindəki link birbaşa bu tab-ı açır.
  const wanted = (location.hash.match(/[?&]scope=([^&]+)/) || [])[1];
  if (wanted && ['mine', 'discover', 'invites'].includes(wanted)) scope = wanted;

  const tabs = document.getElementById('teamsScopeTabs');
  if (tabs) {
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.scope === scope));
  }
  const wrap = document.getElementById('teamsSearchWrap');
  if (wrap) wrap.hidden = scope !== 'discover';

  renderTeamsList();
  refreshInviteBadge();
  return () => { clearTimeout(searchTimer); };
}

async function refreshInviteBadge() {
  const badge = document.getElementById('teamsInviteBadge');
  if (!badge || !state.me) return;
  try {
    const res = await api('/invites');
    const n = (res.invites || []).length;
    badge.textContent = String(n);
    badge.hidden = n === 0;
  } catch (e) { badge.hidden = true; }
}

function loading(container, text = 'Yüklənir…') {
  container.innerHTML = `<div class="empty-state"><div class="ic">⌛</div><span>${esc(text)}</span></div>`;
}

function failed(container, e) {
  container.innerHTML =
    `<div class="empty-state" style="color:var(--danger)"><div class="ic">⚠</div><span>${esc(e.message || e)}</span></div>`;
}

/* ================= komanda siyahısı ================= */

async function renderTeamsList() {
  const container = document.getElementById('teamsList');
  if (!container) return;
  loading(container, t('dyn.loading') || 'Yüklənir…');

  if (scope === 'invites') return renderInvites(container);

  try {
    const q = document.getElementById('teamsSearchInput')?.value?.trim() || '';
    const path = scope === 'discover'
      ? `/teams/discover${q ? `?q=${encodeURIComponent(q)}` : ''}`
      : '/teams';
    const res = await api(path);
    const teams = res.teams || [];

    if (!teams.length) {
      container.innerHTML = `<div class="empty-state"><div class="ic">👥</div><span>${
        scope === 'discover' ? 'Açıq komanda tapılmadı.' : 'Hələ komandanız yoxdur. Yeni komanda yaradın!'
      }</span></div>`;
      return;
    }

    container.innerHTML = '';
    const grid = el('div', { class: 'user-grid' });

    teams.forEach(team => {
      const card = el('div', { class: 'user-card', style: 'cursor:pointer;' });
      const initial = esc((team.name || '?').charAt(0).toUpperCase());
      const badge = team.visibility === 'Public' ? '🌍' : team.visibility === 'Invite' ? '✉️' : '🔒';

      card.innerHTML = `
        <div class="user-card-head">
          <div class="avatar" style="border-radius:8px;">${initial}</div>
          <div class="info">
            <div class="name">${esc(team.name)} <span title="${esc(team.visibility || '')}">${badge}</span></div>
            <div class="sub">XP: ${Number(team.xp || 0)} · ${Number(team.members_count || 0)} üzv${
              team.my_role ? ` · ${esc(team.my_role)}` : ''
            }</div>
          </div>
        </div>
        <div style="margin-top:10px; font-size:13px; color:var(--text-sec);">${esc(team.description || '')}</div>
      `;

      if (scope === 'discover' && !team.is_member) {
        const joinBtn = el('button', { class: 'btn-primary btn-mini', style: 'margin-top:10px;' }, 'Qoşul');
        joinBtn.onclick = async (ev) => {
          ev.stopPropagation();
          joinBtn.disabled = true;
          try {
            await api(`/teams/${team.slug}/join`, { method: 'POST' });
            toast('Komandaya qoşuldunuz!');
            renderTeamsList();
          } catch (err) {
            toast(err.message, 'err');
            joinBtn.disabled = false;
          }
        };
        card.appendChild(joinBtn);
      }

      card.onclick = () => { window.location.hash = '#team/' + team.slug; };
      grid.appendChild(card);
    });

    container.appendChild(grid);
  } catch (e) { failed(container, e); }
}

/* ================= dəvətlər ================= */

async function renderInvites(container) {
  try {
    const res = await api('/invites');
    const invites = res.invites || [];
    if (!invites.length) {
      container.innerHTML = `<div class="empty-state"><div class="ic">✉️</div><span>Gözləyən dəvətiniz yoxdur.</span></div>`;
      return;
    }

    container.innerHTML = '';
    invites.forEach(inv => {
      const card = el('div', { class: 'post-card' });
      card.innerHTML = `
        <div class="post-title">${esc(inv.team_name)}</div>
        <div class="post-content">${esc(inv.team_description || '')}</div>
        <div class="post-meta">
          Dəvət edən: <strong>${esc(inv.invited_by_display || inv.invited_by_name || '—')}</strong>
          · Rol: ${esc(inv.role_name || 'Developer')}
        </div>
      `;
      const actions = el('div', { style: 'display:flex; gap:8px; margin-top:12px;' });
      const accept = el('button', { class: 'btn-primary btn-mini' }, 'Qəbul et');
      const decline = el('button', { class: 'btn-text btn-mini', style: 'color:var(--danger);' }, 'İmtina');

      accept.onclick = async () => {
        accept.disabled = decline.disabled = true;
        try {
          const r = await api(`/invites/${inv.id}/accept`, { method: 'POST' });
          toast('Komandaya qoşuldunuz!');
          refreshInviteBadge();
          if (r.slug) window.location.hash = '#team/' + r.slug;
          else renderTeamsList();
        } catch (err) {
          toast(err.message, 'err');
          accept.disabled = decline.disabled = false;
        }
      };
      decline.onclick = async () => {
        if (!(await confirmDialog('Dəvəti rədd etmək istəyirsiniz?'))) return;
        try {
          await api(`/invites/${inv.id}/decline`, { method: 'POST' });
          refreshInviteBadge();
          renderInvites(container);
        } catch (err) { toast(err.message, 'err'); }
      };

      actions.append(accept, decline);
      card.appendChild(actions);
      container.appendChild(card);
    });
  } catch (e) { failed(container, e); }
}

/* ================= komanda yaratma / redaktə ================= */

function teamForm({ name = '', description = '', visibility = 'Private' } = {}) {
  const nameInput = el('input', {
    type: 'text', value: name, placeholder: 'Komandanın adı', class: 'auth-input',
    style: 'width:100%; margin-bottom:10px;',
  });
  const descInput = el('textarea', {
    placeholder: 'Qısa açıqlama', class: 'auth-input', rows: 3,
    style: 'width:100%; margin-bottom:10px; resize:vertical;',
  });
  descInput.value = description;

  const visSelect = el('select', { class: 'auth-input', style: 'width:100%; margin-bottom:10px;' });
  [['Private', '🔒 Məxfi — yalnız üzvlər'],
   ['Public', '🌍 Açıq — hər kəs görür və qoşula bilir'],
   ['Invite', '✉️ Yalnız dəvətlə']].forEach(([v, label]) => {
    const o = el('option', { value: v }, label);
    if (v === visibility) o.selected = true;
    visSelect.appendChild(o);
  });

  return { nameInput, descInput, visSelect };
}

function openCreateTeamModal() {
  const { nameInput, descInput, visSelect } = teamForm();
  const submitBtn = el('button', { class: 'btn-primary', style: 'width:100%; margin-top:10px;' }, 'Yarat');

  submitBtn.onclick = async () => {
    const name = nameInput.value.trim();
    if (name.length < 2) return toast('Ad ən azı 2 simvol olmalıdır', 'err');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Yaradılır…';
    try {
      await api('/teams', {
        method: 'POST',
        body: { name, description: descInput.value, visibility: visSelect.value },
      });
      toast('Komanda yaradıldı!');
      closeModal();
      renderTeamsList();
    } catch (err) {
      toast(err.message, 'err');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Yarat';
    }
  };

  showModal([
    el('h2', { style: 'margin:0 0 15px 0;' }, t('teams.create') || 'Yeni Komanda'),
    nameInput, descInput, visSelect, submitBtn,
  ]);
}

/* ================= komanda səhifəsi ================= */

export function mountTeam(slug) {
  const container = document.getElementById('teamContent');
  const header = document.getElementById('teamHeader');
  if (!container || !header) return null;

  header.innerHTML = `<div class="ic" style="font-size:24px;">⌛</div>`;
  container.innerHTML = '';

  const state = { tabCleanup: null, popState: null };

  (async () => {
    try {
      const res = await api(`/teams/${slug}`);
      if (!res || !res.team) {
        header.innerHTML = `<div class="name">Komanda tapılmadı.</div>`;
        return;
      }
      const team = res.team;
      renderTeamHeader(team);

      const tabs = Array.from(document.querySelectorAll('#teamTabs button'));
      // Tab görünürlüyü icazələrə bağlıdır: üzv olmayan yalnız icmalı görür.
      const visibleFor = (tabName) => {
        if (tabName === 'settings') return !!team.isAdmin;
        if (['feed', 'files', 'chat'].includes(tabName)) return !!team.isMember || !!team.isAdmin;
        return true;
      };
      tabs.forEach(btn => { btn.style.display = visibleFor(btn.dataset.tab) ? '' : 'none'; });

      const loadTab = (tabName) => {
        if (state.tabCleanup) { state.tabCleanup(); state.tabCleanup = null; }
        const render = {
          overview: renderTeamOverview,
          activity: renderTeamActivity,
          projects: renderTeamProjects,
          tasks: renderTeamTasks,
          members: renderTeamMembers,
          chat: renderTeamChat,
          feed: renderTeamFeed,
          files: renderTeamFiles,
          stats: renderTeamStats,
          settings: renderTeamSettings,
        }[tabName] || renderTeamOverview;

        Promise.resolve(render(container, team)).then(cleanup => {
          if (typeof cleanup === 'function') state.tabCleanup = cleanup;
        }).catch(e => failed(container, e));
      };

      const pickTab = (wanted) => {
        const btn = tabs.find(b => b.dataset.tab === wanted && b.style.display !== 'none') || tabs[0];
        tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        return btn;
      };

      const tabFromHash = () => (location.hash.match(/\?tab=([^&]*)/) || [])[1] || 'overview';

      loadTab(pickTab(tabFromHash()).dataset.tab);

      tabs.forEach(tab => {
        tab.onclick = () => {
          const name = tab.dataset.tab;
          history.pushState(null, '', `#team/${team.slug}?tab=${name}`);
          pickTab(name);
          loadTab(name);
        };
      });

      state.popState = () => {
        if (!location.hash.startsWith('#team/' + team.slug)) return;
        loadTab(pickTab(tabFromHash()).dataset.tab);
      };
      window.addEventListener('popstate', state.popState);
    } catch (e) {
      header.innerHTML = `<div class="name" style="color:var(--danger)">${esc(e.message)}</div>`;
    }
  })();

  return () => {
    if (state.tabCleanup) state.tabCleanup();
    if (state.popState) window.removeEventListener('popstate', state.popState);
  };
}

function renderTeamHeader(team) {
  const header = document.getElementById('teamHeader');
  if (!header) return;
  const rep = team.reputation || 'Bronze';
  const repIcon = { Bronze: '🥉', Silver: '🥈', Gold: '🥇', Diamond: '💎', Legend: '👑' }[rep] || '🥉';

  header.innerHTML = `
    <div class="avatar" style="border-radius:12px; font-size:32px; width:80px; height:80px; line-height:80px;">
      ${esc((team.name || '?').charAt(0).toUpperCase())}
    </div>
    <div class="name" style="margin-top:12px;">${esc(team.name)}</div>
    <div class="sub" style="margin-top:6px;">
      ${repIcon} ${esc(rep)} · XP: ${Number(team.total_xp || 0)}
      ${team.myRole ? ` · ${esc(team.myRole)}` : ''}
    </div>
  `;

  // Qoşul / Ayrıl düymələri — sahibə "ayrıl" göstərilmir (əvvəlcə transfer).
  const actions = el('div', { style: 'margin-top:12px; display:flex; gap:8px; justify-content:center;' });
  if (!team.isMember && team.visibility === 'Public') {
    const join = el('button', { class: 'btn-primary btn-mini' }, 'Komandaya qoşul');
    join.onclick = async () => {
      try {
        await api(`/teams/${team.slug}/join`, { method: 'POST' });
        toast('Komandaya qoşuldunuz!');
        location.reload();
      } catch (e) { toast(e.message, 'err'); }
    };
    actions.appendChild(join);
  } else if (team.isMember && !team.isOwner) {
    const leave = el('button', { class: 'btn-text btn-mini', style: 'color:var(--danger);' }, 'Komandadan ayrıl');
    leave.onclick = async () => {
      if (!(await confirmDialog('Komandadan ayrılmaq istəyirsiniz?'))) return;
      try {
        await api(`/teams/${team.slug}/leave`, { method: 'POST' });
        toast('Komandadan ayrıldınız');
        window.location.hash = '#teams';
      } catch (e) { toast(e.message, 'err'); }
    };
    actions.appendChild(leave);
  }
  if (actions.children.length) header.appendChild(actions);
}

/* ---------- Overview ---------- */

function statCard(value, label) {
  return `<div class="team-stat-card"><div class="v">${Number(value) || 0}</div><div class="k">${esc(label)}</div></div>`;
}

async function renderTeamOverview(container, team) {
  loading(container);
  const [actRes, statsRes] = await Promise.all([
    api(`/teams/${team.slug}/activity?limit=10`).catch(() => ({ activities: [] })),
    api(`/teams/${team.slug}/stats`).catch(() => ({ stats: {} })),
  ]);
  const s = statsRes.stats || {};

  container.innerHTML = `
    <div class="card" style="margin-top:20px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
        <h3 style="margin:0;">${esc(t('teams.overview') || 'İcmal')}</h3>
        ${team.isAdmin ? '<div><button class="btn-text btn-mini edit-team-btn">Redaktə</button></div>' : ''}
      </div>
      <p style="color:var(--text-sec); font-size:14px; margin:10px 0 0;">${esc(team.description || 'Məlumat yoxdur.')}</p>
      <p style="margin:8px 0 0; font-size:13px;"><strong>Görünürlük:</strong> ${esc(team.visibility || '')}</p>
      <div class="team-rep">
        <div style="font-size:13px; color:var(--text-sec);">
          Reputasiya: <strong>${esc(s.reputation || 'Bronze')}</strong>
          ${s.nextTier ? ` → ${esc(s.nextTier)} (${Number(s.nextAt || 0)} XP)` : ''}
        </div>
        <div class="team-rep-bar"><i style="width:${Math.round((Number(s.tierProgress) || 0) * 100)}%"></i></div>
      </div>
    </div>

    <div class="team-stat-grid">
      ${statCard(s.membersCount, 'Üzv')}
      ${statCard(s.projectsCount, 'Layihə')}
      ${statCard(s.tasksCount, 'Tapşırıq')}
      ${statCard(s.completedTasksCount, 'Tamamlanan')}
      ${statCard(s.xp, 'Komanda XP')}
    </div>

    ${team.isMember ? `
      <div class="card" style="margin-top:20px;">
        <input type="search" id="teamWsSearch" class="auth-input" style="width:100%;"
          placeholder="Komanda daxilində axtar (üzv, layihə, tapşırıq, fayl)…">
        <div id="teamWsResults" style="margin-top:10px;"></div>
      </div>
      <div class="card" id="teamAiCard" style="margin-top:20px;" hidden>
        <h4 style="margin:0 0 8px;">🤖 AI xülasəsi</h4>
        <div id="teamAiSummary" style="font-size:14px; color:var(--text-sec);"></div>
      </div>` : ''}

    <div style="margin-top:20px;">
      <h3 style="margin-bottom:12px;">Son Aktivliklər</h3>
      <div id="teamActivityList" style="display:flex; flex-direction:column; gap:10px;"></div>
    </div>
  `;

  container.querySelector('.edit-team-btn')?.addEventListener('click', () => openEditTeamModal(team));
  fillActivity(document.getElementById('teamActivityList'), actRes.activities || []);

  if (team.isMember) {
    attachWorkspaceSearch(team);
    loadAiSummary(team);
  }
}

function attachWorkspaceSearch(team) {
  const input = document.getElementById('teamWsSearch');
  const out = document.getElementById('teamWsResults');
  if (!input || !out) return;

  let timer = null;
  input.oninput = () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { out.innerHTML = ''; return; }
    timer = setTimeout(async () => {
      try {
        const res = await api(`/teams/${team.slug}/search?q=${encodeURIComponent(q)}`);
        const groups = [
          ['Üzvlər', (res.members || []).map(m => `${displayName(m)} · ${m.role_name || ''}`)],
          ['Layihələr', (res.projects || []).map(p => p.name)],
          ['Tapşırıqlar', (res.tasks || []).map(t => `${t.title} · ${t.status}`)],
          ['Fayllar', (res.files || []).map(f => String(f.path).split('/').pop())],
          ['Paylaşımlar', (res.posts || []).map(p => String(p.content).slice(0, 60))],
        ].filter(([, items]) => items.length);

        if (!groups.length) { out.innerHTML = '<div class="empty-state">Nəticə tapılmadı.</div>'; return; }

        out.innerHTML = groups.map(([label, items]) => `
          <div style="margin-bottom:10px;">
            <div style="font-size:12px; color:var(--text-sec); text-transform:uppercase;">${esc(label)}</div>
            ${items.map(i => `<div style="padding:4px 0; font-size:14px;">${esc(i)}</div>`).join('')}
          </div>`).join('');

        // Semantik nəticələr yalnız Vectorize qurulduqda gəlir.
        if (res.semantic?.length) {
          out.innerHTML += `<div style="margin-top:6px;">
            <div style="font-size:12px; color:var(--text-sec); text-transform:uppercase;">🔎 Mənaca yaxın</div>
            ${res.semantic.map(s => `<div style="padding:4px 0; font-size:14px;">${esc(String(s.text).slice(0, 80))}</div>`).join('')}
          </div>`;
        }
      } catch (e) { out.innerHTML = `<div class="empty-state" style="color:var(--danger)">${esc(e.message)}</div>`; }
    }, 350);
  };
}

async function loadAiSummary(team) {
  const card = document.getElementById('teamAiCard');
  const box = document.getElementById('teamAiSummary');
  if (!card || !box) return;
  try {
    const res = await api(`/teams/${team.slug}/ai/summary`);
    // AI binding qurulmayıbsa kart ümumiyyətlə göstərilmir.
    if (!res.available || !res.summary) return;
    box.textContent = res.summary;
    card.hidden = false;
  } catch (e) { /* AI opsionaldır */ }
}

function fillActivity(node, activities) {
  if (!node) return;
  if (!activities.length) {
    node.innerHTML = `<div class="empty-state">Hələ aktivlik yoxdur.</div>`;
    return;
  }
  node.innerHTML = '';
  activities.forEach(a => {
    const row = el('div', { class: 'team-activity-row' });
    const label = EVENT_LABELS[a.event_type] || String(a.event_type || '').replace(/([A-Z])/g, ' $1').trim();
    row.innerHTML = `
      <span><strong>${esc(displayName(a))}</strong> — ${esc(label)}</span>
      <span class="when">${esc(fmtDate(a.created_at))}</span>
    `;
    node.appendChild(row);
  });
}

/* ---------- Activity tab ---------- */

async function renderTeamActivity(container, team) {
  loading(container);
  const res = await api(`/teams/${team.slug}/activity?limit=100`);
  container.innerHTML = `
    <h3 style="margin:20px 0 12px;">Fəaliyyət tarixçəsi</h3>
    <div id="teamActivityFull" style="display:flex; flex-direction:column; gap:10px;"></div>
  `;
  fillActivity(document.getElementById('teamActivityFull'), res.activities || []);
}

/* ---------- Statistics tab ---------- */

async function renderTeamStats(container, team) {
  loading(container);
  const res = await api(`/teams/${team.slug}/stats`);
  const s = res.stats || {};

  container.innerHTML = `
    <h3 style="margin:20px 0 4px;">Statistika</h3>
    <div class="team-stat-grid">
      ${statCard(s.membersCount, 'Üzv')}
      ${statCard(s.newMembers30d, 'Yeni üzv (30g)')}
      ${statCard(s.projectsCount, 'Layihə')}
      ${statCard(s.completedProjectsCount, 'Bitmiş layihə')}
      ${statCard(s.tasksCount, 'Tapşırıq')}
      ${statCard(s.completedTasksCount, 'Tamamlanan')}
      ${statCard(s.openTasksCount, 'Açıq tapşırıq')}
      ${statCard(s.completionRate, 'Tamamlanma %')}
      ${statCard(s.xp, 'Komanda XP')}
      ${statCard(s.postsCount, 'Paylaşım')}
      ${statCard(s.filesCount, 'Fayl')}
      ${statCard(s.growth30d, 'Aktivlik (30g)')}
    </div>

    <div class="card" style="margin-top:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong>Reputasiya: ${esc(s.reputation || 'Bronze')}</strong>
        <span style="font-size:13px; color:var(--text-sec);">Fayl həcmi: ${esc(fmtBytes(s.filesBytes))}</span>
      </div>
      <div class="team-rep-bar" style="margin-top:8px;"><i style="width:${Math.round((Number(s.tierProgress) || 0) * 100)}%"></i></div>
    </div>

    <div class="card" style="margin-top:20px;">
      <h4 style="margin:0 0 12px;">Son 30 günün aktivliyi</h4>
      <div id="teamSpark"></div>
    </div>

    <div class="card" style="margin-top:20px;">
      <h4 style="margin:0 0 12px;">Ən çox tapşırıq bitirənlər</h4>
      <div id="teamTop"></div>
    </div>
  `;

  // Sparkline — layihədə artıq mövcud olan komponent (əvvəl istifadə olunmurdu).
  // 2 nöqtədən az məlumatda trend çıxmır, ona görə orada sadə mətn göstərilir.
  const sparkBox = document.getElementById('teamSpark');
  const daily = s.daily || [];
  if (daily.length > 1) {
    sparkBox.appendChild(sparklineBlock(
      daily.map(d => Number(d.count) || 0),
      { labels: daily.map(d => d.day) },
    ));
  } else {
    sparkBox.innerHTML = `<div class="empty-state">Trend üçün kifayət qədər məlumat yoxdur.</div>`;
  }

  const topBox = document.getElementById('teamTop');
  const top = s.topContributors || [];
  topBox.innerHTML = top.length
    ? top.map(u => `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--border);">
         <span>${esc(u.name || u.username)}</span><strong>${Number(u.done)}</strong></div>`).join('')
    : `<div class="empty-state">Hələ tamamlanmış tapşırıq yoxdur.</div>`;
}

/* ---------- Members ---------- */

async function renderTeamMembers(container, team) {
  loading(container);
  const [resMembers, resRoles, resInvites] = await Promise.all([
    api(`/teams/${team.slug}/members`),
    api(`/teams/${team.slug}/roles`).catch(() => ({ roles: [] })),
    team.isAdmin ? api(`/teams/${team.slug}/invites`).catch(() => ({ invites: [] })) : Promise.resolve({ invites: [] }),
  ]);

  const members = resMembers.members || [];
  const roles = resRoles.roles || [];
  const invites = resInvites.invites || [];
  const canManageMembers = team.permissions?.includes('*') || team.permissions?.includes('manage_members');
  const canInvite = team.permissions?.includes('*') || team.permissions?.includes('manage_invites');

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; gap:10px; flex-wrap:wrap;">
      <h3 style="margin:0;">Üzvlər (${members.length})</h3>
      ${canInvite ? '<button class="btn-primary btn-mini" id="btnInviteMember">Dəvət Et</button>' : ''}
    </div>
    <div id="pendingInvites"></div>
    <div id="membersGrid" class="user-grid" style="margin-top:20px;"></div>
  `;

  document.getElementById('btnInviteMember')?.addEventListener('click', () => openInviteModal(team, roles));

  if (invites.length) {
    const box = document.getElementById('pendingInvites');
    box.className = 'card';
    box.style.marginTop = '15px';
    box.innerHTML = `<h4 style="margin:0 0 10px; color:var(--text-sec);">Gözləyən Dəvətlər</h4>`;
    invites.forEach(i => {
      const row = el('div', {
        style: 'display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:6px; font-size:14px;',
      });
      row.innerHTML = `<span>${esc(i.email || 'Link')} · ${esc(i.role_name || 'Developer')}
        <span style="color:var(--text-sec);">(${esc(i.invited_by_name || '—')})</span></span>`;
      const cancel = el('button', { class: 'btn-text btn-mini', style: 'color:var(--danger);' }, 'Ləğv et');
      cancel.onclick = async () => {
        if (!(await confirmDialog('Dəvəti ləğv etmək istəyirsiniz?'))) return;
        try {
          await api(`/teams/${team.slug}/invites/${i.id}`, { method: 'DELETE' });
          renderTeamMembers(container, team);
        } catch (e) { toast(e.message, 'err'); }
      };
      row.appendChild(cancel);
      box.appendChild(row);
    });
  }

  const grid = document.getElementById('membersGrid');
  if (!members.length) {
    grid.innerHTML = `<div class="empty-state">Üzv tapılmadı.</div>`;
    return;
  }

  members.forEach(m => {
    const isOwner = String(m.user_id) === String(team.owner_id);
    const card = el('div', { class: 'user-card' });
    card.innerHTML = `
      <div class="user-card-head">
        <div class="avatar" style="border-radius:8px;">${esc(displayName(m).charAt(0).toUpperCase())}</div>
        <div class="info">
          <div class="name">${esc(displayName(m))} ${isOwner ? '👑' : ''}</div>
          <div class="sub role-slot"></div>
        </div>
        <div style="margin-left:auto;" class="act-slot"></div>
      </div>
    `;

    const roleSlot = card.querySelector('.role-slot');
    if (canManageMembers && !isOwner && roles.length) {
      const select = el('select', {
        class: 'member-role-select',
        style: 'padding:2px; font-size:12px; margin-top:3px; background:transparent; border:1px solid var(--border); border-radius:4px; color:var(--text);',
      });
      roles.filter(r => r.name !== 'Owner').forEach(r => {
        const o = el('option', { value: r.id }, r.name);
        if (String(r.id) === String(m.role_id)) o.selected = true;
        select.appendChild(o);
      });
      select.onchange = async (e) => {
        try {
          await api(`/teams/${team.slug}/members/${m.user_id}`, { method: 'PATCH', body: { roleId: e.target.value } });
          toast('Rol yeniləndi');
        } catch (err) { toast(err.message, 'err'); }
      };
      roleSlot.appendChild(select);
    } else {
      roleSlot.textContent = m.role_name || '';
    }

    const actSlot = card.querySelector('.act-slot');
    if (canManageMembers && !isOwner) {
      const kick = el('button', { class: 'btn-text btn-mini', style: 'color:var(--danger);' }, 'Çıxar');
      kick.onclick = async () => {
        if (!(await confirmDialog(`${displayName(m)} komandadan çıxarılsın?`))) return;
        try {
          await api(`/teams/${team.slug}/members/${m.user_id}`, { method: 'DELETE' });
          toast('İstifadəçi çıxarıldı');
          renderTeamMembers(container, team);
        } catch (err) { toast(err.message, 'err'); }
      };
      actSlot.appendChild(kick);
    }
    if (team.isOwner && !isOwner) {
      const transfer = el('button', { class: 'btn-text btn-mini', style: 'color:var(--text-sec);' }, '👑');
      transfer.title = 'Sahibliyi köçür';
      transfer.onclick = async () => {
        if (!(await confirmDialog(`Komandanın sahibliyi ${displayName(m)} şəxsinə keçsin? Siz Admin olacaqsınız.`))) return;
        try {
          await api(`/teams/${team.slug}/transfer`, { method: 'POST', body: { userId: m.user_id } });
          toast('Sahiblik köçürüldü');
          location.reload();
        } catch (err) { toast(err.message, 'err'); }
      };
      actSlot.appendChild(transfer);
    }

    grid.appendChild(card);
  });
}

function openInviteModal(team, roles = []) {
  const wrap = el('div', { style: 'display:flex; flex-direction:column; gap:10px;' });

  const searchInput = el('input', {
    type: 'text', placeholder: 'İstifadəçi axtar (ad, username)', class: 'auth-input', style: 'width:100%;',
  });
  const resultsDiv = el('div', {
    style: 'max-height:200px; overflow-y:auto; border:1px solid var(--border); border-radius:6px; display:none;',
  });
  const suggestionsDiv = el('div', {});
  const emailInput = el('input', {
    type: 'email', placeholder: 'Və ya email daxil edin', class: 'auth-input', style: 'width:100%;',
  });

  const roleSelect = el('select', { class: 'auth-input', style: 'width:100%;' });
  const invitableRoles = roles.filter(r => r.name !== 'Owner');
  (invitableRoles.length ? invitableRoles : [{ id: '', name: 'Developer' }]).forEach(r => {
    const o = el('option', { value: r.id }, r.name);
    if (r.name === 'Developer') o.selected = true;
    roleSelect.appendChild(o);
  });

  const submitBtn = el('button', { class: 'btn-primary', style: 'width:100%; margin-top:6px;' }, 'Göndər');
  let selectedUserId = '';

  const renderUsers = (users, target) => {
    target.innerHTML = '';
    if (!users.length) {
      target.innerHTML = '<div style="padding:10px; color:var(--muted); text-align:center;">İstifadəçi tapılmadı</div>';
      return;
    }
    users.forEach(u => {
      const row = el('div', {
        style: 'padding:10px; cursor:pointer; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px;',
      });
      row.innerHTML = `<div class="avatar" style="width:30px; height:30px; font-size:14px;">${
        esc(displayName(u).charAt(0).toUpperCase())
      }</div><div><div style="font-weight:500;">${esc(displayName(u))}</div>
        <div style="font-size:12px; color:var(--muted);">@${esc(u.username || '')}</div></div>`;
      row.onclick = () => {
        selectedUserId = u.id;
        searchInput.value = displayName(u);
        emailInput.value = '';
        resultsDiv.style.display = 'none';
      };
      target.appendChild(row);
    });
  };

  let timer;
  searchInput.oninput = (e) => {
    clearTimeout(timer);
    selectedUserId = '';
    const q = e.target.value.trim();
    if (q.length < 2) { resultsDiv.style.display = 'none'; return; }
    timer = setTimeout(async () => {
      try {
        const res = await api('/users/search?q=' + encodeURIComponent(q));
        resultsDiv.style.display = 'block';
        renderUsers(res.users || [], resultsDiv);
      } catch (err) { /* səssiz — axtarış köməkçi funksiyadır */ }
    }, 300);
  };

  api(`/users/suggestions?teamId=${encodeURIComponent(team.id)}`).then(res => {
    if (!res.users?.length) return;
    suggestionsDiv.innerHTML = '<div style="font-size:12px; color:var(--muted); margin-bottom:5px;">Tövsiyə olunanlar:</div>';
    const list = el('div', { style: 'border:1px solid var(--border); border-radius:6px;' });
    renderUsers(res.users, list);
    suggestionsDiv.appendChild(list);
  }).catch(() => {});

  submitBtn.onclick = async () => {
    const email = emailInput.value.trim();
    if (!selectedUserId && !email) return toast('İstifadəçi seçin və ya email daxil edin', 'err');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Göndərilir…';
    try {
      await api(`/teams/${team.slug}/invites`, {
        method: 'POST',
        body: { email: email || undefined, userId: selectedUserId || undefined, roleId: roleSelect.value || undefined },
      });
      toast('Dəvət göndərildi!');
      closeModal();
      renderTeamMembers(document.getElementById('teamContent'), team);
    } catch (err) {
      toast(err.message, 'err');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Göndər';
    }
  };

  wrap.append(searchInput, resultsDiv, suggestionsDiv, emailInput,
    el('label', { style: 'font-size:13px; color:var(--text-sec);' }, 'Rol'), roleSelect, submitBtn);

  showModal([el('h2', { style: 'margin:0 0 15px 0;' }, 'İstifadəçi Dəvət Et'), wrap]);
}

/* ---------- Projects ---------- */

async function renderTeamProjects(container, team) {
  loading(container);
  const res = await api(`/teams/${team.slug}/projects`);
  const canManage = team.permissions?.includes('*') || team.permissions?.includes('manage_projects');

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; gap:10px; flex-wrap:wrap;">
      <h3 style="margin:0;">Layihələr</h3>
      ${canManage ? '<button class="btn-primary btn-mini" id="btnCreateProject">Yeni Layihə</button>' : ''}
    </div>
    <div id="projectsList" style="margin-top:15px;"></div>
  `;
  document.getElementById('btnCreateProject')?.addEventListener('click', () => openProjectModal(team));

  const list = document.getElementById('projectsList');
  const projects = res.projects || [];
  if (!projects.length) {
    list.innerHTML = `<div class="empty-state">Layihə yoxdur.</div>`;
    return;
  }

  projects.forEach(p => {
    const card = el('div', { class: 'post-card' });
    const done = Number(p.tasks_done || 0);
    const total = Number(p.tasks_count || 0);
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
        <div class="post-title">${esc(p.name)} ${p.visibility === 'Private' ? '🔒' : '🌍'}</div>
        <div class="act" style="display:flex; gap:6px; flex-wrap:wrap;"></div>
      </div>
      <div class="post-content">${esc(p.description || '')}</div>
      <div class="post-meta">
        Status: ${esc(p.status)} · ${done}/${total} tapşırıq · ${Number(p.members_count || 0)} üzv
        ${p.isMember ? ' · <span style="color:var(--primary);">Üzvsünüz</span>' : ''}
      </div>
    `;

    const act = card.querySelector('.act');
    const addBtn = (label, cls, fn, title) => {
      const b = el('button', { class: `btn-text btn-mini ${cls}` }, label);
      if (title) b.title = title;
      b.onclick = fn;
      act.appendChild(b);
      return b;
    };

    if (p.isAdmin) {
      addBtn('Redaktə', '', () => openProjectModal(team, p));
      const reqBtn = addBtn(`Sorğular${p.pending_requests ? ` (${p.pending_requests})` : ''}`, '',
        () => openProjectRequestsModal(team, p));
      reqBtn.style.color = 'var(--primary)';
      const del = addBtn('Sil', '', async () => {
        if (!(await confirmDialog(`"${p.name}" layihəsi silinsin?`))) return;
        try {
          await api(`/teams/${team.slug}/projects/${p.id}`, { method: 'DELETE' });
          toast('Layihə silindi');
          renderTeamProjects(container, team);
        } catch (e) { toast(e.message, 'err'); }
      });
      del.style.color = 'var(--danger)';
    } else if (!p.isMember && p.visibility === 'Public') {
      const join = el('button', { class: 'btn-primary btn-mini' }, p.hasPendingRequest ? 'Gözləyir' : 'Qoşul');
      join.disabled = !!p.hasPendingRequest;
      join.onclick = async () => {
        join.disabled = true;
        try {
          await api(`/teams/${team.slug}/projects/${p.id}/join`, { method: 'POST' });
          toast('Sorğu göndərildi!');
          join.textContent = 'Gözləyir';
        } catch (e) { toast(e.message, 'err'); join.disabled = false; }
      };
      act.appendChild(join);
    }

    if (p.isMember || p.isAdmin) {
      const active = addBtn('Aktiv et', '', async () => {
        try {
          await api('/me', { method: 'PATCH', body: { activeProjectId: p.id } });
          toast(`Aktiv layihə: ${p.name}`);
          if (state.me) state.me.activeProjectId = p.id;
          emit('me_updated');
        } catch (e) { toast(e.message, 'err'); }
      }, 'Profildə göstərilən aktiv layihə');
      active.style.color = 'var(--success, var(--primary))';
    }

    list.appendChild(card);
  });
}

function openProjectModal(team, project = null) {
  const nameInput = el('input', {
    type: 'text', value: project?.name || '', placeholder: 'Layihə adı',
    class: 'auth-input', style: 'width:100%; margin-bottom:10px;',
  });
  const descInput = el('textarea', {
    placeholder: 'Qısa açıqlama', class: 'auth-input', rows: 3,
    style: 'width:100%; margin-bottom:10px; resize:vertical;',
  });
  descInput.value = project?.description || '';

  const visSelect = el('select', { class: 'auth-input', style: 'width:100%; margin-bottom:10px;' });
  [['Private', '🔒 Məxfi'], ['Public', '🌍 Açıq']].forEach(([v, label]) => {
    const o = el('option', { value: v }, label);
    if (v === (project?.visibility || 'Private')) o.selected = true;
    visSelect.appendChild(o);
  });

  const statusSelect = el('select', { class: 'auth-input', style: 'width:100%; margin-bottom:10px;' });
  [['active', 'Aktiv'], ['paused', 'Dayandırılıb'], ['completed', 'Tamamlanıb (+100 komanda XP)']].forEach(([v, label]) => {
    const o = el('option', { value: v }, label);
    if (v === (project?.status || 'active')) o.selected = true;
    statusSelect.appendChild(o);
  });

  const submitBtn = el('button', { class: 'btn-primary', style: 'width:100%; margin-top:10px;' },
    project ? 'Yadda Saxla' : 'Yarat');

  submitBtn.onclick = async () => {
    const name = nameInput.value.trim();
    if (!name) return toast('Ad daxil edin', 'err');

    submitBtn.disabled = true;
    submitBtn.textContent = '…';
    const body = { name, description: descInput.value, visibility: visSelect.value };
    try {
      if (project) {
        await api(`/teams/${team.slug}/projects/${project.id}`, { method: 'PATCH', body: { ...body, status: statusSelect.value } });
        toast('Layihə yeniləndi!');
      } else {
        await api(`/teams/${team.slug}/projects`, { method: 'POST', body });
        toast('Layihə yaradıldı!');
      }
      closeModal();
      renderTeamProjects(document.getElementById('teamContent'), team);
    } catch (err) {
      toast(err.message, 'err');
      submitBtn.disabled = false;
      submitBtn.textContent = project ? 'Yadda Saxla' : 'Yarat';
    }
  };

  const nodes = [
    el('h2', { style: 'margin:0 0 15px 0;' }, project ? 'Layihəni Redaktə Et' : 'Yeni Layihə'),
    nameInput, descInput, visSelect,
  ];
  if (project) nodes.push(statusSelect);
  nodes.push(submitBtn);
  showModal(nodes);
}

async function openProjectRequestsModal(team, project) {
  const box = el('div');
  box.innerHTML = `<div class="empty-state"><div class="ic">⌛</div><span>Yüklənir…</span></div>`;
  showModal([el('h2', { style: 'margin:0 0 15px 0;' }, `Sorğular: ${project.name}`), box]);

  try {
    const res = await api(`/teams/${team.slug}/projects/${project.id}/requests`);
    const requests = res.requests || [];
    if (!requests.length) {
      box.innerHTML = `<div class="empty-state">Heç bir sorğu yoxdur.</div>`;
      return;
    }
    box.innerHTML = '';
    requests.forEach(req => {
      const item = el('div', {
        class: 'post-card',
        style: 'display:flex; justify-content:space-between; align-items:center; gap:10px;',
      });
      item.innerHTML = `<div><div style="font-weight:bold;">${esc(displayName(req))}</div>
        <div style="font-size:12px; color:var(--text-sec);">@${esc(req.username || '')}</div></div>`;

      const actions = el('div', { style: 'display:flex; gap:6px;' });
      const acc = el('button', { class: 'btn-primary btn-mini' }, 'Qəbul');
      const rej = el('button', { class: 'btn-text btn-mini', style: 'color:var(--danger);' }, 'Rədd');
      acc.onclick = async () => {
        try {
          await api(`/teams/${team.slug}/projects/${project.id}/requests/${req.id}/approve`, { method: 'POST' });
          toast('Sorğu qəbul edildi');
          item.remove();
        } catch (e) { toast(e.message, 'err'); }
      };
      rej.onclick = async () => {
        try {
          await api(`/teams/${team.slug}/projects/${project.id}/requests/${req.id}/reject`, { method: 'POST' });
          toast('Sorğu rədd edildi');
          item.remove();
        } catch (e) { toast(e.message, 'err'); }
      };
      actions.append(acc, rej);
      item.appendChild(actions);
      box.appendChild(item);
    });
  } catch (e) {
    box.innerHTML = `<div class="empty-state" style="color:var(--danger);">${esc(e.message)}</div>`;
  }
}

/* ---------- Tasks ---------- */

async function renderTeamTasks(container, team) {
  loading(container);
  const [res, membersRes] = await Promise.all([
    api(`/teams/${team.slug}/tasks`),
    api(`/teams/${team.slug}/members`).catch(() => ({ members: [] })),
  ]);
  const canManage = team.permissions?.includes('*') || team.permissions?.includes('manage_tasks');
  const members = membersRes.members || [];

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; gap:10px; flex-wrap:wrap;">
      <h3 style="margin:0;">Tapşırıqlar</h3>
      ${canManage ? '<button class="btn-primary btn-mini" id="btnCreateTask">Yeni Tapşırıq</button>' : ''}
    </div>
    <div class="team-chips" id="taskFilters">
      <button class="team-chip active" data-status="">Hamısı</button>
      <button class="team-chip" data-status="To Do">To Do</button>
      <button class="team-chip" data-status="In Progress">In Progress</button>
      <button class="team-chip" data-status="Review">Review</button>
      <button class="team-chip" data-status="Done">Done</button>
    </div>
    <div id="tasksList"></div>
  `;
  document.getElementById('btnCreateTask')?.addEventListener('click', () => openTaskModal(team, null, members));

  const list = document.getElementById('tasksList');
  const allTasks = res.tasks || [];

  const draw = (filter) => {
    const tasks = filter ? allTasks.filter(t => t.status === filter) : allTasks;
    list.innerHTML = '';
    if (!tasks.length) {
      list.innerHTML = `<div class="empty-state">Tapşırıq yoxdur.</div>`;
      return;
    }
    tasks.forEach(task => list.appendChild(taskCard(task, team, members, canManage, container)));
  };

  document.querySelectorAll('#taskFilters .team-chip').forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll('#taskFilters .team-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      draw(chip.dataset.status);
    };
  });

  draw('');
}

function taskCard(task, team, members, canManage, container) {
  const card = el('div', { class: 'post-card' });
  const prio = { Low: '🟢', Medium: '🟡', High: '🟠', Critical: '🔴' }[task.priority] || '⚪';

  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
      <div class="post-title">${esc(task.title)}</div>
      <div class="act" style="display:flex; gap:6px;"></div>
    </div>
    <div class="post-content">${esc(task.description || '')}</div>
    <div class="post-meta" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
      <span class="status-slot"></span>
      <span>${prio} ${esc(task.priority || '')}</span>
      ${task.project_name ? `<span style="color:var(--primary);">📁 ${esc(task.project_name)}</span>` : ''}
      ${task.assignee_name || task.assignee_username
        ? `<span>👤 ${esc(task.assignee_name || task.assignee_username)}</span>` : '<span>👤 —</span>'}
    </div>
  `;

  // Statusu icraçının özü də dəyişə bilər (server eyni qaydanı tətbiq edir).
  const meId = state?.me?.uid;
  const canStatus = canManage || (task.assignee_id && task.assignee_id === meId);
  const statusSlot = card.querySelector('.status-slot');
  if (canStatus) {
    const select = el('select', { style: 'font-size:12px;' });
    ['To Do', 'In Progress', 'Review', 'Done'].forEach(s => {
      const o = el('option', { value: s }, s);
      if (s === task.status) o.selected = true;
      select.appendChild(o);
    });
    select.onchange = async (e) => {
      try {
        const r = await api(`/teams/${team.slug}/tasks/${task.id}`, { method: 'PATCH', body: { status: e.target.value } });
        task.status = e.target.value;
        toast(r.teamXp > 0 ? `Status yeniləndi (+${r.teamXp} komanda XP)` : 'Status yeniləndi');
      } catch (err) {
        toast(err.message, 'err');
        e.target.value = task.status;
      }
    };
    statusSlot.appendChild(select);
  } else {
    statusSlot.textContent = task.status;
  }

  if (canManage) {
    const act = card.querySelector('.act');
    const edit = el('button', { class: 'btn-text btn-mini' }, 'Redaktə');
    edit.onclick = () => openTaskModal(team, task, members);
    const del = el('button', { class: 'btn-text btn-mini', style: 'color:var(--danger);' }, 'Sil');
    del.onclick = async () => {
      if (!(await confirmDialog(`"${task.title}" silinsin?`))) return;
      try {
        await api(`/teams/${team.slug}/tasks/${task.id}`, { method: 'DELETE' });
        toast('Tapşırıq silindi');
        renderTeamTasks(container, team);
      } catch (e) { toast(e.message, 'err'); }
    };
    act.append(edit, del);
  }

  return card;
}

async function openTaskModal(team, task, members) {
  let projects = [];
  try {
    const res = await api(`/teams/${team.slug}/projects`);
    projects = res.projects || [];
  } catch (e) { /* aşağıda yoxlanılır */ }

  if (!task && !projects.length) return toast('Əvvəlcə layihə yaratmalısınız', 'err');

  const projectSelect = el('select', { class: 'auth-input', style: 'width:100%; margin-bottom:10px;' });
  projects.forEach(p => {
    const o = el('option', { value: p.id }, p.name);
    if (task && String(task.project_id) === String(p.id)) o.selected = true;
    projectSelect.appendChild(o);
  });

  const titleInput = el('input', {
    type: 'text', value: task?.title || '', placeholder: 'Tapşırıq başlığı',
    class: 'auth-input', style: 'width:100%; margin-bottom:10px;',
  });
  const descInput = el('textarea', {
    placeholder: 'Açıqlama', class: 'auth-input', rows: 3,
    style: 'width:100%; margin-bottom:10px; resize:vertical;',
  });
  descInput.value = task?.description || '';

  const prioSelect = el('select', { class: 'auth-input', style: 'width:100%; margin-bottom:10px;' });
  ['Low', 'Medium', 'High', 'Critical'].forEach(p => {
    const o = el('option', { value: p }, p);
    if (p === (task?.priority || 'Medium')) o.selected = true;
    prioSelect.appendChild(o);
  });

  const assigneeSelect = el('select', { class: 'auth-input', style: 'width:100%; margin-bottom:10px;' });
  assigneeSelect.appendChild(el('option', { value: '' }, '— Təyin edilməyib —'));
  members.forEach(m => {
    const o = el('option', { value: m.user_id }, displayName(m));
    if (task && String(task.assignee_id) === String(m.user_id)) o.selected = true;
    assigneeSelect.appendChild(o);
  });

  const submitBtn = el('button', { class: 'btn-primary', style: 'width:100%; margin-top:10px;' },
    task ? 'Yadda Saxla' : 'Yarat');

  submitBtn.onclick = async () => {
    const title = titleInput.value.trim();
    if (!title) return toast('Başlıq daxil edin', 'err');

    submitBtn.disabled = true;
    submitBtn.textContent = '…';
    const body = {
      title, description: descInput.value,
      priority: prioSelect.value, assigneeId: assigneeSelect.value || null,
    };
    try {
      if (task) {
        await api(`/teams/${team.slug}/tasks/${task.id}`, { method: 'PATCH', body });
        toast('Tapşırıq yeniləndi!');
      } else {
        await api(`/teams/${team.slug}/tasks`, { method: 'POST', body: { ...body, projectId: projectSelect.value } });
        toast('Tapşırıq yaradıldı!');
      }
      closeModal();
      renderTeamTasks(document.getElementById('teamContent'), team);
    } catch (err) {
      toast(err.message, 'err');
      submitBtn.disabled = false;
      submitBtn.textContent = task ? 'Yadda Saxla' : 'Yarat';
    }
  };

  const nodes = [el('h2', { style: 'margin:0 0 15px 0;' }, task ? 'Tapşırığı Redaktə Et' : 'Yeni Tapşırıq')];
  if (!task) nodes.push(projectSelect);
  nodes.push(titleInput, descInput, prioSelect, assigneeSelect, submitBtn);
  showModal(nodes);
}

/* ---------- Feed ---------- */

async function renderTeamFeed(container, team) {
  loading(container);
  const res = await api(`/teams/${team.slug}/feed`);
  const canAnnounce = team.permissions?.includes('*') || team.permissions?.includes('manage_feed');

  container.innerHTML = `
    <div class="card" style="margin-top:20px;">
      <textarea id="feedInput" class="auth-input" rows="3" style="width:100%; resize:vertical;"
        placeholder="Komanda ilə nəsə paylaşın… (Markdown dəstəklənir)"></textarea>
      <div style="display:flex; gap:10px; margin-top:10px; align-items:center; flex-wrap:wrap;">
        <select id="feedKind" class="auth-input" style="flex:0 0 auto;">
          <option value="post">💬 Paylaşım</option>
          <option value="update">🔄 Yenilik</option>
          <option value="progress">📈 İrəliləyiş</option>
          <option value="release">🚀 Buraxılış</option>
          ${canAnnounce ? '<option value="announcement">📢 Elan</option>' : ''}
        </select>
        <button class="btn-primary btn-mini" id="btnPostFeed" style="margin-left:auto;">Paylaş</button>
      </div>
    </div>
    <div id="feedList" style="margin-top:20px;"></div>
  `;

  document.getElementById('btnPostFeed').onclick = async () => {
    const input = document.getElementById('feedInput');
    const content = input.value.trim();
    if (!content) return;
    try {
      await api(`/teams/${team.slug}/feed`, {
        method: 'POST',
        body: { content, kind: document.getElementById('feedKind').value },
      });
      input.value = '';
      renderTeamFeed(container, team);
    } catch (err) { toast(err.message, 'err'); }
  };

  const list = document.getElementById('feedList');
  const feed = res.feed || [];
  if (!feed.length) {
    list.innerHTML = `<div class="empty-state">Heç nə paylaşılmayıb.</div>`;
    return;
  }

  feed.forEach(p => {
    const card = el('div', { class: 'post-card' });
    const head = el('div', { style: 'display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;' });
    head.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <div class="avatar" style="width:30px; height:30px; line-height:30px; font-size:14px; border-radius:50%;">
          ${esc(displayName(p).charAt(0).toUpperCase())}
        </div>
        <strong>${esc(displayName(p))}</strong>
        <span style="color:var(--text-sec); font-size:12px;">${esc(fmtDate(p.created_at))}</span>
        <span style="font-size:12px;">${esc(POST_KIND_LABELS[p.kind] || POST_KIND_LABELS.post)}</span>
      </div>
    `;
    if (p.canDelete) {
      const del = el('button', { class: 'btn-text btn-mini', style: 'color:var(--danger);' }, 'Sil');
      del.onclick = async () => {
        if (!(await confirmDialog('Paylaşımı silmək istəyirsiniz?'))) return;
        try {
          await api(`/teams/${team.slug}/feed/${p.id}`, { method: 'DELETE' });
          card.remove();
        } catch (e) { toast(e.message, 'err'); }
      };
      head.appendChild(del);
    }
    card.appendChild(head);

    // Markdown + DOMPurify — xam `innerHTML` DEYİL.
    const body = markdownNode(p.content || '');
    body.style.marginTop = '10px';
    card.appendChild(body);

    list.appendChild(card);
  });
}

/* ---------- Files ---------- */

async function renderTeamFiles(container, team) {
  loading(container);
  let category = 'all';
  const canUpload = team.permissions?.includes('*') || team.permissions?.includes('manage_files');

  const draw = async () => {
    const res = await api(`/teams/${team.slug}/files${category !== 'all' ? `?category=${category}` : ''}`);
    const cats = res.categories || Object.keys(FILE_CATEGORY_LABELS);

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; gap:10px; flex-wrap:wrap;">
        <h3 style="margin:0;">Fayllar</h3>
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:12px; color:var(--text-sec);">
            ${Number(res.usage?.files || 0)} fayl · ${esc(fmtBytes(res.usage?.bytes))}
          </span>
          ${canUpload ? `<label class="btn-primary btn-mini" style="cursor:pointer;">Fayl Yüklə
            <input type="file" id="teamFileInput" style="display:none;"></label>` : ''}
        </div>
      </div>
      <div class="team-chips" id="fileCats">
        <button class="team-chip ${category === 'all' ? 'active' : ''}" data-cat="all">Hamısı</button>
        ${cats.map(cKey => `<button class="team-chip ${category === cKey ? 'active' : ''}" data-cat="${esc(cKey)}">${
          esc(FILE_CATEGORY_LABELS[cKey] || cKey)
        }</button>`).join('')}
      </div>
      <div id="teamFileList" class="user-grid"></div>
    `;

    document.querySelectorAll('#fileCats .team-chip').forEach(chip => {
      chip.onclick = () => { category = chip.dataset.cat; draw(); };
    });

    const input = document.getElementById('teamFileInput');
    if (input) {
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const target = category === 'all' ? 'documents' : category;
        toast('Yüklənir…');
        try {
          const up = await uploadTeamFile(file, team.id, target);
          await api(`/teams/${team.slug}/files`, {
            method: 'POST',
            body: { path: up.key, type: up.mimeType || file.type, size: up.fileSize || file.size, category: target },
          });
          toast('Fayl yükləndi');
          draw();
        } catch (err) { toast(err.message, 'err'); }
      };
    }

    const list = document.getElementById('teamFileList');
    const files = res.files || [];
    if (!files.length) {
      list.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Bu bölmədə fayl yoxdur.</div>`;
      return;
    }

    files.forEach(f => {
      const card = el('div', { class: 'user-card team-file-card' });
      const name = String(f.path).split('/').pop() || f.path;
      const row = el('div', { style: 'display:flex; justify-content:space-between; align-items:flex-start; gap:10px;' });
      row.innerHTML = `
        <div style="overflow:hidden;">
          <a href="${esc(f.url || '/files/' + f.path)}" target="_blank" rel="noopener">${esc(name)}</a>
          <div class="team-file-meta">${esc(fmtBytes(f.size))} · ${esc(FILE_CATEGORY_LABELS[f.category] || f.category || '')}
            · ${esc(displayName(f))}</div>
        </div>
      `;
      if (f.canDelete) {
        const del = el('button', { class: 'btn-text btn-mini', style: 'color:var(--danger);' }, 'Sil');
        del.onclick = async () => {
          if (!(await confirmDialog('Faylı silmək istəyirsiniz?'))) return;
          try {
            await api(`/teams/${team.slug}/files/${f.id}`, { method: 'DELETE' });
            toast('Fayl silindi');
            draw();
          } catch (e) { toast(e.message, 'err'); }
        };
        row.appendChild(del);
      }
      card.appendChild(row);
      list.appendChild(card);
    });
  };

  await draw();
}

/* ---------- Chat (RoomDO / WebSocket ilə real-time) ---------- */

const wsProto = () => (location.protocol === 'https:' ? 'wss:' : 'ws:');

async function renderTeamChat(container, team) {
  loading(container);
  const res = await api(`/teams/${team.slug}/rooms`);
  const rooms = res.rooms || [];
  if (!rooms.length) {
    container.innerHTML = `<div class="empty-state">Söhbət otağı tapılmadı.</div>`;
    return;
  }

  let currentRoom = rooms[0];
  let ws = null;
  let wsRoomId = null;
  let poll = null;
  let disposed = false;
  let selectedFile = null;

  const myUid = state?.me?.uid;

  container.innerHTML = `
    <div class="team-chips" id="teamRoomTabs">
      ${rooms.map(r => `<button class="team-chip ${r.id === currentRoom.id ? 'active' : ''}" data-room="${esc(r.id)}">#${esc(r.name)}</button>`).join('')}
      ${res.canManage ? '<button class="team-chip" id="btnNewRoom" title="Yeni otaq">＋</button>' : ''}
    </div>
    <div class="team-chat-box">
      <div style="padding:12px 16px; border-bottom:1px solid var(--border); font-weight:bold; background:var(--surface-1); display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <span id="teamRoomTitle">💬 #${esc(currentRoom.name)}</span>
        <span id="teamChatStatus" style="font-size:11px; color:var(--text-sec);">bağlanır…</span>
      </div>
      <div id="teamChatMessages" class="team-chat-msgs"></div>
      <div style="padding:12px; border-top:1px solid var(--border); background:var(--surface-1);">
        <div style="display:flex; flex-direction:column; background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:10px;">
          <input type="text" id="teamChatInput" style="border:none; background:transparent; color:var(--text); padding:5px; outline:none;" placeholder="Mesaj yazın…">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
            <div>
              <input type="file" id="teamChatFile" style="display:none;">
              <button class="btn-text btn-mini" id="btnUploadFile" style="font-size:16px;">📎</button>
              <span id="uploadFileName" style="font-size:12px; color:var(--muted); margin-left:8px;"></span>
            </div>
            <button class="btn-primary btn-mini" id="btnSendTeamMessage" style="padding:6px 15px;">Göndər</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const msgsBox = document.getElementById('teamChatMessages');
  const input = document.getElementById('teamChatInput');
  const sendBtn = document.getElementById('btnSendTeamMessage');
  const statusEl = document.getElementById('teamChatStatus');
  const fileIn = document.getElementById('teamChatFile');
  const fileName = document.getElementById('uploadFileName');

  document.getElementById('btnUploadFile').onclick = () => fileIn.click();
  fileIn.onchange = (e) => {
    selectedFile = e.target.files[0] || null;
    fileName.textContent = selectedFile ? selectedFile.name : '';
  };

  const renderMessages = (messages) => {
    msgsBox.innerHTML = '';
    if (!messages.length) {
      msgsBox.innerHTML = '<div class="empty-state">Mesaj yoxdur. İlk mesajı siz yazın!</div>';
      return;
    }
    messages.slice().reverse().forEach(m => {
      const isMe = m.authorUid === myUid;
      const wrap = el('div', { style: `display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'};` });
      const who = el('div', { style: 'font-size:12px; color:var(--text-sec); margin:0 4px 4px;' }, m.authorName || '');
      const bubble = el('div', { class: `team-chat-bubble ${isMe ? 'me' : 'other'}` });

      if (m.text) bubble.appendChild(el('div', {}, m.text));
      if (m.fileUrl) {
        const ext = String(m.fileUrl).split('.').pop().toLowerCase();
        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
          bubble.appendChild(el('img', {
            src: m.fileUrl, alt: m.fileName || '',
            style: 'max-width:100%; max-height:200px; border-radius:8px; margin-top:5px;',
          }));
        } else {
          const a = el('a', { href: m.fileUrl, target: '_blank', rel: 'noopener', style: 'color:inherit;' },
            '📎 ' + (m.fileName || 'Faylı yüklə'));
          const box = el('div', { style: 'margin-top:5px; padding:8px; background:rgba(0,0,0,.1); border-radius:6px; font-size:.85rem;' });
          box.appendChild(a);
          bubble.appendChild(box);
        }
      }
      wrap.append(who, bubble);
      msgsBox.appendChild(wrap);
    });
    msgsBox.scrollTop = msgsBox.scrollHeight;
  };

  // Real-time: RoomDO WebSocket siqnalı → dərhal refetch. WS düşərsə
  // `watchRoomMessages` polling-i fallback kimi işləyir (chat.js ilə eyni model).
  const connectWs = (roomId) => {
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) {} }
    wsRoomId = roomId;
    let sock;
    try { sock = new WebSocket(`${wsProto()}//${location.host}/api/rooms/${roomId}/ws`); }
    catch (e) { statusEl.textContent = 'offline'; return; }
    ws = sock;

    sock.addEventListener('open', () => {
      if (wsRoomId === roomId) statusEl.textContent = '🟢 canlı';
    });
    sock.addEventListener('message', (ev) => {
      if (wsRoomId !== roomId) return;
      let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
      if (d.t === 'msg' || d.t === 'refresh' || d.t === 'ack') emit('refresh-msgs-' + roomId);
    });
    sock.addEventListener('close', () => {
      if (ws !== sock || disposed) return;
      ws = null;
      statusEl.textContent = 'yenidən qoşulur…';
      setTimeout(() => { if (!disposed && wsRoomId === roomId && !ws) connectWs(roomId); }, 3000);
    });
    sock.addEventListener('error', () => { try { sock.close(); } catch (e) {} });
  };

  const openRoom = (room) => {
    currentRoom = room;
    document.getElementById('teamRoomTitle').textContent = `💬 #${room.name}`;
    document.querySelectorAll('#teamRoomTabs .team-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.room === room.id);
    });

    if (poll) poll();
    poll = watchRoomMessages(room.id, renderMessages);
    connectWs(room.id);
  };

  document.querySelectorAll('#teamRoomTabs .team-chip[data-room]').forEach(chip => {
    chip.onclick = () => {
      const room = rooms.find(r => r.id === chip.dataset.room);
      if (room) openRoom(room);
    };
  });

  document.getElementById('btnNewRoom')?.addEventListener('click', () => {
    const nameInput = el('input', { type: 'text', class: 'auth-input', style: 'width:100%;', placeholder: 'Otaq adı' });
    const ok = el('button', { class: 'btn-primary', style: 'width:100%; margin-top:10px;' }, 'Yarat');
    ok.onclick = async () => {
      const v = nameInput.value.trim();
      if (!v) return;
      try {
        await api(`/teams/${team.slug}/rooms`, { method: 'POST', body: { name: v } });
        closeModal();
        renderTeamChat(container, team);
      } catch (e) { toast(e.message, 'err'); }
    };
    showModal([el('h2', { style: 'margin:0 0 15px;' }, 'Yeni otaq'), nameInput, ok]);
  });

  const send = async () => {
    const text = input.value.trim();
    if (!text && !selectedFile) return;

    sendBtn.disabled = true;
    const prev = sendBtn.textContent;
    sendBtn.textContent = '…';
    try {
      let payload = { type: 'text', text };
      if (selectedFile) {
        const up = await uploadMessageFile(selectedFile);
        payload = { ...up, text };
      }
      await sendRoomMessage(currentRoom.id, payload);
      input.value = '';
      selectedFile = null;
      fileName.textContent = '';
      fileIn.value = '';
    } catch (err) {
      toast(err.message, 'err');
    }
    sendBtn.disabled = false;
    sendBtn.textContent = prev;
  };

  sendBtn.onclick = send;
  input.onkeydown = (e) => { if (e.key === 'Enter') send(); };

  openRoom(currentRoom);

  return () => {
    disposed = true;
    if (poll) poll();
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) {} }
  };
}

/* ---------- Settings ---------- */

function openEditTeamModal(team) {
  const { nameInput, descInput, visSelect } = teamForm(team);
  const submitBtn = el('button', { class: 'btn-primary', style: 'width:100%; margin-top:10px;' }, 'Yadda Saxla');

  submitBtn.onclick = async () => {
    const name = nameInput.value.trim();
    if (!name) return toast('Ad daxil edin', 'err');
    submitBtn.disabled = true;
    try {
      await api(`/teams/${team.slug}`, {
        method: 'PATCH',
        body: { name, description: descInput.value, visibility: visSelect.value },
      });
      Object.assign(team, { name, description: descInput.value, visibility: visSelect.value });
      toast('Komanda yeniləndi!');
      closeModal();
      renderTeamHeader(team);
      renderTeamOverview(document.getElementById('teamContent'), team);
    } catch (err) {
      toast(err.message, 'err');
      submitBtn.disabled = false;
    }
  };

  showModal([el('h2', { style: 'margin:0 0 15px 0;' }, 'Komandanı Redaktə Et'),
    nameInput, descInput, visSelect, submitBtn]);
}

async function renderTeamSettings(container, team) {
  if (!team.isAdmin) {
    container.innerHTML = `<div class="empty-state">Bu bölmə üçün icazəniz yoxdur.</div>`;
    return;
  }
  loading(container);
  const rolesRes = await api(`/teams/${team.slug}/roles`).catch(() => ({ roles: [], available: [] }));
  const roles = rolesRes.roles || [];
  const available = rolesRes.available || [];
  const canRoles = team.permissions?.includes('*') || team.permissions?.includes('manage_roles');
  const canDelete = team.permissions?.includes('*') || team.permissions?.includes('manage_team');

  container.innerHTML = `
    <div class="card" style="margin-top:20px;">
      <h3 style="margin-bottom:15px">Komanda Parametrləri</h3>
      <div class="form-group">
        <label for="teamNameInput">Komanda Adı</label>
        <input type="text" id="teamNameInput" class="auth-input" style="width:100%;" />
      </div>
      <div class="form-group" style="margin-top:15px">
        <label for="teamDescInput">Açıqlama</label>
        <textarea id="teamDescInput" class="auth-input" rows="3" style="width:100%;"></textarea>
      </div>
      <div class="form-group" style="margin-top:15px">
        <label for="teamVisInput">Görünürlük</label>
        <select id="teamVisInput" class="auth-input" style="width:100%;">
          <option value="Public">🌍 Public</option>
          <option value="Private">🔒 Private</option>
          <option value="Invite">✉️ Invite Only</option>
        </select>
      </div>
      <button id="saveTeamSettings" class="btn-primary" style="margin-top:20px; width:100%;">Yadda Saxla</button>
    </div>

    <div class="card" style="margin-top:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
        <h3 style="margin:0;">Rollar və icazələr</h3>
        ${canRoles ? '<button class="btn-primary btn-mini" id="btnNewRole">Yeni rol</button>' : ''}
      </div>
      <div id="rolesList" style="margin-top:12px;"></div>
    </div>

    ${canDelete ? `<div class="card" style="margin-top:20px; border:1px solid var(--danger);">
      <h3 style="color:var(--danger); margin-bottom:15px">Təhlükəli Zona</h3>
      <p style="color:var(--muted); font-size:14px; margin-bottom:15px">
        Komandanı silsəniz bütün layihələr və tapşırıqlar arxivə düşəcək.</p>
      <button id="deleteTeamBtn" class="btn" style="background:var(--danger); color:#fff; width:100%;">Komandanı Sil</button>
    </div>` : ''}
  `;

  // Dəyərlər `innerHTML` şablonuna deyil, DOM property-sinə yazılır — belədə
  // ad/açıqlamadakı tırnaq və `<` işarələri markup-u sındıra bilmir.
  document.getElementById('teamNameInput').value = team.name || '';
  document.getElementById('teamDescInput').value = team.description || '';
  document.getElementById('teamVisInput').value = team.visibility || 'Private';

  document.getElementById('saveTeamSettings').onclick = async () => {
    const payload = {
      name: document.getElementById('teamNameInput').value.trim(),
      description: document.getElementById('teamDescInput').value,
      visibility: document.getElementById('teamVisInput').value,
    };
    if (!payload.name) return toast('Ad daxil edin', 'err');
    try {
      await api(`/teams/${team.slug}`, { method: 'PATCH', body: payload });
      Object.assign(team, payload);
      toast('Parametrlər yadda saxlanıldı');
      renderTeamHeader(team);
    } catch (e) { toast(e.message, 'err'); }
  };

  document.getElementById('deleteTeamBtn')?.addEventListener('click', async () => {
    if (!(await confirmDialog('Komandanı silməyə əminsiniz?'))) return;
    try {
      await api(`/teams/${team.slug}`, { method: 'DELETE' });
      toast('Komanda silindi');
      window.location.hash = '#teams';
    } catch (e) { toast(e.message, 'err'); }
  });

  const rolesList = document.getElementById('rolesList');
  const drawRoles = () => {
    rolesList.innerHTML = '';
    roles.forEach(r => {
      const row = el('div', {
        style: 'display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border); flex-wrap:wrap;',
      });
      const perms = r.permissions?.includes('*') ? 'bütün icazələr' : (r.permissions || []).join(', ') || 'icazə yoxdur';
      row.innerHTML = `<div><strong>${esc(r.name)}</strong>
        <div style="font-size:12px; color:var(--text-sec);">${esc(perms)}</div></div>`;
      if (canRoles && r.name !== 'Owner') {
        const act = el('div', { style: 'display:flex; gap:6px;' });
        const edit = el('button', { class: 'btn-text btn-mini' }, 'Redaktə');
        edit.onclick = () => openRoleModal(team, r, available, container);
        const del = el('button', { class: 'btn-text btn-mini', style: 'color:var(--danger);' }, 'Sil');
        del.onclick = async () => {
          if (!(await confirmDialog(`"${r.name}" rolu silinsin? Üzvlər Developer roluna keçəcək.`))) return;
          try {
            await api(`/teams/${team.slug}/roles/${r.id}`, { method: 'DELETE' });
            toast('Rol silindi');
            renderTeamSettings(container, team);
          } catch (e) { toast(e.message, 'err'); }
        };
        act.append(edit, del);
        row.appendChild(act);
      }
      rolesList.appendChild(row);
    });
  };
  drawRoles();

  document.getElementById('btnNewRole')?.addEventListener('click',
    () => openRoleModal(team, null, available, container));
}

function openRoleModal(team, role, available, container) {
  const nameInput = el('input', {
    type: 'text', value: role?.name || '', placeholder: 'Rol adı',
    class: 'auth-input', style: 'width:100%; margin-bottom:10px;',
  });
  const prioInput = el('input', {
    type: 'number', value: String(role?.priority ?? 20), placeholder: 'Prioritet',
    class: 'auth-input', style: 'width:100%; margin-bottom:10px;',
  });

  const permsBox = el('div', { style: 'display:flex; flex-direction:column; gap:6px; margin-bottom:10px;' });
  const boxes = {};
  (available.length ? available : []).forEach(p => {
    const label = el('label', { style: 'display:flex; align-items:center; gap:8px; font-size:14px;' });
    const cb = el('input', { type: 'checkbox' });
    cb.checked = !!role?.permissions?.includes(p) || !!role?.permissions?.includes('*');
    boxes[p] = cb;
    label.append(cb, document.createTextNode(p));
    permsBox.appendChild(label);
  });

  const submitBtn = el('button', { class: 'btn-primary', style: 'width:100%; margin-top:10px;' },
    role ? 'Yadda Saxla' : 'Yarat');

  submitBtn.onclick = async () => {
    const name = nameInput.value.trim();
    if (!name) return toast('Rol adı daxil edin', 'err');
    const permissions = Object.entries(boxes).filter(([, cb]) => cb.checked).map(([p]) => p);

    submitBtn.disabled = true;
    try {
      if (role) {
        await api(`/teams/${team.slug}/roles/${role.id}`, {
          method: 'PATCH', body: { name, permissions, priority: Number(prioInput.value) || 0 },
        });
      } else {
        await api(`/teams/${team.slug}/roles`, {
          method: 'POST', body: { name, permissions, priority: Number(prioInput.value) || 0 },
        });
      }
      toast('Rol yadda saxlanıldı');
      closeModal();
      renderTeamSettings(container, team);
    } catch (e) {
      toast(e.message, 'err');
      submitBtn.disabled = false;
    }
  };

  showModal([
    el('h2', { style: 'margin:0 0 15px 0;' }, role ? 'Rolu Redaktə Et' : 'Yeni Rol'),
    nameInput,
    el('label', { style: 'font-size:13px; color:var(--text-sec);' }, 'Prioritet (böyük = yüksək)'),
    prioInput,
    el('label', { style: 'font-size:13px; color:var(--text-sec);' }, 'İcazələr'),
    permsBox,
    submitBtn,
  ]);
}
