import express from "express";
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

app.get("/", (_req, res) => {
  res.redirect(config.basePath);
});

app.listen(config.port, config.host, () => {
  console.log(`BookLoft test shop ${config.version} listening on http://${config.host}:${config.port}${config.basePath}`);
});
