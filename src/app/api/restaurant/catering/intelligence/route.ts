import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import {
  analyzeAndValidateMenu,
  calculateTrueEventCost,
  buildVersionedQuotation,
} from "@/modules/catering/intelligenceEngine";
import {
  SMART_MENU_TEMPLATES,
  LIVE_COUNTERS_MASTER,
  MENU_ITEMS_MASTER,
} from "@/modules/catering/templatesData";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventType = searchParams.get("eventType") || "ALL";
    const mealType = searchParams.get("mealType") || "ALL";

    let templates = SMART_MENU_TEMPLATES;
    if (eventType !== "ALL") {
      templates = templates.filter(
        (t) =>
          t.applicableEventTypes.includes(eventType) ||
          t.applicableEventTypes.includes("CUSTOM")
      );
    }

    return NextResponse.json({
      templates,
      liveCounters: LIVE_COUNTERS_MASTER,
      masterItems: Object.values(MENU_ITEMS_MASTER),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch catering intelligence" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      selectedItemIds = [],
      selectedAddonIds = [],
      guestCount = 100,
      eventDetails,
      basePricePerPax = 850,
      quotationNumber = "QUO-2026-001",
      version = 1,
      discountAmount = 0,
      taxPercent = 5,
      changeSummary,
    } = body;

    if (action === "VALIDATE_MENU") {
      const report = analyzeAndValidateMenu(
        selectedItemIds,
        guestCount,
        eventDetails
      );
      return NextResponse.json({ report });
    }

    if (action === "CALCULATE_COSTING") {
      const costing = calculateTrueEventCost(
        selectedItemIds,
        selectedAddonIds,
        guestCount,
        basePricePerPax
      );
      return NextResponse.json({ costing });
    }

    if (action === "GENERATE_QUOTATION") {
      const quotation = buildVersionedQuotation(
        quotationNumber,
        version,
        guestCount,
        selectedItemIds,
        selectedAddonIds,
        basePricePerPax,
        discountAmount,
        taxPercent,
        changeSummary
      );
      return NextResponse.json({ quotation });
    }

    return NextResponse.json(
      { error: "Invalid action requested" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to process intelligence request" },
      { status: 500 }
    );
  }
}
