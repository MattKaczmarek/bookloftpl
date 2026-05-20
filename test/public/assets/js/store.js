const INITIAL_LIMIT = 20;
const PAGE_SIZE = 48;

const state = {
  products: [],
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
  els.status.textContent = `Nie udalo sie zaladowac sklepu: ${error.message}`;
});

async function init() {
  const response = await fetch("/test/api/storefront", { credentials: "same-origin" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();

  state.products = Array.isArray(data.products) ? data.products : [];
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
  els.categoryTree.appendChild(categoryList(state.categories));

  const flat = flattenCategories(state.categories);
  for (const category of flat) {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = `${"  ".repeat(category.depth)}${category.displayName || category.name}`;
    els.categorySelect.appendChild(option);
  }

  const chipCategories = flat
    .filter((category) => category.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount)
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
    button.innerHTML = `<span>${escapeHtml(category.displayName || category.name)}</span><small>${category.productCount || ""}</small>`;
    button.addEventListener("click", () => {
      state.categoryId = category.id;
      els.categorySelect.value = category.id;
      state.modeLimit = PAGE_SIZE;
      syncCategoryButtons();
      resetAndRender();
    });
    item.appendChild(button);
    if (category.children && category.children.length) item.appendChild(categoryList(category.children));
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
  const products = filteredProducts();
  const filteredMode = Boolean(state.query || state.categoryId);
  if (!filteredMode) state.modeLimit = INITIAL_LIMIT;
  const next = products.slice(state.rendered, state.modeLimit);
  const fragment = document.createDocumentFragment();

  for (const product of next) {
    fragment.appendChild(renderProduct(product));
  }

  els.grid.appendChild(fragment);
  state.rendered += next.length;
  els.empty.hidden = products.length > 0;
  els.loadMore.hidden = !filteredMode || state.rendered >= products.length;

  const filteredLabel = filteredMode ? `${products.length} wynikow` : `${Math.min(INITIAL_LIMIT, products.length)} na start`;
  const updated = state.meta.priceGroupName ? `Ceny: ${state.meta.priceGroupName}` : "Ceny: Sklep";
  els.status.innerHTML = `<span>${filteredLabel} z ${state.products.length} produktow</span><span>${updated}</span>`;
}

function filteredProducts() {
  return state.products.filter((product) => {
    const matchesQuery = !state.query || String(product.searchText || "").includes(state.query);
    const matchesCategory =
      !state.categoryId || (product.categoryPath || []).some((category) => String(category.id) === state.categoryId);
    return matchesQuery && matchesCategory;
  });
}

function renderProduct(product) {
  const link = productUrl(product);
  const card = document.createElement("article");
  card.className = "product-card";

  const image = product.images && product.images.length ? product.images[0] : "";
  const price = product.price === null ? "Cena do ustalenia" : formatPrice(product.price, product.currency);

  card.innerHTML = `
    <a class="product-media" href="${link}" aria-label="${escapeAttribute(product.name)}">
      ${image ? `<img src="${escapeAttribute(image)}" loading="lazy" alt="${escapeAttribute(product.name)}">` : '<div class="image-fallback">BookLoft</div>'}
    </a>
    <div class="product-body">
      <div class="product-meta">
        <span>${escapeHtml(product.categoryName || "Bez kategorii")}</span>
        <strong>${Number(product.stock || 0)} szt.</strong>
      </div>
      <h2><a href="${link}">${escapeHtml(product.name)}</a></h2>
      <div class="price-row">
        <strong>${price}</strong>
        ${product.sku ? `<small>SKU ${escapeHtml(product.sku)}</small>` : ""}
      </div>
      <p class="description-teaser">${escapeHtml(product.descriptionText || "Opis produktu dostepny po wejsciu w szczegoly.")}</p>
      <div class="product-actions">
        <button type="button" class="primary-action">Kup</button>
        <button type="button" class="secondary-action">Koszyk</button>
      </div>
    </div>
  `;

  const img = card.querySelector("img");
  if (img) {
    img.addEventListener("error", () => {
      img.replaceWith(Object.assign(document.createElement("div"), { className: "image-fallback", textContent: "BookLoft" }));
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

function productUrl(product) {
  return `/test/product/${encodeURIComponent(product.id)}/${encodeURIComponent(product.slug || "produkt")}`;
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
