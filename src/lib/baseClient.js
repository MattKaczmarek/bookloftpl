export class BaseClient {
  constructor(config) {
    this.config = config;
  }

  async call(method, parameters = {}) {
    if (!this.config.baseToken) {
      throw new Error("BASE_COM_TOKEN is not configured");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const body = new URLSearchParams();
      body.set("method", method);
      body.set("parameters", JSON.stringify(parameters));

      const response = await fetch(this.config.baseApiUrl, {
        method: "POST",
        headers: {
          "X-BLToken": this.config.baseToken,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Base API HTTP ${response.status} for ${method}`);
      }

      const data = await response.json();
      if (data.status !== "SUCCESS") {
        throw new Error(`Base API ${method} failed: ${data.error_code || "ERROR"} ${data.error_message || ""}`.trim());
      }

      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async resolveContext() {
    const [inventoriesData, priceGroupsData] = await Promise.all([
      this.call("getInventories"),
      this.call("getInventoryPriceGroups")
    ]);

    const inventories = inventoriesData.inventories || [];
    const priceGroups = priceGroupsData.price_groups || [];

    const inventory =
      inventories.find((item) => Number(item.inventory_id) === Number(this.config.baseInventoryId)) ||
      inventories.find((item) => item.is_default) ||
      inventories[0];

    if (!inventory) {
      throw new Error("No Base inventory is available for this token");
    }

    const priceGroup =
      priceGroups.find((item) => Number(item.price_group_id) === Number(this.config.basePriceGroupId)) ||
      priceGroups.find((item) => normalizeName(item.name) === normalizeName(this.config.basePriceGroupName));

    if (!priceGroup) {
      throw new Error(`Base price group "${this.config.basePriceGroupName}" was not found`);
    }

    const inventoryPriceGroups = new Set((inventory.price_groups || []).map((id) => Number(id)));
    if (!inventoryPriceGroups.has(Number(priceGroup.price_group_id))) {
      throw new Error(`Price group "${priceGroup.name}" is not assigned to inventory "${inventory.name}"`);
    }

    return {
      inventoryId: Number(inventory.inventory_id),
      inventoryName: inventory.name,
      defaultLanguage: inventory.default_language || "",
      defaultWarehouse: inventory.default_warehouse || "",
      priceGroupId: Number(priceGroup.price_group_id),
      priceGroupName: priceGroup.name,
      currency: priceGroup.currency || "PLN"
    };
  }

  async getAllPaged(method, parameters = {}, listKey = "products") {
    const pages = [];
    for (let page = 1; page < 10000; page += 1) {
      const data = await this.call(method, { ...parameters, page });
      const items = data[listKey] || {};
      const size = Array.isArray(items) ? items.length : Object.keys(items).length;
      if (size === 0) break;
      pages.push(items);
      if (size < 1000) break;
    }
    return pages;
  }
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("pl-PL");
}
