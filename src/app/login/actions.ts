"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/access";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/server/auth";
import { clearAttempts, tooManyAttempts } from "@/server/rate-limit";

// Compared against when the login does not exist, so both cases take the same time.
let dummyHash: Promise<string> | null = null;

export type LoginState = { error?: string; login?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const loginName = String(form.get("login") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");

  if (!loginName || !password) return { error: "Введите логин и пароль", login: loginName };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${ip}:${loginName}`;
  if (tooManyAttempts(key)) return { error: "Слишком много попыток. Попробуйте через 15 минут.", login: loginName };

  const user = await db.user.findUnique({ where: { login: loginName } });
  dummyHash ??= hashPassword("not-a-real-password");
  const ok = (await verifyPassword(password, user?.passwordHash ?? (await dummyHash))) && !!user?.active;
  if (!user || !ok) return { error: "Неверный логин или пароль", login: loginName };

  clearAttempts(key);
  await createSession(user.id);
  const target = safeNext(next, user.role);
  redirect(`${target}${target.includes("?") ? "&" : "?"}welcome=1`);
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
