import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import { tradeAPlaneLinks } from "../helpers/trade-a-plane-links.js";
import { delayBetweenScrapes } from "../helpers/scrape.js";

puppeteer.use(StealthPlugin());

// ----------------------- SCRAPE INDIVIDUAL LISTING -----------------------
async function scrapeListing(url) {
  const browser = await puppeteer.launch({
    headless: false,
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

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  } catch {
    console.log("❌ Failed to load — skipping:", url);
    await browser.close();
    return null;
  }

  // Wait for main title
  try {
    await page.waitForSelector("#header", { timeout: 8000 });
  } catch {
    console.log("⚠️ Title not found — skipping:", url);
    await browser.close();
    return null;
  }

  // ----------------------- EXTRACT DATA -----------------------
  let data = {};
  try {
    data = await page.evaluate(() => {
      const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : null);

      const json = {};

      json.url = window.location.href;

      // TITLE
      json.title = clean(document.querySelector("#header")?.innerText);

      // PRICE (raw → clean digits only)
      let priceText =
        document.querySelector("#main_info .price")?.innerText || "";
      let numeric = priceText.replace(/[^0-9]/g, "");

      json.price_raw = clean(priceText);
      json.price = numeric.length ? numeric : "NO_PRICE";

      // MAIN IMAGE
      json.main_image =
        document.querySelector(".pgwSlideshow .main-slide-image img")?.src ||
        null;

      // GALLERY IMAGES
      json.gallery_images = Array.from(
        document.querySelectorAll(".ps-list img")
      ).map((img) => img.src);

      // SELLER NAME
      json.seller =
        clean(document.querySelector(".sellerName a")?.innerText) || null;

      // PHONE
      json.phone =
        document.querySelector(".seller-phone-top a")?.getAttribute("href") ||
        null;

      // QUICK CONTACT NAME (if present)
      json.contact_name = clean(
        document.querySelector("#seller-info-area b")?.innerText
      );

      json.info = {};
      document.querySelectorAll("#info-list-seller li").forEach((item) => {
        const key = clean(item.querySelector("label")?.innerText);
        const value = clean(item.innerText.replace(key, ""));
        if (key && value) json.info[key] = value;
      });

      const extractBox = (id) => {
        const box = document.querySelector(`#${id} pre`);
        return box?.innerText?.trim() || null;
      };

      json.general_specs = extractBox("general_specs");
      json.detailed_description = extractBox("detailed_desc");
      json.avionics_equipment = extractBox("avionics_equipment");
      json.airframe = extractBox("airframe");
      json.engines_mods = extractBox("engines_mods");
      json.interior_exterior = extractBox("interior_exterior");
      json.remarks = extractBox("remarks");

      return json;
    });
  } catch (err) {
    console.log("⚠️ Extraction failed — skipping:", url);
    await browser.close();
    return null;
  }

  await browser.close();

  console.log("✔ Scraped:", data.title);
  return data;
}

export async function scrapeTradeAPlaneController(req, res) {
  try {
    const results = [];

    for (const url of tradeAPlaneLinks) {
      console.log(`🚁 Scraping → ${url}`);

      const scraped = await scrapeListing(url);

      await delayBetweenScrapes();

      if (!scraped) continue;

      const price = scraped.price_raw?.toLowerCase() || "";

      const invalidPriceWords = [
        "make offer",
        "contact seller",
        "call",
        "inquire",
        "not listed",
        "n/a",
      ];

      const containsInvalid = invalidPriceWords.some((w) => price.includes(w));

      if (scraped.price === "NO_PRICE" || containsInvalid) {
        console.log("⏭ Skipped due to invalid price:", scraped.url);
        continue;
      }

      results.push(scraped);
    }

    fs.writeFileSync(
      "./scraped-data/tradeaplane-results.json",
      JSON.stringify(results, null, 2)
    );

    res.json({
      success: true,
      scraped: results.length,
      data: results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
}
