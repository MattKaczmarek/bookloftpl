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
      searchQuery: "Achaja Tomy",
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

test("active product metadata stays unchanged and schema prefers Allegro publisher for brand", async () => {
  await withServer(async (origin, data) => {
    const response = await fetch(`${origin}/product/${data.products[0].id}/${data.products[0].slug}`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /<title>Książka 1 \| BookLoft<\/title>/);
    assert.match(html, /Książka 1\. Stan: DOBRY\. Fantasy w BookLoft z realnymi zdjęciami, rzetelnym opisem i zakupem przez Allegro\./);
    assert.match(html, /"brand":\{"@type":"Brand","name":"BookLoft"\}/);
    assert.doesNotMatch(html, /MerchantReturnPolicy|ShippingService|hasMerchantReturnPolicy/);

    data.products[0].features.push(
      { name: "Wydawnictwo", value: "Fabryka Słów" },
      { name: "Liczba stron", value: "432" }
    );
    const publisherResponse = await fetch(`${origin}/product/${data.products[0].id}/${data.products[0].slug}`);
    const publisherHtml = await publisherResponse.text();
    assert.match(publisherHtml, /"brand":\{"@type":"Brand","name":"Fabryka Słów"\}/);
    assert.doesNotMatch(publisherHtml, /"brand":\{"@type":"Brand","name":"BookLoft"\}/);
    assert.doesNotMatch(publisherHtml, /<dt>Liczba stron<\/dt>/);
    assert.match(publisherHtml, /"name":"Liczba stron","value":"432"/);
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
    assert.match(html, /value="Achaja Tomy"/);
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
    assert.doesNotMatch(emptyHtml, /empty-mark/);
    assert.match(emptyHtml, /<div class="sort-box" hidden>/);
    assert.match(emptyHtml, /<div class="sort-box mobile-sort-box" hidden>/);
    assert.match(emptyHtml, /<h2 id="empty-suggestions-title">Najnowsze oferty<\/h2>/);
    assert.equal((emptyHtml.match(/class="related-card"/g) || []).length, 4);
  });
});

test("catalog search tolerates missing accents, word order and a small typo", async () => {
  await withServer(async (origin, data) => {
    data.products[0].name = "Harry Potter i Kamień Filozoficzny";
    data.products[0].searchText = "Harry Potter i Kamień Filozoficzny J.K. Rowling";
    data.products[1].name = "Achaja / Andrzej Ziemiański";
    data.products[1].searchText = "Achaja / Andrzej Ziemiański";

    const typoResponse = await fetch(`${origin}/?q=harry%20poter`);
    const typoHtml = await typoResponse.text();
    assert.equal(typoResponse.status, 200);
    assert.match(typoHtml, /Harry Potter i Kamień Filozoficzny/);
    assert.doesNotMatch(typoHtml, /Nie znaleźliśmy pasujących ofert/);

    const reorderedResponse = await fetch(`${origin}/?q=ziemianski%20achaja`);
    const reorderedHtml = await reorderedResponse.text();
    assert.equal(reorderedResponse.status, 200);
    assert.match(reorderedHtml, /Achaja \/ Andrzej Ziemiański/);
    assert.doesNotMatch(reorderedHtml, /Nie znaleźliśmy pasujących ofert/);
  });
});

test("search results use a small search label and one concise heading", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/?q=Książka`);
    const html = await response.text();
    const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] || "";

    assert.equal(response.status, 200);
    assert.match(body, /<p class="eyebrow">Wyszukiwanie<\/p>/);
    assert.match(body, /<h1>Oferty dla „książka”<\/h1>/);
    assert.doesNotMatch(body, /Wyniki wyszukiwania w BookLoft/);
    assert.doesNotMatch(body, /Wyniki: książka/);
    assert.match(body, /<h2 class="listing-title" id="listing-title"><\/h2>/);
  });
});

test("category pages show the current offer count and useful category links", async () => {
  await withServer(async (origin, data) => {
    data.categories.push({
      id: "crime",
      name: "Kryminał",
      displayName: "Kryminał",
      productCount: 7,
      totalProductCount: 7,
      children: []
    });
    const response = await fetch(`${origin}/kategoria/fantasy/fantasy`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, />51 ofert z realnymi zdjęciami konkretnych egzemplarzy i opisem ich stanu\.<\/p>/);
    assert.doesNotMatch(html, /Fantasy: 51 ofert/);
    assert.match(html, /<nav class="related-category-links" aria-label="Powiązane kategorie">/);
    assert.match(html, /href="\/kategoria\/crime\/kryminal">Kryminał <small>7 ofert<\/small><\/a>/);
  });
});

test("sitemap uses per-product lastmod and omits unreliable global hints", async () => {
  await withServer(async (origin, data) => {
    data.products[1].descriptionFetchedAt = "2026-07-17T12:00:00.000Z";
    const response = await fetch(`${origin}/sitemap.xml`);
    const xml = await response.text();

    assert.equal(response.status, 200);
    assert.doesNotMatch(xml, /<changefreq>|<priority>/);
    assert.match(xml, new RegExp(`<loc>https://bookloft\\.pl/product/${data.products[0].id}/[^<]+<\\/loc>\\s+<lastmod>2026-07-14<\\/lastmod>`));
    assert.match(xml, new RegExp(`<loc>https://bookloft\\.pl/product/${data.products[1].id}/[^<]+<\\/loc>\\s+<lastmod>2026-07-03<\\/lastmod>`));
    const homeEntry = xml.match(/<url>\s*<loc>https:\/\/bookloft\.pl\/<\/loc>([\s\S]*?)<\/url>/)?.[1] || "";
    assert.doesNotMatch(homeEntry, /<lastmod>/);
  });
});
