import fs from "fs";
import path from "path";

const folder = "./controller";

// Output file
const outputFile = "controller-results.json";

function isJsonFile(name) {
  return name.endsWith(".json");
}

async function mergeAll() {
  let finalArray = [];
  const seenUrls = new Set(); // to avoid duplicates

  // Read folder
  const files = fs.readdirSync(folder).filter(isJsonFile);

  console.log(`Found ${files.length} JSON files to merge...\n`);

  for (const file of files) {
    const fullPath = path.join(folder, file);

    console.log("📥 Loading:", file);

    // Read JSON content
    const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));

    if (!Array.isArray(data)) {
      console.log("⚠️ Skipped (not an array):", file);
      continue;
    }

    // Merge while avoiding duplicates
    data.forEach((item) => {
      if (!item.url) return;

      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        finalArray.push(item);
      }
    });
  }

  console.log(`\n✅ Merged total: ${finalArray.length} helicopter listings`);

  // Save output
  fs.writeFileSync(outputFile, JSON.stringify(finalArray, null, 2));

  console.log(`💾 Saved → ${outputFile}`);
}

mergeAll();
