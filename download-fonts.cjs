const fs = require('fs');
const https = require('https');
const path = require('path');

const cssUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Space+Grotesk:wght@400;700&family=JetBrains+Mono:wght@400;600&family=Orbitron:wght@400;800&display=swap';

const destDir = path.join(__dirname, 'public', 'fonts');
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

// We need a specific User-Agent so Google Fonts returns WOFF2
const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
  }
};

https.get(cssUrl, options, (res) => {
  let css = '';
  res.on('data', chunk => css += chunk);
  res.on('end', () => {
    // Parse CSS to extract URLs and filenames
    // @font-face {
    //   font-family: 'Inter';
    //   ...
    //   src: url(https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2) format('woff2');
    //   unicode-range: ...
    // }
    
    // Actually, to match the existing filenames:
    // inter-cyrillic-ext.woff2, inter-latin.woff2, etc.
    // The CSS comments usually say /* cyrillic-ext */ above the block.
    
    const blocks = css.split('@font-face');
    let currentSubset = '';
    
    blocks.forEach(block => {
      if (block.includes('/*')) {
        const match = block.match(/\/\*\s*([a-z0-9-]+)\s*\*\//);
        if (match) currentSubset = match[1];
      }
      
      const familyMatch = block.match(/font-family:\s*'([^']+)'/);
      const urlMatch = block.match(/url\((https:\/\/[^)]+)\)/);
      
      if (familyMatch && urlMatch && currentSubset) {
        let family = familyMatch[1].toLowerCase().replace(/\s+/g, '-');
        let filename = `${family}-${currentSubset}.woff2`;
        let url = urlMatch[1];
        
        console.log(`Downloading ${filename} from ${url}`);
        
        const file = fs.createWriteStream(path.join(destDir, filename));
        https.get(url, (fontRes) => {
          fontRes.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log(`Finished ${filename}`);
          });
        });
      }
    });
  });
});
