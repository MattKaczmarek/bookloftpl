import express from "express";
import { appPath } from "../../config.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function createAllegroOAuthRouter(config, storeCache) {
  const router = express.Router();

  router.get(
    "/oauth/callback",
    asyncHandler(async (req, res) => {
      try {
        await storeCache.handleAllegroCallback({
          code: req.query.code,
          state: req.query.state
        });
        res.redirect(appPath(config.basePath, "/panel?allegro=connected"));
      } catch (error) {
        const message = encodeURIComponent(error.message || "oauth_error");
        res.redirect(appPath(config.basePath, `/panel?allegro=error&message=${message}`));
      }
    })
  );

  return router;
}
