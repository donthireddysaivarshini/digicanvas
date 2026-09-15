import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Securely hashes a plaintext password using bcrypt with 12 salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== "string") {
    throw new Error("Invalid password provided for hashing.");
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a candidate plaintext password against an existing hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
