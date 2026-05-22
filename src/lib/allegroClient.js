export class AllegroClient {
  constructor(config) {
    this.config = config;
  }

  isConfigured() {
    return Boolean(this.config.allegroClientId && this.config.allegroClientSecret && this.config.allegroRedirectUri);
  }

  createAuthorizationUrl(state) {
    this.assertConfigured();
    const url = new URL(this.config.allegroAuthUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.allegroClientId);
    url.searchParams.set("redirect_uri", this.config.allegroRedirectUri);
    url.searchParams.set("state", state);
    if (this.config.allegroScope) {
      url.searchParams.set("scope", this.config.allegroScope);
    }
    return url.toString();
  }

  async exchangeCode(code) {
    return this.requestToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.allegroRedirectUri
    });
  }

  async refreshToken(refreshToken) {
    return this.requestToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      redirect_uri: this.config.allegroRedirectUri
    });
  }

  async requestToken(parameters) {
    this.assertConfigured();
    const body = new URLSearchParams(parameters);
    const response = await this.fetchWithTimeout(this.config.allegroTokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.allegroClientId}:${this.config.allegroClientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      body
    });
    if (!response.ok) {
      throw new Error(`Allegro OAuth HTTP ${response.status}`);
    }
    return response.json();
  }

  async apiGet(path, params, accessToken) {
    this.assertConfigured();
    if (!accessToken) throw new Error("Brak aktywnego tokena Allegro");
    const url = new URL(path.startsWith("http") ? path : `${this.config.allegroApiUrl}${path}`);
    for (const [key, value] of Object.entries(params || {})) {
      if (Array.isArray(value)) {
        value.forEach((entry) => url.searchParams.append(key, entry));
      } else if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    }

    const response = await this.fetchWithTimeout(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.allegro.public.v1+json",
        "Accept-Language": "pl-PL"
      }
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      const error = new Error(`Allegro API HTTP ${response.status} dla ${path}`);
      error.status = response.status;
      error.details = message.slice(0, 500);
      throw error;
    }

    return response.json();
  }

  async getActiveOffers(accessToken) {
    const offers = [];
    const limit = Math.max(1, Math.min(Number(this.config.allegroOfferLimit) || 1000, 1000));
    for (let offset = 0; offset < 10_000_000; offset += limit) {
      const data = await this.apiGet("/sale/offers", {
        "publication.status": "ACTIVE",
        "publication.marketplace": this.config.allegroMarketplaceId,
        "sellingMode.format": this.config.allegroSellingFormats,
        limit,
        offset
      }, accessToken);
      const page = Array.isArray(data.offers) ? data.offers : [];
      offers.push(...page);
      if (page.length < limit || offers.length >= Number(data.totalCount || 0)) break;
    }
    return offers;
  }

  async getOfferDetails(offerId, accessToken) {
    return this.apiGet(`/sale/product-offers/${encodeURIComponent(offerId)}`, {}, accessToken);
  }

  async getCategory(categoryId, accessToken) {
    return this.apiGet(`/sale/categories/${encodeURIComponent(categoryId)}`, {}, accessToken);
  }

  async fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  assertConfigured() {
    if (!this.isConfigured()) {
      throw new Error("ALLEGRO_CLIENT_ID, ALLEGRO_CLIENT_SECRET i ALLEGRO_REDIRECT_URI musza byc skonfigurowane");
    }
  }
}
