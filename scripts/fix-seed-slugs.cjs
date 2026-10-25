const fs = require('fs');

let content = fs.readFileSync('server/src/scripts/seed-seo-pages.ts', 'utf8');

content = content.replace(/slug: "hotels-near-([a-z0-9-]+)"/g, 'slug: "$1"');

fs.writeFileSync('server/src/scripts/seed-seo-pages.ts', content, 'utf8');
console.log('Cleaned slugs in seed-seo-pages.ts');
