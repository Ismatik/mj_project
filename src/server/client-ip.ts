import "server-only";
import { headers } from "next/headers";

/**
 * The visitor's address, for rate limits. Behind Caddy it is the first X-Forwarded-For entry (Caddy replaces
 * whatever the visitor sent). Behind a Cloudflare Tunnel (TRUST_CLOUDFLARE=1) Cloudflare's CF-Connecting-IP is used:
 * there the visitor could put anything at the start of X-Forwarded-For, and Cloudflare only appends to it.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  if (process.env.TRUST_CLOUDFLARE === "1") {
    const cf = h.get("cf-connecting-ip")?.trim();
    if (cf) return cf;
  }
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
