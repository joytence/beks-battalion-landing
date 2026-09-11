import { NextResponse } from "next/server";
import { isAuthorizedTicketAdminRequest, unauthorizedAdminResponse } from "@/lib/ticket-admin-auth";
import { normalizePhoneNumber } from "@/lib/ticket-sms";
import {
  isTicketAdminConfigured,
  isTicketingDatabaseConfigured,
  listSmsDistributionLists,
  saveSmsDistributionList,
  TicketingStoreError,
} from "@/lib/ticketing-store";

type DistributionListPayload = { name?: unknown; recipientPhones?: unknown };
const MAX_RECIPIENTS = 250;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function validateRequest(request: Request) {
  if (!isTicketAdminConfigured()) {
    return NextResponse.json({ message: "TICKET_ADMIN_SECRET is not configured yet." }, { status: 500 });
  }
  if (!isTicketingDatabaseConfigured()) {
    return NextResponse.json({ message: "DATABASE_URL is required first." }, { status: 500 });
  }
  if (!(await isAuthorizedTicketAdminRequest(request))) return unauthorizedAdminResponse();
  return null;
}

export async function GET(request: Request) {
  try {
    const failure = await validateRequest(request);
    if (failure) return failure;
    return NextResponse.json({ lists: await listSmsDistributionLists() });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Saved distributions could not be loaded." },
      { status: error instanceof TicketingStoreError ? error.status : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const failure = await validateRequest(request);
    if (failure) return failure;
    const payload = (await request.json().catch(() => ({}))) as DistributionListPayload;
    const name = clean(payload.name);
    const rawPhones = Array.isArray(payload.recipientPhones)
      ? payload.recipientPhones.filter((value): value is string => typeof value === "string")
      : [];
    const recipientPhones = Array.from(new Set(rawPhones.map(normalizePhoneNumber).filter(Boolean)));

    if (!name || name.length > 80) {
      return NextResponse.json({ message: "Give this distribution a name of 80 characters or fewer." }, { status: 400 });
    }
    if (recipientPhones.length < 1 || recipientPhones.length > MAX_RECIPIENTS) {
      return NextResponse.json({ message: `Save between 1 and ${MAX_RECIPIENTS} valid phone numbers in one distribution.` }, { status: 400 });
    }

    const list = await saveSmsDistributionList({ name, recipientPhones });
    return NextResponse.json({
      list,
      message: `Saved ${list.name} with ${list.recipientPhones.length} recipient${list.recipientPhones.length === 1 ? "" : "s"}.`,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "The distribution list could not be saved." },
      { status: error instanceof TicketingStoreError ? error.status : 500 },
    );
  }
}
