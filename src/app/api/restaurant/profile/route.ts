import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  applicationName: z.string().optional(),
  logoUrl: z.string().nullable().optional(),
  faviconUrl: z.string().nullable().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  supportEmail: z.string().email().nullable().optional(),
  supportPhone: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const restaurantId = session.activeRestaurantId!;

    const accessCheck = await verifyAccess(
      session.userId,
      restaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        branding: true,
        subscriptions: {
          include: { plan: true },
          orderBy: { startDate: "desc" },
          take: 1,
        },
        modules: {
          where: { status: "ACTIVE" },
          include: { module: true },
        },
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    return NextResponse.json({ restaurant });
  } catch (error: any) {
    console.error("Get Profile Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const restaurantId = session.activeRestaurantId!;

    const accessCheck = await verifyAccess(
      session.userId,
      restaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const body = await req.json();
    const result = updateProfileSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    const updated = await prisma.$transaction(async (tx) => {
      if (data.name) {
        await tx.restaurant.update({
          where: { id: restaurantId },
          data: { name: data.name },
        });
      }

      const branding = await tx.restaurantBranding.upsert({
        where: { restaurantId },
        create: {
          restaurantId,
          applicationName: data.applicationName || data.name || "Restaurant Portal",
          logoUrl: data.logoUrl,
          faviconUrl: data.faviconUrl,
          primaryColor: data.primaryColor || "#0f172a",
          secondaryColor: data.secondaryColor || "#3b82f6",
          supportEmail: data.supportEmail,
          supportPhone: data.supportPhone,
        },
        update: {
          ...(data.applicationName && { applicationName: data.applicationName }),
          ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
          ...(data.faviconUrl !== undefined && { faviconUrl: data.faviconUrl }),
          ...(data.primaryColor && { primaryColor: data.primaryColor }),
          ...(data.secondaryColor && { secondaryColor: data.secondaryColor }),
          ...(data.supportEmail !== undefined && { supportEmail: data.supportEmail }),
          ...(data.supportPhone !== undefined && { supportPhone: data.supportPhone }),
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          userId: session.userId,
          userEmail: session.email,
          action: "RESTAURANT_PROFILE_UPDATED",
          entityType: "RestaurantBranding",
          entityId: branding.id,
          newValues: JSON.stringify(data),
        },
      });

      return branding;
    });

    return NextResponse.json({ success: true, branding: updated });
  } catch (error: any) {
    console.error("Update Profile Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
