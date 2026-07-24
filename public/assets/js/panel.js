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
  automaticAddNew: document.querySelector("#automatic-add-new"),
  automaticAddNewLast: document.querySelector("#automatic-add-new-last"),
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
    ? `Połączone, token do ${formatDate(status.allegro.expiresAt)}`
    : "Niepołączone";
  fields.automaticAddNew.textContent = status.automaticAddNew?.enabled
    ? `${formatScheduleTime(status.automaticAddNew)}; następne: ${formatDate(status.automaticAddNew.nextRunAt)}`
    : "Wyłączone";
  fields.automaticAddNewLast.textContent = formatAutomaticAddNewResult(status.automaticAddNew);
  fields.error.textContent = status.lastError ? `${status.lastErrorAt || ""} ${status.lastError}` : "Brak";
}

function showError(error) {
  message.textContent = `Błąd: ${error.message}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatScheduleTime(schedule) {
  const hour = String(schedule.hour ?? 0).padStart(2, "0");
  const minute = String(schedule.minute ?? 0).padStart(2, "0");
  return `codziennie ${hour}:${minute} (${schedule.timeZone || "Europe/Warsaw"})`;
}

function formatAutomaticAddNewResult(schedule) {
  if (!schedule) return "Jeszcze nie uruchomiono";
  const lastSuccessAt = Date.parse(schedule.lastSuccessAt || "");
  const lastErrorAt = Date.parse(schedule.lastErrorAt || "");
  if (Number.isFinite(lastErrorAt) && (!Number.isFinite(lastSuccessAt) || lastErrorAt > lastSuccessAt)) {
    return `Błąd ${formatDate(schedule.lastErrorAt)}: ${schedule.lastError || "nie udało się dodać ofert"}`;
  }
  if (schedule.lastSuccessAt) {
    return `${formatDate(schedule.lastSuccessAt)}; dodano: ${schedule.lastResult?.addedCount ?? 0}`;
  }
  return "Jeszcze nie uruchomiono";
}
