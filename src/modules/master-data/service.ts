import { prisma } from "@/core/database/client";

export class MasterDataService {
  // --- Departments ---
  static async getDepartments(restaurantId: string) {
    return prisma.department.findMany({
      where: { restaurantId, archivedAt: null },
      orderBy: { name: "asc" },
    });
  }

  static async createDepartment(restaurantId: string, data: { name: string; code: string }) {
    return prisma.department.create({
      data: {
        restaurantId,
        name: data.name,
        code: data.code.toUpperCase(),
        status: "ACTIVE",
      },
    });
  }

  static async updateDepartment(
    restaurantId: string,
    id: string,
    data: { name?: string; code?: string; status?: string }
  ) {
    return prisma.department.updateMany({
      where: { id, restaurantId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code.toUpperCase() }),
        ...(data.status && { status: data.status }),
      },
    });
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

  static async createDesignation(restaurantId: string, data: { name: string; code: string }) {
    return prisma.designation.create({
      data: {
        restaurantId,
        name: data.name,
        code: data.code.toUpperCase(),
        status: "ACTIVE",
      },
    });
  }

  static async updateDesignation(
    restaurantId: string,
    id: string,
    data: { name?: string; code?: string; status?: string }
  ) {
    return prisma.designation.updateMany({
      where: { id, restaurantId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code.toUpperCase() }),
        ...(data.status && { status: data.status }),
      },
    });
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
        description: data.description,
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
        description: data.description,
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
}
