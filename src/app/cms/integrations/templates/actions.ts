"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { normalizeTemplates, type Templates } from "@/lib/messages";
import { getCurrentUser } from "@/server/auth";
import { metaTemplates } from "@/lib/whatsapp-templates";
import { TEMPLATES_SETTING } from "@/server/integrations/guest-messages";
import { waCreateTemplate } from "@/server/integrations/whatsapp-api";

export async function saveTemplates(input: Templates): Promise<{ ok: true; templates: Templates } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") return { ok: false, error: "Только для владелицы" };
  const templates = normalizeTemplates(input);
  const value = templates as unknown as Prisma.InputJsonValue;
  await db.setting.upsert({ where: { key: TEMPLATES_SETTING }, update: { value }, create: { key: TEMPLATES_SETTING, value } });
  revalidatePath("/cms/integrations/templates");
  return { ok: true, templates };
}

/** Sends every WhatsApp template (Russian and English) to Meta for approval. */
export async function submitWhatsappTemplates(): Promise<{ ok: boolean; error?: string; results: { name: string; language: string; status: string; error?: string }[] }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") return { ok: false, error: "Только для владелицы", results: [] };
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_WABA_ID) {
    return { ok: false, error: "Добавьте WHATSAPP_TOKEN и WHATSAPP_WABA_ID в .env и перезапустите сервер.", results: [] };
  }
  const results = [];
  for (const t of metaTemplates()) {
    const r = await waCreateTemplate(t);
    results.push({ name: t.name, language: t.language, status: r.status, error: r.error });
  }
  revalidatePath("/cms/integrations/templates");
  return { ok: results.every((r) => r.status !== "ERROR"), results };
}
