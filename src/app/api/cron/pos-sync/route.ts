import { NextRequest, NextResponse } from "next/server";
import { runScheduledPosSyncs } from "@/modules/pos-integrations/service";
import { sanitizeProviderError } from "@/modules/pos-integrations/crypto";

function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const authHeader = req.headers.get("authorization") || "";
  return authHeader === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
  }

  try {
    const results = await runScheduledPosSyncs();
    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeProviderError(err) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
