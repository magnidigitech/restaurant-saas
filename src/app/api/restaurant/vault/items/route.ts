import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";
import crypto from "crypto";

const createVaultItemSchema = z.object({
  title: z.string().min(1),
  itemType: z.enum(["LOGIN", "SECURE_NOTE", "SOFTWARE_LICENSE", "API_KEY", "CREDIT_CARD"]).default("LOGIN"),
  folderId: z.string().optional().nullable(),
  websiteUrl: z.string().optional().nullable(),
  encryptedData: z.string().min(1), // Base64 ciphertext
  iv: z.string().min(1), // Base64
  authTag: z.string().min(1), // Base64
  isFavorite: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
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

    const { searchParams } = new URL(req.url);
    const itemType = searchParams.get("itemType");
    const folderId = searchParams.get("folderId");
    const search = searchParams.get("search");
    const favorite = searchParams.get("favorite") === "true";

    let items: any[] = [];

    // Resolve user's active roles and departments for share matching
    const membership = await prisma.restaurantMembership.findUnique({
      where: {
        restaurantId_userId: {
          restaurantId: session.activeRestaurantId,
          userId: session.userId,
        },
      },
      include: {
        accessGrants: true,
        employee: {
          include: {
            employmentRecords: { where: { status: "ACTIVE" } },
          },
        },
      },
    });

    const userRoleIds = (membership?.accessGrants?.map((ag) => ag.roleId).filter(Boolean) as string[]) || [];
    const userDeptIds = (membership?.employee?.employmentRecords?.map((er) => er.departmentId).filter(Boolean) as string[]) || [];

    const shareConditions: any[] = [{ recipientId: session.userId }];
    if (userRoleIds.length > 0) {
      shareConditions.push({ roleId: { in: userRoleIds } });
    }
    if (userDeptIds.length > 0) {
      shareConditions.push({ departmentId: { in: userDeptIds } });
    }

    if ((prisma as any).vaultItem) {
      const whereClause: any = {
        restaurantId: session.activeRestaurantId,
        archivedAt: null,
        OR: [
          { authorId: session.userId },
          {
            shares: {
              some: {
                OR: shareConditions,
              },
            },
          },
        ],
      };

      if (itemType) whereClause.itemType = itemType;
      if (folderId) whereClause.folderId = folderId;
      if (favorite) whereClause.isFavorite = true;
      if (search) whereClause.title = { contains: search, mode: "insensitive" };

      items = await (prisma as any).vaultItem.findMany({
        where: whereClause,
        include: {
          folder: { select: { id: true, name: true, color: true } },
          shares: {
            include: {
              recipient: { select: { id: true, name: true, email: true } },
              role: { select: { id: true, name: true } },
              department: { select: { id: true, name: true } },
            },
          },
          _count: { select: { auditLogs: true } },
        },
        orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }],
      });
    } else {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, title, item_type as "itemType", website_url as "websiteUrl", encrypted_data as "encryptedData", iv, auth_tag as "authTag", is_favorite as "isFavorite", tags, folder_id as "folderId", created_at as "createdAt", updated_at as "updatedAt"
         FROM vault_items
         WHERE restaurant_id = $1 AND archived_at IS NULL AND author_id = $2
         ORDER BY is_favorite DESC, updated_at DESC`,
        session.activeRestaurantId,
        session.userId
      );
      items = rows;
    }

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error("List Vault Items Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
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
    const result = createVaultItemSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid vault item payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;
    let item: any = null;

    if ((prisma as any).vaultItem) {
      item = await (prisma as any).vaultItem.create({
        data: {
          restaurantId: session.activeRestaurantId,
          authorId: session.userId,
          folderId: data.folderId || null,
          title: data.title,
          itemType: data.itemType,
          websiteUrl: data.websiteUrl,
          encryptedData: data.encryptedData,
          iv: data.iv,
          authTag: data.authTag,
          isFavorite: data.isFavorite,
          tags: data.tags,
        },
        include: {
          folder: true,
        },
      });
    } else {
      const id = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO vault_items (id, restaurant_id, author_id, folder_id, title, item_type, website_url, encrypted_data, iv, auth_tag, is_favorite, tags, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::"VaultItemType", $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
        id,
        session.activeRestaurantId,
        session.userId,
        data.folderId || null,
        data.title,
        data.itemType,
        data.websiteUrl || null,
        data.encryptedData,
        data.iv,
        data.authTag,
        data.isFavorite,
        data.tags
      );
      item = { id, ...data };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });
    const emailToUse = session.email || user?.email || "vault-user@local";

    try {
      if ((prisma as any).vaultAuditLog) {
        await (prisma as any).vaultAuditLog.create({
          data: {
            restaurantId: session.activeRestaurantId,
            userId: session.userId,
            userEmail: emailToUse,
            vaultItemId: item.id,
            action: "ITEM_CREATED",
            details: `Created vault item "${item.title}" (${item.itemType})`,
            ipAddress: req.headers.get("x-forwarded-for") || undefined,
            userAgent: req.headers.get("user-agent") || undefined,
          },
        });
      } else {
        const auditId = crypto.randomUUID();
        await prisma.$executeRawUnsafe(
          `INSERT INTO vault_audit_logs (id, restaurant_id, user_id, user_email, vault_item_id, action, details, created_at)
           VALUES ($1, $2, $3, $4, $5, 'ITEM_CREATED', $6, NOW())`,
          auditId,
          session.activeRestaurantId,
          session.userId,
          emailToUse,
          item.id,
          `Created vault item "${item.title}"`
        );
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (error: any) {
    console.error("Create Vault Item Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
