import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const createDocumentSchema = z.object({
  type: z.enum(["AADHAAR", "PASSPORT", "VISA", "CONTRACT", "RESUME", "CERTIFICATE", "MEDICAL", "FOOD_LICENSE"]),
  documentNumber: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  fileUrl: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const { id: employeeId } = await params;
    const documents = await prisma.employeeDocument.findMany({
      where: { employeeId, employee: { restaurantId: session.activeRestaurantId } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ documents });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { id: employeeId } = await params;

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, restaurantId: session.activeRestaurantId },
    });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const body = await req.json();
    const result = createDocumentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId,
        type: data.type,
        documentNumber: data.documentNumber || null,
        issueDate: data.issueDate ? new Date(data.issueDate) : null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        fileUrl: data.fileUrl || null,
        verifiedBy: session.email,
        verifiedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, document: doc });
  } catch (error: any) {
    console.error("Create Document Metadata Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
