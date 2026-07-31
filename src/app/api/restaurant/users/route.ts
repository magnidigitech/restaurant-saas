import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "node:crypto";

const createUserLoginSchema = z.object({
  employeeId: z.string().min(1),
  email: z.string().email(),
  roleId: z.string().min(1),
  outletId: z.string().optional(),
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

    const memberships = await prisma.restaurantMembership.findMany({
      where: { restaurantId: session.activeRestaurantId },
      include: {
        user: true,
        employee: true,
        accessGrants: {
          include: {
            module: true,
            role: true,
            outlet: true,
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    const pendingInvitations = await prisma.staffInvitation.findMany({
      where: { restaurantId: session.activeRestaurantId, status: "SENT" },
      include: { role: true, outlet: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ memberships, pendingInvitations });
  } catch (error: any) {
    console.error("List Restaurant Users Error:", error);
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
    const result = createUserLoginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    // 1. Verify target employee exists and belongs to restaurant and is not archived
    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, restaurantId, archivedAt: null },
    });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found, archived, or access denied" }, { status: 404 });
    }

    // 2. Verify target role belongs to restaurant or is platform default
    const role = await prisma.role.findFirst({
      where: { id: data.roleId, restaurantId },
    });
    if (!role) {
      return NextResponse.json({ error: "Role not found or access denied" }, { status: 404 });
    }

    // 3. Verify outlet ownership if provided
    if (data.outletId) {
      const outlet = await prisma.restaurantOutlet.findFirst({
        where: { id: data.outletId, restaurantId },
      });
      if (!outlet) {
        return NextResponse.json({ error: "Outlet not found or access denied" }, { status: 404 });
      }
    }

    const transaction = await prisma.$transaction(async (tx) => {
      // 4. Transactionally check subscription maxAdminUsers limit
      const sub = await tx.restaurantSubscription.findFirst({
        where: { restaurantId, status: "ACTIVE" },
        include: { plan: true },
        orderBy: { startDate: "desc" },
      });
      const maxAdminUsers = sub?.plan.maxAdminUsers ?? 5;

      const currentMembershipCount = await tx.restaurantMembership.count({
        where: { restaurantId },
      });
      const currentInviteCount = await tx.staffInvitation.count({
        where: { restaurantId, status: "SENT" },
      });

      if (currentMembershipCount + currentInviteCount >= maxAdminUsers) {
        throw new Error(`Internal user limit reached (${maxAdminUsers}). Upgrade your subscription plan to invite more users.`);
      }

      // 5. Generate secure invitation token
      const inviteToken = uuidv4();
      const inviteTokenHash = createHash("sha256").update(inviteToken).digest("hex");

      // Check existing invitation or user membership
      const existingUser = await tx.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        const existingMembership = await tx.restaurantMembership.findUnique({
          where: {
            restaurantId_userId: {
              restaurantId,
              userId: existingUser.id,
            },
          },
        });
        if (existingMembership) {
          throw new Error("This user is already a member of this restaurant.");
        }
      }

      const invitation = await tx.staffInvitation.upsert({
        where: {
          restaurantId_email: {
            restaurantId,
            email: data.email,
          },
        },
        create: {
          restaurantId,
          email: data.email,
          roleId: role.id,
          outletId: data.outletId || null,
          tokenHash: inviteTokenHash,
          status: "SENT",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        },
        update: {
          roleId: role.id,
          outletId: data.outletId || null,
          tokenHash: inviteTokenHash,
          status: "SENT",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          restaurantId,
          userId: session.userId,
          userEmail: session.email,
          action: "INVITATION_CREATED",
          entityType: "StaffInvitation",
          entityId: invitation.id,
          newValues: JSON.stringify({
            employeeId: employee.id,
            email: data.email,
            role: role.name,
          }),
        },
      });

      return { invitation, inviteToken };
    });

    return NextResponse.json({
      success: true,
      invitationId: transaction.invitation.id,
      inviteToken: transaction.inviteToken,
    });
  } catch (error: any) {
    console.error("Create User Invitation Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
