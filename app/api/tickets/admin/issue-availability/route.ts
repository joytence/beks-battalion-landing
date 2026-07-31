import { NextResponse } from "next/server";
import {
  isAuthorizedTicketAdminRequest,
  unauthorizedAdminResponse,
} from "@/lib/ticket-admin-auth";
import {
  getAdminIssueAvailabilitySnapshot,
  isTicketAdminConfigured,
  TicketingStoreError,
} from "@/lib/ticketing-store";

export async function GET(request: Request) {
  if (!isTicketAdminConfigured()) {
    return NextResponse.json(
      { message: "TICKET_ADMIN_SECRET is not configured yet." },
      { status: 500 },
    );
  }

  if (!(await isAuthorizedTicketAdminRequest(request))) {
    return unauthorizedAdminResponse();
  }

  try {
    const snapshot = await getAdminIssueAvailabilitySnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof TicketingStoreError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Available seat lookup failed." },
      { status: 500 },
    );
  }
}
