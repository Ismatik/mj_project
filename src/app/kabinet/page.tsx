import type { Metadata } from "next";
import { SitePage } from "@/components/site/SiteChrome";
import { bookableDates } from "@/lib/slots";
import { addDays, todayYmd } from "@/lib/time";
import { getGuestAccount } from "@/server/guest-account";
import { getCurrentGuest } from "@/server/guest-auth";
import { getSiteMasters } from "@/server/masters";
import { getSiteContent } from "@/server/site";
import { Account } from "./Account";
import { SignIn } from "./SignIn";

export const metadata: Metadata = { title: "Личный кабинет — Mavzunai Jovid", robots: { index: false } };
export const dynamic = "force-dynamic";

// Guest account: sign in with a code, then upcoming bookings (move / cancel), past visits (book again), favourite master.
export default async function AccountPage() {
  const [c, guest] = await Promise.all([getSiteContent("published"), getCurrentGuest()]);
  const today = todayYmd();
  if (!guest) {
    return (
      <SitePage c={c} guest={null} current="account" year={today.slice(0, 4)}>
        <SignIn />
      </SitePage>
    );
  }
  const [account, masters] = await Promise.all([getGuestAccount(guest.id), getSiteMasters(c)]);
  const slugOf = Object.fromEntries(masters.map((m) => [m.id, m.slug]));
  return (
    <SitePage c={c} guest={guest} current="account" year={today.slice(0, 4)}>
      <Account account={account} dates={bookableDates(today, 14, addDays)} slugOf={slugOf} botLink={botLink()} />
    </SitePage>
  );
}

/** t.me link for "подключить Telegram" (TELEGRAM_BOT_USERNAME, set when the bot goes live). */
function botLink(): string | null {
  const name = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim();
  return name && /^\w{5,}$/.test(name) ? `https://t.me/${name}` : null;
}
