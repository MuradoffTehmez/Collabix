const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
console.log('app:', html.match(/<div[^>]*id="app"[^>]*>/)[0]);
console.log('landing:', html.match(/<div[^>]*id="landing"[^>]*>/)[0]);
