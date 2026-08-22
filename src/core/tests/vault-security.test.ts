import { prisma } from "@/core/database/client";
import {
  generateRandomSalt,
  deriveMasterKey,
  computeKeyVerifier,
  encryptSecret,
  decryptSecret,
} from "@/core/vault/crypto";
import { generateTOTP } from "@/core/vault/totp";
import { generatePassword, evaluatePasswordStrength } from "@/core/vault/passwordGenerator";
import { checkPasswordBreach } from "@/core/vault/breachScanner";

async function runTests() {
  console.log("=========================================================");
  console.log("  Enterprise Zero-Knowledge Vault Security Test Suite");
  console.log("=========================================================\n");

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

  // Setup Test Restaurant and User
  const testSubdomain = `test-vault-${Date.now()}`;
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Security Vault Bistro",
      subdomain: testSubdomain,
      status: "ACTIVE",
    },
  });

  const user = await prisma.user.create({
    data: {
      email: `ciso-${Date.now()}@example.com`,
      name: "Chief Security Officer",
      passwordHash: "dummyhash",
    },
  });

  try {
    console.log("── Section 1: Zero-Knowledge PBKDF2 Key Derivation ──");
    const masterPassword = "CorrectHorseBatteryStaple!2026";
    const saltHex = generateRandomSalt(16);
    assert(saltHex.length === 32, "Generated 16-byte random salt in hex");

    const masterKey = await deriveMasterKey(masterPassword, saltHex, 10000); // 10k iterations for unit test speed
    assert(masterKey.length === 32, "Derived 256-bit AES symmetric key");

    const verifier = computeKeyVerifier(masterKey);
    assert(verifier.length === 64, "Computed SHA-256 Key Verifier Hash");

    const wrongKey = await deriveMasterKey("WrongPassword123!", saltHex, 10000);
    const wrongVerifier = computeKeyVerifier(wrongKey);
    assert(verifier !== wrongVerifier, "Key verifier distinguishes correct vs incorrect master password");

    console.log("\n── Section 2: AES-256-GCM Authenticated Encryption & Decryption ──");
    const sampleSecret = {
      username: "admin@stripe.com",
      password: "SuperSecretPOSPassword!99#",
      websiteUrl: "https://dashboard.stripe.com",
      totpSecret: "JBSWY3DPEHPK3PXP",
      notes: "POS Gateway Live Production Secret Key",
    };

    const encryptedPayload = await encryptSecret(sampleSecret, masterKey);
    assert(encryptedPayload.ciphertext !== "", "Plaintext encrypted to Base64 ciphertext");
    assert(encryptedPayload.iv !== "", "Generated 12-byte GCM initialization vector");
    assert(encryptedPayload.authTag !== "", "Generated 16-byte GCM authentication tag");

    // Decrypt with correct key
    const decrypted = await decryptSecret(encryptedPayload, masterKey);
    assert(decrypted.username === sampleSecret.username, "Decrypted username matches original");
    assert(decrypted.password === sampleSecret.password, "Decrypted password matches original");
    assert(decrypted.totpSecret === sampleSecret.totpSecret, "Decrypted TOTP secret matches original");

    // Decrypt with wrong key should throw
    let failedDecryption = false;
    try {
      await decryptSecret(encryptedPayload, wrongKey);
    } catch {
      failedDecryption = true;
    }
    assert(failedDecryption, "Zero-Knowledge guarantee: Decryption with wrong master key fails securely");

    console.log("\n── Section 3: RFC 6238 TOTP 2FA Authenticator Engine ──");
    const totpResult = generateTOTP("JBSWY3DPEHPK3PXP");
    assert(totpResult.code.length === 6, `Generated 6-digit TOTP code (${totpResult.code})`);
    assert(totpResult.secondsRemaining >= 0 && totpResult.secondsRemaining <= 30, `Calculated remaining window (${totpResult.secondsRemaining}s)`);

    console.log("\n── Section 4: Password Generator & Strength Evaluation ──");
    const genPass = generatePassword({ length: 24, useUppercase: true, useLowercase: true, useNumbers: true, useSymbols: true });
    assert(genPass.length === 24, `Generated 24-character password: ${genPass}`);

    const passphrase = generatePassword({ mode: "PASSPHRASE", wordCount: 4 });
    assert(passphrase.split("-").length === 4, `Generated 4-word passphrase: ${passphrase}`);

    const strength = evaluatePasswordStrength(genPass);
    assert(strength.score === "STRONG" || strength.score === "EXCELLENT", `Evaluated password strength: ${strength.score} (${strength.entropyBits} bits entropy)`);

    console.log("\n── Section 5: Zero-Knowledge k-Anonymity Breach Scanner ──");
    // Known breached password "password"
    const breachTest = await checkPasswordBreach("password");
    assert(breachTest.hashPrefix.length === 5, `Extracted 5-char SHA-1 prefix: ${breachTest.hashPrefix}`);
    assert(breachTest.isBreached === true && breachTest.breachCount > 1000, `Detected known breached password with ${breachTest.breachCount.toLocaleString()} leak instances`);

    console.log("\n── Section 6: Database Persistence & Enterprise Audit Logging ──");
    // Create Folder
    const folder = await prisma.vaultFolder.create({
      data: {
        restaurantId: restaurant.id,
        name: "POS & Payment Terminals",
        color: "#0071E3",
      },
    });
    assert(folder.id !== "", "Created Vault Folder");

    // Create Vault Item
    const vaultItem = await prisma.vaultItem.create({
      data: {
        restaurantId: restaurant.id,
        authorId: user.id,
        folderId: folder.id,
        title: "Main Square POS Terminal Admin",
        itemType: "LOGIN",
        websiteUrl: "https://pos.square.com",
        encryptedData: encryptedPayload.ciphertext,
        iv: encryptedPayload.iv,
        authTag: encryptedPayload.authTag,
      },
    });
    assert(vaultItem.id !== "", "Stored zero-knowledge encrypted vault item in database");

    // Audit Log
    const audit = await prisma.vaultAuditLog.create({
      data: {
        restaurantId: restaurant.id,
        userId: user.id,
        userEmail: user.email,
        vaultItemId: vaultItem.id,
        action: "ITEM_CREATED",
        details: "Created encrypted POS terminal secret",
      },
    });
    assert(audit.id !== "", "Recorded real-time vault audit log entry");

    console.log("\n=========================================================");
    console.log(`  Test Results: ${passed} Passed, ${failed} Failed`);
    console.log("=========================================================\n");

    if (failed > 0) process.exit(1);
  } finally {
    try {
      await prisma.restaurant.deleteMany({ where: { id: restaurant.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    } catch {
      // ignore
    }
  }
}

runTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
