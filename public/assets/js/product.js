const page = document.querySelector("#product-page");
const productSearchForm = document.querySelector("#product-search-form");
const productSearchInput = document.querySelector("#product-page-search");
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

  const bootstrappedProduct = window.__BOOKLOFT_PRODUCT__;
  if (bootstrappedProduct) {
    document.title = `${bootstrappedProduct.name} | BookLoft`;
    initProductGallery(
      Array.isArray(bootstrappedProduct.images) ? bootstrappedProduct.images.filter(Boolean) : [],
      bootstrappedProduct.name
    );
    return;
  }

  const product = await fetchProduct(productId);
  if (!product) return;
  document.title = `${product.name} | BookLoft`;
  renderProduct(product);
}

async function fetchProduct(productId) {
  const response = await fetch(`/api/products/${encodeURIComponent(productId)}`, { credentials: "same-origin" });
  if (response.status === 404 || response.status === 410) {
    page.innerHTML = '<div class="empty-state"><h1>Produkt niedostępny</h1><p>Tego egzemplarza nie ma już w katalogu.</p></div>';
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
  const allegroUrl = product.allegroUrl || `https://allegro.pl/oferta/${encodeURIComponent(product.id)}`;
  const specs = renderProductSpecs(product);

  page.innerHTML = `
    <div class="product-layout">
      <aside class="category-rail product-category-rail" aria-label="Kategorie">
        <div class="rail-head">
          <span>Kategorie</span>
        </div>
        <div id="product-category-tree" class="category-tree"></div>
      </aside>
      <div class="product-content">
        ${renderProductBreadcrumbs(product, category)}
        <aside class="mobile-purchase-bar" aria-label="Szybki zakup">
          <span class="mobile-purchase-copy">
            <span>${escapeHtml(product.name)}</span>
            <strong>${price}</strong>
          </span>
          <a class="buy-action" href="${escapeAttribute(allegroUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Kup ${escapeAttribute(product.name)} na Allegro">Kup na Allegro</a>
        </aside>
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
        <p class="purchase-note">Finalizacja zakupu oraz obsługa płatności, dostawy, zwrotu i reklamacji odbywają się w Allegro. Szczegóły są dostępne w ofercie Allegro oraz w <a href="/informacje-prawne#zwroty-dostawa">informacjach prawnych BookLoft</a>.</p>
        ${specs}
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
  const mainStage = page.querySelector(".gallery-main");

  function setImage(nextIndex) {
    currentIndex = wrapImageIndex(nextIndex, images.length);
    if (mainImage) {
      mainImage.src = allegroImageVariant(images[currentIndex], "s720");
      const srcset = imageSrcset(images[currentIndex], ["s512", "s720", "s1024"]).match(/^srcset="(.+)"$/)?.[1] || "";
      if (srcset) mainImage.srcset = srcset;
      else mainImage.removeAttribute("srcset");
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
  attachSwipe(mainStage, {
    onNext: () => setImage(currentIndex + 1),
    onPrevious: () => setImage(currentIndex - 1)
  });
  setImage(0);
}

function openImageLightbox(images, startIndex, productName) {
  if (!images.length) return;

  let currentIndex = wrapImageIndex(startIndex, images.length);
  let zoomScale = 1;
  let panX = 0;
  let panY = 0;
  let panStart = null;
  let touchPanStart = null;
  let pinchStart = null;
  let didPan = false;
  const dialog = document.createElement("div");
  dialog.className = "image-lightbox";
  dialog.tabIndex = -1;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Podgląd zdjęcia produktu");
  dialog.innerHTML = `
    <button class="lightbox-close" type="button" data-lightbox-close aria-label="Zamknij podgląd">&times;</button>
    ${images.length > 1 ? `<button class="lightbox-arrow lightbox-arrow-prev" type="button" data-lightbox-prev aria-label="Poprzednie zdjęcie">${galleryArrowIcon("previous")}</button>` : ""}
    <div class="lightbox-stage">
      <img src="${escapeAttribute(images[currentIndex])}" alt="${escapeAttribute(productName)} - zdjęcie ${currentIndex + 1}" data-lightbox-image>
    </div>
    ${images.length > 1 ? `<button class="lightbox-arrow lightbox-arrow-next" type="button" data-lightbox-next aria-label="Następne zdjęcie">${galleryArrowIcon("next")}</button>` : ""}
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

  function updateZoom(options = {}) {
    if (zoomScale <= 1.01 && !options.keepPanAtMin) {
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

  function startTouchGesture(event) {
    if (!stage) return;
    if (event.touches.length === 2) {
      startPinch(event);
      return;
    }
    if (event.touches.length !== 1 || zoomScale <= 1.01) return;
    const touch = event.touches[0];
    event.preventDefault();
    touchPanStart = {
      x: touch.clientX,
      y: touch.clientY,
      panX,
      panY
    };
    pinchStart = null;
    didPan = false;
    dialog.classList.add("is-panning");
    dialog.classList.remove("is-pinching");
  }

  function startPinch(event) {
    event.preventDefault();
    const center = touchCenter(event.touches, stage);
    const startZoom = Math.max(zoomScale, 1);
    pinchStart = {
      distance: touchDistance(event.touches),
      anchorX: (center.x - panX) / startZoom,
      anchorY: (center.y - panY) / startZoom,
      zoomScale: startZoom
    };
    panStart = null;
    touchPanStart = null;
    didPan = true;
    dialog.classList.add("is-pinching");
    dialog.classList.remove("is-panning");
  }

  function moveTouchGesture(event) {
    if (event.touches.length === 2) {
      if (pinchStart) movePinch(event);
      else startPinch(event);
      return;
    }
    if (!touchPanStart || event.touches.length !== 1) return;
    event.preventDefault();
    const touch = event.touches[0];
    panX = touchPanStart.panX + touch.clientX - touchPanStart.x;
    panY = touchPanStart.panY + touch.clientY - touchPanStart.y;
    if (Math.abs(touch.clientX - touchPanStart.x) > 6 || Math.abs(touch.clientY - touchPanStart.y) > 6) {
      didPan = true;
    }
    clampPan();
    dialog.style.setProperty("--lightbox-pan-x", `${panX.toFixed(1)}px`);
    dialog.style.setProperty("--lightbox-pan-y", `${panY.toFixed(1)}px`);
  }

  function movePinch(event) {
    event.preventDefault();
    const center = touchCenter(event.touches, stage);
    const distance = touchDistance(event.touches);
    const ratio = distance / Math.max(1, pinchStart.distance);
    zoomScale = clamp(pinchStart.zoomScale * ratio, 1, 2.6);
    panX = center.x - pinchStart.anchorX * zoomScale;
    panY = center.y - pinchStart.anchorY * zoomScale;
    didPan = true;
    updateZoom({ keepPanAtMin: true });
  }

  function stopTouchGesture(event) {
    if (pinchStart && event.touches.length === 1 && zoomScale > 1.01) {
      const touch = event.touches[0];
      pinchStart = null;
      touchPanStart = {
        x: touch.clientX,
        y: touch.clientY,
        panX,
        panY
      };
      dialog.classList.remove("is-pinching");
      dialog.classList.add("is-panning");
      updateZoom();
      return;
    }
    if (pinchStart) {
      pinchStart = null;
      dialog.classList.remove("is-pinching");
      updateZoom();
    }
    if (touchPanStart && event.touches.length === 0) {
      touchPanStart = null;
      dialog.classList.remove("is-panning");
    }
  }

  function startPan(event) {
    if (event.pointerType === "touch" || pinchStart || zoomScale <= 1.01 || event.button !== 0) return;
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
    if (Math.abs(event.clientX - panStart.x) > 6 || Math.abs(event.clientY - panStart.y) > 6) {
      didPan = true;
    }
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
  stage?.addEventListener("touchstart", startTouchGesture, { passive: false });
  stage?.addEventListener("touchmove", moveTouchGesture, { passive: false });
  stage?.addEventListener("touchend", stopTouchGesture, { passive: false });
  stage?.addEventListener("touchcancel", stopTouchGesture, { passive: false });
  attachSwipe(stage, {
    onNext: () => setLightboxImage(currentIndex + 1),
    onPrevious: () => setLightboxImage(currentIndex - 1),
    shouldHandle: () => zoomScale <= 1.01
  });
  image?.addEventListener("pointerdown", startPan);
  image?.addEventListener("pointermove", movePan);
  image?.addEventListener("pointerup", stopPan);
  image?.addEventListener("pointercancel", stopPan);
  image?.addEventListener("lostpointercapture", stopPan);
  dialog.addEventListener("click", (event) => {
    if (didPan) {
      didPan = false;
      event.preventDefault();
      return;
    }
    if (event.target === dialog) close();
  });
  document.addEventListener("keydown", onKeyDown);
  document.body.classList.add("modal-open");
  document.body.appendChild(dialog);
  render();
  dialog.focus({ preventScroll: true });
}

function galleryArrowIcon(direction) {
  const points = direction === "previous" ? "15 18 9 12 15 6" : "9 18 15 12 9 6";
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="${points}"></polyline></svg>`;
}

function wrapImageIndex(index, length) {
  return ((index % length) + length) % length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function touchDistance(touches) {
  const first = touches[0];
  const second = touches[1];
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function touchCenter(touches, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left - rect.width / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top - rect.height / 2
  };
}

function attachSwipe(element, { onNext, onPrevious, shouldHandle = () => true }) {
  if (!element || !onNext || !onPrevious) return;

  let start = null;
  let suppressClick = false;
  let activeSource = null;
  const minDistance = 48;
  const maxVerticalDrift = 72;
  const intentDistance = 12;

  function isInteractiveTarget(target) {
    return Boolean(target?.closest?.("button, a, input, textarea, select, label"));
  }

  function beginSwipe(event, source, pointerId, clientX, clientY) {
    if (activeSource && activeSource !== source) return;
    if (!shouldHandle(event)) {
      start = null;
      activeSource = null;
      return;
    }
    activeSource = source;
    start = {
      pointerId,
      x: clientX,
      y: clientY,
      swiping: false
    };
  }

  function moveSwipe(event, source, pointerId, clientX, clientY) {
    if (!start || activeSource !== source || pointerId !== start.pointerId || !shouldHandle(event)) return;

    const deltaX = clientX - start.x;
    const deltaY = clientY - start.y;
    if (Math.abs(deltaX) > intentDistance && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
      start.swiping = true;
    }
    if (start.swiping) {
      event.preventDefault();
    }
  }

  function finishSwipe(event, source, pointerId, clientX, clientY) {
    if (!start || activeSource !== source || pointerId !== start.pointerId || !shouldHandle(event)) {
      start = null;
      activeSource = null;
      return;
    }

    const deltaX = clientX - start.x;
    const deltaY = clientY - start.y;
    const wasSwipe = Math.abs(deltaX) >= minDistance && Math.abs(deltaY) <= maxVerticalDrift;
    start = null;
    activeSource = null;

    if (!wasSwipe) return;

    suppressClick = true;
    window.setTimeout(() => {
      suppressClick = false;
    }, 180);
    event.preventDefault();
    event.stopPropagation();
    if (deltaX < 0) onNext();
    else onPrevious();
  }

  element.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") return;
    if (isInteractiveTarget(event.target)) {
      start = null;
      activeSource = null;
      return;
    }
    if (event.button !== 0) {
      start = null;
      activeSource = null;
      return;
    }
    beginSwipe(event, "pointer", event.pointerId, event.clientX, event.clientY);
    if (!start) return;
    element.setPointerCapture?.(event.pointerId);
  });

  element.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    moveSwipe(event, "pointer", event.pointerId, event.clientX, event.clientY);
  });

  element.addEventListener("pointerup", (event) => {
    if (event.pointerType === "touch") return;
    if (start && event.pointerId === start.pointerId) {
      element.releasePointerCapture?.(event.pointerId);
    }
    finishSwipe(event, "pointer", event.pointerId, event.clientX, event.clientY);
  });

  element.addEventListener("pointercancel", () => {
    start = null;
    activeSource = null;
  });

  element.addEventListener("touchstart", (event) => {
    if (activeSource && activeSource !== "touch") return;
    if (event.touches.length !== 1) {
      start = null;
      activeSource = null;
      return;
    }
    const touch = event.touches[0];
    beginSwipe(event, "touch", touch.identifier, touch.clientX, touch.clientY);
  }, { passive: true });

  element.addEventListener("touchmove", (event) => {
    if (!event.touches.length) return;
    const touch = event.touches[0];
    moveSwipe(event, "touch", touch.identifier, touch.clientX, touch.clientY);
  }, { passive: false });

  element.addEventListener("touchend", (event) => {
    const touch = [...event.changedTouches].find((item) => start && item.identifier === start.pointerId);
    if (!touch) {
      start = null;
      activeSource = null;
      return;
    }
    finishSwipe(event, "touch", touch.identifier, touch.clientX, touch.clientY);
  }, { passive: false });

  element.addEventListener("touchcancel", () => {
    start = null;
    activeSource = null;
  });

  element.addEventListener("click", (event) => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
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
    link.href = categoryUrl(category);
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

function categoryUrl(category) {
  if (!category?.id) return "/";
  return `/kategoria/${encodeURIComponent(category.id)}/${encodeURIComponent(slugify(category.displayName || category.name))}`;
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
    <a class="related-card" href="/product/${encodeURIComponent(product.id)}/${encodeURIComponent(product.slug || "produkt")}">
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

function renderProductBreadcrumbs(product, fallbackCategory) {
  const pathItems = visibleCategoryPath(product.categoryPath || []);
  const leaf = pathItems[pathItems.length - 1];
  return `
    <nav class="breadcrumbs" aria-label="Ścieżka">
      <a href="/">BookLoft</a>
      ${leaf ? `<span aria-hidden="true">/</span><a href="${categoryUrl(leaf)}">${escapeHtml(leaf.displayName || leaf.name)}</a>` : `<span aria-hidden="true">/</span><span>${escapeHtml(fallbackCategory)}</span>`}
      <span aria-hidden="true">/</span>
      <span>${escapeHtml(product.name)}</span>
    </nav>`;
}

function selectedProductFeatures(features, limit = 8) {
  const normalizedFeatures = (features || [])
    .map((feature) => ({
      key: normalizeCategoryName(feature.name),
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

function productImageAlt(product) {
  return `Zdjęcie egzemplarza: ${product.name}`;
}

function cleanSpecValue(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function renderProductAbout() {
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
        <a href="/o-nas">Więcej o nas</a>
        <a href="/informacje-prawne">Informacje prawne</a>
      </nav>
    </section>`;
}

function updateMeta(product) {
  if (!product) return;
  const description = `${product.name}. Używana książka dostępna w BookLoft, z opisem stanu i zakupem przez Allegro.`;
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
