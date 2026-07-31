"use client";

function normalizeAdminSecretValue(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .trim();
}

export function buildAdminRequestHeaders(
  adminSecretOrHeaders: string | Record<string, string> = {},
  headers: Record<string, string> = {},
) {
  if (typeof adminSecretOrHeaders === "string") {
    const normalizedSecret = normalizeAdminSecretValue(adminSecretOrHeaders);

    return {
      ...(normalizedSecret
        ? {
            authorization: `Bearer ${normalizedSecret}`,
            "x-ticket-admin-secret": normalizedSecret,
          }
        : {}),
      ...headers,
    };
  }

  return {
    ...adminSecretOrHeaders,
    ...headers,
  };
}
