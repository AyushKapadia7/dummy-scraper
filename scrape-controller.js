import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import { controllerWebsiteLinks } from "./helper/controller-website-links.js";

puppeteer.use(StealthPlugin());

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function randomDelay() {
  const delay = 20000 + Math.floor(Math.random() * 10000);
  console.log(`⏳ Waiting ${delay / 1000}s before next scrape...`);
  await wait(delay);
}

async function scrapeListing(url) {
  const browser = await puppeteer.launch({
    headless: false, // must be visible browser
    defaultViewport: null,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  );

  console.log("🌍 Opening:", url);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });

  // Wait for title hydration
  await page.waitForFunction(
    () => {
      const el = document.querySelector("h1.detail__title");
      return el && el.innerText.trim().length > 0;
    },
    { timeout: 60000 }
  );

  const data = await page.evaluate(() => {
    const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : null);
    const json = {};

    json.url = window.location.href;

    // Title
    json.title = clean(document.querySelector("h1.detail__title")?.innerText);

    // Price
    const priceRaw = clean(
      document.querySelector(".listing-prices__retail-price")?.innerText
    );
    if (priceRaw) {
      const m = priceRaw.match(/[\d,]+/);
      json.price = m ? m[0] : null;
    }

    // Location
    json.location = clean(
      document.querySelector(".detail__machine-location a")?.innerText
    );

    // Specs sections
    const sections = document.querySelectorAll("h3.detail__specs-heading");
    sections.forEach((section) => {
      const wrapper = section.nextElementSibling;
      if (!wrapper) return;

      const labels = wrapper.querySelectorAll(".detail__specs-label");
      const values = wrapper.querySelectorAll(".detail__specs-value");

      labels.forEach((labelEl, i) => {
        const label = clean(labelEl.innerText);
        const valueEl = values[i];
        if (!label || !valueEl) return;

        let value = clean(valueEl.innerText);

        // convert bullet "o " → array
        if (value.includes("o ")) {
          value = value
            .split("o ")
            .map((v) => clean(v))
            .filter(Boolean);
        }

        json[label] = value;
      });
    });

    // Images
    json.images = Array.from(document.querySelectorAll(".mc-items img"))
      .map((img) => img.src)
      .filter(Boolean);

    return json;
  });

  await browser.close();
  console.log("✔ Scraped:", data.title);

  return data;
}

async function run() {
  const results = [];

  for (const url of controllerWebsiteLinks) {
    console.log(`🚁 Scraping next → ${url}`);

    const res = await scrapeListing(url);
    if (res?.price) results.push(res);

    await randomDelay(); // NEW → wait 20–30 sec
  }
  fs.writeFileSync("controller/page-7.json", JSON.stringify(results, null, 2));

  console.log("💾 Saved → controller-results.json");
}

run();
