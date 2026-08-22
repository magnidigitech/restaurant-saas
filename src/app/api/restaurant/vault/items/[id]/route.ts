import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const updateVaultItemSchema = z.object({
  title: z.string().min(1).optional(),
  folderId: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  encryptedData: z.string().min(1).optional(),
  iv: z.string().min(1).optional(),
  authTag: z.string().min(1).optional(),
  isFavorite: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  auditAction: z.enum(["ITEM_VIEWED", "ITEM_COPIED_PASSWORD", "ITEM_COPIED_USERNAME"]).optional(),
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

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { id } = await params;

    const item = await prisma.vaultItem.findFirst({
      where: {
        id,
        restaurantId: session.activeRestaurantId,
        archivedAt: null,
      },
      include: {
        folder: true,
        shares: {
          include: {
            recipient: { select: { id: true, name: true, email: true } },
            role: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });
    const emailToUse = session.email || user?.email || "vault-user@local";

    // Log view audit
    await prisma.vaultAuditLog.create({
      data: {
        restaurantId: session.activeRestaurantId,
        userId: session.userId,
        userEmail: emailToUse,
        vaultItemId: item.id,
        action: "ITEM_VIEWED",
        details: `Viewed secret details for "${item.title}"`,
        ipAddress: req.headers.get("x-forwarded-for") || undefined,
        userAgent: req.headers.get("user-agent") || undefined,
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    console.error("Get Vault Item Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
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

    const { id } = await params;
    const body = await req.json();
    const result = updateVaultItemSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    const existing = await prisma.vaultItem.findFirst({
      where: { id, restaurantId: session.activeRestaurantId, archivedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });
    const emailToUse = session.email || user?.email || "vault-user@local";

    // If client is just logging a copy action (e.g. copied password to clipboard)
    if (data.auditAction) {
      await prisma.vaultAuditLog.create({
        data: {
          restaurantId: session.activeRestaurantId,
          userId: session.userId,
          userEmail: emailToUse,
          vaultItemId: id,
          action: data.auditAction,
          details: `Copied ${data.auditAction === "ITEM_COPIED_PASSWORD" ? "password" : "username"} for "${existing.title}" to clipboard`,
          ipAddress: req.headers.get("x-forwarded-for") || undefined,
          userAgent: req.headers.get("user-agent") || undefined,
        },
      });
      return NextResponse.json({ success: true, message: "Audit event recorded" });
    }

    const updated = await prisma.vaultItem.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.folderId !== undefined && { folderId: data.folderId }),
        ...(data.websiteUrl !== undefined && { websiteUrl: data.websiteUrl }),
        ...(data.encryptedData && { encryptedData: data.encryptedData }),
        ...(data.iv && { iv: data.iv }),
        ...(data.authTag && { authTag: data.authTag }),
        ...(data.isFavorite !== undefined && { isFavorite: data.isFavorite }),
        ...(data.tags && { tags: data.tags }),
      },
    });

    await prisma.vaultAuditLog.create({
      data: {
        restaurantId: session.activeRestaurantId,
        userId: session.userId,
        userEmail: emailToUse,
        vaultItemId: id,
        action: "ITEM_UPDATED",
        details: `Updated vault item "${updated.title}"`,
      },
    });

    return NextResponse.json({ success: true, item: updated });
  } catch (error: any) {
    console.error("Update Vault Item Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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

    const { id } = await params;

    const existing = await prisma.vaultItem.findFirst({
      where: { id, restaurantId: session.activeRestaurantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
    }

    await prisma.vaultItem.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });
    const emailToUse = session.email || user?.email || "vault-user@local";

    await prisma.vaultAuditLog.create({
      data: {
        restaurantId: session.activeRestaurantId,
        userId: session.userId,
        userEmail: emailToUse,
        vaultItemId: id,
        action: "ITEM_ARCHIVED",
        details: `Moved vault item "${existing.title}" to trash`,
      },
    });

    return NextResponse.json({ success: true, message: "Item moved to trash" });
  } catch (error: any) {
    console.error("Delete Vault Item Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
