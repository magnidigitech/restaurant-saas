import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { setPlatformSession } from "@/core/auth/session";
import * as bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { email, password } = result.data;

    // Search inside platform users
    const platformUser = await prisma.platformUser.findUnique({
      where: { email },
    });

    if (!platformUser) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, platformUser.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Set Platform Admin session cookie
    await setPlatformSession({
      userId: platformUser.id,
      email: platformUser.email,
      name: platformUser.name,
      role: "PLATFORM_ADMIN",
    });

    return NextResponse.json({ success: true, user: { name: platformUser.name, email: platformUser.email } });
  } catch (error: any) {
    console.error("Login API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
