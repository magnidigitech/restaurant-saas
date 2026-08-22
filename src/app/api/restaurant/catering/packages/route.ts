import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import {
  listCateringPackages,
  createCateringPackage,
} from "@/modules/catering/service";

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      { moduleKey: "catering", permissionKey: "catering:view" },
      session.tokenVersion
    );
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const packages = await listCateringPackages(session.activeRestaurantId);
    return NextResponse.json({ packages });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      { moduleKey: "catering", permissionKey: "catering:manage_packages" },
      session.tokenVersion
    );
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await req.json();
    if (!body.name || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: "Package Name and at least one Item are required." },
        { status: 400 }
      );
    }

    const pkg = await createCateringPackage(session.activeRestaurantId, body);
    return NextResponse.json({ success: true, package: pkg });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 400 }
    );
  }
}
