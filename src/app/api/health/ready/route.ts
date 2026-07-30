import { NextResponse } from "next/server";
import { prisma } from "@/core/database/client";

export async function GET() {
  try {
    // Run simple ping query
    await prisma.$queryRawUnsafe("SELECT 1");

    return NextResponse.json({
      status: "READY",
      database: "CONNECTED",
    });
  } catch (error: any) {
    console.error("Readiness health check failed:", error.message);
    // Return standard response without exposing connection strings, user credentials or stack traces
    return NextResponse.json(
      {
        status: "OUT_OF_SERVICE",
        database: "DISCONNECTED",
      },
      { status: 503 }
    );
  }
}
