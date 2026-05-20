import path from "node:path";
import { BaseClient } from "../lib/baseClient.js";
import { sanitizeDescription, stripHtml } from "../lib/html.js";
import { ensureDir, readJson, writeJson } from "../lib/jsonStore.js";

const PUBLISHED_FILE = "published-products.json";
const CATALOG_FILE = "catalog-cache.json";
const STOCK_FILE = "stock-cache.json";
const STOREFRONT_FILE = "storefront-cache.json";
const META_FILE = "cache-meta.json";

function nowIso() {
  return new Date().toISOString();
}

function emptyPublished() {
  return {
    version: 1,
    activeProductIds: [],
    addedAtByProductId: {},
    removedByZero: {}
  };
}

function emptyCatalog(version) {
  return {
    version,
    updatedAt: null,
    context: null,
    categories: [],
    products: {}
  };
}

function emptyStock() {
  return {
    updatedAt: null,
    products: {}
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
      currency: "PLN"
    }
  };
}

function emptyMeta(version) {
  return {
    version,
    lastStockRefreshAt: null,
    lastCatalogRefreshAt: null,
    lastAddNewAt: null,
    lastErrorAt: null,
    lastError: null,
    runningAction: null
  };
}

export class StoreCache {
  constructor(config) {
    this.config = config;
    this.baseClient = new BaseClient(config);
    this.files = {
      published: path.join(config.dataDir, PUBLISHED_FILE),
      catalog: path.join(config.dataDir, CATALOG_FILE),
      stock: path.join(config.dataDir, STOCK_FILE),
      storefront: path.join(config.dataDir, STOREFRONT_FILE),
      meta: path.join(config.dataDir, META_FILE)
    };
    this.queue = Promise.resolve();
  }

  async init() {
    await ensureDir(this.config.dataDir);
    await this.ensureFile(this.files.published, emptyPublished());
    await this.ensureFile(this.files.catalog, emptyCatalog(this.config.version));
    await this.ensureFile(this.files.stock, emptyStock());
    await this.ensureFile(this.files.storefront, emptyStorefront(this.config.version));
    await this.ensureFile(this.files.meta, emptyMeta(this.config.version));
    await this.rebuildStorefront();
  }

  schedule() {
    setInterval(() => {
      this.refreshStock("schedule").catch((error) => this.rememberError(error));
    }, this.config.stockRefreshMs).unref();

    setInterval(() => {
      this.refreshCatalog("schedule").catch((error) => this.rememberError(error));
    }, this.config.catalogRefreshMs).unref();

    setTimeout(() => {
      this.refreshStock("startup").catch((error) => this.rememberError(error));
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

  async getProduct(productId) {
    const storefront = await this.getStorefront();
    const product = storefront.products.find((item) => String(item.id) === String(productId));
    if (!product) return null;
    const related = storefront.products
      .filter((item) => item.id !== product.id && item.categoryId && item.categoryId === product.categoryId)
      .slice(0, 8)
      .map(toListProduct);
    return {
      ...product,
      related
    };
  }

  async getStatus() {
    const [published, storefront, meta, catalog, stock] = await Promise.all([
      this.readPublished(),
      this.getStorefront(),
      this.readMeta(),
      this.readCatalog(),
      this.readStock()
    ]);

    return {
      version: this.config.version,
      activeProductCount: published.activeProductIds.length,
      visibleProductCount: storefront.products.length,
      visibleCategoryCount: storefront.meta.categoryCount,
      hiddenByStockCount: storefront.meta.hiddenByStockCount,
      stockUpdatedAt: stock.updatedAt,
      catalogUpdatedAt: catalog.updatedAt,
      storefrontUpdatedAt: storefront.updatedAt,
      context: catalog.context,
      lastError: meta.lastError,
      lastErrorAt: meta.lastErrorAt,
      runningAction: meta.runningAction
    };
  }

  async addNewProducts() {
    return this.runExclusive("add-new-products", async () => {
      await this.markRunning("add-new-products");
      const startedAt = nowIso();

      try {
        const context = await this.baseClient.resolveContext();
        const stockMap = await this.fetchStockMap(context);
        const availableIds = Object.entries(stockMap)
          .filter(([, value]) => value.available > 0)
          .map(([productId]) => productId);

        const published = await this.readPublished();
        const activeSet = new Set();

        for (const productId of published.activeProductIds.map(String)) {
          if ((stockMap[productId]?.available || 0) > 0) {
            activeSet.add(productId);
          } else {
            published.removedByZero[productId] = startedAt;
          }
        }

        const newIds = availableIds.filter((productId) => !activeSet.has(String(productId)));

        for (const productId of newIds) {
          activeSet.add(String(productId));
          published.addedAtByProductId[String(productId)] = startedAt;
          delete published.removedByZero[String(productId)];
        }

        published.activeProductIds = [...activeSet].sort(sortIds);
        await writeJson(this.files.published, published);
        await this.writeStockFromMap(stockMap, startedAt);
        await this.refreshCatalogLocked("add-new-products", context);

        const meta = await this.readMeta();
        meta.lastAddNewAt = startedAt;
        meta.lastError = null;
        meta.lastErrorAt = null;
        await writeJson(this.files.meta, meta);

        return {
          addedCount: newIds.length,
          addedProductIds: newIds,
          availableInBaseCount: availableIds.length,
          activeProductCount: published.activeProductIds.length
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
        const context = await this.baseClient.resolveContext();
        await this.refreshStockLocked(reason, context);
      } catch (error) {
        await this.rememberError(error);
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
        const context = await this.baseClient.resolveContext();
        await this.refreshStockLocked(reason, context);
        await this.refreshCatalogLocked(reason, context);
      } catch (error) {
        await this.rememberError(error);
        throw error;
      } finally {
        await this.clearRunning();
      }
    });
  }

  async refreshStockLocked(_reason, context) {
    const stockMap = await this.fetchStockMap(context);
    const timestamp = nowIso();
    await this.writeStockFromMap(stockMap, timestamp);

    const published = await this.readPublished();
    const before = published.activeProductIds.length;
    const activeIds = [];

    for (const productId of published.activeProductIds.map(String)) {
      const available = stockMap[productId]?.available || 0;
      if (available > 0) {
        activeIds.push(productId);
      } else {
        published.removedByZero[productId] = timestamp;
      }
    }

    published.activeProductIds = activeIds.sort(sortIds);
    await writeJson(this.files.published, published);

    const meta = await this.readMeta();
    meta.lastStockRefreshAt = timestamp;
    meta.lastError = null;
    meta.lastErrorAt = null;
    await writeJson(this.files.meta, meta);

    await this.rebuildStorefront(context, before - activeIds.length);
  }

  async refreshCatalogLocked(_reason, resolvedContext = null) {
    const context = resolvedContext || (await this.baseClient.resolveContext());
    const published = await this.readPublished();
    const activeIds = published.activeProductIds.map(String);
    const timestamp = nowIso();

    const [categoriesData, products] = await Promise.all([
      this.baseClient.call("getInventoryCategories", { inventory_id: context.inventoryId }),
      this.fetchProductDetails(context, activeIds)
    ]);

    const catalog = {
      version: this.config.version,
      updatedAt: timestamp,
      context,
      categories: categoriesData.categories || [],
      products
    };

    await writeJson(this.files.catalog, catalog);

    const meta = await this.readMeta();
    meta.lastCatalogRefreshAt = timestamp;
    meta.lastError = null;
    meta.lastErrorAt = null;
    await writeJson(this.files.meta, meta);

    await this.rebuildStorefront(context);
  }

  async rebuildStorefront(contextOverride = null, recentlyHiddenCount = 0) {
    const [published, catalog, stock] = await Promise.all([this.readPublished(), this.readCatalog(), this.readStock()]);
    const context = contextOverride || catalog.context || { currency: "PLN" };
    const activeSet = new Set(published.activeProductIds.map(String));
    const visibleProducts = [];

    for (const productId of activeSet) {
      const product = catalog.products[String(productId)];
      const stockEntry = stock.products[String(productId)];
      if (!product || !stockEntry || stockEntry.available <= 0) continue;
      visibleProducts.push({
        ...product,
        stock: stockEntry.available,
        stockByWarehouse: stockEntry.stockByWarehouse,
        categoryPath: getCategoryPath(catalog.categories, product.categoryId)
      });
    }

    visibleProducts.sort((a, b) => a.name.localeCompare(b.name, "pl-PL"));

    const categories = buildCategoryTree(catalog.categories, visibleProducts);
    const storefront = {
      version: this.config.version,
      updatedAt: nowIso(),
      stockUpdatedAt: stock.updatedAt,
      catalogUpdatedAt: catalog.updatedAt,
      products: visibleProducts,
      categories,
      meta: {
        productCount: visibleProducts.length,
        categoryCount: countCategories(categories),
        hiddenByStockCount: Object.keys(published.removedByZero || {}).length,
        recentlyHiddenCount,
        currency: context.currency || "PLN",
        priceGroupName: context.priceGroupName || this.config.basePriceGroupName
      }
    };

    await writeJson(this.files.storefront, storefront);
    return storefront;
  }

  async fetchStockMap(context) {
    const pages = await this.baseClient.getAllPaged(
      "getInventoryProductsStock",
      { inventory_id: context.inventoryId },
      "products"
    );
    const stockMap = {};

    for (const page of pages) {
      for (const [productId, record] of Object.entries(page)) {
        stockMap[String(productId)] = normalizeStockRecord(record, this.config.baseWarehouseId);
      }
    }

    return stockMap;
  }

  async writeStockFromMap(stockMap, timestamp) {
    await writeJson(this.files.stock, {
      updatedAt: timestamp,
      products: stockMap
    });
  }

  async fetchProductDetails(context, productIds) {
    const result = {};
    for (const chunk of chunkArray(productIds, this.config.productsDataChunkSize)) {
      if (chunk.length === 0) continue;
      const data = await this.baseClient.call("getInventoryProductsData", {
        inventory_id: context.inventoryId,
        products: chunk.map((productId) => Number(productId))
      });

      for (const [productId, record] of Object.entries(data.products || {})) {
        result[String(productId)] = normalizeProduct(productId, record, context);
      }
    }
    return result;
  }

  async ensureFile(filePath, fallback) {
    const existing = await readJson(filePath, null);
    if (!existing) await writeJson(filePath, fallback);
  }

  async readPublished() {
    const published = await readJson(this.files.published, emptyPublished());
    published.activeProductIds = [...new Set((published.activeProductIds || []).map(String))].sort(sortIds);
    published.addedAtByProductId = published.addedAtByProductId || {};
    published.removedByZero = published.removedByZero || {};
    return published;
  }

  async readCatalog() {
    return readJson(this.files.catalog, emptyCatalog(this.config.version));
  }

  async readStock() {
    return readJson(this.files.stock, emptyStock());
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

  async rememberError(error) {
    const meta = await this.readMeta();
    meta.lastErrorAt = nowIso();
    meta.lastError = error.message || String(error);
    await writeJson(this.files.meta, meta);
  }

  async runExclusive(_name, fn) {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }
}

function normalizeProduct(productId, record, context) {
  const fields = record.text_fields || {};
  const language = context.defaultLanguage || "";
  const localizedName = language ? fields[`name|${language}`] : "";
  const localizedDescription = language ? fields[`description|${language}`] : "";
    const name = String(localizedName || fields.name || record.name || record.sku || `Produkt ${productId}`).trim();
  const descriptionHtml = sanitizeDescription(localizedDescription || fields.description || "");
  const priceRaw = record.prices ? record.prices[String(context.priceGroupId)] : null;
  const price = priceRaw === undefined || priceRaw === null || priceRaw === "" ? null : Number(priceRaw);

  return {
    id: String(productId),
    slug: slugify(name),
    sku: record.sku || "",
    ean: record.ean || "",
    name,
    searchText: stripHtml(`${name} ${record.sku || ""} ${record.ean || ""} ${descriptionHtml}`).toLowerCase(),
    price: Number.isFinite(price) ? price : null,
    currency: context.currency || "PLN",
    categoryId: record.category_id ? String(record.category_id) : "",
    images: normalizeImages(record.images),
    descriptionHtml,
    features: normalizeFeatures(fields.features)
  };
}

function normalizeImages(images) {
  return Object.entries(images || {})
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, value]) => String(value || "").trim())
    .filter((value) => /^https?:\/\//i.test(value));
}

function normalizeFeatures(features) {
  if (!features || typeof features !== "object" || Array.isArray(features)) return [];
  return Object.entries(features)
    .map(([name, value]) => ({ name: String(name), value: String(value) }))
    .filter((item) => item.name && item.value);
}

function normalizeStockRecord(record, warehouseId) {
  const baseAvailable = sumStock(record.stock, record.reservations, warehouseId);
  const variantsAvailable = Object.values(record.variants || {}).reduce(
    (sum, variantStock) => sum + sumStock(variantStock, null, warehouseId),
    0
  );

  return {
    productId: String(record.product_id || ""),
    available: Math.max(0, baseAvailable + variantsAvailable),
    stockByWarehouse: record.stock || {},
    reservationsByWarehouse: record.reservations || {}
  };
}

function sumStock(stock = {}, reservations = {}, warehouseId = "") {
  if (!stock || typeof stock !== "object") return 0;
  const keys = warehouseId ? [warehouseId] : Object.keys(stock);
  return keys.reduce((sum, key) => {
    const quantity = Number(stock[key] || 0);
    const reserved = reservations && typeof reservations === "object" ? Number(reservations[key] || 0) : 0;
    return sum + Math.max(0, quantity - reserved);
  }, 0);
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function sortIds(a, b) {
  const left = Number(a);
  const right = Number(b);
  if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
  return String(a).localeCompare(String(b), "pl-PL");
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
    searchText: stripHtml(`${product.name} ${categoryLeaf} ${categorySearch}`).toLowerCase(),
    price: product.price,
    currency: product.currency,
    categoryId: product.categoryId,
    categoryName: categoryLeaf,
    categoryPath: product.categoryPath,
    images: product.images
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
    [/ksi[aą]żki dla m[lł]odzieży/i, "Młodzieżowe"],
    [/ksi[aą]żki dla dzieci/i, "Dziecięce"],
    [/dla dzieci/i, "Dziecięce"],
    [/ksi[aą]żki naukowe.*popularnonaukowe/i, "Naukowe"],
    [/naukowe.*popularnonaukowe/i, "Naukowe"],
    [/poradniki.*albumy/i, "Poradniki"],
    [/literatura pi[eę]kna/i, "Literatura piękna"],
    [/biografie.*wspomnienia/i, "Biografie"],
    [/historia/i, "Historia"],
    [/komiksy/i, "Komiksy"],
    [/filmy/i, "Filmy"],
    [/muzyka/i, "Muzyka"],
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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "produkt";
}
