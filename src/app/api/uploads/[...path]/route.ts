import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { HROnboardingService } from "@/modules/hr-onboarding/service";
import { getOperationsActorContext } from "@/modules/operations/authHelper";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    if (!segments || segments.length < 2) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const [restaurantId, category] = segments;
    const portalToken =
      req.nextUrl.searchParams.get("portalToken") ||
      req.headers.get("x-portal-token");

    let authorized = false;
    let explicitlyForbidden = false;

    if (portalToken) {
      try {
        const portalSession = await HROnboardingService.getSessionByToken(
          portalToken
        );
        if (portalSession && portalSession.restaurantId === restaurantId) {
          const fileKey = segments[segments.length - 1];
          const upload = await prisma.employeeFileUpload.findFirst({
            where: {
              restaurantId,
              fileKey,
              onboardingId: portalSession.id,
            },
          });
          if (upload) authorized = true;
        }
      } catch {
        authorized = false;
      }
    }

    if (!authorized && category === "checklists") {
      const opAuth = await getOperationsActorContext();
      if (opAuth.ok && opAuth.ctx.restaurantId === restaurantId) {
        const { ctx } = opAuth;
        const expectedUrl = `/api/uploads/${segments.join("/")}`;
        const item = await prisma.shiftChecklistItemExecution.findFirst({
          where: {
            photoUrl: expectedUrl,
            execution: { restaurantId },
          },
          include: {
            execution: { select: { outletId: true, assignedEmployeeId: true } },
          },
        });

        if (item) {
          const isAssignee = Boolean(
            ctx.employeeId && item.execution.assignedEmployeeId === ctx.employeeId
          );
          const isScopedViewer =
            (ctx.canViewOperations || ctx.canManageOperations) &&
            (ctx.accessibleOutletIds === null ||
              ctx.accessibleOutletIds.includes(item.execution.outletId));

          if (isAssignee || isScopedViewer) {
            authorized = true;
          } else {
            explicitlyForbidden = true;
          }
        } else {
          explicitlyForbidden = true;
        }
      } else if (opAuth.ok && opAuth.ctx.restaurantId !== restaurantId) {
        explicitlyForbidden = true;
      }
    }

    if (!authorized && !explicitlyForbidden && category !== "checklists") {
      const session = await getTenantSession();
      if (session && session.activeRestaurantId === restaurantId) {
        const access = await verifyAccess(
          session.userId,
          restaurantId,
          { moduleKey: "hr_onboarding", permissionKey: "hr:view_employees" },
          session.tokenVersion
        );
        if (access.authorized) authorized = true;
      }
    }

    if (explicitlyForbidden) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (!authorized) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const filePath = join(process.cwd(), "public", "uploads", ...segments);
    if (!existsSync(filePath)) {
      return new NextResponse("File Not Found", { status: 404 });
    }

    const buffer = await readFile(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase();

    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeMap[ext || ""] || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Serve upload error:", error);
    return new NextResponse("Error reading file", { status: 500 });
  }
}
