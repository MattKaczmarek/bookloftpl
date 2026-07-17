import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { StoreCache } from "../src/services/storeCache.js";

function listing(id, name) {
  return {
    id: String(id),
    name,
    sellingMode: { price: { amount: "29.00", currency: "PLN" } },
    stock: { available: 1 },
    primaryImage: { url: `https://a.allegroimg.com/original/${id}.jpg` },
    category: { id: "fantasy" },
    external: { id: `SKU-${id}` },
    publication: { status: "ACTIVE", startingAt: "2026-07-01T08:00:00.000Z" }
  };
}

function cachedOffer(id, name) {
  return {
    id: String(id),
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    sku: `SKU-${id}`,
    name,
    searchText: name.toLowerCase(),
    price: 29,
    currency: "PLN",
    categoryId: "fantasy",
    images: [`https://a.allegroimg.com/original/${id}.jpg`],
    stock: 1,
    stockByWarehouse: {},
    allegroUrl: `https://allegro.pl/oferta/${id}`,
    source: "allegro",
    publicationStatus: "ACTIVE",
    sourceAddedAt: "2026-07-01T08:00:00.000Z",
    sourceUpdatedAt: "2026-07-10T08:00:00.000Z",
    contentUpdatedAt: "2026-07-10T08:00:00.000Z",
    addedAt: "2026-07-01T08:00:00.000Z",
    descriptionHtml: "<p><b>Stan: DOBRY</b></p>",
    descriptionFetchedAt: "2026-07-10T08:00:00.000Z",
    features: [{ name: "Stan", value: "Używany" }]
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

test("removed offers retain a lightweight snapshot and clear it after reactivation", async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "bookloft-cache-test-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const cache = new StoreCache({
    version: "1.15.0",
    dataDir,
    allegroMarketplaceId: "allegro-pl",
    allegroSellingFormats: ["BUY_NOW"]
  });
  await cache.init();

  await writeJson(cache.files.published, {
    version: 2,
    activeOfferIds: ["1", "2"],
    addedAtByOfferId: {
      "1": "2026-07-01T08:00:00.000Z",
      "2": "2026-07-01T08:00:00.000Z"
    },
    removedByUnavailable: {}
  });
  await writeJson(cache.files.catalog, {
    version: "1.14.5",
    updatedAt: "2026-07-10T08:00:00.000Z",
    context: { source: "Allegro", currency: "PLN" },
    categories: [{ category_id: "fantasy", name: "Fantasy", parent_id: "" }],
    offers: {
      "1": cachedOffer(1, "Achaja Tomy 1-3 / Andrzej Ziemiański"),
      "2": cachedOffer(2, "Achaja Tom 1 / Andrzej Ziemiański")
    }
  });
  await cache.rebuildStorefront();
  cache.fetchCategoriesForOffers = async (_offers, previousCategories) => previousCategories;

  await cache.refreshAvailabilityLocked("test", { "2": listing(2, "Achaja Tom 1 / Andrzej Ziemiański") });

  const removed = JSON.parse(await readFile(cache.files.published, "utf8"));
  assert.equal(removed.version, 3);
  assert.equal(typeof removed.removedByUnavailable["1"], "string");
  assert.equal(removed.removedOfferSnapshots["1"].name, "Achaja Tomy 1-3 / Andrzej Ziemiański");
  assert.equal(removed.removedOfferSnapshots["1"].categoryName, "Fantasy");
  assert.equal(removed.removedOfferSnapshots["1"].image, "https://a.allegroimg.com/original/1.jpg");

  const pageData = await cache.getMissingProductPageData("1", "achaja-tomy-1-3");
  assert.equal(pageData.status, 410);
  assert.equal(pageData.searchQuery, "Achaja Tomy");
  assert.deepEqual(pageData.alternatives.map((item) => item.id), ["2"]);

  cache.fetchActiveOfferMap = async () => ({
    "1": listing(1, "Achaja Tomy 1-3 / Andrzej Ziemiański"),
    "2": listing(2, "Achaja Tom 1 / Andrzej Ziemiański")
  });
  await cache.addNewProducts();

  const reactivated = JSON.parse(await readFile(cache.files.published, "utf8"));
  assert.equal(reactivated.removedByUnavailable["1"], undefined);
  assert.equal(reactivated.removedOfferSnapshots["1"], undefined);
  assert.equal(await cache.getMissingProductStatus("1"), 404);
});

test("offer hydration merges offer and Allegro product parameters", async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "bookloft-cache-test-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const cache = new StoreCache({
    version: "1.15.0",
    dataDir,
    allegroMarketplaceId: "allegro-pl",
    allegroSellingFormats: ["BUY_NOW"]
  });
  await cache.init();

  await writeJson(cache.files.published, {
    version: 3,
    activeOfferIds: ["1"],
    addedAtByOfferId: { "1": "2026-07-01T08:00:00.000Z" },
    removedByUnavailable: {},
    removedOfferSnapshots: {}
  });
  await writeJson(cache.files.catalog, {
    version: "1.14.5",
    updatedAt: "2026-07-10T08:00:00.000Z",
    context: { source: "Allegro", currency: "PLN" },
    categories: [{ category_id: "fantasy", name: "Fantasy", parent_id: "" }],
    offers: { "1": cachedOffer(1, "Achaja Tom 1 / Andrzej Ziemiański") }
  });
  await cache.rebuildStorefront();

  let detailRequests = 0;
  cache.withAccessToken = async (run) => run("test-token");
  cache.allegroClient.getOfferDetails = async () => {
    detailRequests += 1;
    return {
      name: "Achaja Tom 1 / Andrzej Ziemiański",
      description: { sections: [] },
      parameters: [{ name: "Stan", values: ["Używany"] }],
      productSet: [{
        product: {
          parameters: [
            { name: "Wydawnictwo", values: ["Fabryka Słów"] },
            { name: "Autor", values: ["Andrzej Ziemiański"] },
            { name: "Stan", values: ["Nowy"] }
          ]
        }
      }],
      sellingMode: { price: { amount: "29.00", currency: "PLN" } },
      stock: { available: 1 },
      category: { id: "fantasy" }
    };
  };

  const hydrated = await cache.getProduct("1");
  assert.equal(detailRequests, 1);
  assert.equal(hydrated.detailSchemaVersion, 2);
  assert.deepEqual(hydrated.features, [
    { name: "Wydawnictwo", value: "Fabryka Słów" },
    { name: "Autor", value: "Andrzej Ziemiański" },
    { name: "Stan", value: "Używany" }
  ]);

  await cache.getProduct("1");
  assert.equal(detailRequests, 1);
});

test("active product recommendations prefer matching titles and authors", async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "bookloft-cache-test-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const cache = new StoreCache({
    version: "1.16.0",
    dataDir,
    allegroMarketplaceId: "allegro-pl",
    allegroSellingFormats: ["BUY_NOW"]
  });
  await cache.init();

  const offer = (id, name, categoryId, author, addedAt) => ({
    ...cachedOffer(id, name),
    categoryId,
    addedAt,
    sourceAddedAt: addedAt,
    detailSchemaVersion: 2,
    features: [
      { name: "Autor", value: author },
      { name: "Wydawnictwo", value: "Fabryka Słów" },
      { name: "Stan", value: "Używany" }
    ]
  });
  const offers = {
    "1": offer(1, "Achaja Tom 1 / Andrzej Ziemiański", "fantasy", "Andrzej Ziemiański", "2026-07-01T08:00:00.000Z"),
    "2": offer(2, "Achaja Tom 2 / Andrzej Ziemiański", "fantasy", "Andrzej Ziemiański", "2026-07-02T08:00:00.000Z"),
    "3": offer(3, "Pomnik Cesarzowej Achai / Andrzej Ziemiański", "fantasy", "Andrzej Ziemiański", "2026-07-03T08:00:00.000Z"),
    "4": offer(4, "Zupełnie inna opowieść", "fantasy", "Inny Autor", "2026-07-16T08:00:00.000Z"),
    "5": offer(5, "Achaja wydanie specjalne / Andrzej Ziemiański", "crime", "Andrzej Ziemiański", "2026-07-04T08:00:00.000Z")
  };

  await writeJson(cache.files.published, {
    version: 3,
    activeOfferIds: Object.keys(offers),
    addedAtByOfferId: {},
    removedByUnavailable: {},
    removedOfferSnapshots: {}
  });
  await writeJson(cache.files.catalog, {
    version: "1.16.0",
    updatedAt: "2026-07-16T08:00:00.000Z",
    context: { source: "Allegro", currency: "PLN" },
    categories: [
      { category_id: "fantasy", name: "Fantasy", parent_id: "" },
      { category_id: "crime", name: "Kryminał", parent_id: "" }
    ],
    offers
  });
  await cache.rebuildStorefront();

  const product = await cache.getProduct("1");
  assert.deepEqual(product.related.slice(0, 3).map((item) => item.id), ["2", "3", "5"]);
  assert.equal(product.related[3].id, "4");
});

test("availability refresh rejects a suspicious mass drop", async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "bookloft-cache-test-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const cache = new StoreCache({
    version: "1.15.0",
    dataDir,
    allegroMarketplaceId: "allegro-pl",
    allegroSellingFormats: ["BUY_NOW"]
  });
  await cache.init();

  const activeOfferIds = Array.from({ length: 20 }, (_item, index) => String(index + 1));
  await writeJson(cache.files.published, {
    version: 3,
    activeOfferIds,
    addedAtByOfferId: {},
    removedByUnavailable: {},
    removedOfferSnapshots: {}
  });

  await assert.rejects(
    cache.refreshAvailabilityLocked("test", {}),
    /Przerwano odswiezanie ofert/
  );
  const published = JSON.parse(await readFile(cache.files.published, "utf8"));
  assert.deepEqual(published.activeOfferIds, activeOfferIds);
  assert.deepEqual(published.removedByUnavailable, {});
});

test("bulk detail enrichment preserves listing identity and failed cache entries", async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "bookloft-cache-test-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const cache = new StoreCache({
    version: "1.15.0",
    dataDir,
    allegroMarketplaceId: "allegro-pl",
    allegroSellingFormats: ["BUY_NOW"]
  });
  await cache.init();

  const first = cachedOffer(1, "Pierwsza książka");
  const second = cachedOffer(2, "Druga książka");
  await writeJson(cache.files.published, {
    version: 3,
    activeOfferIds: ["1", "2"],
    addedAtByOfferId: {},
    removedByUnavailable: {},
    removedOfferSnapshots: {}
  });
  await writeJson(cache.files.catalog, {
    version: "1.14.5",
    updatedAt: "2026-07-10T08:00:00.000Z",
    context: { source: "Allegro", currency: "PLN" },
    categories: [{ category_id: "fantasy", name: "Fantasy", parent_id: "" }],
    offers: { "1": first, "2": second }
  });
  await cache.rebuildStorefront();

  cache.getAccessToken = async () => "test-token";
  cache.allegroClient.getOfferDetails = async (offerId) => {
    if (String(offerId) === "2") {
      const error = new Error("Allegro API HTTP 500");
      error.status = 500;
      throw error;
    }
    return {
      name: "Nazwa, której wzbogacenie nie powinno przejąć",
      description: { sections: [{ items: [{ type: "TEXT", content: "<p>Pełny opis</p>" }] }] },
      images: [{ url: "https://a.allegroimg.com/original/detail-1.jpg" }],
      parameters: [{ name: "Stan", values: ["Używany"] }],
      productSet: [{ product: { parameters: [{ name: "Wydawnictwo", values: ["Bellona"] }] } }],
      sellingMode: { price: { amount: "999.00", currency: "EUR" } },
      stock: { available: 0 },
      category: { id: "different" },
      publication: { status: "ENDED" }
    };
  };

  const result = await cache.enrichActiveOfferDetails();
  assert.equal(result.totalCount, 2);
  assert.equal(result.successCount, 1);
  assert.equal(result.failedCount, 1);
  assert.deepEqual(result.failedOfferIds, ["2"]);

  const catalog = JSON.parse(await readFile(cache.files.catalog, "utf8"));
  assert.equal(catalog.offers["1"].name, first.name);
  assert.equal(catalog.offers["1"].price, first.price);
  assert.equal(catalog.offers["1"].currency, first.currency);
  assert.equal(catalog.offers["1"].stock, first.stock);
  assert.equal(catalog.offers["1"].categoryId, first.categoryId);
  assert.equal(catalog.offers["1"].publicationStatus, first.publicationStatus);
  assert.equal(catalog.offers["1"].detailSchemaVersion, 2);
  assert.deepEqual(catalog.offers["1"].features, [
    { name: "Wydawnictwo", value: "Bellona" },
    { name: "Stan", value: "Używany" }
  ]);
  assert.deepEqual(catalog.offers["2"], second);

  const storefront = JSON.parse(await readFile(cache.files.storefront, "utf8"));
  assert.equal(storefront.products.length, 2);
  assert.deepEqual(storefront.products.map((product) => product.id).sort(), ["1", "2"]);
});
