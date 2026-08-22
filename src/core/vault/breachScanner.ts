import crypto from "crypto";

export interface BreachCheckResult {
  isBreached: boolean;
  breachCount: number;
  hashPrefix: string;
}

/**
 * Checks if a password has been exposed in data breaches using zero-knowledge k-Anonymity.
 * Never sends the full password or full hash over the network.
 */
export async function checkPasswordBreach(password: string): Promise<BreachCheckResult> {
  if (!password || password.length === 0) {
    return { isBreached: false, breachCount: 0, hashPrefix: "" };
  }

  const sha1Hash = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1Hash.substring(0, 5);
  const suffix = sha1Hash.substring(5);

  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        "User-Agent": "Restaurant-SaaS-Enterprise-Vault",
      },
    });

    if (!response.ok) {
      // Fallback if API rate-limited or offline
      return { isBreached: false, breachCount: 0, hashPrefix: prefix };
    }

    const text = await response.text();
    const lines = text.split("\n");

    for (const line of lines) {
      const [candidateSuffix, countStr] = line.trim().split(":");
      if (candidateSuffix === suffix) {
        const breachCount = parseInt(countStr || "1", 10);
        return {
          isBreached: true,
          breachCount,
          hashPrefix: prefix,
        };
      }
    }

    return {
      isBreached: false,
      breachCount: 0,
      hashPrefix: prefix,
    };
  } catch (error) {
    // Network offline fallback
    return { isBreached: false, breachCount: 0, hashPrefix: prefix };
  }
}
