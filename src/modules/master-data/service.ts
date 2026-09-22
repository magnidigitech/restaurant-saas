import { prisma } from "@/core/database/client";

export class MasterDataService {
  // --- Departments ---
  static async getDepartments(restaurantId: string) {
    return prisma.department.findMany({
      where: { restaurantId, archivedAt: null },
      orderBy: { name: "asc" },
    });
  }

  static async createDepartment(restaurantId: string, data: { name: string; code: string; description?: string }) {
    return prisma.department.create({
      data: {
        restaurantId,
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description || null,
        status: "ACTIVE",
      },
    });
  }

  static async updateDepartment(
    restaurantId: string,
    id: string,
    data: { name?: string; code?: string; description?: string; status?: string }
  ) {
    return prisma.department.updateMany({
      where: { id, restaurantId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code.toUpperCase() }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status && { status: data.status }),
      },
    });
  }

  static async findOrCreateDepartmentByName(restaurantId: string, nameStr: string) {
    const trimmed = nameStr.trim();
    if (!trimmed) return null;

    const existing = await prisma.department.findFirst({
      where: {
        restaurantId,
        name: { equals: trimmed, mode: "insensitive" },
        archivedAt: null,
      },
    });
    if (existing) return existing.id;

    const baseCode = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "DEPT";
    let code = baseCode;
    let attempt = 1;
    while (await prisma.department.findFirst({ where: { restaurantId, code } })) {
      code = `${baseCode.slice(0, 6)}${attempt++}`;
    }

    const created = await prisma.department.create({
      data: {
        restaurantId,
        name: trimmed,
        code,
        status: "ACTIVE",
      },
    });
    return created.id;
  }

  static async archiveDepartment(restaurantId: string, id: string) {
    return prisma.department.updateMany({
      where: { id, restaurantId },
      data: { archivedAt: new Date(), status: "INACTIVE" },
    });
  }

  // --- Designations ---
  static async getDesignations(restaurantId: string) {
    return prisma.designation.findMany({
      where: { restaurantId, archivedAt: null },
      orderBy: { name: "asc" },
    });
  }

  static async createDesignation(restaurantId: string, data: { name: string; code: string; description?: string }) {
    return prisma.designation.create({
      data: {
        restaurantId,
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description || null,
        status: "ACTIVE",
      },
    });
  }

  static async updateDesignation(
    restaurantId: string,
    id: string,
    data: { name?: string; code?: string; description?: string; status?: string }
  ) {
    return prisma.designation.updateMany({
      where: { id, restaurantId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code.toUpperCase() }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status && { status: data.status }),
      },
    });
  }

  static async findOrCreateDesignationByName(restaurantId: string, nameStr: string) {
    const trimmed = nameStr.trim();
    if (!trimmed) return null;

    const existing = await prisma.designation.findFirst({
      where: {
        restaurantId,
        name: { equals: trimmed, mode: "insensitive" },
        archivedAt: null,
      },
    });
    if (existing) return existing.id;

    const baseCode = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "DESIG";
    let code = baseCode;
    let attempt = 1;
    while (await prisma.designation.findFirst({ where: { restaurantId, code } })) {
      code = `${baseCode.slice(0, 6)}${attempt++}`;
    }

    const created = await prisma.designation.create({
      data: {
        restaurantId,
        name: trimmed,
        code,
        status: "ACTIVE",
      },
    });
    return created.id;
  }

  static async archiveDesignation(restaurantId: string, id: string) {
    return prisma.designation.updateMany({
      where: { id, restaurantId },
      data: { archivedAt: new Date(), status: "INACTIVE" },
    });
  }

  // --- Job Grades ---
  static async getJobGrades(restaurantId: string) {
    return prisma.jobGrade.findMany({
      where: { restaurantId, archivedAt: null },
      orderBy: { name: "asc" },
    });
  }

  static async createJobGrade(restaurantId: string, data: { name: string; code: string; description?: string }) {
    return prisma.jobGrade.create({
      data: {
        restaurantId,
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description || null,
        status: "ACTIVE",
      },
    });
  }

  static async updateJobGrade(
    restaurantId: string,
    id: string,
    data: { name?: string; code?: string; description?: string; status?: string }
  ) {
    return prisma.jobGrade.updateMany({
      where: { id, restaurantId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code.toUpperCase() }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status && { status: data.status }),
      },
    });
  }

  static async archiveJobGrade(restaurantId: string, id: string) {
    return prisma.jobGrade.updateMany({
      where: { id, restaurantId },
      data: { archivedAt: new Date(), status: "INACTIVE" },
    });
  }

  // --- Cost Centers ---
  static async getCostCenters(restaurantId: string) {
    return prisma.costCenter.findMany({
      where: { restaurantId, archivedAt: null },
      orderBy: { name: "asc" },
    });
  }

  static async createCostCenter(restaurantId: string, data: { name: string; code: string; description?: string }) {
    return prisma.costCenter.create({
      data: {
        restaurantId,
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description || null,
        status: "ACTIVE",
      },
    });
  }

  static async updateCostCenter(
    restaurantId: string,
    id: string,
    data: { name?: string; code?: string; description?: string; status?: string }
  ) {
    return prisma.costCenter.updateMany({
      where: { id, restaurantId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code.toUpperCase() }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status && { status: data.status }),
      },
    });
  }

  static async archiveCostCenter(restaurantId: string, id: string) {
    return prisma.costCenter.updateMany({
      where: { id, restaurantId },
      data: { archivedAt: new Date(), status: "INACTIVE" },
    });
  }
}
