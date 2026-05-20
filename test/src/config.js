import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function msEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function boolEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

function basePath(value) {
  const normalized = value && value.startsWith("/") ? value : `/${value || "test"}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

export const config = {
  version: "1.01",
  appRoot,
  publicDir: path.join(appRoot, "public"),
  port: intEnv("BOOKLOFT_TEST_PORT", 3205),
  host: process.env.BOOKLOFT_TEST_HOST || "127.0.0.1",
  basePath: basePath(process.env.BOOKLOFT_TEST_BASE_PATH || "/test"),
  dataDir: path.resolve(process.env.BOOKLOFT_TEST_DATA_DIR || path.join(appRoot, "storage")),
  adminUser: process.env.BOOKLOFT_TEST_ADMIN_USER || "admin",
  adminPassword: process.env.BOOKLOFT_TEST_ADMIN_PASSWORD || "",
  sessionSecret:
    process.env.BOOKLOFT_TEST_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    crypto.randomBytes(32).toString("hex"),
  sessionMaxAgeMs: msEnv("BOOKLOFT_TEST_SESSION_MAX_AGE_MS", 12 * 60 * 60 * 1000),
  cookieSecure: boolEnv("BOOKLOFT_TEST_COOKIE_SECURE", process.env.NODE_ENV === "production"),
  baseApiUrl: process.env.BASE_COM_API_URL || "https://api.baselinker.com/connector.php",
  baseToken: process.env.BASE_COM_TOKEN || "",
  baseInventoryId: intEnv("BASE_COM_INVENTORY_ID", null),
  basePriceGroupId: intEnv("BASE_COM_PRICE_GROUP_ID", null),
  basePriceGroupName: process.env.BASE_COM_PRICE_GROUP_NAME || "Sklep",
  baseWarehouseId: process.env.BASE_COM_WAREHOUSE_ID || "",
  stockRefreshMs: msEnv("BOOKLOFT_TEST_STOCK_REFRESH_MS", 30 * 60 * 1000),
  catalogRefreshMs: msEnv("BOOKLOFT_TEST_CATALOG_REFRESH_MS", 3 * 60 * 60 * 1000),
  requestTimeoutMs: msEnv("BASE_COM_REQUEST_TIMEOUT_MS", 30000),
  productsDataChunkSize: intEnv("BASE_COM_PRODUCTS_DATA_CHUNK_SIZE", 100)
};

export function publicUrl(relativePath = "") {
  const suffix = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return `${config.basePath}${suffix}`;
}
