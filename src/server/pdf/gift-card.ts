import "server-only";
import { PDFDocument, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { dayMonthYear } from "@/lib/i18n/format";
import type { Lang } from "@/lib/i18n/locales";
import { siteUrl } from "../payments/core";
import { draw, embedFonts, wrap } from "./fonts";

// Gift certificate, A5 landscape, in MJ style: ink band with the monogram, cream field, gold rules, QR to the balance page.

const INK = rgb(0x26 / 255, 0x22 / 255, 0x1d / 255);
const CREAM = rgb(0xf2 / 255, 0xed / 255, 0xe3 / 255);
const GOLD = rgb(0xb8 / 255, 0xa0 / 255, 0x6a / 255);
const DEEP_GOLD = rgb(0x8f / 255, 0x7a / 255, 0x4b / 255);
const MUTED = rgb(0x5c / 255, 0x53 / 255, 0x44 / 255);
const ON_INK = rgb(0xd9 / 255, 0xcf / 255, 0xbb / 255);

const T: Record<Lang, { title: string; currency: string; for: string; code: string; valid: (d: string) => string; how: string; place: string }> = {
  ru: {
    title: "ПОДАРОЧНЫЙ СЕРТИФИКАТ",
    currency: "сомони",
    for: "Для",
    code: "Код сертификата",
    valid: (d) => `Действителен до ${d}`,
    how: "Назовите код администратору при оплате. Можно использовать частями.",
    place: "Салон красоты и свадебный зал · Душанбе",
  },
  tg: {
    title: "СЕРТИФИКАТИ ТӮҲФАГӢ",
    currency: "сомонӣ",
    for: "Барои",
    code: "Рамзи сертификат",
    valid: (d) => `Эътибор дорад то ${d}`,
    how: "Ҳангоми пардохт рамзро ба маъмур гӯед. Метавон қисм-қисм истифода кард.",
    place: "Салони зебоӣ ва толори тӯй · Душанбе",
  },
  en: {
    title: "GIFT CERTIFICATE",
    currency: "TJS",
    for: "For",
    code: "Certificate code",
    valid: (d) => `Valid until ${d}`,
    how: "Tell the code to reception when you pay. It can be used in parts.",
    place: "Beauty salon & wedding hall · Dushanbe",
  },
};

export async function giftCardPdf(
  card: { code: string; token: string; amount: number; recipientName: string; message: string | null; expiresAt: Date; lang: string },
  contacts: { address: string; phone: string },
): Promise<Uint8Array> {
  const lang = (["ru", "tg", "en"].includes(card.lang) ? card.lang : "ru") as Lang;
  const t = T[lang];
  const doc = await PDFDocument.create();
  doc.setTitle(`Mavzunai Jovid — ${t.title.toLowerCase()} ${card.code}`);
  doc.setAuthor("Mavzunai Jovid — Gallery of Beauty MJ");
  const f = await embedFonts(doc);
  const W = 595.28;
  const H = 419.53;
  const page = doc.addPage([W, H]);
  const BAND = 190;

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM });
  page.drawRectangle({ x: 0, y: 0, width: BAND, height: H, color: INK });
  page.drawRectangle({ x: BAND + 14, y: 14, width: W - BAND - 28, height: H - 28, borderColor: GOLD, borderWidth: 0.8 });

  // Monogram: square frame, MJ, MAVZUNAI JOVID
  const cx = BAND / 2;
  page.drawRectangle({ x: cx - 44, y: H - 170, width: 88, height: 76, borderColor: CREAM, borderWidth: 2.2 });
  draw(page, "MJ", { x: cx, y: H - 146, size: 38, font: f.serif, color: CREAM, align: "center" });
  draw(page, "MAVZUNAI JOVID", { x: cx, y: H - 196, size: 9, font: f.sans, color: CREAM, align: "center", spacing: 2.2 });
  draw(page, "GALLERY OF BEAUTY", { x: cx, y: H - 211, size: 7, font: f.sans, color: ON_INK, align: "center", spacing: 2.4 });
  page.drawRectangle({ x: cx - 16, y: H - 232, width: 32, height: 1.5, color: GOLD });
  for (const [i, line] of wrap(t.place, f.sans, 8, BAND - 40).entries()) {
    draw(page, line, { x: cx, y: 64 - i * 12, size: 8, font: f.sans, color: ON_INK, align: "center" });
  }
  draw(page, contacts.phone, { x: cx, y: 34, size: 8.5, font: f.sansMedium, color: CREAM, align: "center", spacing: 0.5 });

  // Field
  const L = BAND + 44;
  draw(page, t.title, { x: L, y: H - 70, size: 10, font: f.sansMedium, color: DEEP_GOLD, spacing: 3 });
  const amount = new Intl.NumberFormat("ru-RU").format(card.amount).replace(/\s/g, " ");
  const aw = draw(page, amount, { x: L, y: H - 130, size: 50, font: f.serif, color: INK });
  draw(page, t.currency, { x: L + aw + 10, y: H - 130, size: 16, font: f.serif, color: INK });
  page.drawRectangle({ x: L, y: H - 150, width: 44, height: 2, color: GOLD });
  draw(page, `${t.for}: ${card.recipientName}`, { x: L, y: H - 182, size: 17, font: f.serif, color: INK });
  if (card.message) {
    for (const [i, line] of wrap(`«${card.message}»`, f.sans, 11, 290).slice(0, 4).entries()) {
      draw(page, line, { x: L, y: H - 208 - i * 15, size: 11, font: f.sans, color: MUTED });
    }
  }

  // Code, validity, how to use
  draw(page, t.code.toUpperCase(), { x: L, y: 112, size: 7.5, font: f.sans, color: DEEP_GOLD, spacing: 1.6 });
  draw(page, card.code, { x: L, y: 90, size: 19, font: f.sansMedium, color: INK, spacing: 2.5 });
  draw(page, t.valid(dayMonthYear(card.expiresAt, lang)), { x: L, y: 70, size: 9.5, font: f.sans, color: MUTED });
  for (const [i, line] of wrap(t.how, f.sans, 8.5, 210).entries()) {
    draw(page, line, { x: L, y: 50 - i * 11, size: 8.5, font: f.sans, color: MUTED });
  }
  draw(page, contacts.address, { x: W - 44, y: 26, size: 7.5, font: f.sans, color: MUTED, align: "right" });

  // QR → balance page
  const qr = await QRCode.toBuffer(`${siteUrl()}/sertifikat/${card.token}`, { margin: 0, width: 360, color: { dark: "#26221dff", light: "#f2ede3ff" }, errorCorrectionLevel: "M" });
  const img = await doc.embedPng(qr);
  page.drawImage(img, { x: W - 44 - 86, y: 44, width: 86, height: 86 });

  return doc.save();
}
