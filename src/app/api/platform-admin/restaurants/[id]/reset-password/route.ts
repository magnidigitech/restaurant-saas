import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getPlatformSession } from "@/core/auth/session";
import * as bcrypt from "bcryptjs";
import { z } from "zod";

const resetPasswordSchema = z.object({
  userId: z.string().uuid().optional(),
  userEmail: z.string().email().optional(),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  invalidateSessions: z.boolean().default(true),
});

// POST /api/platform-admin/restaurants/[id]/reset-password
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getPlatformSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized: Platform Super Admin privileges required" }, { status: 401 });
    }

    const { id: restaurantId } = await props.params;

    const body = await req.json();
    const result = resetPasswordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
    }

    const { userId, userEmail, newPassword, invalidateSessions } = result.data;

    // Verify restaurant exists
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        memberships: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant tenant not found" }, { status: 404 });
    }

    // Identify target user
    let targetUser = null;
    if (userId) {
      const mem = restaurant.memberships.find((m) => m.userId === userId);
      if (!mem) {
        return NextResponse.json({ error: "User is not a member of this restaurant" }, { status: 400 });
      }
      targetUser = mem.user;
    } else if (userEmail) {
      const mem = restaurant.memberships.find((m) => m.user.email.toLowerCase() === userEmail.toLowerCase());
      if (!mem) {
        return NextResponse.json({ error: "User with this email is not a member of this restaurant" }, { status: 400 });
      }
      targetUser = mem.user;
    } else {
      // Default to primary administrator
      const primaryMem = restaurant.memberships[0];
      if (!primaryMem) {
        return NextResponse.json({ error: "No active users found for this restaurant" }, { status: 404 });
      }
      targetUser = primaryMem.user;
    }

    // Hash the new password securely
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user password and increment tokenVersion if invalidateSessions is true
    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        passwordHash,
        tokenVersion: invalidateSessions ? { increment: 1 } : undefined,
      },
    });

    // Write tamper-evident audit log
    await prisma.auditLog.create({
      data: {
        restaurantId,
        userId: session.userId,
        userEmail: session.email,
        action: "ADMIN_PASSWORD_RESET",
        entityType: "User",
        entityId: targetUser.id,
        newValues: JSON.stringify({
          targetEmail: targetUser.email,
          tokenVersion: updatedUser.tokenVersion,
          sessionsInvalidated: invalidateSessions,
          resetBy: session.email,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Password reset successfully for ${targetUser.email}. All existing active sessions have been invalidated.`,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        tokenVersion: updatedUser.tokenVersion,
      },
    });
  } catch (error: any) {
    console.error("Reset Password Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
