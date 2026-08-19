// POST /auth/login — Section 5, governed by Section 2 (Auth & Accounts).
// Unknown email and wrong password both return 401 (no user enumeration).
import { errorResponse, json, parseJson } from "@/lib/http";
import { validateLogin, orThrow } from "@/lib/validation";
import { login } from "@/lib/auth/user-service";
import { prismaUserRepository } from "@/lib/auth/prisma-user-repository";
import { startSession } from "@/lib/auth/current-user";

export async function POST(req: Request): Promise<Response> {
  try {
    const input = orThrow(validateLogin(await parseJson(req)));
    const user = await login(prismaUserRepository, input);
    await startSession(user);
    return json({ id: user.id, email: user.email });
  } catch (err) {
    return errorResponse(err);
  }
}
