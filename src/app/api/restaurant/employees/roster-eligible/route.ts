import { NextRequest, NextResponse } from "next/server";
import { getWorkforceActorContext } from "@/modules/workforce/authHelper";
import {
  getRosterEligibleEmployees,
  WorkforceError,
} from "@/modules/workforce/service";

export async function GET(req: NextRequest) {
  try {
    const outletId = req.nextUrl.searchParams.get("outletId") || undefined;
    const dateParam = req.nextUrl.searchParams.get("date") || undefined;
    const asOfDate = dateParam ? new Date(dateParam) : undefined;
    const auth = await getWorkforceActorContext({
      allowRosterAccess: true,
      outletId,
    });

    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const employees = await getRosterEligibleEmployees(auth.ctx, outletId, asOfDate);
    return NextResponse.json({ employees });
  } catch (error) {
    if (error instanceof WorkforceError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      );
    }
    console.error("Roster Eligible Employees Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
