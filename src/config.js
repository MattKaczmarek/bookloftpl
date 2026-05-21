import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

function env(...names) {
  for (const name of names) {
    const raw = process.env[name];
    if (raw !== undefined && raw !== "") return raw;
  }
  return "";
}

function intEnv(names, fallback) {
  const raw = Array.isArray(names) ? env(...names) : env(names);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function msEnv(names, fallback) {
  const raw = Array.isArray(names) ? env(...names) : env(names);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function boolEnv(names, fallback) {
  const raw = Array.isArray(names) ? env(...names) : env(names);
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

function normalizeBasePath(value) {
  const normalized = value && value.startsWith("/") ? value : `/${value || ""}`;
  const trimmed = normalized.replace(/\/+$/, "");
  return trimmed || "/";
}

export function appPath(basePath, relativePath = "") {
  const suffix = relativePath ? (relativePath.startsWith("/") ? relativePath : `/${relativePath}`) : "/";
  if (suffix === "/") return basePath === "/" ? "/" : basePath;
  return basePath === "/" ? suffix : `${basePath}${suffix}`;
}

const resolvedBasePath = normalizeBasePath(env("BOOKLOFT_BASE_PATH") || "/");

export const config = {
  version: "1.03",
  appRoot,
  publicDir: path.join(appRoot, "public"),
  port: intEnv("BOOKLOFT_PORT", 3205),
  host: env("BOOKLOFT_HOST") || "127.0.0.1",
  basePath: resolvedBasePath,
  publicOrigin: (env("BOOKLOFT_PUBLIC_ORIGIN") || "https://bookloft.pl").replace(/\/+$/, ""),
  dataDir: path.resolve(env("BOOKLOFT_DATA_DIR") || path.join(appRoot, "storage")),
  adminUser: env("BOOKLOFT_ADMIN_USER"),
  adminPassword: env("BOOKLOFT_ADMIN_PASSWORD"),
  sessionSecret: env("BOOKLOFT_SESSION_SECRET", "SESSION_SECRET") || crypto.randomBytes(32).toString("hex"),
  sessionMaxAgeMs: msEnv("BOOKLOFT_SESSION_MAX_AGE_MS", 12 * 60 * 60 * 1000),
  cookieSecure: boolEnv("BOOKLOFT_COOKIE_SECURE", process.env.NODE_ENV === "production"),
  baseApiUrl: env("BASE_COM_API_URL") || "https://api.baselinker.com/connector.php",
  baseToken: env("BASE_COM_TOKEN"),
  baseInventoryId: intEnv("BASE_COM_INVENTORY_ID", null),
  basePriceGroupId: intEnv("BASE_COM_PRICE_GROUP_ID", null),
  basePriceGroupName: env("BASE_COM_PRICE_GROUP_NAME") || "Sklep",
  baseWarehouseId: env("BASE_COM_WAREHOUSE_ID"),
  stockRefreshMs: msEnv("BOOKLOFT_STOCK_REFRESH_MS", 30 * 60 * 1000),
  catalogRefreshMs: msEnv("BOOKLOFT_CATALOG_REFRESH_MS", 3 * 60 * 60 * 1000),
  requestTimeoutMs: msEnv("BASE_COM_REQUEST_TIMEOUT_MS", 30000),
  productsDataChunkSize: intEnv("BASE_COM_PRODUCTS_DATA_CHUNK_SIZE", 100)
};

export function publicUrl(relativePath = "") {
  return appPath(config.basePath, relativePath);
}
