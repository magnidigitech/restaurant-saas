import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { prisma } from "@/core/database/client";

const STANDARD_DEPARTMENTS = [
  { name: "Kitchen & Culinary (BOH)", code: "KITCHEN", description: "Food preparation, cooking lines, inventory handling & dishwashing" },
  { name: "Front of House (FOH)", code: "FOH", description: "Dining room service, table hosting, order taking & guest experience" },
  { name: "Bar & Beverage", code: "BAR", description: "Cocktail crafting, wine cellar, draft beer & barista service" },
  { name: "Management & Operations", code: "MGMT", description: "Store supervision, shifts planning, cash audits & store operations" },
  { name: "Billing & Delivery", code: "BILLING", description: "Cashier counters, POS settlement & takeout/delivery dispatch" },
];

const STANDARD_DESIGNATIONS = [
  { name: "Executive Chef", code: "EXEC-CHEF", description: "Kitchen leadership, menu formulation & plate costing" },
  { name: "Sous Chef", code: "SOUS-CHEF", description: "Station supervision, prep checklists & line execution" },
  { name: "Line Cook", code: "LINE-COOK", description: "Grill, sauté, fry & pantry station cooking" },
  { name: "Bartender", code: "BARTENDER", description: "Beverage mixing, bar stock inventory & draft management" },
  { name: "Lead Server / Waiter", code: "SERVER", description: "Table ordering, guest service & POS bill checkout" },
  { name: "Cashier / Host", code: "CASHIER", description: "Table reservations, guest reception & billing desk" },
  { name: "Shift Supervisor", code: "SUPERVISOR", description: "Floor coordination, shift handovers & attendance approvals" },
  { name: "General Manager", code: "GM", description: "Full operational leadership, payroll approvals & P&L oversight" },
];

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const restaurantId = session.activeRestaurantId;

    // Seed standard departments
    for (const d of STANDARD_DEPARTMENTS) {
      const existing = await prisma.department.findFirst({
        where: { restaurantId, code: d.code, archivedAt: null },
      });
      if (!existing) {
        await prisma.department.create({
          data: {
            restaurantId,
            name: d.name,
            code: d.code,
            description: d.description,
            status: "ACTIVE",
          },
        });
      }
    }

    // Seed standard designations
    for (const des of STANDARD_DESIGNATIONS) {
      const existing = await prisma.designation.findFirst({
        where: { restaurantId, code: des.code, archivedAt: null },
      });
      if (!existing) {
        await prisma.designation.create({
          data: {
            restaurantId,
            name: des.name,
            code: des.code,
            description: des.description,
            status: "ACTIVE",
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Standard restaurant departments and staff roles initialized successfully.",
    });
  } catch (error: any) {
    console.error("Master Data Seed Error:", error);
    return NextResponse.json({ error: error.message || "Failed to initialize standard presets" }, { status: 400 });
  }
}
