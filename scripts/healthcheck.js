const port = process.env.BOOKLOFT_PORT || "3205";
const host = process.env.BOOKLOFT_HOST || "127.0.0.1";
const basePath = (process.env.BOOKLOFT_BASE_PATH || "/").replace(/\/+$/, "") || "/";
const healthPath = basePath === "/" ? "/health" : `${basePath}/health`;
const url = process.env.BOOKLOFT_HEALTH_URL || `http://${host}:${port}${healthPath}`;

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
