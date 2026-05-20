const page = document.querySelector("#product-page");

init().catch((error) => {
  page.innerHTML = `<div class="empty-state"><h1>Nie udalo sie zaladowac produktu</h1><p>${escapeHtml(error.message)}</p></div>`;
});

async function init() {
  const productId = location.pathname.split("/")[3];
  if (!productId) throw new Error("Brak identyfikatora produktu");

  const response = await fetch(`/test/api/products/${encodeURIComponent(productId)}`, { credentials: "same-origin" });
  if (response.status === 404) {
    page.innerHTML = '<div class="empty-state"><h1>Produkt niedostepny</h1><p>Ten produkt nie jest obecnie widoczny w sklepie.</p></div>';
    return;
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const product = await response.json();
  document.title = `${product.name} | BookLoft`;
  renderProduct(product);
}

function renderProduct(product) {
  const image = product.images && product.images.length ? product.images[0] : "";
  const price = product.price === null ? "Cena do ustalenia" : formatPrice(product.price, product.currency);
  const category = product.categoryPath && product.categoryPath.length
    ? product.categoryPath.map((item) => item.displayName || item.name).join(" / ")
    : "Bez kategorii";

  page.innerHTML = `
    <nav class="breadcrumbs" aria-label="Sciezka">
      <a href="/test">Sklep</a>
      <span>${escapeHtml(category)}</span>
    </nav>
    <article class="product-detail">
      <section class="detail-gallery">
        ${image ? `<img class="detail-main-image" src="${escapeAttribute(image)}" alt="${escapeAttribute(product.name)}">` : '<div class="image-fallback">BookLoft</div>'}
        <div class="thumb-strip">
          ${(product.images || []).slice(0, 6).map((src) => `<img src="${escapeAttribute(src)}" alt="">`).join("")}
        </div>
      </section>
      <section class="detail-info">
        <p class="eyebrow">${escapeHtml(category)}</p>
        <h1>${escapeHtml(product.name)}</h1>
        <div class="detail-purchase">
          <strong>${price}</strong>
          <span>${Number(product.stock || 0)} szt. dostepne</span>
        </div>
        <div class="product-actions">
          <button type="button" class="primary-action">Kup</button>
          <button type="button" class="secondary-action">Koszyk</button>
        </div>
        ${product.sku ? `<p class="sku-line">SKU ${escapeHtml(product.sku)}</p>` : ""}
      </section>
    </article>
    <section class="detail-description">
      <h2>Opis</h2>
      <div class="description">${product.descriptionHtml || "<p>Brak opisu.</p>"}</div>
    </section>
    ${renderRelated(product.related || [])}
  `;

  page.querySelectorAll(".thumb-strip img").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const main = page.querySelector(".detail-main-image");
      if (main) main.src = thumb.src;
    });
  });
}

function renderRelated(products) {
  if (!products.length) return "";
  return `
    <section class="related-products">
      <h2>Podobne w tej kategorii</h2>
      <div class="related-grid">
        ${products.map((product) => `
          <a href="/test/product/${encodeURIComponent(product.id)}/${encodeURIComponent(product.slug || "produkt")}">
            <span>${escapeHtml(product.name)}</span>
            <strong>${product.price === null ? "Cena do ustalenia" : formatPrice(product.price, product.currency)}</strong>
          </a>
        `).join("")}
      </div>
    </section>`;
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
