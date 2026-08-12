// ═══════════════════════════════════════════════════════════════════════════
// Collabix Demo Seed — Öyrənmə çalışmaları (`tasks` + `submissions`)
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠ BU, KOMANDA TASK-LARI DEYİL. `#drills` ekranı `tasks` cədvəlindən oxuyur;
//   komanda iş sahəsi isə `team_tasks`-dan. İki sistem ayrıdır və qarışdırmaq
//   ən böyük risklərdən biridir (bax workspace.mjs başlığı).
//
// Kateqoriya `js/taxonomy.js` etiketləridir — sərbəst mətn deyil (config.mjs
// LEARNING_CATEGORIES izahına bax).

import { pick, randInt, chance } from '../rand.mjs';

/** Çalışma şablonları: kateqoriya → [başlıq, təsvir] cütləri. */
const DRILLS = {
  'Python': [
    ['Siyahıda təkrarlanan elementləri tap',
      'Verilmiş tam ədəd siyahısında bir dəfədən çox təkrarlanan bütün elementləri qaytaran funksiya yaz. Həll O(n) olmalıdır. Boş siyahı və bütün elementləri unikal olan hal da nəzərə alınmalıdır.'],
    ['CSV faylını emal et',
      'CSV faylını oxuyub sütunlara görə qruplaşdıran və hər qrup üzrə ortalama hesablayan skript yaz. Fayl böyük ola bilər, ona görə hamısını yaddaşa yükləmə.'],
    ['Dekorator ilə keşləmə',
      'Funksiya nəticələrini keşləyən öz dekoratorunu yaz. Keşin ölçü limiti olmalı və ən köhnə element silinməlidir (LRU).'],
    ['Asinxron sorğu hovuzu',
      'Eyni anda ən çox N sorğu göndərən asinxron funksiya yaz. Səhv verən sorğular üçün təkrar cəhd məntiqi əlavə et.'],
  ],
  'JavaScript': [
    ['Debounce funksiyası yaz',
      'İstifadəçi yazmağı dayandırandan N millisaniyə sonra işə düşən `debounce` funksiyası yaz. Ləğv etmə imkanı da olsun.'],
    ['Dərin obyekt müqayisəsi',
      'İki obyekti dərin müqayisə edən funksiya yaz. Massivlər, iç-içə obyektlər, `null` və tarix dəyərləri düzgün işlənməlidir.'],
    ['Event delegasiyası ilə siyahı',
      'Min sətirlik siyahıda hər elementə ayrıca dinləyici qoymadan klik idarəsi qur. Performans fərqini ölç.'],
    ['Promise.all-ın öz variantı',
      'Yerli `Promise.all` davranışını təkrarlayan funksiya yaz: hamısı bitəndə nəticə, birincisi sınanda dərhal rədd.'],
  ],
  'TypeScript': [
    ['Tip təhlükəsiz API cavabı',
      'Server cavabını runtime-da yoxlayan və tipi daraldan funksiya yaz. Yanlış formatda aydın səhv qaytarmalıdır.'],
    ['Generic Result tipi',
      'Uğur və səhv hallarını ayıran `Result<T, E>` tipi və köməkçi funksiyalarını yaz. `try/catch` ilə müqayisəsini izah et.'],
    ['Utility tip yaz',
      'Obyektin yalnız verilmiş açarlarını məcburi edən, qalanını opsional saxlayan utility tip yaz.'],
  ],
  'SQL': [
    ['Yavaş sorğunu optimallaşdır',
      'Verilmiş sorğu tam cədvəl skanı edir. Sorğu planına bax, uyğun indeks təklif et və əvvəl/sonra fərqini ölç.'],
    ['Pəncərə funksiyası ilə sıralama',
      'Hər kateqoriya üzrə ən yüksək üç nəticəni qaytaran sorğu yaz. Bərabər nəticələr üçün davranışı da müəyyənləşdir.'],
    ['Miqrasiya yaz',
      'Mövcud cədvələ yeni sütun əlavə edən və köhnə məlumatı doldurmayan (backfill) miqrasiya yaz. Geri qaytarma addımını da göstər.'],
    ['N+1 problemini həll et',
      'Verilmiş kodda hər sətir üçün ayrıca sorğu gedir. Tək sorğuya çevir və sorğu sayının azaldığını göstər.'],
  ],
  'Go': [
    ['Konkurrent işçi hovuzu',
      'Kanallar üzərindən işləyən işçi hovuzu yaz. Kontekst ləğvi ilə dayandırıla bilməlidir.'],
    ['HTTP middleware zənciri',
      'Log, timeout və recover middleware-lərini zəncirləyən funksiya yaz. Sıranın niyə vacib olduğunu izah et.'],
  ],
  'Java': [
    ['Stream API ilə qruplaşdırma',
      'Obyekt siyahısını sahəyə görə qruplaşdıran və hər qrup üzrə statistika hesablayan Stream sorğusu yaz.'],
    ['Thread-safe keş',
      'Eyni anda bir neçə thread-in istifadə edə biləcəyi keş yaz. Kilid strategiyasını əsaslandır.'],
  ],
  'C#': [
    ['Async/await ilə paralel sorğular',
      'Bir neçə HTTP sorğusunu paralel göndərən və nəticələri birləşdirən metod yaz. Ləğvetmə tokenini dəstəklə.'],
    ['LINQ sorğusunu optimallaşdır',
      'Verilmiş LINQ sorğusu bazada deyil, yaddaşda icra olunur. Səbəbini tap və düzəlt.'],
  ],
  'C++': [
    ['Smart pointer ilə resurs idarəsi',
      'Xam pointer istifadə edən kodu smart pointer-lərə köçür. Sahiblik modelini izah et.'],
    ['Move semantikası',
      'Kopyalama əvəzinə köçürmə istifadə edən sinif yaz və fərqi ölç.'],
  ],
  'Rust': [
    ['Ownership məşqi',
      'Borrow checker səhvi verən kodu düzəlt. Nəyə görə əvvəlki variantın təhlükəsiz olmadığını izah et.'],
    ['Error handling zənciri',
      '`Result` və `?` operatoru ilə səhv idarəsini yenidən yaz, `unwrap` istifadə etmə.'],
  ],
  'HTML/CSS': [
    ['Əlçatan modal pəncərə',
      'Klaviatura ilə tam idarə oluna bilən modal yaz: fokus tələsi, Escape ilə bağlanma, ekran oxuyucu üçün rol atributları.'],
    ['Grid ilə responsiv layout',
      'Media query istifadə etmədən CSS Grid ilə responsiv kart şəbəkəsi qur.'],
    ['Kontrast problemini düzəlt',
      'Verilmiş səhifədə AA standartını keçməyən rəngləri tap və düzəlt. Ölçmə nəticələrini əlavə et.'],
  ],
  'Bash': [
    ['Backup skripti',
      'Qovluğu arxivləyən, tarixlə adlandıran və 7 gündən köhnə arxivləri silən skript yaz. Səhv halında dayanmalıdır.'],
    ['Log analizi',
      'Log faylından ən çox təkrarlanan 10 səhvi çıxaran boru xətti yaz.'],
  ],
  'PHP': [
    ['Təhlükəsiz sorğu qatı',
      'SQL injection-a qapalı, hazırlanmış ifadələrlə işləyən kiçik repozitori sinfi yaz.'],
  ],
  'Kotlin': [
    ['Coroutine ilə paralel yükləmə',
      'Bir neçə şəbəkə sorğusunu paralel icra edən və birini sınsa digərlərini ləğv edən funksiya yaz.'],
  ],
  'Swift': [
    ['Protokol yönümlü dizayn',
      'Sinif iyerarxiyası əvəzinə protokol və extension ilə eyni davranışı qur.'],
  ],
  'Arduino/C': [
    ['Sensor oxuma dövrəsi',
      'Sensor dəyərini müəyyən intervalla oxuyan və orta hesablayan proqram yaz. Bloklayan gecikmə istifadə etmə.'],
  ],
};

/** Kateqoriyası olmayanlar üçün ehtiyat şablonlar. */
const GENERIC = [
  ['Kod review məşqi', 'Verilmiş kod parçasını nəzərdən keçir və ən azı üç konkret təkmilləşdirmə təklif et. Hər təklifin səbəbini yaz.'],
  ['Test əhatəsini artır', 'Mövcud funksiya üçün sərhəd hallarını əhatə edən testlər yaz. Ən azı bir mövcud qüsuru üzə çıxarmalıdır.'],
  ['Sənədləşdirmə yaz', 'Kiçik modul üçün istifadə nümunəsi, parametr izahı və məhdudiyyətləri özündə saxlayan sənəd yaz.'],
];

/** Bir öyrənmə çalışması qaytarır. */
export function makeDrill(category) {
  const pool = DRILLS[category] || GENERIC;
  const [title, descr] = pick(pool);
  const suffix = chance(0.35)
    ? '\n\nƏlavə tələb: ' + pick([
      'həllin vaxt mürəkkəbliyini yaz.',
      'ən azı iki test halı əlavə et.',
      'alternativ yanaşmanı da qısa müqayisə et.',
      'kodun oxunaqlığına diqqət et, dəyişən adları mənalı olsun.',
      'sərhəd hallarını ayrıca sadalayaraq izah et.',
    ])
    : '';
  return { title, descr: descr + suffix, category };
}

/** Çalışma başlığına unikal variant əlavəsi — eyni şablon təkrarlansa fərqlənsin. */
export function drillVariant(title, n) {
  if (n <= 1) return title;
  return `${title} (variant ${n})`;
}

export { DRILLS };
