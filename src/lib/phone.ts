// Tajik mobile numbers: +992 and 9 digits.

/** "98 103 11 11", "+992981031111", "8-981-03-11-11"… → "+992981031111", or null if not 9 local digits. */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("992") && d.length === 12) d = d.slice(3);
  if (d.length === 10 && d.startsWith("8")) d = d.slice(1);
  return d.length === 9 ? `+992${d}` : null;
}

/** "+992935012214" → "+992 93 501-22-14" (as written in the guest book). */
export function formatPhone(e164: string): string {
  const m = /^\+992(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  return m ? `+992 ${m[1]} ${m[2]}-${m[3]}-${m[4]}` : e164;
}

/** Digits a user typed that could be part of a phone number (for search). */
export function phoneDigits(query: string): string {
  return query.replace(/\D/g, "");
}
