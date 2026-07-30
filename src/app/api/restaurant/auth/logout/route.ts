import { NextResponse } from "next/server";
import { clearTenantSession } from "@/core/auth/session";

export async function POST() {
  await clearTenantSession();
  return NextResponse.json({ success: true });
}
