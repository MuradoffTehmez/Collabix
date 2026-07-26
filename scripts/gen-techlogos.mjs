// Bir dəfəlik generator: simple-icons-dan YALNIZ lazım olan loqoların path-ını çıxarıb
// js/techlogos.js faylını yazır. `simple-icons` devDependency-dir və client bundle-a
// HEÇ VAXT düşmür — bu skript nəticəni statik fayla "bişirir" (hotlink yox, self-host).
//
// İşə salmaq:  node scripts/gen-techlogos.mjs
// Taksonomiyaya yeni dil əlavə etdikdə MAP-a sətir əlavə edib təkrar işə sal.

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const si = require('simple-icons');

// taksonomiya id → simple-icons açarı.
// Siyahıda OLMAYAN id-lər (csharp, java, sql) qəsdən buraxılıb: simple-icons
// bunları trademark səbəbi ilə saxlamır → techLogo() rəngli initial badge fallback-ə düşür.
const MAP = {
  python:     'siPython',
  javascript: 'siJavascript',
  typescript: 'siTypescript',
  cpp:        'siCplusplus',
  go:         'siGo',
  rust:       'siRust',
  php:        'siPhp',
  kotlin:     'siKotlin',
  swift:      'siSwift',
  htmlcss:    'siHtml5',
  bash:       'siGnubash',
  arduino:    'siArduino',
  // sosial (footer — Ana#12)
  discord:    'siDiscord',
  github:     'siGithub',
};

const out = {};
const missing = [];
for (const [id, key] of Object.entries(MAP)) {
  const icon = si[key];
  if (!icon) { missing.push(`${id} → ${key}`); continue; }
  out[id] = { t: icon.title, h: '#' + icon.hex, d: icon.path };
}

if (missing.length) {
  console.error('XƏTA — simple-icons-da tapılmadı:\n  ' + missing.join('\n  '));
  process.exit(1);
}

const body = `// ⚠ AVTOMATİK YARADILIB — əl ilə redaktə etmə.
// Mənbə: scripts/gen-techlogos.mjs (simple-icons, CC0-1.0).
// Təkrar yaratmaq: node scripts/gen-techlogos.mjs
//
// t = başlıq, h = rəsmi brend rəngi, d = 24×24 viewBox SVG path.
export const TECH_ICONS = ${JSON.stringify(out, null, 2)};
`;

writeFileSync(new URL('../js/techlogos.data.js', import.meta.url), body);
console.log(`js/techlogos.data.js yazıldı — ${Object.keys(out).length} loqo.`);
