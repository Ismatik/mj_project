// Count-up parsing, ported from design/mj-fx.js: animate the number inside a label, keep prefix/suffix and grouping.

export type CountUpParts = {
  prefix: string;
  value: number;
  decimals: number;
  /** Separator used between thousands groups in the source text ("" when none). */
  group: string;
  suffix: string;
};

const NUMBER = /^(\D*?)(\d(?:[\d.,]|[\s\u00a0\u202f](?=\d))*)(.*)$/;

export function parseCountUp(text: string): CountUpParts | null {
  const m = NUMBER.exec(text);
  if (!m) return null;
  const [, prefix, raw, suffix] = m;
  const groupMatch = /\d([\s\u00a0\u202f,])\d{3}(?!\d)/.exec(raw!);
  const group = groupMatch ? groupMatch[1]! : "";
  const decimalMatch = group === "," ? /\.(\d+)$/.exec(raw!) : /[.,](\d{1,2})$/.exec(raw!);
  const decimals = decimalMatch ? decimalMatch[1]!.length : 0;
  let digits = raw!;
  if (group) digits = digits.split(group).join("");
  if (decimals) digits = digits.replace(/,(\d+)$/, ".$1");
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  return { prefix: prefix!, value, decimals, group, suffix: suffix! };
}

export function formatCountUp(parts: CountUpParts, value: number): string {
  const fixed = value.toFixed(parts.decimals);
  const [int, frac] = fixed.split(".");
  const grouped = parts.group ? int!.replace(/\B(?=(\d{3})+(?!\d))/g, parts.group) : int!;
  return parts.prefix + grouped + (frac ? "." + frac : "") + parts.suffix;
}

/** Ease-out cubic, as in the prototype. */
export const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
