const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../index.html');
let content = fs.readFileSync(filePath, 'utf8');

// Replace favicon
const oldFaviconRegex = /<link\s+rel="icon"\s+href="\/favicon-32\.png"[^>]*>/i;
const newFavicons = `<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
    <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/brand/icon-192.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />`;

if (oldFaviconRegex.test(content)) {
  content = content.replace(oldFaviconRegex, newFavicons);
}

// Replace og:image with absolute URL and add twitter:image
content = content.replace(
  /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
  `<meta property="og:image" content="https://yeshotels.in/brand/icon-512.png" />\n    <meta name="twitter:image" content="https://yeshotels.in/brand/icon-512.png" />`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated index.html with Google-compliant favicon tags');
