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
  version: "1.19.1",
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
  googleAnalyticsId: env("BOOKLOFT_GA_ID", "GOOGLE_ANALYTICS_ID") || "G-NQH5FFJ8Y4",
  allegroApiUrl: (env("ALLEGRO_API_URL") || "https://api.allegro.pl").replace(/\/+$/, ""),
  allegroAuthUrl: env("ALLEGRO_AUTH_URL") || "https://allegro.pl/auth/oauth/authorize",
  allegroTokenUrl: env("ALLEGRO_TOKEN_URL") || "https://allegro.pl/auth/oauth/token",
  allegroClientId: env("ALLEGRO_CLIENT_ID"),
  allegroClientSecret: env("ALLEGRO_CLIENT_SECRET"),
  allegroRedirectUri: env("ALLEGRO_REDIRECT_URI") || `${(env("BOOKLOFT_PUBLIC_ORIGIN") || "https://bookloft.pl").replace(/\/+$/, "")}/api/allegro/oauth/callback`,
  allegroScope: env("ALLEGRO_SCOPE") || "allegro:api:sale:offers:read",
  allegroMarketplaceId: env("ALLEGRO_MARKETPLACE_ID") || "allegro-pl",
  allegroSellingFormats: (env("ALLEGRO_SELLING_FORMATS") || "BUY_NOW")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  allegroOfferLimit: intEnv("ALLEGRO_OFFER_LIMIT", 1000),
  stockRefreshMs: msEnv("BOOKLOFT_STOCK_REFRESH_MS", 30 * 60 * 1000),
  catalogRefreshMs: msEnv("BOOKLOFT_CATALOG_REFRESH_MS", 3 * 60 * 60 * 1000),
  dailyAddNewEnabled: boolEnv("BOOKLOFT_DAILY_ADD_NEW_ENABLED", true),
  dailyAddNewHour: intEnv("BOOKLOFT_DAILY_ADD_NEW_HOUR", 22),
  dailyAddNewMinute: intEnv("BOOKLOFT_DAILY_ADD_NEW_MINUTE", 0),
  dailyAddNewTimeZone: env("BOOKLOFT_DAILY_ADD_NEW_TIME_ZONE") || "Europe/Warsaw",
  requestTimeoutMs: msEnv(["ALLEGRO_REQUEST_TIMEOUT_MS", "BOOKLOFT_REQUEST_TIMEOUT_MS"], 30000)
};

export function publicUrl(relativePath = "") {
  return appPath(config.basePath, relativePath);
}
