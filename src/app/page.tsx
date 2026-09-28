import type { Metadata } from "next";
import { Website } from "@/components/site/Website";
import { canUseSiteAdmin } from "@/lib/access";
import { bookableDates } from "@/lib/slots";
import { addDays, todayYmd } from "@/lib/time";
import { getCurrentUser } from "@/server/auth";
import { localize } from "@/lib/i18n/content";
import { getCurrentGuest } from "@/server/guest-auth";
import { alternates, getLang } from "@/server/lang";
import { getSiteMasters } from "@/server/masters";
import { getOnlineMenu, type OnlineMenu } from "@/server/online-booking";
import { getSiteContent, getSitePriceList } from "@/server/site";

export const dynamic = "force-dynamic";

const OG_LOCALE = { ru: "ru_RU", tg: "tg_TJ", en: "en_US" } as const;

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const c = localize(await getSiteContent("published"), lang);
  return {
    title: c.seo.title,
    description: c.seo.description,
    alternates: alternates(lang, "/"),
    openGraph: { title: c.seo.title, description: c.seo.description, type: "website", locale: OG_LOCALE[lang], images: [c.photos.hero.url] },
  };
}

/** "?service=…&master=…" (from "Записаться снова" or a master's page) → pre-selected in the booking form, if still bookable. */
function presetFrom(menu: OnlineMenu, service?: string | string[], master?: string | string[]) {
  const sv = typeof service === "string" ? menu.flatMap((c) => c.services).find((x) => x.id === service) : undefined;
  if (!sv) return undefined;
  const staffId = typeof master === "string" && sv.staff.some((m) => m.id === master) ? master : null;
  return { serviceId: sv.id, staffId };
}

// The public website. "?preview=1" shows the admin's unpublished draft to signed-in editors.
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { preview, service, master } = await searchParams;
  let showDraft = false;
  if (preview === "1") {
    const user = await getCurrentUser();
    showDraft = !!user && canUseSiteAdmin(user.role);
  }
  const lang = await getLang();
  const raw = await getSiteContent(showDraft ? "draft" : "published");
  const content = localize(raw, lang);
  const [prices, menu, masters, guest] = await Promise.all([
    getSitePriceList(showDraft ? content.serviceOverrides : {}, lang, content),
    getOnlineMenu(lang),
    getSiteMasters(content, lang),
    getCurrentGuest(),
  ]);
  const today = todayYmd();

  return (
    <Website
      c={content}
      prices={prices}
      menu={menu}
      dates={bookableDates(today, 14, addDays)}
      today={today}
      preview={showDraft ? {} : undefined}
      masters={masters}
      guest={guest}
      preset={presetFrom(menu, service, master)}
      lang={lang}
    />
  );
}
