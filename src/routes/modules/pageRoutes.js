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
      const storefront = await storeCache.getStorefront();
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
      res.type("html").send(renderStorePage(config, storefront, { category, query }));
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

function renderStorePage(config, storefront, { category = null, query = "" } = {}) {
  const normalizedQuery = query.trim().toLowerCase();
  const products = listingProducts(storefront.products, { categoryId: category?.id || "", query: normalizedQuery });
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
  <link rel="stylesheet" href="${appPath(config.basePath, `/assets/css/fonts.css?v=${config.version}`)}">
  <link rel="icon" type="image/png" sizes="32x32" href="${appPath(config.basePath, `/assets/img/favicon-32.png?v=${config.version}`)}">
  <link rel="icon" type="image/png" sizes="512x512" href="${appPath(config.basePath, `/assets/img/favicon.png?v=${config.version}`)}">
  <link rel="apple-touch-icon" sizes="180x180" href="${appPath(config.basePath, `/assets/img/apple-touch-icon.png?v=${config.version}`)}">
  <link rel="stylesheet" href="${appPath(config.basePath, `/assets/css/styles.css?v=${config.version}`)}">
  <script>
    window.BOOKLOFT_INITIAL_CATEGORY_ID=${JSON.stringify(category?.id || "")};
    window.BOOKLOFT_INITIAL_QUERY=${JSON.stringify(normalizedQuery)};
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
            <input id="product-search" type="search" value="${escapeAttribute(query)}" placeholder="Sprawdź czy mamy to czego szukasz ...">
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

      <div class="product-grid" id="product-grid" aria-busy="false">
        ${visibleProducts.map((product, index) => renderProductCard(product, index)).join("\n")}
      </div>
      <div class="load-sentinel" id="load-sentinel" aria-hidden="true" ${products.length > SSR_PRODUCT_LIMIT ? "" : "hidden"}></div>
      <div class="empty-state" id="empty-state" ${products.length ? "hidden" : ""}>
        <span class="empty-mark" aria-hidden="true">B</span>
        <h2>Nie znaleźliśmy tego tytułu</h2>
        <p>Spróbuj krótszej frazy, innego autora albo wróć do wszystkich ofert.</p>
        <button class="secondary-action" id="empty-reset" type="button">Pokaż wszystkie oferty</button>
      </div>
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
  const jsonLd = JSON.stringify(productJsonLd(product, productUrl, image, description, category)).replaceAll("</", "<\\/");
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
        <span>Eko przesyłka</span>
        <span>Szybka wysyłka</span>
        <span>Niskie ceny</span>
        <span>Drugie życie książek</span>
        <span>Książki z charakterem</span>
        <span>Zakup przez Allegro</span>
        <span>Eko przesyłka</span>
        <span>Szybka wysyłka</span>
        <span>Niskie ceny</span>
        <span>Drugie życie książek</span>
      </div>
    </div>
    <form class="product-search-box search-box" id="product-search-form" action="${appPath(config.basePath, "/")}" role="search">
      <label class="visually-hidden" for="product-page-search">Szukaj</label>
      <input id="product-page-search" name="q" type="search" placeholder="Sprawdź czy mamy to czego szukasz ...">
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
  const stockLabel = stock > 1 ? `${stock} szt. na półce` : "Dostępna na półce";
  const allegroUrl = product.allegroUrl || `https://allegro.pl/oferta/${encodeURIComponent(product.id)}`;

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
        <nav class="breadcrumbs" aria-label="Ścieżka">
          <span>${escapeHtml(category)}</span>
        </nav>
        <article class="product-detail" itemscope itemtype="https://schema.org/Product">
          <section class="detail-gallery">
            <div class="gallery-main">
              ${images.length > 1 ? '<button class="gallery-arrow gallery-arrow-prev" type="button" data-gallery-prev aria-label="Poprzednie zdjęcie">&lsaquo;</button>' : ""}
              ${image ? `
                <button class="detail-main-trigger" type="button" data-gallery-open aria-label="Otwórz zdjęcie produktu">
                  <img class="detail-main-image" src="${escapeAttribute(image)}" alt="${escapeAttribute(product.name)}" itemprop="image" data-gallery-main>
                </button>
              ` : '<div class="image-fallback">BookLoft</div>'}
              ${images.length > 1 ? '<button class="gallery-arrow gallery-arrow-next" type="button" data-gallery-next aria-label="Następne zdjęcie">&rsaquo;</button>' : ""}
            </div>
            <div class="thumb-strip">
              ${images.slice(0, 8).map((src, index) => `
                <button class="thumb-button${index === 0 ? " active" : ""}" type="button" data-image-index="${index}" aria-label="Pokaż zdjęcie ${index + 1}">
                  <img src="${escapeAttribute(src)}" alt="">
                </button>
              `).join("")}
            </div>
          </section>
          <section class="detail-info">
            <p class="eyebrow">${escapeHtml(category)}</p>
            <h1 itemprop="name">${escapeHtml(product.name)}</h1>
            <div class="detail-purchase" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
              <strong>${price}</strong>
              ${product.price === null ? "" : `<meta itemprop="price" content="${escapeAttribute(product.price)}"><meta itemprop="priceCurrency" content="${escapeAttribute(product.currency || "PLN")}">`}
              <link itemprop="availability" href="${stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"}">
              <link itemprop="itemCondition" href="https://schema.org/UsedCondition">
              <span>${stockLabel}</span>
            </div>
            <div class="detail-actions">
              <a class="buy-action" href="${escapeAttribute(allegroUrl)}" target="_blank" rel="noopener noreferrer">Kup na Allegro</a>
            </div>
            <p class="purchase-note">Zakup, płatność, dostawa, zwrot i reklamacja odbywają się bezpośrednio w Allegro.</p>
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
  const image = product.images && product.images.length ? product.images[0] : "";
  const price = product.price === null ? "Cena do ustalenia" : formatPrice(product.price, product.currency);
  const imagePriority = index < 6 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';

  return `<article class="product-card" itemscope itemtype="https://schema.org/Product" style="--card-delay: ${Math.min(index, 16) * 28}ms">
    <a class="product-media${image ? " is-loaded" : " is-loaded"}" href="${link}" aria-label="${escapeAttribute(product.name)}" itemprop="url">
      ${image ? `<img src="${escapeAttribute(image)}" ${imagePriority} decoding="async" alt="${escapeAttribute(product.name)}" itemprop="image">` : '<div class="image-fallback">BookLoft</div>'}
    </a>
    <div class="product-body">
      <span class="product-category">${escapeHtml(product.categoryName || leafCategoryName(product) || "Książka")}</span>
      <h2><a href="${link}" itemprop="name">${escapeHtml(product.name)}</a></h2>
      <div class="price-row" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
        <strong>${price}</strong>
        ${product.price === null ? "" : `<meta itemprop="price" content="${escapeAttribute(product.price)}"><meta itemprop="priceCurrency" content="${escapeAttribute(product.currency || "PLN")}">`}
        <link itemprop="availability" href="https://schema.org/InStock">
        <link itemprop="itemCondition" href="https://schema.org/UsedCondition">
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
  const image = product.images && product.images.length ? product.images[0] : "";
  return `
    <a class="related-card" href="${productPath(product)}" itemscope itemtype="https://schema.org/Product">
      <span class="related-thumb">
        ${image ? `<img src="${escapeAttribute(image)}" loading="lazy" decoding="async" alt="" itemprop="image">` : "<span>BookLoft</span>"}
      </span>
      <span class="related-copy">
        <span itemprop="name">${escapeHtml(product.name)}</span>
        <strong itemprop="offers" itemscope itemtype="https://schema.org/Offer">
          ${product.price === null ? "Cena do ustalenia" : formatPrice(product.price, product.currency)}
          ${product.price === null ? "" : `<meta itemprop="price" content="${escapeAttribute(product.price)}"><meta itemprop="priceCurrency" content="${escapeAttribute(product.currency || "PLN")}">`}
          <link itemprop="availability" href="https://schema.org/InStock">
          <link itemprop="itemCondition" href="https://schema.org/UsedCondition">
        </strong>
      </span>
    </a>
  `;
}

function renderProductAbout(config) {
  return `
    <section class="shop-about product-about" id="o-nas" aria-labelledby="product-about-title">
      <p class="eyebrow">O BookLoft</p>
      <h2 id="product-about-title">Książki z drugiego obiegu, gotowe na kolejną historię</h2>
      <div class="shop-about-copy">
        <p>
          Każdą książkę starannie fotografujemy i pokazujemy realny egzemplarz, który trafia do oferty.
          Dzięki temu przed zakupem widać okładkę, grzbiet i najważniejsze szczegóły stanu.
        </p>
        <p>
          Dokładnie opisujemy widoczne ślady używania oraz dodatkowe uwagi, żeby klient otrzymał dokładnie to,
          co widzi w ofercie, a potem bezpiecznie pakujemy zamówienie do wysyłki.
        </p>
      </div>
      <div class="shop-about-stats" aria-label="BookLoft w liczbach">
        <span><strong>100 000+</strong> uratowanych książek</span>
        <span><strong>15 000+</strong> zadowolonych klientów</span>
        <span><strong>4</strong> lata doświadczenia</span>
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
          <p>Ten tytuł nie jest teraz na regale. Wróć do katalogu i sprawdź inne książki.</p>
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
      description: `Wyniki wyszukiwania "${query}" w katalogu BookLoft. Sprawdzone używane książki, realne zdjęcia i zakup przez Allegro.`,
      canonical: category ? absoluteUrl(config, categoryPath(category)) : absoluteUrl(config, "/"),
      robots: "noindex,follow,max-image-preview:large",
      eyebrow: category ? category.displayName || category.name : "Wyszukiwanie",
      h1: "Wyniki wyszukiwania w BookLoft",
      copy: `${productCount} wyników dla wpisanej frazy. Jeśli nie widzisz tytułu, spróbuj krótszego zapytania albo nazwiska autora.`,
      listingTitle: `Wyniki: ${query}`
    };
  }

  if (category) {
    const name = category.displayName || category.name;
    return {
      title: `${name} - używane książki | BookLoft`,
      description: `${name} w BookLoft: używane książki z realnymi zdjęciami, dokładnymi opisami stanu i zakupem przez Allegro.`,
      canonical: absoluteUrl(config, categoryPath(category)),
      robots: "index,follow,max-image-preview:large",
      eyebrow: "Kategoria",
      h1: `${name} w BookLoft`,
      copy: `Przeglądaj ${productCount} ofert z tej kategorii. Każda książka ma realne zdjęcia i opis konkretnego egzemplarza.`,
      listingTitle: name
    };
  }

  return {
    title: "BookLoft - używane książki z drugiego obiegu",
    description: "BookLoft - używane książki z drugiego obiegu. Sprawdzone egzemplarze, realne zdjęcia, dokładne opisy stanu i zakup przez Allegro.",
    canonical: absoluteUrl(config, "/"),
    robots: "index,follow,max-image-preview:large",
    eyebrow: "Nowości z regału",
    h1: "Wybierz kolejną historię",
    copy: "Najświeższe tytuły z naszego regału. Przejrzyj nowości albo wyszukaj książkę po tytule, autorze czy ulubionym gatunku.",
    listingTitle: "Nowości"
  };
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
        url: product.allegroUrl || url,
        seller: {
          "@type": "Organization",
          name: "BookLoft"
        }
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

function siteJsonLd(config) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${config.publicOrigin}/#organization`,
        name: "BookLoft",
        url: `${config.publicOrigin}/`,
        logo: absoluteUrl(config, "/assets/img/logo.png"),
        email: "bookloft.store@gmail.com",
        telephone: "+48518104941"
      },
      {
        "@type": "WebSite",
        "@id": `${config.publicOrigin}/#website`,
        url: `${config.publicOrigin}/`,
        name: "BookLoft",
        publisher: { "@id": `${config.publicOrigin}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${config.publicOrigin}/?q={search_term_string}`,
          "query-input": "required name=search_term_string"
        }
      }
    ]
  };
}

function itemListJsonLd(config, products) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.slice(0, 24).map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(config, productPath(product)),
      name: product.name
    }))
  };
}

function listingProducts(products, { categoryId = "", query = "" } = {}) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = products.filter((product) => {
    const matchesQuery = !normalizedQuery || String(product.searchText || "").includes(normalizedQuery);
    const matchesCategory =
      !categoryId || (product.categoryPath || []).some((category) => String(category.id) === String(categoryId));
    return matchesQuery && matchesCategory;
  });

  if (categoryId || normalizedQuery) return filtered;

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
  const text = stripHtml(product.descriptionHtml || product.searchText || "");
  const suffix = "Książka z drugiego obiegu dostępna w BookLoft, sprawdzona i gotowa na kolejną historię.";
  const combined = `${product.name}. ${text || suffix}`;
  return combined.replace(/\s+/g, " ").slice(0, 158);
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
