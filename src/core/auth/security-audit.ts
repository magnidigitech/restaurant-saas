import { prisma } from "@/core/database/client";
import { ensureTwoFactorTables } from "@/core/database/ensure-tables";

export type SecurityEventType =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "PASSKEY_REGISTERED"
  | "PASSKEY_USED"
  | "PASSKEY_REVOKED"
  | "MFA_ENABLED"
  | "MFA_DISABLED"
  | "MFA_SUCCESS"
  | "MFA_FAILED"
  | "RECOVERY_CODE_USED"
  | "TRUSTED_DEVICE_CREATED"
  | "TRUSTED_DEVICE_REVOKED"
  | "SESSION_CREATED"
  | "SESSION_REVOKED"
  | "ALL_SESSIONS_REVOKED"
  | "USER_OFFBOARDED"
  | "MFA_POLICY_CHANGED"
  | "EMERGENCY_GLOBAL_LOGOUT"
  | "EMERGENCY_REVOKE_TRUSTED_DEVICES";

interface LogParams {
  organizationId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  event: SecurityEventType;
  reqHeaders?: Headers;
  metadata?: Record<string, any>;
}

export async function logSecurityAudit(params: LogParams) {
  try {
    await ensureTwoFactorTables();

    const ipAddress =
      params.reqHeaders?.get("x-forwarded-for") ||
      params.reqHeaders?.get("x-real-ip") ||
      null;
    const userAgent = params.reqHeaders?.get("user-agent") || null;

    await prisma.securityAuditLog.create({
      data: {
        organizationId: params.organizationId || null,
        userId: params.userId || null,
        userEmail: params.userEmail || null,
        event: params.event,
        ipAddress,
        userAgent,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (err) {
    console.error("Failed to write security audit log:", err);
  }
}
