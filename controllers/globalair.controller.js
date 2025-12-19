import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import { globalAirLinks } from "../helpers/globalair-links.js";
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

  // Wait for title block to appear
  try {
    await page.waitForSelector(".card-header h3", { timeout: 10000 });
  } catch {
    console.log("⚠️ Title not found — skipping:", url);
    await browser.close();
    return null;
  }

  let data = {};

  try {
    data = await page.evaluate(() => {
      const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : null);
      const json = {};

      json.url = window.location.href;

      // Title
      json.title = clean(document.querySelector(".card-header h3")?.innerText);

      // Seller
      json.seller = clean(document.querySelector(".seller-name a")?.innerText);

      // Contact Name
      let contactName =
        document.querySelector(".seller-name")?.nextElementSibling?.textContent;
      json.contact_name = clean(contactName);

      // Location block (2–3 lines)
      const locBlock = document
        .querySelector(".seller-name")
        ?.parentElement.querySelectorAll("br");

      if (locBlock && locBlock.length > 0) {
        json.location = clean(
          document
            .querySelector(".seller-name")
            .parentElement.innerText.split("\n")
            .slice(2)
            .join(", ")
        );
      } else {
        json.location = null;
      }

      document.querySelectorAll(".col-md-6 .row").forEach((row) => {
        const key = clean(row.children[0]?.innerText?.replace(":", ""));
        const value = clean(row.children[1]?.innerText);

        if (key && value) json[key] = value;
      });

      // Price
      const convertedPrice = clean(
        document.querySelector("#convertedPrice")?.innerText
      );

      json.price = convertedPrice || "NO_PRICE";

      // Skip "Please Call"
      if (json.price.toLowerCase().includes("please call")) {
        json.price = "NO_PRICE";
      }

      // Long Description (full HTML text)
      const desc = document.querySelector("#divaddetails");
      json.long_description = desc ? clean(desc.innerText) : null;

      // ---------- CARD SECTION EXTRACTOR ----------
      function extractSection(cardTitle) {
        const card = [...document.querySelectorAll(".card-header")].find((el) =>
          el.innerText.trim().toLowerCase().includes(cardTitle.toLowerCase())
        );

        if (!card) return [];

        const body = card.parentElement.querySelector(".card-body");

        if (!body) return [];

        return body.innerText
          .split("\n")
          .map((t) => clean(t))
          .filter(Boolean);
      }

      json.airframe = extractSection("Airframe");
      json.engines = extractSection("Engine");

      function extractMobileSection(title) {
        const block = [...document.querySelectorAll(".mobileLHDtl")].find(
          (div) =>
            div.querySelector("h4")?.innerText.trim().toLowerCase() ===
            title.toLowerCase()
        );

        if (!block) return [];

        const textBlocks = [...block.querySelectorAll("div")]
          .map((d) => clean(d.innerText))
          .filter(Boolean);

        return textBlocks
          .flatMap((t) =>
            t
              .split("<br>")
              .join("\n")
              .split("\n")
              .map((x) => clean(x))
          )
          .filter(Boolean);
      }

      json.interior = extractMobileSection("Interior Details");
      json.exterior = extractMobileSection("Exterior Details");
      json.avionics = extractMobileSection("Avionics");

      // Main Image (first large photo)
      const firstImg = document.querySelector("img.lazyload, img[src]");
      json.main_image = firstImg ? firstImg.src : null;

      // Gallery Images
      json.gallery_images = Array.from(document.querySelectorAll("img"))
        .map((img) => img.src)
        .filter(
          (src) =>
            src &&
            !src.includes("logo") &&
            !src.includes("icon") &&
            !src.includes("placeholder")
        );

      const iframeBtn = document.querySelector(
        "button[id^='Contact'][data-businessphone]"
      );

      json.phone = iframeBtn
        ? iframeBtn.getAttribute("data-businessphone")
        : null;

      json.whatsapp = null; // Not available

      if (json.Price !== undefined || json.Price !== null) delete json.Price;
      return json;
    });
  } catch (err) {
    console.log("⚠️ Extraction failed — skipping:", url, err);
    await browser.close();
    return null;
  }

  await browser.close();

  console.log("✔ Scraped:", data.title);
  return data;
}

export async function scrapeGlobalAirController(req, res) {
  try {
    const results = [];

    for (const url of globalAirLinks) {
      console.log(`🚁 Scraping → ${url}`);

      const scraped = await scrapeListing(url);

      await delayBetweenScrapes();

      if (!scraped) continue;

      if (scraped.price === "NO_PRICE") {
        console.log("⏭ Skipped (no price):", scraped.url);
        continue;
      }

      results.push(scraped);
    }

    fs.writeFileSync(
      "./scraped-data/globalair-results-new.json",
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
