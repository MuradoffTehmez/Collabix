// Autentifikasiya — JWT (HttpOnly cookie) + Cloudflare Worker API.
// Parollar server tərəfdə PBKDF2 ilə heşlənir; client-də heç nə saxlanılmır.
import { api } from './api.js';
import { state } from './store.js';
import { bus } from './util.js';
import { tokenFor, resetWidget } from './turnstile.js';
import { promptMfaCode } from './mfa.js';
import { toast } from './ui.js';

let onLoginCb = null;
let onLogoutCb = null;

function applySession(d){
  state.authUser = { uid: d.user.uid };
  state.me = d.user;
  state.isAdmin = !!d.isAdmin;
}

// Boot zamanı sessiyanı yoxlayır; register/login/logout eyni callback-ləri çağırır.
export function watchAuthState(onLogin, onLogout){
  onLoginCb = onLogin;
  onLogoutCb = onLogout;
  api('/auth/me').then(d => {
    if(d.user){ applySession(d); onLogin(); }
    else onLogout();
  }).catch(() => onLogout());
  // sessiya bitəndə (401) çıxışa yönləndir
  bus.addEventListener('api-unauthorized', () => {
    if(state.me){
      state.me = null; state.authUser = null; state.isAdmin = false;
      onLogoutCb && onLogoutCb();
    }
  });

  // Rate limit (429) — AUDIT-TASK-4 §4.6/4. Bildiriş olmasa istifadəçi üçün
  // sayt sadəcə "işləmir" kimi görünür. Toast 20 saniyədə bir dəfədən çox
  // göstərilmir: limit dolduqda onlarla paralel sorğu eyni anda 429 alır.
  let lastRlToast = 0;
  bus.addEventListener('api-rate-limited', ev => {
    if(Date.now() - lastRlToast < 20_000) return;
    lastRlToast = Date.now();
    const sec = (ev.detail && ev.detail.retryAfter) || 60;
    toast(`Çox sayda sorğu göndərildi. ${sec} saniyə sonra yenidən cəhd edin.`, 'err');
  });
  return () => {};
}

export async function register(d){
  // Turnstile token-i (qoruma söndürülübsə boş sətir — server onu gözləmir).
  const turnstileToken = await tokenFor('register');
  let res;
  try{
    res = await api('/auth/register', {
      method: 'POST',
      body: {
        turnstileToken, oauthTicket: d.oauthTicket || undefined,
        username: d.usernameRaw, pass: d.pass,
        name: d.name, age: d.age, birthDate: d.birthDate, gender: d.gender,
        country: d.country, city: d.city, bio: d.bio, contactEmail: d.contactEmail,
        progLevels: d.progLevels, langLevels: d.langLevels,
        goals: d.goals, lookingFor: d.lookingFor,
        instagram: d.instagram, github: d.github, linkedin: d.linkedin,
        telegram: d.telegram, website: d.website,
      },
    });
  }catch(e){
    resetWidget('register');   // token birdəfəlikdir — bax login()-dəki izah
    throw e;
  }
  applySession({ user: res.user, isAdmin: false });
  // avatar qeydiyyatdan sonra yüklənir (sessiya artıq var)
  if(d.avatarBlob){
    try{
      const { uploadAvatar, updateMyProfile } = await import('./store.js');
      const url = await uploadAvatar(d.avatarBlob);
      await updateMyProfile({ photoURL: url });
    }catch(e){ console.error('avatar upload', e); }
  }
  onLoginCb && onLoginCb();
}

export async function login(usernameRaw, pass, _remember = true){
  const turnstileToken = await tokenFor('login');
  try{
    let res = await api('/auth/login', {
      method: 'POST', body: { username: usernameRaw, pass, turnstileToken },
    });

    // 2FA aktivdirsə server sessiya VERMİR — parol düz olsa belə ikinci addım
    // gözlənilir (Bənd 2). Cavabda istifadəçi məlumatı da olmur.
    if(res.mfaRequired){
      const verified = await promptMfaCode(res.challenge);
      // İstifadəçi modalı bağladı → giriş baş tutmadı. Xəta atmırıq: bu,
      // səhv deyil, imtinadır — auth ekranı olduğu kimi qalır.
      if(!verified) return;
      res = verified;
    }

    const meRes = await api('/auth/me');
    applySession({ user: res.user, isAdmin: meRes.isAdmin });
    onLoginCb && onLoginCb();
  }catch(e){
    // Turnstile token-i BİRDƏFƏLİKDİR. Uğursuz girişdən sonra sıfırlanmasa
    // növbəti cəhd artıq istifadə olunmuş token göndərər və server onu rədd
    // edər — istifadəçi düzgün parolla belə içəri girə bilməzdi.
    resetWidget('login');
    throw e;
  }
}

export async function logout(){
  await api('/auth/logout', { method: 'POST' }).catch(() => {});
  state.me = null; state.authUser = null; state.isAdmin = false;
  onLogoutCb && onLogoutCb();
}

export async function changePassword(currentPass, newPass){
  await api('/auth/change-password', { method: 'POST', body: { current: currentPass, next: newPass } });
  if(state.me) state.me.mustResetPassword = false;
}

export async function changeUsername(currentPass, newUsernameRaw){
  const d = await api('/auth/change-username', { method: 'POST', body: { current: currentPass, next: newUsernameRaw } });
  if(state.me) state.me.username = d.username;
}

export async function deleteAccount(currentPass){
  await api('/auth/account', { method: 'DELETE', body: { pass: currentPass } });
  state.me = null; state.authUser = null; state.isAdmin = false;
  onLogoutCb && onLogoutCb();
}
