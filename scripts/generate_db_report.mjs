import mongoose from "mongoose";
import fs from "fs";
import path from "path";

const uri = "mongodb://127.0.0.1:27027/yes_hotels";
const outputPath = path.join(process.cwd(), "docs", "DATABASE_INTEGRITY_REPORT.md");

async function generateReport() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  
  let report = "# DATABASE INTEGRITY REPORT\n\n";
  report += `Generated at: ${new Date().toISOString()}\n`;
  report += `Database URI: ${uri}\n\n`;

  report += "## Collections Overview\n\n";
  report += "| Collection | Document Count | Indexes |\n";
  report += "|------------|----------------|---------|\n";

  const collectionDetails = [];

  for (const collInfo of collections) {
    if (collInfo.name === "system.indexes" || collInfo.name === "system.views") continue;
    
    const collection = db.collection(collInfo.name);
    const count = await collection.countDocuments();
    const indexes = await collection.indexes();
    
    report += `| ${collInfo.name} | ${count} | ${indexes.length} |\n`;
    
    // Sample a document to check for propertyId and orphans
    const sample = await collection.findOne();
    const hasPropertyId = sample && ('propertyId' in sample);
    
    let missingPropertyIdCount = 0;
    if (hasPropertyId) {
       missingPropertyIdCount = await collection.countDocuments({ propertyId: { $exists: false } });
    } else {
       // Maybe no docs or just doesn't use propertyId
       // We can check if it exists anywhere
       const anyProp = await collection.findOne({ propertyId: { $exists: true } });
       if (anyProp) {
         missingPropertyIdCount = await collection.countDocuments({ propertyId: { $exists: false } });
       }
    }

    collectionDetails.push({
      name: collInfo.name,
      count,
      indexes,
      sampleKeys: sample ? Object.keys(sample).join(", ") : "No documents",
      missingPropertyIdCount
    });
  }

  report += "\n## Detailed Collection Analysis\n\n";
  
  for (const detail of collectionDetails) {
    report += `### ${detail.name}\n`;
    report += `- **Count:** ${detail.count}\n`;
    report += `- **Missing PropertyId:** ${detail.missingPropertyIdCount} (If applicable)\n`;
    report += `- **Sample Fields:** ${detail.sampleKeys}\n`;
    report += `- **Indexes:**\n`;
    for (const idx of detail.indexes) {
      report += `  - ${idx.name} (Keys: ${JSON.stringify(idx.key)})\n`;
    }
    report += "\n";
  }

  fs.writeFileSync(outputPath, report);
  console.log("Report generated at " + outputPath);
  process.exit(0);
}

generateReport().catch(console.error);
