import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { setTenantSession } from "@/core/auth/session";
import { isRateLimited } from "@/core/auth/rate-limiter";
import { validateCsrf } from "@/core/auth/csrf";
import * as bcrypt from "bcryptjs";
import { z } from "zod";

const tenantLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  subdomain: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    // 1. CSRF Protection
    if (!validateCsrf(req)) {
      return NextResponse.json({ error: "Forbidden: CSRF check failed" }, { status: 403 });
    }

    // 2. Rate Limiting
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (isRateLimited(`login:${ip}`)) {
      return NextResponse.json({ error: "Too many login attempts. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const result = tenantLoginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { email, password, subdomain } = result.data;

    // Verify restaurant status and subdomain match
    const restaurant = await prisma.restaurant.findUnique({
      where: { subdomain },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (restaurant.status === "SUSPENDED") {
      return NextResponse.json({ error: "Restaurant access suspended" }, { status: 403 });
    }

    if (restaurant.status === "DEACTIVATED") {
      return NextResponse.json({ error: "Restaurant deactivated" }, { status: 403 });
    }

    // Find User
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Validate Membership
    const membership = await prisma.restaurantMembership.findUnique({
      where: {
        restaurantId_userId: {
          restaurantId: restaurant.id,
          userId: user.id,
        },
      },
    });

    if (!membership || membership.status !== "ACTIVE") {
      return NextResponse.json({ error: "User is not an active member of this restaurant" }, { status: 403 });
    }

    // Save session payload including tokenVersion
    await setTenantSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: "RESTAURANT_USER",
      activeRestaurantId: restaurant.id,
      activeRestaurantSubdomain: subdomain,
      tokenVersion: user.tokenVersion,
    });

    return NextResponse.json({ success: true, user: { name: user.name, email: user.email } });
  } catch (error: any) {
    console.error("Tenant Login API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
