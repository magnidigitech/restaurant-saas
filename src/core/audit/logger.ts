import { prisma } from "../database/client";

export interface AuditLogOptions {
  userId: string;
  userEmail: string;
  restaurantId?: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(options: AuditLogOptions) {
  try {
    const prevString = options.previousValues ? JSON.stringify(options.previousValues) : null;
    const newString = options.newValues ? JSON.stringify(options.newValues) : null;

    return await prisma.auditLog.create({
      data: {
        restaurantId: options.restaurantId || null,
        userId: options.userId,
        userEmail: options.userEmail,
        action: options.action,
        entityType: options.entityType,
        entityId: options.entityId,
        previousValues: prevString,
        newValues: newString,
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
      },
    });
  } catch (error) {
    console.error("Audit log failed to write to database:", error);
  }
}
