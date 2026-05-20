export function renderLogin(config, error) {
  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BookLoft</title>
  <link rel="stylesheet" href="${config.basePath}/assets/css/styles.css?v=${config.version}">
</head>
<body class="login-page">
  <main class="login-shell">
    <section class="login-panel" aria-labelledby="login-title">
      <div class="login-brand" aria-label="BookLoft">
        <span class="brand-mark"><img src="${config.basePath}/assets/img/logo-mark.png?v=${config.version}" alt=""></span>
        <span class="brand-word">BookLoft</span>
      </div>
      <h1 id="login-title">Zaloguj się</h1>
      <form method="post" action="${config.basePath}/login" class="login-form">
        <input type="hidden" name="next" value="${config.basePath}">
        <label>
          <span>Login</span>
          <input name="username" autocomplete="username" required autofocus>
        </label>
        <label>
          <span>Hasło</span>
          <input name="password" type="password" autocomplete="current-password" required>
        </label>
        ${error ? '<p class="form-error">Nieprawidłowy login albo hasło.</p>' : ""}
        ${config.adminPassword ? "" : '<p class="form-error">Brak hasła w ENV serwera.</p>'}
        <button type="submit" class="primary-action">Wejdź</button>
      </form>
    </section>
  </main>
</body>
</html>`;
}
