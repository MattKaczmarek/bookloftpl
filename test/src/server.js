import express from "express";
import path from "node:path";
import { config } from "./config.js";
import { createRouter } from "./routes/index.js";
import { StoreCache } from "./services/storeCache.js";

const app = express();
const storeCache = new StoreCache(config);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.locals.config = config;

await storeCache.init();
storeCache.schedule();

app.use(config.basePath, createRouter(config, storeCache));

if (process.env.BOOKLOFT_SERVE_LANDING === "1") {
  const landingRoot = path.resolve(config.appRoot, "..");
  app.get("/", (_req, res) => {
    res.sendFile(path.join(landingRoot, "index.html"));
  });
  app.get("/styles.css", (_req, res) => {
    res.sendFile(path.join(landingRoot, "styles.css"));
  });
  app.get("/script.js", (_req, res) => {
    res.sendFile(path.join(landingRoot, "script.js"));
  });
  app.use("/images", express.static(path.join(landingRoot, "images"), { maxAge: "10m", etag: true }));
} else {
  app.get("/", (_req, res) => {
    res.redirect(config.basePath);
  });
}

app.listen(config.port, config.host, () => {
  console.log(`BookLoft test shop ${config.version} listening on http://${config.host}:${config.port}${config.basePath}`);
});
