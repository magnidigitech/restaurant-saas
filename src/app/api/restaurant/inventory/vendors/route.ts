import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { VendorService } from "@/modules/inventory/vendor-service";
import { z } from "zod";

const createVendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required"),
  code: z.string().optional().or(z.literal("")),
  contactPerson: z.string().optional().or(z.literal("")),
  email: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  taxId: z.string().optional().or(z.literal("")),
  paymentTerms: z.enum(["COD", "IMMEDIATE", "PREPAID", "NET7", "NET15", "NET30", "NET60"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).optional(),
  notes: z.string().optional().or(z.literal("")),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "inventory", permissionKey: "inventory:view_items" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;

    const vendors = await VendorService.getVendors(session.activeRestaurantId, search, status);
    return NextResponse.json({ vendors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch vendors" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "inventory", permissionKey: "inventory:manage_items" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json();
    const result = createVendorSchema.safeParse(body);
    if (!result.success) {
      const issue = result.error.issues[0]?.message || "Invalid vendor form data";
      return NextResponse.json({ error: issue }, { status: 400 });
    }

    const vendor = await VendorService.createVendor(session.activeRestaurantId, result.data);
    return NextResponse.json({ success: true, vendor }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create vendor" }, { status: 400 });
  }
}
