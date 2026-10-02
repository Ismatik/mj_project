import type { Metadata } from "next";
import { SitePage } from "@/components/site/SiteChrome";
import { localize } from "@/lib/i18n/content";
import { dict } from "@/lib/i18n/dict";
import { botLink } from "@/lib/site-url";
import { bookableDates } from "@/lib/slots";
import { addDays, todayYmd } from "@/lib/time";
import { getGuestAccount } from "@/server/guest-account";
import { getCurrentGuest } from "@/server/guest-auth";
import { alternates, getLang } from "@/server/lang";
import { getSiteMasters } from "@/server/masters";
import { getSiteContent } from "@/server/site";
import { Account } from "./Account";
import { SignIn } from "./SignIn";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: dict(lang).meta.account, robots: { index: false }, alternates: alternates(lang, "/kabinet") };
}

// Guest account: sign in with a code, then upcoming bookings (move / cancel), past visits (book again), favourite master.
export default async function AccountPage() {
  const lang = await getLang();
  const [raw, guest] = await Promise.all([getSiteContent("published"), getCurrentGuest()]);
  const c = localize(raw, lang);
  const today = todayYmd();
  const page = { c, lang, path: "/kabinet", current: "account" as const, year: today.slice(0, 4) };
  if (!guest) {
    return (
      <SitePage {...page} guest={null}>
        <SignIn lang={lang} />
      </SitePage>
    );
  }
  const [account, masters] = await Promise.all([getGuestAccount(guest.id, lang), getSiteMasters(c, lang)]);
  const info = Object.fromEntries(masters.map((m) => [m.id, { slug: m.slug, title: m.title }]));
  return (
    <SitePage {...page} guest={guest}>
      <Account account={account} dates={bookableDates(today, 14, addDays)} masters={info} botLink={botLink()} lang={lang} />
    </SitePage>
  );
}

