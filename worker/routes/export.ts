// GDPR data ixracı — AUDIT-TASK-10 / Faza 3.1.
//
// ⚠ Ayrıca modul: ixrac İSTİFADƏÇİNİN BÜTÜN domenlərinə toxunur (profil,
//   post, şərh, mesaj, komanda, arxiv). Onu hər hansı domenin içinə qoysaq
//   həmin modul qalan hamısından asılı olardı.
import { Ctx } from '../util';
import { exportArchivedMessages } from '../archive';
import { csvRow } from './shared';

/* ================= GDPR — DATA İXRACI (Bənd 10) ================= */

// CSV formatlaması üçün yuxarıdakı `csvCell` / `csvRow` TƏKRAR-İSTİFADƏ olunur
// (TASK-6 admin ixracı ilə eyni funksiyalar). Orada formula-injection qoruması
// artıq var: `=`, `+`, `-`, `@` ilə başlayan xana apostrofla neytrallaşdırılır,
// yəni Excel onu düstur kimi İCRA ETMİR.
//
// İkinci nüsxə yazsaydıq qaydalar vaxtla ayrılar və bir ixrac qorunub, o biri
// qorunmamış qalardı — məhz belə fərqlər real təhlükəsizlik boşluqları yaradır.

// İstifadəçinin BÜTÜN datasını toplayan sorğular. Hər biri ayrıca "bölmə"dir —
// stream-də bir-bir yazılır ki, yaddaşda tam nüsxə yığılmasın.
const EXPORT_SECTIONS: Array<{ name: string; sql: string; binds: (uid: string) => unknown[] }> = [
  { name: 'profile', sql: 'SELECT * FROM users WHERE id = ?', binds: u => [u] },
  { name: 'posts', sql: 'SELECT * FROM posts WHERE author_id = ? ORDER BY created_at', binds: u => [u] },
  { name: 'comments', sql: 'SELECT * FROM comments WHERE author_id = ? ORDER BY created_at', binds: u => [u] },
  { name: 'likes', sql: 'SELECT * FROM likes WHERE user_id = ?', binds: u => [u] },
  { name: 'bookmarks', sql: 'SELECT * FROM bookmarks WHERE user_id = ?', binds: u => [u] },
  { name: 'follows', sql: 'SELECT * FROM follows WHERE follower_id = ? OR target_id = ?', binds: u => [u, u] },
  { name: 'room_messages', sql: 'SELECT * FROM room_messages WHERE author_id = ? ORDER BY created_at', binds: u => [u] },
  { name: 'direct_messages', sql: 'SELECT * FROM dm_messages WHERE from_id = ? OR to_id = ? ORDER BY created_at', binds: u => [u, u] },
  { name: 'tasks_created', sql: 'SELECT * FROM tasks WHERE created_by = ?', binds: u => [u] },
  { name: 'submissions', sql: 'SELECT * FROM submissions WHERE user_id = ?', binds: u => [u] },
  { name: 'notifications', sql: 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at', binds: u => [u] },
  { name: 'activity', sql: 'SELECT date, count FROM user_activity WHERE uid = ? ORDER BY date', binds: u => [u] },
  { name: 'sessions', sql: 'SELECT id, ua, ip, city, country, created_at, last_seen, revoked FROM sessions WHERE uid = ?', binds: u => [u] },
  { name: 'oauth_accounts', sql: 'SELECT provider, login, email, linked_at FROM oauth_accounts WHERE uid = ?', binds: u => [u] },
  { name: 'reports_filed', sql: 'SELECT * FROM reports WHERE reporter_id = ?', binds: u => [u] },

  // ── AUDIT-TASK-8 §8.5 — hüquqi risk #13: ixrac natamam idi ──
  //
  // ⚠ HƏR SORĞU YALNIZ İSTİFADƏÇİNİN ÖZ SƏTİRLƏRİNİ QAYTARIR. Komanda
  // cədvəlləri başqa üzvlərin datasını da daşıyır (`team_posts` bütün
  // komandanın feed-idir) — filtrsiz ixrac GDPR sənədini data sızmasına
  // çevirərdi: istifadəçi öz faylında başqalarının yazılarını alardı.
  //
  // `contact_messages`-də `uid` sütunu YOXDUR (yalnız `email`), ona görə
  // uyğunluq istifadəçinin qeydiyyat VƏ əlaqə e-poçtu üzrə qurulur.
  // Alt-sorğu işlədilir ki, bölmə imzası (`binds: uid`) dəyişməsin.
  {
    name: 'contact_messages',
    sql: `SELECT * FROM contact_messages
           WHERE lower(email) IN (SELECT lower(email) FROM users WHERE id = ?1)
              OR lower(email) IN (SELECT lower(contact_email) FROM users WHERE id = ?1)
           ORDER BY created_at`,
    binds: u => [u],
  },
  {
    name: 'team_memberships',
    sql: `SELECT m.id, m.team_id, t.name AS team_name, m.role_id, r.name AS role_name,
                 m.status, m.joined_at
            FROM team_members m
            LEFT JOIN teams t ON t.id = m.team_id
            LEFT JOIN team_roles r ON r.id = m.role_id
           WHERE m.user_id = ? ORDER BY m.joined_at`,
    binds: u => [u],
  },
  {
    // Yalnız İSTİFADƏÇİYƏ TƏYİN EDİLMİŞ tapşırıqlar — `team_tasks`-də
    // `created_by` sütunu yoxdur, müəlliflik saxlanılmır.
    name: 'team_tasks_assigned',
    sql: `SELECT * FROM team_tasks WHERE assignee_id = ? ORDER BY created_at`,
    binds: u => [u],
  },
  {
    name: 'team_posts',
    sql: 'SELECT * FROM team_posts WHERE author_id = ? ORDER BY created_at',
    binds: u => [u],
  },
  {
    // Fayl METADATASI — məzmun DEYİL. Fayl baytları R2-dədir və ixraca
    // qoyulsaydı fayl həcmi ixracı praktiki olaraq yararsız edərdi.
    name: 'team_files',
    sql: 'SELECT * FROM team_files WHERE uploaded_by = ? ORDER BY created_at',
    binds: u => [u],
  },
];

// Parol heşi və TOTP sirri ixracdan ÇIXARILIR: onlar istifadəçinin "şəxsi
// datası" deyil, autentifikasiya sirridir. İxrac faylı email ilə paylaşıla,
// buludda saxlanıla bilər — sirri ora qoymaq hesabı riskə atmaqdır.
const EXPORT_OMIT = new Set(['pass_hash', 'pass_salt', 'totp_secret', 'refresh_hash', 'prev_refresh_hash']);
const scrub = (row: any) => {
  const out: any = {};
  for (const [k, v] of Object.entries(row)) if (!EXPORT_OMIT.has(k)) out[k] = v;
  return out;
};

// Tam data ixracı — STREAM ilə.
//
// Nə üçün stream: aktiv istifadəçinin mesaj+bildiriş tarixçəsi meqabaytlarla
// ola bilər. Hamısını sətirdə yığıb sonda qaytarsaq Worker-in yaddaş limitinə
// dəyərdi. Burada hər bölmə hazır olan kimi ötürülür.
export async function exportMyData(c: Ctx) {
  const uid = c.user!.id;
  const format = c.url.searchParams.get('format') === 'csv' ? 'csv' : 'json';
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `collabix-data-${c.user!.username}-${stamp}.${format}`;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const write = (s: string) => writer.write(encoder.encode(s));

  // Yazma fon işidir: cavab başlıqları DƏRHAL qaytarılır, gövdə axır.
  // `waitUntil` işlədilmir — cavab gövdəsi hələ oxunur, Worker onsuz da diridir.
  (async () => {
    try {
      if (format === 'csv') {
        // CSV-də bir neçə cədvəl var → hər bölmə öz başlığı ilə ardıcıl yazılır.
        // Excel UTF-8-i tanısın deyə BOM əlavə olunur (Azərbaycan hərfləri!).
        await write('﻿');
        for (const sec of EXPORT_SECTIONS) {
          const rows = await c.env.DB.prepare(sec.sql).bind(...sec.binds(uid)).all<any>();
          await write(`\r\n### ${sec.name}\r\n`);
          if (!rows.results.length) { await write('(boş)\r\n'); continue; }
          const cols = Object.keys(scrub(rows.results[0]));
          await write(csvRow(cols));
          for (const r of rows.results) {
            const clean = scrub(r);
            await write(csvRow(cols.map(k => clean[k])));
          }
        }
        // AUDIT-TASK-8 §8.5 — arxivlənmiş mesajlar (mənbə: R2, D1 deyil).
        // ⚠ `csvRow` EYNİ funksiyadır → formula-injection qoruması bu bölməyə
        // də tətbiq olunur (ikinci nüsxə yazsaydıq qoruma burada olmazdı).
        const arch = await exportArchivedMessages(c.env, uid);
        await write(`\r\n### archived_messages\r\n`);
        if (arch.truncated) {
          await write(csvRow(['QEYD', 'Arxivin bir hissəsi açıla bilmədi və ya limit aşıldı — ixrac NATAMAMDIR']));
        }
        if (!arch.messages.length) { await write('(boş)\r\n'); }
        else {
          const acols = Object.keys(scrub(arch.messages[0]));
          await write(csvRow(acols));
          for (const m of arch.messages) {
            const clean = scrub(m);
            await write(csvRow(acols.map(k => clean[k])));
          }
        }
      } else {
        await write(`{\n  "exportedAt": ${JSON.stringify(new Date().toISOString())},\n`);
        await write(`  "username": ${JSON.stringify(c.user!.username)},\n`);
        for (const sec of EXPORT_SECTIONS) {
          const rows = await c.env.DB.prepare(sec.sql).bind(...sec.binds(uid)).all<any>();
          const data = rows.results.map(scrub);
          // Arxiv bölməsi sonuncudur → hər D1 bölməsindən sonra vergül qoyulur.
          await write(`  ${JSON.stringify(sec.name)}: ${JSON.stringify(data)},\n`);
        }
        // AUDIT-TASK-8 §8.5 — arxivlənmiş mesajlar (mənbə: R2).
        const arch = await exportArchivedMessages(c.env, uid);
        await write(`  "archived_messages": ${JSON.stringify(arch.messages.map(scrub))},\n`);
        // ⚠ Natamamlıq SÜKUTLA keçilmir: GDPR ixracında "bu qədərdir" ilə
        // "bu qədərini verə bildik" fərqi hüquqi əhəmiyyət daşıyır.
        await write(`  "archived_messages_meta": ${JSON.stringify({
          truncated: arch.truncated, objectsScanned: arch.objectsScanned,
        })}\n`);
        await write('}\n');
      }
    } catch (e: any) {
      console.error('export', e?.message || e);
      // Başlıqlar artıq göndərilib — status kodu dəyişdirmək mümkün deyil.
      // Ona görə xəta faylın İÇİNƏ yazılır: istifadəçi natamam faylı sükutla
      // "tam" sanmasın.
      await write(`\n/* İXRAC YARIMÇIQ QALDI: ${String(e?.message || e)} */\n`);
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',   // şəxsi data keşlənməməlidir
    },
  });
}

