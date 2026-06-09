import crypto from "node:crypto";
import path from "node:path";
import { AllegroClient } from "../lib/allegroClient.js";
import { normalizeDescriptionHtml, richTextToHtml, stripHtml } from "../lib/html.js";
import { ensureDir, readJson, writeJson } from "../lib/jsonStore.js";

const AUTH_FILE = "allegro-auth.json";
const PUBLISHED_FILE = "published-offers.json";
const CATALOG_FILE = "allegro-offers-cache.json";
const STOREFRONT_FILE = "storefront-cache.json";
const META_FILE = "cache-meta.json";
const AUTH_STATE_TTL_MS = 15 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function emptyAuth() {
  return {
    token: null,
    pendingStates: {}
  };
}

function emptyPublished() {
  return {
    version: 2,
    activeOfferIds: [],
    addedAtByOfferId: {},
    removedByUnavailable: {}
  };
}

function emptyCatalog(version) {
  return {
    version,
    updatedAt: null,
    context: null,
    categories: [],
    offers: {}
  };
}

function emptyStorefront(version) {
  return {
    version,
    updatedAt: null,
    stockUpdatedAt: null,
    catalogUpdatedAt: null,
    products: [],
    categories: [],
    meta: {
      productCount: 0,
      categoryCount: 0,
      hiddenByStockCount: 0,
      currency: "PLN",
      source: "Allegro"
    }
  };
}

function emptyMeta(version) {
  return {
    version,
    lastStockRefreshAt: null,
    lastCatalogRefreshAt: null,
    lastAddNewAt: null,
    lastOAuthAt: null,
    lastErrorAt: null,
    lastError: null,
    runningAction: null
  };
}

export class StoreCache {
  constructor(config) {
    this.config = config;
    this.allegroClient = new AllegroClient(config);
    this.files = {
      auth: path.join(config.dataDir, AUTH_FILE),
      published: path.join(config.dataDir, PUBLISHED_FILE),
      catalog: path.join(config.dataDir, CATALOG_FILE),
      storefront: path.join(config.dataDir, STOREFRONT_FILE),
      meta: path.join(config.dataDir, META_FILE)
    };
    this.queue = Promise.resolve();
  }

  async init() {
    await ensureDir(this.config.dataDir);
    await this.ensureFile(this.files.auth, emptyAuth());
    await this.ensureFile(this.files.published, emptyPublished());
    await this.ensureFile(this.files.catalog, emptyCatalog(this.config.version));
    await this.ensureFile(this.files.storefront, emptyStorefront(this.config.version));
    await this.ensureFile(this.files.meta, emptyMeta(this.config.version));
    await this.clearExpectedDisconnectedState();
    await this.rebuildStorefront();
  }

  schedule() {
    setInterval(() => {
      this.refreshStock("schedule").catch((error) => this.rememberScheduledError(error));
    }, this.config.stockRefreshMs).unref();

    setInterval(() => {
      this.refreshCatalog("schedule").catch((error) => this.rememberScheduledError(error));
    }, this.config.catalogRefreshMs).unref();

    setTimeout(() => {
      this.refreshStock("startup").catch((error) => this.rememberScheduledError(error));
    }, 2500).unref();
  }

  async getStorefront() {
    return readJson(this.files.storefront, emptyStorefront(this.config.version));
  }

  async getStorefrontList() {
    const storefront = await this.getStorefront();
    return {
      ...storefront,
      products: storefront.products.map(toListProduct)
    };
  }

  async getNewestProducts(limit = 50) {
    const [storefront, published] = await Promise.all([this.getStorefront(), this.readPublished()]);
    const addedAtByOfferId = published.addedAtByOfferId || {};

    return storefront.products
      .map((product) => ({
        ...product,
        addedAt: addedAtByOfferId[String(product.id)] || product.addedAt || null
      }))
      .sort((a, b) => {
        const dateDiff = productFreshnessTime(b) - productFreshnessTime(a);
        if (dateDiff) return dateDiff;
        return sortIdsDesc(a.id, b.id);
      })
      .slice(0, Math.max(1, Math.min(Number(limit) || 50, 50)))
      .map(toListProduct);
  }

  async getProduct(productId) {
    let storefront = await this.getStorefront();
    let product = storefront.products.find((item) => String(item.id) === String(productId));
    if (!product) return null;

    if (!product.descriptionFetchedAt) {
      await this.hydrateOfferDetail(product.id).catch((error) => this.rememberError(error));
      storefront = await this.getStorefront();
      product = storefront.products.find((item) => String(item.id) === String(productId)) || product;
    }

    const related = storefront.products
      .filter((item) => item.id !== product.id && item.categoryId && item.categoryId === product.categoryId)
      .slice(0, 8)
      .map(toListProduct);
    return {
      ...product,
      related
    };
  }

  async getMissingProductStatus(productId) {
    const published = await this.readPublished();
    return published.removedByUnavailable?.[String(productId)] ? 410 : 404;
  }

  async getStatus() {
    const [published, storefront, meta, catalog, auth] = await Promise.all([
      this.readPublished(),
      this.getStorefront(),
      this.readMeta(),
      this.readCatalog(),
      this.readAuth()
    ]);

    return {
      version: this.config.version,
      activeProductCount: published.activeOfferIds.length,
      visibleProductCount: storefront.products.length,
      visibleCategoryCount: storefront.meta.categoryCount,
      hiddenByStockCount: storefront.meta.hiddenByStockCount,
      stockUpdatedAt: catalog.updatedAt,
      catalogUpdatedAt: catalog.updatedAt,
      storefrontUpdatedAt: storefront.updatedAt,
      context: catalog.context || this.publicContext(auth),
      allegro: this.publicAllegroStatus(auth),
      lastError: meta.lastError,
      lastErrorAt: meta.lastErrorAt,
      runningAction: meta.runningAction
    };
  }

  async createAllegroConnectUrl() {
    const auth = await this.readAuth();
    const state = crypto.randomUUID();
    auth.pendingStates = cleanPendingStates(auth.pendingStates || {});
    auth.pendingStates[state] = { createdAt: Date.now() };
    await writeJson(this.files.auth, auth);
    return this.allegroClient.createAuthorizationUrl(state);
  }

  async handleAllegroCallback({ code, state }) {
    if (!code || !state) {
      throw new Error("Brak kodu lub state z Allegro OAuth");
    }
    const auth = await this.readAuth();
    auth.pendingStates = cleanPendingStates(auth.pendingStates || {});
    if (!auth.pendingStates[state]) {
      throw new Error("Nieprawidłowy albo wygasły state Allegro OAuth");
    }

    const token = await this.allegroClient.exchangeCode(code);
    auth.token = normalizeToken(token);
    delete auth.pendingStates[state];
    await writeJson(this.files.auth, auth);

    const meta = await this.readMeta();
    meta.lastOAuthAt = nowIso();
    meta.lastError = null;
    meta.lastErrorAt = null;
    await writeJson(this.files.meta, meta);

    return this.publicAllegroStatus(auth);
  }

  async addNewProducts() {
    return this.runExclusive("add-new-offers", async () => {
      await this.markRunning("add-new-offers");
      const startedAt = nowIso();

      try {
        const listingMap = await this.fetchActiveOfferMap();
        const published = await this.readPublished();
        const previousActive = new Set(published.activeOfferIds.map(String));
        const nextActive = new Set();
        const addedIds = [];

        for (const offerId of Object.keys(listingMap)) {
          nextActive.add(offerId);
          if (!previousActive.has(offerId)) {
            addedIds.push(offerId);
            published.addedAtByOfferId[offerId] = startedAt;
          }
          delete published.removedByUnavailable[offerId];
        }

        for (const offerId of previousActive) {
          if (!nextActive.has(offerId)) {
            published.removedByUnavailable[offerId] = startedAt;
          }
        }

        published.activeOfferIds = [...nextActive].sort(sortIds);
        await writeJson(this.files.published, published);
        await this.refreshOfferCacheLocked("add-new-offers", listingMap);

        const meta = await this.readMeta();
        meta.lastAddNewAt = startedAt;
        meta.lastStockRefreshAt = startedAt;
        meta.lastError = null;
        meta.lastErrorAt = null;
        await writeJson(this.files.meta, meta);

        return {
          addedCount: addedIds.length,
          addedOfferIds: addedIds,
          availableOfferCount: Object.keys(listingMap).length,
          activeProductCount: published.activeOfferIds.length
        };
      } catch (error) {
        await this.rememberError(error);
        throw error;
      } finally {
        await this.clearRunning();
      }
    });
  }

  async refreshStock(reason = "manual") {
    return this.runExclusive(`refresh-stock:${reason}`, async () => {
      await this.markRunning("refresh-stock");
      try {
        const listingMap = await this.fetchActiveOfferMap();
        await this.refreshAvailabilityLocked(reason, listingMap);
      } catch (error) {
        await this.rememberActionError(error, reason);
        throw error;
      } finally {
        await this.clearRunning();
      }
    });
  }

  async refreshCatalog(reason = "manual") {
    return this.runExclusive(`refresh-catalog:${reason}`, async () => {
      await this.markRunning("refresh-catalog");
      try {
        const listingMap = await this.fetchActiveOfferMap();
        await this.refreshAvailabilityLocked(reason, listingMap);
      } catch (error) {
        await this.rememberActionError(error, reason);
        throw error;
      } finally {
        await this.clearRunning();
      }
    });
  }

  async refreshAvailabilityLocked(_reason, listingMap) {
    const timestamp = nowIso();
    const published = await this.readPublished();
    const nextActiveIds = [];

    for (const offerId of published.activeOfferIds.map(String)) {
      if (listingMap[offerId]) {
        nextActiveIds.push(offerId);
        delete published.removedByUnavailable[offerId];
      } else {
        published.removedByUnavailable[offerId] = timestamp;
      }
    }

    published.activeOfferIds = nextActiveIds.sort(sortIds);
    await writeJson(this.files.published, published);
    await this.refreshOfferCacheLocked("refresh-availability", listingMap);

    const meta = await this.readMeta();
    meta.lastStockRefreshAt = timestamp;
    meta.lastCatalogRefreshAt = timestamp;
    meta.lastError = null;
    meta.lastErrorAt = null;
    await writeJson(this.files.meta, meta);
  }

  async refreshOfferCacheLocked(_reason, listingMap) {
    const [published, previousCatalog] = await Promise.all([this.readPublished(), this.readCatalog()]);
    const activeIds = published.activeOfferIds.map(String).filter((offerId) => listingMap[offerId]);
    const offers = {};

    for (const offerId of activeIds) {
      offers[offerId] = normalizeOfferFromListing(listingMap[offerId], previousCatalog.offers?.[offerId]);
    }

    const categories = await this.fetchCategoriesForOffers(Object.values(offers), previousCatalog.categories || []);
    const catalog = {
      version: this.config.version,
      updatedAt: nowIso(),
      context: this.publicContext(await this.readAuth()),
      categories,
      offers
    };

    await writeJson(this.files.catalog, catalog);
    await this.rebuildStorefront(catalog.context);
  }

  async hydrateOfferDetail(offerId) {
    const catalog = await this.readCatalog();
    const existing = catalog.offers?.[String(offerId)];
    if (!existing) return null;

    const detail = await this.withAccessToken((accessToken) => this.allegroClient.getOfferDetails(offerId, accessToken));
    catalog.offers[String(offerId)] = mergeOfferDetail(existing, detail);
    catalog.updatedAt = nowIso();
    await writeJson(this.files.catalog, catalog);
    await this.rebuildStorefront(catalog.context);
    return catalog.offers[String(offerId)];
  }

  async rebuildStorefront(contextOverride = null) {
    const [published, catalog] = await Promise.all([this.readPublished(), this.readCatalog()]);
    const context = contextOverride || catalog.context || { source: "Allegro", currency: "PLN" };
    const activeSet = new Set(published.activeOfferIds.map(String));
    const visibleProducts = [];

    for (const offerId of activeSet) {
      const offer = catalog.offers[String(offerId)];
      if (!offer || Number(offer.stock || 0) <= 0) continue;
      const descriptionHtml = normalizeDescriptionHtml(offer.descriptionHtml);
      visibleProducts.push({
        ...offer,
        addedAt: published.addedAtByOfferId[String(offerId)] || offer.addedAt || null,
        slug: slugify(offer.name),
        descriptionHtml,
        searchText: productSearchText(offer, descriptionHtml),
        categoryPath: getCategoryPath(catalog.categories, offer.categoryId)
      });
    }

    visibleProducts.sort((a, b) => a.name.localeCompare(b.name, "pl-PL"));

    const categories = buildCategoryTree(catalog.categories, visibleProducts);
    const storefront = {
      version: this.config.version,
      updatedAt: nowIso(),
      stockUpdatedAt: catalog.updatedAt,
      catalogUpdatedAt: catalog.updatedAt,
      products: visibleProducts,
      categories,
      meta: {
        productCount: visibleProducts.length,
        categoryCount: countCategories(categories),
        hiddenByStockCount: Object.keys(published.removedByUnavailable || {}).length,
        currency: context.currency || "PLN",
        source: "Allegro"
      }
    };

    await writeJson(this.files.storefront, storefront);
    return storefront;
  }

  async fetchActiveOfferMap() {
    const offers = await this.withAccessToken((accessToken) => this.allegroClient.getActiveOffers(accessToken));
    return Object.fromEntries(
      offers
        .filter((offer) => Number(offer?.stock?.available || 0) > 0)
        .map((offer) => [String(offer.id), offer])
    );
  }

  async fetchCategoriesForOffers(offers, previousCategories) {
    const categoriesById = new Map();
    for (const category of previousCategories || []) {
      if (category?.category_id) categoriesById.set(String(category.category_id), category);
    }

    const categoryIds = [...new Set(offers.map((offer) => offer.categoryId).filter(Boolean))];
    if (!categoryIds.length) return [];

    await this.withAccessToken(async (accessToken) => {
      for (const categoryId of categoryIds) {
        await this.ensureCategory(categoryId, categoriesById, accessToken);
      }
    });

    return [...categoriesById.values()];
  }

  async ensureCategory(categoryId, categoriesById, accessToken) {
    const id = String(categoryId || "");
    if (!id || categoriesById.has(id)) return;

    try {
      const data = await this.allegroClient.getCategory(id, accessToken);
      const category = {
        category_id: String(data.id || id),
        name: data.name || `Kategoria ${id}`,
        parent_id: data.parent?.id ? String(data.parent.id) : ""
      };
      categoriesById.set(category.category_id, category);
      if (category.parent_id) {
        await this.ensureCategory(category.parent_id, categoriesById, accessToken);
      }
    } catch {
      categoriesById.set(id, {
        category_id: id,
        name: `Kategoria ${id}`,
        parent_id: ""
      });
    }
  }

  async withAccessToken(fn) {
    let token = await this.getAccessToken();
    try {
      return await fn(token);
    } catch (error) {
      if (error?.status !== 401) throw error;
      token = await this.refreshAccessToken();
      return fn(token);
    }
  }

  async getAccessToken() {
    const auth = await this.readAuth();
    if (!auth.token?.access_token) {
      throw new Error("Allegro nie jest połączone. Użyj przycisku 'Połącz Allegro' w panelu.");
    }
    if (Number(auth.token.expires_at || 0) > Date.now() + 60_000) {
      return auth.token.access_token;
    }
    return this.refreshAccessToken(auth);
  }

  async refreshAccessToken(existingAuth = null) {
    const auth = existingAuth || await this.readAuth();
    if (!auth.token?.refresh_token) {
      throw new Error("Brak refresh tokena Allegro. Połącz konto Allegro ponownie.");
    }
    const token = await this.allegroClient.refreshToken(auth.token.refresh_token);
    auth.token = normalizeToken(token, auth.token.refresh_token);
    await writeJson(this.files.auth, auth);
    return auth.token.access_token;
  }

  publicContext(auth) {
    return {
      source: "Allegro",
      marketplaceId: this.config.allegroMarketplaceId,
      connected: Boolean(auth?.token?.refresh_token || auth?.token?.access_token),
      connectedAt: auth?.token?.created_at || null,
      expiresAt: auth?.token?.expires_at ? new Date(auth.token.expires_at).toISOString() : null
    };
  }

  publicAllegroStatus(auth) {
    return {
      configured: this.allegroClient.isConfigured(),
      connected: Boolean(auth?.token?.refresh_token || auth?.token?.access_token),
      connectedAt: auth?.token?.created_at || null,
      expiresAt: auth?.token?.expires_at ? new Date(auth.token.expires_at).toISOString() : null
    };
  }

  async ensureFile(filePath, fallback) {
    const existing = await readJson(filePath, null);
    if (!existing) await writeJson(filePath, fallback);
  }

  async readAuth() {
    const auth = await readJson(this.files.auth, emptyAuth());
    auth.pendingStates = cleanPendingStates(auth.pendingStates || {});
    return auth;
  }

  async readPublished() {
    const published = await readJson(this.files.published, emptyPublished());
    published.activeOfferIds = [...new Set((published.activeOfferIds || []).map(String))].sort(sortIds);
    published.addedAtByOfferId = published.addedAtByOfferId || {};
    published.removedByUnavailable = published.removedByUnavailable || {};
    return published;
  }

  async readCatalog() {
    return readJson(this.files.catalog, emptyCatalog(this.config.version));
  }

  async readMeta() {
    return readJson(this.files.meta, emptyMeta(this.config.version));
  }

  async markRunning(action) {
    const meta = await this.readMeta();
    meta.runningAction = action;
    await writeJson(this.files.meta, meta);
  }

  async clearRunning() {
    const meta = await this.readMeta();
    meta.runningAction = null;
    await writeJson(this.files.meta, meta);
  }

  async clearExpectedDisconnectedState() {
    const meta = await this.readMeta();
    if (!meta.lastError || !isMissingAllegroAuthError(meta.lastError)) return;
    meta.lastError = null;
    meta.lastErrorAt = null;
    await writeJson(this.files.meta, meta);
  }

  async rememberError(error) {
    const meta = await this.readMeta();
    meta.lastErrorAt = nowIso();
    meta.lastError = error.message || String(error);
    await writeJson(this.files.meta, meta);
  }

  async rememberScheduledError(error) {
    if (isMissingAllegroAuthError(error)) return;
    await this.rememberError(error);
  }

  async rememberActionError(error, reason) {
    if (isAutomaticReason(reason) && isMissingAllegroAuthError(error)) return;
    await this.rememberError(error);
  }

  async runExclusive(_name, fn) {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }
}

function isMissingAllegroAuthError(error) {
  const message = String(error?.message || error || "");
  return message.includes("Allegro nie jest połączone") ||
    message.includes("Allegro nie jest polaczone") ||
    message.includes("Brak refresh tokena Allegro");
}

function isAutomaticReason(reason) {
  return reason === "schedule" || reason === "startup";
}

function normalizeToken(token, fallbackRefreshToken = "") {
  const expiresIn = Number(token.expires_in || 0);
  return {
    access_token: token.access_token || "",
    refresh_token: token.refresh_token || fallbackRefreshToken || "",
    token_type: token.token_type || "Bearer",
    scope: token.scope || "",
    created_at: nowIso(),
    expires_at: Date.now() + Math.max(60, expiresIn - 60) * 1000
  };
}

function cleanPendingStates(states) {
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(states || {}).filter(([, value]) => now - Number(value?.createdAt || 0) < AUTH_STATE_TTL_MS)
  );
}

function normalizeOfferFromListing(offer, existing = {}) {
  const name = String(offer.name || existing.name || `Oferta ${offer.id}`).trim();
  const price = parsePrice(offer.sellingMode?.price || existing);
  const currency = offer.sellingMode?.price?.currency || existing.currency || "PLN";
  const stock = Number(offer.stock?.available ?? existing.stock ?? 0);
  const primaryImage = offer.primaryImage?.url || existing.images?.[0] || "";
  const images = primaryImage ? [primaryImage, ...(existing.images || []).filter((src) => src !== primaryImage)] : existing.images || [];
  const categoryId = offer.category?.id ? String(offer.category.id) : existing.categoryId || "";
  const sku = offer.external?.id || existing.sku || "";
  const descriptionHtml = normalizeDescriptionHtml(existing.descriptionHtml) || `<p>Oferta BookLoft dostępna na Allegro. Finalizacja zakupu oraz obsługa płatności, dostawy, zwrotu i reklamacji odbywają się w Allegro.</p>`;
  const allegroUrl = `https://allegro.pl/oferta/${encodeURIComponent(String(offer.id))}`;

  return {
    ...existing,
    id: String(offer.id),
    slug: slugify(name),
    sku,
    ean: existing.ean || "",
    name,
    searchText: productSearchText({ name, sku, features: existing.features || [] }, descriptionHtml),
    price,
    currency,
    categoryId,
    images: normalizeImages(images),
    stock,
    stockByWarehouse: {},
    allegroUrl,
    source: "allegro",
    publicationStatus: offer.publication?.status || existing.publicationStatus || "ACTIVE",
    sourceAddedAt: existing.sourceAddedAt || offer.publication?.startingAt || null,
    sourceUpdatedAt: existing.sourceUpdatedAt || null,
    addedAt: existing.addedAt || offer.publication?.startingAt || null,
    descriptionHtml,
    features: existing.features || []
  };
}

function mergeOfferDetail(existing, detail) {
  const descriptionHtml = standardizedDescriptionToHtml(detail.description) || normalizeDescriptionHtml(existing.descriptionHtml);
  const images = normalizeImages(detail.images || existing.images || []);
  const features = normalizeParameters(detail.parameters || []);
  const productParameters = normalizeProductSetParameters(detail.productSet || []);
  const mergedFeatures = features.length ? features : productParameters;
  const price = parsePrice(detail.sellingMode?.price || existing);
  const name = String(detail.name || existing.name || "").trim();

  return {
    ...existing,
    name: name || existing.name,
    slug: slugify(name || existing.name),
    descriptionHtml,
    images: images.length ? images : existing.images,
    features: mergedFeatures,
    price,
    currency: detail.sellingMode?.price?.currency || existing.currency || "PLN",
    stock: Number(detail.stock?.available ?? existing.stock ?? 0),
    categoryId: detail.category?.id ? String(detail.category.id) : existing.categoryId,
    publicationStatus: detail.publication?.status || existing.publicationStatus,
    sourceAddedAt: detail.createdAt || existing.sourceAddedAt || null,
    sourceUpdatedAt: detail.updatedAt || existing.sourceUpdatedAt || null,
    descriptionFetchedAt: nowIso(),
    searchText: productSearchText({ name: name || existing.name, sku: existing.sku || "", features: mergedFeatures }, descriptionHtml)
  };
}

function standardizedDescriptionToHtml(description) {
  const sections = Array.isArray(description?.sections) ? description.sections : [];
  const parts = [];
  for (const section of sections) {
    for (const item of section.items || []) {
      if (item.type === "TEXT" && item.content) {
        parts.push(richTextToHtml(item.content));
      }
    }
  }
  return normalizeDescriptionHtml(parts.join("\n"));
}

function productSearchText(product, descriptionHtml) {
  return stripHtml(
    `${product.name || ""} ${product.sku || ""} ${descriptionHtml || ""} ${(product.features || [])
      .map((item) => `${item.name} ${item.value}`)
      .join(" ")}`
  ).toLowerCase();
}

function normalizeParameters(parameters) {
  return parameters
    .map((parameter) => ({
      name: String(parameter.name || "").trim(),
      value: normalizeParameterValue(parameter)
    }))
    .filter((item) => item.name && item.value);
}

function normalizeProductSetParameters(productSet) {
  return productSet.flatMap((item) => normalizeParameters(item?.product?.parameters || []));
}

function normalizeParameterValue(parameter) {
  const values = [
    ...(parameter.valuesLabels || []),
    ...(parameter.values || []),
    ...(parameter.rangeValue ? [parameter.rangeValue] : [])
  ];
  return values
    .map((value) => {
      if (value && typeof value === "object") return Object.values(value).filter(Boolean).join(" - ");
      return String(value || "").trim();
    })
    .filter(Boolean)
    .join(", ");
}

function parsePrice(price) {
  const raw = price?.amount ?? price?.price ?? null;
  const parsed = raw === undefined || raw === null || raw === "" ? null : Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function productFreshnessTime(product) {
  return Math.max(
    Date.parse(product.addedAt || 0) || 0,
    Date.parse(product.sourceAddedAt || 0) || 0,
    Date.parse(product.sourceUpdatedAt || 0) || 0,
    Number(product.id || 0) || 0
  );
}

function normalizeImages(images) {
  return [...new Set(
    (Array.isArray(images) ? images : Object.values(images || {}))
      .map((value) => typeof value === "string" ? value : value?.url)
      .map((value) => String(value || "").trim())
      .filter((value) => /^https?:\/\//i.test(value))
  )];
}

function sortIds(a, b) {
  const left = Number(a);
  const right = Number(b);
  if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
  return String(a).localeCompare(String(b), "pl-PL");
}

function sortIdsDesc(a, b) {
  return -sortIds(a, b);
}

function buildCategoryTree(categories, products) {
  const visibleCategoryIds = new Set(products.map((product) => product.categoryId).filter(Boolean));
  const categoryById = new Map(categories.map((category) => [String(category.category_id), category]));

  for (const categoryId of [...visibleCategoryIds]) {
    let current = categoryById.get(String(categoryId));
    while (current && current.parent_id) {
      visibleCategoryIds.add(String(current.parent_id));
      current = categoryById.get(String(current.parent_id));
    }
  }

  const productCounts = products.reduce((counts, product) => {
    if (product.categoryId) counts[product.categoryId] = (counts[product.categoryId] || 0) + 1;
    return counts;
  }, {});

  const nodes = new Map();
  for (const category of categories) {
    const id = String(category.category_id);
    if (!visibleCategoryIds.has(id)) continue;
    nodes.set(id, {
      id,
      name: category.name || "Kategoria",
      displayName: shortCategoryName(category.name || "Kategoria"),
      parentId: category.parent_id ? String(category.parent_id) : "",
      productCount: productCounts[id] || 0,
      children: []
    });
  }

  const roots = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortTree = (items) => {
    for (const item of items) {
      sortTree(item.children);
      item.totalProductCount =
        (item.productCount || 0) + item.children.reduce((sum, child) => sum + (child.totalProductCount || 0), 0);
    }
    items.sort((a, b) => {
      const countDiff = (b.totalProductCount || 0) - (a.totalProductCount || 0);
      return countDiff || a.displayName.localeCompare(b.displayName, "pl-PL");
    });
  };
  sortTree(roots);
  return roots;
}

function getCategoryPath(categories, categoryId) {
  if (!categoryId) return [];
  const categoryById = new Map(categories.map((category) => [String(category.category_id), category]));
  const path = [];
  let current = categoryById.get(String(categoryId));
  while (current) {
    const name = current.name || "Kategoria";
    path.unshift({ id: String(current.category_id), name, displayName: shortCategoryName(name) });
    current = current.parent_id ? categoryById.get(String(current.parent_id)) : null;
  }
  return path;
}

function countCategories(categories) {
  return categories.reduce((sum, category) => sum + 1 + countCategories(category.children || []), 0);
}

function toListProduct(product) {
  const categoryLeaf = product.categoryPath?.length
    ? product.categoryPath[product.categoryPath.length - 1].displayName || product.categoryPath[product.categoryPath.length - 1].name
    : "";
  const categorySearch = (product.categoryPath || [])
    .map((category) => category.displayName || category.name || "")
    .filter(Boolean)
    .join(" ");
  return {
    id: product.id,
    slug: product.slug || slugify(product.name),
    name: product.name,
    searchText: stripHtml(`${product.name} ${categoryLeaf} ${categorySearch} ${product.sku || ""}`).toLowerCase(),
    price: product.price,
    currency: product.currency,
    categoryId: product.categoryId,
    categoryName: categoryLeaf,
    categoryPath: product.categoryPath,
    images: Array.isArray(product.images) ? product.images.slice(0, 1).map((src) => allegroImageVariant(src, "s512")) : [],
    addedAt: product.addedAt || null,
    allegroUrl: product.allegroUrl
  };
}

function shortCategoryName(name) {
  const parts = String(name || "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  const leaf = parts.length ? parts[parts.length - 1] : String(name || "Kategoria").trim();
  const aliases = [
    [/fantasy.*science fiction.*horror/i, "Fantasy"],
    [/krymina.*sensacja.*thriller/i, "Kryminał"],
    [/literatura obyczajowa.*erotyczna/i, "Obyczajowe"],
    [/ksiazki dla mlodziezy/i, "Młodzieżowe"],
    [/ksi[aą]zki dla m[lł]odzie[zż]y/i, "Młodzieżowe"],
    [/ksiazki dla dzieci/i, "Dziecięce"],
    [/ksi[aą]zki dla dzieci/i, "Dziecięce"],
    [/dla dzieci/i, "Dziecięce"],
    [/ksiazki naukowe.*popularnonaukowe/i, "Naukowe"],
    [/ksi[aą]zki naukowe.*popularnonaukowe/i, "Naukowe"],
    [/naukowe.*popularnonaukowe/i, "Naukowe"],
    [/poradniki.*albumy/i, "Poradniki"],
    [/literatura piekna/i, "Literatura piękna"],
    [/literatura pi[eę]kna/i, "Literatura piękna"],
    [/biografie.*wspomnienia/i, "Biografie"],
    [/historia/i, "Historia"],
    [/komiksy/i, "Komiksy"],
    [/filmy/i, "Filmy"],
    [/muzyka/i, "Muzyka"],
    [/podreczniki/i, "Podręczniki"],
    [/podr[eę]czniki/i, "Podręczniki"]
  ];

  for (const [pattern, label] of aliases) {
    if (pattern.test(leaf)) return label;
  }

  return leaf
    .replace(/\s*-\s*.*$/, "")
    .replace(/\s*,\s*.*$/, "")
    .trim() || "Kategoria";
}

function slugify(value) {
  return String(value || "")
    .replace(/[ąĄ]/g, "a")
    .replace(/[ćĆ]/g, "c")
    .replace(/[ęĘ]/g, "e")
    .replace(/[łŁ]/g, "l")
    .replace(/[ńŃ]/g, "n")
    .replace(/[óÓ]/g, "o")
    .replace(/[śŚ]/g, "s")
    .replace(/[źŹżŻ]/g, "z")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "produkt";
}

function allegroImageVariant(value, size) {
  const url = String(value || "");
  if (!/^https:\/\/a\.allegroimg\.com\//i.test(url)) return url;
  return url.replace(/\/(?:original|s\d{2,4})\//i, `/${size}/`);
}
