import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { MasterDataService } from "@/modules/master-data/service";

export const dynamic = "force-dynamic";

interface ExistingEmpInfo {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  personalEmail: string | null;
  phone: string | null;
}

function findExistingEmployee(
  rowCode: string | null,
  rowEmail: string | null,
  rowFirstName: string,
  rowLastName: string,
  list: ExistingEmpInfo[]
): ExistingEmpInfo | null {
  // 1. Match by explicit employee code if provided in row (e.g. EMP-00001)
  if (rowCode) {
    const match = list.find((e) => e.employeeCode.toLowerCase() === rowCode.toLowerCase());
    if (match) return match;
  }

  // 2. Match by personal email (case-insensitive)
  if (rowEmail) {
    const match = list.find(
      (e) => e.personalEmail && e.personalEmail.toLowerCase() === rowEmail.toLowerCase()
    );
    if (match) return match;
  }

  // 3. Match by First Name + Last Name (case-insensitive)
  if (rowFirstName) {
    const match = list.find(
      (e) =>
        e.firstName.toLowerCase() === rowFirstName.toLowerCase() &&
        (e.lastName || "").toLowerCase() === (rowLastName || "").toLowerCase()
    );
    if (match) return match;
  }

  return null;
}

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

    // Fetch existing active employees for smart duplicate detection
    const existingEmployees: ExistingEmpInfo[] = await prisma.employee.findMany({
      where: { restaurantId, archivedAt: null },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        personalEmail: true,
        phone: true,
      },
    });

    // Determine how many rows are NEW employees vs UPDATES
    let newEmployeesToCreate = 0;
    for (const row of rows) {
      const fName = String(
        row.firstName || row["First Name"] || row["firstname"] || row.first_name || ""
      ).trim();
      if (!fName) continue;
      const lName = String(
        row.lastName || row["Last Name"] || row["lastname"] || row.last_name || ""
      ).trim();
      const pEmail =
        String(
          row.personalEmail || row.email || row["Email"] || row["Personal Email"] || ""
        ).trim() || null;
      const eCode =
        String(
          row.employeeCode || row.code || row["Employee Code"] || row["Code"] || row["EMP ID"] || ""
        ).trim() || null;

      const matched = findExistingEmployee(eCode, pEmail, fName, lName, existingEmployees);
      if (!matched) {
        newEmployeesToCreate++;
      }
    }

    // 1. Subscription Check (only check limit against NEW employee creations)
    const sub = await prisma.restaurantSubscription.findFirst({
      where: { restaurantId, status: "ACTIVE" },
      include: { plan: true },
      orderBy: { startDate: "desc" },
    });

    const maxEmployees = sub?.plan.maxEmployees ?? 30;
    const currentCount = existingEmployees.length;

    if (currentCount + newEmployeesToCreate > maxEmployees) {
      return NextResponse.json(
        {
          error: `Import would exceed subscription limit of ${maxEmployees} total employees. Currently registered: ${currentCount}. Trying to create: ${newEmployeesToCreate} new profiles. Please upgrade subscription.`,
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
      createdCount: 0,
      updatedCount: 0,
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

      const rawCode =
        String(
          row.employeeCode || row.code || row["Employee Code"] || row["Code"] || row["EMP ID"] || ""
        ).trim() || null;

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

      const existingMatch = findExistingEmployee(
        rawCode,
        personalEmail,
        firstName,
        lastName,
        existingEmployees
      );

      try {
        if (existingMatch) {
          // --- UPDATE EXISTING EMPLOYEE ---
          await prisma.$transaction(async (tx) => {
            const updatedEmp = await tx.employee.update({
              where: { id: existingMatch.id },
              data: {
                firstName,
                lastName: lastName || "",
                ...(personalEmail ? { personalEmail } : {}),
                ...(phone ? { phone } : {}),
                ...(gender && ["MALE", "FEMALE", "OTHER"].includes(gender) ? { gender } : {}),
                joiningDate,
                workerType,
                ...(row.kioskPin ? { kioskPin: String(row.kioskPin).slice(0, 4) } : {}),
              },
            });

            // Update local state cache
            existingMatch.firstName = updatedEmp.firstName;
            existingMatch.lastName = updatedEmp.lastName;
            if (updatedEmp.personalEmail) existingMatch.personalEmail = updatedEmp.personalEmail;
            if (updatedEmp.phone) existingMatch.phone = updatedEmp.phone;

            // Update Employment Record
            if (departmentId || designationId || outletId) {
              const currentRec = await tx.employmentRecord.findFirst({
                where: { employeeId: existingMatch.id, status: "ACTIVE" },
              });
              if (currentRec) {
                await tx.employmentRecord.update({
                  where: { id: currentRec.id },
                  data: {
                    departmentId: departmentId || currentRec.departmentId,
                    designationId: designationId || currentRec.designationId,
                    primaryOutletId: outletId || currentRec.primaryOutletId,
                    employmentType: workerType,
                  },
                });
              } else {
                await tx.employmentRecord.create({
                  data: {
                    restaurantId,
                    employeeId: existingMatch.id,
                    departmentId,
                    designationId,
                    primaryOutletId: outletId,
                    employmentType: workerType,
                    effectiveFrom: joiningDate,
                    status: "ACTIVE",
                  },
                });
              }
            }

            // Update Primary Outlet Assignment
            if (outletId) {
              const currentAssign = await tx.employeeOutletAssignment.findFirst({
                where: { employeeId: existingMatch.id, isPrimary: true },
              });
              if (currentAssign) {
                await tx.employeeOutletAssignment.update({
                  where: { id: currentAssign.id },
                  data: { outletId },
                });
              } else {
                await tx.employeeOutletAssignment.create({
                  data: {
                    restaurantId,
                    employeeId: existingMatch.id,
                    outletId,
                    isPrimary: true,
                    assignmentType: "PRIMARY",
                    effectiveFrom: joiningDate,
                  },
                });
              }
            }
          });

          results.updatedCount++;
          results.importedCount++;
        } else {
          // --- CREATE NEW EMPLOYEE ---
          totalCount++;
          let employeeCode = rawCode || `EMP-${String(totalCount).padStart(5, "0")}`;
          while (
            await prisma.employee.findUnique({
              where: { restaurantId_employeeCode: { restaurantId, employeeCode } },
            })
          ) {
            totalCount++;
            employeeCode = `EMP-${String(totalCount).padStart(5, "0")}`;
          }

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

            // Cache newly created employee so subsequent rows in the same sheet update it
            existingEmployees.push({
              id: emp.id,
              employeeCode: emp.employeeCode,
              firstName: emp.firstName,
              lastName: emp.lastName,
              personalEmail: emp.personalEmail,
              phone: emp.phone,
            });
          });

          results.createdCount++;
          results.importedCount++;
        }
      } catch (err: any) {
        results.errors.push(
          `Row ${i + 1} (${firstName} ${lastName}): ${err.message || "Failed to process"}`
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

