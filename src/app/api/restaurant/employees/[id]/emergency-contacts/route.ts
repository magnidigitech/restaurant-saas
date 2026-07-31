import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const createContactSchema = z.object({
  name: z.string().min(1),
  relationship: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const { id: employeeId } = await params;
    const contacts = await prisma.employeeEmergencyContact.findMany({
      where: { employeeId, employee: { restaurantId: session.activeRestaurantId } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ contacts });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: employeeId } = await params;

    // Verify employee ownership
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, restaurantId: session.activeRestaurantId },
    });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const body = await req.json();
    const result = createContactSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
    }

    const contact = await prisma.employeeEmergencyContact.create({
      data: {
        employeeId,
        name: result.data.name,
        relationship: result.data.relationship,
        phone: result.data.phone,
        address: result.data.address || null,
      },
    });

    return NextResponse.json({ success: true, contact });
  } catch (error: any) {
    console.error("Create Emergency Contact Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
