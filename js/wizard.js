// Çoxaddımlı qeydiyyat sihirbazı: Hesab → Şəxsi → Bacarıqlar → Sosial.
// Bütün sahələr sonradan profil redaktorundan dəyişdirilə bilir.
import { api } from './api.js';
import { register } from './auth.js';
import { el, clear, normalizeUsername, validUsername, resizeImage, authErrMessage, debounce } from './util.js';
import { toast } from './ui.js';
import { tax, SKILL_LEVELS } from './taxonomy.js';
// Parol göstər/gizlət düyməsinin SVG ikonu üçün (emoji əvəzinə).
import { paintIcons } from './icons.js';
import { t } from './i18n.js';

const LOOKING_FOR = [
  { id: 'Study partner', key: 'wiz.look_study' },
  { id: 'Mentor', key: 'wiz.look_mentor' },
  { id: 'Layihə komandası', key: 'wiz.look_team' }
];

/* ---------- paylaşılan komponent: səviyyəli skill seçici ----------
   Klik dövrü: seçilməyib → Başlanğıc → Orta → Qabaqcıl → seçilməyib. */
export function skillLevelPicker(items, selected = {}){
  const box = el('div', { class: 'skill-pick' });
  items.forEach(item => {
    const label = item.label;
    let lvl = selected[label] ? SKILL_LEVELS.indexOf(selected[label]) + 1 : 0;
    const lvlSpan = el('span', { class: 'lvl' }, '');
    const chip = el('button', { type: 'button', class: 'skill-chip', dataset: { label } },
      (item.icon || item.flag || ''), ' ', label, lvlSpan);
    const apply = () => {
      chip.classList.remove('l1', 'l2', 'l3');
      if(lvl > 0){ chip.classList.add('l' + lvl); lvlSpan.textContent = SKILL_LEVELS[lvl - 1]; chip.dataset.level = SKILL_LEVELS[lvl - 1]; }
      else { lvlSpan.textContent = ''; delete chip.dataset.level; }
    };
    chip.addEventListener('click', () => { lvl = (lvl + 1) % 4; apply(); });
    apply();
    box.append(chip);
  });
  box.getSelection = () => {
    const out = {};
    box.querySelectorAll('.skill-chip[data-level]').forEach(c => { out[c.dataset.label] = c.dataset.level; });
    return out;
  };
  return box;
}

export function passStrength(pass){
  let score = 0;
  if(pass.length >= 6) score++;
  if(pass.length >= 10) score++;
  if(/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
  if(/\d/.test(pass)) score++;
  if(/[^A-Za-z0-9]/.test(pass)) score++;
  const lbls = [t('wiz.pw_vweak'), t('wiz.pw_weak'), t('wiz.pw_med'), t('wiz.pw_good'), t('wiz.pw_strong'), t('wiz.pw_vstrong')];
  const colors = ['#ff5470', '#ff5470', '#d9a441', '#d9a441', '#3dd68c', '#3dd68c'];
  return { pct: Math.min(100, score * 20), label: lbls[score], color: colors[score] };
}

export function ageFromBirthDate(bd){
  if(!bd) return 0;
  const d = new Date(bd);
  if(isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if(now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
}

/* ---------- wizard ---------- */
const freshData = () => ({
  username: '', pass: '', contactEmail: '',
  name: '', gender: '', birthDate: '', country: '', city: '', bio: '', avatarBlob: null,
  progLevels: {}, langLevels: {}, goals: '', lookingFor: [],
  instagram: '', github: '', linkedin: '', telegram: '', website: '',
  // ⚠ Burada olmalıdır ki, uğurlu qeydiyyatdan sonra `freshData()` onu da
  //   sıfırlasın — əks halda növbəti qeydiyyat əvvəlkinin kodunu daşıyardı.
  inviteCode: '',
  // OAuth qeydiyyatı (Bənd 5): dolu olduqda parol sahələri gizlənir və
  // qeydiyyat sorğusu bu biletlə gedir. Bilet serverdə saxlanılır — client
  // ondan email/provayder id-sini oxuya və dəyişdirə bilmir.
  oauthTicket: null, oauthProvider: '', oauthAvatarUrl: '',
});
let data = freshData();
let step = 0;
let goingBack = false;

const field = (label, node, hint) => el('div', { class: 'field' },
  el('label', {}, label), node,
  hint ? el('div', { style: 'font-size:.68rem; color:var(--muted); margin-top:3px;' }, hint) : null);

const textInput = (key, ph, max = 60, type = 'text') => {
  const i = el('input', { type, placeholder: ph, maxLength: max, value: data[key] || '' });
  i.addEventListener('input', () => { data[key] = i.value; });
  return i;
};

/**
 * Parol "göstər / gizlət" düyməsi.
 *
 * 🔴 İKİ QÜSUR DÜZƏLDİLİR:
 *   1. Düymənin məzmunu `'👁'` EMOJİSİ idi — platformadan asılı çəkilirdi,
 *      `currentColor`-a tabe deyildi (dörd temaya uyğunlaşmırdı) və vəziyyət
 *      dəyişəndə eyni qalırdı, yəni parolun açıq/gizli olduğu bilinmirdi.
 *   2. Düymə YALNIZ birinci parol sahəsində vardı; "parol təkrarı"nda heç
 *      yox idi — istifadəçi yazdığını yoxlaya bilmirdi, halbuki səhv yazmaq
 *      məhz təkrar sahəsində daha çox olur.
 *
 * ⚠ `aria-label` vəziyyətlə birlikdə dəyişir: ekran oxuyucusu düymənin indi
 *   NƏ edəcəyini bilməlidir ("göstər" ↔ "gizlət").
 */
function eyeToggle(input){
  const slot = el('span', { class: 'ic', 'data-icon': 'eye', 'data-icon-size': '16' });
  const btn = el('button', {
    type: 'button', class: 'eye-btn',
    'aria-label': t('wiz.pass_show'),
    onclick: () => {
      const show = input.type === 'password';   // klikdən SONRAKI vəziyyət
      input.type = show ? 'text' : 'password';
      slot.dataset.icon = show ? 'eyeOff' : 'eye';
      slot.querySelector('svg')?.remove();
      btn.setAttribute('aria-label', t(show ? 'wiz.pass_hide' : 'wiz.pass_show'));
      paintIcons(btn);
    },
  }, slot);
  paintIcons(btn);   // ilkin SVG (element hələ DOM-a qoşulmayıb — problem deyil)
  return btn;
}

let unameStatusEl, checkUnameLive;

function step1(){
  const unameIn = el('input', { placeholder: t('wiz.lbl_uname'), maxLength: 20, autocapitalize: 'none', value: data.username });
  unameStatusEl = el('div', { class: 'uname-status' });
  checkUnameLive = debounce(async () => {
    const u = normalizeUsername(unameIn.value);
    if(!u){ unameStatusEl.textContent = ''; return; }
    if(!validUsername(u)){ unameStatusEl.textContent = '✗ ' + t('wiz.err_uname'); unameStatusEl.className = 'uname-status bad'; return; }
    unameStatusEl.textContent = '… ' + t('dyn.checking'); unameStatusEl.className = 'uname-status';
    try{
      const d = await api('/auth/username-available?u=' + encodeURIComponent(u));
      if(!d.available){ unameStatusEl.textContent = '✗ @' + u + ' ' + t('wiz.err_uname_taken'); unameStatusEl.className = 'uname-status bad'; }
      else { unameStatusEl.textContent = '✓ @' + u; unameStatusEl.className = 'uname-status ok'; }
    }catch(e){ unameStatusEl.textContent = ''; }
  }, 400);
  unameIn.addEventListener('input', () => { data.username = unameIn.value; checkUnameLive(); });

  const passIn = el('input', { type: 'password', placeholder: '••••••••', value: data.pass, autocomplete: 'new-password' });
  const eye = eyeToggle(passIn);
  const smFill = el('div', { class: 'sm-fill' });
  const smLbl = el('div', { class: 'strength-lbl' });
  passIn.addEventListener('input', () => {
    data.pass = passIn.value;
    const s = passStrength(passIn.value);
    smFill.style.width = s.pct + '%';
    smFill.style.backgroundColor = s.color;
    smLbl.textContent = passIn.value ? t('wiz.pass_str') + s.label : '';
  });
  const pass2In = el('input', { type: 'password', placeholder: t('wiz.ph_pass2'), autocomplete: 'new-password' });

  // OAuth axınında parol YOXDUR — kimlik provayder tərəfindən sübut olunur.
  // Sahələri gizlətmək əvəzinə ÜMUMİYYƏTLƏ QURMURUQ ki, boş parol sahəsi
  // brauzerin parol menecerini yanlış işə salmasın.
  const viaOAuth = !!data.oauthTicket;

  const node = el('div', { class: 'wiz-step' + (goingBack ? ' back' : '') },
    viaOAuth ? el('div', { class: 'oauth-note' },
      t('oauth.wiz_note').replace('{p}', data.oauthProvider)) : null,
    field(t('wiz.lbl_uname'), el('div', {}, unameIn, unameStatusEl), t('wiz.lbl_uname_hint')),
    viaOAuth ? null : field(t('wiz.lbl_pass'), el('div', {},
      el('div', { class: 'pass-wrap' }, passIn, eye),
      el('div', { class: 'strength-meter' }, smFill), smLbl)),
    // ⚠ Təkrar sahəsi də `pass-wrap` içindədir və öz göz düyməsini daşıyır —
    //   əvvəl yalnız birinci sahədə vardı.
    viaOAuth ? null : field(t('wiz.lbl_pass2'),
      el('div', { class: 'pass-wrap' }, pass2In, eyeToggle(pass2In))),
    field(t('wiz.lbl_email'), textInput('contactEmail', 'sen@example.com', 80, 'email')),
  );
  return { node, validate: async () => {
    const u = normalizeUsername(data.username);
    if(!validUsername(u)) return t('wiz.err_uname');
    if(!viaOAuth){
      if(data.pass.length < 6) return t('wiz.err_pass_len');
      if(pass2In.value !== data.pass) return t('wiz.err_pass_match');
    }
    if(data.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) return t('wiz.err_email');
    try{
      const d = await api('/auth/username-available?u=' + encodeURIComponent(u));
      if(!d.available) return t('wiz.err_uname_taken');
    }catch(e){}
    return null;
  } };
}

function step2(){
  const avPreview = el('div', { class: 'avatar' }, '+');
  if(data.avatarBlob){
    const img = document.createElement('img');
    img.src = URL.createObjectURL(data.avatarBlob);
    clear(avPreview); avPreview.append(img);
  }
  const fileIn = el('input', { type: 'file', accept: 'image/*' });
  fileIn.addEventListener('change', async e => {
    const f = e.target.files[0];
    if(!f) return;
    try{
      data.avatarBlob = await resizeImage(f, 300, 0.78);
      clear(avPreview);
      const img = document.createElement('img');
      img.src = URL.createObjectURL(data.avatarBlob);
      avPreview.append(img);
    }catch(err){ toast(t('wiz.err_img_read'), 'err'); }
  });

  const genderBox = el('div', { class: 'gender-pick' });
  ['Kişi', 'Qadın'].forEach(g => {
    const b = el('button', { type: 'button', class: 'genBtn' + (data.gender === g ? ' sel' : ''), onclick: () => {
      data.gender = g;
      genderBox.querySelectorAll('.genBtn').forEach(x => x.classList.toggle('sel', x === b));
    } }, t(g === 'Kişi' ? 'wiz.gender_m' : 'wiz.gender_f'));
    genderBox.append(b);
  });

  const bdIn = el('input', { type: 'date', value: data.birthDate, max: new Date().toISOString().slice(0, 10) });
  bdIn.addEventListener('input', () => { data.birthDate = bdIn.value; });

  const bioIn = el('textarea', { placeholder: t('wiz.ph_bio'), maxLength: 400,
    style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:9px; padding:10px 12px; font-size:.88rem; min-height:60px; font-family:inherit;' });
  bioIn.value = data.bio;
  bioIn.addEventListener('input', () => { data.bio = bioIn.value; });

  const node = el('div', { class: 'wiz-step' + (goingBack ? ' back' : '') },
    el('div', { class: 'photo-pick' }, avPreview, el('label', {}, t('wiz.lbl_photo'), fileIn)),
    field(t('wiz.lbl_name'), textInput('name', t('wiz.ph_name'))),
    field(t('wiz.lbl_bd'), bdIn),
    field(t('wiz.lbl_gender'), genderBox),
    el('div', { class: 'row2' },
      field(t('wiz.lbl_country'), textInput('country', t('wiz.ph_country'), 40)),
      field(t('wiz.lbl_city'), textInput('city', t('wiz.ph_city'), 40))),
    field(t('wiz.lbl_bio'), bioIn),
  );
  return { node, validate: () => {
    if(!data.name.trim()) return t('wiz.err_name');
    if(!data.birthDate) return t('wiz.err_bd');
    const age = ageFromBirthDate(data.birthDate);
    if(age < 18) return t('wiz.err_age');
    if(age > 100) return t('wiz.err_bd_inv');
    if(!data.gender) return t('wiz.err_gender');
    return null;
  } };
}

function step3(){
  const progPick = skillLevelPicker(tax.prog, data.progLevels);
  const langPick = skillLevelPicker(tax.spoken, data.langLevels);
  const goalsIn = el('textarea', { placeholder: t('wiz.ph_goals'), maxLength: 300,
    style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:9px; padding:10px 12px; font-size:.88rem; min-height:50px; font-family:inherit;' });
  goalsIn.value = data.goals;
  goalsIn.addEventListener('input', () => { data.goals = goalsIn.value; });

  const lfBox = el('div', { class: 'pill-pick' });
  LOOKING_FOR.forEach(x => {
    const b = el('button', { type: 'button', class: 'pp' + (data.lookingFor.includes(x.id) ? ' sel' : ''), dataset: { val: x.id }, onclick: () => {
      b.classList.toggle('sel');
      data.lookingFor = [...lfBox.querySelectorAll('.pp.sel')].map(p => p.dataset.val);
    } }, t(x.key));
    lfBox.append(b);
  });

  const node = el('div', { class: 'wiz-step' + (goingBack ? ' back' : '') },
    field(t('wiz.lbl_prog'), progPick, t('wiz.hint_prog')),
    field(t('wiz.lbl_lang'), langPick, t('wiz.hint_lang')),
    field(t('wiz.lbl_goals'), goalsIn),
    field(t('wiz.lbl_lf'), lfBox),
  );
  return { node, validate: () => {
    data.progLevels = progPick.getSelection();
    data.langLevels = langPick.getSelection();
    return null;
  } };
}

function step4(){
  /* Dəvət kodu — son addımda, sosial linklərdən sonra.
   *
   * 🔴 BU SAHƏ ƏVVƏL ÜMUMİYYƏTLƏ YOX İDİ, halbuki backend hazır idi:
   *   `worker/routes/auth.ts` qeydiyyatda `redeemInvite(c, b.inviteCode, id)`
   *   çağırır və `/api/invites/:code/check` qonaq endpoint-i məhz "qeydiyyat
   *   formunda canlı yoxlama" üçün yazılıb (bax `worker/index.ts` şərhi).
   *   Yəni dəvət XP-si heç vaxt verilə bilmirdi — axın yarımçıq qalmışdı.
   *
   * ⚠ SAHƏ MƏCBURİ DEYİL və validasiyası qeydiyyatı BLOKLAMIR: server səhv
   *   kodu qəsdən səssizcə udur (kod marketinq mexanizmidir, autentifikasiya
   *   şərti deyil). Buradakı canlı yoxlama yalnız İSTİFADƏÇİYƏ məlumat verir. */
  const inviteIn = el('input', {
    type: 'text', placeholder: 'ABCD1234', maxLength: 32,
    autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false',
    value: data.inviteCode || '',
  });
  const inviteStatus = el('div', { class: 'uname-status', role: 'status', 'aria-live': 'polite' });
  const checkInvite = debounce(async () => {
    const code = (data.inviteCode || '').trim();
    if(!code){ inviteStatus.textContent = ''; inviteStatus.className = 'uname-status'; return; }
    inviteStatus.textContent = '… ' + t('dyn.checking');
    inviteStatus.className = 'uname-status';
    try{
      const r = await api(`/invites/${encodeURIComponent(code)}/check`);
      if(r.valid){
        inviteStatus.textContent = '✓ ' + t('wiz.invite_ok') + ': ' + (r.inviterName || '—');
        inviteStatus.className = 'uname-status ok';
      }else{
        inviteStatus.textContent = '✗ ' + t('wiz.invite_bad');
        inviteStatus.className = 'uname-status bad';
      }
    }catch{
      // Şəbəkə xətası qeydiyyata mane olmamalıdır — status sadəcə təmizlənir.
      inviteStatus.textContent = '';
      inviteStatus.className = 'uname-status';
    }
  }, 450);
  inviteIn.addEventListener('input', () => {
    // Kodlar böyük hərflə saxlanılır; istifadəçi kiçik yazsa da uyğunlaşır.
    data.inviteCode = inviteIn.value.trim().toUpperCase();
    checkInvite();
  });

  const node = el('div', { class: 'wiz-step' + (goingBack ? ' back' : '') },
    el('div', { class: 'row2' },
      field('Instagram', textInput('instagram', '@istifadəçi', 40)),
      field('GitHub', textInput('github', 'istifadəçi', 40))),
    el('div', { class: 'row2' },
      field('LinkedIn', textInput('linkedin', 'in/istifadəçi', 60)),
      field('Telegram', textInput('telegram', '@istifadəçi', 40))),
    field(t('wiz.lbl_site'), textInput('website', 'https://...', 100)),
    el('div', { class: 'wiz-invite' },
      field(
        t('wiz.lbl_invite') + ' (' + t('wiz.invite_opt') + ')',
        el('div', {}, inviteIn, inviteStatus),
        t('wiz.invite_hint'),
      ),
    ),
  );
  return { node, validate: () => {
    if(data.website && !/^https?:\/\/.+\..+/.test(data.website)) return t('wiz.err_site');
    return null;
  } };
}

const STEPS = [
  { title: () => t('wiz.title1'), build: step1 },
  { title: () => t('wiz.title2'), build: step2 },
  { title: () => t('wiz.title3'), build: step3 },
  { title: () => t('wiz.title4'), build: step4 },
];
let currentValidate = null;

function renderStep(){
  const body = document.getElementById('wizBody');
  clear(body);
  const { node, validate } = STEPS[step].build();
  currentValidate = validate;
  body.append(node);
  // Ana#11 — tərəqqi paneli: faiz + bar + bütün addım etiketləri (tamamlanmış/cari/gözləyən).
  // Yarımçıq qoymanı azaltmaq üçün istifadəçi harada olduğunu və nə qaldığını görür.
  const pct = Math.round((step + 1) / STEPS.length * 100);
  document.getElementById('wizStepLbl').textContent =
    t('wiz.step1').replace('{0}', step + 1).replace('{1}', STEPS.length).replace('{2}', STEPS[step].title())
    + ' · ' + pct + '%';
  document.getElementById('wizProgressFill').style.width = pct + '%';
  document.getElementById('wizProgress').setAttribute('aria-valuenow', String(pct));

  const stepsBox = document.getElementById('wizSteps');
  clear(stepsBox);
  STEPS.forEach((s, i) => {
    const state = i < step ? 'done' : (i === step ? 'cur' : '');
    stepsBox.append(el('li', {
      class: 'wiz-step-chip' + (state ? ' ' + state : ''),
      'aria-current': i === step ? 'step' : null,
    }, el('span', { class: 'wsc-dot' }, i < step ? '✓' : String(i + 1)),
       el('span', { class: 'wsc-lbl' }, s.title())));
  });
  document.getElementById('wizBackBtn').style.visibility = step === 0 ? 'hidden' : 'visible';
  document.getElementById('wizNextBtn').textContent = step === STEPS.length - 1 ? t('wiz.btn_finish') : t('wiz.btn_next');
  document.getElementById('regErr').textContent = '';
}

/**
 * OAuth qeydiyyat biletini sihirbaza tətbiq edir (Bənd 5).
 * Provayderdən ad/email/avatar gəlir; İSTİFADƏÇİ ADI və DOĞUM TARİXİ isə
 * burada soruşulur — sonuncu 18+ qapısıdır və provayder onu vermir.
 * @returns {Promise<boolean>} bilet etibarlıdırsa true
 */
export async function applyOAuthTicket(ticket){
  let p;
  try{
    p = await api('/auth/oauth/pending?ticket=' + encodeURIComponent(ticket));
  }catch(e){
    return false;   // bilet vaxtı bitib — istifadəçi adi qeydiyyatla davam edir
  }
  data = freshData();
  data.oauthTicket = ticket;
  data.oauthProvider = p.provider;
  data.username = p.username || '';
  data.name = p.name || '';
  data.contactEmail = p.email || '';
  // Avatar URL-i saxlanılır, amma FAYL kimi yüklənmir: provayderin CDN-i
  // bizim CSP-də (`img-src 'self' data: blob:`) icazəli deyil və `store.js`
  // avatar axını Blob gözləyir. Sadəcə ad/email prefill kifayətdir.
  data.oauthAvatarUrl = p.avatar || '';
  step = 0;
  renderStep();
  return true;
}

export function initWizard(){
  document.getElementById('wizBackBtn').addEventListener('click', () => {
    if(step === 0) return;
    goingBack = true; step--; renderStep(); goingBack = false;
  });
  document.getElementById('wizNextBtn').addEventListener('click', async e => {
    const err = document.getElementById('regErr');
    err.textContent = '';
    const btn = e.currentTarget;
    btn.disabled = true;
    const v = currentValidate ? await currentValidate() : null;
    if(v){ err.textContent = v; btn.disabled = false; return; }
    if(step < STEPS.length - 1){
      step++; renderStep(); btn.disabled = false;
      return;
    }
    // Son addım — qeydiyyat
    err.textContent = t('wiz.create_load');
    try{
      await register({
        usernameRaw: data.username, pass: data.pass, oauthTicket: data.oauthTicket,
        name: data.name.trim(), gender: data.gender,
        birthDate: data.birthDate, age: ageFromBirthDate(data.birthDate),
        country: data.country.trim(), city: data.city.trim(),
        bio: data.bio.trim(), contactEmail: data.contactEmail.trim(),
        progLevels: data.progLevels, langLevels: data.langLevels,
        goals: data.goals.trim(), lookingFor: data.lookingFor,
        instagram: data.instagram.trim(), github: data.github.trim(),
        linkedin: data.linkedin.trim(), telegram: data.telegram.trim(), website: data.website.trim(),
        inviteCode: (data.inviteCode || '').trim(),
        avatarBlob: data.avatarBlob,
      });
      err.textContent = '';
      // Uğur: wizard sıfırlanır (növbəti qeydiyyat üçün); onAuthStateChanged tətbiqə daxil edəcək
      data = freshData();
      step = 0;
      renderStep();
    }catch(ex){
      console.error('wizard register', ex);
      err.textContent = ex.code === 'app/bad-username'
        ? t('wiz.err_uname')
        : authErrMessage(ex);
    }
    btn.disabled = false;
  });
  renderStep();
}
