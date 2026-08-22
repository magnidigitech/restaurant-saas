import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";
import crypto from "crypto";

const setupProfileSchema = z.object({
  masterSalt: z.string().min(8),
  keyVerifierHash: z.string().min(8),
  publicKeyPem: z.string().optional().nullable(),
  encryptedPrivKey: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
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

    let profile: any = null;
    if ((prisma as any).userVaultProfile) {
      profile = await (prisma as any).userVaultProfile.findUnique({
        where: { userId: session.userId },
      });
    } else {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT master_salt as "masterSalt", key_verifier_hash as "keyVerifierHash", public_key_pem as "publicKeyPem", encrypted_priv_key as "encryptedPrivKey" FROM user_vault_profiles WHERE user_id = $1 LIMIT 1`,
        session.userId
      );
      profile = rows[0] || null;
    }

    return NextResponse.json({
      success: true,
      hasVaultProfile: !!profile,
      profile: profile
        ? {
            masterSalt: profile.masterSalt,
            keyVerifierHash: profile.keyVerifierHash,
            publicKeyPem: profile.publicKeyPem,
            encryptedPrivKey: profile.encryptedPrivKey,
          }
        : null,
    });
  } catch (error: any) {
    console.error("Get Vault Profile Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const result = setupProfileSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid vault profile payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });
    const emailToUse = session.email || user?.email || "vault-user@local";

    let profile: any = null;
    if ((prisma as any).userVaultProfile) {
      profile = await (prisma as any).userVaultProfile.upsert({
        where: { userId: session.userId },
        create: {
          userId: session.userId,
          masterSalt: data.masterSalt,
          keyVerifierHash: data.keyVerifierHash,
          publicKeyPem: data.publicKeyPem,
          encryptedPrivKey: data.encryptedPrivKey,
        },
        update: {
          masterSalt: data.masterSalt,
          keyVerifierHash: data.keyVerifierHash,
          publicKeyPem: data.publicKeyPem,
          encryptedPrivKey: data.encryptedPrivKey,
        },
      });
    } else {
      const id = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO user_vault_profiles (id, user_id, master_salt, key_verifier_hash, public_key_pem, encrypted_priv_key, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           master_salt = EXCLUDED.master_salt,
           key_verifier_hash = EXCLUDED.key_verifier_hash,
           public_key_pem = EXCLUDED.public_key_pem,
           encrypted_priv_key = EXCLUDED.encrypted_priv_key,
           updated_at = NOW()`,
        id,
        session.userId,
        data.masterSalt,
        data.keyVerifierHash,
        data.publicKeyPem || null,
        data.encryptedPrivKey || null
      );
      profile = {
        masterSalt: data.masterSalt,
        keyVerifierHash: data.keyVerifierHash,
      };
    }

    try {
      if ((prisma as any).vaultAuditLog) {
        await (prisma as any).vaultAuditLog.create({
          data: {
            restaurantId: session.activeRestaurantId,
            userId: session.userId,
            userEmail: emailToUse,
            action: "VAULT_UNLOCKED",
            details: "User initialized or updated master vault profile.",
          },
        });
      } else {
        const auditId = crypto.randomUUID();
        await prisma.$executeRawUnsafe(
          `INSERT INTO vault_audit_logs (id, restaurant_id, user_id, user_email, action, details, created_at)
           VALUES ($1, $2, $3, $4, 'VAULT_UNLOCKED', 'User initialized master vault profile.', NOW())`,
          auditId,
          session.activeRestaurantId,
          session.userId,
          emailToUse
        );
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    console.error("Setup Vault Profile Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
