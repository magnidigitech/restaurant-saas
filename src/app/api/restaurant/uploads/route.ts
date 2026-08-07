import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { prisma } from "@/core/database/client";
import { HROnboardingService } from "@/modules/hr-onboarding/service";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const MAX_FILE_SIZE_MB = 10;
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const onboardingId = formData.get("onboardingId") as string | null;
    const portalToken = formData.get("portalToken") as string | null;
    const category = (formData.get("category") as string) || "DOCUMENT";

    let restaurantId: string | null = null;

    if (portalToken) {
      const portalSession = await HROnboardingService.getSessionByToken(portalToken);
      if (!portalSession) {
        return NextResponse.json({ error: "Invalid or expired portal link" }, { status: 401 });
      }
      restaurantId = portalSession.restaurantId;
    } else {
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
      restaurantId = session.activeRestaurantId;
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `File type '${file.type}' is not allowed` }, { status: 400 });
    }

    const sizeBytes = file.size;
    if (sizeBytes > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit` }, { status: 400 });
    }

    // Check storage quota
    const subscription = await prisma.restaurantSubscription.findFirst({
      where: { restaurantId, status: "ACTIVE" },
      include: { plan: true },
      orderBy: { startDate: "desc" },
    });

    const maxQuotaBytes = (subscription?.plan?.storageQuotaGb || 5) * 1024 * 1024 * 1024;
    const currentUsage = await prisma.employeeFileUpload.aggregate({
      where: { restaurantId },
      _sum: { sizeBytes: true },
    });
    const currentBytes = currentUsage._sum.sizeBytes || 0;

    if (currentBytes + sizeBytes > maxQuotaBytes) {
      return NextResponse.json({ error: "Storage quota exceeded for your restaurant plan" }, { status: 400 });
    }

    // Write file locally in uploads directory
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split(".").pop() || "bin";
    const filename = `${randomUUID()}.${ext}`;
    const uploadDir = join(process.cwd(), "public", "uploads", restaurantId);
    await mkdir(uploadDir, { recursive: true });

    const filePath = join(uploadDir, filename);
    await writeFile(filePath, buffer);

    const fileUrl = `/api/uploads/${restaurantId}/${filename}`;

    const fileUpload = await prisma.employeeFileUpload.create({
      data: {
        restaurantId,
        uploadedBy: portalToken ? "PORTAL_EMPLOYEE" : "STAFF_USER",
        fileKey: filename,
        fileName: file.name,
        fileUrl,
        mimeType: file.type,
        sizeBytes,
        category: category as any,
        onboardingId: onboardingId || null,
      },
    });

    return NextResponse.json({ success: true, upload: fileUpload }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
