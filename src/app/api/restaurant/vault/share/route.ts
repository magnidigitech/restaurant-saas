import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const createShareSchema = z.object({
  vaultItemId: z.string().min(1),
  recipientId: z.string().optional().nullable(),
  roleId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  permission: z.enum(["READ_ONLY", "AUTOFILL_ONLY", "CAN_EDIT", "FULL_CONTROL"]).default("READ_ONLY"),
  encryptedKeyForRecipient: z.string().optional().nullable(),
});

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
    const result = createShareSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid share payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    // Validate target is specified
    if (!data.recipientId && !data.roleId && !data.departmentId) {
      return NextResponse.json({ error: "Must specify a team member, role, or department to share with" }, { status: 400 });
    }

    const vaultItem = await prisma.vaultItem.findFirst({
      where: { id: data.vaultItemId, restaurantId: session.activeRestaurantId, archivedAt: null },
    });

    if (!vaultItem) {
      return NextResponse.json({ error: "Vault item not found or unauthorized" }, { status: 404 });
    }

    let finalRecipientId: string | null = null;
    let recipientName = "";

    // Resolve Recipient User ID if provided
    if (data.recipientId) {
      // 1. Check if recipientId is a User ID directly
      const userDirect = await prisma.user.findUnique({
        where: { id: data.recipientId },
        select: { id: true, name: true, email: true },
      });

      if (userDirect) {
        finalRecipientId = userDirect.id;
        recipientName = userDirect.name || userDirect.email;
      } else {
        // 2. Check if recipientId was an Employee ID with a linked User
        const empMembership = await prisma.restaurantMembership.findFirst({
          where: {
            restaurantId: session.activeRestaurantId,
            employeeId: data.recipientId,
          },
          include: { user: true },
        });

        if (empMembership?.user) {
          finalRecipientId = empMembership.user.id;
          recipientName = empMembership.user.name || empMembership.user.email;
        } else {
          return NextResponse.json(
            { error: "Selected team member does not have an active user login account" },
            { status: 400 }
          );
        }
      }
    }

    // Check if matching share already exists for this exact target
    let whereTarget: any = { vaultItemId: data.vaultItemId };
    if (finalRecipientId) whereTarget.recipientId = finalRecipientId;
    else if (data.roleId) whereTarget.roleId = data.roleId;
    else if (data.departmentId) whereTarget.departmentId = data.departmentId;

    const existingShares = await prisma.vaultItemShare.findMany({
      where: whereTarget,
    });

    let share: any;

    if (existingShares.length > 0) {
      const primary = existingShares[0];
      // Update existing share permission
      share = await prisma.vaultItemShare.update({
        where: { id: primary.id },
        data: {
          permission: data.permission,
          encryptedKeyForRecipient: data.encryptedKeyForRecipient || primary.encryptedKeyForRecipient,
        },
        include: {
          recipient: { select: { id: true, name: true, email: true } },
          role: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      });

      // Purge any redundant duplicate rows
      if (existingShares.length > 1) {
        const extraIds = existingShares.slice(1).map((s) => s.id);
        await prisma.vaultItemShare.deleteMany({ where: { id: { in: extraIds } } });
      }
    } else {
      // Create new share
      share = await prisma.vaultItemShare.create({
        data: {
          vaultItemId: data.vaultItemId,
          recipientId: finalRecipientId,
          roleId: data.roleId || null,
          departmentId: data.departmentId || null,
          permission: data.permission,
          encryptedKeyForRecipient: data.encryptedKeyForRecipient || null,
        },
        include: {
          recipient: { select: { id: true, name: true, email: true } },
          role: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });
    const emailToUse = session.email || user?.email || "vault-user@local";

    const targetDescription = share.recipient
      ? `user ${share.recipient.name || share.recipient.email}`
      : share.role
      ? `role ${share.role.name}`
      : share.department
      ? `department ${share.department.name}`
      : "recipient";

    await prisma.vaultAuditLog.create({
      data: {
        restaurantId: session.activeRestaurantId,
        userId: session.userId,
        userEmail: emailToUse,
        vaultItemId: vaultItem.id,
        action: "ITEM_SHARED",
        details: `Shared "${vaultItem.title}" with ${targetDescription} (${data.permission})`,
      },
    });

    return NextResponse.json({ success: true, share }, { status: 201 });
  } catch (error: any) {
    console.error("Create Vault Share Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const shareId = searchParams.get("id");

    if (!shareId) {
      return NextResponse.json({ error: "Share ID required" }, { status: 400 });
    }

    const existing = await prisma.vaultItemShare.findUnique({
      where: { id: shareId },
      include: {
        vaultItem: true,
        recipient: true,
        role: true,
        department: true,
      },
    });

    if (!existing || existing.vaultItem.restaurantId !== session.activeRestaurantId) {
      return NextResponse.json({ error: "Share not found or unauthorized" }, { status: 404 });
    }

    await prisma.vaultItemShare.delete({ where: { id: shareId } });

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });
    const emailToUse = session.email || user?.email || "vault-user@local";

    const targetDescription = existing.recipient
      ? `user ${existing.recipient.name || existing.recipient.email}`
      : existing.role
      ? `role ${existing.role.name}`
      : existing.department
      ? `department ${existing.department.name}`
      : "recipient";

    await prisma.vaultAuditLog.create({
      data: {
        restaurantId: session.activeRestaurantId,
        userId: session.userId,
        userEmail: emailToUse,
        vaultItemId: existing.vaultItemId,
        action: "ITEM_SHARE_REVOKED",
        details: `Revoked access grant for "${existing.vaultItem.title}" from ${targetDescription}`,
      },
    });

    return NextResponse.json({ success: true, message: "Share revoked successfully" });
  } catch (error: any) {
    console.error("Revoke Share Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
