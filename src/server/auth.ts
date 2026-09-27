import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { canOpen, canUseSiteAdmin, homeFor, type CmsPageId, type Role } from "@/lib/access";
import { db } from "@/lib/db";

// Database sessions: the cookie holds a random token, the database stores only its hash.

export const SESSION_COOKIE = "mj_session";
const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type CurrentUser = { id: string; name: string; login: string; role: Role; staffId: string | null };

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Memoised per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  const { id, name, login, role, staffId } = session.user;
  return { id, name, login, role, staffId };
});

/** Any signed-in user; otherwise to the login page. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

/** Guard for a CMS page: signed in and allowed by role. */
export async function requirePage(page: CmsPageId, path: string): Promise<CurrentUser> {
  const user = await requireUser(path);
  if (!canOpen(user.role, page)) redirect(homeFor(user.role));
  return user;
}

export async function requireSiteAdmin(): Promise<CurrentUser> {
  const user = await requireUser("/admin");
  if (!canUseSiteAdmin(user.role)) redirect(homeFor(user.role));
  return user;
}

export async function requireRole(roles: Role[], path: string): Promise<CurrentUser> {
  const user = await requireUser(path);
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}
