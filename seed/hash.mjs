// Collabix Demo Seed — PBKDF2 Password Hash Utility
// auth.ts-dəki eyni alqoritm: PBKDF2-SHA256, 100k iterations, 16-byte salt, 256-bit output.

import { pbkdf2Sync, randomBytes } from 'node:crypto';

const ITERATIONS = 100_000;
const KEY_LEN = 32;    // 256 bit
const SALT_LEN = 16;   // 128 bit

/**
 * PBKDF2-SHA256 ilə parol hash-layır.
 * @param {string} password
 * @returns {{ hash: string, salt: string, iterations: number }}
 */
export function hashPassword(password) {
  const salt = randomBytes(SALT_LEN);
  const derived = pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, 'sha256');
  return {
    hash: derived.toString('hex'),
    salt: salt.toString('hex'),
    iterations: ITERATIONS,
  };
}

/**
 * Bütün demo istifadəçilər üçün hash-ları əvvəlcədən hesablayır.
 * Hər istifadəçi fərqli salt alır.
 * @param {string} password
 * @param {number} count
 * @returns {Array<{ hash: string, salt: string }>}
 */
export function precomputeHashes(password, count) {
  console.log(`  🔐 ${count} parol hash-ı hesablanır...`);
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(hashPassword(password));
    if ((i + 1) % 20 === 0) {
      process.stdout.write(`\r  🔐 ${i + 1}/${count}`);
    }
  }
  process.stdout.write(`\r  🔐 ${count}/${count} ✅\n`);
  return results;
}
