(function () {
  const measurementId = String(window.BOOKLOFT_ANALYTICS_ID || "").trim();
  const storageKey = "bookloft_analytics_consent";
  let analyticsConfigured = false;

  if (!measurementId) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  window.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    security_storage: "granted"
  });

  window.gtag("js", new Date());

  const storedConsent = readConsent();
  if (storedConsent === "granted") {
    applyConsent("granted");
  } else if (storedConsent === "denied") {
    applyConsent("denied");
  } else if (storedConsent !== "denied") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", renderConsentBanner, { once: true });
    } else {
      renderConsentBanner();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureSettingsTrigger, { once: true });
  } else {
    ensureSettingsTrigger();
  }

  document.addEventListener("click", (event) => {
    const settingsButton = event.target.closest ? event.target.closest("[data-cookie-settings]") : null;
    if (settingsButton) {
      renderConsentBanner();
      return;
    }

    const link = event.target.closest ? event.target.closest("a[href]") : null;
    if (!link || readConsent() !== "granted") return;
    const href = link.href || "";
    if (!href.includes("allegro.pl/oferta")) return;
    window.gtag("event", "allegro_offer_click", {
      event_category: "outbound",
      event_label: href
    });
  });

  window.BookLoftAnalytics = {
    openPreferences: renderConsentBanner,
    getConsent: readConsent
  };

  function applyConsent(consent) {
    if (consent === "granted") {
      loadGtagScript();
      window.gtag("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied"
      });
      if (!analyticsConfigured) {
        window.gtag("config", measurementId, {
          anonymize_ip: true
        });
        analyticsConfigured = true;
      }
      return;
    }

    window.gtag("consent", "update", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
    analyticsConfigured = false;
    deleteAnalyticsCookies();
  }

  function loadGtagScript() {
    const scriptId = "bookloft-google-analytics";
    if (document.getElementById(scriptId)) return;
    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
  }

  function renderConsentBanner() {
    const existing = document.querySelector(".cookie-consent");
    if (existing) {
      existing.hidden = false;
      return;
    }

    const banner = document.createElement("section");
    banner.className = "cookie-consent";
    banner.setAttribute("aria-label", "Ustawienia cookies");
    banner.innerHTML = `
      <div>
        <strong>Cookies i analityka</strong>
        <p>Używamy niezbędnych cookies do logowania. Google Analytics włączamy tylko po zgodzie.</p>
      </div>
      <div class="cookie-consent-actions">
        <button class="secondary-action" type="button" data-consent="denied">Tylko niezbędne</button>
        <button class="primary-action" type="button" data-consent="granted">Akceptuję</button>
      </div>
    `;

    banner.addEventListener("click", (event) => {
      const button = event.target.closest ? event.target.closest("[data-consent]") : null;
      if (!button) return;
      const consent = button.dataset.consent === "granted" ? "granted" : "denied";
      writeConsent(consent);
      applyConsent(consent);
      banner.hidden = true;
    });

    document.body.appendChild(banner);
  }

  function ensureSettingsTrigger() {
    if (document.querySelector("[data-cookie-settings].cookie-settings-trigger")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cookie-settings-trigger";
    button.dataset.cookieSettings = "";
    button.textContent = "Cookies";
    button.setAttribute("aria-label", "Ustawienia cookies");
    document.body.appendChild(button);
  }

  function readConsent() {
    try {
      return window.localStorage.getItem(storageKey);
    } catch {
      return "";
    }
  }

  function writeConsent(value) {
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // Local storage can be unavailable in strict privacy modes.
    }
  }

  function deleteAnalyticsCookies() {
    const names = document.cookie
      .split(";")
      .map((cookie) => cookie.split("=")[0].trim())
      .filter((name) => /^_(ga|gid|gat)/.test(name));
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    const hostname = window.location.hostname;
    const rootDomain = hostname.split(".").slice(-2).join(".");
    const domains = ["", hostname, `.${hostname}`, rootDomain, `.${rootDomain}`]
      .filter(Boolean)
      .filter((value, index, list) => list.indexOf(value) === index);

    for (const name of names) {
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax${secure}`;
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}; SameSite=Lax${secure}`;
      }
    }
  }
})();
