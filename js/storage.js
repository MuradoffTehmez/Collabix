// `localStorage` üçün qorunmuş örtük — FRONTEND AUDIT / O-06.
//
// ════════════════════════════════════════════════════════════════════════════
// 🔴 NİYƏ BU MODUL VAR
// ════════════════════════════════════════════════════════════════════════════
//
// `localStorage` HƏMİŞƏ mövcud deyil və mövcud olduqda da HƏMİŞƏ işləmir:
//
//   • Safari-nin gizli rejimində (və Chrome-un "üçüncü tərəf saytlarını blokla"
//     parametrində) ona toxunmaq `SecurityError` ATIR — `undefined` qaytarmır;
//   • kvota dolduqda `setItem` `QuotaExceededError` atır;
//   • bəzi korporativ siyasətlər onu tamamilə söndürür.
//
// Auditin tapdığı vəziyyət: dörd modul (`app.js`, `i18n.js`, `notify.js`,
// `ui.js`) onu `try/catch`-siz işlədirdi. Ən pisi `i18n.js`-dəki idi —
// çağırış MODUL SƏVİYYƏSİNDƏ, idxal anında baş verir:
//
//     let current = localStorage.getItem(KEY) || 'az';
//
// İstisna orada atılsa modul heç vaxt qiymətləndirilmir, onu idxal edən hər şey
// də sınır və tətbiq AĞ EKRANLA açılır. Nə xəta mesajı, nə hissəvi işləmə.
//
// ⚠ MODULUN HEÇ BİR İDXALI YOXDUR VƏ OLMAMALIDIR. `util.js` `i18n.js`-i idxal
//   edir, `i18n.js` isə bunu idxal edəcək — buraya nə isə idxal etsək dövrə
//   yaranar (layihədə `icon-set.js` məhz bu səbəbdən ayrıdır).
//
// ⚠ SƏSSİZ DEQRADASİYA QƏSDƏNDİR: yaddaş işləmirsə tətbiq İŞLƏMƏYƏ DAVAM
//   ETMƏLİDİR, sadəcə seçimlər yadda qalmır. Tema, dil və qaralama saxlamaq
//   rahatlıqdır, tələb deyil — onlara görə sayta girişi kəsmək düzgün mübadilə
//   olmazdı.

/** Dəyər oxuyur; yaddaş əlçatmazdırsa `fallback`. */
export function lsGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

/** Dəyər yazır. `true` = yazıldı, `false` = yaddaş əlçatmazdır. */
export function lsSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

/** Açarı silir. Uğursuzluq əhəmiyyətsizdir — dəyər onsuz da oxunmayacaq. */
export function lsRemove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * JSON oxuyur. İki fərqli uğursuzluq eyni cavabı verir və bu, doğrudur:
 * yaddaş yoxdursa da, dəyər zədəlidirsə də, işlədiləcək şey `fallback`-dir.
 */
export function lsGetJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

/** JSON yazır. Dövrəvi obyekt `stringify`-da sınır — o da tutulur. */
export function lsSetJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}
