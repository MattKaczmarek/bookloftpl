import express from "express";
import path from "node:path";
import { requireAuth } from "../../lib/auth.js";

export function createPageRouter(config) {
  const router = express.Router();
  const auth = requireAuth(config);

  router.get("/", auth, (_req, res) => {
    res.sendFile(path.join(config.publicDir, "store.html"));
  });

  router.get("/panel", auth, (_req, res) => {
    res.sendFile(path.join(config.publicDir, "panel.html"));
  });

  return router;
}
