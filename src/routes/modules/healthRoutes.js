import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";

export function createHealthRouter(config, storeCache) {
  const router = express.Router();

  router.get(
    "/health",
    asyncHandler(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      if (!isLocalHealthRequest(req)) {
        res.json({
          status: "ok",
          service: "bookloft-shop",
          version: config.version
        });
        return;
      }

      const status = await storeCache.getStatus();
      res.json({
        status: "ok",
        service: "bookloft-shop",
        version: config.version,
        adminPasswordConfigured: Boolean(config.adminPassword),
        cache: {
          stockUpdatedAt: status.stockUpdatedAt,
          catalogUpdatedAt: status.catalogUpdatedAt,
          visibleProductCount: status.visibleProductCount,
          lastErrorAt: status.lastErrorAt,
          allegroConnected: Boolean(status.allegro?.connected)
        }
      });
    })
  );

  return router;
}

function isLocalHealthRequest(req) {
  const hostHeader = String(req.headers.host || "").toLowerCase();
  const host = hostHeader.startsWith("[::1]") ? "::1" : hostHeader.split(":")[0];
  return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
}
