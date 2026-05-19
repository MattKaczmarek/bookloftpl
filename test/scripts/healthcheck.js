const port = process.env.BOOKLOFT_TEST_PORT || "3205";
const host = process.env.BOOKLOFT_TEST_HOST || "127.0.0.1";
const basePath = (process.env.BOOKLOFT_TEST_BASE_PATH || "/test").replace(/\/+$/, "");
const url = process.env.BOOKLOFT_TEST_HEALTH_URL || `http://${host}:${port}${basePath}/health`;

const response = await fetch(url);
if (!response.ok) {
  console.error(`Healthcheck failed: HTTP ${response.status}`);
  process.exit(1);
}

const data = await response.json();
if (data.status !== "ok") {
  console.error(`Healthcheck failed: ${JSON.stringify(data)}`);
  process.exit(1);
}

console.log(`ok version=${data.version} visible=${data.cache.visibleProductCount}`);
