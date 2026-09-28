"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { normalizeTemplates, type Templates } from "@/lib/messages";
import { getCurrentUser } from "@/server/auth";
import { TEMPLATES_SETTING } from "@/server/integrations/guest-messages";

export async function saveTemplates(input: Templates): Promise<{ ok: true; templates: Templates } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") return { ok: false, error: "Только для владелицы" };
  const templates = normalizeTemplates(input);
  const value = templates as unknown as Prisma.InputJsonValue;
  await db.setting.upsert({ where: { key: TEMPLATES_SETTING }, update: { value }, create: { key: TEMPLATES_SETTING, value } });
  revalidatePath("/cms/integrations/templates");
  return { ok: true, templates };
}
