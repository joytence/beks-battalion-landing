"use client";

function normalizeAdminSecretValue(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .trim();
}

export function buildAdminRequestHeaders(
  adminSecret: string,
  headers: Record<string, string> = {},
) {
  const normalizedSecret = normalizeAdminSecretValue(adminSecret);

  return {
    authorization: `Bearer ${normalizedSecret}`,
    "x-ticket-admin-secret": normalizedSecret,
    ...headers,
  };
}
