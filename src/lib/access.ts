// Who may open what. Pure data — used by the sidebar, page guards, search and tests.

export type Role = "OWNER" | "RECEPTION" | "CONTENT" | "MASTER";

export type CmsPageId =
  | "dashboard"
  | "pos"
  | "guests"
  | "calendar"
  | "services"
  | "rental"
  | "staff"
  | "analytics"
  | "settings";

export type CmsPage = { id: CmsPageId; label: string; path: string; group: string; roles: Role[] };

export const CMS_PAGES: CmsPage[] = [
  { id: "dashboard", label: "Мой салон сегодня", path: "/cms", group: "Мой салон", roles: ["OWNER", "RECEPTION"] },
  { id: "pos", label: "Ресепшен и касса", path: "/cms/pos", group: "Мой салон", roles: ["OWNER", "RECEPTION"] },
  { id: "guests", label: "Книга гостей", path: "/cms/guests", group: "Гостьи", roles: ["OWNER", "RECEPTION"] },
  { id: "calendar", label: "Календарь записей", path: "/cms/calendar", group: "Гостьи", roles: ["OWNER", "RECEPTION", "MASTER"] },
  { id: "services", label: "Меню услуг и цены", path: "/cms/services", group: "Услуги", roles: ["OWNER", "RECEPTION", "MASTER"] },
  { id: "rental", label: "Прокат платьев", path: "/cms/rental", group: "Услуги", roles: ["OWNER", "RECEPTION"] },
  { id: "staff", label: "Мастера и график", path: "/cms/staff", group: "Команда", roles: ["OWNER", "RECEPTION", "MASTER"] },
  { id: "analytics", label: "Аналитика", path: "/cms/analytics", group: "Развитие", roles: ["OWNER"] },
  { id: "settings", label: "Настройки", path: "/cms/settings", group: "Развитие", roles: ["OWNER"] },
];

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "владелица",
  RECEPTION: "ресепшен",
  CONTENT: "контент-менеджер",
  MASTER: "мастер",
};

export function canOpen(role: Role, page: CmsPageId): boolean {
  return CMS_PAGES.find((p) => p.id === page)!.roles.includes(role);
}

export const canUseCms = (role: Role) => CMS_PAGES.some((p) => p.roles.includes(role));
export const canUseSiteAdmin = (role: Role) => role === "OWNER" || role === "CONTENT";
export const canBook = (role: Role) => role === "OWNER" || role === "RECEPTION";
export const canSeeRevenue = (role: Role) => role === "OWNER" || role === "RECEPTION";

/** Where a user lands after signing in (and where a forbidden page sends them). */
export function homeFor(role: Role): string {
  const first = CMS_PAGES.find((p) => p.roles.includes(role));
  if (first) return first.path;
  return "/admin";
}

/** Sidebar groups for a role, in design order; empty groups are dropped. */
export function navFor(role: Role) {
  const groups: { label: string; items: CmsPage[] }[] = [];
  for (const p of CMS_PAGES) {
    if (!p.roles.includes(role)) continue;
    const g = groups.find((x) => x.label === p.group);
    if (g) g.items.push(p);
    else groups.push({ label: p.group, items: [p] });
  }
  return groups;
}

/** Only same-site paths are allowed as a post-login target. */
export function safeNext(next: string | null | undefined, role: Role): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return homeFor(role);
  if (next.startsWith("/cms")) {
    const page = [...CMS_PAGES].reverse().find((p) => next === p.path || next.startsWith(p.path + "/"));
    return page && page.roles.includes(role) ? next : homeFor(role);
  }
  if (next.startsWith("/admin")) return canUseSiteAdmin(role) ? next : homeFor(role);
  if (next.startsWith("/styleguide")) return role === "OWNER" ? next : homeFor(role);
  return next;
}
