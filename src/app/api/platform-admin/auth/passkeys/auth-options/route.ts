import { NextRequest, NextResponse } from "next/server";
import { getPlatformPasskeyAuthOptions } from "@/core/auth/webauthn";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body;

    const options = await getPlatformPasskeyAuthOptions(email, req);
    return NextResponse.json(options);
  } catch (error: any) {
    console.error("Platform Passkey Auth Options Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to generate passkey challenge" }, { status: 500 });
  }
}
