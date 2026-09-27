import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { handleUpdate } from "@/lib/bot/engine";
import { db } from "@/lib/db";
import { answerCallback, sendReply, toBotUpdate, type TgUpdate } from "@/server/integrations/telegram-api";
import { botDeps } from "@/server/telegram/deps";

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Telegram → salon bot. Only works in live mode with TELEGRAM_WEBHOOK_SECRET set; Telegram sends it back in a header. */
export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret || !safeEqual(got, secret)) return NextResponse.json({ ok: false }, { status: 401 });

  const integration = await db.integration.findUnique({ where: { key: "telegram" } });
  if (!integration?.enabled || integration.mode !== "LIVE") return NextResponse.json({ ok: true, ignored: "telegram is not live" });

  const parsed = toBotUpdate((await request.json().catch(() => ({}))) as TgUpdate);
  if (!parsed) return NextResponse.json({ ok: true });
  if (parsed.callbackId) await answerCallback(parsed.callbackId);

  const replies = await handleUpdate(parsed.update, botDeps());
  for (const r of replies) await sendReply(parsed.update.chatId, r);
  revalidatePath("/cms", "layout");
  return NextResponse.json({ ok: true });
}
