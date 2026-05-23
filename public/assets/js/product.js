const page = document.querySelector("#product-page");
const productSearchForm = document.querySelector("#product-search-form");
const productSearchInput = document.querySelector("#product-page-search");

productSearchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = productSearchInput?.value.trim() || "";
  const url = new URL("/", window.location.origin);
  if (query) url.searchParams.set("q", query);
  window.location.href = `${url.pathname}${url.search}`;
});

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
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const image = images.length ? images[0] : "";
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
      </section>
    </article>
        <section class="detail-description">
          <h2>Opis</h2>
          <div class="description">${product.descriptionHtml || "<p>Brak opisu.</p>"}</div>
        </section>
        ${renderRelated(product.related || [])}
        ${renderProductAbout()}
      </div>
    </div>
  `;

  initProductGallery(images, product.name);
  renderProductCategories(product.categoryId);
}

function initProductGallery(images, productName) {
  if (!images.length) return;

  let currentIndex = 0;
  const mainImage = page.querySelector("[data-gallery-main]");
  const thumbButtons = [...page.querySelectorAll("[data-image-index]")];
  const previousButton = page.querySelector("[data-gallery-prev]");
  const nextButton = page.querySelector("[data-gallery-next]");
  const openButton = page.querySelector("[data-gallery-open]");

  function setImage(nextIndex) {
    currentIndex = wrapImageIndex(nextIndex, images.length);
    if (mainImage) {
      mainImage.src = images[currentIndex];
      mainImage.alt = `${productName} - zdjęcie ${currentIndex + 1}`;
    }
    thumbButtons.forEach((button) => {
      const active = Number(button.dataset.imageIndex) === currentIndex;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "true" : "false");
    });
  }

  thumbButtons.forEach((button) => {
    button.addEventListener("click", () => setImage(Number(button.dataset.imageIndex || 0)));
  });
  previousButton?.addEventListener("click", () => setImage(currentIndex - 1));
  nextButton?.addEventListener("click", () => setImage(currentIndex + 1));
  openButton?.addEventListener("click", () => openImageLightbox(images, currentIndex, productName));
  setImage(0);
}

function openImageLightbox(images, startIndex, productName) {
  if (!images.length) return;

  let currentIndex = wrapImageIndex(startIndex, images.length);
  let zoomScale = 1;
  let panX = 0;
  let panY = 0;
  let panStart = null;
  const dialog = document.createElement("div");
  dialog.className = "image-lightbox";
  dialog.tabIndex = -1;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Podgląd zdjęcia produktu");
  dialog.innerHTML = `
    <button class="lightbox-close" type="button" data-lightbox-close aria-label="Zamknij podgląd">&times;</button>
    ${images.length > 1 ? '<button class="lightbox-arrow lightbox-arrow-prev" type="button" data-lightbox-prev aria-label="Poprzednie zdjęcie">&lsaquo;</button>' : ""}
    <div class="lightbox-stage">
      <img src="${escapeAttribute(images[currentIndex])}" alt="${escapeAttribute(productName)} - zdjęcie ${currentIndex + 1}" data-lightbox-image>
    </div>
    ${images.length > 1 ? '<button class="lightbox-arrow lightbox-arrow-next" type="button" data-lightbox-next aria-label="Następne zdjęcie">&rsaquo;</button>' : ""}
    <span class="lightbox-counter" data-lightbox-counter></span>
  `;

  const stage = dialog.querySelector(".lightbox-stage");
  const image = dialog.querySelector("[data-lightbox-image]");
  const counter = dialog.querySelector("[data-lightbox-counter]");

  function render() {
    image.src = images[currentIndex];
    image.alt = `${productName} - zdjęcie ${currentIndex + 1}`;
    counter.textContent = `${currentIndex + 1} / ${images.length}`;
    updateZoom();
  }

  function setLightboxImage(nextIndex) {
    currentIndex = wrapImageIndex(nextIndex, images.length);
    zoomScale = 1;
    panX = 0;
    panY = 0;
    render();
  }

  function close() {
    document.removeEventListener("keydown", onKeyDown);
    document.body.classList.remove("modal-open");
    dialog.remove();
  }

  function updateZoom() {
    if (zoomScale <= 1.01) {
      panX = 0;
      panY = 0;
    }
    clampPan();
    dialog.style.setProperty("--lightbox-zoom", zoomScale.toFixed(2));
    dialog.style.setProperty("--lightbox-pan-x", `${panX.toFixed(1)}px`);
    dialog.style.setProperty("--lightbox-pan-y", `${panY.toFixed(1)}px`);
    dialog.classList.toggle("is-zoomed", zoomScale > 1.01);
  }

  function zoomWithWheel(event) {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    zoomScale = clamp(zoomScale + direction * 0.16, 1, 2.6);
    updateZoom();
  }

  function startPan(event) {
    if (zoomScale <= 1.01 || event.button !== 0) return;
    event.preventDefault();
    panStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX,
      panY
    };
    dialog.classList.add("is-panning");
    image.setPointerCapture?.(event.pointerId);
  }

  function movePan(event) {
    if (!panStart || event.pointerId !== panStart.pointerId) return;
    event.preventDefault();
    panX = panStart.panX + event.clientX - panStart.x;
    panY = panStart.panY + event.clientY - panStart.y;
    clampPan();
    dialog.style.setProperty("--lightbox-pan-x", `${panX.toFixed(1)}px`);
    dialog.style.setProperty("--lightbox-pan-y", `${panY.toFixed(1)}px`);
  }

  function stopPan(event) {
    if (panStart && event.pointerId === panStart.pointerId && image.hasPointerCapture?.(event.pointerId)) {
      image.releasePointerCapture(event.pointerId);
    }
    panStart = null;
    dialog.classList.remove("is-panning");
  }

  function clampPan() {
    if (!stage || !image || zoomScale <= 1.01) return;
    const maxX = Math.max(0, ((image.clientWidth || 0) * zoomScale - (stage.clientWidth || 0)) / 2 + 32);
    const maxY = Math.max(0, ((image.clientHeight || 0) * zoomScale - (stage.clientHeight || 0)) / 2 + 32);
    panX = clamp(panX, -maxX, maxX);
    panY = clamp(panY, -maxY, maxY);
  }

  function onKeyDown(event) {
    if (event.key === "Escape") close();
    if (event.key === "ArrowLeft") setLightboxImage(currentIndex - 1);
    if (event.key === "ArrowRight") setLightboxImage(currentIndex + 1);
  }

  dialog.querySelector("[data-lightbox-close]")?.addEventListener("click", close);
  dialog.querySelector("[data-lightbox-prev]")?.addEventListener("click", () => setLightboxImage(currentIndex - 1));
  dialog.querySelector("[data-lightbox-next]")?.addEventListener("click", () => setLightboxImage(currentIndex + 1));
  stage?.addEventListener("wheel", zoomWithWheel, { passive: false });
  image?.addEventListener("pointerdown", startPan);
  image?.addEventListener("pointermove", movePan);
  image?.addEventListener("pointerup", stopPan);
  image?.addEventListener("pointercancel", stopPan);
  image?.addEventListener("lostpointercapture", stopPan);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  document.addEventListener("keydown", onKeyDown);
  document.body.classList.add("modal-open");
  document.body.appendChild(dialog);
  render();
  dialog.focus({ preventScroll: true });
}

function wrapImageIndex(index, length) {
  return ((index % length) + length) % length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function renderProductAbout() {
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
        <a href="/o-nas">Więcej o nas</a>
        <a href="/informacje-prawne">Informacje prawne</a>
      </nav>
    </section>`;
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
