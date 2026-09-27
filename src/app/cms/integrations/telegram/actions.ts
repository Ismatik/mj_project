"use server";

import { revalidatePath } from "next/cache";
import { handleUpdate, type BotReply } from "@/lib/bot/engine";
import { canOpen } from "@/lib/access";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth";
import { botDeps } from "@/server/telegram/deps";

async function simChat() {
  const user = await getCurrentUser();
  if (!user || !canOpen(user.role, "integrations")) throw new Error("Нет доступа");
  return { chatId: `sim-${user.id}`, firstName: user.name.split(" ")[0] };
}

/** Sends one message or button press to the bot as a simulated guest and returns its replies. */
export async function simulate(input: { text?: string; data?: string; contactPhone?: string }): Promise<BotReply[]> {
  const { chatId, firstName } = await simChat();
  const replies = await handleUpdate(
    {
      chatId,
      firstName,
      text: input.text ? String(input.text).slice(0, 500) : undefined,
      data: input.data ? String(input.data).slice(0, 64) : undefined,
      contactPhone: input.contactPhone ? String(input.contactPhone).slice(0, 30) : undefined,
    },
    botDeps(),
  );
  revalidatePath("/cms", "layout");
  return replies;
}

/** Forgets the simulated chat (and its link to a guest). Bookings stay. */
export async function resetSimulator() {
  const { chatId } = await simChat();
  await db.telegramChat.deleteMany({ where: { id: chatId } });
}
