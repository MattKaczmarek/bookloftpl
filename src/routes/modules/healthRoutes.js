import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";

export function createHealthRouter(config, storeCache) {
  const router = express.Router();

  router.get(
    "/health",
    asyncHandler(async (_req, res) => {
      const status = await storeCache.getStatus();
      res.json({
        status: "ok",
        version: config.version,
        adminPasswordConfigured: Boolean(config.adminPassword),
        cache: {
          stockUpdatedAt: status.stockUpdatedAt,
          catalogUpdatedAt: status.catalogUpdatedAt,
          visibleProductCount: status.visibleProductCount,
          lastErrorAt: status.lastErrorAt
        }
      });
    })
  );

  return router;
}
