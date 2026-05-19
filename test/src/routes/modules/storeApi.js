import express from "express";
import { requireAuth } from "../../lib/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function createStoreApiRouter(config, storeCache) {
  const router = express.Router();
  router.use(requireAuth(config));

  router.get(
    "/storefront",
    asyncHandler(async (_req, res) => {
      res.json(await storeCache.getStorefront());
    })
  );

  router.get(
    "/status",
    asyncHandler(async (_req, res) => {
      res.json(await storeCache.getStatus());
    })
  );

  return router;
}
