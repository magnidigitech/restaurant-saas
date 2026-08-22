import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";
import crypto from "crypto";

const createFolderSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional().default("#0071E3"),
  icon: z.string().optional().default("folder"),
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

    let folders: any[] = [];
    if ((prisma as any).vaultFolder) {
      folders = await (prisma as any).vaultFolder.findMany({
        where: { restaurantId: session.activeRestaurantId },
        include: {
          _count: {
            select: {
              items: {
                where: { archivedAt: null },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });
    } else {
      folders = await prisma.$queryRawUnsafe(
        `SELECT id, name, description, icon, color, created_at as "createdAt" FROM vault_folders WHERE restaurant_id = $1 ORDER BY name ASC`,
        session.activeRestaurantId
      );
    }

    return NextResponse.json({ success: true, folders });
  } catch (error: any) {
    console.error("List Folders Error:", error);
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
    const result = createFolderSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid folder payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;
    let folder: any = null;

    if ((prisma as any).vaultFolder) {
      const existing = await (prisma as any).vaultFolder.findFirst({
        where: {
          restaurantId: session.activeRestaurantId,
          name: { equals: data.name, mode: "insensitive" },
        },
      });

      if (existing) {
        return NextResponse.json({ error: `A folder named "${data.name}" already exists.` }, { status: 400 });
      }

      folder = await (prisma as any).vaultFolder.create({
        data: {
          restaurantId: session.activeRestaurantId,
          name: data.name,
          description: data.description,
          color: data.color,
          icon: data.icon,
        },
      });
    } else {
      const id = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO vault_folders (id, restaurant_id, name, description, color, icon, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        id,
        session.activeRestaurantId,
        data.name,
        data.description || null,
        data.color,
        data.icon
      );
      folder = { id, ...data };
    }

    return NextResponse.json({ success: true, folder }, { status: 201 });
  } catch (error: any) {
    console.error("Create Folder Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
