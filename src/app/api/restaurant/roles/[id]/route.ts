import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const updateRoleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).default([]),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: roleId } = await params;
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
    const result = updateRoleSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    const existingRole = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!existingRole || existingRole.restaurantId !== restaurantId) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Check duplicate role name if name is changed
    if (existingRole.name !== data.name) {
      const duplicate = await prisma.role.findUnique({
        where: {
          restaurantId_name: {
            restaurantId,
            name: data.name,
          },
        },
      });

      if (duplicate) {
        return NextResponse.json({ error: "A role with this name already exists" }, { status: 400 });
      }
    }

    const role = await prisma.$transaction(async (tx) => {
      const updatedRole = await tx.role.update({
        where: { id: roleId },
        data: {
          name: data.name,
          description: data.description || null,
        },
      });

      // Update permissions
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      if (data.permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: data.permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          restaurantId,
          userId: session.userId,
          userEmail: session.email,
          action: "ROLE_UPDATED",
          entityType: "Role",
          entityId: updatedRole.id,
          newValues: JSON.stringify({ name: data.name, permissions: data.permissionIds }),
        },
      });

      return updatedRole;
    });

    return NextResponse.json({ success: true, role });
  } catch (error: any) {
    console.error("Update Role Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
