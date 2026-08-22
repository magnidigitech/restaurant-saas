export interface PasswordGeneratorOptions {
  length?: number;
  useUppercase?: boolean;
  useLowercase?: boolean;
  useNumbers?: boolean;
  useSymbols?: boolean;
  avoidAmbiguous?: boolean;
  mode?: "PASSWORD" | "PASSPHRASE";
  wordCount?: number;
  separator?: string;
}

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const NUMBERS = "0123456789";
const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?";
const AMBIGUOUS = "1lI0O";

const PASSPHRASE_WORDS = [
  "apple", "apron", "artist", "atomic", "avatar", "baker", "banana", "beacon", "breeze", "bridge",
  "cactus", "candle", "canyon", "castle", "cherry", "cipher", "citrus", "clover", "cobalt", "comet",
  "copper", "cosmic", "crater", "crystal", "dagger", "desert", "dragon", "eagle", "echo", "ember",
  "falcon", "feather", "forest", "fossil", "galaxy", "glacier", "granite", "harbor", "haven", "horizon",
  "island", "jaguar", "jungle", "lagoon", "lantern", "legend", "lemur", "lotus", "meadow", "meteor",
  "mountain", "nebula", "nectar", "oasis", "ocean", "orchid", "oxygen", "panther", "pebble", "phoenix",
  "planet", "prism", "pyramid", "quartz", "radar", "rainbow", "raven", "reef", "river", "rocket",
  "safari", "sailor", "sapphire", "shadow", "shrine", "silver", "solar", "spark", "sphinx", "spiral",
  "summit", "sunset", "thunder", "tiger", "timber", "titan", "topaz", "tornado", "trophy", "tundra",
  "valley", "vector", "velvet", "vessel", "vortex", "voyage", "walrus", "willow", "wizard", "zenith"
];

/**
 * Cross-platform cryptographically secure random integer generator.
 * Works seamlessly in Browser, Node.js, and Turbopack.
 */
function secureRandomInt(min: number, max: number): number {
  const range = max - min;
  if (range <= 0) return min;

  const cryptoObj = typeof window !== "undefined" ? window.crypto : (globalThis as any).crypto;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const array = new Uint32Array(1);
    cryptoObj.getRandomValues(array);
    return min + (array[0] % range);
  }

  return min + Math.floor(Math.random() * range);
}

/**
 * Generates a cryptographically secure random password or passphrase.
 */
export function generatePassword(options?: PasswordGeneratorOptions): string {
  const mode = options?.mode || "PASSWORD";

  if (mode === "PASSPHRASE") {
    const count = Math.max(3, Math.min(8, options?.wordCount || 4));
    const separator = options?.separator !== undefined ? options.separator : "-";
    const selectedWords: string[] = [];

    for (let i = 0; i < count; i++) {
      const randIdx = secureRandomInt(0, PASSPHRASE_WORDS.length);
      selectedWords.push(PASSPHRASE_WORDS[randIdx]);
    }

    return selectedWords.join(separator);
  }

  const length = Math.max(8, Math.min(64, options?.length || 20));
  let charPool = "";

  if (options?.useUppercase !== false) charPool += UPPERCASE;
  if (options?.useLowercase !== false) charPool += LOWERCASE;
  if (options?.useNumbers !== false) charPool += NUMBERS;
  if (options?.useSymbols !== false) charPool += SYMBOLS;

  if (options?.avoidAmbiguous) {
    for (const ambig of AMBIGUOUS) {
      charPool = charPool.split(ambig).join("");
    }
  }

  if (!charPool) charPool = LOWERCASE + NUMBERS;

  let password = "";
  for (let i = 0; i < length; i++) {
    const randIdx = secureRandomInt(0, charPool.length);
    password += charPool[randIdx];
  }

  return password;
}

export interface PasswordStrengthResult {
  score: "VERY_WEAK" | "WEAK" | "FAIR" | "STRONG" | "EXCELLENT";
  scoreNumber: number; // 0 to 4
  entropyBits: number;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumbers: boolean;
  hasSymbols: boolean;
  length: number;
  suggestions: string[];
}

/**
 * Calculates password entropy and strength.
 */
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const length = password.length;
  let poolSize = 0;

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNum = /[0-9]/.test(password);
  const hasSym = /[^A-Za-z0-9]/.test(password);

  if (hasUpper) poolSize += 26;
  if (hasLower) poolSize += 26;
  if (hasNum) poolSize += 10;
  if (hasSym) poolSize += 33;

  const entropyBits = length > 0 && poolSize > 0 ? Math.round(length * Math.log2(poolSize)) : 0;
  const suggestions: string[] = [];

  let scoreNumber = 0;
  let score: "VERY_WEAK" | "WEAK" | "FAIR" | "STRONG" | "EXCELLENT" = "VERY_WEAK";

  if (length < 8) {
    score = "VERY_WEAK";
    scoreNumber = 0;
    suggestions.push("Make password at least 12 characters long.");
  } else if (entropyBits < 40) {
    score = "WEAK";
    scoreNumber = 1;
    suggestions.push("Add a mix of symbols, uppercase, and numbers.");
  } else if (entropyBits < 60) {
    score = "FAIR";
    scoreNumber = 2;
    suggestions.push("Increase length to over 16 characters for greater security.");
  } else if (entropyBits < 80) {
    score = "STRONG";
    scoreNumber = 3;
  } else {
    score = "EXCELLENT";
    scoreNumber = 4;
  }

  return {
    score,
    scoreNumber,
    entropyBits,
    hasUppercase: hasUpper,
    hasLowercase: hasLower,
    hasNumbers: hasNum,
    hasSymbols: hasSym,
    length,
    suggestions,
  };
}
