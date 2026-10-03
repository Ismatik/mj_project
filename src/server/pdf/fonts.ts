import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont, PDFPage, RGB } from "pdf-lib";

// Fonts for PDFs (subsets in assets/fonts, SIL Open Font License).
// Each style is a stack: the brand font first, Noto for the letters it lacks -
// Zen Old Mincho has only Latin and digits here (its Cyrillic is full-width), Jost lacks Tajik letters.
const FILES = {
  mincho: "ZenOldMincho-SemiBold-subset.ttf",
  notoSerif: "NotoSerif-Medium-subset.ttf",
  jost: "Jost-Regular-subset.ttf",
  jostMedium: "Jost-Medium-subset.ttf",
  notoSans: "NotoSans-Regular-subset.ttf",
} as const;
const DIR = path.join(process.cwd(), "assets", "fonts");

export type Stack = PDFFont[];
export type Fonts = { serif: Stack; sans: Stack; sansMedium: Stack };

const cache = new Map<string, Uint8Array>();
async function bytes(file: string) {
  if (!cache.has(file)) cache.set(file, new Uint8Array(await readFile(path.join(DIR, file))));
  return cache.get(file)!;
}

export async function embedFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const f = {} as Record<keyof typeof FILES, PDFFont>;
  for (const [key, file] of Object.entries(FILES) as [keyof typeof FILES, string][]) f[key] = await doc.embedFont(await bytes(file), { subset: true });
  return { serif: [f.mincho, f.notoSerif], sans: [f.jost, f.notoSans], sansMedium: [f.jostMedium, f.notoSans] };
}

const charsets = new WeakMap<PDFFont, Set<number>>();
const has = (font: PDFFont, cp: number) => {
  if (!charsets.has(font)) charsets.set(font, new Set(font.getCharacterSet()));
  return charsets.get(font)!.has(cp);
};

/** Splits text into runs, each drawn with the first font of the stack that has the letter. */
function runs(text: string, stack: Stack): { text: string; font: PDFFont }[] {
  const out: { text: string; font: PDFFont }[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const f = stack.find((x) => has(x, cp)) ?? stack[stack.length - 1]!;
    const last = out[out.length - 1];
    if (last && last.font === f) last.text += ch;
    else out.push({ text: ch, font: f });
  }
  return out;
}

export function textWidth(text: string, stack: Stack, size: number, spacing = 0): number {
  return runs(text, stack).reduce((w, r) => w + r.font.widthOfTextAtSize(r.text, size), 0) + spacing * Math.max(0, [...text].length - 1);
}

/** Draws text with font fallback and optional letter spacing; align relative to x. Returns the width. */
export function draw(page: PDFPage, text: string, o: { x: number; y: number; size: number; font: Stack; color: RGB; align?: "left" | "center" | "right"; spacing?: number }) {
  const w = textWidth(text, o.font, o.size, o.spacing);
  let x = o.align === "center" ? o.x - w / 2 : o.align === "right" ? o.x - w : o.x;
  for (const r of runs(text, o.font)) {
    if (o.spacing) {
      for (const ch of r.text) {
        page.drawText(ch, { x, y: o.y, size: o.size, font: r.font, color: o.color });
        x += r.font.widthOfTextAtSize(ch, o.size) + o.spacing;
      }
    } else {
      page.drawText(r.text, { x, y: o.y, size: o.size, font: r.font, color: o.color });
      x += r.font.widthOfTextAtSize(r.text, o.size);
    }
  }
  return w;
}

/** Greedy word wrap to a width */
export function wrap(text: string, stack: Stack, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && textWidth(next, stack, size) > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}
