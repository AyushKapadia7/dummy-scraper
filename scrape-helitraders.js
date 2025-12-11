import { chromium } from "playwright";
import fs from "fs";

const MAX_CONCURRENT = 10;
const TIMEOUT = 90000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function delayBetweenScrapes() {
  const delay = 20000 + Math.floor(Math.random() * 10000);
  console.log(`⏳ Waiting ${(delay / 1000).toFixed(1)}s before next scrape...`);
  await wait(delay);
}

async function getSitemapLinks(sitemapUrl) {
  console.log("📥 Fetching sitemap:", sitemapUrl);

  const response = await fetch(sitemapUrl);
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

  console.log(`🔗 Found ${urls.length} URLs`);
  return urls;
}

async function scrapePage(browser, url) {
  const page = await browser.newPage();
  try {
    console.log("🌍 Visiting:", url);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT,
    });

    await page.waitForSelector("h1", { timeout: 20000 });

    const pageTitle = await page.$eval("h1", (el) => el.innerText.trim());
    console.log("🔶 Title:", pageTitle);

    if (pageTitle.toLowerCase().includes("not found")) {
      console.log("🚫 Listing removed — skipping");
      await page.close();
      return null;
    }

    try {
      await page.click(".wp-post-image", { timeout: 5000 });
    } catch {}

    const data = await page.evaluate(() => {
      const getText = (s) =>
        document.querySelector(s)?.innerText?.trim() || null;

      const getSpecs = () => {
        const out = {};
        document.querySelectorAll(".general-spec-card").forEach((card) => {
          const label = card
            .querySelector("div.col-6 small b")
            ?.innerText?.trim()
            .toLowerCase();
          const value = card.querySelector("div.col small")?.innerText?.trim();
          if (label && value && value !== "" && value.toLowerCase() !== label) {
            out[label] = value;
          }
        });
        return out;
      };

      const getList = (id) => {
        const el = document.querySelector(`#${id}`);
        if (!el) return [];
        return el.innerText
          .split("\n")
          .map((t) => t.replace(/^- /, "").trim())
          .filter(Boolean);
      };

      return {
        url: window.location.href,
        title: getText("h1"),
        price: getText("#price-m"),

        description: getText("div.row p"),
        ...getSpecs(),

        avionics: getList("dt-avionics"),
        equipment: getList("dt-equipment"),
        interior: getList("dt-interior"),
        exterior: getList("dt-exterior"),
        engine_1: getList("dt-engine_1"),
        inspection_details: getList("dt-inspection_details"),
        damage_history: getList("dt-damage_history"),
        remarks: getList("dt-remarks"),
        disclaimer: getList("dt-disclaimer"),

        images: [...document.querySelectorAll(".carousel-item img")].map(
          (i) => i.src
        ),
      };
    });

    if (!data.price || data.price.toLowerCase().includes("contact")) {
      console.log("💸 Contact seller — skipping");
      await page.close();
      return null;
    }

    console.log("✔ Scraped:", data.title);

    await page.close();
    return data;
  } catch (err) {
    console.log("❌ Error scraping:", url, err);
    await page.close();
    return null;
  }
}

async function scrapeAllListings() {
  const sitemap1 = "https://helitrader.com/listings-sitemap.xml";
  const sitemap2 = "https://helitrader.com/listings-sitemap2.xml";

  const urls1 = await getSitemapLinks(sitemap1);
  const urls2 = await getSitemapLinks(sitemap2);

  const allUrls = [...new Set([...urls1, ...urls2])];
  console.log(`🚁 Total unique URLs: ${allUrls.length}`);

  const browser = await chromium.launch({ headless: true });

  let index = 0;
  const results = [];

  async function worker() {
    while (index < allUrls.length) {
      const url = allUrls[index++];

      const scraped = await scrapePage(browser, url);
      if (scraped) results.push(scraped);

      await delayBetweenScrapes();
    }
  }

  const workers = [];
  for (let i = 0; i < MAX_CONCURRENT; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  await browser.close();

  console.log(`✅ Done — scraped ${results.length} listings`);
  fs.writeFileSync("heli-results.json", JSON.stringify(results, null, 2));

  console.log("💾 Saved: heli-results.json");
}

// Start script
scrapeAllListings();
