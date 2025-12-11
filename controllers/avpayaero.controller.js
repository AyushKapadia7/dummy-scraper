import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import { avPayAeroLinks } from "../helpers/avpay-aero-links.js";
import { delayBetweenScrapes } from "../helpers/scrape.js";

puppeteer.use(StealthPlugin());

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

  const titleSelectors = ["h1.product_title", "h1.entry-title", "h1"];
  let foundTitle = false;

  for (const sel of titleSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 5000 });
      foundTitle = true;
      break;
    } catch {}
  }

  if (!foundTitle) {
    console.log("⚠️ No title found — skipping:", url);
    await browser.close();
    return null;
  }

  let data = {};
  try {
    data = await page.evaluate(() => {
      const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : null);
      const json = {};

      json.url = window.location.href;

      json.title =
        clean(document.querySelector("h1.product_title")?.innerText) ||
        clean(document.querySelector("h1.entry-title")?.innerText) ||
        clean(document.querySelector("h1")?.innerText);

      json.short_description = clean(
        document.querySelector(
          ".woocommerce-product-details__short-description p"
        )?.innerText
      );

      json.main_image = document.querySelector(".fl-photo-content img")?.src;

      json.gallery_images = Array.from(
        document.querySelectorAll(".uabb-photo-gallery-item a")
      ).map((a) => a.href);

      json.seller = clean(
        document.querySelector(".wcpt-wcfm-store-name")?.innerText
      );

      json.contact_name = clean(
        document.querySelector(".wcpt-custom-field")?.innerText
      );

      json.phone = document.querySelector("a[href^='tel:']")?.href || null;
      json.whatsapp = document.querySelector("a[href*='wa.me']")?.href || null;

      document.querySelectorAll(".wcpt-item-row").forEach((row) => {
        const key = clean(row.querySelector(".wcpt-text")?.innerText);
        const value = clean(
          row.querySelector("a")?.innerText ||
            row.querySelector(".wcpt-custom-field")?.innerText
        );

        if (key && value) json[key] = value;
      });

      json.price = json["Price:"] || "NO_PRICE";
      delete json["Price:"];

      const longDescBlock = document.querySelector("#tab-description");
      json.long_description = longDescBlock?.innerText?.trim() || null;

      function extractSection(title) {
        if (!longDescBlock) return [];
        const html = longDescBlock.innerHTML;

        const regex = new RegExp(
          `<strong>${title}<\\/strong><br>([\\s\\S]*?)(?:<strong>|$)`,
          "i"
        );
        const match = html.match(regex);
        if (!match) return [];

        return match[1]
          .split("<br>")
          .map((t) => clean(t.replace(/<[^>]+>/g, "")))
          .filter(Boolean);
      }

      json.airframe = extractSection("Airframe");
      json.rotors_controls = extractSection("Rotors & Controls");
      json.powerplant_fuel_system = extractSection("Powerplant & Fuel System");
      json.transmission_hydraulic = extractSection(
        "Transmission Drive & Hydraulic System"
      );
      json.electrical_system = extractSection("Electrical System");
      json.avionics = extractSection("Avionics");
      json.interior = extractSection("Interior");
      json.exterior = extractSection("Exterior");

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

export async function scrapeAvPayAeroController(req, res) {
  try {
    const results = [];

    for (const url of avPayAeroLinks) {
      console.log(`🚁 Scraping → ${url}`);

      const scraped = await scrapeListing(url);

      await delayBetweenScrapes();

      if (!scraped) continue;

      const price = scraped.price?.toLowerCase();

      if (
        price === "no_price" ||
        price === "enquire" ||
        price === "make offer" ||
        price === "contact seller"
      ) {
        console.log("⏭ Skipped (non-numeric price):", scraped.url);
        continue;
      }

      if (!/^\d[\d,\.]*$/.test(scraped.price)) {
        console.log("⏭ Skipped (not a numeric price):", scraped.url);
        continue;
      }

      results.push(scraped);
    }

    fs.writeFileSync(
      "./scraped-data/avpayaero-results.json",
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
