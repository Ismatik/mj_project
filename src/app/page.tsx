import type { Metadata } from "next";
import { Website } from "@/components/site/Website";
import { canUseSiteAdmin } from "@/lib/access";
import { bookableDates } from "@/lib/slots";
import { addDays, todayYmd } from "@/lib/time";
import { getCurrentUser } from "@/server/auth";
import { getOnlineMenu } from "@/server/online-booking";
import { getSiteContent, getSitePriceList } from "@/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getSiteContent("published");
  return {
    title: c.seo.title,
    description: c.seo.description,
    openGraph: { title: c.seo.title, description: c.seo.description, type: "website", locale: "ru_RU", images: [c.photos.hero.url] },
  };
}

// The public website. "?preview=1" shows the admin's unpublished draft to signed-in editors.
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { preview } = await searchParams;
  let showDraft = false;
  if (preview === "1") {
    const user = await getCurrentUser();
    showDraft = !!user && canUseSiteAdmin(user.role);
  }
  const content = await getSiteContent(showDraft ? "draft" : "published");
  const [prices, menu] = await Promise.all([getSitePriceList(showDraft ? content.serviceOverrides : {}), getOnlineMenu()]);
  const today = todayYmd();

  return <Website c={content} prices={prices} menu={menu} dates={bookableDates(today, 14, addDays)} today={today} preview={showDraft ? {} : undefined} />;
}
