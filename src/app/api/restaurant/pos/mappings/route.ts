import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/core/database/client";
import {
  assertPosOutletInScope,
  getPosActorContext,
} from "@/modules/pos-integrations/authHelper";

const upsertMappingSchema = z.object({
  id: z.string().optional(),
  outletId: z.string().min(1),
  provider: z.string().min(1),
  externalItemId: z.string().min(1),
  externalItemName: z.string().min(1),
  externalVariantId: z.string().optional(),
  externalVariantName: z.string().nullable().optional(),
  recipeId: z.string().nullable().optional(),
  isIgnored: z.boolean().optional(),
  modifierAdjustmentsJson: z.any().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getPosActorContext({ requireView: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId");
    const provider = searchParams.get("provider");
    const unmappedOnly = searchParams.get("unmappedOnly") === "true";

    if (outletId && outletId !== "ALL") {
      const scope = assertPosOutletInScope(auth.ctx, outletId);
      if (!scope.ok) {
        return NextResponse.json({ error: scope.error }, { status: scope.status });
      }
    }

    const where: any = { restaurantId: auth.ctx.restaurantId };
    if (outletId && outletId !== "ALL") {
      where.outletId = outletId;
    } else if (auth.ctx.accessibleOutletIds !== null) {
      where.outletId = { in: auth.ctx.accessibleOutletIds };
    }
    if (provider && provider !== "ALL") where.provider = provider;
    if (unmappedOnly) {
      where.recipeId = null;
      where.isIgnored = false;
    }

    const [mappings, recipes] = await Promise.all([
      prisma.posMenuItemMapping.findMany({
        where,
        include: {
          recipe: { select: { id: true, name: true, isDraft: true } },
          outlet: { select: { id: true, name: true } },
        },
        orderBy: [{ recipeId: "asc" }, { externalItemName: "asc" }],
      }),
      prisma.recipe.findMany({
        where: {
          restaurantId: auth.ctx.restaurantId,
          type: "DISH",
          archivedAt: null,
          isDraft: false,
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({ success: true, mappings, recipes });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load POS item mappings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = upsertMappingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid mapping payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const auth = await getPosActorContext({
      requireManage: true,
      outletId: parsed.data.outletId,
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (parsed.data.recipeId) {
      const recipe = await prisma.recipe.findFirst({
        where: {
          id: parsed.data.recipeId,
          restaurantId: auth.ctx.restaurantId,
          isDraft: false,
          archivedAt: null,
        },
      });
      if (!recipe) {
        return NextResponse.json(
          { error: "Selected recipe must be a published recipe in this restaurant" },
          { status: 400 }
        );
      }
    }

    const extVarId = parsed.data.externalVariantId || "";
    const mapping = await prisma.posMenuItemMapping.upsert({
      where: {
        restaurantId_outletId_provider_externalItemId_externalVariantId: {
          restaurantId: auth.ctx.restaurantId,
          outletId: parsed.data.outletId,
          provider: parsed.data.provider,
          externalItemId: parsed.data.externalItemId,
          externalVariantId: extVarId,
        },
      },
      update: {
        externalItemName: parsed.data.externalItemName,
        externalVariantName: parsed.data.externalVariantName ?? undefined,
        recipeId: parsed.data.recipeId ?? null,
        isIgnored: Boolean(parsed.data.isIgnored),
        modifierAdjustmentsJson: parsed.data.modifierAdjustmentsJson ?? undefined,
        mappedByUserId: auth.ctx.userId,
        mappedAt: new Date(),
      },
      create: {
        restaurantId: auth.ctx.restaurantId,
        outletId: parsed.data.outletId,
        provider: parsed.data.provider,
        externalItemId: parsed.data.externalItemId,
        externalItemName: parsed.data.externalItemName,
        externalVariantId: extVarId,
        externalVariantName: parsed.data.externalVariantName ?? null,
        recipeId: parsed.data.recipeId ?? null,
        isIgnored: Boolean(parsed.data.isIgnored),
        modifierAdjustmentsJson: parsed.data.modifierAdjustmentsJson ?? undefined,
        mappedByUserId: auth.ctx.userId,
        mappedAt: new Date(),
      },
      include: {
        recipe: { select: { id: true, name: true, isDraft: true } },
        outlet: { select: { id: true, name: true } },
      },
    });

    // Link existing unmapped order items in this outlet for reporting (does NOT move stock)
    if (mapping.recipeId && !mapping.isIgnored) {
      await prisma.posOrderItem.updateMany({
        where: {
          posMenuItemId: parsed.data.externalItemId,
          externalVariantId: extVarId || null,
          recipeId: null,
          order: {
            restaurantId: auth.ctx.restaurantId,
            outletId: parsed.data.outletId,
            provider: parsed.data.provider,
          },
        },
        data: { recipeId: mapping.recipeId },
      });
    }

    return NextResponse.json({ success: true, mapping });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to save POS item mapping" },
      { status: 500 }
    );
  }
}
