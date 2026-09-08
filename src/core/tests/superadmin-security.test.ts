import { prisma } from "../database/client";
import { ensureTwoFactorTables } from "../database/ensure-tables";
import {
  generateTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
  verifyTotpCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  signPlatform2FAChallenge,
  verifyPlatform2FAChallenge,
} from "../auth/two-factor";
import {
  createPlatformTrustedDevice,
  isPlatformDeviceTrusted,
  revokePlatformTrustedDevice,
} from "../auth/trusted-devices";
import {
  trackPlatformSession,
  listPlatformSessions,
  revokePlatformSession,
  revokeAllOtherPlatformSessions,
} from "../auth/sessions";
import {
  getPlatformPasskeyRegistrationOptions,
  getPlatformPasskeyAuthOptions,
} from "../auth/webauthn";
import { generate } from "otplib";

async function runSuperAdminSecurityTests() {
  console.log("\n=======================================================");
  console.log("  Super Admin Security Suite (2FA, Passkeys, Sessions)");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    await ensureTwoFactorTables();

    // 1. Ensure test super admin exists
    const testEmail = "superadmin-test@restobird.com";
    let platformUser = await prisma.platformUser.findUnique({
      where: { email: testEmail },
    });

    if (!platformUser) {
      platformUser = await prisma.platformUser.create({
        data: {
          email: testEmail,
          passwordHash: "test_hash_superadmin",
          name: "Test Super Admin",
        },
      });
    }

    // Clean up prior test artifacts for this user
    await prisma.platformTwoFactorRecoveryCode.deleteMany({ where: { platformUserId: platformUser.id } });
    await prisma.platformTwoFactorAuth.deleteMany({ where: { platformUserId: platformUser.id } });
    await prisma.platformPasskey.deleteMany({ where: { platformUserId: platformUser.id } });
    await prisma.platformTrustedDevice.deleteMany({ where: { platformUserId: platformUser.id } });
    await prisma.platformUserSession.deleteMany({ where: { platformUserId: platformUser.id } });

    console.log("── Section 1: Super Admin TOTP Cryptography & Setup ──");
    const secret = generateTotpSecret();
    const encrypted = encryptTotpSecret(secret);
    const decrypted = decryptTotpSecret(encrypted);
    assert(decrypted === secret, "AES-256-GCM encryption/decryption preserves secret integrity");

    // Generate valid TOTP
    const token = await generate({ secret });
    const isValid = await verifyTotpCode(secret, token);
    assert(isValid, "Generated TOTP token verifies correctly against decrypted secret");

    // Invalid TOTP
    const isInvalid = await verifyTotpCode(secret, "000000");
    assert(!isInvalid || token === "000000", "Random 6-digit code rejected by TOTP validator");

    // Upsert 2FA table
    const twoFactorRecord = await prisma.platformTwoFactorAuth.create({
      data: {
        platformUserId: platformUser.id,
        secretEncrypted: encrypted,
        enabled: true,
        verifiedAt: new Date(),
      },
    });
    assert(true, "Super admin 2FA enabled record successfully created in platformTwoFactorAuth");

    console.log("\n── Section 2: Recovery Codes Generation & Validation ──");
    const plainCodes = generateRecoveryCodes(8);
    const hashedCodes = plainCodes.map(hashRecoveryCode);
    assert(plainCodes.length === 8 && hashedCodes.length === 8, "Generated 8 emergency recovery codes");

    // Store recovery codes
    await prisma.platformTwoFactorRecoveryCode.createMany({
      data: hashedCodes.map((codeHash) => ({
        platformTwoFactorId: twoFactorRecord.id,
        platformUserId: platformUser.id,
        codeHash,
      })),
    });

    const storedCount = await prisma.platformTwoFactorRecoveryCode.count({
      where: { platformUserId: platformUser.id, usedAt: null },
    });
    assert(storedCount === 8, "Stored 8 recovery code hashes in platformTwoFactorRecoveryCode");

    // Consume 1 recovery code
    const targetCode = plainCodes[0];
    const targetHash = hashRecoveryCode(targetCode);
    const matchedRecord = await prisma.platformTwoFactorRecoveryCode.findFirst({
      where: {
        platformUserId: platformUser.id,
        codeHash: targetHash,
        usedAt: null,
      },
    });
    assert(!!matchedRecord, "Successfully located matching unused recovery code hash");

    if (matchedRecord) {
      await prisma.platformTwoFactorRecoveryCode.update({
        where: { id: matchedRecord.id },
        data: { usedAt: new Date() },
      });
    }

    const remainingCount = await prisma.platformTwoFactorRecoveryCode.count({
      where: { platformUserId: platformUser.id, usedAt: null },
    });
    assert(remainingCount === 7, "Consumed recovery code decrements remaining unused codes to 7");

    console.log("\n── Section 3: Super Admin 2FA Challenge JWT Token ──");
    const challengeToken = await signPlatform2FAChallenge({
      platformUserId: platformUser.id,
      email: platformUser.email,
      name: platformUser.name || "Super Admin",
      tokenVersion: platformUser.tokenVersion || 0,
    });
    assert(typeof challengeToken === "string" && challengeToken.length > 20, "Issued HMAC-signed 2FA challenge JWT");

    const decoded = await verifyPlatform2FAChallenge(challengeToken);
    assert(
      decoded !== null &&
        decoded.platformUserId === platformUser.id &&
        decoded.type === "PLATFORM_2FA_CHALLENGE",
      "Decoded 2FA challenge JWT contains valid platformUserId and PLATFORM_2FA_CHALLENGE type"
    );

    console.log("\n── Section 4: 30-Day Trusted Devices ──");
    const { deviceId, rawToken } = await createPlatformTrustedDevice(
      platformUser.id,
      undefined,
      30
    );

    const isTrusted = await isPlatformDeviceTrusted(platformUser.id, rawToken);
    assert(isTrusted, "Device recognized as trusted within 30-day expiration window");

    const isFakeTrusted = await isPlatformDeviceTrusted(platformUser.id, "invalid_secret_token");
    assert(!isFakeTrusted, "Non-existent raw device token correctly rejected as untrusted");

    // Revoke device
    const trustedDev = await prisma.platformTrustedDevice.findFirst({
      where: { id: deviceId, platformUserId: platformUser.id, revokedAt: null },
    });
    assert(!!trustedDev, "Found active trusted device record");
    if (trustedDev) {
      const revoked = await revokePlatformTrustedDevice(trustedDev.id, platformUser.id);
      assert(revoked, "Revoked trusted device successfully");

      const isStillTrusted = await isPlatformDeviceTrusted(platformUser.id, rawToken);
      assert(!isStillTrusted, "Revoked device immediately fails trust check");
    }

    console.log("\n── Section 5: Active Super Admin Session Tracking ──");
    const headersA = new Headers({
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36",
      "x-forwarded-for": "192.168.1.10",
    });
    const headersB = new Headers({
      "user-agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/119.0",
      "x-forwarded-for": "192.168.1.20",
    });

    const tokenA = await trackPlatformSession(platformUser.id, headersA);
    const tokenB = await trackPlatformSession(platformUser.id, headersB);

    let sessions = await listPlatformSessions(platformUser.id, tokenA);
    assert(sessions.length === 2, "Active sessions list accurately reflects 2 concurrent sessions");

    const currentSession = sessions.find((s) => s.isCurrent);
    assert(currentSession !== undefined, "Session marked as isCurrent matches active session");

    const remoteSession = sessions.find((s) => !s.isCurrent);
    assert(remoteSession !== undefined, "Located remote session to revoke");
    if (remoteSession) {
      const revokedSess = await revokePlatformSession(remoteSession.id, platformUser.id);
      assert(revokedSess, "Successfully revoked remote session");
    }

    sessions = await listPlatformSessions(platformUser.id, tokenA);
    assert(sessions.length === 1, "Session list length drops to 1 after revocation");

    // Track a new session and test revokeAllOtherPlatformSessions
    const headersC = new Headers({
      "user-agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
      "x-forwarded-for": "192.168.1.30",
    });
    await trackPlatformSession(platformUser.id, headersC);

    const revokedOthersCount = await revokeAllOtherPlatformSessions(platformUser.id, tokenA);
    assert(revokedOthersCount === 1, `Revoked ${revokedOthersCount} other sessions while keeping current session intact`);

    sessions = await listPlatformSessions(platformUser.id, tokenA);
    assert(sessions.length === 1 && sessions[0].isCurrent, "Only the current session remains active");

    console.log("\n── Section 6: Super Admin WebAuthn / Passkeys Setup ──");
    const regOptions = await getPlatformPasskeyRegistrationOptions({
      id: platformUser.id,
      email: platformUser.email,
      name: platformUser.name || "Super Admin",
    });
    assert(
      !!regOptions && typeof regOptions.challenge === "string" && regOptions.user.id !== undefined,
      "Generated valid FIDO2 / WebAuthn registration options for Super Admin"
    );

    // Auth options
    const authOptions = await getPlatformPasskeyAuthOptions(platformUser.email);
    assert(
      !!authOptions && typeof authOptions.challenge === "string",
      "Generated valid WebAuthn authentication assertion options"
    );

    // Clean up test platform user
    await prisma.platformTwoFactorRecoveryCode.deleteMany({ where: { platformUserId: platformUser.id } });
    await prisma.platformTwoFactorAuth.deleteMany({ where: { platformUserId: platformUser.id } });
    await prisma.platformPasskey.deleteMany({ where: { platformUserId: platformUser.id } });
    await prisma.platformTrustedDevice.deleteMany({ where: { platformUserId: platformUser.id } });
    await prisma.platformUserSession.deleteMany({ where: { platformUserId: platformUser.id } });
    await prisma.platformUser.delete({ where: { id: platformUser.id } });

    console.log("\n=======================================================");
    console.log(`  Results: ${passed} Passed, ${failed} Failed`);
    console.log("=======================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error("Test execution failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSuperAdminSecurityTests();
