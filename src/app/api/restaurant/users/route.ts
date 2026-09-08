import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "node:crypto";
import { sendStaffAccessEmail } from "@/core/mail";

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

    // Auto-reconcile unlinked staff profiles:
    // If a membership has employeeId === null, check if an employee exists with matching personalEmail
    for (const m of memberships) {
      if (!m.employeeId && m.user?.email) {
        const matchedEmp = await prisma.employee.findFirst({
          where: {
            restaurantId: session.activeRestaurantId,
            personalEmail: { equals: m.user.email, mode: "insensitive" },
            archivedAt: null,
          },
        });
        if (matchedEmp) {
          await prisma.restaurantMembership.update({
            where: { id: m.id },
            data: { employeeId: matchedEmp.id },
          });
          m.employeeId = matchedEmp.id;
          m.employee = matchedEmp;
        }
      }
    }

    const memberEmails = new Set(memberships.map((m) => m.user.email.toLowerCase()));

    // Auto-reconcile: If an invitation exists for a user who is ALREADY an active member,
    // mark that invitation as ACCEPTED so it doesn't clutter pending list or count against limits
    if (memberEmails.size > 0) {
      await prisma.staffInvitation.updateMany({
        where: {
          restaurantId: session.activeRestaurantId,
          status: "SENT",
          email: { in: Array.from(memberEmails) },
        },
        data: { status: "ACCEPTED" },
      });
    }

    const pendingInvitations = await prisma.staffInvitation.findMany({
      where: {
        restaurantId: session.activeRestaurantId,
        status: "SENT",
        email: { notIn: Array.from(memberEmails) },
      },
      include: { role: true, outlet: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      memberships,
      pendingInvitations,
      currentUserId: session.userId,
    });
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
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });
    if (!role) {
      return NextResponse.json({ error: "Role not found or access denied" }, { status: 404 });
    }

    // 3. Verify outlet ownership if provided
    let outlet = null;
    if (data.outletId) {
      outlet = await prisma.restaurantOutlet.findFirst({
        where: { id: data.outletId, restaurantId },
      });
      if (!outlet) {
        return NextResponse.json({ error: "Outlet not found or access denied" }, { status: 404 });
      }
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const transaction = await prisma.$transaction(async (tx) => {
      // 4. Transactionally check subscription maxAdminUsers limit
      const sub = await tx.restaurantSubscription.findFirst({
        where: { restaurantId, status: "ACTIVE" },
        include: { plan: true },
        orderBy: { startDate: "desc" },
      });
      const maxAdminUsers = sub?.plan.maxAdminUsers ?? 5;

      // Calculate distinct active members
      const activeMemberships = await tx.restaurantMembership.findMany({
        where: { restaurantId },
        include: { user: true },
      });
      const activeMemberEmails = new Set(activeMemberships.map((m) => m.user.email.toLowerCase()));

      if (activeMemberEmails.has(data.email.toLowerCase())) {
        throw new Error(
          `This user (${data.email}) is already an active member of this restaurant. To change or assign additional roles, please use the "Edit Roles" option in the Active Members table.`
        );
      }

      // Count only pending invitations for users who are NOT already active members
      const activePendingInvites = await tx.staffInvitation.findMany({
        where: { restaurantId, status: "SENT" },
      });
      const distinctPendingInvites = activePendingInvites.filter(
        (inv) => !activeMemberEmails.has(inv.email.toLowerCase()) && inv.email.toLowerCase() !== data.email.toLowerCase()
      );

      const totalDistinctUsers = activeMemberEmails.size + distinctPendingInvites.length;

      if (totalDistinctUsers >= maxAdminUsers) {
        throw new Error(
          `Internal user limit reached (${maxAdminUsers}). Upgrade your subscription plan or cancel pending invitations.`
        );
      }

      // 5. Generate secure invitation token
      const inviteToken = uuidv4();
      const inviteTokenHash = createHash("sha256").update(inviteToken).digest("hex");

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

    // Determine clean base URL from headers or env
    const rawProto = req.headers.get("x-forwarded-proto") || "https";
    const proto = rawProto.split(",")[0].trim();
    const rawHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const host = rawHost.split(",")[0].trim();
    const cleanHost = host.startsWith("admin.") ? host.replace(/^admin\./, "") : host;
    const reqBaseUrl = cleanHost ? `${proto}://${cleanHost}` : undefined;

    // Dispatch professional HTML user access email
    let emailSent = false;
    let emailError: string | null = null;
    try {
      const emailResult = await sendStaffAccessEmail({
        recipientName: `${employee.firstName} ${employee.lastName}`.trim(),
        recipientEmail: data.email,
        restaurantName: restaurant.name,
        subdomain: restaurant.subdomain,
        roleName: role.name,
        roleDescription: role.description,
        permissions: role.permissions?.map((p) => p.permissionId) || [],
        outletName: outlet?.name || null,
        activationToken: transaction.inviteToken,
        expiresAt: transaction.invitation.expiresAt,
        baseUrl: reqBaseUrl,
      });
      emailSent = emailResult?.success ?? false;
      if (!emailResult?.success && emailResult?.error) {
        emailError = emailResult.error;
      }
    } catch (err: any) {
      console.warn("Failed to dispatch staff access email:", err);
      emailError = err.message;
    }

    return NextResponse.json({
      success: true,
      invitationId: transaction.invitation.id,
      inviteToken: transaction.inviteToken,
      emailSent,
      emailError,
      email: data.email,
    });
  } catch (error: any) {
    console.error("Create User Invitation Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
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

    const url = new URL(req.url);
    const invitationId = url.searchParams.get("invitationId");
    const membershipId = url.searchParams.get("membershipId");

    if (!invitationId && !membershipId) {
      return NextResponse.json(
        { error: "Must specify invitationId or membershipId to delete" },
        { status: 400 }
      );
    }

    if (invitationId) {
      const invitation = await prisma.staffInvitation.findFirst({
        where: { id: invitationId, restaurantId },
      });

      if (!invitation) {
        return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
      }

      await prisma.staffInvitation.delete({
        where: { id: invitationId },
      });

      await prisma.auditLog.create({
        data: {
          restaurantId,
          userId: session.userId,
          userEmail: session.email,
          action: "INVITATION_CANCELLED",
          entityType: "StaffInvitation",
          entityId: invitationId,
          newValues: JSON.stringify({ email: invitation.email }),
        },
      });

      return NextResponse.json({ success: true, message: "Staff invitation cancelled successfully" });
    }

    if (membershipId) {
      const membership = await prisma.restaurantMembership.findFirst({
        where: { id: membershipId, restaurantId },
        include: { user: true },
      });

      if (!membership) {
        return NextResponse.json({ error: "Membership not found" }, { status: 404 });
      }

      // Prevent self-deletion
      if (membership.userId === session.userId) {
        return NextResponse.json(
          { error: "You cannot remove your own active administrator account" },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        // Delete related access grants first
        await tx.accessGrant.deleteMany({
          where: { membershipId: membership.id, restaurantId },
        });

        // Delete membership
        await tx.restaurantMembership.delete({
          where: { id: membership.id },
        });

        // Clean up any stale staff invitations for this email
        await tx.staffInvitation.deleteMany({
          where: { restaurantId, email: membership.user.email },
        });

        await tx.auditLog.create({
          data: {
            restaurantId,
            userId: session.userId,
            userEmail: session.email,
            action: "MEMBERSHIP_DELETED",
            entityType: "RestaurantMembership",
            entityId: membership.id,
            newValues: JSON.stringify({
              userId: membership.userId,
              email: membership.user.email,
            }),
          },
        });
      });

      return NextResponse.json({ success: true, message: "User account membership removed" });
    }

    return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
  } catch (error: any) {
    console.error("Delete User/Invitation Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
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

    const body = await req.json().catch(() => ({}));
    const { invitationId, membershipId, employeeId, roleIds, outletId } = body;

    // Handle updating membership profile and/or assigning multiple roles
    if (membershipId) {
      const membership = await prisma.restaurantMembership.findFirst({
        where: { id: membershipId, restaurantId },
        include: { user: true },
      });
      if (!membership) {
        return NextResponse.json({ error: "Membership not found" }, { status: 404 });
      }

      // Self-protection: prevent user from removing all roles from their own admin account
      if (membership.userId === session.userId && Array.isArray(roleIds) && roleIds.length === 0) {
        return NextResponse.json(
          { error: "You cannot remove all roles from your own administrator account." },
          { status: 400 }
        );
      }

      let employee = null;
      if (employeeId) {
        employee = await prisma.employee.findFirst({
          where: { id: employeeId, restaurantId, archivedAt: null },
        });
        if (!employee) {
          return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });
        }
      }

      let rolesToAssign: any[] = [];
      if (Array.isArray(roleIds) && roleIds.length > 0) {
        rolesToAssign = await prisma.role.findMany({
          where: { id: { in: roleIds }, restaurantId },
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        });
        if (rolesToAssign.length !== roleIds.length) {
          return NextResponse.json(
            { error: "One or more selected roles were not found in this restaurant" },
            { status: 404 }
          );
        }
      }

      await prisma.$transaction(async (tx) => {
        // 1. Update employee link if employeeId was explicitly passed
        if (employeeId !== undefined) {
          await tx.restaurantMembership.update({
            where: { id: membership.id },
            data: { employeeId: employee ? employee.id : null },
          });
        }

        // 2. Update role access grants if roleIds was provided
        if (Array.isArray(roleIds)) {
          // Remove existing grants for this membership
          await tx.accessGrant.deleteMany({
            where: { membershipId: membership.id, restaurantId },
          });

          // Create new grants for each role and module
          for (const r of rolesToAssign) {
            const moduleIds: string[] = Array.from(new Set<string>(r.permissions.map((rp: any) => String(rp.permission.moduleId))));
            const targets: string[] = moduleIds.length > 0 ? moduleIds : ["workforce"];
            for (const moduleId of targets) {
              await tx.accessGrant.create({
                data: {
                  restaurantId,
                  membershipId: membership.id,
                  moduleId,
                  roleId: r.id,
                  outletId: outletId || null,
                  status: "ACTIVE",
                },
              });
            }
          }

          // Invalidate user token version so session caches refresh
          await tx.user.update({
            where: { id: membership.userId },
            data: { tokenVersion: { increment: 1 } },
          });
        }

        await tx.auditLog.create({
          data: {
            restaurantId,
            userId: session.userId,
            userEmail: session.email,
            action: "MEMBERSHIP_PROFILE_AND_ROLES_UPDATED",
            entityType: "RestaurantMembership",
            entityId: membership.id,
            newValues: JSON.stringify({
              userId: membership.userId,
              email: membership.user.email,
              employeeId: employee ? employee.id : employeeId === null ? null : undefined,
              roleIds: Array.isArray(roleIds) ? roleIds : undefined,
              outletId: outletId || null,
            }),
          },
        });
      });

      return NextResponse.json({
        success: true,
        message: `Account settings and assigned roles updated for ${membership.user.email}`,
      });
    }

    if (!invitationId) {
      return NextResponse.json({ error: "Missing invitationId or membershipId" }, { status: 400 });
    }

    const invitation = await prisma.staffInvitation.findFirst({
      where: { id: invitationId, restaurantId, status: "SENT" },
      include: {
        restaurant: true,
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
        outlet: true,
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Active invitation not found" }, { status: 404 });
    }

    // Refresh token and expiry
    const newToken = uuidv4();
    const newTokenHash = createHash("sha256").update(newToken).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    await prisma.staffInvitation.update({
      where: { id: invitation.id },
      data: {
        tokenHash: newTokenHash,
        expiresAt,
      },
    });

    const rawProto = req.headers.get("x-forwarded-proto") || "https";
    const proto = rawProto.split(",")[0].trim();
    const rawHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const host = rawHost.split(",")[0].trim();
    const cleanHost = host.startsWith("admin.") ? host.replace(/^admin\./, "") : host;
    const reqBaseUrl = cleanHost ? `${proto}://${cleanHost}` : undefined;

    const emailResult = await sendStaffAccessEmail({
      recipientName: invitation.email.split("@")[0],
      recipientEmail: invitation.email,
      restaurantName: invitation.restaurant.name,
      subdomain: invitation.restaurant.subdomain,
      roleName: invitation.role.name,
      roleDescription: invitation.role.description,
      permissions: invitation.role.permissions?.map((p) => p.permissionId) || [],
      outletName: invitation.outlet?.name || null,
      activationToken: newToken,
      expiresAt,
      baseUrl: reqBaseUrl,
    });

    return NextResponse.json({
      success: true,
      emailSent: emailResult?.success ?? false,
      inviteToken: newToken,
      message: "Invitation email resent successfully",
    });
  } catch (error: any) {
    console.error("Resend Staff Invitation Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
