import crypto from "node:crypto";
import { appPath } from "../config.js";

const COOKIE_NAME = "bookloft_session";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function fromBase64url(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqualText(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

export function isValidLogin({ username, password }, config) {
  if (!config.adminUser || !config.adminPassword) return false;
  return safeEqualText(username || "", config.adminUser) && safeEqualText(password || "", config.adminPassword);
}

export function createSessionCookie(config) {
  const payload = base64url(
    JSON.stringify({
      u: config.adminUser,
      iat: Date.now(),
      exp: Date.now() + config.sessionMaxAgeMs
    })
  );
  const token = `${payload}.${sign(payload, config.sessionSecret)}`;
  const secure = config.cookieSecure ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=${config.basePath}; Max-Age=${Math.floor(
    config.sessionMaxAgeMs / 1000
  )}${secure}`;
}

export function clearSessionCookie(config) {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=${config.basePath}; Max-Age=0`;
}

export function getSession(req, config) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[COOKIE_NAME];
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!signature || !safeEqualText(signature, sign(payload, config.sessionSecret))) return null;

  try {
    const session = JSON.parse(fromBase64url(payload));
    if (session.u !== config.adminUser || Number(session.exp) < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function requireAuth(config) {
  return (req, res, next) => {
    const session = getSession(req, config);
    if (!session) {
      const target = encodeURIComponent(req.originalUrl || config.basePath);
      res.redirect(appPath(config.basePath, `/login?next=${target}`));
      return;
    }
    res.locals.session = session;
    next();
  };
}
