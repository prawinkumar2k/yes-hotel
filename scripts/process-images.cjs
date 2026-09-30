const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'drive-download-20260926T094002Z-1-001');
const destDir = path.join(__dirname, '..', 'public', 'gallery');
const libFile = path.join(__dirname, '..', 'client', 'lib', 'gallery.ts');

const categories = ["EXTERIOR", "ROOMS", "HOTEL", "DINING", "EXPERIENCE"];

async function run() {
  // Clear destDir of png and jpg
  const existing = fs.readdirSync(destDir);
  for (const file of existing) {
    if (file.endsWith('.png') || file.endsWith('.jpg')) {
      fs.unlinkSync(path.join(destDir, file));
    }
  }

  // Get new images
  const newImages = fs.readdirSync(srcDir).filter(f => f.endsWith('.jpg')).sort();
  
  let tsContent = `export type LocalGalleryImage = {
  id: string;
  src: string;
  title: string;
  category: string;
};

export const LOCAL_GALLERY_IMAGES: LocalGalleryImage[] = [\n`;

  newImages.forEach((img, i) => {
    const numStr = String(i + 1).padStart(2, '0');
    const newName = `hotel-${numStr}.jpg`;
    
    // Copy
    fs.copyFileSync(path.join(srcDir, img), path.join(destDir, newName));
    
    // Append to TS
    const title = `YES Hotels Gallery ${i + 1}`;
    const category = categories[i % categories.length];
    
    tsContent += `  { id: "hotel-${numStr}", src: "/gallery/${newName}", title: "${title}", category: "${category}" },\n`;
  });

  tsContent += `];\n`;

  fs.writeFileSync(libFile, tsContent, 'utf-8');
  console.log('Successfully copied ' + newImages.length + ' images and updated gallery.ts');
}

run();
