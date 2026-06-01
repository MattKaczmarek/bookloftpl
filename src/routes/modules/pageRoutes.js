import express from "express";
import path from "node:path";
import { appPath } from "../../config.js";
import { requireAuth } from "../../lib/auth.js";
import { stripHtml } from "../../lib/html.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const SSR_PRODUCT_LIMIT = 50;

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

      if (categoryId && !query) {
        const category = findCategoryById(storefront.categories, categoryId);
        if (category) {
          res.redirect(301, appPath(config.basePath, categoryPath(category)));
          return;
        }
      }

      const category = categoryId ? findCategoryById(storefront.categories, categoryId) : null;
      res.type("html").send(renderStorePage(config, storefront, {
        category,
        query,
        newestProducts: !category && !query ? newestProducts : []
      }));
    })
  );

  router.get(
    "/kategoria/:categoryId/:slug?",
    asyncHandler(async (req, res) => {
      const storefront = await storeCache.getStorefront();
      const category = findCategoryById(storefront.categories, req.params.categoryId);
      if (!category) {
        res.status(404).type("html").send(renderNotFoundPage(config, "Nie znaleziono kategorii"));
        return;
      }

      const canonicalPath = categoryPath(category);
      if (req.path !== canonicalPath) {
        res.redirect(301, appPath(config.basePath, canonicalPath));
        return;
      }

      res.type("html").send(renderStorePage(config, storefront, { category }));
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
        const status = await storeCache.getMissingProductStatus(req.params.productId);
        res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
        res.status(status).type("html").send(renderMissingProductPage(config, status));
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
          loc: absoluteUrl(config, "/"),
          priority: "1.0"
        },
        {
          loc: absoluteUrl(config, "/o-nas"),
          priority: "0.6"
        },
        {
          loc: absoluteUrl(config, "/informacje-prawne"),
          priority: "0.4"
        },
        ...categories.map((category) => ({
          loc: absoluteUrl(config, categoryPath(category)),
          priority: "0.7"
        })),
        ...storefront.products.map((product) => ({
          loc: absoluteUrl(config, productPath(product)),
          priority: "0.8"
        }))
      ];

      res.type("application/xml").send(renderSitemap(urls, storefront.updatedAt));
    })
  );

  return router;
}

function renderStorePage(config, storefront, { category = null, query = "", newestProducts = [] } = {}) {
  const normalizedQuery = query.trim().toLowerCase();
  const products = listingProducts(storefront.products, {
    categoryId: category?.id || "",
    query: normalizedQuery,
    newestProducts
  });
  const visibleProducts = products.slice(0, SSR_PRODUCT_LIMIT);
  const pageMeta = storePageMeta(config, { category, query: normalizedQuery, productCount: products.length });
  const categoryOptions = visibleCategories(storefront.categories);
  const categoryRail = renderCategoryRail(config, categoryOptions, {
    activeCategoryId: category?.id || "",
    totalCount: storefront.meta?.productCount || storefront.products.length
  });
  const categorySelect = renderCategorySelect(categoryOptions, category?.id || "");
  const itemListSchema = JSON.stringify(itemListJsonLd(config, visibleProducts)).replaceAll("</", "<\\/");
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
  <meta name="twitter:card" content="summary_large_image">
  <title>${escapeHtml(pageMeta.title)}</title>
  <script type="application/ld+json">${siteSchema}</script>
  <script type="application/ld+json">${itemListSchema}</script>
  ${breadcrumbSchema ? `<script type="application/ld+json">${breadcrumbSchema}</script>` : ""}
  <link rel="preload" as="image" href="${appPath(config.basePath, `/assets/img/loft-hero.jpg?v=${config.version}`)}" fetchpriority="high">
  <link rel="preload" as="image" href="${appPath(config.basePath, `/assets/img/logo.png?v=${config.version}`)}" fetchpriority="high">
  <link rel="stylesheet" href="${appPath(config.basePath, `/assets/css/fonts.css?v=${config.version}`)}">
  <link rel="icon" type="image/png" sizes="32x32" href="${appPath(config.basePath, `/assets/img/favicon-32.png?v=${config.version}`)}">
  <link rel="icon" type="image/png" sizes="512x512" href="${appPath(config.basePath, `/assets/img/favicon.png?v=${config.version}`)}">
  <link rel="apple-touch-icon" sizes="180x180" href="${appPath(config.basePath, `/assets/img/apple-touch-icon.png?v=${config.version}`)}">
  <link rel="stylesheet" href="${appPath(config.basePath, `/assets/css/styles.css?v=${config.version}`)}">
  <script>
    window.BOOKLOFT_INITIAL_CATEGORY_ID=${JSON.stringify(category?.id || "")};
    window.BOOKLOFT_INITIAL_QUERY=${JSON.stringify(normalizedQuery)};
    window.BOOKLOFT_INITIAL_PRODUCT_IDS=${JSON.stringify(visibleProducts.map((product) => String(product.id)))};
    window.BOOKLOFT_ANALYTICS_ID=${JSON.stringify(config.googleAnalyticsId || "")};
  </script>
  <script defer src="${appPath(config.basePath, `/assets/js/analytics.js?v=${config.version}`)}"></script>
  <script defer src="${appPath(config.basePath, `/assets/js/store.js?v=${config.version}`)}"></script>
</head>
<body>
  <div class="brand-intro is-visible" id="brand-intro">
    <div class="brand-intro-inner">
      <img src="${appPath(config.basePath, `/assets/img/logo.png?v=${config.version}`)}" alt="BookLoft">
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
          <img class="hero-logo" src="${appPath(config.basePath, `/assets/img/logo.png?v=${config.version}`)}" alt="BookLoft">
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

      <h2 class="listing-title" id="listing-title">${escapeHtml(pageMeta.listingTitle)}</h2>
      ${pageMeta.categoryNote ? `<p class="category-seo-note">${escapeHtml(pageMeta.categoryNote)}</p>` : ""}

      <div class="product-grid" id="product-grid" aria-busy="false">
        ${visibleProducts.map((product, index) => renderProductCard(product, index)).join("\n")}
      </div>
      <div class="load-sentinel" id="load-sentinel" aria-hidden="true" ${products.length > SSR_PRODUCT_LIMIT ? "" : "hidden"}></div>
      <div class="empty-state" id="empty-state" ${products.length ? "hidden" : ""}>
        <span class="empty-mark" aria-hidden="true">B</span>
        <h2>Nie znaleźliśmy pasujących ofert</h2>
        <p>Spróbuj krótszej frazy, nazwiska autora albo wybierz inną kategorię.</p>
        <button class="secondary-action" id="empty-reset" type="button">Pokaż wszystkie oferty</button>
      </div>
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
  <link rel="preload" as="image" href="${appPath(config.basePath, `/assets/img/loft-hero.jpg?v=${config.version}`)}" fetchpriority="high">
  <link rel="preload" as="image" href="${appPath(config.basePath, `/assets/img/logo.png?v=${config.version}`)}" fetchpriority="high">
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
        <img class="hero-logo" src="${appPath(config.basePath, `/assets/img/logo.png?v=${config.version}`)}" alt="BookLoft">
        <p>Przestrzeń pełna książek</p>
      </div>
    </a>
    <div class="product-trust-strip" aria-label="Atuty BookLoft">
      <div class="trust-track">
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
        <a class="details-action action-full" href="${link}" aria-label="Zobacz ${escapeAttribute(product.name)}">Zobacz</a>
      </div>
    </div>
  </article>`;
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
        <span><strong>100 000+</strong> książek w drugim obiegu</span>
        <span><strong>15 000+</strong> obsłużonych zamówień</span>
        <span><strong>4</strong> lata pracy z książkami</span>
      </div>
      <nav class="product-about-links" aria-label="Więcej o BookLoft">
        <a href="${appPath(config.basePath, "/o-nas")}">Więcej o nas</a>
        <a href="${appPath(config.basePath, "/informacje-prawne")}">Informacje prawne</a>
      </nav>
    </section>`;
}

function renderMissingProductPage(config, status) {
  const title = status === 410 ? "Oferta jest już niedostępna" : "Nie znaleziono oferty";
  return renderSimplePage(config, {
    status,
    title,
    description: "Ta oferta nie jest obecnie dostępna w katalogu BookLoft.",
    body: `<main class="shop-layout simple-page-shell">
      <section class="shop-surface simple-page">
        <a class="shop-brand-hero" href="${appPath(config.basePath, "/")}" aria-label="BookLoft - wróć na stronę główną">
          <div class="hero-brand-copy">
            <img class="hero-logo" src="${appPath(config.basePath, `/assets/img/logo.png?v=${config.version}`)}" alt="BookLoft">
            <p>Przestrzeń pełna książek</p>
          </div>
        </a>
        <div class="empty-state">
          <span class="empty-mark" aria-hidden="true">B</span>
          <h1>${escapeHtml(title)}</h1>
          <p>Tego egzemplarza nie ma już w katalogu. Wróć do aktualnych ofert i wybierz coś z dostępnego regału.</p>
          <a class="secondary-action" href="${appPath(config.basePath, "/")}">Wróć do ofert</a>
        </div>
      </section>
    </main>`
  });
}

function renderNotFoundPage(config, title) {
  return renderSimplePage(config, {
    status: 404,
    title,
    description: "Nie znaleziono strony w katalogu BookLoft.",
    body: `<main class="shop-layout simple-page-shell">
      <section class="shop-surface simple-page">
        <div class="empty-state">
          <span class="empty-mark" aria-hidden="true">B</span>
          <h1>${escapeHtml(title)}</h1>
          <p>Wróć do katalogu i sprawdź aktualne oferty.</p>
          <a class="secondary-action" href="${appPath(config.basePath, "/")}">Wróć do ofert</a>
        </div>
      </section>
    </main>`
  });
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
  <link rel="stylesheet" href="${appPath(config.basePath, `/assets/css/fonts.css?v=${config.version}`)}">
  <link rel="icon" type="image/png" sizes="32x32" href="${appPath(config.basePath, `/assets/img/favicon-32.png?v=${config.version}`)}">
  <link rel="stylesheet" href="${appPath(config.basePath, `/assets/css/styles.css?v=${config.version}`)}">
</head>
<body>
  ${body}
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

function storePageMeta(config, { category, query, productCount }) {
  if (query) {
    return {
      title: `Wyniki wyszukiwania: ${query} | BookLoft`,
      description: `Wyniki wyszukiwania "${query}" w katalogu BookLoft. Używane książki z rzetelnym opisem stanu i zakupem przez Allegro.`,
      canonical: category ? absoluteUrl(config, categoryPath(category)) : absoluteUrl(config, "/"),
      robots: "noindex,follow,max-image-preview:large",
      eyebrow: category ? category.displayName || category.name : "Wyszukiwanie",
      h1: "Wyniki wyszukiwania w BookLoft",
      copy: "Dopasowane oferty z katalogu BookLoft. Jeśli nie widzisz szukanej książki, spróbuj krótszej frazy albo nazwiska autora.",
      listingTitle: `Wyniki: ${query}`
    };
  }

  if (category) {
    const name = category.displayName || category.name;
    return {
      title: `${name} - używane produkty | BookLoft`,
      description: `${name} w BookLoft: używane produkty z realnymi zdjęciami, rzetelnym opisem stanu i zakupem przez Allegro.`,
      canonical: absoluteUrl(config, categoryPath(category)),
      robots: "index,follow,max-image-preview:large",
      eyebrow: "Kategoria",
      h1: name,
      copy: categoryIntroCopy(category),
      listingTitle: "Dostępne oferty"
    };
  }

  return {
    title: "BookLoft - używane książki z drugiego obiegu",
    description: "BookLoft - używane książki z realnymi zdjęciami, rzetelnym opisem stanu i zakupem finalizowanym na Allegro.",
    canonical: absoluteUrl(config, "/"),
    robots: "index,follow,max-image-preview:large",
    eyebrow: "Nowości z regału",
    h1: "Wybierz kolejną historię",
    copy: "Nowe tytuły z naszego regału. Przeglądaj ostatnio dodane oferty albo wyszukaj książkę po tytule, autorze lub gatunku.",
    listingTitle: "Nowości"
  };
}

function productJsonLd(config, product, url, image, description, category) {
  const identifiers = productIdentifiers(product);
  const publisher = productFeatureValue(product, ["wydawnictwo", "producent"]);
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
        hasMerchantReturnPolicy: { "@id": returnPolicyId(config) }
      };
  const productData = {
    "@type": "Product",
    "@id": `${url}#product`,
    name: schemaText(product.name, "Oferta BookLoft"),
    description: schemaText(description, "Używana książka dostępna w BookLoft."),
    image: cleanImageList(product.images?.length ? product.images : [image]),
    sku: schemaText(product.sku || product.id, String(product.id || "")),
    category: schemaText(category, "Książki używane"),
    brand: {
      "@type": "Brand",
      name: schemaText(publisher || "BookLoft", "BookLoft")
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

function returnPolicyId(config) {
  return absoluteUrl(config, "/informacje-prawne#return-policy");
}

function shippingPolicyId(config) {
  return absoluteUrl(config, "/informacje-prawne#shipping-policy");
}

function legalPolicyUrl(config) {
  return absoluteUrl(config, "/informacje-prawne#zwroty-dostawa");
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
      "@id": returnPolicyId(config),
      merchantReturnLink: legalPolicyUrl(config)
    },
    hasShippingService: {
      "@type": "ShippingService",
      "@id": shippingPolicyId(config),
      name: "Dostawa zgodnie z ofertą Allegro",
      description: "Metody, koszty i terminy dostawy są wybierane oraz potwierdzane w konkretnej ofercie Allegro.",
      url: legalPolicyUrl(config),
      areaServed: "PL",
      shippingConditions: {
        "@type": "ShippingConditions",
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "PL"
        }
      }
    }
  });
}

function itemListJsonLd(config, products) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.slice(0, 24).map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
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
  { label: "EAN", keys: ["ean", "kod producenta"] },
  { label: "Oprawa", keys: ["oprawa"] },
  { label: "Liczba stron", keys: ["liczba stron", "ilosc stron"] },
  { label: "Język", keys: ["jezyk"] }
];

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
  const specs = selectedProductFeatures(product.features || [], 8);
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

function selectedProductFeatures(features, limit = 8) {
  const normalizedFeatures = (features || [])
    .map((feature) => ({
      key: normalizeFeatureName(feature.name),
      name: String(feature.name || "").trim(),
      value: cleanSpecValue(feature.value)
    }))
    .filter((feature) => feature.key && feature.value);

  const selected = [];
  const usedKeys = new Set();
  for (const field of PRODUCT_SPEC_FIELDS) {
    const feature = normalizedFeatures.find((item) => field.keys.includes(item.key) && !usedKeys.has(item.key));
    if (!feature) continue;
    selected.push({ name: field.label, value: feature.value });
    usedKeys.add(feature.key);
    if (selected.length >= limit) break;
  }
  return selected;
}

function categoryIntroCopy(category) {
  const name = category.displayName || category.name || "Kategoria";
  return `Kategoria ${name} zawiera używane produkty z realnymi zdjęciami konkretnych egzemplarzy oraz opisem stanu.`;
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

function listingProducts(products, { categoryId = "", query = "", newestProducts = [] } = {}) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = products.filter((product) => {
    const matchesQuery = !normalizedQuery || String(product.searchText || "").includes(normalizedQuery);
    const matchesCategory =
      !categoryId || (product.categoryPath || []).some((category) => String(category.id) === String(categoryId));
    return matchesQuery && matchesCategory;
  });

  if (categoryId || normalizedQuery) return filtered;

  if (newestProducts.length) {
    const newestIds = new Set(newestProducts.map((product) => String(product.id)));
    const remaining = filtered
      .filter((product) => !newestIds.has(String(product.id)))
      .sort((a, b) => {
        const dateDiff = productFreshnessTime(b) - productFreshnessTime(a);
        if (dateDiff) return dateDiff;
        return sortProductIdDesc(a.id, b.id);
      });
    return [...newestProducts, ...remaining];
  }

  return [...filtered].sort((a, b) => {
    const dateDiff = productFreshnessTime(b) - productFreshnessTime(a);
    if (dateDiff) return dateDiff;
    return sortProductIdDesc(a.id, b.id);
  });
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

function categoryPath(category) {
  return `/kategoria/${encodeURIComponent(category.id)}/${encodeURIComponent(slugify(category.displayName || category.name))}`;
}

function absoluteUrl(config, relativePath) {
  return `${config.publicOrigin}${appPath(config.basePath, relativePath)}`;
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

function productIdentifiers(product) {
  const isbn = normalizeIsbn(productFeatureValue(product, ["isbn"]));
  const ean = normalizeDigits(productFeatureValue(product, ["ean", "kod ean", "kod producenta"]));
  const gtin = ean || (isbn.length === 13 ? isbn : "");
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
  return normalized.length === 10 || normalized.length === 13 ? normalized : "";
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
