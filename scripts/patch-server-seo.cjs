const fs = require('fs');

let content = fs.readFileSync('server/index.ts', 'utf8');

// Add import if not present
if (!content.includes('import seoRoutes')) {
  content = content.replace(
    /import menuRoutes from "\.\/src\/routes\/menu\.routes";/,
    'import menuRoutes from "./src/routes/menu.routes";\r\nimport seoRoutes from "./src/routes/seo.routes";'
  );
}

// Add route mount if not present
if (!content.includes('/api/seo')) {
  content = content.replace(
    /app\.use\("\/api\/menu", menuRoutes\);/,
    'app.use("/api/menu", menuRoutes);\r\n  app.use("/api/seo", seoRoutes);'
  );
}

fs.writeFileSync('server/index.ts', content, 'utf8');
console.log('Successfully patched server/index.ts with seoRoutes');
