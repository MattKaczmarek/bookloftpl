import express from "express";
import path from "node:path";
import { requireAuth } from "../../lib/auth.js";
import { stripHtml } from "../../lib/html.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function createPageRouter(config, storeCache) {
  const router = express.Router();
  const auth = requireAuth(config);

  router.get("/", auth, (_req, res) => {
    res.sendFile(path.join(config.publicDir, "store.html"));
  });

  router.get("/panel", auth, (_req, res) => {
    res.sendFile(path.join(config.publicDir, "panel.html"));
  });

  router.get(
    "/product/:productId/:slug?",
    auth,
    asyncHandler(async (req, res) => {
      const product = await storeCache.getProduct(req.params.productId);
      if (!product) {
        res.sendFile(path.join(config.publicDir, "product.html"));
        return;
      }

      res.type("html").send(renderProductPage(config, product));
    })
  );

  router.get(
    "/sitemap.xml",
    auth,
    asyncHandler(async (_req, res) => {
      const storefront = await storeCache.getStorefront();
      const urls = [
        {
          loc: `${config.publicOrigin}${config.basePath}`,
          priority: "1.0"
        },
        ...storefront.products.map((product) => ({
          loc: `${config.publicOrigin}${config.basePath}/product/${encodeURIComponent(product.id)}/${encodeURIComponent(
            product.slug || "produkt"
          )}`,
          priority: "0.8"
        }))
      ];

      res.type("application/xml").send(renderSitemap(urls, storefront.updatedAt));
    })
  );

  return router;
}

function renderProductPage(config, product) {
  const price = product.price === null ? "Cena do ustalenia" : formatPrice(product.price, product.currency);
  const category = product.categoryPath?.length
    ? product.categoryPath.map((item) => item.displayName || item.name).join(" / ")
    : "Używana książka";
  const description = metaDescription(product);
  const productUrl = `${config.publicOrigin}${config.basePath}/product/${encodeURIComponent(product.id)}/${encodeURIComponent(
    product.slug || "produkt"
  )}`;
  const image = product.images?.[0] || `${config.publicOrigin}${config.basePath}/assets/img/logo.png`;
  const jsonLd = JSON.stringify(productJsonLd(product, productUrl, image, description, category)).replaceAll("</", "<\\/");
  const bootstrap = JSON.stringify(product).replaceAll("</", "<\\/");

  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(product.name)} | BookLoft</title>
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta name="description" content="${escapeAttribute(description)}">
  <link rel="canonical" href="${escapeAttribute(productUrl)}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="BookLoft">
  <meta property="og:title" content="${escapeAttribute(product.name)}">
  <meta property="og:description" content="${escapeAttribute(description)}">
  <meta property="og:url" content="${escapeAttribute(productUrl)}">
  <meta property="og:image" content="${escapeAttribute(image)}">
  <meta property="product:price:amount" content="${escapeAttribute(product.price ?? "")}">
  <meta property="product:price:currency" content="${escapeAttribute(product.currency || "PLN")}">
  <script type="application/ld+json">${jsonLd}</script>
  <link rel="stylesheet" href="${config.basePath}/assets/css/styles.css?v=1.01-cozy-5">
  <script>window.__BOOKLOFT_PRODUCT__=${bootstrap};</script>
  <script defer src="${config.basePath}/assets/js/product.js?v=1.01-cozy-5"></script>
</head>
<body>
  <header class="topbar">
    <a class="brand" href="${config.basePath}" aria-label="BookLoft sklep">
      <span class="brand-mark"><img src="${config.basePath}/assets/img/logo-mark.png?v=1.01" alt=""></span>
      <span class="brand-word">BookLoft</span>
    </a>
    <nav class="top-actions" aria-label="Nawigacja">
      <a href="${config.basePath}" class="ghost-action">Sklep</a>
      <a href="${config.basePath}/panel" class="ghost-action">Panel</a>
    </nav>
  </header>

  <main class="product-page" id="product-page">
    <div class="status-strip"><span>Ładowanie produktu...</span></div>
  </main>
</body>
</html>`;
}

function renderSitemap(urls, updatedAt) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeHtml(url.loc)}</loc>
    <lastmod>${escapeHtml((updatedAt || new Date().toISOString()).slice(0, 10))}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;
}

function productJsonLd(product, url, image, description, category) {
  const offer = product.price === null
    ? undefined
    : {
        "@type": "Offer",
        priceCurrency: product.currency || "PLN",
        price: product.price,
        availability: Number(product.stock || 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/UsedCondition",
        url
      };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description,
    image: product.images?.length ? product.images : [image],
    sku: product.sku || String(product.id),
    category,
    brand: {
      "@type": "Brand",
      name: "BookLoft"
    },
    offers: offer
  };
}

function metaDescription(product) {
  const text = stripHtml(product.descriptionHtml || product.searchText || "");
  const suffix = "Używana książka dostępna w BookLoft, sprawdzona i gotowa na kolejną historię.";
  const combined = `${product.name}. ${text || suffix}`;
  return combined.replace(/\s+/g, " ").slice(0, 158);
}

function formatPrice(value, currency) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: currency || "PLN"
  }).format(value);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
