import express from "express";
import { requireAuth } from "../../lib/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function createAdminApiRouter(config, storeCache) {
  const router = express.Router();
  router.use(requireAuth(config));

  router.post(
    "/add-new",
    asyncHandler(async (_req, res) => {
      const result = await storeCache.addNewProducts();
      res.json({ status: "ok", ...result });
    })
  );

  router.post(
    "/enrich-details",
    asyncHandler(async (req, res) => {
      const result = await storeCache.enrichActiveOfferDetails({ force: req.query.force === "1" });
      res.json({ status: "ok", ...result });
    })
  );

  router.get(
    "/allegro/connect",
    asyncHandler(async (_req, res) => {
      const url = await storeCache.createAllegroConnectUrl();
      res.redirect(url);
    })
  );

  return router;
}
