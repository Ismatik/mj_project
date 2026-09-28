import "server-only";
import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import { draw, embedFonts, textWidth, wrap, type Fonts, type Stack } from "./fonts";

// Business reports on A4 in MJ style: brand line, title, key figures, tables that continue
// on the next page with their header, page numbers. Used by the Z-report, payroll and period reports.

const INK = rgb(0x26 / 255, 0x22 / 255, 0x1d / 255);
const GOLD = rgb(0xb8 / 255, 0xa0 / 255, 0x6a / 255);
const DEEP_GOLD = rgb(0x8f / 255, 0x7a / 255, 0x4b / 255);
const MUTED = rgb(0x5c / 255, 0x53 / 255, 0x44 / 255);
const LINE = rgb(0xdd / 255, 0xd3 / 255, 0xbf / 255);
const BAND = rgb(0xf4 / 255, 0xef / 255, 0xe6 / 255);

export type ReportColumn = { header: string; width: number; align?: "left" | "right" };

/** The fonts have no minus sign or narrow spaces; use what they have */
const clean = (s: string) => s.replace(/−/g, "–").replace(/[  ]/g, " ");

export class ReportPdf {
  private page!: PDFPage;
  private y = 0;
  private constructor(
    private doc: PDFDocument,
    private f: Fonts,
    private W: number,
    private H: number,
    private title: string,
    private generated: string,
  ) {}

  static async create(o: { title: string; subtitle?: string; generated: string; landscape?: boolean }) {
    const doc = await PDFDocument.create();
    doc.setTitle(`Mavzunai Jovid — ${o.title}`);
    doc.setAuthor("Mavzunai Jovid — Gallery of Beauty MJ");
    const [W, H] = o.landscape ? [841.89, 595.28] : [595.28, 841.89];
    const r = new ReportPdf(doc, await embedFonts(doc), W, H, o.title, o.generated);
    r.newPage();
    draw(r.page, clean(o.title), { x: M, y: r.y - 22, size: 22, font: r.f.serif, color: INK });
    r.y -= 34;
    if (o.subtitle) {
      draw(r.page, clean(o.subtitle), { x: M, y: r.y - 10, size: 11, font: r.f.sans, color: MUTED });
      r.y -= 18;
    }
    r.y -= 10;
    return r;
  }

  private newPage() {
    this.page = this.doc.addPage([this.W, this.H]);
    const top = this.H - M;
    draw(this.page, "MAVZUNAI JOVID", { x: M, y: top - 8, size: 8, font: this.f.sansMedium, color: DEEP_GOLD, spacing: 2.2 });
    draw(this.page, clean(this.title), { x: this.W - M, y: top - 8, size: 8, font: this.f.sans, color: MUTED, align: "right" });
    this.page.drawLine({ start: { x: M, y: top - 15 }, end: { x: this.W - M, y: top - 15 }, thickness: 0.6, color: GOLD });
    this.y = top - 30;
  }

  private need(h: number) {
    if (this.y - h < M + 24) this.newPage();
  }

  get width() {
    return this.W - 2 * M;
  }

  heading(text: string) {
    this.need(40);
    this.y -= 8;
    draw(this.page, clean(text).toUpperCase(), { x: M, y: this.y - 10, size: 9.5, font: this.f.sansMedium, color: DEEP_GOLD, spacing: 1.4 });
    this.y -= 22;
  }

  paragraph(text: string, size = 9.5) {
    for (const line of wrap(clean(text), this.f.sans, size, this.width)) {
      this.need(size + 5);
      draw(this.page, line, { x: M, y: this.y - size, size, font: this.f.sans, color: MUTED });
      this.y -= size + 5;
    }
    this.y -= 4;
  }

  /** Key figures in boxes, several per row */
  figures(items: { label: string; value: string; strong?: boolean }[], perRow = 4) {
    const gap = 8;
    const w = (this.width - gap * (perRow - 1)) / perRow;
    const h = 46;
    for (let i = 0; i < items.length; i += perRow) {
      this.need(h + gap);
      items.slice(i, i + perRow).forEach((it, k) => {
        const x = M + k * (w + gap);
        this.page.drawRectangle({ x, y: this.y - h, width: w, height: h, color: it.strong ? INK : BAND, borderColor: LINE, borderWidth: it.strong ? 0 : 0.6 });
        const labelColor = it.strong ? rgb(0.85, 0.81, 0.73) : DEEP_GOLD;
        draw(this.page, fit(clean(it.label).toUpperCase(), this.f.sans, 7, w - 16), { x: x + 8, y: this.y - 14, size: 7, font: this.f.sans, color: labelColor, spacing: 0.6 });
        draw(this.page, fit(clean(it.value), this.f.serif, 15, w - 16), { x: x + 8, y: this.y - 36, size: 15, font: this.f.serif, color: it.strong ? rgb(0.97, 0.95, 0.9) : INK });
      });
      this.y -= h + gap;
    }
    this.y -= 6;
  }

  /** Label … value lines (like a till receipt) */
  lines(items: { label: string; value: string; bold?: boolean }[], width = this.width) {
    for (const it of items) {
      this.need(16);
      const font = it.bold ? this.f.sansMedium : this.f.sans;
      draw(this.page, clean(it.label), { x: M, y: this.y - 10, size: 10, font, color: INK });
      draw(this.page, clean(it.value), { x: M + width, y: this.y - 10, size: 10, font, color: INK, align: "right" });
      this.page.drawLine({ start: { x: M, y: this.y - 14 }, end: { x: M + width, y: this.y - 14 }, thickness: 0.4, color: LINE });
      this.y -= 17;
    }
    this.y -= 6;
  }

  /** A table; widths are shares of the page width. Long text is cut with "…". */
  table(columns: ReportColumn[], rows: string[][], o: { totals?: string[]; size?: number; empty?: string } = {}) {
    const size = o.size ?? 8.5;
    const rowH = size + 8;
    const total = columns.reduce((s, c) => s + c.width, 0);
    const xs: { x: number; w: number }[] = [];
    let x = M;
    for (const c of columns) {
      const w = (c.width / total) * this.width;
      xs.push({ x, w });
      x += w;
    }
    const header = () => {
      this.page.drawRectangle({ x: M, y: this.y - rowH - 2, width: this.width, height: rowH + 2, color: BAND });
      columns.forEach((c, i) => this.cell(clean(c.header), xs[i]!, c.align, this.f.sansMedium, size - 0.5, DEEP_GOLD, this.y - rowH + 3));
      this.page.drawLine({ start: { x: M, y: this.y - rowH - 2 }, end: { x: M + this.width, y: this.y - rowH - 2 }, thickness: 0.6, color: GOLD });
      this.y -= rowH + 4;
    };
    this.need(rowH * 3);
    header();
    if (!rows.length && o.empty) {
      draw(this.page, clean(o.empty), { x: M + 4, y: this.y - size - 2, size, font: this.f.sans, color: MUTED });
      this.y -= rowH;
    }
    for (const row of rows) {
      if (this.y - rowH < M + 24) {
        this.newPage();
        header();
      }
      columns.forEach((c, i) => this.cell(clean(row[i] ?? ""), xs[i]!, c.align, this.f.sans, size, INK, this.y - size - 2));
      this.page.drawLine({ start: { x: M, y: this.y - rowH + 1 }, end: { x: M + this.width, y: this.y - rowH + 1 }, thickness: 0.3, color: LINE });
      this.y -= rowH;
    }
    if (o.totals) {
      this.need(rowH + 4);
      this.page.drawLine({ start: { x: M, y: this.y }, end: { x: M + this.width, y: this.y }, thickness: 0.8, color: INK });
      columns.forEach((c, i) => this.cell(clean(o.totals![i] ?? ""), xs[i]!, c.align, this.f.sansMedium, size, INK, this.y - size - 3));
      this.y -= rowH + 2;
    }
    this.y -= 10;
  }

  private cell(text: string, col: { x: number; w: number }, align: "left" | "right" | undefined, font: Stack, size: number, color: ReturnType<typeof rgb>, y: number) {
    const pad = 4;
    const t = fit(text, font, size, col.w - 2 * pad);
    if (align === "right") draw(this.page, t, { x: col.x + col.w - pad, y, size, font, color, align: "right" });
    else draw(this.page, t, { x: col.x + pad, y, size, font, color });
  }

  /** Lines to sign at the bottom (cashier, owner, master) */
  signatures(labels: string[]) {
    this.need(60);
    this.y -= 26;
    const w = (this.width - 24 * (labels.length - 1)) / labels.length;
    labels.forEach((l, i) => {
      const x = M + i * (w + 24);
      this.page.drawLine({ start: { x, y: this.y }, end: { x: x + w, y: this.y }, thickness: 0.6, color: INK });
      draw(this.page, clean(l), { x, y: this.y - 11, size: 8, font: this.f.sans, color: MUTED });
    });
    this.y -= 24;
  }

  async save(): Promise<Uint8Array> {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => {
      draw(p, clean(`Сформировано ${this.generated}`), { x: M, y: M - 6, size: 7.5, font: this.f.sans, color: MUTED });
      draw(p, `${i + 1} / ${pages.length}`, { x: this.W - M, y: M - 6, size: 7.5, font: this.f.sans, color: MUTED, align: "right" });
    });
    return this.doc.save();
  }
}

const M = 40;

/** Cuts text to a width with an ellipsis */
function fit(text: string, font: Stack, size: number, width: number): string {
  if (textWidth(text, font, size) <= width) return text;
  const chars = [...text];
  while (chars.length && textWidth(chars.join("") + "…", font, size) > width) chars.pop();
  return chars.join("") + "…";
}
