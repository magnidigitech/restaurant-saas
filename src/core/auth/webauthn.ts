import { prisma } from "@/core/database/client";
import { ensureTwoFactorTables } from "@/core/database/ensure-tables";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";

/**
 * Derives RP (Relying Party) ID and origin based on host or request headers.
 */
export function getWebAuthnConfig(req?: Request | { headers: Headers }) {
  let host = "localhost";
  let origin = "http://localhost:3000";

  if (req) {
    const headers = "headers" in req ? req.headers : new Headers();
    const hostHeader = headers.get("x-forwarded-host") || headers.get("host") || "localhost";
    const protoHeader = headers.get("x-forwarded-proto") || (hostHeader.includes("localhost") ? "http" : "https");
    const originHeader = headers.get("origin");

    host = hostHeader.split(":")[0];
    origin = originHeader || `${protoHeader}://${hostHeader}`;
  }

  // If running on an apex domain like app.restobird.com, rpID can be restobird.com
  let rpID = host;
  if (host.endsWith("restobird.com")) {
    rpID = "restobird.com";
  }

  return {
    rpName: "Resto Bird Identity",
    rpID,
    origin,
  };
}

// In-memory challenge store for WebAuthn flows (expires in 5 minutes)
interface ChallengeRecord {
  challenge: string;
  userId?: string;
  restaurantId?: string;
  createdAt: number;
}

const challengeCache = new Map<string, ChallengeRecord>();

export function saveChallenge(key: string, data: ChallengeRecord) {
  // Purge expired challenges (> 5 mins)
  const now = Date.now();
  for (const [k, v] of challengeCache.entries()) {
    if (now - v.createdAt > 5 * 60 * 1000) {
      challengeCache.delete(k);
    }
  }
  challengeCache.set(key, data);
}

export function getAndClearChallenge(key: string): ChallengeRecord | null {
  const record = challengeCache.get(key);
  if (record) {
    challengeCache.delete(key);
    if (Date.now() - record.createdAt <= 5 * 60 * 1000) {
      return record;
    }
  }
  return null;
}

/**
 * Generate Registration Options for a new Passkey
 */
export async function getPasskeyRegistrationOptions(user: { id: string; email: string; name: string }, req?: Request) {
  await ensureTwoFactorTables();
  const config = getWebAuthnConfig(req);

  // Retrieve user's existing credentials to exclude re-registration on same device
  const existingPasskeys = await prisma.passkey.findMany({
    where: { userId: user.id, revokedAt: null },
    select: { credentialId: true },
  });

  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userID: Buffer.from(user.id, "utf-8"),
    userName: user.email,
    userDisplayName: user.name || user.email,
    attestationType: "none",
    excludeCredentials: existingPasskeys.map((pk) => ({
      id: pk.credentialId,
      transports: ["internal", "hybrid", "usb", "ble", "nfc"],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  // Save challenge keyed by user.id
  saveChallenge(`reg:${user.id}`, {
    challenge: options.challenge,
    userId: user.id,
    createdAt: Date.now(),
  });

  return options;
}

/**
 * Verify Registration Response and persist Passkey in Database
 */
export async function verifyPasskeyRegistrationResponse(
  userId: string,
  restaurantId: string,
  response: RegistrationResponseJSON,
  deviceName?: string,
  req?: Request
): Promise<VerifiedRegistrationResponse> {
  await ensureTwoFactorTables();
  const config = getWebAuthnConfig(req);

  const challengeRecord = getAndClearChallenge(`reg:${userId}`);
  if (!challengeRecord || !challengeRecord.challenge) {
    throw new Error("Registration session expired or invalid. Please try registering passkey again.");
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challengeRecord.challenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpID,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Passkey registration verification failed.");
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  // Persist passkey to database
  await prisma.passkey.create({
    data: {
      userId,
      organizationId: restaurantId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64"),
      counter: BigInt(credential.counter),
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: deviceName || "Passkey Device",
    },
  });

  return verification;
}

/**
 * Generate Authentication Options for signing in with Passkey
 */
export async function getPasskeyAuthOptions(userEmail?: string, req?: Request) {
  await ensureTwoFactorTables();
  const config = getWebAuthnConfig(req);

  let allowCredentials = undefined;

  if (userEmail) {
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        passkeys: {
          where: { revokedAt: null },
        },
      },
    });

    if (user && user.passkeys.length > 0) {
      allowCredentials = user.passkeys.map((pk) => ({
        id: pk.credentialId,
        transports: ["internal", "hybrid", "usb", "ble", "nfc"] as any,
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: config.rpID,
    userVerification: "preferred",
    allowCredentials,
  });

  const sessionKey = options.challenge;
  saveChallenge(`auth:${sessionKey}`, {
    challenge: options.challenge,
    createdAt: Date.now(),
  });

  return options;
}

/**
 * Verify Authentication Response against stored Passkey
 */
export async function verifyPasskeyAuthResponse(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  req?: Request
): Promise<{ verified: boolean; passkey: any; user: any }> {
  await ensureTwoFactorTables();
  const config = getWebAuthnConfig(req);

  // Locate the passkey in database
  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: response.id },
    include: { user: true },
  });

  if (!passkey || passkey.revokedAt) {
    throw new Error("Passkey credential not found or has been revoked.");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpID,
    credential: {
      id: passkey.credentialId,
      publicKey: Buffer.from(passkey.publicKey, "base64"),
      counter: Number(passkey.counter),
    },
    requireUserVerification: false,
  });

  if (!verification.verified) {
    throw new Error("Passkey authentication could not be verified.");
  }

  // Update counter and lastUsedAt
  await prisma.passkey.update({
    where: { id: passkey.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    },
  });

  return {
    verified: true,
    passkey,
    user: passkey.user,
  };
}
