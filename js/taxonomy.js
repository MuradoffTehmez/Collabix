// Dinamik taksonomiya — Worker API-dən yüklənir; boş olsa DEFAULTS işləyir.
import { api } from './api.js';
import { emit } from './util.js';

export const SKILL_LEVELS = ['Başlanğıc', 'Orta', 'Qabaqcıl'];

export const DEFAULT_PROG = [
  { id: 'python',     label: 'Python',     color: '#3776ab', icon: '🐍', highlightId: 'python',     order: 1 },
  { id: 'javascript', label: 'JavaScript', color: '#f7df1e', icon: '⚡', highlightId: 'javascript', order: 2 },
  { id: 'typescript', label: 'TypeScript', color: '#3178c6', icon: '🔷', highlightId: 'typescript', order: 3 },
  { id: 'cpp',        label: 'C++',        color: '#659ad2', icon: '⚙️', highlightId: 'cpp',        order: 4 },
  { id: 'csharp',     label: 'C#',         color: '#68217a', icon: '♯',  highlightId: 'csharp',     order: 5 },
  { id: 'java',       label: 'Java',       color: '#e76f00', icon: '☕', highlightId: 'java',       order: 6 },
  { id: 'go',         label: 'Go',         color: '#00add8', icon: '🐹', highlightId: 'go',         order: 7 },
  { id: 'rust',       label: 'Rust',       color: '#dea584', icon: '🦀', highlightId: 'rust',       order: 8 },
  { id: 'php',        label: 'PHP',        color: '#777bb4', icon: '🐘', highlightId: 'php',        order: 9 },
  { id: 'kotlin',     label: 'Kotlin',     color: '#7f52ff', icon: '🅺', highlightId: 'kotlin',     order: 10 },
  { id: 'swift',      label: 'Swift',      color: '#f05138', icon: '🕊', highlightId: 'swift',      order: 11 },
  { id: 'sql',        label: 'SQL',        color: '#e38c00', icon: '🗄', highlightId: 'sql',        order: 12 },
  { id: 'htmlcss',    label: 'HTML/CSS',   color: '#e34c26', icon: '🎨', highlightId: 'xml',        order: 13 },
  { id: 'bash',       label: 'Bash',       color: '#4eaa25', icon: '💲', highlightId: 'bash',       order: 14 },
  { id: 'arduino',    label: 'Arduino/C',  color: '#00979d', icon: '🔌', highlightId: 'c',          order: 15 },
];

export const DEFAULT_SPOKEN = [
  { id: 'ingilis', label: 'İngilis', flag: '🇬🇧', order: 1 },
  { id: 'alman',   label: 'Alman',   flag: '🇩🇪', order: 2 },
  { id: 'rus',     label: 'Rus',     flag: '🇷🇺', order: 3 },
  { id: 'fransiz', label: 'Fransız', flag: '🇫🇷', order: 4 },
  { id: 'ispan',   label: 'İspan',   flag: '🇪🇸', order: 5 },
  { id: 'ereb',    label: 'Ərəb',    flag: '🇸🇦', order: 6 },
  { id: 'turk',    label: 'Türk',    flag: '🇹🇷', order: 7 },
  { id: 'cin',     label: 'Çin',     flag: '🇨🇳', order: 8 },
];

export const tax = { prog: [...DEFAULT_PROG], spoken: [...DEFAULT_SPOKEN] };

export async function loadTaxonomies(){
  try{
    const d = await api('/taxonomies');
    if(d.taxonomies.prog?.length) tax.prog = d.taxonomies.prog;
    if(d.taxonomies.spoken?.length) tax.spoken = d.taxonomies.spoken;
  }catch(e){ console.error('loadTaxonomies', e); }
  emit('taxonomy-updated');
}

/* ---------- köməkçilər ---------- */
export const progLabels = () => tax.prog.map(i => i.label);
export const spokenLabels = () => tax.spoken.map(i => i.label);
export const allCategoryLabels = () => [...progLabels(), ...spokenLabels()];
export const highlightOptions = () => tax.prog
  .filter(i => i.highlightId)
  .map(i => ({ label: i.label, highlightId: i.highlightId }));
export const progItem = label => tax.prog.find(i => i.label === label) || null;

/* ---------- admin CRUD ---------- */
export async function saveTaxItem(typeKey, item){
  await api('/taxonomies/' + typeKey, { method: 'POST', body: item });
  await loadTaxonomies();
}
export async function deactivateTaxItem(typeKey, id){
  await api(`/taxonomies/${typeKey}/${id}`, { method: 'DELETE' });
  await loadTaxonomies();
}
export const deleteTaxItem = deactivateTaxItem;

// Default dəst artıq D1 seed migrationundadır; bu, əskikləri bərpa edir.
export async function seedTaxonomies(){
  let n = 0;
  const have = { prog: new Set(tax.prog.map(i => i.id)), spoken: new Set(tax.spoken.map(i => i.id)) };
  for(const item of DEFAULT_PROG){
    if(!have.prog.has(item.id)){ await api('/taxonomies/prog', { method: 'POST', body: item }); n++; }
  }
  for(const item of DEFAULT_SPOKEN){
    if(!have.spoken.has(item.id)){ await api('/taxonomies/spoken', { method: 'POST', body: item }); n++; }
  }
  await loadTaxonomies();
  return n;
}
