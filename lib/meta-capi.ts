import crypto from "node:crypto";

type MetaEventCustomData = Record<string, string | number | boolean | null | undefined>;

export type MetaCapiEventInput = {
  clientIpAddress?: string;
  clientUserAgent?: string;
  customData?: MetaEventCustomData;
  email?: string;
  eventId?: string;
  eventName: string;
  eventSourceUrl: string;
  fbc?: string;
  fbp?: string;
  phone?: string;
  testEventCode?: string;
};

export type MetaCapiEventResult =
  | { ok: true; skipped: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; skipped: false; reason: string };

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizePhone(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/[^\d+]/g, "");
}

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return "";
  }

  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = cookie.slice(0, separatorIndex);
    if (key === name) {
      return decodeURIComponent(cookie.slice(separatorIndex + 1));
    }
  }

  return "";
}

function toCustomData(customData?: MetaEventCustomData) {
  if (!customData) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(customData).filter(([, value]) => value !== undefined && value !== null),
  );
}

export function getMetaTrackingContext(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const clientIpAddress = forwardedFor.split(",")[0]?.trim() || "";
  const clientUserAgent = request.headers.get("user-agent") || "";
  const cookieHeader = request.headers.get("cookie");

  return {
    clientIpAddress,
    clientUserAgent,
    fbc: getCookieValue(cookieHeader, "_fbc"),
    fbp: getCookieValue(cookieHeader, "_fbp"),
  };
}

export async function sendMetaCapiEvent(
  input: MetaCapiEventInput,
): Promise<MetaCapiEventResult> {
  const pixelId = process.env.META_PIXEL_ID || "2036904920238359";
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    return {
      ok: true,
      skipped: true,
      reason: "META_CAPI_ACCESS_TOKEN is not configured.",
    };
  }

  const body: Record<string, unknown> = {
    data: [
      {
        action_source: "website",
        custom_data: toCustomData(input.customData),
        event_id: input.eventId || crypto.randomUUID(),
        event_name: input.eventName,
        event_source_url: input.eventSourceUrl,
        event_time: Math.floor(Date.now() / 1000),
        user_data: {
          ...(input.clientIpAddress ? { client_ip_address: input.clientIpAddress } : {}),
          ...(input.clientUserAgent ? { client_user_agent: input.clientUserAgent } : {}),
          ...(input.email ? { em: [sha256(input.email.trim().toLowerCase())] } : {}),
          ...(input.fbc ? { fbc: input.fbc } : {}),
          ...(input.fbp ? { fbp: input.fbp } : {}),
          ...(input.phone ? { ph: [sha256(normalizePhone(input.phone))] } : {}),
        },
      },
    ],
  };

  if (input.testEventCode) {
    body.test_event_code = input.testEventCode;
  }

  const response = await fetch(
    `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
    {
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    const error = await response.text();
    return {
      ok: false,
      reason: `Meta CAPI request failed: ${error}`,
      skipped: false,
    };
  }

  return {
    ok: true,
    skipped: false,
  };
}
