import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const createRoleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).default([]),
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

    const roles = await prisma.role.findMany({
      where: { restaurantId: session.activeRestaurantId },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ roles });
  } catch (error: any) {
    console.error("List Roles Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    const result = createRoleSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    // Check duplicate role name per restaurant
    const existing = await prisma.role.findUnique({
      where: {
        restaurantId_name: {
          restaurantId,
          name: data.name,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "A role with this name already exists" }, { status: 400 });
    }

    const role = await prisma.$transaction(async (tx) => {
      const createdRole = await tx.role.create({
        data: {
          restaurantId,
          name: data.name,
          description: data.description || null,
        },
      });

      if (data.permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: data.permissionIds.map((permissionId) => ({
            roleId: createdRole.id,
            permissionId,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          restaurantId,
          userId: session.userId,
          userEmail: session.email,
          action: "ROLE_CREATED",
          entityType: "Role",
          entityId: createdRole.id,
          newValues: JSON.stringify({ name: data.name, permissions: data.permissionIds }),
        },
      });

      return createdRole;
    });

    return NextResponse.json({ success: true, role });
  } catch (error: any) {
    console.error("Create Role Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
