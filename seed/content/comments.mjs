// ═══════════════════════════════════════════════════════════════════════════
// Collabix Demo Seed — Şərh və cavab mühərriki
// ═══════════════════════════════════════════════════════════════════════════
//
// Sənəd §13 birbaşa tələb qoyur: **"Random comment yaratma"** — şərh postun
// mövzusuna cavab verməlidir. Ona görə şərh mətni postdan gələn `subject`
// kontekstini (texnologiya, anlayış, problem, alət) təkrar işlədir və janra
// görə seçilir: suala CAVAB gəlir, elana TƏBRİK, problemə DİAQNOZ.
//
// ⚠ Cavablar (`reply`) ayrı hovuzdandır: cavab əvvəlki şərhə istinad edən
//   dildə yazılır ("razıyam", "bir dəqiqləşdirmə"). Eyni hovuzu işlətsəydik
//   thread iki müstəqil monoloq kimi oxunardı.

import { pick, chance, randInt } from '../rand.mjs';

/** Janra görə birinci səviyyə şərhlər: [AZ, EN] */
const BY_KIND = {
  question: [
    ['Biz {tech} tərəfdə bunu {concept} ilə həll etdik. Başlanğıcda mürəkkəb görünür, sonra sadələşir.',
      'We solved this on the {tech} side with {concept}. Looks complex at first, gets simpler.'],
    ['{tool} sınamısan? Bizim halda {problem} məhz oradan gəlirdi.',
      'Have you tried {tool}? In our case {problem} came from exactly there.'],
    ['Cavab layihənin ölçüsündən asılıdır. Kiçik komandada {tech}, böyükdə {tech2} daha rahatdır.',
      'It depends on project size. {tech} for a small team, {tech2} scales better.'],
    ['Sənədlərdəki nümunə yarımçıqdır. Real işdə {concept} hissəsini əlavə etmək lazım gəlir.',
      'The docs example is incomplete. In real usage you also need the {concept} part.'],
    ['Mən əksinə düşünürəm: {concept} burada həddindən artıq mühəndislikdir.',
      'I think the opposite: {concept} is over-engineering here.'],
    ['Eyni sualı bir ay əvvəl verirdim. Nəticə: əvvəl ölç, sonra seç.',
      'I was asking the same a month ago. Conclusion: measure first, then choose.'],
    ['{problem} adətən konfiqurasiya səhvidir, kod səhvi deyil.',
      '{problem} is usually a config mistake, not a code one.'],
  ],
  discussion: [
    ['Razıyam, amma bir şərtlə: komanda {concept} üzərində razılığa gəlməlidir, yoxsa hər kəs öz yolunu tutur.',
      'Agreed, with one condition: the team must align on {concept}, otherwise everyone goes their own way.'],
    ['Bu fikrə qismən qatılıram. {problem} həqiqətən prosesdən gəlir, amma alət seçimi də təsir edir.',
      'Partly agree. {problem} does come from process, but tooling matters too.'],
    ['Bizdə əks təcrübə oldu — {tech} keçidi gözlədiyimizdən asan getdi.',
      'We had the opposite experience — moving to {tech} was easier than expected.'],
    ['Maraqlı yanaşmadır. {tool} ilə birlikdə işlədən varmı?',
      'Interesting take. Anyone using this together with {tool}?'],
    ['Əsas məqam burada gizlidir: {concept} özü problem deyil, onu düşünmədən tətbiq etmək problemdir.',
      'The key point is hidden here: {concept} is not the problem, applying it blindly is.'],
  ],
  tip: [
    ['Faydalı oldu, sağ ol. {tool} hissəsini bilmirdim.',
      'Useful, thanks. I did not know about the {tool} part.'],
    ['Əlavə edim: bunu CI-da avtomatlaşdırmaq olar, əl ilə yoxlama unudulur.',
      'To add: this can be automated in CI, manual checks get forgotten.'],
    ['Sınadım, bizim layihədə fərq az oldu — səbəb {problem} idi.',
      'Tried it, small difference in our project — the reason was {problem}.'],
    ['Bunu komanda kanalında paylaşdım, təşəkkür.',
      'Shared this in the team channel, thanks.'],
  ],
  problem: [
    ['Eyni problemi biz də yaşadıq. Bizdə səbəb {concept} tərəfdə idi.',
      'We hit the same issue. For us the cause was on the {concept} side.'],
    ['Bu tip hallarda {tool} loglarını izləmək ən sürətli yoldur.',
      'For cases like this, following the {tool} logs is the fastest path.'],
    ['Düzgün diaqnozdur. Əlavə: {problem} çox vaxt yük artanda görünür, test mühitində gizli qalır.',
      'Correct diagnosis. To add: {problem} usually appears under load and stays hidden in staging.'],
    ['{number} saat çox deyil — biz buna bir həftə sərf etmişdik.',
      '{number} hours is not much — we spent a week on this.'],
    ['Düzəlişin kiçik olması səbəbin kiçik olması demək deyil. Yaxşı yazı.',
      'A small fix does not mean a small cause. Good write-up.'],
  ],
  tutorial: [
    ['Addım-addım yazdığın üçün təşəkkür. Yeni başlayanlar üçün çox faydalıdır.',
      'Thanks for writing it step by step. Very useful for beginners.'],
    ['Üçüncü addımda kiçik bir incəlik var: {concept} olmadan konfiqurasiya səssizcə sınır.',
      'One subtlety in step three: without {concept} the config fails silently.'],
    ['Bunu {tech} ilə də sınadım, eyni məntiq işləyir.',
      'I tried this with {tech} too, the same logic works.'],
    ['Saxladım. Həftəsonu tətbiq edəcəyəm.',
      'Saved it. Will try this at the weekend.'],
    ['{tool} versiyası fərqlidirsə parametr adları dəyişib, diqqət edin.',
      'If your {tool} version differs the option names changed, watch out.'],
  ],
  opinion: [
    ['Tam razıyam. Ölçmədən optimallaşdırmaq ən bahalı vərdişdir.',
      'Fully agree. Optimising without measuring is the most expensive habit.'],
    ['Razı deyiləm. {tech} bu halda həqiqətən düzgün seçimdir.',
      'I disagree. {tech} really is the right choice here.'],
    ['Bu mövzuda balans lazımdır. Nə tam rədd, nə də tam qəbul.',
      'This needs balance. Neither full rejection nor blind adoption.'],
    ['Praktikada nə qədər tez-tez qarşına çıxıb? Bizdə nadir haldır.',
      'How often did you hit this in practice? It is rare for us.'],
  ],
  showcase: [
    ['Təmiz iş çıxıb. {tech} seçimini niyə etdin?',
      'Clean work. Why did you pick {tech}?'],
    ['Repo linkini paylaşarsan? Baxmaq istərdim.',
      'Could you share the repo link? I would like to look.'],
    ['UI hissəsi xoşuma gəldi. {tool} istifadə etmisən?',
      'I like the UI part. Did you use {tool}?'],
    ['Pet-project-lər ən yaxşı öyrənmə yoludur. Uğurlar!',
      'Side projects are the best way to learn. Good luck!'],
  ],
  announcement: [
    ['Uğurlar! İştirak etmək istərdim.',
      'Congrats! I would like to join.'],
    ['Yaxşı xəbərdir. {tech} tərəfdə dəyişikliklər maraqlıdır.',
      'Good news. The {tech} changes look interesting.'],
    ['Tarix və yer dəqiqləşəndə yazarsınız?',
      'Will you post once the date and place are fixed?'],
    ['Komandaya uğurlar. Bu boşluq çoxdan hiss olunurdu.',
      'Good luck to the team. This gap has been felt for a while.'],
  ],
  retro: [
    ['Dürüst retrospektivlər ən faydalı yazılardır. Təşəkkür.',
      'Honest retrospectives are the most useful posts. Thanks.'],
    ['Bizdə də {problem} planlaşdırmada nəzərə alınmamışdı.',
      'We also missed {problem} during planning.'],
    ['Kiçik addımlarla köçürmək məsləhətinə tam qatılıram.',
      'Fully agree with migrating in small steps.'],
    ['{number} ay real təcrübə üçün yaxşı müddətdir, nəticələr inandırıcıdır.',
      '{number} months is a decent window, the conclusions look credible.'],
  ],
};

/** Cavablar — əvvəlki şərhə istinad edir. */
const REPLIES = [
  ['Doğru qeyddir, əlavə edəcəyim bir şey yoxdur.', 'Fair point, nothing to add.'],
  ['Bunu dəqiqləşdirim: mən {concept} hissəsini nəzərdə tuturdum.', 'To clarify: I meant the {concept} part.'],
  ['Bəs {tool} işlədəndə də eyni nəticəni alırsan?', 'Do you get the same result when using {tool}?'],
  ['Bu variantı sınadıq, bizdə işləmədi. Səbəb {problem} idi.', 'We tried that, did not work for us. The reason was {problem}.'],
  ['Razıyam, amma kiçik layihələrdə bu qədər struktur artıqdır.', 'Agreed, though for small projects this much structure is overkill.'],
  ['Təcrübəni paylaşdığın üçün sağ ol, çox kömək oldu.', 'Thanks for sharing the experience, it helped a lot.'],
  ['Link paylaşa bilərsən?', 'Could you share a link?'],
  ['Sənədlərdə bu hissə düzgün yazılmayıb, məni də çaşdırmışdı.', 'The docs are wrong on this, it confused me too.'],
  ['Yeni versiyada bu davranış dəyişib, yoxlamağa dəyər.', 'This behaviour changed in the new version, worth checking.'],
  ['Məncə əsas fərq ölçüdədir: {number} istifadəçidən sonra mənzərə dəyişir.', 'I think scale is the difference: after {number} users the picture changes.'],
  ['Praktik nümunə üçün təşəkkür, kopyalayıb sınadım.', 'Thanks for the practical example, copied and tried it.'],
  ['Bu yanaşma {tech} tərəfdə də işləyir.', 'This approach also works on the {tech} side.'],
];

/** Qısa reaksiya şərhləri — hər şərh uzun olmamalıdır. */
const SHORT = [
  ['Faydalıdır 👍', 'Useful 👍'],
  ['Saxladım.', 'Saved.'],
  ['Bunu axtarırdım, sağ ol.', 'Exactly what I was looking for, thanks.'],
  ['Maraqlı yanaşmadır.', 'Interesting approach.'],
  ['Razıyam.', 'Agreed.'],
  ['Təcrübə üçün təşəkkür.', 'Thanks for sharing.'],
  ['Bunu komandada müzakirə edəcəyik.', 'We will discuss this in the team.'],
  ['Əla izah 🔥', 'Great explanation 🔥'],
];

function fill(tpl, s) {
  return tpl
    .replace(/\{tech2\}/g, s.tech2)
    .replace(/\{tech\}/g, s.tech)
    .replace(/\{concept\}/g, s.concept)
    .replace(/\{tool\}/g, s.tool)
    .replace(/\{problem\}/g, s.problem)
    .replace(/\{number\}/g, String(s.number));
}

/*
 * ⚠ TƏK ŞABLON KİFAYƏT ETMİR. İlk qaçışda 26 000 şərhə cəmi 4 346 fərqli mətn
 *   düşürdü (hər cümlə ~6 dəfə). Sənəd §35 eyni şərhin təkrarlanmasını
 *   qadağan edir, ona görə mətn ÜÇ hissədən yığılır:
 *       [açılış?] + əsas cümlə + [bağlayış?]
 *   Kombinasiya sayı ~10 × 40 × 16 = 6 400-ə çıxır, slot dəyərləri ilə vurulanda
 *   isə on minlərlə fərqli mətn alınır.
 */
const OPENERS = [
  ['', ''],
  ['', ''],
  ['', ''],
  ['Maraqlıdır — ', 'Interesting — '],
  ['Qısa qeyd: ', 'Quick note: '],
  ['Təcrübəmdən: ', 'From experience: '],
  ['Düzgün sual. ', 'Fair question. '],
  ['Bunu əlavə edim: ', 'Let me add: '],
  ['Praktikada ', 'In practice, '],
  ['Bir neçə il əvvəl biz də eyni yerdə idik. ', 'We were in the same place a few years ago. '],
];

const CLOSERS = [
  ['', ''],
  ['', ''],
  ['', ''],
  ['', ''],
  [' Sənin təcrübən necə oldu?', ' What was your experience?'],
  [' Yanılıramsa düzəlt.', ' Correct me if I am wrong.'],
  [' Bu, bizim halda işlədi.', ' This worked in our case.'],
  [' Ölçmə nəticələrini paylaşa bilərsən?', ' Could you share the measurements?'],
  [' Sənədlərdə bu hissə zəifdir.', ' The docs are weak on this part.'],
  [' Növbəti dəfə fərqli edərdim.', ' I would do it differently next time.'],
  [' Kiçik layihələrdə fərq az olur.', ' The difference is small on small projects.'],
  [' Bunu komandada da müzakirə edəcəyik.', ' We will bring this up in the team too.'],
  [' Nümunə kod varsa maraqlanardım.', ' I would be interested in example code.'],
  [' Təşəkkür.', ' Thanks.'],
  [' 👍', ' 👍'],
  [' Uğurlar!', ' Good luck!'],
];

function compose(pool, subject, i) {
  const core = fill(pick(pool)[i], subject);
  // Qısa reaksiyalara açılış/bağlayış əlavə etmirik — süni uzanardı.
  if (pool === SHORT) return core;
  return (pick(OPENERS)[i] + core + pick(CLOSERS)[i]).trim();
}

/**
 * Posta uyğun şərh mətni.
 * @param {{kind:string, subject:object, lang:string}} post
 */
export function makeComment(post) {
  const az = post.lang === 'az' ? !chance(0.15) : chance(0.25);
  const i = az ? 0 : 1;
  // Şərhlərin ~18%-i qısa reaksiyadır — hamısı esse olsa lent süni görünür.
  const pool = chance(0.18) ? SHORT : (BY_KIND[post.kind] || BY_KIND.discussion);
  return compose(pool, post.subject, i);
}

/** Şərhə cavab mətni. */
export function makeReply(post) {
  const az = post.lang === 'az' ? !chance(0.15) : chance(0.25);
  const i = az ? 0 : 1;
  const pool = chance(0.22) ? SHORT : REPLIES;
  return compose(pool, post.subject, i);
}

/**
 * @mention şərhi — bildiriş axını üçün.
 * ⚠ Format `@username` olmalıdır: `notifyMentions()` mətni məhz bu naxışla
 *   tarayır, başqa yazılış bildiriş yaratmaz.
 */
export function makeMention(post, username) {
  const az = post.lang === 'az';
  const body = az
    ? pick([
      'bu mövzuda təcrübən var, fikrini bilmək istərdim.',
      'sən bunu əvvəl həll etmişdin, necə etdin?',
      'bura bax, sənin layihə ilə əlaqəlidir.',
      'bunu müzakirə etmişdik, əlavə edəcəyin var?',
    ])
    : pick([
      'you have experience here, curious what you think.',
      'you solved this before — how did you do it?',
      'take a look, this relates to your project.',
      'we discussed this before, anything to add?',
    ]);
  return `@${username} ${body}`;
}

/** Komanda çat otağı mesajları — iş kontekstində qısa danışıq. */
const ROOM = [
  'Sabahkı stand-up-a hazır olun, sprint icmalı var.',
  'PR-ı review-a qoydum, baxa bilərsinizmi?',
  'Staging deploy oldu, test edin.',
  'Bu taskı bu sprintə çıxara bilmirik, növbətiyə keçirək.',
  'Dizayn faylı Figma-da yeniləndi.',
  'Testlər CI-da yaşıldır, merge edirəm.',
  'Bu buqu reproduce edə bilmirəm, addımları yaza bilərsən?',
  'API sənədini yenilədim, endpoint adları dəyişib.',
  'Bu həftə demo var, hazırlıq lazımdır.',
  'Migration faylını əlavə etdim, lokalda qaçırın.',
  'Rate limit dəyərini artırdıq, monitorinqə baxaq.',
  'Toplantını 30 dəqiqə gecikdirə bilərikmi?',
  'Log-larda eyni səhv təkrarlanır, araşdırıram.',
  'Yeni komanda üzvünə onboarding sənədini göndərdim.',
  'Bu funksiya üçün feature flag əlavə etdim.',
  'Performans ölçmələri hazırdır, nəticələri paylaşıram.',
  'Backup skriptini avtomatlaşdırdım.',
  'Bu asılılığı yeniləmək lazımdır, təhlükəsizlik xəbərdarlığı var.',
  'Sənədləşdirməni bitirdim, review gözləyirəm.',
  'Sprint retrosunu cümə gününə keçirdik.',
];

export const makeRoomMessage = () => pick(ROOM);

/** Task şərhləri — iş sahəsi konteksti. */
const TASK_COMMENTS = [
  'Bu taskı götürürəm.',
  'Bloklandım — asılı olduğu task hələ bitməyib.',
  'Review üçün hazırdır.',
  'Test halları əlavə edildi.',
  'Deadline-ı bir gün uzatmaq olarmı?',
  'Bu hissəni ikiyə bölmək daha rahat olardı.',
  'Dizayn təsdiqləndi, kodlamağa başlayıram.',
  'Kiçik düzəliş etdim, yenidən baxın.',
  'QA tərəfdən problem görünmür.',
  'Sənədləşdirmə də lazımdır, ayrıca task açdım.',
  'Bunu növbəti sprintə keçirməyi təklif edirəm.',
  'Edge case tapdım, düzəldirəm.',
];

export const makeTaskComment = () => pick(TASK_COMMENTS);

/** Öyrənmə çalışmasına təqdimat mətni. */
const SUBMISSION_TEXT = [
  'Həlli GitHub-da yerləşdirdim, izahı README-dədir.',
  'İki fərqli yanaşma sınadım, ikincisi daha sürətli oldu.',
  'Alqoritmi O(n log n)-ə endirməyi bacardım.',
  'Testləri də yazdım, hamısı keçir.',
  'İlk versiyada səhv var idi, düzəldib yenidən göndərirəm.',
  'Bu çalışma məni çox şey öyrətdi, xüsusən sərhəd hallarını.',
  'Kod çalışır, amma optimallaşdırma üçün məsləhət verə bilərsiniz.',
  'Həlli addım-addım şərhlərlə izah etdim.',
  'Nümunə məlumatla yoxladım, nəticə düzgündür.',
  'Vaxt mürəkkəbliyini də hesabladım.',
];

export const makeSubmission = () => pick(SUBMISSION_TEXT) +
  (chance(0.4) ? ' ' + pick([
    'Rəy gözləyirəm.', 'Suallarınız olsa yazın.', 'Təkmilləşdirmə təklifinə açığam.',
  ]) : '');

/** Şərh sayına görə cavab sayı — thread dərinliyi realistik olsun. */
export function replyCountFor(commentCount) {
  if (commentCount === 0) return 0;
  return randInt(0, Math.min(3, Math.ceil(commentCount / 2)));
}
