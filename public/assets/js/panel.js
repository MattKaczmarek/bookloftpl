const message = document.querySelector("#panel-message");
const button = document.querySelector("#add-new");

const fields = {
  visible: document.querySelector("#metric-visible"),
  active: document.querySelector("#metric-active"),
  categories: document.querySelector("#metric-categories"),
  hidden: document.querySelector("#metric-hidden"),
  stock: document.querySelector("#stock-updated"),
  catalog: document.querySelector("#catalog-updated"),
  context: document.querySelector("#allegro-context"),
  connection: document.querySelector("#allegro-connection"),
  error: document.querySelector("#last-error")
};

button.addEventListener("click", addNewProducts);
loadStatus().catch(showError);

async function addNewProducts() {
  button.disabled = true;
  message.textContent = "Pobieram aktywne oferty z Allegro...";

  try {
    const response = await fetch("/api/admin/add-new", {
      method: "POST",
      credentials: "same-origin"
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);

    message.textContent = `Dodano: ${data.addedCount}. Aktywne oferty: ${data.activeProductCount}.`;
    await loadStatus();
  } catch (error) {
    showError(error);
  } finally {
    button.disabled = false;
  }
}

async function loadStatus() {
  const response = await fetch("/api/status", { credentials: "same-origin" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const status = await response.json();

  fields.visible.textContent = status.visibleProductCount;
  fields.active.textContent = status.activeProductCount;
  fields.categories.textContent = status.visibleCategoryCount;
  fields.hidden.textContent = status.hiddenByStockCount;
  fields.stock.textContent = formatDate(status.stockUpdatedAt);
  fields.catalog.textContent = formatDate(status.catalogUpdatedAt);
  fields.context.textContent = status.context
    ? `${status.context.source || "Allegro"} / ${status.context.marketplaceId || "allegro-pl"}`
    : "-";
  fields.connection.textContent = status.allegro?.connected
    ? `Polaczone, token do ${formatDate(status.allegro.expiresAt)}`
    : "Niepolaczone";
  fields.error.textContent = status.lastError ? `${status.lastErrorAt || ""} ${status.lastError}` : "Brak";
}

function showError(error) {
  message.textContent = `Blad: ${error.message}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
