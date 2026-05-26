import express from "express";
import { requireAuth } from "../../lib/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function createStoreApiRouter(config, storeCache) {
  const router = express.Router();

  router.get(
    "/newest",
    asyncHandler(async (req, res) => {
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json({
        products: await storeCache.getNewestProducts(req.query.limit),
        generatedAt: new Date().toISOString()
      });
    })
  );

  router.get(
    "/storefront",
    asyncHandler(async (_req, res) => {
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json(await storeCache.getStorefrontList());
    })
  );

  router.get(
    "/products/:productId",
    asyncHandler(async (req, res) => {
      const product = await storeCache.getProduct(req.params.productId);
      if (!product) {
        const status = await storeCache.getMissingProductStatus(req.params.productId);
        res.status(status).json({ status: status === 410 ? "gone" : "not_found" });
        return;
      }
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json(product);
    })
  );

  router.get(
    "/status",
    requireAuth(config),
    asyncHandler(async (_req, res) => {
      res.json(await storeCache.getStatus());
    })
  );

  return router;
}
