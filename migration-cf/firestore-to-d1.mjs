#!/usr/bin/env node
// PROD Firestore (köhnə KV model, collabix-37e67) → D1 import.sql generatoru.
//
//   node firestore-to-d1.mjs             → DRY-RUN: hesabat (heç nə yazmır)
//   node firestore-to-d1.mjs --execute   → migration-cf/import.sql yaradır
//
// Sonra tətbiq: npm run db:import:local   (lokal)  /  npm run db:import:remote (prod)
//
// Parollar: köhnə plaintext parollar Worker ilə EYNİ PBKDF2 (SHA-256, 100k iter)
// parametrləri ilə heşlənir — istifadəçilər köhnə parolları ilə daxil olur.
// ⚠ Bu parollar vaxtilə açıq saxlandığından ifşa olunmuş sayılır: real istifadəyə
//   keçəndə istifadəçilərə parol dəyişməyi tövsiyə edin (Parametrlər bölməsi var).
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const PROD = 'collabix-37e67';
const KEY = 'AIzaSyAaVLSHvxlSt0ElGQB-MYERGsqi4JLMu28';
const EXECUTE = process.argv.includes('--execute');

const norm = r => (r || '').trim().toLowerCase().normalize('NFKC').replace(/[^a-z0-9._]/g, '');
const uid = () => randomUUID().replace(/-/g, '');
const q = v => v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''").replace(/\r/g, '').replace(/\n/g, "'||char(10)||'")}'`;
const jq = v => q(JSON.stringify(v ?? null));

function hashPassword(pass){
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(pass, salt, 100_000, 32, 'sha256');
  return { hash: hash.toString('hex'), salt: salt.toString('hex') };
}

async function fetchKV(){
  const out = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${PROD}/databases/(default)/documents/collabix_kv?pageSize=300&key=${KEY}` + (pageToken ? `&pageToken=${pageToken}` : '');
    let res;
    for(let attempt = 0; attempt < 6; attempt++){
      res = await fetch(url);
      if(res.status !== 429) break;
      const wait = 3000 * (attempt + 1);
      console.log(`  429 rate-limit — ${wait / 1000}s gözlənilir...`);
      await new Promise(r => setTimeout(r, wait));
    }
    if(!res.ok) throw new Error(`Prod oxunuşu alınmadı: HTTP ${res.status}`);
    const json = await res.json();
    (json.documents || []).forEach(d => {
      const id = d.name.split('/').pop();
      const value = d.fields?.value?.stringValue;
      if(!value) return;
      try{ out.push({ id, v: JSON.parse(value) }); }catch(e){}
    });
    pageToken = json.nextPageToken || '';
  } while(pageToken);
  return out;
}

const docs = await fetchKV();
const data = { users: [], posts: [], chat: [], dm: new Map() };
for(const { id, v } of docs){
  if(id.startsWith('users:')) data.users.push(v);
  else if(id.startsWith('posts:')) data.posts.push(v);
  else if(id.startsWith('chat:general:')) data.chat.push(v);
  else if(id.startsWith('dm:')){
    const pair = id.slice(3, id.lastIndexOf(':'));
    if(!data.dm.has(pair)) data.dm.set(pair, []);
    data.dm.get(pair).push(v);
  }
}

const seen = new Set();
const migrate = [];
const skipped = [];
const shortPass = [];
for(const v of data.users){
  const uname = norm(v.user);
  if(!uname || uname.length < 3){ skipped.push(`${v.user} (etibarsız)`); continue; }
  if(seen.has(uname)){ skipped.push(`${v.user} (dublikat→${uname})`); continue; }
  seen.add(uname);
  if(!v.pass || v.pass.length < 6) shortPass.push(uname);
  migrate.push({ uname, v });
}
const dmCount = [...data.dm.values()].reduce((s, a) => s + a.length, 0);

console.log(`\n=== Firestore → D1 — ${EXECUTE ? '🔴 SQL GENERASİYASI' : '🟢 DRY-RUN'} ===\n`);
console.log(`  istifadəçi:  ${data.users.length} (köçürülür: ${migrate.length})`);
console.log(`  post:        ${data.posts.length} (base64 şəkillər ötürülür — R2-yə köçmür)`);
console.log(`  chat msg:    ${data.chat.length}`);
console.log(`  DM:          ${data.dm.size} thread / ${dmCount} mesaj`);
if(skipped.length) console.log(`  ötürülən:    ${skipped.join('; ')}`);
if(shortPass.length) console.log(`  ⚠ qısa parol (təsadüfi qoyulur, admin reset lazım): ${shortPass.join(', ')}`);

if(!EXECUTE){
  console.log('\n🟢 DRY-RUN bitdi. SQL üçün: node firestore-to-d1.mjs --execute');
  process.exit(0);
}

const sql = ['-- Avtomatik generasiya: Firestore → D1', 'PRAGMA defer_foreign_keys = on;'];
const unameToId = new Map();
const lvl = arr => Object.fromEntries((arr || []).map(x => [x, 'Başlanğıc']));

for(const { uname, v } of migrate){
  const id = uid();
  unameToId.set(uname, id);
  const pass = (!v.pass || v.pass.length < 6) ? 'Cx!' + randomBytes(8).toString('hex') : v.pass;
  const { hash, salt } = hashPassword(pass);
  sql.push(
    `INSERT OR IGNORE INTO users (id, username, name, age, gender, prog_levels, lang_levels, instagram, github, streak, last_active_day, last_active_at, joined_at, blocked, pass_hash, pass_salt) VALUES (` +
    [q(id), q(uname), q(v.name || uname), v.age || 18, q(v.gender || ''),
     jq(lvl(v.prog)), jq(lvl(v.langs)), q(v.instagram || ''), q(v.github || ''),
     v.streak || 0, q(v.lastActive || ''), Date.now(), v.joinedAt || Date.now(),
     v.blocked ? 1 : 0, q(hash), q(salt)].join(', ') + ');',
  );
}

const idOf = old => unameToId.get(norm(old)) || null;

for(const v of data.posts){
  const author = idOf(v.author);
  if(!author) continue;
  const blocks = [];
  if(v.text) blocks.push({ type: 'text', content: v.text });
  if(!blocks.length) continue;
  sql.push(
    `INSERT OR IGNORE INTO posts (id, author_id, author_name, blocks, text, tags, created_at) VALUES (` +
    [q('legacy' + (v.id || uid().slice(0, 8))), q(author), q(v.authorName || v.author),
     jq(blocks), q((v.text || '').slice(0, 300)), jq(v.tags || []), v.createdAt || Date.now()].join(', ') + ');',
  );
}

for(const v of data.chat){
  const author = idOf(v.author);
  if(!author) continue;
  sql.push(
    `INSERT OR IGNORE INTO room_messages (id, room_id, author_id, author_name, type, text, created_at) VALUES (` +
    [q('legacy' + (v.id || uid().slice(0, 8))), q('general'), q(author), q(v.authorName || v.author),
     q('text'), q(v.text || ''), v.createdAt || Date.now()].join(', ') + ');',
  );
}

for(const [pairOld, msgs] of data.dm){
  const [a, b] = pairOld.split('__');
  const idA = idOf(a), idB = idOf(b);
  if(!idA || !idB) continue;
  const pairId = [idA, idB].sort().join('_');
  const [pa, pb] = pairId.split('_');
  const sorted = msgs.sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0));
  const last = sorted[sorted.length - 1];
  sql.push(
    `INSERT OR IGNORE INTO dm_threads (pair_id, user_a, user_b, last_msg, last_from, last_at) VALUES (` +
    [q(pairId), q(pa), q(pb), q((last?.text || '').slice(0, 80)), q(idOf(last?.from) || ''), last?.createdAt || Date.now()].join(', ') + ');',
  );
  for(const v of sorted){
    const from = idOf(v.from), to = idOf(v.to);
    if(!from || !to) continue;
    sql.push(
      `INSERT OR IGNORE INTO dm_messages (id, pair_id, from_id, to_id, type, text, created_at) VALUES (` +
      [q('legacy' + (v.id || uid().slice(0, 8))), q(pairId), q(from), q(to), q('text'), q(v.text || ''), v.createdAt || Date.now()].join(', ') + ');',
    );
  }
}

writeFileSync(new URL('./import.sql', import.meta.url), sql.join('\n') + '\n', 'utf8');
console.log(`\n✅ ${sql.length - 2} INSERT → migration-cf/import.sql`);
console.log('   Tətbiq: npm run db:import:local  (və ya :remote)');
console.log('⚠ import.sql parol heşləri ehtiva edir — commit ETMƏYİN (gitignore-dadır).');
