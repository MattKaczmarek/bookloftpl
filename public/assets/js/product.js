const page = document.querySelector("#product-page");

init().catch((error) => {
  page.innerHTML = `<div class="empty-state"><h1>Nie udało się załadować produktu</h1><p>${escapeHtml(error.message)}</p></div>`;
});

async function init() {
  const productId = productIdFromPath();
  if (!productId) throw new Error("Brak identyfikatora produktu");

  const product = window.__BOOKLOFT_PRODUCT__ || await fetchProduct(productId);
  if (!product) return;
  document.title = `${product.name} | BookLoft`;
  updateMeta(product);
  renderProduct(product);
}

async function fetchProduct(productId) {
  const response = await fetch(`/api/products/${encodeURIComponent(productId)}`, { credentials: "same-origin" });
  if (response.status === 404) {
    page.innerHTML = '<div class="empty-state"><h1>Produkt niedostępny</h1><p>Ten tytuł nie jest teraz na regale.</p></div>';
    return null;
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function renderProduct(product) {
  const image = product.images && product.images.length ? product.images[0] : "";
  const price = product.price === null ? "Cena do ustalenia" : formatPrice(product.price, product.currency);
  const displayCategoryPath = visibleCategoryPath(product.categoryPath || []);
  const category = displayCategoryPath.length
    ? displayCategoryPath.map((item) => item.displayName || item.name).join(" / ")
    : "Bez kategorii";
  const stock = Number(product.stock || 0);
  const stockLabel = stock > 1 ? `${stock} szt. na półce` : "Dostępna na półce";
  const allegroUrl = product.allegroUrl || `https://allegro.pl/oferta/${encodeURIComponent(product.id)}`;

  page.innerHTML = `
    <div class="product-layout">
      <aside class="category-rail product-category-rail" aria-label="Kategorie">
        <div class="rail-head">
          <span>Kategorie</span>
        </div>
        <div id="product-category-tree" class="category-tree"></div>
      </aside>
      <div class="product-content">
        <nav class="breadcrumbs" aria-label="Sciezka">
          <span>${escapeHtml(category)}</span>
        </nav>
        <article class="product-detail" itemscope itemtype="https://schema.org/Product">
          <section class="detail-gallery">
            ${image ? `<img class="detail-main-image" src="${escapeAttribute(image)}" alt="${escapeAttribute(product.name)}" itemprop="image">` : '<div class="image-fallback">BookLoft</div>'}
            <div class="thumb-strip">
              ${(product.images || []).slice(0, 6).map((src) => `<img src="${escapeAttribute(src)}" alt="">`).join("")}
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
      </section>
    </article>
        <section class="detail-description">
          <h2>Opis</h2>
          <div class="description">${product.descriptionHtml || "<p>Brak opisu.</p>"}</div>
        </section>
        ${renderRelated(product.related || [])}
      </div>
    </div>
  `;

  page.querySelectorAll(".thumb-strip img").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const main = page.querySelector(".detail-main-image");
      if (main) main.src = thumb.src;
    });
  });
  renderProductCategories(product.categoryId);
}

async function renderProductCategories(activeCategoryId) {
  const container = page.querySelector("#product-category-tree");
  if (!container) return;

  try {
    const response = await fetch("/api/storefront", { credentials: "same-origin" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const categories = visibleCategories(Array.isArray(data.categories) ? data.categories : []);
    container.appendChild(productCategoryList([
      {
        id: "",
        displayName: "Wszystkie oferty",
        totalProductCount: data.meta?.productCount || data.products?.length || ""
      },
      ...categories.slice(0, 36)
    ], activeCategoryId));
  } catch {
    container.innerHTML = `<ul><li><a class="category-button" href="/"><span>Wszystkie oferty</span></a></li></ul>`;
  }
}

function productCategoryList(categories, activeCategoryId) {
  const list = document.createElement("ul");
  for (const category of categories) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.className = "category-button";
    link.href = category.id ? `/?category=${encodeURIComponent(category.id)}` : "/";
    link.classList.toggle("active", String(category.id || "") === String(activeCategoryId || ""));
    link.innerHTML = `<span>${escapeHtml(category.displayName || category.name)}</span><small>${category.totalProductCount || category.productCount || ""}</small>`;
    item.appendChild(link);
    list.appendChild(item);
  }
  return list;
}

function flattenCategories(categories, depth = 0) {
  return categories.flatMap((category) => [
    { ...category, depth },
    ...flattenCategories(category.children || [], depth + 1)
  ]);
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

function visibleCategoryPath(categories) {
  return categories.filter((category) => !isGenericAllegroCategory(category));
}

function isGenericAllegroCategory(category) {
  const key = normalizeCategoryName(category.displayName || category.name);
  return key === "kultura i rozrywka" || key === "ksiazki";
}

function normalizeCategoryName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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
    <a class="related-card" href="/product/${encodeURIComponent(product.id)}/${encodeURIComponent(product.slug || "produkt")}" itemscope itemtype="https://schema.org/Product">
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

function updateMeta(product) {
  if (!product) return;
  const description = `${product.name}. Książka z drugiego obiegu dostępna w BookLoft, sprawdzona i gotowa na kolejną historię.`;
  setMeta("description", description);
  setMeta("og:title", product.name, "property");
  setMeta("og:description", description, "property");
  if (product.images && product.images.length) setMeta("og:image", product.images[0], "property");
}

function productIdFromPath() {
  const parts = location.pathname.split("/").filter(Boolean);
  const productIndex = parts.indexOf("product");
  return productIndex >= 0 ? parts[productIndex + 1] : "";
}

function setMeta(name, content, attribute = "name") {
  let tag = document.head.querySelector(`meta[${attribute}="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
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
