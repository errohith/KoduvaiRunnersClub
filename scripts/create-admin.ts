/** Create an admin user from the command line:
 *   npm run admin:create -- --email you@club.org --name "Your Name" --role SUPER_ADMIN
 * The password is read from the ADMIN_PASSWORD env var or prompted for (never pass it as an argument).
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { PrismaClient } from "@prisma/client";
import { hashPassword, passwordProblems } from "../src/lib/auth/password";

const prisma = new PrismaClient();
const arg = (k: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name") ?? "Admin";
  const roleKey = arg("role") ?? "SUPER_ADMIN";
  if (!email) throw new Error("--email is required");
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("Password (min 12 chars): ");
    rl.close();
  }
  const problem = passwordProblems(password);
  if (problem) throw new Error(problem);
  const role = await prisma.role.findUnique({ where: { key: roleKey } });
  if (!role) throw new Error(`Unknown role ${roleKey}. Run the seed first.`);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: await hashPassword(password), isActive: true },
    create: { email, name, passwordHash: await hashPassword(password) },
  });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: {}, create: { userId: user.id, roleId: role.id } });
  console.log(`✓ ${email} now has role ${roleKey}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
