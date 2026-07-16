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
      res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
      res.status(404).type("html").send(`<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>Nie znaleziono strony | BookLoft</title>
  <link rel="stylesheet" href="${config.basePath === "/" ? "" : config.basePath}/assets/css/fonts.css?v=${config.version}">
  <link rel="stylesheet" href="${config.basePath === "/" ? "" : config.basePath}/assets/css/styles.css?v=${config.version}">
</head>
<body>
  <main class="shop-layout simple-page-shell">
    <section class="shop-surface simple-page">
      <div class="empty-state">
        <h1>Nie znaleziono strony</h1>
        <p>Wróć do katalogu i sprawdź aktualne oferty BookLoft.</p>
        <a class="secondary-action" href="${config.basePath}">Wróć do ofert</a>
      </div>
    </section>
  </main>
</body>
</html>`);
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
