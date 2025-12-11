import fs from "fs";

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function delayBetweenScrapes() {
  const delay = 20000 + Math.floor(Math.random() * 10000);
  console.log(`⏳ Waiting ${(delay / 1000).toFixed(1)} seconds...`);
  await wait(delay);
}

export function loadLinks(filePath) {
  return fs
    .readFileSync(filePath, "utf-8")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}
