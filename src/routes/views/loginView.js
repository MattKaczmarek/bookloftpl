import { appPath } from "../../config.js";

export function renderLogin(config, error, next = config.basePath) {
  const loginPath = appPath(config.basePath, "/login");
  const stylesheetPath = appPath(config.basePath, `/assets/css/styles.css?v=${config.version}`);
  const analyticsPath = appPath(config.basePath, `/assets/js/analytics.js?v=${config.version}`);
  const logoPath = appPath(config.basePath, `/assets/img/logo.png?v=${config.version}`);
  const faviconPath = appPath(config.basePath, `/assets/img/favicon-32.png?v=${config.version}`);
  const faviconLargePath = appPath(config.basePath, `/assets/img/favicon.png?v=${config.version}`);
  const appleTouchIconPath = appPath(config.basePath, `/assets/img/apple-touch-icon.png?v=${config.version}`);

  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>BookLoft</title>
  <link rel="icon" type="image/png" sizes="32x32" href="${faviconPath}">
  <link rel="icon" type="image/png" sizes="512x512" href="${faviconLargePath}">
  <link rel="apple-touch-icon" sizes="180x180" href="${appleTouchIconPath}">
  <link rel="stylesheet" href="${stylesheetPath}">
  <script>window.BOOKLOFT_ANALYTICS_ID=${JSON.stringify(config.googleAnalyticsId || "")};</script>
  <script defer src="${analyticsPath}"></script>
</head>
<body class="login-page">
  <main class="login-shell">
    <section class="login-panel" aria-labelledby="login-title">
      <div class="login-brand" aria-label="BookLoft">
        <img class="login-logo" src="${logoPath}" alt="BookLoft">
      </div>
      <h1 id="login-title">Strona w renowacji</h1>
      <p class="login-note">Zapraszamy później. Sklep jest teraz dopracowywany i pozostaje dostępny tylko dla zespołu BookLoft.</p>
      <form method="post" action="${loginPath}" class="login-form">
        <input type="hidden" name="next" value="${escapeAttribute(next)}">
        <label>
          <span>Login</span>
          <input name="username" autocomplete="username" required autofocus>
        </label>
        <label>
          <span>Hasło</span>
          <input name="password" type="password" autocomplete="current-password" required>
        </label>
        ${error ? '<p class="form-error">Nieprawidłowy login albo hasło.</p>' : ""}
        ${config.adminUser && config.adminPassword ? "" : '<p class="form-error">Brak danych logowania w ENV serwera.</p>'}
        <button type="submit" class="primary-action">Wejdź</button>
      </form>
    </section>
  </main>
</body>
</html>`;
}

function escapeAttribute(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
