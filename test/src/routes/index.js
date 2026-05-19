import express from "express";
import { createAdminApiRouter } from "./modules/adminApi.js";
import { createAuthRouter } from "./modules/authRoutes.js";
import { createHealthRouter } from "./modules/healthRoutes.js";
import { createPageRouter } from "./modules/pageRoutes.js";
import { createStoreApiRouter } from "./modules/storeApi.js";

export function createRouter(config, storeCache) {
  const router = express.Router();

  router.use("/assets", express.static(`${config.publicDir}/assets`, { maxAge: "10m", etag: true }));
  router.use(createHealthRouter(config, storeCache));
  router.use(createAuthRouter(config));
  router.use(createPageRouter(config));
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
