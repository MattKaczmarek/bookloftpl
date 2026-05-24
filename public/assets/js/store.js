const INITIAL_LIMIT = 50;
const PAGE_SIZE = 50;
const SHELF_NOTES = [
  {
    label: "Standard BookLoft",
    text: "Każdy egzemplarz fotografujemy i opisujemy tak, żeby było jasne, co dokładnie trafia do kolejnego czytelnika.",
    aside: "zdjęcia + opis stanu"
  },
  {
    label: "Drugi obieg",
    text: "Książki z charakterem dostają kolejną drogę, a Ty wybierasz tytuł z realnych zdjęć konkretnego egzemplarza.",
    aside: "mniej marnowania"
  }
];

const state = {
  products: [],
  newestProducts: [],
  categories: [],
  query: "",
  categoryId: "",
  rendered: 0,
  modeLimit: INITIAL_LIMIT,
  autoLoadQueued: false,
  meta: {}
};

const els = {
  grid: document.querySelector("#product-grid"),
  empty: document.querySelector("#empty-state"),
  listingTitle: document.querySelector("#listing-title"),
  search: document.querySelector("#product-search"),
  categoryTree: document.querySelector("#category-tree"),
  categorySelect: document.querySelector("#category-select"),
  clearCategory: document.querySelector("#clear-category"),
  loadSentinel: document.querySelector("#load-sentinel")
};

setupBrandIntro();

init().catch((error) => {
  els.listingTitle.textContent = `Nie udało się załadować sklepu: ${error.message}`;
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
  state.categoryId = categoryIdFromUrl();
  state.query = queryFromUrl();

  bindEvents();
  renderCategories();
  els.categorySelect.value = state.categoryId;
  els.search.value = state.query;
  syncCategoryButtons();
  resetAndRender();
}

function bindEvents() {
  els.search.addEventListener("input", debounce(() => {
    state.query = els.search.value.trim().toLowerCase();
    state.modeLimit = INITIAL_LIMIT;
    updateSearchUrl();
    scrollToTop();
    resetAndRender();
  }, 120));

  els.categorySelect.addEventListener("change", () => {
    selectCategory(els.categorySelect.value, { scroll: true });
  });

  els.clearCategory?.addEventListener("click", () => selectCategory("", { scroll: true }));

  setupInfiniteScroll();
}

function renderCategories() {
  els.categoryTree.innerHTML = "";

  const flat = visibleCategories(state.categories);
  els.categoryTree.appendChild(categoryList([
    {
      id: "",
      displayName: "Wszystkie oferty",
      totalProductCount: state.products.length
    },
    ...flat.slice(0, 36)
  ]));

  for (const category of flat.slice(0, 80)) {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.displayName || category.name;
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
    button.innerHTML = `<span>${escapeHtml(category.displayName || category.name)}</span><small>${category.totalProductCount || category.productCount || ""}</small>`;
    button.addEventListener("click", () => {
      selectCategory(category.id, { scroll: true });
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

function selectCategory(categoryId, { scroll = false } = {}) {
  state.categoryId = categoryId || "";
  els.categorySelect.value = state.categoryId;
  state.modeLimit = INITIAL_LIMIT;
  updateCategoryUrl();
  syncCategoryButtons();
  if (scroll) scrollToTop();
  resetAndRender();
}

function renderProducts() {
  const products = currentProducts();
  const next = products.slice(state.rendered, state.modeLimit);
  const fragment = document.createDocumentFragment();

  for (const [index, product] of next.entries()) {
    const absoluteIndex = state.rendered + index;
    fragment.appendChild(renderProduct(product, absoluteIndex));
    if (shouldRenderShelfNote(absoluteIndex, products.length)) {
      fragment.appendChild(renderShelfNote(absoluteIndex));
    }
  }

  els.grid.appendChild(fragment);
  state.rendered += next.length;
  els.empty.hidden = products.length > 0;
  els.loadSentinel.hidden = products.length === 0 || state.rendered >= products.length;
  els.listingTitle.textContent = "Nowości";
  queueAutoLoadIfNeeded();
}

function currentProducts() {
  return state.query || state.categoryId ? filteredProducts() : newestProducts();
}

function loadNextPage() {
  const products = currentProducts();
  if (state.rendered >= products.length) return;
  state.modeLimit += PAGE_SIZE;
  renderProducts();
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
  if (!state.newestProducts.length) return state.products;

  const newestIds = new Set(state.newestProducts.map((product) => String(product.id)));
  const remaining = state.products
    .filter((product) => !newestIds.has(String(product.id)))
    .sort((a, b) => {
      const dateDiff = productFreshnessTime(b) - productFreshnessTime(a);
      if (dateDiff) return dateDiff;
      return sortProductIdDesc(a.id, b.id);
    });
  return [...state.newestProducts, ...remaining];
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
      <div class="product-actions">
        <a class="details-action action-full" href="${link}" aria-label="Zobacz ${escapeAttribute(product.name)}">Zobacz</a>
      </div>
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

function shouldRenderShelfNote(index, total) {
  const position = index + 1;
  if (total < 14) return false;
  return position === 8 || position === 32 || (position > 64 && position % 72 === 0);
}

function renderShelfNote(index) {
  const note = SHELF_NOTES[Math.floor(index / 24) % SHELF_NOTES.length];
  const article = document.createElement("article");
  article.className = "shelf-note";
  article.setAttribute("aria-label", note.label);
  article.innerHTML = `
    <div>
      <small>${escapeHtml(note.label)}</small>
      <p>${escapeHtml(note.text)}</p>
    </div>
    <span>${escapeHtml(note.aside)}</span>
  `;
  return article;
}

function syncCategoryButtons() {
  document.querySelectorAll(".category-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.categoryId === state.categoryId);
  });
}

function categoryIdFromUrl() {
  return new URLSearchParams(window.location.search).get("category") || "";
}

function queryFromUrl() {
  return new URLSearchParams(window.location.search).get("q")?.trim().toLowerCase() || "";
}

function updateCategoryUrl() {
  const url = new URL(window.location.href);
  if (state.categoryId) url.searchParams.set("category", state.categoryId);
  else url.searchParams.delete("category");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function updateSearchUrl() {
  const url = new URL(window.location.href);
  if (state.query) url.searchParams.set("q", state.query);
  else url.searchParams.delete("q");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function scrollToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
}

function setupInfiniteScroll() {
  if (!els.loadSentinel) return;

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadNextPage();
    }, {
      root: null,
      rootMargin: "900px 0px",
      threshold: 0
    });
    observer.observe(els.loadSentinel);
    return;
  }

  window.addEventListener("scroll", debounce(() => {
    if (els.loadSentinel.hidden) return;
    const rect = els.loadSentinel.getBoundingClientRect();
    if (rect.top < window.innerHeight + 900) loadNextPage();
  }, 80), { passive: true });
}

function queueAutoLoadIfNeeded() {
  if (state.autoLoadQueued || !els.loadSentinel || els.loadSentinel.hidden) return;
  state.autoLoadQueued = true;
  window.requestAnimationFrame(() => {
    state.autoLoadQueued = false;
    if (els.loadSentinel.hidden) return;
    const rect = els.loadSentinel.getBoundingClientRect();
    if (rect.top < window.innerHeight + 900) loadNextPage();
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

function productFreshnessTime(product) {
  return Math.max(
    Date.parse(product.addedAt || 0) || 0,
    Number(product.id || 0) || 0
  );
}

function sortProductIdDesc(a, b) {
  const left = Number(a);
  const right = Number(b);
  if (Number.isFinite(left) && Number.isFinite(right)) return right - left;
  return String(b).localeCompare(String(a), "pl-PL", { numeric: true });
}

function setupBrandIntro() {
  const intro = document.querySelector("#brand-intro");
  if (!intro) return;

  const storageKey = "bookloft_intro_seen";
  let shouldShow = true;
  try {
    shouldShow = window.sessionStorage.getItem(storageKey) !== "1";
    window.sessionStorage.setItem(storageKey, "1");
  } catch {
    shouldShow = true;
  }

  if (!shouldShow) {
    intro.hidden = true;
    intro.classList.remove("is-visible", "is-ready", "is-hiding");
    return;
  }

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  intro.hidden = false;
  intro.classList.add("is-visible");

  const visibleFor = prefersReducedMotion ? 450 : 1850;
  const fadeFor = prefersReducedMotion ? 120 : 650;
  waitForIntroFont().then(() => {
    intro.classList.add("is-ready");
    window.setTimeout(() => {
      intro.classList.add("is-hiding");
      window.setTimeout(() => {
        intro.hidden = true;
        intro.classList.remove("is-visible", "is-ready", "is-hiding");
      }, fadeFor);
    }, visibleFor);
  });
}

function waitForIntroFont() {
  const fonts = document.fonts;
  if (!fonts?.load) return Promise.resolve();
  const headingFont = fonts.load('600 32px "Source Serif 4"');
  const bodyFont = fonts.load('700 18px "Nunito Sans"');
  const timeout = new Promise((resolve) => window.setTimeout(resolve, 420));
  return Promise.race([
    Promise.allSettled([headingFont, bodyFont]),
    timeout
  ]);
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
