import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import {
  AttendanceError,
  identifyKioskEmployee,
} from "@/core/attendance/punchService";

const identifySchema = z.object({
  outletId: z.string().min(1),
  kioskPin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = identifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a valid 4-digit Kiosk PIN" },
        { status: 400 }
      );
    }

    const session = await getTenantSession();
    let restaurantId = session?.activeRestaurantId || null;

    if (!restaurantId) {
      const outlet = await prisma.restaurantOutlet.findUnique({
        where: { id: parsed.data.outletId },
        select: { restaurantId: true },
      });
      if (outlet) restaurantId = outlet.restaurantId;
    }

    if (!restaurantId) {
      return NextResponse.json(
        { error: "Outlet not found" },
        { status: 404 }
      );
    }

    const result = await identifyKioskEmployee({
      restaurantId,
      outletId: parsed.data.outletId,
      kioskPin: parsed.data.kioskPin,
      ipAddress: req.headers.get("x-forwarded-for") || "local",
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    if (error instanceof AttendanceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to verify PIN" },
      { status: 400 }
    );
  }
}
