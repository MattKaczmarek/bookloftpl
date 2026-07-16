import { appPath, config } from "../src/config.js";
import { createSessionCookie } from "../src/lib/auth.js";

if (!config.adminUser || !config.adminPassword || !process.env.BOOKLOFT_SESSION_SECRET) {
  throw new Error("Brak produkcyjnych danych sesji administratora w ENV");
}

const origin = process.env.BOOKLOFT_INTERNAL_ORIGIN || `http://127.0.0.1:${config.port}`;
const cookie = createSessionCookie(config).split(";", 1)[0];

const addResult = await postJson("/api/admin/add-new");
console.log(`BookLoft listing refresh added=${addResult.addedCount} active=${addResult.activeProductCount}`);

let enrichment = await postJson("/api/admin/enrich-details");
console.log(`BookLoft detail enrichment total=${enrichment.totalCount} success=${enrichment.successCount} failed=${enrichment.failedCount}`);
if (enrichment.failedCount) {
  enrichment = await postJson("/api/admin/enrich-details");
  console.log(`BookLoft detail enrichment retry total=${enrichment.totalCount} success=${enrichment.successCount} failed=${enrichment.failedCount}`);
}
if (enrichment.failedOfferIds?.length) {
  console.log(`BookLoft detail enrichment remaining=${enrichment.failedOfferIds.slice(0, 50).join(",")}`);
  process.exitCode = 2;
}

async function postJson(relativePath) {
  const response = await fetch(`${origin}${appPath(config.basePath, relativePath)}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Cookie: cookie
    },
    redirect: "manual"
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Cache refresh HTTP ${response.status}: ${body.slice(0, 300)}`);
  }
  const data = JSON.parse(body);
  if (data.status !== "ok") {
    throw new Error(`Cache refresh failed: ${body.slice(0, 300)}`);
  }
  return data;
}
