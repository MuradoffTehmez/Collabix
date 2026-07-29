// Transactional email — Cloudflare Email Sending (TASK-8 / FAZA 2 / Bənd 4).
//
// Binding modeli seçilib (REST API yox): Worker-in içindən API açarı ümumiyyətlə
// lazım gəlmir, yəni saxlanacaq/sızacaq bir sirr də olmur.
//
// GRACEFUL DEGRADATION: `EMAIL` binding-i və ya `EMAIL_FROM` var-ı yoxdursa
// göndərmə ATLANIR (`skipped: true`) və çağıran tərəf axını normal davam etdirir.
// Magic link üçün bu o deməkdir ki, funksiya UI-da ümumiyyətlə görünmür —
// bax `publicConfig` → `magicLink` bayrağı.
import { Env } from './util';

export interface SendResult { ok: boolean; skipped: boolean; error?: string }

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;   // MƏCBURİ: bəzi client-lər yalnız mətn göstərir + spam balına müsbət təsir edir
}

export const emailEnabled = (env: Env) => !!env.EMAIL && !!env.EMAIL_FROM;

export async function sendEmail(env: Env, mail: Mail): Promise<SendResult> {
  if (!emailEnabled(env)) return { ok: false, skipped: true, error: 'email_not_configured' };
  try {
    await env.EMAIL!.send({
      to: mail.to,
      from: { email: env.EMAIL_FROM!, name: env.APP_NAME || 'Collabix' },
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    return { ok: true, skipped: false };
  } catch (e: any) {
    // Göndərmə xətası çağıran axını ÇÖKÜRTMÜR: istifadəçiyə onsuz da neytral
    // cavab qaytarılır (bax `magicLinkRequest` — istifadəçi sadalanmasının
    // qarşısını alır), xəta isə jurnala düşür.
    console.error('email göndərilmədi', e?.message || e);
    return { ok: false, skipped: false, error: String(e?.message || e) };
  }
}

/* ================= şablonlar ================= */

// HTML-ə qoyulan hər dinamik dəyər burdan keçir. Email client-ləri CSP tanımır,
// ona görə qaçırılmamış istifadəçi adı birbaşa markup-a düşsəydi məktubun
// özü inyeksiya səthi olardı.
const esc = (s: string) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const LANG = {
  az: {
    subject: 'Collabix — giriş linkin',
    hi: 'Salam',
    body: 'Aşağıdakı düymə ilə şifrəsiz giriş edə bilərsən. Link <b>10 dəqiqə</b> etibarlıdır və <b>yalnız bir dəfə</b> işləyir.',
    cta: 'Collabix-ə daxil ol',
    ignore: 'Bu girişi sən istəməmisənsə, məktubu nəzərə alma — hesabına heç nə olmayacaq.',
    fallback: 'Düymə işləmirsə bu ünvanı brauzerə köçür:',
  },
  en: {
    subject: 'Collabix — your sign-in link',
    hi: 'Hi',
    body: 'Use the button below to sign in without a password. The link is valid for <b>10 minutes</b> and works <b>only once</b>.',
    cta: 'Sign in to Collabix',
    ignore: 'If you did not request this, you can ignore this email — nothing will happen to your account.',
    fallback: 'If the button does not work, copy this address into your browser:',
  },
  ru: {
    subject: 'Collabix — ссылка для входа',
    hi: 'Привет',
    body: 'Войдите без пароля по кнопке ниже. Ссылка действует <b>10 минут</b> и срабатывает <b>только один раз</b>.',
    cta: 'Войти в Collabix',
    ignore: 'Если вы не запрашивали вход, просто проигнорируйте письмо — с аккаунтом ничего не произойдёт.',
    fallback: 'Если кнопка не работает, скопируйте адрес в браузер:',
  },
} as const;

export type MailLang = keyof typeof LANG;
export const mailLang = (v: unknown): MailLang =>
  (v === 'en' || v === 'ru' ? v : 'az');

export function magicLinkMail(name: string, url: string, lang: MailLang): Mail {
  const L = LANG[lang];
  const safeUrl = esc(url);
  return {
    to: '',   // çağıran tərəf doldurur
    subject: L.subject,
    // Inline CSS: email client-ləri <style> blokunu və xarici CSS-i çox vaxt atır.
    // Table layout-suz sadə struktur seçilib — müasir client-lərdə etibarlıdır.
    html: `<!doctype html><html><body style="margin:0;padding:24px;background:#0f1115;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#171a21;border:1px solid #262b36;border-radius:14px;padding:28px;color:#e6e8ee;">
    <div style="font-size:20px;font-weight:700;margin-bottom:18px;color:#fff;">Collabix</div>
    <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">${L.hi}, ${esc(name)} 👋</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 22px;color:#b6bcc9;">${L.body}</p>
    <a href="${safeUrl}" style="display:inline-block;background:#5b8cff;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:9px;">${L.cta}</a>
    <p style="font-size:13px;line-height:1.6;margin:24px 0 6px;color:#8b93a3;">${L.fallback}</p>
    <p style="font-size:12px;word-break:break-all;margin:0 0 20px;color:#5b8cff;">${safeUrl}</p>
    <p style="font-size:12px;line-height:1.6;margin:0;color:#6e7688;border-top:1px solid #262b36;padding-top:16px;">${L.ignore}</p>
  </div>
</body></html>`,
    text: `${L.hi}, ${name}\n\n${L.body.replace(/<\/?b>/g, '')}\n\n${url}\n\n${L.ignore}`,
  };
}

/* ---------- TASK-11: komanda dəvəti ---------- */

const INVITE_LANG = {
  az: {
    subject: (team: string) => `Collabix — "${team}" komandasına dəvət`,
    lead: (who: string, team: string, role: string) =>
      `<b>${who}</b> səni <b>${team}</b> komandasına <b>${role}</b> rolu ilə dəvət edir.`,
    cta: 'Dəvəti bax və qəbul et',
    expires: 'Dəvət 7 gün ərzində etibarlıdır.',
    ignore: 'Bu dəvəti gözləmirdinsə, məktubu nəzərə alma.',
    fallback: 'Düymə işləmirsə bu ünvanı brauzerə köçür:',
  },
  en: {
    subject: (team: string) => `Collabix — invitation to "${team}"`,
    lead: (who: string, team: string, role: string) =>
      `<b>${who}</b> invited you to join <b>${team}</b> as <b>${role}</b>.`,
    cta: 'View and accept invitation',
    expires: 'This invitation is valid for 7 days.',
    ignore: 'If you were not expecting this invitation, you can ignore this email.',
    fallback: 'If the button does not work, copy this address into your browser:',
  },
  ru: {
    subject: (team: string) => `Collabix — приглашение в «${team}»`,
    lead: (who: string, team: string, role: string) =>
      `<b>${who}</b> приглашает вас в команду <b>${team}</b> с ролью <b>${role}</b>.`,
    cta: 'Открыть приглашение',
    expires: 'Приглашение действительно 7 дней.',
    ignore: 'Если вы не ожидали приглашения, просто проигнорируйте письмо.',
    fallback: 'Если кнопка не работает, скопируйте адрес в браузер:',
  },
} as const;

export function teamInviteMail(
  opts: { teamName: string; inviterName: string; roleName: string; url: string },
  lang: MailLang,
): Mail {
  const L = INVITE_LANG[lang];
  const safeUrl = esc(opts.url);
  const lead = L.lead(esc(opts.inviterName), esc(opts.teamName), esc(opts.roleName));
  return {
    to: '',
    subject: L.subject(opts.teamName),
    html: `<!doctype html><html><body style="margin:0;padding:24px;background:#0f1115;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#171a21;border:1px solid #262b36;border-radius:14px;padding:28px;color:#e6e8ee;">
    <div style="font-size:20px;font-weight:700;margin-bottom:18px;color:#fff;">Collabix</div>
    <p style="font-size:15px;line-height:1.6;margin:0 0 22px;">${lead}</p>
    <a href="${safeUrl}" style="display:inline-block;background:#5b8cff;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:9px;">${L.cta}</a>
    <p style="font-size:13px;line-height:1.6;margin:22px 0 6px;color:#8b93a3;">${L.expires}</p>
    <p style="font-size:13px;line-height:1.6;margin:0 0 6px;color:#8b93a3;">${L.fallback}</p>
    <p style="font-size:12px;word-break:break-all;margin:0 0 20px;color:#5b8cff;">${safeUrl}</p>
    <p style="font-size:12px;line-height:1.6;margin:0;color:#6e7688;border-top:1px solid #262b36;padding-top:16px;">${L.ignore}</p>
  </div>
</body></html>`,
    text: `${opts.inviterName} → ${opts.teamName} (${opts.roleName})\n\n${opts.url}\n\n${L.expires}\n${L.ignore}`,
  };
}

/* ================= hesab təhlükəsizliyi xəbərdarlığı (AUDIT-TASK-9 / A-3) ================= */

const ATTACK_LANG = {
  az: {
    subject: 'Collabix — hesabınıza çoxsaylı uğursuz giriş cəhdi',
    hi: 'Salam',
    body: (n: number) => `Son 15 dəqiqədə hesabınıza <b>${n} uğursuz giriş cəhdi</b> qeydə alındı. `
      + 'Hesabınız <b>bloklanmayıb</b> və girişiniz açıqdır — yalnız bot yoxlaması məcburi edildi.',
    you: 'Bu cəhdlər sizə aiddirsə (şifrəni unutmusunuzsa), heç nə etmək lazım deyil.',
    act: 'Sizə aid deyilsə, şifrənizi dəyişin və Parametrlər → Təhlükəsizlik bölməsindən iki mərhələli doğrulamanı aktivləşdirin.',
  },
  en: {
    subject: 'Collabix — repeated failed sign-in attempts',
    hi: 'Hi',
    body: (n: number) => `We recorded <b>${n} failed sign-in attempts</b> on your account in the last 15 minutes. `
      + 'Your account is <b>not locked</b> and you can still sign in — we only made the bot check mandatory.',
    you: 'If this was you (forgotten password), no action is needed.',
    act: 'If this was not you, change your password and enable two-factor authentication under Settings → Security.',
  },
  ru: {
    subject: 'Collabix — повторные неудачные попытки входа',
    hi: 'Привет',
    body: (n: number) => `За последние 15 минут зафиксировано <b>${n} неудачных попыток входа</b> в ваш аккаунт. `
      + 'Аккаунт <b>не заблокирован</b>, вход открыт — обязательной стала только проверка на бота.',
    you: 'Если это были вы (забыли пароль), делать ничего не нужно.',
    act: 'Если это были не вы, смените пароль и включите двухфакторную аутентификацию в разделе Настройки → Безопасность.',
  },
} as const;

/**
 * Hücum xəbərdarlığı — AUDIT-TASK-9 / A-3.
 *
 * ⚠ Mətn QƏSDƏN "hesabınız bloklanmayıb" deyir. Seçilmiş model kilid DEYİL,
 * məcburi CAPTCHA-dır (kilid rəqibə qurbanı bloklamaq imkanı verərdi) —
 * istifadəçi "hesabım bağlandı" deyə paniklə dəstəyə yazmamalıdır.
 */
export function attackAlertMail(name: string, attempts: number, lang: MailLang): Mail {
  const L = ATTACK_LANG[lang];
  return {
    to: '',
    subject: L.subject,
    html: `<!doctype html><html><body style="margin:0;padding:24px;background:#0f1115;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#171a21;border:1px solid #262b36;border-radius:14px;padding:28px;color:#e6e8ee;">
    <div style="font-size:20px;font-weight:700;margin-bottom:18px;color:#fff;">Collabix</div>
    <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">${L.hi}, ${esc(name)}</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 18px;color:#b6bcc9;">${L.body(attempts)}</p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 10px;color:#8b93a3;">${L.you}</p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#e6e8ee;border-top:1px solid #262b36;padding-top:16px;">${L.act}</p>
  </div>
</body></html>`,
    text: `${L.hi}, ${name}\n\n${L.body(attempts).replace(/<\/?b>/g, '')}\n\n${L.you}\n${L.act}`,
  };
}
