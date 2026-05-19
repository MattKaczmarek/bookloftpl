import express from "express";
import { clearSessionCookie, createSessionCookie, isValidLogin } from "../../lib/auth.js";
import { renderLogin } from "../views/loginView.js";

export function createAuthRouter(config) {
  const router = express.Router();

  router.get("/login", (req, res) => {
    res.type("html").send(renderLogin(config, req.query.error));
  });

  router.post("/login", express.urlencoded({ extended: false }), (req, res) => {
    if (!isValidLogin(req.body, config)) {
      res.redirect(`${config.basePath}/login?error=1`);
      return;
    }

    res.setHeader("Set-Cookie", createSessionCookie(config));
    res.redirect(safeNextUrl(req.body.next, config.basePath));
  });

  router.post("/logout", (_req, res) => {
    res.setHeader("Set-Cookie", clearSessionCookie(config));
    res.redirect(`${config.basePath}/login`);
  });

  return router;
}

function safeNextUrl(value, basePath) {
  if (!value || typeof value !== "string") return basePath;
  try {
    const decoded = decodeURIComponent(value);
    return decoded.startsWith(basePath) ? decoded : basePath;
  } catch {
    return basePath;
  }
}
