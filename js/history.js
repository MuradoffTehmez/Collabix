// "Daha köhnə mesajlar" — AUDIT-TASK-8 §8.4 (C-3 zəncirinin UI hissəsi).
//
// ⚠ NİYƏ AYRICA MODUL: otaq söhbəti (`chat.js`) və DM (`dm.js`) eyni davranışa
// ehtiyac duyur — scroll kilidi, təkrar sorğunun qarşısı, 429 emalı, bitmə
// vəziyyəti. İki nüsxə yazsaydıq qaydalar vaxtla ayrılar və biri digərindən
// zəif qalardı (məhz `sanitizeMsg`-də baş verən problem — bax worker/msg.ts).
//
// ⚠ SERVER MODELİ: `GET /api/rooms/:id/messages?before=<ts>` D1 bitəndə arxivə
// keçir və `{ messages, hasMore }` qaytarır. Arxiv oxusu D1-dən YAVAŞDIR
// (R2 sorğusu + gzip açılması), ona görə göstərici məcburidir — əks halda
// istifadəçi tətbiqin donduğunu zənn edir.
import { el } from './util.js';
import { t } from './i18n.js';

/** Bir söhbət üçün tarixçə vəziyyəti. Otaq/DM dəyişəndə YENİSİ yaradılır. */
export function createHistory() {
  return {
    /** Arxivdən/D1-dən əlavə çəkilmiş KÖHNƏ mesajlar (ən köhnədən yeniyə). */
    older: [],
    /** Server "daha köhnəsi var" deyirmi? İlk yükləməyə qədər naməlum → true. */
    hasMore: true,
    /** Sorğu gedir — ikinci sorğunun qarşısını alır. */
    loading: false,
    /** Son xəta (429 və ya digər) — düymənin altında göstərilir. */
    error: '',
    /** Poll-un qaytardığı canlı mesajların ən köhnəsi (kursor mənbəyi). */
    liveOldestTs: null,
  };
}

/**
 * Scroll mövqeyini qoruyaraq yenidən render edir.
 *
 * ⚠ KLASSİK TƏLƏ: yuxarıya mesaj əlavə edəndə `scrollHeight` böyüyür və
 * brauzer `scrollTop`-u olduğu kimi saxladığı üçün istifadəçi BİRDƏN yuxarı
 * "sıçrayır" — oxuduğu yeri itirir. Fərqi ölçüb `scrollTop`-a əlavə etmək lazımdır.
 *
 * ⚠ SIRA VACİBDİR: ölçü `rerender()`-DƏN SONRA götürülməlidir, çünki DOM məhz
 * orada qurulur. Vəziyyəti dəyişib ölçsək `scrollHeight` hələ köhnə olardı və
 * düzəliş heç nə etməzdi.
 */
export function rerenderWithScrollLock(box, rerender) {
  const beforeH = box.scrollHeight;
  const beforeTop = box.scrollTop;
  rerender();
  box.scrollTop = beforeTop + (box.scrollHeight - beforeH);
}

/**
 * Mesaj qutusunun başına qoyulan zolaq: düymə / spinner / "başlanğıc" / xəta.
 *
 * `onLoad` yalnız düymə klikində çağırılır — AVTOMATİK təkrar cəhd YOXDUR.
 * (Task 4 §7/1 dərsi: 429-dan sonra avtomatik təkrar sayğacı yenidən doldurur
 * və istifadəçi limitdən heç vaxt çıxa bilmir.)
 */
export function historyBar(hist, onLoad) {
  if (hist.loading) {
    return el('div', { class: 'hist-bar loading' }, t('hist.loading'));
  }
  if (hist.error) {
    return el('div', { class: 'hist-bar err' },
      el('span', {}, hist.error),
      // Təkrar cəhd YALNIZ istifadəçinin açıq hərəkəti ilə.
      el('button', { type: 'button', class: 'hist-btn', onclick: onLoad }, t('hist.load_older')),
    );
  }
  if (!hist.hasMore) {
    return el('div', { class: 'hist-bar done' }, t('hist.start'));
  }
  return el('div', { class: 'hist-bar' },
    el('button', { type: 'button', class: 'hist-btn', onclick: onLoad }, t('hist.load_older')));
}

/**
 * Bir səhifə köhnə mesaj çəkir və `hist.older`-in BAŞINA qoyur.
 *
 * `fetchPage(beforeTs)` → `{ messages, hasMore }` qaytarmalıdır.
 * `rerender()` qutunu yenidən qurur (çağıran tərəfin öz render funksiyası).
 */
export async function loadOlder(hist, box, fetchPage, rerender) {
  if (hist.loading || !hist.hasMore) return;

  // ⚠ ÖLÇÜ ƏN BAŞDA GÖTÜRÜLÜR. `rerender()` qutunu tamamilə yenidən qurur
  // (`clear()` + append), brauzer isə uşaqları silinən elementin `scrollTop`-unu
  // SIFIRLAYIR. Yəni hər render-dən sonra mövqe bərpa edilməlidir — həm spinner
  // göstərilərkən, həm də mesajlar əlavə olunandan sonra. Yalnız sonuncusunu
  // etsək, yükləmə boyu istifadəçi siyahının başına atılmış görünərdi.
  const startH = box.scrollHeight;
  const startTop = box.scrollTop;
  const keepPlace = () => { box.scrollTop = startTop + (box.scrollHeight - startH); };

  hist.loading = true;
  hist.error = '';
  rerender();
  keepPlace();

  // Kursor: hazırda göstərilən ƏN KÖHNƏ mesajın vaxtı. Əvvəlcə əlavə çəkilmiş
  // `older` massivinə, o boşdursa canlı poll-un ən köhnəsinə baxılır.
  const cursor = hist.older.length
    ? Number(hist.older[0].createdAt)
    : hist.liveOldestTs;

  let ok = false;
  try {
    const d = await fetchPage(cursor);
    const fresh = Array.isArray(d?.messages) ? d.messages : [];
    // ⚠ DEDUPE: server də dedupe edir, lakin sərhəddə eyni mesaj həm canlı
    // siyahıda, həm bu səhifədə görünə bilər (poll arada yenilənib).
    const known = new Set(hist.older.map(m => m.id));
    const add = fresh.filter(m => !known.has(m.id));
    hist.older = [...add, ...hist.older];
    hist.hasMore = !!d?.hasMore;
    // Server `hasMore: true` desə də heç nə gəlmirsə dövrəyə düşmə.
    if (!add.length) hist.hasMore = false;
    ok = true;
  } catch (e) {
    // 429 → AVTOMATİK TƏKRAR YOXDUR, sadəcə aydın mesaj.
    hist.error = e && e.status === 429 ? t('hist.rate_limit') : t('hist.error');
  }
  hist.loading = false;
  rerender();
  // Uğurlu yükləmədə qutunun BAŞINA mesaj gəlir; xətada isə yalnız zolaq
  // dəyişir. Hər iki halda mövqe eyni baza ilə bərpa olunur.
  keepPlace();
  void ok;
}
