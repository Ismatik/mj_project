import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { xlsx } from "./xlsx";

/** Reads the files back out of the ZIP via the central directory */
function unzip(buf: Buffer): Record<string, string> {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString();
    const dataAt = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    out[name] = inflateRawSync(buf.subarray(dataAt, dataAt + size)).toString();
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
}

describe("xlsx", () => {
  const book = xlsx([
    {
      name: "Чеки: сентябрь/2026",
      title: "Mavzunai Jovid",
      columns: [{ header: "№" , type: "number" }, { header: "Когда", type: "datetime" }, { header: "Гостья" }, { header: "Сумма", type: "money" }],
      rows: [[1001, new Date("2026-09-28T07:30:00Z"), "Марта <VIP> & Co", 450]],
      totals: ["Итого", null, null, 450],
    },
    { name: "Мастера", columns: [{ header: "Мастер" }], rows: [] },
  ]);
  const files = unzip(book);

  it("is a ZIP with the Office parts", () => {
    expect(book.subarray(0, 2).toString()).toBe("PK");
    expect(Object.keys(files)).toEqual(["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]);
  });
  it("cleans sheet names and escapes text", () => {
    expect(files["xl/workbook.xml"]).toContain('name="Чеки  сентябрь 2026"');
    expect(files["xl/worksheets/sheet1.xml"]).toContain("Марта &lt;VIP&gt; &amp; Co");
  });
  it("writes numbers, salon-time dates and totals with styles", () => {
    const s = files["xl/worksheets/sheet1.xml"]!;
    expect(s).toContain('<c r="A4" s="3"><v>1001</v></c>');
    // 28.09.2026 12:30 in Dushanbe
    expect(s).toMatch(/<c r="B4" s="6"><v>46293\.5208333/);
    expect(s).toContain('<c r="D5" s="10"><v>450</v></c>');
    expect(s).toContain('ySplit="3"');
  });
});
