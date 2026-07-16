import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createPageRouter } from "../src/routes/modules/pageRoutes.js";

const config = {
  version: "1.15.0",
  basePath: "/",
  publicOrigin: "https://bookloft.pl",
  publicDir: new URL("../public", import.meta.url).pathname,
  googleAnalyticsId: "",
  adminUser: "test",
  adminPassword: "test",
  sessionSecret: "test-secret",
  sessionMaxAgeMs: 60_000,
  cookieSecure: false
};

function product(index, overrides = {}) {
  const id = String(10_000 + index);
  return {
    id,
    slug: `ksiazka-${index}`,
    sku: `SKU-${index}`,
    name: `Książka ${index}`,
    searchText: `książka ${index}`,
    price: 20 + index,
    currency: "PLN",
    stock: 1,
    categoryId: "fantasy",
    categoryName: "Fantasy",
    categoryPath: [{ id: "fantasy", name: "Fantasy", displayName: "Fantasy" }],
    images: [`https://a.allegroimg.com/original/example-${index}.jpg`],
    descriptionHtml: "<p><b>Stan: DOBRY</b></p>",
    features: [{ name: "Stan", value: "Używany" }],
    addedAt: `2026-07-${String((index % 9) + 1).padStart(2, "0")}T08:00:00.000Z`,
    sourceAddedAt: "2026-07-01T08:00:00.000Z",
    sourceUpdatedAt: index === 1 ? "2026-07-12T12:00:00.000Z" : null,
    contentUpdatedAt: index === 1 ? "2026-07-14T12:00:00.000Z" : null,
    allegroUrl: `https://allegro.pl/oferta/${id}`,
    related: [],
    ...overrides
  };
}

function storefront() {
  const products = Array.from({ length: 51 }, (_item, index) => product(index + 1));
  return {
    version: config.version,
    updatedAt: "2026-07-16T09:00:00.000Z",
    products,
    categories: [{
      id: "fantasy",
      name: "Fantasy",
      displayName: "Fantasy",
      productCount: products.length,
      totalProductCount: products.length,
      children: []
    }],
    meta: { productCount: products.length, categoryCount: 1, currency: "PLN" }
  };
}

async function withServer(run) {
  const data = storefront();
  const cache = {
    getStorefront: async () => data,
    getNewestProducts: async () => data.products.slice(0, 50),
    getProduct: async (id) => id === data.products[0].id ? data.products[0] : null,
    getMissingProductPageData: async (id, slug) => id === "gone" ? {
      status: 410,
      snapshot: {
        id,
        name: "Achaja Tomy 1-3 / Andrzej Ziemiański",
        image: "https://a.allegroimg.com/original/achaja.jpg",
        categoryName: "Fantasy"
      },
      searchQuery: "Achaja Tomy 1-3",
      alternatives: data.products.slice(0, 4)
    } : {
      status: 404,
      snapshot: null,
      searchQuery: String(slug || "").replace(/-/g, " "),
      alternatives: data.products.slice(0, 4)
    }
  };
  const app = express();
  app.use(createPageRouter(config, cache));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();

  try {
    await run(`http://127.0.0.1:${address.port}`, data);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("active product metadata stays unchanged and schema omits invented merchant data", async () => {
  await withServer(async (origin, data) => {
    const response = await fetch(`${origin}/product/${data.products[0].id}/${data.products[0].slug}`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /<title>Książka 1 \| BookLoft<\/title>/);
    assert.match(html, /Książka 1\. Stan: DOBRY\. Fantasy w BookLoft z realnymi zdjęciami, rzetelnym opisem i zakupem przez Allegro\./);
    assert.doesNotMatch(html, /"brand":\{"@type":"Brand","name":"BookLoft"\}/);
    assert.doesNotMatch(html, /MerchantReturnPolicy|ShippingService|hasMerchantReturnPolicy/);
  });
});

test("gone product renders a useful full-width 410 page with current alternatives", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/product/gone/achaja-tomy-1-3`);
    const html = await response.text();

    assert.equal(response.status, 410);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
    assert.match(html, /class="unavailable-page"/);
    assert.match(html, /Ten egzemplarz został już sprzedany/);
    assert.match(html, /Achaja Tomy 1-3 \/ Andrzej Ziemiański/);
    assert.match(html, /value="Achaja Tomy 1-3"/);
    assert.match(html, /Podobne oferty i nowości/);
    assert.doesNotMatch(html, /shop-layout simple-page-shell/);
  });
});

test("catalog hides no-result copy from populated SSR and protects pagination snippets", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.doesNotMatch(html, /Nie znaleźliśmy pasujących ofert/);
    assert.match(html, /class="catalog-pagination-shell" data-nosnippet hidden/);

    const emptyResponse = await fetch(`${origin}/?q=nieistniejacy-tytul`);
    const emptyHtml = await emptyResponse.text();
    assert.equal(emptyResponse.status, 200);
    assert.match(emptyHtml, /Nie znaleźliśmy pasujących ofert/);
  });
});

test("sitemap uses per-product lastmod and omits unreliable global hints", async () => {
  await withServer(async (origin, data) => {
    const response = await fetch(`${origin}/sitemap.xml`);
    const xml = await response.text();

    assert.equal(response.status, 200);
    assert.doesNotMatch(xml, /<changefreq>|<priority>/);
    assert.match(xml, new RegExp(`<loc>https://bookloft\\.pl/product/${data.products[0].id}/[^<]+<\\/loc>\\s+<lastmod>2026-07-14<\\/lastmod>`));
    const homeEntry = xml.match(/<url>\s*<loc>https:\/\/bookloft\.pl\/<\/loc>([\s\S]*?)<\/url>/)?.[1] || "";
    assert.doesNotMatch(homeEntry, /<lastmod>/);
  });
});
