import express from "express";
import { appPath } from "../../config.js";
import { clearSessionCookie, createSessionCookie, isValidLogin } from "../../lib/auth.js";
import { renderLogin } from "../views/loginView.js";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;
const loginFailures = new Map();

export function createAuthRouter(config) {
  const router = express.Router();

  router.get("/login", (req, res) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.type("html").send(renderLogin(config, req.query.error, safeNextUrl(req.query.next, appPath(config.basePath, "/panel"))));
  });

  router.post("/login", express.urlencoded({ extended: false }), (req, res) => {
    const key = loginRateKey(req);
    if (isRateLimited(key)) {
      const next = safeNextUrl(req.body.next, appPath(config.basePath, "/panel"));
      res.setHeader("Retry-After", String(Math.ceil(LOGIN_WINDOW_MS / 1000)));
      res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
      res.status(429).type("html").send(renderLogin(config, "rate", next));
      return;
    }

    if (!isValidLogin(req.body, config)) {
      recordLoginFailure(key);
      const next = encodeURIComponent(safeNextUrl(req.body.next, appPath(config.basePath, "/panel")));
      res.redirect(appPath(config.basePath, `/login?error=1&next=${next}`));
      return;
    }

    clearLoginFailures(key);
    res.setHeader("Set-Cookie", createSessionCookie(config));
    res.redirect(safeNextUrl(req.body.next, appPath(config.basePath, "/panel")));
  });

  router.post("/logout", (_req, res) => {
    res.setHeader("Set-Cookie", clearSessionCookie(config));
    res.redirect(appPath(config.basePath, "/login"));
  });

  return router;
}

function safeNextUrl(value, basePath) {
  if (!value || typeof value !== "string") return basePath;
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return basePath;
    if (basePath === "/") return decoded;
    return decoded === "/" || decoded.startsWith(basePath) ? decoded : basePath;
  } catch {
    return basePath;
  }
}

function loginRateKey(req) {
  return String(req.ip || req.socket?.remoteAddress || "unknown");
}

function isRateLimited(key) {
  const entry = loginFailures.get(key);
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) {
    loginFailures.delete(key);
    return false;
  }
  return entry.count >= LOGIN_MAX_FAILURES;
}

function recordLoginFailure(key) {
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || entry.resetAt <= now) {
    loginFailures.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    cleanupLoginFailures(now);
    return;
  }
  entry.count += 1;
}

function clearLoginFailures(key) {
  loginFailures.delete(key);
}

function cleanupLoginFailures(now = Date.now()) {
  for (const [key, entry] of loginFailures) {
    if (entry.resetAt <= now) loginFailures.delete(key);
  }
}
