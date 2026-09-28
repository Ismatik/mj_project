import type { Metadata } from "next";
import { ROLE_LABEL } from "@/lib/access";
import { requireSiteAdmin } from "@/server/auth";
import { getMastersForAdmin } from "@/server/masters";
import { getServicesForAdmin, getSiteDocuments } from "@/server/site";
import { AdminApp } from "./AdminApp";

export const metadata: Metadata = { title: "Админка сайта · Mavzunai Jovid", robots: { index: false } };
export const dynamic = "force-dynamic";

// Site admin — design/Site Admin.dc.html. Edits autosave to a draft; "Опубликовать" makes them live.
export default async function AdminPage() {
  const user = await requireSiteAdmin();
  const [docs, services, team] = await Promise.all([getSiteDocuments(), getServicesForAdmin(), getMastersForAdmin()]);
  return (
    <AdminApp
      draft={docs.draft}
      published={docs.published}
      services={services.map((x) => ({ id: x.id, name: x.name, price: x.price, durationMin: x.durationMin, showOnSite: x.showOnSite, category: x.category.name }))}
      staff={team.staff}
      categories={team.categories}
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role], isOwner: user.role === "OWNER" }}
    />
  );
}
