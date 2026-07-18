import express from "express";
import path from "node:path";
import { appPath } from "../../config.js";
import { requireAuth } from "../../lib/auth.js";
import { catalogSearchScore } from "../../lib/catalogSearch.js";
import { stripHtml } from "../../lib/html.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const SSR_PRODUCT_LIMIT = 50;
const DEFAULT_SORT = "date-desc";
const SORT_OPTIONS = new Set(["date-desc", "price-asc", "price-desc", "name-asc", "name-desc"]);
const ALLEGRO_RETURN_POLICY_URL = "https://allegro.pl/pomoc/dla-kupujacych/zasady-zwrotow-i-reklamacji/jak-zwrocic-zakup-i-odeslac-produkt-do-sprzedajacego-GDeq5VeKRHD";

export function createPageRouter(config, storeCache) {
  const router = express.Router();
  const auth = requireAuth(config);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const [storefront, newestProducts] = await Promise.all([
        storeCache.getStorefront(),
        storeCache.getNewestProducts(SSR_PRODUCT_LIMIT)
      ]);
      const query = String(req.query.q || "").trim();
      const categoryId = String(req.query.category || "").trim();
      const sort = normalizeSort(req.query.sort);

      if (categoryId && !query) {
        const category = findCategoryById(storefront.categories, categoryId);
        if (category) {
          res.redirect(301, appPath(config.basePath, pathWithSort(categoryPath(category), sort)));
          return;
        }
      }
      if (shouldDropSortParam(req)) {
        res.redirect(301, appPath(config.basePath, pathWithoutSort(req)));
        return;
      }

      const category = categoryId ? findCategoryById(storefront.categories, categoryId) : null;
      res.type("html").send(renderStorePage(config, storefront, {
        category,
        query,
        sort,
        newestProducts
      }));
    })
  );

  router.get(
    "/strona/:page",
    asyncHandler(async (req, res) => {
      const page = parsePageParam(req.params.page);
      if (!page) {
        sendNotFoundPage(res, config, "Nie znaleziono strony katalogu");
        return;
      }
      const sort = normalizeSort(req.query.sort);
      if (page === 1) {
        res.redirect(301, appPath(config.basePath, pathWithSort("/", sort)));
        return;
      }
      if (shouldDropSortParam(req)) {
        res.redirect(301, appPath(config.basePath, pathWithoutSort(req)));
        return;
      }

      const [storefront, newestProducts] = await Promise.all([
        storeCache.getStorefront(),
        storeCache.getNewestProducts(SSR_PRODUCT_LIMIT)
      ]);
      const products = listingProducts(storefront.products, { newestProducts, sort });
      const totalPages = pageCount(products.length);
      if (page > totalPages) {
        sendNotFoundPage(res, config, "Nie znaleziono strony katalogu");
        return;
      }

      const canonicalPath = catalogPagePath(page);
      if (req.path !== canonicalPath) {
        res.redirect(301, appPath(config.basePath, pathWithSort(canonicalPath, sort)));
        return;
      }

      res.type("html").send(renderStorePage(config, storefront, {
        newestProducts,
        sort,
        page
      }));
    })
  );

  router.get(
    "/kategoria/:categoryId/:slug/strona/:page",
    asyncHandler(async (req, res) => {
      const page = parsePageParam(req.params.page);
      const storefront = await storeCache.getStorefront();
      const category = findCategoryById(storefront.categories, req.params.categoryId);
      const sort = normalizeSort(req.query.sort);
      if (!page || !category) {
        sendNotFoundPage(res, config, "Nie znaleziono kategorii");
        return;
      }
      if (page === 1) {
        res.redirect(301, appPath(config.basePath, pathWithSort(categoryPath(category), sort)));
        return;
      }
      if (shouldDropSortParam(req)) {
        res.redirect(301, appPath(config.basePath, pathWithoutSort(req)));
        return;
      }

      const products = listingProducts(storefront.products, { categoryId: category.id, sort });
      const totalPages = pageCount(products.length);
      if (page > totalPages) {
        sendNotFoundPage(res, config, "Nie znaleziono strony kategorii");
        return;
      }

      const canonicalPath = categoryPagePath(category, page);
      if (req.path !== canonicalPath) {
        res.redirect(301, appPath(config.basePath, pathWithSort(canonicalPath, sort)));
        return;
      }

      res.type("html").send(renderStorePage(config, storefront, { category, sort, page }));
    })
  );

  router.get(
    "/kategoria/:categoryId/:slug?",
    asyncHandler(async (req, res) => {
      const storefront = await storeCache.getStorefront();
      const category = findCategoryById(storefront.categories, req.params.categoryId);
      const sort = normalizeSort(req.query.sort);
      if (!category) {
        sendNotFoundPage(res, config, "Nie znaleziono kategorii");
        return;
      }

      const canonicalPath = categoryPath(category);
      if (req.path !== canonicalPath) {
        res.redirect(301, appPath(config.basePath, pathWithSort(canonicalPath, sort)));
        return;
      }
      if (shouldDropSortParam(req)) {
        res.redirect(301, appPath(config.basePath, pathWithoutSort(req)));
        return;
      }

      res.type("html").send(renderStorePage(config, storefront, { category, sort }));
    })
  );

  router.get("/panel", auth, (_req, res) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.sendFile(path.join(config.publicDir, "panel.html"));
  });

  router.get("/informacje-prawne", (_req, res) => {
    res.sendFile(path.join(config.publicDir, "legal.html"));
  });

  router.get("/o-nas", (_req, res) => {
    res.sendFile(path.join(config.publicDir, "about.html"));
  });

  router.get(
    "/product/:productId/:slug?",
    asyncHandler(async (req, res) => {
      const [product, storefront] = await Promise.all([
        storeCache.getProduct(req.params.productId),
        storeCache.getStorefront()
      ]);
      if (!product) {
        const missingProduct = await storeCache.getMissingProductPageData(
          req.params.productId,
          req.params.slug,
          storefront
        );
        res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
        res.status(missingProduct.status).type("html").send(renderMissingProductPage(config, missingProduct));
        return;
      }

      const canonicalPath = productPath(product);
      if (req.path !== canonicalPath) {
        res.redirect(301, appPath(config.basePath, canonicalPath));
        return;
      }

      res.type("html").send(renderProductPage(config, product, storefront));
    })
  );

  router.get(
    "/sitemap.xml",
    asyncHandler(async (_req, res) => {
      const storefront = await storeCache.getStorefront();
      const categories = visibleCategories(storefront.categories);
      const urls = [
        {
          loc: absoluteUrl(config, "/")
        },
        {
          loc: absoluteUrl(config, "/o-nas")
        },
        {
          loc: absoluteUrl(config, "/informacje-prawne")
        },
        ...categories.map((category) => ({
          loc: absoluteUrl(config, categoryPath(category))
        })),
        ...catalogPaginationUrls(config, storefront.products.length),
        ...categoryPaginationUrls(config, storefront.products, categories),
        ...storefront.products.map((product) => ({
          loc: absoluteUrl(config, productPath(product)),
          lastmod: sitemapLastModified(product)
        }))
      ];

      res.type("application/xml").send(renderSitemap(urls));
    })
  );

  return router;
}

function renderStorePage(config, storefront, { category = null, query = "", sort = DEFAULT_SORT, newestProducts = [], page = 1 } = {}) {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedSort = normalizeSort(sort);
  const products = listingProducts(storefront.products, {
    categoryId: category?.id || "",
    query: normalizedQuery,
    sort: normalizedSort,
    newestProducts
  });
  const currentPage = normalizedQuery ? 1 : Math.max(1, page);
  const totalPages = normalizedQuery ? 1 : pageCount(products.length);
  const pageOffset = (currentPage - 1) * SSR_PRODUCT_LIMIT;
  const visibleProducts = products.slice(pageOffset, pageOffset + SSR_PRODUCT_LIMIT);
  const emptySuggestions = normalizedQuery && products.length === 0
    ? listingProducts(storefront.products, {
        categoryId: category?.id || "",
        newestProducts
      }).slice(0, 4)
    : [];
  const pageMeta = storePageMeta(config, {
    category,
    query: normalizedQuery,
    sort: normalizedSort,
    productCount: products.length,
    page: currentPage,
    totalPages
  });
  const pagination = normalizedQuery ? null : catalogPagination(config, {
    category,
    currentPage,
    totalPages,
    productCount: products.length
  });
  const categoryOptions = visibleCategories(storefront.categories);
  const categoryRail = renderCategoryRail(config, categoryOptions, {
    activeCategoryId: category?.id || "",
    totalCount: storefront.meta?.productCount || storefront.products.length
  });
  const categorySelect = renderCategorySelect(categoryOptions, category?.id || "");
  const categoryLinks = category && !normalizedQuery
    ? relatedCategoryLinks(categoryOptions, category, 6)
    : [];
  const sortSelect = renderSortSelect(normalizedSort);
  const itemListSchema = JSON.stringify(itemListJsonLd(config, visibleProducts, pageOffset)).replaceAll("</", "<\\/");
  const siteSchema = JSON.stringify(siteJsonLd(config)).replaceAll("</", "<\\/");
  const breadcrumbSchema = category
    ? JSON.stringify(breadcrumbJsonLd([
        { name: "BookLoft", url: absoluteUrl(config, "/") },
        { name: category.displayName || category.name, url: absoluteUrl(config, categoryPath(category)) }
      ])).replaceAll("</", "<\\/")
    : "";

  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="${pageMeta.robots}">
  <meta name="description" content="${escapeAttribute(pageMeta.description)}">
  <link rel="canonical" href="${escapeAttribute(pageMeta.canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="BookLoft">
  <meta property="og:title" content="${escapeAttribute(pageMeta.title)}">
  <meta property="og:description" content="${escapeAttribute(pageMeta.description)}">
  <meta property="og:url" content="${escapeAttribute(pageMeta.canonical)}">
  <meta property="og:image" content="${escapeAttribute(absoluteUrl(config, "/assets/img/loft-hero.jpg"))}">
  ${pagination?.prevUrl ? `<link rel="prev" href="${escapeAttribute(pagination.prevUrl)}">` : ""}
  ${pagination?.nextUrl ? `<link rel="next" href="${escapeAttribute(pagination.nextUrl)}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <title>${escapeHtml(pageMeta.title)}</title>
  <script type="application/ld+json">${siteSchema}</script>
  <script type="application/ld+json">${itemListSchema}</script>
  ${breadcrumbSchema ? `<script type="application/ld+json">${breadcrumbSchema}</script>` : ""}
  <link rel="preload" as="image" href="${appPath(config.basePath, `/assets/img/loft-hero.webp?v=${config.version}`)}" type="image/webp" media="(min-width: 621px)" fetchpriority="high">
  <link rel="preload" as="image" href="${appPath(config.basePath, `/assets/img/loft-hero-mobile.webp?v=${config.version}`)}" type="image/webp" media="(max-width: 620px)" fetchpriority="high">
  ${renderFontPreloads(config)}
  <link rel="stylesheet" href="${appPath(config.basePath, `/assets/css/fonts.css?v=${config.version}`)}">
  <link rel="icon" type="image/png" sizes="32x32" href="${appPath(config.basePath, `/assets/img/favicon-32.png?v=${config.version}`)}">
  <link rel="icon" type="image/png" sizes="512x512" href="${appPath(config.basePath, `/assets/img/favicon.png?v=${config.version}`)}">
  <link rel="apple-touch-icon" sizes="180x180" href="${appPath(config.basePath, `/assets/img/apple-touch-icon.png?v=${config.version}`)}">
  <link rel="stylesheet" href="${appPath(config.basePath, `/assets/css/styles.css?v=${config.version}`)}">
  <script>
    window.BOOKLOFT_INITIAL_CATEGORY_ID=${JSON.stringify(category?.id || "")};
    window.BOOKLOFT_INITIAL_QUERY=${JSON.stringify(normalizedQuery)};
    window.BOOKLOFT_INITIAL_SORT=${JSON.stringify(normalizedSort)};
    window.BOOKLOFT_INITIAL_PRODUCT_IDS=${JSON.stringify(visibleProducts.map((product) => String(product.id)))};
    window.BOOKLOFT_INITIAL_PRODUCT_COUNT=${JSON.stringify(products.length)};
    window.BOOKLOFT_INITIAL_OFFSET=${JSON.stringify(pageOffset)};
    window.BOOKLOFT_INITIAL_PAGE=${JSON.stringify(currentPage)};
    window.BOOKLOFT_ANALYTICS_ID=${JSON.stringify(config.googleAnalyticsId || "")};
  </script>
  <script defer src="${appPath(config.basePath, `/assets/js/analytics.js?v=${config.version}`)}"></script>
  <script defer src="${appPath(config.basePath, `/assets/js/store.js?v=${config.version}`)}"></script>
</head>
<body>
  <div class="brand-intro is-visible" id="brand-intro">
    <div class="brand-intro-inner">
      <img src="${appPath(config.basePath, `/assets/img/logo.png?v=${config.version}`)}" width="1816" height="803" alt="BookLoft">
      <p>Wejdź do przestrzeni pełnej książek</p>
    </div>
  </div>

  <main class="shop-layout">
    <aside class="category-rail" aria-label="Kategorie">
      <div class="rail-head">
        <span>Kategorie</span>
      </div>
      <div id="category-tree" class="category-tree">${categoryRail}</div>
    </aside>

    <section class="shop-surface" aria-live="polite">
      <a class="shop-brand-hero" href="${appPath(config.basePath, "/")}" aria-label="BookLoft - wróć na stronę główną">
        <div class="hero-brand-copy">
          <img class="hero-logo" src="${appPath(config.basePath, `/assets/img/logo.png?v=${config.version}`)}" width="1816" height="803" alt="BookLoft">
          <p>Przestrzeń pełna książek</p>
        </div>
      </a>

      <div class="shop-toolbar">
        <div class="shop-intro">
          <p class="eyebrow">${escapeHtml(pageMeta.eyebrow)}</p>
          <h1>${escapeHtml(pageMeta.h1)}</h1>
          <p class="hero-copy">${escapeHtml(pageMeta.copy)}</p>
        </div>
        <div class="shop-hero-side">
          <div class="search-box">
            <label class="visually-hidden" for="product-search">Szukaj</label>
            <input id="product-search" type="search" value="${escapeAttribute(query)}" placeholder="Sprawdź, czy mamy to, czego szukasz">
            <button class="search-clear" id="clear-search" type="button" aria-label="Wyczyść wyszukiwanie" ${query ? "" : "hidden"}>&times;</button>
          </div>
          <div class="sort-box"${products.length ? "" : " hidden"}>
            <label for="product-sort">Sortuj</label>
            <select id="product-sort" data-product-sort>
              ${sortSelect}
            </select>
          </div>
          <nav class="shop-side-links" aria-label="Informacje o sklepie">
            <a href="${appPath(config.basePath, "/o-nas")}">O nas</a>
            <a href="${appPath(config.basePath, "/informacje-prawne")}">Informacje prawne</a>
          </nav>
        </div>
      </div>

      <div class="mobile-categories">
        <label for="category-select">Kategoria</label>
        <select id="category-select">
          ${categorySelect}
        </select>
      </div>
      <div class="sort-box mobile-sort-box"${products.length ? "" : " hidden"}>
        <label for="mobile-product-sort">Sortuj</label>
        <select id="mobile-product-sort" data-product-sort>
          ${sortSelect}
        </select>
      </div>

      <h2 class="listing-title" id="listing-title">${escapeHtml(pageMeta.listingTitle)}</h2>
      ${pageMeta.categoryNote ? `<p class="category-seo-note">${escapeHtml(pageMeta.categoryNote)}</p>` : ""}
      ${renderRelatedCategoryLinks(config, categoryLinks)}

      <div class="product-grid" id="product-grid" aria-busy="false">
        ${visibleProducts.map((product, index) => renderProductCard(product, index)).join("\n")}
      </div>
      ${pagination ? renderCatalogPagination(pagination) : ""}
      <div class="load-sentinel" id="load-sentinel" aria-hidden="true" ${products.length > SSR_PRODUCT_LIMIT ? "" : "hidden"}></div>
      ${renderCatalogEmptyState(products.length === 0)}
      ${renderEmptySuggestions(emptySuggestions)}
      ${renderCatalogTrustNote(config)}
    </section>
  </main>
</body>
</html>`;
}

function renderProductPage(config, product, storefront) {
  const displayCategoryPath = visibleCategoryPath(product.categoryPath || []);
  const category = displayCategoryPath.length
    ? displayCategoryPath.map((item) => item.displayName || item.name).join(" / ")
    : "Książka z drugiego obiegu";
  const description = metaDescription(product);
  const productUrl = absoluteUrl(config, productPath(product));
  const image = product.images?.[0] || absoluteUrl(config, "/assets/img/logo.png");
  const categoryOptions = visibleCategories(storefront.categories);
  const jsonLd = JSON.stringify(productJsonLd(config, product, productUrl, image, description, category)).replaceAll("</", "<\\/");
  const breadcrumbSchema = JSON.stringify(breadcrumbJsonLd(productBreadcrumbItems(config, product, productUrl))).replaceAll("</", "<\\/");
  const bootstrap = JSON.stringify(product).replaceAll("</", "<\\/");

  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(product.name)} | BookLoft</title>
  <meta name="robots" content="index,follow,max-image-preview:large">
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
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttribute(product.name)} | BookLoft">
  <meta name="twitter:description" content="${escapeAttribute(description)}">
  <meta name="twitter:image" content="${escapeAttribute(image)}">
  <script type="application/ld+json">${jsonLd}</script>
  <script type="application/ld+json">${breadcrumbSchema}</script>
  <link rel="preload" as="image" href="${appPath(config.basePath, `/assets/img/loft-hero.webp?v=${config.version}`)}" type="image/webp" media="(min-width: 621px)" fetchpriority="high">
  <link rel="preload" as="image" href="${appPath(config.basePath, `/assets/img/loft-hero-mobile.webp?v=${config.version}`)}" type="image/webp" media="(max-width: 620px)" fetchpriority="high">
  ${renderFontPreloads(config)}
  <link rel="stylesheet" href="${appPath(config.basePath, `/assets/css/fonts.css?v=${config.version}`)}">
  <link rel="icon" type="image/png" sizes="32x32" href="${appPath(config.basePath, `/assets/img/favicon-32.png?v=${config.version}`)}">
  <link rel="icon" type="image/png" sizes="512x512" href="${appPath(config.basePath, `/assets/img/favicon.png?v=${config.version}`)}">
  <link rel="apple-touch-icon" sizes="180x180" href="${appPath(config.basePath, `/assets/img/apple-touch-icon.png?v=${config.version}`)}">
  <link rel="stylesheet" href="${appPath(config.basePath, `/assets/css/styles.css?v=${config.version}`)}">
  <script>window.__BOOKLOFT_PRODUCT__=${bootstrap};</script>
  <script>window.BOOKLOFT_ANALYTICS_ID=${JSON.stringify(config.googleAnalyticsId || "")};</script>
  <script defer src="${appPath(config.basePath, `/assets/js/analytics.js?v=${config.version}`)}"></script>
  <script defer src="${appPath(config.basePath, `/assets/js/product.js?v=${config.version}`)}"></script>
</head>
<body>
  <section class="product-visual-shell" aria-label="BookLoft - Przestrzeń pełna książek">
    <a class="shop-brand-hero product-brand-hero" href="${appPath(config.basePath, "/")}" aria-label="BookLoft - wróć na stronę główną">
      <div class="hero-brand-copy">
        <img class="hero-logo" src="${appPath(config.basePath, `/assets/img/logo.png?v=${config.version}`)}" width="1816" height="803" alt="BookLoft">
        <p>Przestrzeń pełna książek</p>
      </div>
    </a>
    <div class="product-trust-strip" aria-label="Realne zdjęcia, opis stanu i zakup przez Allegro">
      <div class="trust-track" aria-hidden="true">
        <span>Realne zdjęcia</span>
        <span>Rzetelny opis stanu</span>
        <span>Zakup przez Allegro</span>
        <span>Bezpieczna wysyłka</span>
        <span>Drugie życie książek</span>
        <span>Zakup przez Allegro</span>
        <span>Realne zdjęcia</span>
        <span>Rzetelny opis stanu</span>
        <span>Bezpieczna wysyłka</span>
        <span>Książki z charakterem</span>
      </div>
    </div>
    <form class="product-search-box search-box" id="product-search-form" action="${appPath(config.basePath, "/")}" role="search">
      <label class="visually-hidden" for="product-page-search">Szukaj</label>
      <input id="product-page-search" name="q" type="search" placeholder="Sprawdź, czy mamy to, czego szukasz">
    </form>
  </section>
  <main class="product-page" id="product-page">
    ${renderProductBody(config, product, category, categoryOptions, storefront.meta?.productCount || storefront.products.length)}
  </main>
</body>
</html>`;
}

function renderProductBody(config, product, category, categoryOptions, totalCount) {
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const image = images.length ? images[0] : "";
  const price = product.price === null ? "Cena do ustalenia" : formatPrice(product.price, product.currency);
  const stock = Number(product.stock || 0);
  const allegroUrl = product.allegroUrl || `https://allegro.pl/oferta/${encodeURIComponent(product.id)}`;
  const specs = renderProductSpecs(product);

  return `
    <div class="product-layout">
      <aside class="category-rail product-category-rail" aria-label="Kategorie">
        <div class="rail-head">
          <span>Kategorie</span>
        </div>
        <div id="product-category-tree" class="category-tree">${renderCategoryRail(config, categoryOptions, {
          activeCategoryId: product.categoryId,
          totalCount
        })}</div>
      </aside>
      <div class="product-content">
        ${renderProductBreadcrumbs(config, product, category)}
        ${renderMobilePurchaseBar(product, price, allegroUrl)}
        <article class="product-detail">
          <section class="detail-gallery">
            <div class="gallery-main">
              ${images.length > 1 ? '<button class="gallery-arrow gallery-arrow-prev" type="button" data-gallery-prev aria-label="Poprzednie zdjęcie">&lsaquo;</button>' : ""}
              ${image ? `
                <button class="detail-main-trigger" type="button" data-gallery-open aria-label="Otwórz zdjęcie produktu">
                  <img class="detail-main-image" src="${escapeAttribute(allegroImageVariant(image, "s720"))}" ${imageSrcset(image, ["s512", "s720", "s1024"])} sizes="(max-width: 760px) 92vw, 520px" alt="${escapeAttribute(productImageAlt(product))}" data-gallery-main>
                </button>
              ` : '<div class="image-fallback">BookLoft</div>'}
              ${images.length > 1 ? '<button class="gallery-arrow gallery-arrow-next" type="button" data-gallery-next aria-label="Następne zdjęcie">&rsaquo;</button>' : ""}
            </div>
            <div class="thumb-strip">
              ${images.slice(0, 8).map((src, index) => `
                <button class="thumb-button${index === 0 ? " active" : ""}" type="button" data-image-index="${index}" aria-label="Pokaż zdjęcie ${index + 1}">
                  <img src="${escapeAttribute(allegroImageVariant(src, "s256"))}" alt="">
                </button>
              `).join("")}
            </div>
          </section>
          <section class="detail-info">
            <p class="eyebrow">${escapeHtml(category)}</p>
            <h1>${escapeHtml(product.name)}</h1>
            <div class="detail-purchase">
              <strong>${price}</strong>
            </div>
            <div class="detail-actions">
              <a class="buy-action" href="${escapeAttribute(allegroUrl)}" target="_blank" rel="noopener noreferrer">Kup na Allegro</a>
            </div>
            <p class="purchase-note">Finalizacja zakupu oraz obsługa płatności, dostawy, zwrotu i reklamacji odbywają się w Allegro. Szczegóły są dostępne w ofercie Allegro oraz w <a href="${appPath(config.basePath, "/informacje-prawne#zwroty-dostawa")}">informacjach prawnych BookLoft</a>.</p>
            ${specs}
          </section>
        </article>
        <section class="detail-description">
          <h2>Opis</h2>
          <div class="description">${product.descriptionHtml || "<p>Brak opisu.</p>"}</div>
        </section>
        ${renderRelated(product.related || [])}
        ${renderProductAbout(config)}
      </div>
    </div>
  `;
}

function renderMobilePurchaseBar(product, price, allegroUrl) {
  return `<aside class="mobile-purchase-bar" aria-label="Szybki zakup">
    <span class="mobile-purchase-copy">
      <span>${escapeHtml(product.name)}</span>
      <strong>${price}</strong>
    </span>
    <a class="buy-action" href="${escapeAttribute(allegroUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Kup ${escapeAttribute(product.name)} na Allegro">Kup na Allegro</a>
  </aside>`;
}

function renderCategoryRail(config, categories, { activeCategoryId = "", totalCount = null } = {}) {
  const items = [
    totalCount === null
      ? null
      : {
          id: "",
          displayName: "Wszystkie oferty",
          totalProductCount: totalCount
        },
    ...categories.slice(0, 36)
  ].filter(Boolean);

  return `<ul>${items.map((category) => {
    const href = category.id ? categoryPath(category) : "/";
    const active = String(category.id || "") === String(activeCategoryId || "");
    return `<li><a class="category-button${active ? " active" : ""}" href="${appPath(config.basePath, href)}" data-category-id="${escapeAttribute(category.id || "")}"><span>${escapeHtml(category.displayName || category.name)}</span><small>${category.totalProductCount || category.productCount || ""}</small></a></li>`;
  }).join("")}</ul>`;
}

function renderCategorySelect(categories, activeCategoryId) {
  return [
    `<option value=""${activeCategoryId ? "" : " selected"}>Wszystkie oferty</option>`,
    ...categories.slice(0, 80).map((category) => (
      `<option value="${escapeAttribute(category.id)}"${String(category.id) === String(activeCategoryId) ? " selected" : ""}>${escapeHtml(category.displayName || category.name)}</option>`
    ))
  ].join("\n");
}

function renderRelatedCategoryLinks(config, categories) {
  if (!categories.length) return "";
  return `<nav class="related-category-links" aria-label="Powiązane kategorie">
    <span>Przeglądaj też</span>
    <div>${categories.map((category) => `<a href="${appPath(config.basePath, categoryPath(category))}">${escapeHtml(category.displayName || category.name)} <small>${escapeHtml(offerCountLabel(category.totalProductCount || category.productCount || 0))}</small></a>`).join("")}</div>
  </nav>`;
}

function relatedCategoryLinks(categories, activeCategory, limit) {
  const activeId = String(activeCategory.id);
  const activeParentId = String(activeCategory.parentId || "");
  const candidates = [
    ...(activeCategory.children || []),
    ...categories.filter((category) => activeParentId && String(category.parentId || "") === activeParentId),
    ...categories
  ];
  const seen = new Set([activeId]);

  return candidates.filter((category) => {
    const id = String(category.id || "");
    if (!id || seen.has(id) || isGenericAllegroCategory(category)) return false;
    seen.add(id);
    return (category.totalProductCount || category.productCount || 0) > 0;
  }).slice(0, Math.max(1, Number(limit) || 6));
}

function offerCountLabel(count) {
  const value = Number(count) || 0;
  const lastTwo = value % 100;
  const last = value % 10;
  if (value === 1) return "1 oferta";
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${value} oferty`;
  return `${value} ofert`;
}

function renderSortSelect(activeSort) {
  const options = [
    ["date-desc", "Domyślnie: najnowsze"],
    ["price-asc", "Cena: rosnąco"],
    ["price-desc", "Cena: malejąco"],
    ["name-asc", "Alfabetycznie: A-Z"],
    ["name-desc", "Alfabetycznie: Z-A"]
  ];
  return options.map(([value, label]) => (
    `<option value="${escapeAttribute(value)}"${value === activeSort ? " selected" : ""}>${escapeHtml(label)}</option>`
  )).join("\n");
}

function renderProductCard(product, index = 0) {
  const link = productPath(product);
  const rawImage = product.images && product.images.length ? product.images[0] : "";
  const image = rawImage ? allegroImageVariant(rawImage, "s512") : "";
  const price = product.price === null ? "Cena do ustalenia" : formatPrice(product.price, product.currency);
  const imagePriority = index < 2 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  const srcset = rawImage ? imageSrcset(rawImage, ["s256", "s400", "s512", "s720"]) : "";

  return `<article class="product-card" style="--card-delay: ${Math.min(index, 16) * 28}ms">
    <a class="product-media${image ? " is-loaded" : " is-loaded"}" href="${link}" aria-label="${escapeAttribute(product.name)}">
      ${image ? `<img src="${escapeAttribute(image)}" ${srcset} sizes="(max-width: 520px) 45vw, (max-width: 980px) 30vw, 240px" ${imagePriority} decoding="async" alt="${escapeAttribute(productImageAlt(product))}">` : '<div class="image-fallback">BookLoft</div>'}
    </a>
    <div class="product-body">
      <span class="product-category">${escapeHtml(product.categoryName || leafCategoryName(product) || "Książka")}</span>
      <h2><a href="${link}">${escapeHtml(product.name)}</a></h2>
      <div class="price-row">
        <strong>${price}</strong>
      </div>
      <div class="product-actions">
        <a class="details-action action-full" href="${link}" aria-label="Zobacz ofertę ${escapeAttribute(product.name)}">Zobacz ofertę</a>
      </div>
    </div>
  </article>`;
}

function renderCatalogEmptyState(hasNoProducts) {
  const content = hasNoProducts ? `
        <h2>Nie znaleźliśmy pasujących ofert</h2>
        <p>Spróbuj krótszej frazy, nazwiska autora albo wybierz inną kategorię.</p>
        <button class="secondary-action" id="empty-reset" type="button">Pokaż wszystkie oferty</button>` : "";
  return `<div class="empty-state" id="empty-state"${hasNoProducts ? "" : " hidden"}>${content}
      </div>`;
}

function renderEmptySuggestions(products) {
  return `<section class="empty-suggestions" id="empty-suggestions" aria-labelledby="empty-suggestions-title"${products.length ? "" : " hidden"}>
        ${products.length ? `
          <h2 id="empty-suggestions-title">Najnowsze oferty</h2>
          <div class="related-grid">
            ${products.map(renderRelatedCard).join("")}
          </div>` : ""}
      </section>`;
}

function renderRelated(products) {
  if (!products.length) return "";
  return `
    <section class="related-products">
      <h2>Z tego samego regału</h2>
      <div class="related-grid">
        ${products.map(renderRelatedCard).join("")}
      </div>
    </section>`;
}

function renderRelatedCard(product) {
  const image = product.images && product.images.length ? allegroImageVariant(product.images[0], "s256") : "";
  return `
    <a class="related-card" href="${productPath(product)}">
      <span class="related-thumb">
        ${image ? `<img src="${escapeAttribute(image)}" loading="lazy" decoding="async" alt="${escapeAttribute(productImageAlt(product))}">` : "<span>BookLoft</span>"}
      </span>
      <span class="related-copy">
        <span>${escapeHtml(product.name)}</span>
        <strong>
          ${product.price === null ? "Cena do ustalenia" : formatPrice(product.price, product.currency)}
        </strong>
      </span>
    </a>
  `;
}

function imageSrcset(src, sizes) {
  if (!/^https:\/\/a\.allegroimg\.com\//i.test(String(src || ""))) return "";
  return `srcset="${sizes.map((size) => `${escapeAttribute(allegroImageVariant(src, size))} ${size.replace("s", "")}w`).join(", ")}"`;
}

function allegroImageVariant(value, size) {
  const url = String(value || "");
  if (!/^https:\/\/a\.allegroimg\.com\//i.test(url)) return url;
  return url.replace(/\/(?:original|s\d{2,4})\//i, `/${size}/`);
}

function renderProductAbout(config) {
  return `
    <section class="shop-about product-about" id="o-nas" aria-labelledby="product-about-title">
      <p class="eyebrow">O BookLoft</p>
      <h2 id="product-about-title">Konkretne egzemplarze, pokazane bez niedomówień</h2>
      <div class="shop-about-copy">
        <p>
          Każdą książkę fotografujemy jako konkretny egzemplarz: okładkę, grzbiet i detale,
          które warto zobaczyć przed zakupem.
        </p>
        <p>
          Opisujemy widoczne ślady używania i dodatkowe uwagi, żeby klient wiedział, co kupuje.
          Po zakupie pakujemy zamówienie tak, aby bezpiecznie ruszyło w dalszą drogę.
        </p>
      </div>
      <div class="shop-about-stats" aria-label="BookLoft w liczbach">
        <span><strong>200 000+</strong> książek w drugim obiegu</span>
        <span><strong>25 000+</strong> obsłużonych zamówień</span>
        <span><strong>4</strong> lata pracy z książkami</span>
      </div>
      <nav class="product-about-links" aria-label="Więcej o BookLoft">
        <a href="${appPath(config.basePath, "/o-nas")}">Więcej o nas</a>
        <a href="${appPath(config.basePath, "/informacje-prawne")}">Informacje prawne</a>
      </nav>
    </section>`;
}

function renderMissingProductPage(config, missingProduct) {
  const { status, snapshot, searchQuery, alternatives = [] } = missingProduct;
  const isGone = status === 410;
  const title = isGone ? "Oferta jest już niedostępna" : "Nie znaleziono oferty";
  const heading = isGone ? "Ten egzemplarz został już sprzedany" : "Nie znaleźliśmy tej oferty";
  const image = snapshot?.image ? allegroImageVariant(snapshot.image, "s400") : "";
  const categoryName = snapshot?.categoryName || "";
  const searchForm = searchQuery ? `
          <form class="unavailable-search" action="${appPath(config.basePath, "/")}" method="get" role="search">
            <label for="unavailable-search-input">Poszukaj podobnego tytułu</label>
            <div>
              <input id="unavailable-search-input" name="q" type="search" value="${escapeAttribute(searchQuery)}">
              <button class="primary-action" type="submit">Szukaj w katalogu</button>
            </div>
          </form>` : "";

  return renderSimplePage(config, {
    status,
    title,
    description: "Ta oferta nie jest obecnie dostępna w katalogu BookLoft.",
    body: `<main class="unavailable-page">
        <a class="shop-brand-hero unavailable-brand-hero" href="${appPath(config.basePath, "/")}" aria-label="BookLoft - wróć na stronę główną">
          <div class="hero-brand-copy">
            <img class="hero-logo" src="${appPath(config.basePath, `/assets/img/logo.png?v=${config.version}`)}" width="1816" height="803" alt="BookLoft">
            <p>Przestrzeń pełna książek</p>
          </div>
        </a>
        <div class="unavailable-content">
          <section class="unavailable-summary${image ? " has-image" : ""}">
            ${image ? `<div class="unavailable-cover"><img src="${escapeAttribute(image)}" alt=""></div>` : ""}
            <div class="unavailable-copy">
              <p class="eyebrow">${isGone ? "Oferta zakończona" : "Nieznany adres"}</p>
              <h1>${escapeHtml(heading)}</h1>
              ${snapshot?.name ? `<p class="unavailable-offer-name">${escapeHtml(snapshot.name)}</p>` : ""}
              ${categoryName ? `<p class="unavailable-category">${escapeHtml(categoryName)}</p>` : ""}
              <p>${isGone
                ? "Każda oferta BookLoft dotyczy konkretnego używanego egzemplarza. Ten nie jest już dostępny, ale poniżej znajdziesz aktualne propozycje z naszego regału."
                : "Adres nie prowadzi do znanej oferty. Skorzystaj z wyszukiwarki albo przejdź do aktualnego katalogu."}</p>
              ${searchForm}
              <a class="secondary-action unavailable-catalog-link" href="${appPath(config.basePath, "/")}">Przejdź do wszystkich ofert</a>
            </div>
          </section>
          ${alternatives.length ? `
            <section class="related-products unavailable-alternatives" aria-labelledby="unavailable-alternatives-title">
              <p class="eyebrow">Aktualnie dostępne</p>
              <h2 id="unavailable-alternatives-title">${searchQuery ? "Podobne oferty i nowości" : "Najnowsze oferty"}</h2>
              <div class="related-grid">
                ${alternatives.map(renderRelatedCard).join("")}
              </div>
            </section>` : ""}
        </div>
    </main>`
  });
}

export function renderNotFoundPage(config, title) {
  return renderSimplePage(config, {
    status: 404,
    title,
    description: "Nie znaleziono strony w katalogu BookLoft.",
    body: `<main class="not-found-page">
      <a class="shop-brand-hero unavailable-brand-hero" href="${appPath(config.basePath, "/")}" aria-label="BookLoft - wróć na stronę główną">
        <div class="hero-brand-copy">
          <img class="hero-logo" src="${appPath(config.basePath, `/assets/img/logo.png?v=${config.version}`)}" width="1816" height="803" alt="BookLoft">
          <p>Przestrzeń pełna książek</p>
        </div>
      </a>
      <section class="empty-state not-found-content">
          <p class="eyebrow">Nieznany adres</p>
          <h1>${escapeHtml(title)}</h1>
          <p>Ta strona nie istnieje. Wyszukaj tytuł albo wróć do aktualnych ofert BookLoft.</p>
          <form class="unavailable-search" action="${appPath(config.basePath, "/")}" method="get" role="search">
            <label for="not-found-search">Znajdź książkę</label>
            <div>
              <input id="not-found-search" name="q" type="search" placeholder="Tytuł, autor lub gatunek">
              <button class="primary-action" type="submit">Szukaj w katalogu</button>
            </div>
          </form>
          <a class="secondary-action" href="${appPath(config.basePath, "/")}">Wróć do wszystkich ofert</a>
      </section>
    </main>`
  });
}

function sendNotFoundPage(res, config, title) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.status(404).type("html").send(renderNotFoundPage(config, title));
}

function renderSimplePage(config, { title, description, body }) {
  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta name="description" content="${escapeAttribute(description)}">
  <title>${escapeHtml(title)} | BookLoft</title>
  ${renderFontPreloads(config)}
  <link rel="stylesheet" href="${appPath(config.basePath, `/assets/css/fonts.css?v=${config.version}`)}">
  <link rel="icon" type="image/png" sizes="32x32" href="${appPath(config.basePath, `/assets/img/favicon-32.png?v=${config.version}`)}">
  <link rel="stylesheet" href="${appPath(config.basePath, `/assets/css/styles.css?v=${config.version}`)}">
</head>
<body>
  ${body}
</body>
</html>`;
}

function renderFontPreloads(config) {
  return [
    "nunito-sans-04.woff2",
    "nunito-sans-05.woff2",
    "source-serif-4-10.woff2",
    "source-serif-4-11.woff2"
  ].map((file) => `<link rel="preload" as="font" href="${appPath(config.basePath, `/assets/fonts/${file}`)}" type="font/woff2" crossorigin>`).join("\n  ");
}

function renderSitemap(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
    .map(
      (url) => `  <url>
    <loc>${escapeHtml(url.loc)}</loc>
${url.lastmod ? `    <lastmod>${escapeHtml(url.lastmod)}</lastmod>\n` : ""}  </url>`
    )
    .join("\n")}
</urlset>`;
}

function catalogPaginationUrls(config, productCount) {
  return Array.from({ length: Math.max(0, pageCount(productCount) - 1) }, (_item, index) => ({
    loc: absoluteUrl(config, catalogPagePath(index + 2))
  }));
}

function categoryPaginationUrls(config, products, categories) {
  return categories.flatMap((category) => {
    const count = listingProducts(products, { categoryId: category.id }).length;
    return Array.from({ length: Math.max(0, pageCount(count) - 1) }, (_item, index) => ({
      loc: absoluteUrl(config, categoryPagePath(category, index + 2))
    }));
  });
}

function catalogPagination(config, { category, currentPage, totalPages, productCount }) {
  if (totalPages <= 1) return null;
  const pageUrl = (page) => absoluteUrl(config, category ? categoryPagePath(category, page) : catalogPagePath(page));
  const start = Math.max(1, (currentPage - 1) * SSR_PRODUCT_LIMIT + 1);
  const end = Math.min(productCount, currentPage * SSR_PRODUCT_LIMIT);
  return {
    currentPage,
    totalPages,
    productCount,
    start,
    end,
    prevUrl: currentPage > 1 ? pageUrl(currentPage - 1) : "",
    nextUrl: currentPage < totalPages ? pageUrl(currentPage + 1) : "",
    pages: paginationWindow(currentPage, totalPages).map((page) => ({
      page,
      url: pageUrl(page),
      current: page === currentPage
    }))
  };
}

function renderCatalogPagination(pagination) {
  if (!pagination) return "";
  return `
      <div class="catalog-pagination-shell" data-nosnippet hidden>
        <nav class="catalog-pagination" aria-label="Strony katalogu">
          <p>Oferty ${pagination.start}-${pagination.end} z ${pagination.productCount}</p>
          <div class="catalog-pagination-links">
            ${pagination.prevUrl ? `<a class="pager-link" href="${escapeAttribute(pagination.prevUrl)}" rel="prev">Poprzednia</a>` : `<span class="pager-link is-disabled">Poprzednia</span>`}
            ${pagination.pages.map((item) => item.current
              ? `<span class="pager-number is-current" aria-current="page">${item.page}</span>`
              : `<a class="pager-number" href="${escapeAttribute(item.url)}">${item.page}</a>`
            ).join("\n")}
            ${pagination.nextUrl ? `<a class="pager-link" href="${escapeAttribute(pagination.nextUrl)}" rel="next">Następna</a>` : `<span class="pager-link is-disabled">Następna</span>`}
          </div>
        </nav>
      </div>`;
}

function paginationWindow(currentPage, totalPages) {
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  if (currentPage <= 3) pages.add(2).add(3);
  if (currentPage >= totalPages - 2) pages.add(totalPages - 1).add(totalPages - 2);
  return [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
}

function pageCount(productCount) {
  return Math.max(1, Math.ceil((Number(productCount) || 0) / SSR_PRODUCT_LIMIT));
}

function parsePageParam(value) {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : null;
}

function storePageMeta(config, { category, query, sort = DEFAULT_SORT, productCount, page = 1, totalPages = 1 }) {
  const sortedVariant = normalizeSort(sort) !== DEFAULT_SORT;

  if (query) {
    return {
      title: `Wyniki wyszukiwania: ${query} | BookLoft`,
      description: `Wyniki wyszukiwania "${query}" w katalogu BookLoft. Używane książki z rzetelnym opisem stanu i zakupem przez Allegro.`,
      canonical: category ? absoluteUrl(config, categoryPath(category)) : absoluteUrl(config, "/"),
      robots: "noindex,follow,max-image-preview:large",
      eyebrow: "Wyszukiwanie",
      h1: `Oferty dla „${query}”`,
      copy: "",
      listingTitle: ""
    };
  }

  if (category) {
    const name = category.displayName || category.name;
    const pageSuffix = page > 1 ? ` - strona ${page}` : "";
    const pageCopy = page > 1 ? ` Strona ${page} z ${totalPages}, ${productCount} ofert w kategorii.` : "";
    return {
      title: `${name} - używane produkty${pageSuffix} | BookLoft`,
      description: `${name} w BookLoft: używane produkty z realnymi zdjęciami, rzetelnym opisem stanu i zakupem przez Allegro.${pageCopy}`,
      canonical: absoluteUrl(config, categoryPagePath(category, page)),
      robots: sortedVariant ? "noindex,follow,max-image-preview:large" : "index,follow,max-image-preview:large",
      eyebrow: "Kategoria",
      h1: name,
      copy: categoryIntroCopy(productCount),
      listingTitle: page > 1 ? `Dostępne oferty - strona ${page}` : "Dostępne oferty"
    };
  }

  const pageSuffix = page > 1 ? ` - strona ${page}` : "";
  const pageCopy = page > 1 ? ` Strona ${page} z ${totalPages}, ${productCount} ofert w katalogu.` : "";
  return {
    title: `BookLoft - używane książki z drugiego obiegu${pageSuffix}`,
    description: `BookLoft - używane książki z realnymi zdjęciami, rzetelnym opisem stanu i zakupem finalizowanym na Allegro.${pageCopy}`,
    canonical: absoluteUrl(config, catalogPagePath(page)),
    robots: sortedVariant ? "noindex,follow,max-image-preview:large" : "index,follow,max-image-preview:large",
    eyebrow: "Nowości z regału",
    h1: "Wybierz kolejną historię",
    copy: "Nowe tytuły z naszego regału. Przeglądaj ostatnio dodane oferty albo wyszukaj książkę po tytule, autorze lub gatunku.",
    listingTitle: page > 1 ? `Nowości - strona ${page}` : "Nowości"
  };
}

function productJsonLd(config, product, url, image, description, category) {
  const identifiers = productIdentifiers(product);
  const publisher = knownProductFeatureValue(product, ["wydawnictwo", "producent"]);
  const brand = publisher || knownProductFeatureValue(product, ["marka", "brand"]) || "BookLoft";
  const additionalProperty = selectedProductFeatures(product.features || [], 10).map((feature) => ({
    "@type": "PropertyValue",
    name: schemaText(feature.name, "Cecha"),
    value: schemaText(feature.value, "")
  })).filter((feature) => feature.name && feature.value);
  const offer = product.price === null
    ? undefined
    : {
        "@type": "Offer",
        "@id": `${url}#offer`,
        priceCurrency: schemaText(product.currency || "PLN", "PLN"),
        price: Number(product.price),
        availability: Number(product.stock || 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/UsedCondition",
        url: schemaText(product.allegroUrl || url, url),
        seller: { "@id": organizationId(config) },
        hasMerchantReturnPolicy: { "@id": merchantReturnPolicyId(config) }
      };
  const productData = {
    "@type": identifiers.isbn ? ["Product", "Book"] : "Product",
    "@id": `${url}#product`,
    name: schemaText(product.name, "Oferta BookLoft"),
    description: schemaText(description, "Używana książka dostępna w BookLoft."),
    image: cleanImageList(product.images?.length ? product.images : [image]),
    sku: schemaText(product.sku || product.id, String(product.id || "")),
    category: schemaText(category, "Książki używane"),
    brand: {
      "@type": "Brand",
      name: schemaText(brand)
    },
    additionalProperty,
    offers: offer
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      storeIdentityJsonLd(config),
      compactJsonLd({
        ...productData,
        ...identifiers
      })
    ]
  };
}

function siteJsonLd(config) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      storeIdentityJsonLd(config),
      {
        "@type": "WebSite",
        "@id": `${config.publicOrigin}/#website`,
        url: `${config.publicOrigin}/`,
        name: "BookLoft",
        publisher: { "@id": organizationId(config) },
        potentialAction: {
          "@type": "SearchAction",
          target: `${config.publicOrigin}/?q={search_term_string}`,
          "query-input": "required name=search_term_string"
        }
      }
    ]
  };
}

function organizationId(config) {
  return `${config.publicOrigin}/#organization`;
}

function merchantReturnPolicyId(config) {
  return `${config.publicOrigin}/#merchant-return-policy`;
}

function storeIdentityJsonLd(config) {
  return compactJsonLd({
    "@type": "OnlineStore",
    "@id": organizationId(config),
    name: "BookLoft",
    legalName: "BookLoft Mateusz Kaczmarek",
    url: `${config.publicOrigin}/`,
    logo: absoluteUrl(config, "/assets/img/logo.png"),
    email: "bookloft.store@gmail.com",
    telephone: "+48518104941",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Pogórska Wola 334c",
      postalCode: "33-152",
      addressLocality: "Pogórska Wola",
      addressCountry: "PL"
    },
    vatID: "PL9930688202",
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      "@id": merchantReturnPolicyId(config),
      merchantReturnLink: ALLEGRO_RETURN_POLICY_URL
    }
  });
}

function itemListJsonLd(config, products, offset = 0) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.slice(0, 24).map((product, index) => ({
      "@type": "ListItem",
      position: offset + index + 1,
      url: absoluteUrl(config, productPath(product)),
      name: schemaText(product.name, "Oferta BookLoft")
    }))
  };
}

function breadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

const PRODUCT_SPEC_FIELDS = [
  { label: "Autor", keys: ["autor", "autorzy", "autorka"] },
  { label: "Wydawnictwo", keys: ["wydawnictwo", "producent"] },
  { label: "Rok wydania", keys: ["rok wydania", "data wydania"] },
  { label: "Seria", keys: ["seria"] },
  { label: "ISBN", keys: ["isbn"] },
  { label: "EAN", keys: ["ean", "ean (gtin)", "gtin", "kod producenta"] },
  { label: "Oprawa", keys: ["oprawa"] },
  { label: "Liczba stron", keys: ["liczba stron", "ilosc stron"] },
  { label: "Język", keys: ["jezyk"] }
];
const VISIBLE_PRODUCT_SPEC_FIELDS = PRODUCT_SPEC_FIELDS.filter((field) => field.label !== "Liczba stron");

function renderCatalogTrustNote(config) {
  return `
    <section class="catalog-trust-note" aria-label="Informacje o katalogu BookLoft">
      <div>
        <h2>Katalog używanych książek BookLoft</h2>
        <p>
          Pokazujemy konkretne egzemplarze z naszego regału: realne zdjęcia, rzetelny opis stanu
          i cenę pobraną bezpośrednio z Allegro. Zakup finalizujesz na Allegro, a katalog pomaga
          szybciej znaleźć książkę po tytule, autorze lub kategorii.
        </p>
      </div>
      <nav aria-label="Więcej informacji">
        <a href="${appPath(config.basePath, "/o-nas")}">O BookLoft</a>
        <a href="${appPath(config.basePath, "/informacje-prawne")}">Informacje prawne</a>
      </nav>
    </section>`;
}

function renderProductBreadcrumbs(config, product, fallbackCategory) {
  const pathItems = visibleCategoryPath(product.categoryPath || []);
  const leaf = pathItems[pathItems.length - 1];
  return `
    <nav class="breadcrumbs" aria-label="Ścieżka">
      <a href="${appPath(config.basePath, "/")}">BookLoft</a>
      ${leaf ? `<span aria-hidden="true">/</span><a href="${appPath(config.basePath, categoryPath(leaf))}">${escapeHtml(leaf.displayName || leaf.name)}</a>` : `<span aria-hidden="true">/</span><span>${escapeHtml(fallbackCategory)}</span>`}
      <span aria-hidden="true">/</span>
      <span>${escapeHtml(product.name)}</span>
    </nav>`;
}

function productBreadcrumbItems(config, product, productUrl) {
  const items = [{ name: "BookLoft", url: absoluteUrl(config, "/") }];
  const pathItems = visibleCategoryPath(product.categoryPath || []);
  const leaf = pathItems[pathItems.length - 1];
  if (leaf) {
    items.push({
      name: leaf.displayName || leaf.name,
      url: absoluteUrl(config, categoryPath(leaf))
    });
  }
  items.push({ name: product.name, url: productUrl });
  return items;
}

function renderProductSpecs(product) {
  const specs = selectedProductFeatures(product.features || [], 8, VISIBLE_PRODUCT_SPEC_FIELDS);
  if (!specs.length) return "";
  return `
    <section class="product-specs" aria-label="Najważniejsze informacje o książce">
      <h2>Najważniejsze informacje</h2>
      <dl>
        ${specs.map((spec) => `
          <div>
            <dt>${escapeHtml(spec.name)}</dt>
            <dd>${escapeHtml(spec.value)}</dd>
          </div>
        `).join("")}
      </dl>
    </section>`;
}

function selectedProductFeatures(features, limit = 8, fields = PRODUCT_SPEC_FIELDS) {
  const normalizedFeatures = (features || [])
    .map((feature) => ({
      key: normalizeFeatureName(feature.name),
      name: String(feature.name || "").trim(),
      value: cleanSpecValue(feature.value)
    }))
    .filter((feature) => feature.key && feature.value);

  const selected = [];
  const usedKeys = new Set();
  for (const field of fields) {
    const feature = normalizedFeatures.find((item) => field.keys.includes(item.key) && !usedKeys.has(item.key));
    if (!feature) continue;
    selected.push({ name: field.label, value: feature.value });
    usedKeys.add(feature.key);
    if (selected.length >= limit) break;
  }
  return selected;
}

function categoryIntroCopy(productCount) {
  return `${offerCountLabel(productCount)} z realnymi zdjęciami konkretnych egzemplarzy i opisem ich stanu.`;
}

function productImageAlt(product) {
  return `Zdjęcie egzemplarza: ${product.name}`;
}

function cleanSpecValue(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function normalizeFeatureName(value) {
  return normalizeCategoryName(value);
}

function isGenericUsedCondition(value) {
  const key = normalizeCategoryName(value);
  return key === "uzywany" || key === "uzywana" || key === "uzywane";
}

function listingProducts(products, { categoryId = "", query = "", sort = DEFAULT_SORT, newestProducts = [] } = {}) {
  const normalizedQuery = query.trim();
  const normalizedSort = normalizeSort(sort);
  const filtered = products.map((product) => {
    const searchScore = catalogSearchScore(product.searchText, normalizedQuery);
    const matchesCategory =
      !categoryId || (product.categoryPath || []).some((category) => String(category.id) === String(categoryId));
    return { product, searchScore, matchesCategory };
  }).filter((item) => item.searchScore >= 0 && item.matchesCategory);

  if (normalizedQuery && normalizedSort === DEFAULT_SORT) {
    return filtered
      .sort((a, b) => b.searchScore - a.searchScore || productFreshnessTime(b.product) - productFreshnessTime(a.product))
      .map((item) => item.product);
  }

  const filteredProducts = filtered.map((item) => item.product);

  if (categoryId || normalizedQuery) return sortProducts(filteredProducts, normalizedSort);

  if (newestProducts.length) {
    const newestIds = new Set(newestProducts.map((product) => String(product.id)));
    const remaining = filteredProducts
      .filter((product) => !newestIds.has(String(product.id)))
      .sort((a, b) => {
        const dateDiff = productFreshnessTime(b) - productFreshnessTime(a);
        if (dateDiff) return dateDiff;
        return sortProductIdDesc(a.id, b.id);
      });
    const combined = [...newestProducts, ...remaining];
    return normalizedSort === DEFAULT_SORT ? combined : sortProducts(combined, normalizedSort);
  }

  return sortProducts(filteredProducts, normalizedSort);
}

function sortProducts(products, sort) {
  const normalizedSort = normalizeSort(sort);
  const sorted = [...products];
  sorted.sort((a, b) => {
    switch (normalizedSort) {
      case "price-asc":
        return comparePrice(a, b, "asc") || compareName(a, b) || compareDateDesc(a, b);
      case "price-desc":
        return comparePrice(a, b, "desc") || compareName(a, b) || compareDateDesc(a, b);
      case "name-asc":
        return compareName(a, b) || compareDateDesc(a, b);
      case "name-desc":
        return compareName(b, a) || compareDateDesc(a, b);
      case "date-desc":
      default:
        return compareDateDesc(a, b) || compareName(a, b) || sortProductIdDesc(a.id, b.id);
    }
  });
  return sorted;
}

function compareDateDesc(a, b) {
  return productFreshnessTime(b) - productFreshnessTime(a);
}

function compareName(a, b) {
  return String(a.name || "").localeCompare(String(b.name || ""), "pl-PL", {
    sensitivity: "base",
    numeric: true
  });
}

function comparePrice(a, b, direction) {
  const aPrice = typeof a.price === "number" ? a.price : null;
  const bPrice = typeof b.price === "number" ? b.price : null;
  if (aPrice === null && bPrice === null) return 0;
  if (aPrice === null) return 1;
  if (bPrice === null) return -1;
  return direction === "asc" ? aPrice - bPrice : bPrice - aPrice;
}

function productFreshnessTime(product) {
  return Math.max(
    Date.parse(product.addedAt || 0) || 0,
    Date.parse(product.sourceAddedAt || 0) || 0,
    Date.parse(product.sourceUpdatedAt || 0) || 0,
    Number(product.id || 0) || 0
  );
}

function sortProductIdDesc(a, b) {
  const left = Number(a);
  const right = Number(b);
  if (Number.isFinite(left) && Number.isFinite(right)) return right - left;
  return String(b).localeCompare(String(a), "pl-PL", { numeric: true });
}

function sortProductIdAsc(a, b) {
  const left = Number(a);
  const right = Number(b);
  if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
  return String(a).localeCompare(String(b), "pl-PL", { numeric: true });
}

function normalizeSort(value) {
  const sort = String(value || "").trim();
  return SORT_OPTIONS.has(sort) ? sort : DEFAULT_SORT;
}

function pathWithSort(pathname, sort) {
  const normalizedSort = normalizeSort(sort);
  if (normalizedSort === DEFAULT_SORT) return pathname;
  return `${pathname}?sort=${encodeURIComponent(normalizedSort)}`;
}

function shouldDropSortParam(req) {
  return Object.prototype.hasOwnProperty.call(req.query || {}, "sort") && normalizeSort(req.query.sort) === DEFAULT_SORT;
}

function pathWithoutSort(req) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === "sort") continue;
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, String(item)));
    } else if (value !== undefined) {
      params.append(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `${req.path}?${query}` : req.path;
}

function visibleCategories(categories) {
  const seen = new Set();
  return flattenCategories(categories)
    .filter((category) => (category.totalProductCount || category.productCount || 0) > 0)
    .filter((category) => !isGenericAllegroCategory(category))
    .sort((a, b) => {
      const countDiff = (b.totalProductCount || b.productCount || 0) - (a.totalProductCount || a.productCount || 0);
      return countDiff || String(a.displayName || a.name).localeCompare(String(b.displayName || b.name), "pl-PL");
    })
    .filter((category) => {
      const key = String(category.displayName || category.name || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function flattenCategories(categories, depth = 0) {
  return (categories || []).flatMap((category) => [
    { ...category, depth },
    ...flattenCategories(category.children || [], depth + 1)
  ]);
}

function findCategoryById(categories, categoryId) {
  return flattenCategories(categories).find((category) => String(category.id) === String(categoryId)) || null;
}

function visibleCategoryPath(categories) {
  return categories.filter((category) => !isGenericAllegroCategory(category));
}

function isGenericAllegroCategory(category) {
  const key = normalizeCategoryName(category.displayName || category.name);
  return key === "kultura i rozrywka" || key === "ksiazki";
}

function normalizeCategoryName(value) {
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
    .trim()
    .toLowerCase();
}

function leafCategoryName(product) {
  const pathItems = visibleCategoryPath(product.categoryPath || []);
  const leaf = pathItems[pathItems.length - 1];
  return leaf?.displayName || leaf?.name || "";
}

function productPath(product) {
  return `/product/${encodeURIComponent(product.id)}/${encodeURIComponent(product.slug || slugify(product.name) || "produkt")}`;
}

function catalogPagePath(page) {
  return page <= 1 ? "/" : `/strona/${encodeURIComponent(page)}`;
}

function categoryPath(category) {
  return `/kategoria/${encodeURIComponent(category.id)}/${encodeURIComponent(slugify(category.displayName || category.name))}`;
}

function categoryPagePath(category, page) {
  const basePath = categoryPath(category);
  return page <= 1 ? basePath : `${basePath}/strona/${encodeURIComponent(page)}`;
}

function absoluteUrl(config, relativePath) {
  return `${config.publicOrigin}${appPath(config.basePath, relativePath)}`;
}

function sitemapLastModified(product) {
  const timestamp = Math.max(
    Date.parse(product.contentUpdatedAt || 0) || 0,
    Date.parse(product.sourceUpdatedAt || 0) || 0,
    Date.parse(product.addedAt || 0) || 0,
    Date.parse(product.sourceAddedAt || 0) || 0
  );
  return timestamp ? new Date(timestamp).toISOString().slice(0, 10) : "";
}

function metaDescription(product) {
  const category = leafCategoryName(product) || "książka używana";
  const condition = productFeatureValue(product, ["stan"]) || descriptionCondition(product.descriptionHtml);
  const conditionText = condition ? `Stan: ${condition}. ` : "";
  return truncateText(
    `${product.name}. ${conditionText}${category} w BookLoft z realnymi zdjęciami, rzetelnym opisem i zakupem przez Allegro.`,
    158
  );
}

function productFeatureValue(product, keys) {
  const wanted = new Set(keys.map(normalizeFeatureName));
  const value = cleanSpecValue((product.features || []).find((feature) => wanted.has(normalizeFeatureName(feature.name)))?.value || "");
  return isGenericUsedCondition(value) ? "" : value;
}

function knownProductFeatureValue(product, keys) {
  const value = productFeatureValue(product, keys);
  return ["brak", "nie dotyczy", "nie podano", "nieznane"].includes(normalizeFeatureName(value)) ? "" : value;
}

function productIdentifiers(product) {
  const isbn = normalizeIsbn(productFeatureValue(product, ["isbn"]));
  const ean = normalizeGtin(productFeatureValue(product, ["ean", "ean (gtin)", "gtin", "kod ean", "kod producenta"]));
  const gtin = ean || isbn;
  const identifiers = {};

  if (isbn) identifiers.isbn = isbn;
  if (gtin.length === 8) identifiers.gtin8 = gtin;
  if (gtin.length === 12) identifiers.gtin12 = gtin;
  if (gtin.length === 13) identifiers.gtin13 = gtin;
  if (gtin.length === 14) identifiers.gtin14 = gtin;
  return identifiers;
}

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeIsbn(value) {
  const normalized = String(value || "").replace(/[^0-9Xx]/g, "").toUpperCase();
  if (normalized.length === 13 && /^(978|979)/.test(normalized) && hasValidGtinChecksum(normalized)) {
    return normalized;
  }
  if (normalized.length === 10 && hasValidIsbn10Checksum(normalized)) {
    const body = `978${normalized.slice(0, 9)}`;
    return `${body}${gtinCheckDigit(body)}`;
  }
  return "";
}

function normalizeGtin(value) {
  const normalized = normalizeDigits(value);
  return hasValidGtinChecksum(normalized) ? normalized : "";
}

function hasValidIsbn10Checksum(value) {
  if (!/^\d{9}[\dX]$/.test(value)) return false;
  const checksum = [...value].reduce((sum, digit, index) => {
    const numericDigit = digit === "X" ? 10 : Number(digit);
    return sum + numericDigit * (10 - index);
  }, 0);
  return checksum % 11 === 0;
}

function hasValidGtinChecksum(value) {
  if (!/^\d+$/.test(value) || ![8, 12, 13, 14].includes(value.length)) return false;
  return Number(value.at(-1)) === gtinCheckDigit(value.slice(0, -1));
}

function gtinCheckDigit(body) {
  let sum = 0;
  let weight = 3;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10;
}

function cleanImageList(images) {
  return [...new Set((images || []).map((src) => schemaText(src, "")).filter(Boolean))];
}

function schemaText(value, fallback = "") {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
}

function compactJsonLd(value) {
  if (Array.isArray(value)) {
    return value.map(compactJsonLd).filter((item) => item !== undefined);
  }
  if (!value || typeof value !== "object") return value;

  const entries = Object.entries(value)
    .map(([key, item]) => [key, compactJsonLd(item)])
    .filter(([, item]) => {
      if (item === undefined || item === null || item === "") return false;
      if (Array.isArray(item) && item.length === 0) return false;
      return true;
    });
  return Object.fromEntries(entries);
}

function descriptionCondition(descriptionHtml) {
  const text = stripHtml(descriptionHtml || "");
  const match = text.match(/stan\s*:\s*([^\n.]{2,80}?)(?=\s+(?:dodatkowe uwagi|książki|ksiazki|zdjęcia|zdjecia|zapraszamy)|\.|$)/i) ||
    text.match(/stan\s*:\s*([^\n.]{2,40})/i);
  const value = match ? cleanSpecValue(match[1]) : "";
  return isGenericUsedCondition(value) ? "" : value;
}

function truncateText(value, limit) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).replace(/\s+\S*$/, "")}…`;
}

function formatPrice(value, currency) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: currency || "PLN"
  }).format(value);
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
