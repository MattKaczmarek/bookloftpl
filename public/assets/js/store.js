const INITIAL_LIMIT = 50;
const PAGE_SIZE = 50;
const SHELF_NOTE_FIRST_POSITION = 12;
const SHELF_NOTE_DESKTOP_INTERVAL = 36;
const SHELF_NOTE_MOBILE_INTERVAL = 18;
const SHELF_NOTE_INTERVAL = currentShelfNoteInterval();
const DEFAULT_SORT = "date-desc";
const SORT_OPTIONS = new Set(["date-desc", "price-asc", "price-desc", "name-asc", "name-desc"]);
const SHELF_NOTES = [
  {
    text: "W ofercie pokazujemy dokładnie ten egzemplarz, który później trafia do paczki.",
    aside: "realne zdjęcia"
  },
  {
    text: "Każdą książkę fotografujemy sami, żeby można było spokojnie obejrzeć jej stan przed zakupem.",
    aside: "bez niespodzianek"
  },
  {
    text: "Przed wystawieniem sprawdzamy książkę i opisujemy zauważone ślady użytkowania.",
    aside: "jasny opis"
  },
  {
    text: "Każda oferta dotyczy konkretnego egzemplarza, a nie przypadkowej książki z magazynu.",
    aside: "kupujesz to, co widzisz"
  },
  {
    text: "Od 4 lat dajemy książkom drugie życie i regularnie dokładamy na regał kolejne tytuły.",
    aside: "codziennie dużo nowości"
  },
  {
    text: "Na naszym regale pojawiają się powieści, reportaże, poradniki, książki dla dzieci i całe serie kryminalne.",
    aside: "różne gatunki"
  },
  {
    text: "W dni robocze paczki nadajemy już następnego dnia po zakupie.",
    aside: "szybka wysyłka"
  },
  {
    text: "Zamówienia pakujemy solidnie, żeby książki dotarły w takim stanie, w jakim opuściły nasz regał.",
    aside: "bezpieczne pakowanie"
  },
  {
    text: "Kupujesz konkretną książkę, sfotografowaną i opisaną przed wystawieniem.",
    aside: "świadomy wybór"
  },
  {
    text: "Książki z naszego regału są używane, ale wiemy, że każda z nich ma jeszcze mnóstwo historii przed sobą.",
    aside: "nowe życie książek"
  }
];
const SHELF_NOTE_START_INDEX = randomShelfNoteStartIndex();
const state = {
  products: [],
  newestProducts: [],
  categories: [],
  query: "",
  categoryId: "",
  sort: DEFAULT_SORT,
  rendered: 0,
  modeLimit: INITIAL_LIMIT,
  initialPage: 1,
  autoLoadQueued: false,
  meta: {}
};

const els = {
  grid: document.querySelector("#product-grid"),
  empty: document.querySelector("#empty-state"),
  listingTitle: document.querySelector("#listing-title"),
  search: document.querySelector("#product-search"),
  clearSearch: document.querySelector("#clear-search"),
  categoryTree: document.querySelector("#category-tree"),
  categorySelect: document.querySelector("#category-select"),
  clearCategory: document.querySelector("#clear-category"),
  sortSelects: Array.from(document.querySelectorAll("[data-product-sort]")),
  sortBoxes: Array.from(document.querySelectorAll(".sort-box")),
  loadSentinel: document.querySelector("#load-sentinel"),
  emptySuggestions: document.querySelector("#empty-suggestions"),
  introEyebrow: document.querySelector(".shop-intro .eyebrow"),
  introTitle: document.querySelector(".shop-intro h1"),
  introCopy: document.querySelector(".shop-intro .hero-copy"),
  categoryNote: document.querySelector(".category-seo-note"),
  relatedCategories: document.querySelector(".related-category-links")
};

setupBrandIntro();

init().catch((error) => {
  els.listingTitle.textContent = `Nie udało się załadować sklepu: ${error.message}`;
  els.grid.classList.remove("is-loading");
  els.grid.removeAttribute("aria-busy");
  els.grid.innerHTML = "";
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
  state.sort = sortFromUrl();
  state.initialPage = initialPageFromServer();

  bindEvents();
  renderCategories();
  els.categorySelect.value = state.categoryId;
  els.search.value = state.query;
  syncSortSelects();
  syncSearchClear();
  syncCategoryButtons();
  if (!adoptInitialListing()) resetAndRender();
}

function bindEvents() {
  els.search.addEventListener("input", debounce(() => {
    state.query = els.search.value.trim().toLowerCase();
    state.modeLimit = INITIAL_LIMIT;
    state.initialPage = 1;
    updateSearchUrl();
    syncSearchClear();
    scrollToTop();
    resetAndRender();
  }, 120));

  els.clearSearch?.addEventListener("click", () => {
    els.search.value = "";
    state.query = "";
    state.modeLimit = INITIAL_LIMIT;
    state.initialPage = 1;
    updateSearchUrl();
    syncSearchClear();
    els.search.focus();
    resetAndRender();
  });

  els.empty?.addEventListener("click", (event) => {
    if (!event.target.closest("#empty-reset")) return;
    els.search.value = "";
    state.query = "";
    state.initialPage = 1;
    updateSearchUrl();
    syncSearchClear();
    selectCategory("", { scroll: true });
  });

  els.categorySelect.addEventListener("change", () => {
    selectCategory(els.categorySelect.value, { scroll: true });
  });

  els.clearCategory?.addEventListener("click", () => selectCategory("", { scroll: true }));
  els.sortSelects.forEach((sortSelect) => {
    sortSelect.addEventListener("change", () => {
      state.sort = normalizeSort(sortSelect.value);
      syncSortSelects(sortSelect);
      state.modeLimit = INITIAL_LIMIT;
      state.initialPage = 1;
      updateListingUrl();
      scrollToTop();
      resetAndRender();
    });
  });

  setupInfiniteScroll();
}

function renderCategories() {
  els.categoryTree.innerHTML = "";
  els.categorySelect.innerHTML = '<option value="">Wszystkie oferty</option>';

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
  els.grid.classList.remove("is-loading");
  els.grid.removeAttribute("aria-busy");
  renderProducts();
}

function adoptInitialListing() {
  const initialIds = Array.isArray(window.BOOKLOFT_INITIAL_PRODUCT_IDS)
    ? window.BOOKLOFT_INITIAL_PRODUCT_IDS.map(String)
    : [];
  if (!initialIds.length || !els.grid?.querySelector(".product-card")) return false;

  const products = currentProducts();
  const offset = initialOffsetFromServer();
  const expectedIds = products.slice(offset, offset + initialIds.length).map((product) => String(product.id));
  const matchesServerHtml = initialIds.every((id, index) => id === expectedIds[index]);
  if (!matchesServerHtml) return false;

  state.rendered = Math.min(offset + initialIds.length, products.length);
  state.modeLimit = Math.max(state.modeLimit, state.rendered);
  insertShelfNotesIntoInitialListing(offset, products.length);
  els.grid.classList.remove("is-loading");
  els.grid.removeAttribute("aria-busy");
  syncEmptyState(products.length);
  els.loadSentinel.hidden = products.length === 0 || state.rendered >= products.length;
  syncPageText(products.length);
  queueAutoLoadIfNeeded();
  return true;
}

function insertShelfNotesIntoInitialListing(offset, total) {
  const cards = Array.from(els.grid.querySelectorAll(".product-card"));
  for (const [index, card] of cards.entries()) {
    const absoluteIndex = offset + index;
    if (shouldRenderShelfNote(absoluteIndex, total)) {
      card.insertAdjacentElement("afterend", renderShelfNote(absoluteIndex));
    }
  }
}

function selectCategory(categoryId, { scroll = false } = {}) {
  state.categoryId = categoryId || "";
  els.categorySelect.value = state.categoryId;
  state.modeLimit = INITIAL_LIMIT;
  state.initialPage = 1;
  updateListingUrl();
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
  syncEmptyState(products.length);
  els.loadSentinel.hidden = products.length === 0 || state.rendered >= products.length;
  syncPageText(products.length);
  queueAutoLoadIfNeeded();
}

function currentProducts() {
  const products = state.query || state.categoryId ? filteredProducts() : newestProducts();
  if (state.query && state.sort === DEFAULT_SORT) return products;
  return sortProducts(products, state.sort);
}

function syncEmptyState(productCount) {
  const isEmpty = productCount === 0;
  if (isEmpty && !els.empty.querySelector("h2")) {
    els.empty.innerHTML = `
      <h2>Nie znaleźliśmy pasujących ofert</h2>
      <p>Spróbuj krótszej frazy, nazwiska autora albo wybierz inną kategorię.</p>
      <button class="secondary-action" id="empty-reset" type="button">Pokaż wszystkie oferty</button>`;
  }
  const reset = els.empty.querySelector("#empty-reset");
  if (reset) reset.hidden = !state.query && !state.categoryId;
  els.empty.hidden = !isEmpty;
  els.sortBoxes.forEach((sortBox) => {
    sortBox.hidden = isEmpty;
  });
  syncEmptySuggestions(isEmpty && (state.query || state.categoryId) ? emptySuggestionProducts() : []);
}

function syncEmptySuggestions(products) {
  if (!els.emptySuggestions && els.empty) {
    els.emptySuggestions = document.createElement("section");
    els.emptySuggestions.id = "empty-suggestions";
    els.emptySuggestions.className = "empty-suggestions";
    els.emptySuggestions.setAttribute("aria-labelledby", "empty-suggestions-title");
    els.empty.insertAdjacentElement("afterend", els.emptySuggestions);
  }
  if (!els.emptySuggestions) return;

  els.emptySuggestions.innerHTML = products.length ? `
    <h2 id="empty-suggestions-title">Najnowsze oferty</h2>
    <div class="related-grid">
      ${products.map(renderEmptySuggestionCard).join("")}
    </div>` : "";
  els.emptySuggestions.hidden = products.length === 0;
}

function emptySuggestionProducts() {
  const candidates = state.categoryId
    ? state.products
        .filter((product) => (product.categoryPath || []).some((category) => String(category.id) === state.categoryId))
        .sort((a, b) => productFreshnessTime(b) - productFreshnessTime(a))
    : newestProducts();
  const seen = new Set();
  return candidates.filter((product) => {
    const id = String(product.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, 4);
}

function renderEmptySuggestionCard(product) {
  const rawImage = product.images && product.images.length ? product.images[0] : "";
  const image = rawImage ? allegroImageVariant(rawImage, "s256") : "";
  const price = product.price === null ? "Cena do ustalenia" : formatPrice(product.price, product.currency);
  return `
    <a class="related-card" href="${productUrl(product)}">
      <span class="related-thumb">
        ${image ? `<img src="${escapeAttribute(image)}" loading="lazy" decoding="async" alt="${escapeAttribute(product.name)}">` : "<span>BookLoft</span>"}
      </span>
      <span class="related-copy">
        <span>${escapeHtml(product.name)}</span>
        <strong>${price}</strong>
      </span>
    </a>`;
}

function loadNextPage() {
  const products = currentProducts();
  if (state.rendered >= products.length) return;
  state.modeLimit += PAGE_SIZE;
  renderProducts();
}

function filteredProducts() {
  return state.products.map((product) => {
    const searchScore = catalogSearchScore(product.searchText, state.query);
    const matchesCategory =
      !state.categoryId || (product.categoryPath || []).some((category) => String(category.id) === state.categoryId);
    return { product, searchScore, matchesCategory };
  }).filter((item) => item.searchScore >= 0 && item.matchesCategory)
    .sort((a, b) => b.searchScore - a.searchScore || productFreshnessTime(b.product) - productFreshnessTime(a.product))
    .map((item) => item.product);
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

function sortProducts(products, sort) {
  const normalizedSort = normalizeSort(sort);
  if (normalizedSort === DEFAULT_SORT && !state.query && !state.categoryId) return products;

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

function renderProduct(product, index = 0) {
  const link = productUrl(product);
  const card = document.createElement("article");
  card.className = "product-card";
  card.style.setProperty("--card-delay", `${Math.min(index, 16) * 28}ms`);

  const rawImage = product.images && product.images.length ? product.images[0] : "";
  const image = rawImage ? allegroImageVariant(rawImage, "s512") : "";
  const price = product.price === null ? "Cena do ustalenia" : formatPrice(product.price, product.currency);
  const imagePriority = index < 2 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  const srcset = rawImage ? imageSrcset(rawImage, ["s256", "s400", "s512", "s720"]) : "";
  card.innerHTML = `
    <a class="product-media${image ? "" : " is-loaded"}" href="${link}" aria-label="${escapeAttribute(product.name)}">
      ${image ? `<img src="${escapeAttribute(image)}" ${srcset} sizes="(max-width: 520px) 45vw, (max-width: 980px) 30vw, 240px" ${imagePriority} decoding="async" alt="${escapeAttribute(product.name)}">` : '<div class="image-fallback">BookLoft</div>'}
    </a>
    <div class="product-body">
      <span class="product-category">${escapeHtml(product.categoryName || "Książka")}</span>
      <h2><a href="${link}">${escapeHtml(product.name)}</a></h2>
      <div class="price-row">
        <strong>${price}</strong>
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
  if (position < SHELF_NOTE_FIRST_POSITION) return false;
  return (position - SHELF_NOTE_FIRST_POSITION) % SHELF_NOTE_INTERVAL === 0;
}

function renderShelfNote(index) {
  const noteIndex = Math.floor((index + 1 - SHELF_NOTE_FIRST_POSITION) / SHELF_NOTE_INTERVAL);
  const note = SHELF_NOTES[(SHELF_NOTE_START_INDEX + noteIndex) % SHELF_NOTES.length];
  const article = document.createElement("article");
  article.className = "shelf-note";
  article.setAttribute("aria-label", note.aside);
  article.innerHTML = `
    <div>
      <p>${escapeHtml(note.text)}</p>
    </div>
    <span>${escapeHtml(note.aside)}</span>
  `;
  return article;
}

function randomShelfNoteStartIndex() {
  return Math.floor(Math.random() * SHELF_NOTES.length);
}

function currentShelfNoteInterval() {
  return window.matchMedia?.("(max-width: 620px)").matches ? SHELF_NOTE_MOBILE_INTERVAL : SHELF_NOTE_DESKTOP_INTERVAL;
}

function syncCategoryButtons() {
  document.querySelectorAll(".category-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.categoryId === state.categoryId);
  });
}

function syncSortSelects(source = null) {
  els.sortSelects.forEach((sortSelect) => {
    if (sortSelect !== source) sortSelect.value = state.sort;
  });
}

function syncSearchClear() {
  if (!els.clearSearch) return;
  els.clearSearch.hidden = !els.search.value.trim();
}

function categoryIdFromUrl() {
  if (typeof window.BOOKLOFT_INITIAL_CATEGORY_ID === "string") return window.BOOKLOFT_INITIAL_CATEGORY_ID;
  const fromQuery = new URLSearchParams(window.location.search).get("category");
  if (fromQuery) return fromQuery;
  const match = window.location.pathname.match(/\/kategoria\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function queryFromUrl() {
  if (typeof window.BOOKLOFT_INITIAL_QUERY === "string") return window.BOOKLOFT_INITIAL_QUERY.trim().toLowerCase();
  return new URLSearchParams(window.location.search).get("q")?.trim().toLowerCase() || "";
}

function initialOffsetFromServer() {
  const value = Number(window.BOOKLOFT_INITIAL_OFFSET || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function initialPageFromServer() {
  const value = Number(window.BOOKLOFT_INITIAL_PAGE || 1);
  return Number.isInteger(value) && value > 1 ? value : 1;
}

function sortFromUrl() {
  if (typeof window.BOOKLOFT_INITIAL_SORT === "string") return normalizeSort(window.BOOKLOFT_INITIAL_SORT);
  return normalizeSort(new URLSearchParams(window.location.search).get("sort"));
}

function normalizeSort(value) {
  const sort = String(value || "").trim();
  return SORT_OPTIONS.has(sort) ? sort : DEFAULT_SORT;
}

function updateListingUrl() {
  const url = new URL(window.location.href);
  url.pathname = state.categoryId ? categoryUrl(findCategory(state.categoryId)) : "/";
  url.searchParams.delete("category");
  if (state.query) url.searchParams.set("q", state.query);
  else url.searchParams.delete("q");
  if (state.sort && state.sort !== DEFAULT_SORT) url.searchParams.set("sort", state.sort);
  else url.searchParams.delete("sort");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function updateSearchUrl() {
  updateListingUrl();
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

function syncPageText(count) {
  const category = state.categoryId ? findCategory(state.categoryId) : null;
  if (state.query) {
    setText(els.introEyebrow, "Wyszukiwanie");
    setText(els.introTitle, `Oferty dla „${state.query}”`);
    setText(els.introCopy, "");
    els.listingTitle.textContent = "";
    setCategoryNote("");
    syncRelatedCategoryLinks(null);
    return;
  }
  if (category) {
    const name = category.displayName || category.name || "Kategoria";
    setText(els.introEyebrow, "Kategoria");
    setText(els.introTitle, name);
    setText(els.introCopy, categoryIntroCopy(category, count));
    els.listingTitle.textContent = state.initialPage > 1 ? `Dostępne oferty - strona ${state.initialPage}` : "Dostępne oferty";
    setCategoryNote("");
    syncRelatedCategoryLinks(category);
    return;
  }
  setText(els.introEyebrow, "Nowości z regału");
  setText(els.introTitle, "Wybierz kolejną historię");
  setText(els.introCopy, "Nowe tytuły z naszego regału. Przeglądaj ostatnio dodane oferty albo wyszukaj książkę po tytule, autorze lub gatunku.");
  els.listingTitle.textContent = state.initialPage > 1 ? `Nowości - strona ${state.initialPage}` : "Nowości";
  setCategoryNote("");
  syncRelatedCategoryLinks(null);
}

function setText(element, text) {
  if (element) element.textContent = text;
}

function setCategoryNote(text) {
  if (!els.categoryNote && text && els.listingTitle) {
    els.categoryNote = document.createElement("p");
    els.categoryNote.className = "category-seo-note";
    els.listingTitle.insertAdjacentElement("afterend", els.categoryNote);
  }
  if (!els.categoryNote) return;
  els.categoryNote.textContent = text;
  els.categoryNote.hidden = !text;
  els.categoryNote.style.display = text ? "" : "none";
}

function categoryIntroCopy(category, count) {
  const name = category.displayName || category.name || "Kategoria";
  return `${name}: ${offerCountLabel(count)} z realnymi zdjęciami konkretnych egzemplarzy i opisem ich stanu.`;
}

function syncRelatedCategoryLinks(category) {
  const categories = category ? relatedCategoryLinks(visibleCategories(state.categories), category, 6) : [];
  if (!categories.length) {
    els.relatedCategories?.remove();
    els.relatedCategories = null;
    return;
  }
  if (!els.relatedCategories) {
    els.relatedCategories = document.createElement("nav");
    els.relatedCategories.className = "related-category-links";
    els.relatedCategories.setAttribute("aria-label", "Powiązane kategorie");
    els.listingTitle.insertAdjacentElement("afterend", els.relatedCategories);
  }
  els.relatedCategories.innerHTML = `<span>Przeglądaj też</span><div>${categories.map((item) => `<a href="${categoryUrl(item)}">${escapeHtml(item.displayName || item.name)} <small>${escapeHtml(offerCountLabel(item.totalProductCount || item.productCount || 0))}</small></a>`).join("")}</div>`;
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

function catalogSearchScore(value, query) {
  const rawQuery = String(query || "").trim().toLowerCase();
  if (!rawQuery) return 0;

  const rawValue = String(value || "").toLowerCase();
  const rawPhraseIndex = rawValue.indexOf(rawQuery);
  if (rawPhraseIndex >= 0) return 11_000 - Math.min(rawPhraseIndex, 999);

  const normalizedQuery = normalizeCatalogSearch(query);
  if (!normalizedQuery) return -1;
  const normalizedValue = normalizeCatalogSearch(value);
  if (!normalizedValue) return -1;

  const phraseIndex = normalizedValue.indexOf(normalizedQuery);
  if (phraseIndex >= 0) return 10_000 - Math.min(phraseIndex, 999);

  const queryTokens = [...new Set(normalizedQuery.split(" ").filter(Boolean))];
  const valueTokens = normalizedValue.split(" ").filter(Boolean);
  if (!queryTokens.length || !valueTokens.length) return -1;

  let score = 0;
  let previousIndex = -1;
  let ordered = true;

  for (const queryToken of queryTokens) {
    let bestScore = -1;
    let bestIndex = -1;

    for (const [index, valueToken] of valueTokens.entries()) {
      const tokenScore = catalogTokenScore(valueToken, queryToken);
      if (tokenScore > bestScore) {
        bestScore = tokenScore;
        bestIndex = index;
      }
    }

    if (bestScore < 0) return -1;
    if (bestIndex < previousIndex) ordered = false;
    previousIndex = bestIndex;
    score += bestScore;
  }

  return score + (ordered ? 60 : 0) + Math.min(queryTokens.length * 20, 100);
}

function normalizeCatalogSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function catalogTokenScore(valueToken, queryToken) {
  if (valueToken === queryToken) return 300;
  if (queryToken.length >= 2 && valueToken.startsWith(queryToken)) return 220;
  if (queryToken.length >= 3 && valueToken.includes(queryToken)) return 180;
  if (queryToken.length >= 4 && isOneEditAway(valueToken, queryToken)) return 120;
  return -1;
}

function isOneEditAway(left, right) {
  if (Math.abs(left.length - right.length) > 1) return false;

  if (left.length === right.length) {
    const differences = [];
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) differences.push(index);
      if (differences.length > 2) return false;
    }
    if (differences.length <= 1) return true;
    const [first, second] = differences;
    return second === first + 1 && left[first] === right[second] && left[second] === right[first];
  }

  const shorter = left.length < right.length ? left : right;
  const longer = left.length < right.length ? right : left;
  let shortIndex = 0;
  let longIndex = 0;
  let skipped = false;

  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      longIndex += 1;
      continue;
    }
    if (skipped) return false;
    skipped = true;
    longIndex += 1;
  }
  return true;
}

function findCategory(categoryId) {
  return flattenCategories(state.categories).find((category) => String(category.id) === String(categoryId)) || null;
}

function categoryUrl(category) {
  if (!category?.id) return "/";
  return `/kategoria/${encodeURIComponent(category.id)}/${encodeURIComponent(slugify(category.displayName || category.name))}`;
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

function setupBrandIntro() {
  const intro = document.querySelector("#brand-intro");
  if (!intro) return;
  const storageKey = "bookloft_intro_seen";

  if (!isHomeIntroPage()) {
    try {
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // sessionStorage may be unavailable in restricted webviews.
    }
    intro.hidden = true;
    intro.classList.remove("is-visible", "is-ready", "is-hiding");
    return;
  }

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

  const visibleFor = prefersReducedMotion ? 338 : 1388;
  const fadeFor = prefersReducedMotion ? 90 : 488;
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

function isHomeIntroPage() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path !== "/") return false;
  const params = new URLSearchParams(window.location.search);
  return !params.get("q") && !params.get("category") && !params.get("sort");
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

function imageSrcset(src, sizes) {
  if (!/^https:\/\/a\.allegroimg\.com\//i.test(String(src || ""))) return "";
  return `srcset="${sizes.map((size) => `${escapeAttribute(allegroImageVariant(src, size))} ${size.replace("s", "")}w`).join(", ")}"`;
}

function allegroImageVariant(value, size) {
  const url = String(value || "");
  if (!/^https:\/\/a\.allegroimg\.com\//i.test(url)) return url;
  return url.replace(/\/(?:original|s\d{2,4})\//i, `/${size}/`);
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
    .slice(0, 80) || "kategoria";
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
