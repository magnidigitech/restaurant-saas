import * as jose from "jose";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is missing.");
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: "PLATFORM_ADMIN" | "RESTAURANT_USER";
  activeRestaurantId?: string;
  activeRestaurantSubdomain?: string;
  tokenVersion?: number;
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return await new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch (error) {
    return null;
  }
}
