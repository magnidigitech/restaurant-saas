import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import * as bcrypt from "bcryptjs";
import { z } from "zod";
import { createHash } from "node:crypto";

const activateSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(2),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = activateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { token, name, password } = result.data;

    // Hash the token
    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    // Resolve invitation using tokenHash
    const invitation = await prisma.staffInvitation.findUnique({
      where: { tokenHash },
      include: {
        restaurant: true,
      },
    });

    if (!invitation || invitation.status !== "SENT") {
      return NextResponse.json({ error: "Invalid or already accepted invitation token" }, { status: 400 });
    }

    if (new Date() > invitation.expiresAt) {
      // Mark as expired
      await prisma.staffInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ error: "Invitation token has expired" }, { status: 400 });
    }

    // Run activation in transaction
    await prisma.$transaction(async (tx) => {
      // Update invitation state
      await tx.staffInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });

      // Find user
      const user = await tx.user.findUnique({
        where: { email: invitation.email },
      });

      if (!user) {
        throw new Error("Target user record not found");
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Update user details
      await tx.user.update({
        where: { id: user.id },
        data: {
          name,
          passwordHash,
        },
      });

      // Update membership status to ACTIVE
      await tx.restaurantMembership.update({
        where: {
          restaurantId_userId: {
            restaurantId: invitation.restaurantId,
            userId: user.id,
          },
        },
        data: {
          status: "ACTIVE",
        },
      });

      // Audit entry
      await tx.auditLog.create({
        data: {
          restaurantId: invitation.restaurantId,
          userId: user.id,
          userEmail: user.email,
          action: "USER_ACTIVATED",
          entityType: "User",
          entityId: user.id,
          newValues: JSON.stringify({ email: user.email, status: "ACTIVE" }),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Activation API Error:", error);
    return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 });
  }
}
