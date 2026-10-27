import bcrypt from "bcryptjs";

const COST = 12;
export const hashPassword = (pw: string) => bcrypt.hash(pw, COST);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

// Used to equalise timing when the account does not exist.
export const DUMMY_HASH = "$2b$12$WqPy/6lzUyzUgPmJ7OcerOnMvnh2yOd31fzgOuZJXOdfwikm0Yh1q";

export function passwordProblems(pw: string): string | null {
  if (pw.length < 12) return "Password must be at least 12 characters.";
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Password must contain letters and numbers.";
  return null;
}
