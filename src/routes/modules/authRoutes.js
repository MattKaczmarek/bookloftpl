import express from "express";
import { appPath } from "../../config.js";
import { clearSessionCookie, createSessionCookie, isValidLogin } from "../../lib/auth.js";
import { renderLogin } from "../views/loginView.js";

export function createAuthRouter(config) {
  const router = express.Router();

  router.get("/login", (req, res) => {
    res.type("html").send(renderLogin(config, req.query.error, safeNextUrl(req.query.next, config.basePath)));
  });

  router.post("/login", express.urlencoded({ extended: false }), (req, res) => {
    if (!isValidLogin(req.body, config)) {
      const next = encodeURIComponent(safeNextUrl(req.body.next, config.basePath));
      res.redirect(appPath(config.basePath, `/login?error=1&next=${next}`));
      return;
    }

    res.setHeader("Set-Cookie", createSessionCookie(config));
    res.redirect(safeNextUrl(req.body.next, config.basePath));
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
