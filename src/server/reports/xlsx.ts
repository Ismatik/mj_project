// A small Excel (.xlsx) writer: a few sheets of typed columns, a bold header, totals and frozen panes.
// No dependency — an .xlsx is a ZIP of XML files; Node's zlib does the compression and CRC.
import { crc32, deflateRawSync } from "node:zlib";

export type Cell = string | number | Date | null | undefined;
export type ColumnType = "text" | "money" | "number" | "percent" | "date" | "datetime";
export type Column = { header: string; width?: number; type?: ColumnType };
export type Sheet = {
  name: string;
  /** Heading rows above the table */
  title?: string;
  subtitle?: string;
  columns: Column[];
  rows: Cell[][];
  /** Bold row under the table */
  totals?: Cell[];
};

// Style ids in styles.xml
const S = { text: 0, header: 1, money: 2, number: 3, percent: 4, date: 5, datetime: 6, title: 7, subtitle: 8, bold: 9, boldMoney: 10, boldNumber: 11 } as const;
const SALON_OFFSET_MS = 5 * 3600_000; // Dushanbe, UTC+5 all year

const esc = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function colName(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Excel's day number for a moment, in salon time */
const serial = (d: Date) => (d.getTime() + SALON_OFFSET_MS) / 864e5 + 25569;

function cell(ref: string, v: Cell, style: number): string {
  if (v === null || v === undefined || v === "") return style ? `<c r="${ref}" s="${style}"/>` : "";
  if (v instanceof Date) return `<c r="${ref}" s="${style}"><v>${serial(v)}</v></c>`;
  if (typeof v === "number") return Number.isFinite(v) ? `<c r="${ref}" s="${style}"><v>${v}</v></c>` : "";
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

function styleFor(type: ColumnType | undefined, bold: boolean): number {
  if (bold) return type === "money" ? S.boldMoney : type === "number" ? S.boldNumber : S.bold;
  return type === "money" ? S.money : type === "number" ? S.number : type === "percent" ? S.percent : type === "date" ? S.date : type === "datetime" ? S.datetime : S.text;
}

function sheetXml(sh: Sheet): string {
  const rows: string[] = [];
  let r = 1;
  if (sh.title) rows.push(`<row r="${r}">${cell(`A${r++}`, sh.title, S.title)}</row>`);
  if (sh.subtitle) rows.push(`<row r="${r}">${cell(`A${r++}`, sh.subtitle, S.subtitle)}</row>`);
  if (sh.title || sh.subtitle) r++; // blank line
  const headerRow = r;
  rows.push(`<row r="${r}">${sh.columns.map((c, i) => cell(`${colName(i)}${r}`, c.header, S.header)).join("")}</row>`);
  r++;
  for (const row of sh.rows) {
    rows.push(`<row r="${r}">${sh.columns.map((c, i) => cell(`${colName(i)}${r}`, row[i], styleFor(c.type, false))).join("")}</row>`);
    r++;
  }
  if (sh.totals) rows.push(`<row r="${r}">${sh.columns.map((c, i) => cell(`${colName(i)}${r}`, sh.totals![i], styleFor(c.type, true))).join("")}</row>`);
  const last = colName(Math.max(0, sh.columns.length - 1));
  const cols = sh.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 14}" customWidth="1"/>`).join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${cols}</cols><sheetData>${rows.join("")}</sheetData>` +
    (sh.rows.length ? `<autoFilter ref="A${headerRow}:${last}${headerRow + sh.rows.length}"/>` : "") +
    `<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>` +
    `</worksheet>`
  );
}

function xf(numFmt: number, font: number, fill = 0, border = 0, inner = ""): string {
  const a = `numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0"${numFmt ? ' applyNumberFormat="1"' : ""}${font ? ' applyFont="1"' : ""}${fill ? ' applyFill="1"' : ""}${border ? ' applyBorder="1"' : ""}`;
  return inner ? `<xf ${a} applyAlignment="1">${inner}</xf>` : `<xf ${a}/>`;
}

const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="dd.mm.yyyy"/><numFmt numFmtId="166" formatCode="dd.mm.yyyy hh:mm"/></numFmts>` +
  `<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF7A6A55"/><name val="Calibri"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1ECE2"/></patternFill></fill></fills>` +
  `<borders count="2"><border/><border><bottom style="thin"><color rgb="FFB8A07A"/></bottom></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="12">` +
  [
    xf(0, 0), // text
    xf(0, 1, 2, 1, `<alignment wrapText="1" vertical="center"/>`), // header
    xf(164, 0), // money
    xf(1, 0), // number (plain: receipt numbers, counts)
    xf(9, 0), // percent
    xf(165, 0), // date
    xf(166, 0), // datetime
    xf(0, 2), // title
    xf(0, 3), // subtitle
    xf(0, 1), // bold
    xf(164, 1), // bold money
    xf(1, 1), // bold number
  ].join("") +
  `</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/** Sheet names: at most 31 characters, none of []:*?/\ and unique */
function sheetNames(sheets: Sheet[]): string[] {
  const used = new Set<string>();
  return sheets.map((s, i) => {
    let n = s.name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || `Лист ${i + 1}`;
    while (used.has(n)) n = `${n.slice(0, 28)} ${i + 1}`;
    used.add(n);
    return n;
  });
}

export function xlsx(sheets: Sheet[]): Buffer {
  const names = sheetNames(sheets);
  const files: [string, string][] = [
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
        `</Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
        names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
        `</sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    ["xl/styles.xml", STYLES],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)] as [string, string]),
  ];
  return zip(files.map(([name, text]) => ({ name, data: Buffer.from(text, "utf8") })));
}

/** A plain ZIP archive (deflate), enough for Office files */
export function zip(files: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  // DOS time: 1 Jan 2026 00:00 — fixed, so the same data gives the same file
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const packed = deflateRawSync(f.data);
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, packed);

    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt16LE(dosTime, 12);
    c.writeUInt16LE(dosDate, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(packed.length, 20);
    c.writeUInt32LE(f.data.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += local.length + name.length + packed.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, end]);
}
