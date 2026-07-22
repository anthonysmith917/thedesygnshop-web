import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const STORE = "https://cmdesygns6.wixsite.com/the-desygn-shop-2";
const STATE = ".wix-catalog-state.json";
const START = "<!-- AUTO-WIX-PRODUCTS:START -->";
const END = "<!-- AUTO-WIX-PRODUCTS:END -->";

export const productSlug = (url) => (url.match(/\/product-page\/([^/?#]+)/i)?.[1] || "").toLowerCase();
export const extractLocations = (xml) => [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((m) => m[1].trim().replaceAll("&amp;", "&"));

export function extractProduct(html, url) {
  const items = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const value = JSON.parse(match[1]);
      items.push(...(Array.isArray(value) ? value : [value]), ...(value?.["@graph"] || []));
    } catch {}
  }
  const product = items.find((item) => item?.["@type"] === "Product" || item?.["@type"]?.includes?.("Product"));
  if (!product?.name || !product?.image) return null;
  const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
  const image = Array.isArray(product.image) ? product.image[0] : product.image;
  return {
    slug: productSlug(url), url, name: String(product.name).trim(),
    image: typeof image === "string" ? image : image?.url,
    price: offer?.price ? "$" + Number(offer.price).toFixed(2) : "Available now"
  };
}

const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export const renderCard = (product) =>
  '        <article class="product-card reveal" data-category="apparel" data-wix-slug="' + escapeHtml(product.slug) + '">\n' +
  '          <a class="product-image" href="' + escapeHtml(product.url) + '"><img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy"><span class="product-badge">New drop</span></a>\n' +
  '          <div class="product-info"><p>New release</p><h3>' + escapeHtml(product.name) + '</h3><div><strong>' + escapeHtml(product.price) + '</strong><a href="' + escapeHtml(product.url) + '" aria-label="Shop ' + escapeHtml(product.name) + ' on the Wix store">Shop <span>↗</span></a></div></div>\n' +
  '        </article>';

async function get(url) {
  const response = await fetch(url, { headers: { "user-agent": "Desygn-Shop-Catalog-Sync/1.0" } });
  if (!response.ok) throw new Error(response.status + " fetching " + url);
  return response.text();
}

async function discover(base) {
  const queue = [base.replace(/\/$/, "") + "/sitemap.xml"];
  const seen = new Set();
  const products = new Map();
  while (queue.length) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    for (const location of extractLocations(await get(url))) {
      if (/\/product-page\//i.test(location)) products.set(productSlug(location), location);
      else if (/\.xml(?:$|\?)/i.test(location) && !seen.has(location)) queue.push(location);
    }
  }
  return [...products.values()];
}

export async function sync({ indexPath = "index.html", statePath = STATE, storeUrl = STORE, dryRun = false } = {}) {
  const html = await readFile(indexPath, "utf8");
  const state = JSON.parse(await readFile(statePath, "utf8"));
  if (!html.includes(START) || !html.includes(END)) throw new Error("Homepage auto-product markers are missing.");
  const urls = await discover(storeUrl);
  const slugs = urls.map(productSlug).filter(Boolean);
  if (!state.initialized) {
    if (dryRun) console.log("Dry-run baseline: found " + slugs.length + " existing Wix products; no cards will be added.");
    else {
      await writeFile(statePath, JSON.stringify({ initialized: true, slugs, scannedAt: new Date().toISOString() }, null, 2) + "\n");
      console.log("Baseline saved for " + slugs.length + " existing products. Future new drops will be added.");
    }
    return;
  }
  const previous = new Set(state.slugs);
  const homepage = new Set([...html.matchAll(/\/product-page\/([^"'?#/]+)/gi)].map((m) => m[1].toLowerCase()));
  const newUrls = urls.filter((url) => !previous.has(productSlug(url)) && !homepage.has(productSlug(url)));
  const fresh = [];
  for (const url of newUrls) {
    const product = extractProduct(await get(url), url);
    if (product?.slug && product?.image) fresh.push(product);
  }
  if (dryRun) {
    console.log(fresh.length ? "Would add: " + fresh.map((p) => p.name).join(", ") : "No new drops. " + urls.length + " products scanned.");
    return;
  }
  if (fresh.length) {
    const at = html.indexOf(START) + START.length;
    await writeFile(indexPath, html.slice(0, at) + "\n" + fresh.map(renderCard).join("\n\n") + html.slice(at));
    console.log("Added: " + fresh.map((p) => p.name).join(", "));
  } else console.log("No new drops. " + urls.length + " products scanned.");
  await writeFile(statePath, JSON.stringify({ initialized: true, slugs, scannedAt: new Date().toISOString() }, null, 2) + "\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  sync({ storeUrl: process.env.WIX_STORE_URL || STORE, dryRun: process.argv.includes("--dry-run") })
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
