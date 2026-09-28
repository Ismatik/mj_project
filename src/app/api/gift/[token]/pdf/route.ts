import { NextResponse } from "next/server";
import { localize } from "@/lib/i18n/content";
import { asLang } from "@/lib/i18n/locales";
import { giftCardByToken } from "@/server/gift-cards";
import { giftCardPdf } from "@/server/pdf/gift-card";
import { getSiteContent } from "@/server/site";

/** The certificate as a PDF (A5 landscape, with a QR code to its balance page). The token is the secret. */
export async function GET(_req: Request, ctx: RouteContext<"/api/gift/[token]/pdf">) {
  const { token } = await ctx.params;
  const card = await giftCardByToken(token);
  if (!card || card.status === "PENDING" || card.status === "CANCELLED") return NextResponse.json({ ok: false }, { status: 404 });
  const c = localize(await getSiteContent("published"), asLang(card.lang));
  const pdf = await giftCardPdf(card, { address: `${c.contacts.address}, ${c.contacts.district}`, phone: c.contacts.phone });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Mavzunai-Jovid-${card.code}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
