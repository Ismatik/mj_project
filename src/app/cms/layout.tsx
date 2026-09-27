import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canBook, canUseCms, homeFor, navFor, ROLE_LABEL } from "@/lib/access";
import { requireUser } from "@/server/auth";
import { getShellData } from "@/server/shell";
import { CmsShell } from "./CmsShell";

export const metadata: Metadata = { title: "CMS · Mavzunai Jovid", robots: { index: false } };

// Shell only. Every page and action checks access again for itself.
export default async function CmsLayout({ children }: LayoutProps<"/cms">) {
  const user = await requireUser("/cms");
  if (!canUseCms(user.role)) redirect(homeFor(user.role));
  const shell = await getShellData(user);

  return (
    <CmsShell
      nav={navFor(user.role).map((g) => ({ label: g.label, items: g.items.map(({ id, label, path }) => ({ id, label, path })) }))}
      counts={shell.counts}
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      branch={shell.branch}
      dateLabel={shell.dateLabel}
      canBook={canBook(user.role)}
    >
      {children}
    </CmsShell>
  );
}
