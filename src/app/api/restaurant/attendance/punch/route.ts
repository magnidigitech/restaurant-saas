import { NextRequest, NextResponse } from "next/server";
import {
  AttendanceError,
  processPunch,
} from "@/core/attendance/punchService";
import { getTenantSession } from "@/core/auth/session";
import { prisma } from "@/core/database/client";
import { z } from "zod";

const punchSchema = z.object({
  restaurantId: z.string().optional(),
  outletId: z.string().min(1),
  employeeId: z.string().optional(),
  kioskPin: z.string().min(4).max(6).optional(),
  punchType: z.enum(["CLOCK_IN", "CLOCK_OUT", "BREAK_START", "BREAK_END"]),
  punchTime: z.string().optional(),
  idempotencyKey: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  deviceInfo: z.string().optional(),
  photoUrl: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = punchSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid punch payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;
    let restaurantId = data.restaurantId;

    if (!restaurantId) {
      const session = await getTenantSession();
      if (session?.activeRestaurantId) {
        restaurantId = session.activeRestaurantId;
      }
    }

    if (!restaurantId) {
      const outlet = await prisma.restaurantOutlet.findUnique({
        where: { id: data.outletId },
        select: { restaurantId: true },
      });
      if (outlet) restaurantId = outlet.restaurantId;
    }

    if (!restaurantId) {
      return NextResponse.json(
        { error: "Restaurant context required for attendance punch" },
        { status: 400 }
      );
    }

    const punchResult = await processPunch({
      restaurantId,
      outletId: data.outletId,
      employeeId: data.employeeId,
      kioskPin: data.kioskPin,
      punchType: data.punchType,
      punchTime: data.punchTime ? new Date(data.punchTime) : undefined,
      idempotencyKey: data.idempotencyKey,
      latitude: data.latitude,
      longitude: data.longitude,
      deviceInfo: data.deviceInfo,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      photoUrl: data.photoUrl,
      notes: data.notes,
    });

    return NextResponse.json(punchResult, {
      status: punchResult.duplicate ? 200 : 201,
    });
  } catch (error: any) {
    if (error instanceof AttendanceError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      );
    }
    console.error("Attendance Punch Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record time punch" },
      { status: 400 }
    );
  }
}
