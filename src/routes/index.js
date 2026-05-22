import express from "express";
import { createAllegroOAuthRouter } from "./modules/allegroOAuthRoutes.js";
import { createAdminApiRouter } from "./modules/adminApi.js";
import { createAuthRouter } from "./modules/authRoutes.js";
import { createHealthRouter } from "./modules/healthRoutes.js";
import { createPageRouter } from "./modules/pageRoutes.js";
import { createStoreApiRouter } from "./modules/storeApi.js";

export function createRouter(config, storeCache) {
  const router = express.Router();

  router.use((_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    next();
  });

  router.get("/favicon.ico", (_req, res) => {
    res.type("image/png").sendFile(`${config.publicDir}/assets/img/favicon-32.png`);
  });
  router.get("/apple-touch-icon.png", (_req, res) => {
    res.type("image/png").sendFile(`${config.publicDir}/assets/img/apple-touch-icon.png`);
  });
  router.use("/assets", express.static(`${config.publicDir}/assets`, { maxAge: "10m", etag: true }));
  router.use(createHealthRouter(config, storeCache));
  router.use(createAuthRouter(config));
  router.use(createPageRouter(config, storeCache));
  router.use("/api/allegro", createAllegroOAuthRouter(config, storeCache));
  router.use("/api", createStoreApiRouter(config, storeCache));
  router.use("/api/admin", createAdminApiRouter(config, storeCache));

  router.use((req, res) => {
    if (req.accepts("html")) {
      res.redirect(config.basePath);
      return;
    }
    res.status(404).json({ status: "not_found" });
  });

  router.use((error, _req, res, _next) => {
    res.status(500).json({
      status: "error",
      message: error.message || "Unexpected server error"
    });
  });

  return router;
}
