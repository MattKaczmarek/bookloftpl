import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

test("shop runtime bounds SSR bursts and exposes local memory telemetry", async () => {
  const [service, nginxSite, nginxLimits, healthRoute] = await Promise.all([
    source("deploy/bookloft-shop.service.example"),
    source("deploy/nginx-root.conf.example"),
    source("deploy/nginx-rate-limits.conf.example"),
    source("src/routes/modules/healthRoutes.js")
  ]);

  assert.match(service, /^MemoryHigh=768M$/m);
  assert.match(service, /^MemoryMax=1G$/m);
  assert.match(service, /^MemorySwapMax=256M$/m);
  assert.match(service, /^OOMPolicy=kill$/m);
  assert.match(nginxLimits, /map \$uri \$bookloft_shop_dynamic_client/);
  assert.match(nginxLimits, /zone=bookloft_shop_pages:10m rate=5r\/s/);
  assert.match(nginxSite, /limit_req zone=bookloft_shop_pages burst=20 nodelay/);
  assert.match(nginxSite, /limit_conn bookloft_shop_connections 16/);
  assert.match(healthRoute, /const memory = process\.memoryUsage\(\)/);
  assert.match(healthRoute, /rssBytes: memory\.rss/);
  assert.match(healthRoute, /heapUsedBytes: memory\.heapUsed/);
});
