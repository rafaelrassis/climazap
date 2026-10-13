"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { LIMITS, getClientIp, rateLimit, rateLimitInfo } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validations/auth";

export type RegisterState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function loginAction(
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/inicio",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      const ip = await getClientIp();
      const email = String(formData.get("email") ?? "").toLowerCase();
      const [byEmail, byIp] = await Promise.all([
        rateLimitInfo(`login:${ip}:${email}`, LIMITS.loginEmail.limit),
        rateLimitInfo(`login:${ip}`, LIMITS.loginIp.limit),
      ]);
      const wait = Math.max(byEmail.limited ? byEmail.retryAfterSec : 0, byIp.limited ? byIp.retryAfterSec : 0);
      return wait > 0
        ? `Muitas tentativas. Tente novamente em ${Math.ceil(wait / 60)} min.`
        : "E-mail ou senha inválidos";
    }
    throw e; // NEXT_REDIRECT
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function registerAction(
  _prev: RegisterState | undefined,
  formData: FormData,
): Promise<RegisterState | undefined> {
  const reg = await rateLimit(`register:${await getClientIp()}`, LIMITS.register.limit, LIMITS.register.windowSec);
  if (!reg.ok) return { error: "Muitas tentativas. Tente novamente mais tarde." };

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Dados inválidos", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { name, email, password } = parsed.data;

  try {
    await db.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 10) },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { fieldErrors: { email: ["E-mail já cadastrado"] } };
    }
    throw e;
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/inicio" });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Conta criada. Entre pelo login." };
    throw e; // NEXT_REDIRECT
  }
}
