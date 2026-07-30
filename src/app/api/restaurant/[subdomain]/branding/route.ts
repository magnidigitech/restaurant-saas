import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;

    const restaurant = await prisma.restaurant.findUnique({
      where: { subdomain },
      include: {
        branding: true,
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant space not found" }, { status: 404 });
    }

    return NextResponse.json({
      name: restaurant.name,
      applicationName: restaurant.branding?.applicationName || restaurant.name,
      primaryColor: restaurant.branding?.primaryColor || "#0f172a",
      secondaryColor: restaurant.branding?.secondaryColor || "#3b82f6",
      logoUrl: restaurant.branding?.logoUrl || null,
      status: restaurant.status,
    });
  } catch (error: any) {
    console.error("Get Branding Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
