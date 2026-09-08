import { NextRequest, NextResponse } from "next/server";
import { getPasskeyAuthOptions } from "@/core/auth/webauthn";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body;

    const options = await getPasskeyAuthOptions(email, req);
    return NextResponse.json(options);
  } catch (error: any) {
    console.error("Passkey Auth Options Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to generate authentication challenge" }, { status: 500 });
  }
}
