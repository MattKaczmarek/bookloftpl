import express from "express";
import { createAllegroOAuthRouter } from "./modules/allegroOAuthRoutes.js";
import { createAdminApiRouter } from "./modules/adminApi.js";
import { createAuthRouter } from "./modules/authRoutes.js";
import { createHealthRouter } from "./modules/healthRoutes.js";
import { createPageRouter } from "./modules/pageRoutes.js";
import { createStoreApiRouter } from "./modules/storeApi.js";

export function createRouter(config, storeCache) {
  const router = express.Router();

  router.get("/favicon.ico", (_req, res) => {
    res.type("image/png").sendFile(`${config.publicDir}/assets/img/favicon-32.png`);
  });
  router.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send([
      "User-agent: *",
      "Allow: /",
      "Disallow: /panel",
      "Disallow: /login",
      "Disallow: /api/admin",
      `Sitemap: ${config.publicOrigin}${config.basePath === "/" ? "" : config.basePath}/sitemap.xml`,
      ""
    ].join("\n"));
  });
  router.get("/apple-touch-icon.png", (_req, res) => {
    res.type("image/png").sendFile(`${config.publicDir}/assets/img/apple-touch-icon.png`);
  });
  router.use("/assets", express.static(`${config.publicDir}/assets`, { maxAge: "30d", etag: true }));
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
