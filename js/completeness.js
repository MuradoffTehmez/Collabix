// Profil tamlığı + gamification (TASK-8 / FAZA 3 / Bənd 6).
//
// Progressive profiling fəlsəfəsi: qeydiyyatda yalnız ƏSAS məlumat alınır,
// qalan sahələr sistem kəşf edildikcə doldurulur. Bu modul "nə qədəri
// doldurulub" göstərir və qalanı doldurmağa təşviq edir.
import { el, clear } from './util.js';
import { t } from './i18n.js';
import { emit } from './util.js';

// Hər sahə tamlığa BƏRABƏR çəki ilə qatqı verir. Sahələr qəsdən "kəşf ilə
// dolan" tiplərdir — qeydiyyatın özündə tələb olunmayanlar.
const FIELDS = [
  { key: 'photoURL',  labelKey: 'cmp.f_avatar', check: u => !!u.photoURL },
  { key: 'bio',       labelKey: 'cmp.f_bio',    check: u => (u.bio || '').trim().length >= 10 },
  { key: 'goals',     labelKey: 'cmp.f_goals',  check: u => (u.goals || '').trim().length >= 5 },
  { key: 'prog',      labelKey: 'cmp.f_prog',   check: u => (u.prog || []).length > 0 },
  { key: 'langs',     labelKey: 'cmp.f_langs',  check: u => (u.langs || []).length > 0 },
  { key: 'lookingFor',labelKey: 'cmp.f_looking',check: u => (u.lookingFor || []).length > 0 },
  { key: 'city',      labelKey: 'cmp.f_city',   check: u => !!(u.city || '').trim() },
  { key: 'social',    labelKey: 'cmp.f_social', check: u =>
      !!(u.github || u.linkedin || u.instagram || u.telegram || u.website) },
];

const COMPLETION_XP = 20;   // 100%-ə çatanda verilən bonus (sənəddəki nümunə)

/**
 * @returns {{ percent: number, done: number, total: number,
 *             missing: Array<{ key: string, label: string }>, complete: boolean }}
 */
export function profileCompleteness(user){
  const u = user || {};
  const results = FIELDS.map(f => ({ ...f, ok: f.check(u) }));
  const done = results.filter(r => r.ok).length;
  const percent = Math.round(done / FIELDS.length * 100);
  return {
    percent, done, total: FIELDS.length,
    complete: done === FIELDS.length,
    missing: results.filter(r => !r.ok).map(r => ({ key: r.key, label: t(r.labelKey) })),
  };
}

/**
 * Profil başlığında tamlıq indikatoru + nudge render edir.
 * 100% olduqda tamamlanma bloku GİZLƏNİR (motivasiya artıq lazım deyil).
 * @param {HTMLElement} host
 * @param {object} user
 * @param {Function} onEdit  "Tamamla" düyməsi profil redaktorunu açır
 */
export function renderCompleteness(host, user, onEdit){
  if(!host) return;
  const c = profileCompleteness(user);
  clear(host);
  if(c.complete){ host.hidden = true; return; }
  host.hidden = false;

  // Dairəvi faiz göstəricisi (conic-gradient) — mətn faizi ilə birlikdə.
  const ring = el('div', { class: 'cmp-ring', style: `--pct:${c.percent}` },
    el('span', { class: 'cmp-ring-num' }, c.percent + '%'));

  // Ən çox 3 çatışmayan sahə çip kimi — hər biri redaktora aparır.
  const chips = el('div', { class: 'cmp-chips' });
  c.missing.slice(0, 3).forEach(m => {
    chips.append(el('button', { class: 'cmp-chip', onclick: () => onEdit && onEdit(m.key) },
      '+ ' + m.label));
  });

  host.append(el('div', { class: 'cmp-card' }, [
    ring,
    el('div', { class: 'cmp-body' }, [
      el('div', { class: 'cmp-title' }, t('cmp.title')),
      // XP təşviqi — sənəddəki "100% üçün 20 XP qazan".
      el('div', { class: 'cmp-hint' },
        t('cmp.hint').replace('{xp}', String(COMPLETION_XP))),
      chips,
    ]),
  ]));
}
