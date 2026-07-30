import { NextResponse } from "next/server";
import { clearPlatformSession } from "@/core/auth/session";

export async function POST() {
  await clearPlatformSession();
  return NextResponse.json({ success: true });
}
