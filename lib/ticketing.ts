import crypto from "node:crypto";

const MAX_TICKETS_PER_ORDER = 10;

export const eventDetails = {
  city: "San Diego",
  dateIso: "2026-09-13T17:30:00-07:00",
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
  amountTotal?: number;
  currency?: string;
  eventSlug: string;
  issuedAt?: number;
  issuedOrderId?: string;
  issuedSource?: "admin" | "stripe";
  purchaserEmail?: string;
  purchaserName?: string;
  quantity?: number;
  seatLabel?: string;
  sessionId: string;
  ticketIndex: number;
  tierId: TicketTierId;
  version: 1 | 2;
};

type AdminIssuedReceiptAccessPayload = {
  eventSlug: string;
  kind: "admin_issued_receipt";
  orderId: string;
  version: 1;
};

type StripeReceiptAccessPayload = {
  eventSlug: string;
  kind: "stripe_receipt";
  sessionId: string;
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
  LW11: "LWG16-1",
  LW21: "LWG16-2",
  LW31: "LWG16-3",
  LW41: "LWG16-4",
  LW51: "LWG16-5",
  LW61: "LWG16-6",
  LW71: "LWG16-7",
  LW711: "LWG16-7",
  LW81: "LWG16-8",
  LW91: "LWG16-9",
  LW32: "LWG15-1",
  LW42: "LWG15-2",
  LW52: "LWG15-3",
  LW62: "LWG15-4",
  LW72: "LWG15-5",
  LW82: "LWG15-6",
  LW92: "LWG15-7",
  LW101: "LWG15-8",
  LW53: "LWG14-1",
  LW63: "LWG14-2",
  LW73: "LWG14-3",
  LW83: "LWG14-4",
  LW93: "LWG14-5",
  LW102: "LWG14-6",
  LW111: "LWG14-7",
  LW141: "LWG14-8",
  LW74: "LWG13-1",
  LW84: "LWG13-2",
  LW94: "LWG13-3",
  LW103: "LWG13-4",
  LW112: "LWG13-5",
  LW121: "LWG13-6",
  LW151: "LWG13-7",
  LW161: "LWG13-8",
  LW95: "LWG12-1",
  LW104: "LWG12-2",
  LW113: "LWG12-3",
  LW122: "LWG12-4",
  LW131: "LWG12-5",
  LW162: "LWG12-6",
  LW171: "LWG12-7",
  LW181: "LWG12-8",
  LW114: "LWG11-1",
  LW123: "LWG11-2",
  LW132: "LWG11-3",
  LW142: "LWG11-4",
  LW172: "LWG11-5",
  LW182: "LWG11-6",
  LW191: "LWG11-7",
  LW201: "LWG11-8",
  LW133: "LWV10-1",
  LW143: "LWV10-2",
  LW152: "LWV10-3",
  LW183: "LWV10-4",
  LW192: "LWV10-5",
  LW202: "LWV10-6",
  LW211: "LWV10-7",
  LW221: "LWV10-8",
  LW153: "LWV9-1",
  LW163: "LWV9-2",
  LW193: "LWV9-3",
  LW203: "LWV9-4",
  LW212: "LWV9-5",
  LW222: "LWV9-6",
  LW231: "LWV9-7",
  LW241: "LWV9-8",
  LW173: "LWV8-1",
  LW204: "LWV8-2",
  LW213: "LWV8-3",
  LW223: "LWV8-4",
  LW232: "LWV8-5",
  LW242: "LWV8-6",
  LW251: "LWV8-7",
  LW261: "LWV8-8",
  LW205: "LWV7-1",
  LW214: "LWV7-2",
  LW224: "LWV7-3",
  LW233: "LWV7-4",
  LW243: "LWV7-5",
  LW252: "LWV7-6",
  LW262: "LWV7-7",
  LW271: "LWV7-8",
  LW281: "LWV7-9",
  LW215: "LWV6-1",
  LW225: "LWV6-2",
  LW234: "LWV6-3",
  LW244: "LWV6-4",
  LW253: "LWV6-5",
  LW263: "LWV6-6",
  LW272: "LWV6-7",
  LW282: "LWV6-8",
  LW291: "LWV6-9",
  LW301: "LWV6-10",
  LW235: "LWV5-1",
  LW245: "LWV5-2",
  LW254: "LWV5-3",
  LW264: "LWV5-4",
  LW273: "LWV5-5",
  LW283: "LWV5-6",
  LW292: "LWV5-7",
  LW302: "LWV5-8",
  LW311: "LWV5-9",
  LW321: "LWV5-10",
  LW255: "LWV4-1",
  LW265: "LWV4-2",
  LW274: "LWV4-3",
  LW284: "LWV4-4",
  LW293: "LWV4-5",
  LW303: "LWV4-6",
  LW312: "LWV4-7",
  LW322: "LWV4-8",
  LW331: "LWV4-9",
  LW341: "LWV4-10",
  LW275: "LWV3-1",
  LW285: "LWV3-2",
  LW294: "LWV3-3",
  LW304: "LWV3-4",
  LW313: "LWV3-5",
  LW323: "LWV3-6",
  LW332: "LWV3-7",
  LW342: "LWV3-8",
  LW351: "LWV3-9",
  LW295: "LWV2-1",
  LW305: "LWV2-2",
  LW314: "LWV2-3",
  LW324: "LWV2-4",
  LW333: "LWV2-5",
  LW343: "LWV2-6",
  LW352: "LWV2-7",
  LW361: "LWV2-8",
  LW371: "LWV1-1",
  LW362: "LWV1-2",
  LW353: "LWV1-3",
  LW344: "LWV1-4",
  LW334: "LWV1-5",
  LW325: "LWV1-6",
  LW315: "LWV1-7",
};

const rightWingSeatLabelOverrides: Record<string, string> = {
  RW11: "RWG16-1",
  RW21: "RWG16-2",
  RW32: "RWG16-3",
  RW42: "RWG16-4",
  RW53: "RWG16-5",
  RW63: "RWG16-6",
  RW74: "RWG16-7",
  RW714: "RWG16-7",
  RW84: "RWG16-8",
  RW95: "RWG16-9",
  RW31: "RWG15-1",
  RW41: "RWG15-2",
  RW52: "RWG15-3",
  RW62: "RWG15-4",
  RW73: "RWG15-5",
  RW83: "RWG15-6",
  RW94: "RWG15-7",
  RW104: "RWG15-8",
  RW51: "RWG14-1",
  RW61: "RWG14-2",
  RW72: "RWG14-3",
  RW82: "RWG14-4",
  RW93: "RWG14-5",
  RW103: "RWG14-6",
  RW114: "RWG14-7",
  RW143: "RWG14-8",
  RW71: "RWG13-1",
  RW81: "RWG13-2",
  RW92: "RWG13-3",
  RW102: "RWG13-4",
  RW113: "RWG13-5",
  RW123: "RWG13-6",
  RW153: "RWG13-7",
  RW163: "RWG13-8",
  RW91: "RWG12-1",
  RW101: "RWG12-2",
  RW112: "RWG12-3",
  RW122: "RWG12-4",
  RW133: "RWG12-5",
  RW162: "RWG12-6",
  RW173: "RWG12-7",
  RW183: "RWG12-8",
  RW111: "RWG11-1",
  RW121: "RWG11-2",
  RW132: "RWG11-3",
  RW142: "RWG11-4",
  RW172: "RWG11-5",
  RW182: "RWG11-6",
  RW193: "RWG11-7",
  RW205: "RWG11-8",
  RW131: "RWV10-1",
  RW141: "RWV10-2",
  RW152: "RWV10-3",
  RW181: "RWV10-4",
  RW192: "RWV10-5",
  RW204: "RWV10-6",
  RW215: "RWV10-7",
  RW225: "RWV10-8",
  RW151: "RWV9-1",
  RW161: "RWV9-2",
  RW191: "RWV9-3",
  RW203: "RWV9-4",
  RW214: "RWV9-5",
  RW224: "RWV9-6",
  RW235: "RWV9-7",
  RW245: "RWV9-8",
  RW171: "RWV8-1",
  RW202: "RWV8-2",
  RW213: "RWV8-3",
  RW223: "RWV8-4",
  RW234: "RWV8-5",
  RW244: "RWV8-6",
  RW255: "RWV8-7",
  RW265: "RWV8-8",
  RW201: "RWV7-1",
  RW212: "RWV7-2",
  RW222: "RWV7-3",
  RW233: "RWV7-4",
  RW243: "RWV7-5",
  RW254: "RWV7-6",
  RW264: "RWV7-7",
  RW275: "RWV7-8",
  RW285: "RWV7-9",
  RW211: "RWV6-1",
  RW221: "RWV6-2",
  RW232: "RWV6-3",
  RW242: "RWV6-4",
  RW253: "RWV6-5",
  RW263: "RWV6-6",
  RW274: "RWV6-7",
  RW284: "RWV6-8",
  RW295: "RWV6-9",
  RW305: "RWV6-10",
  RW231: "RWV5-1",
  RW241: "RWV5-2",
  RW252: "RWV5-3",
  RW262: "RWV5-4",
  RW273: "RWV5-5",
  RW283: "RWV5-6",
  RW294: "RWV5-7",
  RW304: "RWV5-8",
  RW315: "RWV5-9",
  RW325: "RWV5-10",
  RW251: "RWV4-1",
  RW261: "RWV4-2",
  RW272: "RWV4-3",
  RW282: "RWV4-4",
  RW293: "RWV4-5",
  RW303: "RWV4-6",
  RW314: "RWV4-7",
  RW324: "RWV4-8",
  RW334: "RWV4-9",
  RW344: "RWV4-10",
  RW271: "RWV3-1",
  RW281: "RWV3-2",
  RW292: "RWV3-3",
  RW302: "RWV3-4",
  RW313: "RWV3-5",
  RW323: "RWV3-6",
  RW333: "RWV3-7",
  RW343: "RWV3-8",
  RW353: "RWV3-9",
  RW291: "RWV2-1",
  RW301: "RWV2-2",
  RW312: "RWV2-3",
  RW322: "RWV2-4",
  RW332: "RWV2-5",
  RW342: "RWV2-6",
  RW352: "RWV2-7",
  RW362: "RWV2-8",
  RW311: "RWV1-1",
  RW321: "RWV1-2",
  RW331: "RWV1-3",
  RW341: "RWV1-4",
  RW351: "RWV1-5",
  RW361: "RWV1-6",
  RW371: "RWV1-7",
};

function getWingDisplayLabel(blockId: string, rowCode: string, seatNumber: number) {
  const wingSeatLabelOverrides: Record<string, Record<string, string>> = {
    LW: leftWingSeatLabelOverrides,
    RW: rightWingSeatLabelOverrides,
  };

  return wingSeatLabelOverrides[blockId]?.[`${rowCode}${seatNumber}`] || "";
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
          const label = getWingDisplayLabel(blueprint.id, compactRowCode, number) || layoutLabel;
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

  if (normalized.length > MAX_TICKETS_PER_ORDER) {
    return {
      error: `You can select up to ${MAX_TICKETS_PER_ORDER} seats per order.`,
      seatLabels: [] as string[],
    };
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

  if (quantity > MAX_TICKETS_PER_ORDER) {
    return {
      error: `You can test up to ${MAX_TICKETS_PER_ORDER} tickets per order.`,
      quantity: 0,
    };
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

export function getTierIdForSeatLabel(seatLabel: string) {
  const normalizedSeatLabel = seatLabel.trim().toUpperCase();

  return ticketTiers.find((tier) => isValidTierSeatLabel(tier.id, normalizedSeatLabel))?.id || null;
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

export function createAdminIssuedReceiptAccessToken(orderId: string) {
  const body = Buffer.from(
    JSON.stringify({
      eventSlug: eventDetails.slug,
      kind: "admin_issued_receipt",
      orderId,
      version: 1,
    } satisfies AdminIssuedReceiptAccessPayload),
  ).toString("base64url");
  const signature = signPayload(body);
  return `${body}.${signature}`;
}

export function parseAdminIssuedReceiptAccessToken(token: string) {
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
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as AdminIssuedReceiptAccessPayload;

    if (
      parsed.version !== 1 ||
      parsed.kind !== "admin_issued_receipt" ||
      parsed.eventSlug !== eventDetails.slug ||
      !parsed.orderId?.trim()
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getAdminIssuedReceiptPath(orderId: string) {
  const accessToken = createAdminIssuedReceiptAccessToken(orderId);
  return `/tickets/admin/issued?access=${encodeURIComponent(accessToken)}`;
}

export function getAdminIssuedReceiptUrl(orderId: string) {
  return `${getSiteUrl()}${getAdminIssuedReceiptPath(orderId)}`;
}

export function createStripeReceiptAccessToken(sessionId: string) {
  const body = Buffer.from(
    JSON.stringify({
      eventSlug: eventDetails.slug,
      kind: "stripe_receipt",
      sessionId,
      version: 1,
    } satisfies StripeReceiptAccessPayload),
  ).toString("base64url");
  const signature = signPayload(body);
  return `${body}.${signature}`;
}

export function parseStripeReceiptAccessToken(token: string) {
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
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as StripeReceiptAccessPayload;

    if (
      parsed.version !== 1 ||
      parsed.kind !== "stripe_receipt" ||
      parsed.eventSlug !== eventDetails.slug ||
      !parsed.sessionId?.trim()
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getStripeReceiptPath(sessionId: string) {
  const accessToken = createStripeReceiptAccessToken(sessionId);
  return `/tickets/confirmation?access=${encodeURIComponent(accessToken)}`;
}

export function getStripeReceiptUrl(sessionId: string) {
  return `${getSiteUrl()}${getStripeReceiptPath(sessionId)}`;
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
      (parsed.version !== 1 && parsed.version !== 2) ||
      parsed.eventSlug !== eventDetails.slug ||
      (parsed.issuedSource && parsed.issuedSource !== "admin" && parsed.issuedSource !== "stripe") ||
      !getTicketTierById(parsed.tierId) ||
      parsed.ticketIndex < 1 ||
      (typeof parsed.quantity === "number" && parsed.ticketIndex > parsed.quantity)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
