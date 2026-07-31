import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const createAccessGrantSchema = z.object({
  membershipId: z.string().min(1),
  moduleId: z.string().min(1),
  roleId: z.string().min(1),
  outletId: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
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

    const grants = await prisma.accessGrant.findMany({
      where: { restaurantId: session.activeRestaurantId, status: "ACTIVE" },
      include: {
        membership: {
          include: {
            user: true,
            employee: true,
          },
        },
        module: true,
        role: true,
        outlet: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ grants });
  } catch (error: any) {
    console.error("List Access Grants Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

    const body = await req.json();
    const result = createAccessGrantSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    // 1. Verify restaurant owns membership
    const membership = await prisma.restaurantMembership.findFirst({
      where: { id: data.membershipId, restaurantId: session.activeRestaurantId },
    });
    if (!membership) {
      return NextResponse.json({ error: "Membership not found or access denied" }, { status: 404 });
    }

    // 2. Verify module is enabled for restaurant
    const enabledModule = await prisma.restaurantModule.findFirst({
      where: {
        restaurantId: session.activeRestaurantId,
        moduleId: data.moduleId,
        status: "ACTIVE",
      },
    });
    if (!enabledModule) {
      return NextResponse.json({ error: "This module is not enabled for your restaurant tenant." }, { status: 400 });
    }

    // 3. Verify role belongs to restaurant
    const role = await prisma.role.findFirst({
      where: { id: data.roleId, restaurantId: session.activeRestaurantId },
    });
    if (!role) {
      return NextResponse.json({ error: "Role not found or access denied" }, { status: 404 });
    }

    // 4. Verify outlet belongs to restaurant if provided
    if (data.outletId) {
      const outlet = await prisma.restaurantOutlet.findFirst({
        where: { id: data.outletId, restaurantId: session.activeRestaurantId },
      });
      if (!outlet) {
        return NextResponse.json({ error: "Outlet not found or access denied" }, { status: 404 });
      }
    }

    // 5. Create or activate grant
    const grant = await prisma.accessGrant.create({
      data: {
        restaurantId: session.activeRestaurantId,
        membershipId: data.membershipId,
        moduleId: data.moduleId,
        roleId: data.roleId,
        outletId: data.outletId || null,
        status: "ACTIVE",
      },
      include: {
        module: true,
        role: true,
        outlet: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        restaurantId: session.activeRestaurantId,
        userId: session.userId,
        userEmail: session.email,
        action: "ACCESS_GRANT_CREATED",
        entityType: "AccessGrant",
        entityId: grant.id,
        newValues: JSON.stringify(data),
      },
    });

    return NextResponse.json({ success: true, grant });
  } catch (error: any) {
    console.error("Create Access Grant Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const grantId = searchParams.get("grantId");
    if (!grantId) {
      return NextResponse.json({ error: "grantId parameter required" }, { status: 400 });
    }

    const grant = await prisma.accessGrant.findFirst({
      where: { id: grantId, restaurantId: session.activeRestaurantId },
    });
    if (!grant) {
      return NextResponse.json({ error: "Access grant not found or access denied" }, { status: 404 });
    }

    await prisma.accessGrant.update({
      where: { id: grantId },
      data: { status: "REVOKED" },
    });

    await prisma.auditLog.create({
      data: {
        restaurantId: session.activeRestaurantId,
        userId: session.userId,
        userEmail: session.email,
        action: "ACCESS_GRANT_REMOVED",
        entityType: "AccessGrant",
        entityId: grantId,
        previousValues: JSON.stringify(grant),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Remove Access Grant Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
