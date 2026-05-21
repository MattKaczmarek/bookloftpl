const INITIAL_LIMIT = 50;
const PAGE_SIZE = 48;

const state = {
  products: [],
  newestProducts: [],
  categories: [],
  query: "",
  categoryId: "",
  rendered: 0,
  modeLimit: INITIAL_LIMIT,
  meta: {}
};

const els = {
  grid: document.querySelector("#product-grid"),
  empty: document.querySelector("#empty-state"),
  status: document.querySelector("#status-strip"),
  search: document.querySelector("#product-search"),
  categoryTree: document.querySelector("#category-tree"),
  categoryChips: document.querySelector("#category-chips"),
  categorySelect: document.querySelector("#category-select"),
  clearCategory: document.querySelector("#clear-category"),
  loadMore: document.querySelector("#load-more")
};

init().catch((error) => {
  els.status.textContent = `Nie udało się załadować sklepu: ${error.message}`;
});

async function init() {
  const [response, newestResponse] = await Promise.all([
    fetch("/api/storefront", { credentials: "same-origin" }),
    fetch("/api/newest?limit=50", { credentials: "same-origin" })
  ]);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const newestData = newestResponse.ok ? await newestResponse.json() : { products: [] };

  state.products = Array.isArray(data.products) ? data.products : [];
  state.newestProducts = Array.isArray(newestData.products) ? newestData.products : [];
  state.categories = Array.isArray(data.categories) ? data.categories : [];
  state.meta = data.meta || {};

  bindEvents();
  renderCategories();
  resetAndRender();
}

function bindEvents() {
  els.search.addEventListener("input", debounce(() => {
    state.query = els.search.value.trim().toLowerCase();
    state.modeLimit = state.query || state.categoryId ? PAGE_SIZE : INITIAL_LIMIT;
    resetAndRender();
  }, 120));

  els.categorySelect.addEventListener("change", () => {
    state.categoryId = els.categorySelect.value;
    state.modeLimit = state.query || state.categoryId ? PAGE_SIZE : INITIAL_LIMIT;
    syncCategoryButtons();
    resetAndRender();
  });

  els.clearCategory.addEventListener("click", () => {
    state.categoryId = "";
    els.categorySelect.value = "";
    state.modeLimit = state.query ? PAGE_SIZE : INITIAL_LIMIT;
    syncCategoryButtons();
    resetAndRender();
  });

  els.loadMore.addEventListener("click", () => {
    state.modeLimit += PAGE_SIZE;
    renderProducts();
  });
}

function renderCategories() {
  els.categoryTree.innerHTML = "";
  els.categoryChips.innerHTML = "";

  const flat = visibleCategories(state.categories);
  els.categoryTree.appendChild(categoryList(flat.slice(0, 36)));

  for (const category of flat.slice(0, 80)) {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.displayName || category.name;
    els.categorySelect.appendChild(option);
  }

  const chipCategories = flat
    .slice(0, 12);

  for (const category of chipCategories) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-chip";
    button.dataset.categoryId = category.id;
    button.textContent = category.displayName || category.name;
    button.addEventListener("click", () => {
      state.categoryId = category.id;
      els.categorySelect.value = category.id;
      state.modeLimit = PAGE_SIZE;
      syncCategoryButtons();
      resetAndRender();
    });
    els.categoryChips.appendChild(button);
  }
}

function categoryList(categories) {
  const list = document.createElement("ul");
  for (const category of categories) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-button";
    button.dataset.categoryId = category.id;
    button.innerHTML = `<span>${escapeHtml(category.displayName || category.name)}</span><small>${category.totalProductCount || category.productCount || ""}</small>`;
    button.addEventListener("click", () => {
      state.categoryId = category.id;
      els.categorySelect.value = category.id;
      state.modeLimit = PAGE_SIZE;
      syncCategoryButtons();
      resetAndRender();
    });
    item.appendChild(button);
    list.appendChild(item);
  }
  return list;
}

function resetAndRender() {
  state.rendered = 0;
  els.grid.innerHTML = "";
  renderProducts();
}

function renderProducts() {
  const filteredMode = Boolean(state.query || state.categoryId);
  const products = filteredMode ? filteredProducts() : newestProducts();
  if (!filteredMode) state.modeLimit = INITIAL_LIMIT;
  const next = products.slice(state.rendered, state.modeLimit);
  const fragment = document.createDocumentFragment();

  for (const [index, product] of next.entries()) {
    fragment.appendChild(renderProduct(product, state.rendered + index));
  }

  els.grid.appendChild(fragment);
  state.rendered += next.length;
  els.empty.hidden = products.length > 0;
  els.loadMore.hidden = !filteredMode || state.rendered >= products.length;

  const filteredLabel = filteredMode
    ? `${products.length} wyników`
    : `Nowości: ${Math.min(INITIAL_LIMIT, products.length)} najświeższych ofert`;
  els.status.innerHTML = `<span>${filteredLabel}</span><span>${state.products.length} książek w katalogu</span>`;
}

function filteredProducts() {
  return state.products.filter((product) => {
    const matchesQuery = !state.query || String(product.searchText || "").includes(state.query);
    const matchesCategory =
      !state.categoryId || (product.categoryPath || []).some((category) => String(category.id) === state.categoryId);
    return matchesQuery && matchesCategory;
  });
}

function newestProducts() {
  return state.newestProducts.length ? state.newestProducts.slice(0, INITIAL_LIMIT) : state.products.slice(0, INITIAL_LIMIT);
}

function renderProduct(product, index = 0) {
  const link = productUrl(product);
  const card = document.createElement("article");
  card.className = "product-card";
  card.setAttribute("itemscope", "");
  card.setAttribute("itemtype", "https://schema.org/Product");
  card.style.setProperty("--card-delay", `${Math.min(index, 16) * 28}ms`);

  const image = product.images && product.images.length ? product.images[0] : "";
  const price = product.price === null ? "Cena do ustalenia" : formatPrice(product.price, product.currency);
  const imagePriority = index < 6 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';

  card.innerHTML = `
    <a class="product-media${image ? "" : " is-loaded"}" href="${link}" aria-label="${escapeAttribute(product.name)}" itemprop="url">
      ${image ? `<img src="${escapeAttribute(image)}" ${imagePriority} decoding="async" alt="${escapeAttribute(product.name)}" itemprop="image">` : '<div class="image-fallback">BookLoft</div>'}
    </a>
    <div class="product-body">
      <span class="product-category">${escapeHtml(product.categoryName || "Książka")}</span>
      <h2><a href="${link}" itemprop="name">${escapeHtml(product.name)}</a></h2>
      <div class="price-row" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
        <strong>${price}</strong>
        ${product.price === null ? "" : `<meta itemprop="price" content="${escapeAttribute(product.price)}"><meta itemprop="priceCurrency" content="${escapeAttribute(product.currency || "PLN")}">`}
        <link itemprop="availability" href="https://schema.org/InStock">
        <link itemprop="itemCondition" href="https://schema.org/UsedCondition">
      </div>
      <a class="details-action" href="${link}" aria-label="Zobacz ${escapeAttribute(product.name)}">Zobacz</a>
    </div>
  `;

  const img = card.querySelector("img");
  if (img) {
    const media = card.querySelector(".product-media");
    const markLoaded = () => media.classList.add("is-loaded");
    if (img.complete) markLoaded();
    else img.addEventListener("load", markLoaded, { once: true });
    img.addEventListener("error", () => {
      img.replaceWith(Object.assign(document.createElement("div"), { className: "image-fallback", textContent: "BookLoft" }));
      media.classList.add("is-loaded");
    });
  }

  return card;
}

function syncCategoryButtons() {
  document.querySelectorAll(".category-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.categoryId === state.categoryId);
  });
  document.querySelectorAll(".category-chip").forEach((button) => {
    button.classList.toggle("active", button.dataset.categoryId === state.categoryId);
  });
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

function productUrl(product) {
  return `/product/${encodeURIComponent(product.id)}/${encodeURIComponent(product.slug || "produkt")}`;
}

function formatPrice(value, currency) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: currency || "PLN"
  }).format(value);
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
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
