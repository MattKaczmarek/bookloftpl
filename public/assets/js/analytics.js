(function () {
  const measurementId = String(window.BOOKLOFT_ANALYTICS_ID || "").trim();
  const storageKey = "bookloft_analytics_consent";

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
    enableAnalytics();
  } else if (storedConsent !== "denied") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", renderConsentBanner, { once: true });
    } else {
      renderConsentBanner();
    }
  }

  document.addEventListener("click", (event) => {
    const settingsButton = event.target.closest ? event.target.closest("[data-cookie-settings]") : null;
    if (settingsButton) {
      writeConsent("");
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
    openPreferences: renderConsentBanner
  };

  function enableAnalytics() {
    loadGtagScript();
    window.gtag("consent", "update", {
      analytics_storage: "granted"
    });
    window.gtag("config", measurementId, {
      anonymize_ip: true
    });
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
        <p>Uzywamy niezbednych cookies do logowania. Google Analytics wlaczamy tylko po zgodzie.</p>
      </div>
      <div class="cookie-consent-actions">
        <button class="secondary-action" type="button" data-consent="denied">Tylko niezbedne</button>
        <button class="primary-action" type="button" data-consent="granted">Akceptuje</button>
      </div>
    `;

    banner.addEventListener("click", (event) => {
      const button = event.target.closest ? event.target.closest("[data-consent]") : null;
      if (!button) return;
      const consent = button.dataset.consent === "granted" ? "granted" : "denied";
      writeConsent(consent);
      if (consent === "granted") enableAnalytics();
      banner.hidden = true;
    });

    document.body.appendChild(banner);
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
})();
