import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { MasterDataService } from "@/modules/master-data/service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const restaurantId = session.activeRestaurantId;

    const accessCheck = await verifyAccess(
      session.userId,
      restaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const body = await req.json();
    const rows = Array.isArray(body.employees) ? body.employees : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: "No employee records provided in import payload" }, { status: 400 });
    }

    // 1. Subscription Check
    const sub = await prisma.restaurantSubscription.findFirst({
      where: { restaurantId, status: "ACTIVE" },
      include: { plan: true },
      orderBy: { startDate: "desc" },
    });

    const maxEmployees = sub?.plan.maxEmployees ?? 30;
    const currentCount = await prisma.employee.count({
      where: { restaurantId, archivedAt: null },
    });

    if (currentCount + rows.length > maxEmployees) {
      return NextResponse.json(
        {
          error: `Import exceeds subscription limit of ${maxEmployees} total employees. Currently registered: ${currentCount}. Trying to import: ${rows.length}. Please upgrade subscription.`,
        },
        { status: 400 }
      );
    }

    // Fetch existing outlets to map outlet names
    const outlets = await prisma.restaurantOutlet.findMany({
      where: { restaurantId },
    });
    const primaryOutlet = outlets[0];

    const results = {
      importedCount: 0,
      skippedCount: 0,
      errors: [] as string[],
    };

    let totalCount = await prisma.employee.count({ where: { restaurantId } });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const firstName = String(
        row.firstName || row["First Name"] || row["firstname"] || row.first_name || ""
      ).trim();
      const lastName = String(
        row.lastName || row["Last Name"] || row["lastname"] || row.last_name || ""
      ).trim();

      if (!firstName) {
        results.errors.push(`Row ${i + 1}: Missing required First Name.`);
        results.skippedCount++;
        continue;
      }

      const personalEmail =
        String(
          row.personalEmail || row.email || row["Email"] || row["Personal Email"] || ""
        ).trim() || null;
      const phone =
        String(row.phone || row.mobile || row["Phone"] || row["Mobile"] || "").trim() || null;
      const gender = String(row.gender || row["Gender"] || "").trim().toUpperCase() || null;
      const rawJoiningDate = row.joiningDate || row["Joining Date"] || row["Start Date"] || row["Date of Joining"];
      let joiningDate = new Date();
      if (rawJoiningDate) {
        const parsed = new Date(rawJoiningDate);
        if (!isNaN(parsed.getTime())) joiningDate = parsed;
      }

      // Resolve WorkerType
      const rawWt = String(
        row.workerType || row["Worker Type"] || row["Employment Type"] || "FULL_TIME"
      )
        .trim()
        .toUpperCase()
        .replace(/[\s-]/g, "_");
      let workerType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN" | "CONSULTANT" | "TEMPORARY" =
        "FULL_TIME";
      if (["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "CONSULTANT", "TEMPORARY"].includes(rawWt)) {
        workerType = rawWt as any;
      }

      // 1. Resolve / Auto-create Department in Master Data
      const deptName = String(
        row.department || row.departmentName || row["Department"] || row["Dept"] || ""
      ).trim();
      let departmentId: string | null = null;
      if (deptName) {
        departmentId = await MasterDataService.findOrCreateDepartmentByName(restaurantId, deptName);
      }

      // 2. Resolve / Auto-create Designation in Master Data
      const desigName = String(
        row.designation || row.designationName || row["Designation"] || row["Role"] || ""
      ).trim();
      let designationId: string | null = null;
      if (desigName) {
        designationId = await MasterDataService.findOrCreateDesignationByName(restaurantId, desigName);
      }

      // 3. Resolve Outlet
      const outletName = String(
        row.outlet || row.outletName || row["Outlet"] || row["Location"] || row["Branch"] || ""
      ).trim();
      let outletId = primaryOutlet?.id;
      if (outletName) {
        const matched = outlets.find((o) => o.name.toLowerCase() === outletName.toLowerCase());
        if (matched) outletId = matched.id;
      }

      // Generate unique employee code
      totalCount++;
      let employeeCode = `EMP-${String(totalCount).padStart(5, "0")}`;
      while (
        await prisma.employee.findUnique({
          where: { restaurantId_employeeCode: { restaurantId, employeeCode } },
        })
      ) {
        totalCount++;
        employeeCode = `EMP-${String(totalCount).padStart(5, "0")}`;
      }

      try {
        await prisma.$transaction(async (tx) => {
          const emp = await tx.employee.create({
            data: {
              restaurantId,
              employeeCode,
              firstName,
              lastName: lastName || "",
              personalEmail,
              phone,
              gender: ["MALE", "FEMALE", "OTHER"].includes(gender || "") ? gender : null,
              joiningDate,
              workerType,
              kioskPin: row.kioskPin ? String(row.kioskPin).slice(0, 4) : null,
            },
          });

          if (departmentId || designationId || outletId) {
            await tx.employmentRecord.create({
              data: {
                restaurantId,
                employeeId: emp.id,
                departmentId,
                designationId,
                primaryOutletId: outletId,
                employmentType: workerType,
                effectiveFrom: joiningDate,
                status: "ACTIVE",
              },
            });
          }

          if (outletId) {
            await tx.employeeOutletAssignment.create({
              data: {
                restaurantId,
                employeeId: emp.id,
                outletId,
                isPrimary: true,
                assignmentType: "PRIMARY",
                effectiveFrom: joiningDate,
              },
            });
          }
        });

        results.importedCount++;
      } catch (err: any) {
        results.errors.push(
          `Row ${i + 1} (${firstName} ${lastName}): ${err.message || "Failed to create"}`
        );
        results.skippedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error("Bulk Employee Import Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
