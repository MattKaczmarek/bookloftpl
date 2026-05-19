const state = {
  products: [],
  categories: [],
  query: "",
  categoryId: "",
  meta: {}
};

const els = {
  grid: document.querySelector("#product-grid"),
  empty: document.querySelector("#empty-state"),
  status: document.querySelector("#status-strip"),
  search: document.querySelector("#product-search"),
  categoryTree: document.querySelector("#category-tree"),
  categorySelect: document.querySelector("#category-select"),
  clearCategory: document.querySelector("#clear-category")
};

init().catch((error) => {
  els.status.textContent = `Nie udało się załadować sklepu: ${error.message}`;
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
  renderProducts();
}

function bindEvents() {
  els.search.addEventListener("input", () => {
    state.query = els.search.value.trim().toLowerCase();
    renderProducts();
  });

  els.categorySelect.addEventListener("change", () => {
    state.categoryId = els.categorySelect.value;
    syncCategoryButtons();
    renderProducts();
  });

  els.clearCategory.addEventListener("click", () => {
    state.categoryId = "";
    els.categorySelect.value = "";
    syncCategoryButtons();
    renderProducts();
  });
}

function renderCategories() {
  els.categoryTree.innerHTML = "";
  els.categoryTree.appendChild(categoryList(state.categories));

  const flat = flattenCategories(state.categories);
  for (const category of flat) {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = `${"— ".repeat(category.depth)}${category.name}`;
    els.categorySelect.appendChild(option);
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
    button.innerHTML = `<span>${escapeHtml(category.name)}</span><small>${category.productCount || ""}</small>`;
    button.addEventListener("click", () => {
      state.categoryId = category.id;
      els.categorySelect.value = category.id;
      syncCategoryButtons();
      renderProducts();
    });
    item.appendChild(button);
    if (category.children && category.children.length) item.appendChild(categoryList(category.children));
    list.appendChild(item);
  }
  return list;
}

function renderProducts() {
  const products = filteredProducts();
  els.grid.innerHTML = "";
  els.empty.hidden = products.length > 0;

  for (const product of products) {
    els.grid.appendChild(renderProduct(product));
  }

  const updated = state.meta.priceGroupName ? `Ceny: ${state.meta.priceGroupName}` : "Ceny: Sklep";
  els.status.innerHTML = `<span>${products.length} z ${state.products.length} produktów</span><span>${updated}</span>`;
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
  const card = document.createElement("article");
  card.className = "product-card";

  const image = product.images && product.images.length ? product.images[0] : "";
  const price = product.price === null ? "Cena do ustalenia" : formatPrice(product.price, product.currency);
  const category = product.categoryPath && product.categoryPath.length ? product.categoryPath.map((item) => item.name).join(" / ") : "";

  card.innerHTML = `
    <div class="product-media">
      ${image ? `<img src="${escapeAttribute(image)}" loading="lazy" alt="${escapeAttribute(product.name)}">` : '<div class="image-fallback">BookLoft</div>'}
    </div>
    <div class="product-body">
      <div class="product-meta">
        <span>${escapeHtml(category || "Bez kategorii")}</span>
        <strong>${Number(product.stock || 0)} szt.</strong>
      </div>
      <h2>${escapeHtml(product.name)}</h2>
      <div class="price-row">
        <strong>${price}</strong>
        ${product.sku ? `<small>SKU ${escapeHtml(product.sku)}</small>` : ""}
      </div>
      <div class="description collapsed">${product.descriptionHtml || "<p>Brak opisu.</p>"}</div>
      <button class="text-action description-toggle" type="button">Pokaż opis</button>
      <div class="product-actions">
        <button type="button" class="primary-action">Kup</button>
        <button type="button" class="secondary-action">Koszyk</button>
      </div>
    </div>
  `;

  const description = card.querySelector(".description");
  const toggle = card.querySelector(".description-toggle");
  toggle.addEventListener("click", () => {
    const collapsed = description.classList.toggle("collapsed");
    toggle.textContent = collapsed ? "Pokaż opis" : "Ukryj opis";
  });

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
}

function flattenCategories(categories, depth = 0) {
  return categories.flatMap((category) => [
    { ...category, depth },
    ...flattenCategories(category.children || [], depth + 1)
  ]);
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
