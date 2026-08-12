// ═══════════════════════════════════════════════════════════════════════════
// Collabix Demo Seed — Birbaşa mesaj (DM) mühərriki
// ═══════════════════════════════════════════════════════════════════════════
//
// Sənəd §20 açıq şəkildə qadağan edir: "Random `hello` tipli yüzlərlə mesaj
// yaratma." Ona görə söhbətlər HAZIR SSENARİLƏRDƏN qurulur: hər ssenari
// növbələşən replikalar dəstidir və iştirakçıların rolundan asılıdır
// (sənəd §15: Developer↔Developer, Designer↔Developer, PM↔Komanda üzvü,
// Öyrənən↔Mentor).
//
// ⚠ REPLİKA SIRASI MƏNALIDIR: `dm_messages` sırası `created_at`-a görə
//   göstərilir və mesajlar növbələşir (A, B, A, B…). Ssenari replikaları
//   məhz bu sırada yazılıb; qarışdırsaq söhbət cavabsız suallar zəncirinə
//   çevrilər.

import { pick, pickN, randInt, chance } from '../rand.mjs';

/** Rol cütünə görə ssenarilər. Hər ssenari növbələşən replika massividir. */
const SCENARIOS = {
  dev_dev: [
    [
      'Salam, API endpoint-in validation hissəsinə baxdım. DTO tərəfdə əlavə constraint lazımdır.',
      'Salam. Hansı sahədə? Mən yalnız required yoxlaması qoymuşdum.',
      'Email və username sahələrində. Uzunluq limiti yoxdur, 500 simvol göndərmək olur.',
      'Doğrudur, gözdən qaçıb. Bu gün əlavə edim, PR açaram.',
      'Test də yaz, sərhəd halları üçün. Mən review edərəm.',
      'Razıyam. Sabaha hazır olar.',
    ],
    [
      'Bu migration faylını lokalda qaçırdın?',
      'Hə, problemsiz keçdi. Amma indeks yaratma hissəsi bir az uzun çəkdi.',
      'Neçə saniyə?',
      'Təxminən 12 saniyə. İstehsalda daha uzun olacaq, cədvəl böyükdür.',
      'Onda deploy-dan əvvəl xəbərdarlıq yazaq. Downtime gözləmirik, amma yavaşlama ola bilər.',
      'Razıyam, release qeydlərinə əlavə edirəm.',
    ],
    [
      'Feed sorğusunda N+1 problemi var deyəsən.',
      'Nə görürsən?',
      'Hər post üçün ayrıca müəllif sorğusu gedir. 20 postda 21 sorğu.',
      'JOIN ilə birləşdirmək olar. Sınayım.',
      'Sınayanda EXPLAIN nəticəsini də paylaş, müqayisə edək.',
      'Oldu. Ölçdükdən sonra yazacam.',
      'Nəticə: 21 sorğu → 1. Cavab vaxtı 340ms-dən 90ms-ə düşdü.',
      'Əla. Merge edək.',
    ],
    [
      'Hey, do you have a minute to look at a race condition?',
      'Sure, what is happening?',
      'Two requests update the same row and the second one overwrites the first.',
      'Sounds like a missing transaction or optimistic locking. Do you have a version column?',
      'No, we do not. I could add updated_at and compare it.',
      'That works. Just make sure the comparison happens inside the same statement.',
      'Good point, otherwise the check itself races. Thanks.',
    ],
    [
      'Rate limit dəyərini nə qədər qoyaq?',
      'Ölçmə var? Mövcud trafikə baxmaq lazımdır.',
      'Ən aktiv istifadəçi saatda ~120 sorğu göndərir.',
      'Onda 300/saat qoyaq, iki qat pay ilə. Sonra ölçüb dəqiqləşdirərik.',
      'Razıyam. Limitə çatanda 429 qaytaraq, sükutla kəsməyək.',
      'Mütləq. Retry-After başlığını da əlavə et.',
    ],
  ],
  design_dev: [
    [
      'Yeni komponent variantlarını Figma-da yenilədim, baxa bilərsən?',
      'Baxdım. Boşluqlar 4px şkalasına oturmayıb, bəziləri 6px.',
      'Düzəldim. Bir də düymə hündürlüyünü 36-dan 40-a qaldırdım, toxunuş sahəsi kiçik idi.',
      'Yaxşı oldu. Mobil üçün minimum 44px tövsiyə olunur, ona da baxaq.',
      'Onda ayrıca mobil variant yaradım.',
      'Bəli, belə daha rahat olar. Token adlarını da eyni saxla.',
    ],
    [
      'Tünd temada ikon rəngi düzgün görünmür.',
      'Hansı ikon?',
      'Düymə içindəki bütün ikonlar. Açıq temada normaldır.',
      'Deməli rəng miras qalmır, düymə default qara alır. Açıq `color` verməliyəm.',
      'Bəli, elə görünür. Token istifadə et, sabit hex yox.',
      'Düzəldirəm, bu gün deploy olar.',
    ],
    [
      'Bu ekranda mətn kontrastı kifayət etmir, yoxlamısan?',
      'Yoxlamamışam. Nə qədər çıxdı?',
      '3.1:1. AA üçün minimum 4.5:1 lazımdır.',
      'Onda muted rəngi bir pillə tündləşdirməliyik.',
      'Tokeni dəyişsək bütün səhifələrə təsir edər, ona görə diqqətli olaq.',
      'Razıyam. Əvvəl bir səhifədə sınayaq.',
    ],
    [
      'The empty state illustration is ready.',
      'Nice. What size should I export it at?',
      'SVG please, it scales better and the file is tiny.',
      'Works for me. Does it need a dark variant?',
      'It uses currentColor, so it adapts automatically.',
      'Even better. I will drop it in today.',
    ],
  ],
  pm_member: [
    [
      'Sprint planlaması üçün taskları qiymətləndirə bilərsənmi?',
      'Bəli. Neçəsi var?',
      '14 task. Ən vacibləri ilk beşdir.',
      'Baxdım. İlk üçü təxminən 2 gün, dördüncü daha böyükdür — 3-4 gün.',
      'Dördüncünü bölmək olarmı?',
      'Olar. Backend və frontend hissələrini ayırsaq daha rahat izlənər.',
      'Onda belə edək. Mən taskları yenidən yazıram.',
    ],
    [
      'Bu həftə demo var, hansı funksiyalar hazırdır?',
      'Autentifikasiya və profil bölməsi tam hazırdır. Bildirişlər 80%.',
      'Bildirişləri demo-ya salsaq risk var?',
      'Əsas axın işləyir, amma real vaxt hissəsi hələ stabil deyil.',
      'Onda demo-da statik siyahını göstərək, real vaxtı növbəti dəfəyə saxlayaq.',
      'Məncə də düzgün qərardır.',
    ],
    [
      'Deadline-a çata bilirikmi?',
      'Dürüst desəm, riskli görünür. İki task gözlənildiyindən böyük çıxdı.',
      'Hansılar?',
      'Fayl yükləmə və axtarış. Hər ikisində gözlənilməz hallar çıxdı.',
      'Anladım. Prioritetə görə birini növbəti sprintə keçirək.',
      'Axtarışı keçirsək daha az təsir edər.',
      'Razıyam, elə edirik. Komandaya mən yazaram.',
    ],
    [
      'Could you write a short update for the stakeholders?',
      'Sure. How detailed should it be?',
      'Three or four bullets, no technical jargon.',
      'Understood. I will focus on what shipped and what is next.',
      'Perfect, send it before Friday.',
    ],
  ],
  mentor_learner: [
    [
      'Salam! Alqoritm çalışmasında ilişdim, kömək edə bilərsiniz?',
      'Salam. Hansı hissədə?',
      'Rekursiv həll yazdım, amma böyük giriş üçün stack overflow verir.',
      'Onda ya iterativ yazmalısan, ya da memoizasiya əlavə etməlisən. Girişin ölçüsü nə qədərdir?',
      'Təxminən 100 min element.',
      'O həcmdə rekursiya risklidir. İterativ variant daha təhlükəsizdir.',
      'Anladım, sınayacam. Çox sağ olun!',
      'Uğurlar. Nəticəni yaz, birlikdə baxarıq.',
    ],
    [
      'Junior olaraq hansı mövzuya fokuslanmalıyam?',
      'Bir dili yaxşı öyrən, sonra genişlən. Hansı dildə yazırsan?',
      'JavaScript, amma Python da bir az bilirəm.',
      'Onda JavaScript-də dərinləş. Async, closure, prototip zənciri — bunları tam anla.',
      'Layihə yazmaq lazımdırmı?',
      'Mütləq. Kiçik, amma bitmiş layihə yarımçıq böyük layihədən qiymətlidir.',
      'Təşəkkür edirəm, çox faydalı oldu.',
    ],
    [
      'Kod review-da çoxlu qeyd aldım, ruhdan düşdüm biraz.',
      'Bu normaldır və yaxşı əlamətdir — deməli kodunu ciddiyə alırlar.',
      'Elə baxmamışdım.',
      'Qeydləri iki qrupa böl: üslub və məntiq. Məntiq qeydlərindən öyrənirsən, üslub qeydlərini isə linter həll edir.',
      'Bunu tətbiq edəcəm. Sağ olun!',
    ],
    [
      'I finished the exercise but my solution feels slow.',
      'What is the complexity you ended up with?',
      'I think O(n squared) because of the nested loop.',
      'Right. Try a hash map for the inner lookup — that usually brings it to O(n).',
      'That makes sense, I will rewrite it.',
      'Good. Measure both versions so you see the difference yourself.',
    ],
  ],
  peer: [
    [
      'Bugünkü meetup-a gedirsən?',
      'Planlaşdırıram. Mövzu maraqlıdır.',
      'Mən də gəlirəm. Sonra qeydləri müqayisə edərik.',
      'Yaxşı fikirdir. Görüşərik.',
    ],
    [
      'Bu vakansiyaya baxmısan?',
      'Yox, link atarsan?',
      'Şərhlərdə paylaşmışdım. Tələblər sənin profilə uyğundur.',
      'Baxaram, təşəkkür. CV-mi yeniləmək lazımdır onsuz da.',
      'Kömək lazım olsa yaz, baxaram.',
    ],
    [
      'Postunu oxudum, çox faydalı idi.',
      'Sağ ol! Uzun müddət yazmaq istəyirdim.',
      'Davamı olacaq?',
      'Bəli, ikinci hissəni bu həftə yazıram.',
      'Gözləyirəm.',
    ],
    [
      'Are you joining the open source sprint this weekend?',
      'Probably yes. Which repo are you working on?',
      'The docs one, it needs a lot of small fixes.',
      'Good first issues then. Count me in.',
    ],
  ],
};

/** Profil cütündən ssenari qrupu seçir. */
export function scenarioKeyFor(aProfile, bProfile) {
  const designers = new Set(['DESIGNER']);
  const managers = new Set(['PROJECT_MANAGER']);
  const learners = new Set(['LEARNER']);
  const seniors = new Set(['POWER_USER', 'ACTIVE_CONTRIBUTOR']);

  if (designers.has(aProfile) !== designers.has(bProfile)) return 'design_dev';
  if (managers.has(aProfile) !== managers.has(bProfile)) return 'pm_member';
  if ((learners.has(aProfile) && seniors.has(bProfile))
    || (learners.has(bProfile) && seniors.has(aProfile))) return 'mentor_learner';
  if (seniors.has(aProfile) && seniors.has(bProfile)) return 'dev_dev';
  return 'peer';
}

/**
 * Söhbət replikaları. `minLen` verilərsə ssenari təkrar davam etdirilir
 * (uzun söhbətlər üçün) — real söhbətlər eyni uzunluqda olmur.
 */
export function makeConversation(key, minLen = 0) {
  const pool = SCENARIOS[key] || SCENARIOS.peer;
  let msgs = [...pick(pool)];
  while (msgs.length < minLen) {
    const extra = pick(pool);
    // ⚠ Növbələşmə qorunmalıdır: əlavə ssenari CÜT sayda replikadan sonra
    //   başlamalıdır, əks halda eyni nəfər ardıcıl iki dəfə yazmış görünər.
    if (msgs.length % 2 === 1) msgs.push(pick(FOLLOW_UPS));
    msgs = msgs.concat(extra);
  }
  return msgs;
}

/** Söhbəti bağlayan/körpüləyən qısa replikalar. */
const FOLLOW_UPS = [
  'Yaxşı, razıyam.',
  'Anladım, təşəkkür.',
  'Bunu qeyd edim.',
  'Sabah davam edək.',
  'Oldu.',
  'Sağ ol, çox kömək oldu.',
  'Sounds good.',
  'Thanks, that helps.',
];

/** Söhbətin uzunluğu — çox söhbət qısadır, azı uzun. */
export function conversationLength() {
  const r = randInt(1, 100);
  if (r <= 45) return randInt(2, 5);      // qısa
  if (r <= 80) return randInt(6, 10);     // orta
  if (r <= 95) return randInt(11, 18);    // uzun
  return randInt(19, 30);                 // çox uzun
}
