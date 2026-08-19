// POST /auth/signup — Section 5, governed by Section 2 (Auth & Accounts).
// Uses the unit-tested user-service (signup) + validation + session helpers.
// Prisma + cookie I/O run only in the Next.js server runtime (not offline-tested);
// the core rules (uniqueness, hashing, credential handling) ARE unit-tested.
import { errorResponse, json, parseJson } from "@/lib/http";
import { validateSignup, orThrow } from "@/lib/validation";
import { signup } from "@/lib/auth/user-service";
import { prismaUserRepository } from "@/lib/auth/prisma-user-repository";
import { startSession } from "@/lib/auth/current-user";

export async function POST(req: Request): Promise<Response> {
  try {
    const input = orThrow(validateSignup(await parseJson(req)));
    const user = await signup(prismaUserRepository, input);
    await startSession(user);
    return json({ id: user.id, email: user.email }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
