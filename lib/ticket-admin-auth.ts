import { NextResponse, type NextRequest } from "next/server";

const ADMIN_SESSION_COOKIE_NAME = "joy_stage_ticket_admin_session";
const ADMIN_SESSION_DURATION_SECONDS = 60 * 60 * 12;
const ADMIN_SESSION_VERSION = 1;
const ADMIN_SESSION_SUBJECT = "joy-stage-ticket-admin";

function clean(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .trim();
}

function encodeBase64Url(value: Uint8Array) {
  let binary = "";

  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  const padded = `${normalized}${"=".repeat(paddingLength)}`;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function getConfiguredAdminSecret() {
  return clean(process.env.TICKET_ADMIN_SECRET || "");
}

function getSessionSigningSecret() {
  return clean(process.env.TICKET_ADMIN_SESSION_SECRET || process.env.TICKET_SIGNING_SECRET || "");
}

async function signValue(value: string) {
  const signingSecret = getSessionSigningSecret();

  if (!signingSecret) {
    throw new Error(
      "TICKET_ADMIN_SESSION_SECRET or TICKET_SIGNING_SECRET must be configured for admin sessions.",
    );
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));

  return encodeBase64Url(new Uint8Array(signature));
}

function readCookieValue(cookieHeader: string, name: string) {
  for (const cookie of cookieHeader.split(";")) {
    const trimmed = cookie.trim();

    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();

    if (key !== name) {
      continue;
    }

    return trimmed.slice(separatorIndex + 1).trim();
  }

  return "";
}

function getRequestCookieHeader(request: Request | NextRequest) {
  return request.headers.get("cookie") || "";
}

function parseSessionPayload(token: string) {
  const [encodedPayload, providedSignature] = token.split(".");

  if (!encodedPayload || !providedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(encodedPayload)),
    ) as {
      exp?: number;
      iat?: number;
      sub?: string;
      v?: number;
    };

    return {
      encodedPayload,
      payload,
      providedSignature,
    };
  } catch {
    return null;
  }
}

export function getAuthorizedAdminSecret(request: Request | NextRequest) {
  const authorization = request.headers.get("authorization") || "";

  if (authorization.startsWith("Bearer ")) {
    return clean(authorization.slice("Bearer ".length));
  }

  return clean(request.headers.get("x-ticket-admin-secret") || "");
}

export function isTicketAdminConfigured() {
  return Boolean(getConfiguredAdminSecret());
}

export function getTicketAdminSessionCookieName() {
  return ADMIN_SESSION_COOKIE_NAME;
}

export function sanitizeAdminNextPath(value: string) {
  if (!value.startsWith("/")) {
    return "/tickets/admin";
  }

  if (!value.startsWith("/tickets/admin")) {
    return "/tickets/admin";
  }

  if (value.startsWith("/tickets/admin/login")) {
    return "/tickets/admin";
  }

  return value;
}

export function getTicketAdminSessionCookieOptions(url: string) {
  const protocol = (() => {
    try {
      return new URL(url).protocol;
    } catch {
      return "http:";
    }
  })();

  return {
    httpOnly: true,
    maxAge: ADMIN_SESSION_DURATION_SECONDS,
    path: "/",
    sameSite: "strict" as const,
    secure: protocol === "https:",
  };
}

export async function createTicketAdminSessionToken() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    exp: nowSeconds + ADMIN_SESSION_DURATION_SECONDS,
    iat: nowSeconds,
    sub: ADMIN_SESSION_SUBJECT,
    v: ADMIN_SESSION_VERSION,
  };
  const encodedPayload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await signValue(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function isValidTicketAdminSessionToken(token: string) {
  const parsed = parseSessionPayload(token);

  if (!parsed) {
    return false;
  }

  const { encodedPayload, payload, providedSignature } = parsed;

  if (
    payload.sub !== ADMIN_SESSION_SUBJECT ||
    payload.v !== ADMIN_SESSION_VERSION ||
    typeof payload.exp !== "number" ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    return false;
  }

  try {
    const expectedSignature = await signValue(encodedPayload);
    return expectedSignature === providedSignature;
  } catch {
    return false;
  }
}

export async function hasValidTicketAdminSession(request: Request | NextRequest) {
  const cookieHeader = getRequestCookieHeader(request);

  if (!cookieHeader) {
    return false;
  }

  const token = readCookieValue(cookieHeader, ADMIN_SESSION_COOKIE_NAME);

  if (!token) {
    return false;
  }

  return isValidTicketAdminSessionToken(token);
}

export async function isAuthorizedTicketAdminRequest(request: Request | NextRequest) {
  const providedSecret = getAuthorizedAdminSecret(request);

  if (providedSecret && isTicketAdminConfigured() && providedSecret === getConfiguredAdminSecret()) {
    return true;
  }

  return hasValidTicketAdminSession(request);
}

export function unauthorizedAdminResponse() {
  return NextResponse.json({ message: "Admin authorization failed." }, { status: 401 });
}
