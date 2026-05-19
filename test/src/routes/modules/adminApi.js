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

  return router;
}
