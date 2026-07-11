import crypto from "node:crypto";

export const eventDetails = {
  city: "San Diego",
  dateIso: "2026-09-13T19:00:00-07:00",
  dateLabel: "Sep 13, 2026",
  name: "Beks Battalion",
  slug: "beks-battalion",
  venue: "Otay Ranch High School, Chula Vista",
  venueAddress: {
    city: "Chula Vista",
    country: "US",
    line1: "1250 Olympic Parkway",
    postalCode: "91913",
    state: "CA",
  },
} as const;

export const ticketTiers = [
  {
    description: "Reserved seating closest to the stage across the three center front sections.",
    id: "svip",
    includes: ["Section A front rows", "Section B front rows", "Section C front rows"],
    name: "SVIP",
    priceCents: 15000,
    sectionLabel: "Front rows in Sections A, B, and C",
    theme: "gold",
  },
  {
    description:
      "Reserved seating in the middle rows of Sections A, B, and C plus premium VIP seating in both side wings.",
    id: "vip",
    includes: [
      "Left Wing VIP rows",
      "Section A VIP rows",
      "Section B VIP rows",
      "Section C VIP rows",
      "Right Wing VIP rows",
    ],
    name: "VIP",
    priceCents: 12500,
    sectionLabel: "Middle center rows in Sections A, B, and C with VIP seating in the Left Wing and Right Wing",
    theme: "orange",
  },
  {
    description:
      "Reserved seating in the rear rows of Sections A, B, and C plus General Admission seating in both side wings.",
    id: "general",
    includes: [
      "Left Wing GA rows",
      "Section A GA rows",
      "Section B GA rows",
      "Section C GA rows",
      "Right Wing GA rows",
    ],
    name: "General Admission",
    priceCents: 10000,
    sectionLabel: "Rear center rows in Sections A, B, and C with General Admission seating in the Left Wing and Right Wing",
    theme: "green",
  },
] as const;

export type TicketTier = (typeof ticketTiers)[number];
export type TicketTierId = TicketTier["id"];
export type TicketSeatStatus = "available" | "held";
export type TicketSeat = {
  label: string;
  layoutLabel: string;
  number: number;
  row: string;
  status: TicketSeatStatus;
  tierId: TicketTierId;
};
export type TicketSeatRow = {
  gapAfter?: boolean;
  offset: number;
  row: string;
  seats: TicketSeat[];
};
export type TicketSeatBlockVariant = "center" | "wing-left" | "wing-right";
export type TicketSeatBlock = {
  blockLabel: string;
  capacity: number;
  id: string;
  rows: TicketSeatRow[];
  tierId: TicketTierId;
  variant: TicketSeatBlockVariant;
};
export type TicketSeatChart = {
  blocks: TicketSeatBlock[];
  stageLabel: string;
  totalCapacity: number;
};

export type TicketCheckoutFlow = "reserved_seat" | "tier_test";
type TicketSeatChartOptions = {
  blockedSeatLabels?: Iterable<string>;
};

export type SignedTicketPayload = {
  amountTotal: number;
  currency: string;
  eventSlug: string;
  issuedAt: number;
  purchaserEmail: string;
  purchaserName: string;
  quantity: number;
  seatLabel: string;
  sessionId: string;
  ticketIndex: number;
  tierId: TicketTierId;
  version: 1;
};

type SeatBlockBlueprint = {
  blockedLabels: string[];
  blockLabel: string;
  capacity: number;
  id: string;
  rowConfigs: readonly {
    gapAfter?: boolean;
    offset: number;
    row: string;
    seatCount: number;
    tiers?: readonly TicketTierId[];
    tierId?: TicketTierId;
  }[];
  tierId: TicketTierId;
  variant: TicketSeatBlockVariant;
};

function resolveRowTierId(
  blueprint: SeatBlockBlueprint,
  rowConfig: SeatBlockBlueprint["rowConfigs"][number],
) {
  return rowConfig.tiers?.[0] || rowConfig.tierId || blueprint.tierId;
}

function createCenterSectionRows() {
  return [
    ...Array.from({ length: 7 }).map((_, index) => ({
      offset: 0,
      row: `GA${index + 1}`,
      seatCount: 11,
      tierId: "general" as const,
    })),
    ...Array.from({ length: 5 }).map((_, index) => ({
      offset: 0,
      row: `VIP${index + 1}`,
      seatCount: 11,
      tierId: "vip" as const,
    })),
    ...Array.from({ length: 10 }).map((_, index) => ({
      offset: 0,
      row: `SVIP${index + 1}`,
      seatCount: 11,
      tierId: "svip" as const,
    })),
  ];
}

const wingRowBlueprints = [
  [190, "G"],
  [172, "G"],
  [152, "GG"],
  [134, "GG"],
  [114, "GGG"],
  [90, "GGG"],
  [67, "GGGG"],
  [42, "GGGG"],
  [21, "GGGGG"],
  [44, "GGGG"],
  [68, "GGGG"],
  [92, "GGG"],
  [117, "GGV"],
  [0, "GGV"],
  [24, "GVV"],
  [1, "GGV"],
  [24, "GGV"],
  [2, "GGV"],
  [26, "GVV"],
  [3, "GVVVV"],
  [26, "VVVVV"],
  [3, "VVVVV"],
  [26, "VVVVV"],
  [4, "VVVVV"],
  [28, "VVVVV"],
  [5, "VVVVV"],
  [26, "VVVVV"],
  [4, "VVVVV"],
  [27, "VVVVV"],
  [4, "VVVVV"],
  [28, "VVVVV"],
  [6, "VVVVV"],
  [28, "VVVV"],
  [6, "VVVV"],
  [28, "VVV"],
  [48, "VV"],
  [73, "V"],
] as const;

function createWingRows({ mirror = false } = {}) {
  return wingRowBlueprints.map(([offset, pattern], index) => ({
    offset: Math.round(offset * 1.35),
    row: `W${String(index + 1).padStart(2, "0")}`,
    seatCount: pattern.length,
    tiers: (mirror ? pattern.split("").reverse() : pattern.split("")).map((tier) =>
      tier === "G" ? "general" : "vip",
    ) as TicketTierId[],
  }));
}

const leftWingSeatLabelOverrides: Record<string, string> = {
  LW11: "LW161",
  LW21: "LW162",
  LW31: "LW163",
  LW41: "LW164",
  LW51: "LW165",
  LW61: "LW166",
  LW71: "LW167",
  LW711: "LW167",
  LW81: "LW168",
  LW91: "LW169",
  LW32: "LW151",
  LW42: "LW152",
  LW52: "LW153",
  LW62: "LW154",
  LW72: "LW155",
  LW82: "LW156",
  LW92: "LW157",
  LW101: "LW158",
  LW53: "LW141",
  LW63: "LW142",
  LW73: "LW143",
  LW83: "LW144",
  LW93: "LW145",
  LW102: "LW146",
  LW111: "LW147",
  LW141: "LW148",
  LW74: "LW131",
  LW84: "LW132",
  LW94: "LW133",
  LW103: "LW134",
  LW112: "LW135",
  LW121: "LW136",
  LW151: "LW137",
  LW161: "LW138",
  LW95: "LW121",
  LW104: "LW122",
  LW113: "LW123",
  LW122: "LW124",
  LW131: "LW125",
  LW162: "LW126",
  LW171: "LW127",
  LW181: "LW128",
  LW114: "LW111",
  LW123: "LW112",
  LW132: "LW113",
  LW142: "LW114",
  LW172: "LW115",
  LW182: "LW116",
  LW191: "LW117",
  LW201: "LW118",
  LW133: "LW101",
  LW143: "LW102",
  LW152: "LW103",
  LW183: "LW104",
  LW192: "LW105",
  LW202: "LW106",
  LW211: "LW107",
  LW221: "LW108",
  LW153: "LW91",
  LW163: "LW92",
  LW193: "LW93",
  LW203: "LW94",
  LW212: "LW95",
  LW222: "LW96",
  LW231: "LW97",
  LW241: "LW98",
  LW173: "LW81",
  LW204: "LW82",
  LW213: "LW83",
  LW223: "LW84",
  LW232: "LW85",
  LW242: "LW86",
  LW251: "LW87",
  LW261: "LW88",
  LW205: "LW71",
  LW214: "LW72",
  LW224: "LW73",
  LW233: "LW74",
  LW243: "LW75",
  LW252: "LW76",
  LW262: "LW77",
  LW271: "LW78",
  LW281: "LW79",
  LW215: "LW61",
  LW225: "LW62",
  LW234: "LW63",
  LW244: "LW64",
  LW253: "LW65",
  LW263: "LW66",
  LW272: "LW67",
  LW282: "LW68",
  LW291: "LW69",
  LW301: "LW610",
  LW235: "LW51",
  LW245: "LW52",
  LW254: "LW53",
  LW264: "LW54",
  LW273: "LW55",
  LW283: "LW56",
  LW292: "LW57",
  LW302: "LW58",
  LW311: "LW59",
  LW321: "LW510",
  LW255: "LW41",
  LW265: "LW42",
  LW274: "LW43",
  LW284: "LW44",
  LW293: "LW45",
  LW303: "LW46",
  LW312: "LW47",
  LW322: "LW48",
  LW331: "LW49",
  LW341: "LW410",
  LW275: "LW31",
  LW285: "LW32",
  LW294: "LW33",
  LW304: "LW34",
  LW313: "LW35",
  LW323: "LW36",
  LW332: "LW37",
  LW342: "LW38",
  LW351: "LW39",
  LW295: "LW21",
  LW305: "LW22",
  LW314: "LW23",
  LW324: "LW24",
  LW333: "LW25",
  LW343: "LW26",
  LW352: "LW27",
  LW361: "LW28",
  LW371: "LW11",
  LW362: "LW12",
  LW353: "LW13",
  LW344: "LW14",
  LW334: "LW15",
  LW325: "LW16",
  LW315: "LW17",
};

function getLeftWingDisplayLabel(blockId: string, rowCode: string, seatNumber: number) {
  if (blockId !== "LW") {
    return "";
  }

  return leftWingSeatLabelOverrides[`${rowCode}${seatNumber}`] || "";
}

const seatBlockBlueprints: readonly SeatBlockBlueprint[] = [
  {
    blockedLabels: [],
    blockLabel: "LEFT WING",
    capacity: 136,
    id: "LW",
    rowConfigs: createWingRows(),
    tierId: "general",
    variant: "wing-left",
  },
  {
    blockedLabels: [],
    blockLabel: "Section A",
    capacity: 242,
    id: "A",
    rowConfigs: createCenterSectionRows(),
    tierId: "svip",
    variant: "center",
  },
  {
    blockedLabels: [],
    blockLabel: "Section B",
    capacity: 242,
    id: "B",
    rowConfigs: createCenterSectionRows(),
    tierId: "svip",
    variant: "center",
  },
  {
    blockedLabels: [],
    blockLabel: "Section C",
    capacity: 242,
    id: "C",
    rowConfigs: createCenterSectionRows(),
    tierId: "svip",
    variant: "center",
  },
  {
    blockedLabels: [],
    blockLabel: "RIGHT WING",
    capacity: 136,
    id: "RW",
    rowConfigs: createWingRows({ mirror: true }),
    tierId: "general",
    variant: "wing-right",
  },
] as const;

export function formatCurrency(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    currency: currency.toUpperCase(),
    style: "currency",
  }).format(cents / 100);
}

export function formatEventDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "long",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
    weekday: "long",
    year: "numeric",
  }).format(new Date(isoDate));
}

export function getRequestOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (host?.includes("localhost") || host?.includes("127.0.0.1") ? "http" : "https");

  return host ? `${proto}://${host}` : "http://127.0.0.1:3001";
}

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.joystageproductions.com").replace(
    /\/+$/,
    "",
  );
}

export function getTicketTierById(tierId: string) {
  return ticketTiers.find((tier) => tier.id === tierId) || null;
}

function buildSeatBlock(
  blueprint: SeatBlockBlueprint,
  blockedSeatLabels: ReadonlySet<string>,
): TicketSeatBlock {
  const tierRowCounts = blueprint.rowConfigs.reduce<Record<TicketTierId, number>>(
    (counts, rowConfig) => {
      const tierId = resolveRowTierId(blueprint, rowConfig);
      counts[tierId] += 1;
      return counts;
    },
    {
      general: 0,
      svip: 0,
      vip: 0,
    },
  );
  const tierRowOrder: Record<TicketTierId, number> = {
    general: 0,
    svip: 0,
    vip: 0,
  };

  return {
    blockLabel: blueprint.blockLabel,
    capacity: blueprint.capacity,
    id: blueprint.id,
    rows: blueprint.rowConfigs.map((rowConfig) => {
      const rowTierId = resolveRowTierId(blueprint, rowConfig);
      tierRowOrder[rowTierId] += 1;

      const compactRowCode =
        blueprint.variant === "center"
          ? `${rowTierId === "svip" ? "S" : rowTierId === "vip" ? "V" : "G"}${blueprint.id}${
              tierRowCounts[rowTierId] - tierRowOrder[rowTierId] + 1
            }`
          : `${blueprint.id}${String(Number(rowConfig.row.replace(/^\D+/, "")))}`;

      return {
        gapAfter: rowConfig.gapAfter,
        offset: rowConfig.offset,
        row: compactRowCode,
        seats: Array.from({ length: rowConfig.tiers?.length || rowConfig.seatCount }).map((_, index) => {
          const number = index + 1;
          const layoutLabel = `${compactRowCode}-${number}`;
          const label = getLeftWingDisplayLabel(blueprint.id, compactRowCode, number) || layoutLabel;
          const tierId = rowConfig.tiers?.[index] || rowConfig.tierId || blueprint.tierId;

          return {
            label,
            layoutLabel,
            number,
            row: compactRowCode,
            status:
              blueprint.blockedLabels.includes(label) ||
              blueprint.blockedLabels.includes(layoutLabel) ||
              blockedSeatLabels.has(label) ||
              blockedSeatLabels.has(layoutLabel)
                ? "held"
                : "available",
            tierId,
          };
        }),
      };
    }),
    tierId: blueprint.tierId,
    variant: blueprint.variant,
  };
}

export function getTicketSeatChart(options?: TicketSeatChartOptions): TicketSeatChart {
  const blockedSeatLabels = new Set(
    Array.from(options?.blockedSeatLabels || [], (seatLabel) => seatLabel.trim().toUpperCase()),
  );
  const blocks = seatBlockBlueprints.map((blueprint) => buildSeatBlock(blueprint, blockedSeatLabels));

  return {
    blocks,
    stageLabel: "Stage",
    totalCapacity: blocks.reduce((total, block) => total + block.capacity, 0),
  };
}

export function getSelectableSeatBlocks(tierId: TicketTierId, options?: TicketSeatChartOptions) {
  return getTicketSeatChart(options)
    .blocks.map((block) => ({
      ...block,
      rows: block.rows
        .map((row) => ({
          ...row,
          seats: row.seats.filter((seat) => seat.tierId === tierId),
        }))
        .filter((row) => row.seats.length > 0),
    }))
    .filter((block) => block.rows.length > 0);
}

export function createTicketCode(sessionId: string, ticketIndex: number) {
  const order = sessionId.replace(/^cs_(test|live)_/, "").slice(-8).toUpperCase();
  return `BB-${order}-${String(ticketIndex).padStart(2, "0")}`;
}

export function parseSeatLabels(value: string) {
  if (!value) {
    return [];
  }

  return value
    .split("|")
    .map((seat) => seat.trim().toUpperCase())
    .filter(Boolean);
}

export function validateRequestedSeatSelection(
  tierId: TicketTierId,
  seatLabels: string[],
  options?: TicketSeatChartOptions,
) {
  const normalized = Array.from(
    new Set(
      seatLabels
        .map((seat) => seat.trim().toUpperCase())
        .filter(Boolean),
    ),
  );

  if (normalized.length < 1) {
    return { error: "Please select at least one seat before continuing.", seatLabels: [] as string[] };
  }

  if (normalized.length > 10) {
    return { error: "You can select up to 10 seats per order.", seatLabels: [] as string[] };
  }

  const availableLabels = new Set(
    getSelectableSeatBlocks(tierId, options).flatMap((block) =>
      block.rows.flatMap((row) =>
        row.seats.filter((seat) => seat.status === "available").map((seat) => seat.label),
      ),
    ),
  );
  const invalid = normalized.find((seat) => !availableLabels.has(seat));

  if (invalid) {
    return {
      error: `Seat ${invalid} is not available in this pricing zone.`,
      seatLabels: [] as string[],
    };
  }

  return { error: "", seatLabels: normalized };
}

export function validateRequestedTicketQuantity(quantityValue: unknown) {
  const quantity =
    typeof quantityValue === "number"
      ? quantityValue
      : typeof quantityValue === "string"
        ? Number(quantityValue)
        : Number.NaN;

  if (!Number.isInteger(quantity) || quantity < 1) {
    return { error: "Please choose at least 1 ticket.", quantity: 0 };
  }

  if (quantity > 10) {
    return { error: "You can test up to 10 tickets per order.", quantity: 0 };
  }

  return { error: "", quantity };
}

export function getCheckoutFlow(value: string | null | undefined): TicketCheckoutFlow {
  return value === "tier_test" ? "tier_test" : "reserved_seat";
}

export function getTicketAssignmentLabel(tierName: string, seatLabel: string, flow: TicketCheckoutFlow) {
  return flow === "tier_test" ? `${tierName} Admission` : seatLabel;
}

export function getTicketAssignmentFieldLabel(flow: TicketCheckoutFlow) {
  return flow === "tier_test" ? "Admission" : "Seat";
}

export function isValidTierSeatLabel(tierId: TicketTierId, seatLabel: string) {
  const normalizedSeatLabel = seatLabel.trim().toUpperCase();

  return getSelectableSeatBlocks(tierId).some((block) =>
    block.rows.some((row) => row.seats.some((seat) => seat.label === normalizedSeatLabel)),
  );
}

function getSigningSecret() {
  const explicitSecret = process.env.TICKET_SIGNING_SECRET?.trim();

  if (explicitSecret) {
    return explicitSecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return "dev-only-ticket-signing-secret";
  }

  throw new Error("TICKET_SIGNING_SECRET is required in production.");
}

function signPayload(payload: string) {
  return crypto.createHmac("sha256", getSigningSecret()).update(payload).digest("base64url");
}

export function createSignedTicketToken(payload: SignedTicketPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(body);
  return `${body}.${signature}`;
}

export function parseSignedTicketToken(token: string) {
  const [body, signature] = token.split(".");

  if (!body || !signature) {
    return null;
  }

  const expected = signPayload(body);
  const signatureBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);

  if (
    signatureBytes.length !== expectedBytes.length ||
    !crypto.timingSafeEqual(signatureBytes, expectedBytes)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedTicketPayload;

    if (
      parsed.version !== 1 ||
      parsed.eventSlug !== eventDetails.slug ||
      !getTicketTierById(parsed.tierId) ||
      parsed.ticketIndex < 1 ||
      parsed.ticketIndex > parsed.quantity ||
      !parsed.seatLabel
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
