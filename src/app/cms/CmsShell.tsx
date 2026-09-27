"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Monogram } from "@/components/ui/Monogram";
import { Button } from "@/components/ui/Button";
import type { CmsPage } from "@/lib/access";
import { logout } from "../login/actions";
import { EntryLoader } from "./EntryLoader";
import { NewBooking } from "./NewBooking";
import { SearchBox } from "./SearchBox";
import s from "./cms.module.css";

type Props = {
  nav: { label: string; items: Pick<CmsPage, "id" | "label" | "path">[] }[];
  counts: Record<string, number>;
  user: { name: string; roleLabel: string };
  branch: string;
  dateLabel: string;
  canBook: boolean;
  children: ReactNode;
};

function isActive(pathname: string, path: string) {
  return path === "/cms" ? pathname === "/cms" : pathname === path || pathname.startsWith(path + "/");
}

export function CmsShell({ nav, counts, user, branch, dateLabel, canBook, children }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);

  // Close the mobile menu after navigating
  useEffect(() => {
    const close = () => setMenuOpen(false);
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, []);

  return (
    <div className={s.shell}>
      <Suspense>
        <EntryLoader />
      </Suspense>

      <aside className={`${s.sidebar} ${menuOpen ? s.sidebarOpen : ""}`} aria-label="Разделы CMS">
        <Link href="/cms" className={s.brand} onClick={() => setMenuOpen(false)}>
          <Monogram size={36} />
          <div>
            <div className={s.brandName}>Mavzunai Jovid</div>
            <div className={s.brandTag}>gallery of beauty mj</div>
          </div>
        </Link>
        <nav className={s.nav}>
          {nav.map((group) => (
            <div key={group.label}>
              <div className={s.navGroup}>{group.label}</div>
              {group.items.map((item) => {
                const active = isActive(pathname, item.path);
                return (
                  <Link
                    key={item.id}
                    href={item.path}
                    className={`${s.navItem} ${active ? s.navItemActive : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span>{item.label}</span>
                    {counts[item.id] ? <span className={s.navCount}>{counts[item.id]}</span> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className={s.userBox}>
          <div>
            <div className={s.userName}>
              {user.name} — {user.roleLabel}
            </div>
            <div className={s.userDate}>{dateLabel}</div>
          </div>
          <div className={s.userActions}>
            <Link href="/cms/account" className={s.logout} onClick={() => setMenuOpen(false)}>
              Пароль
            </Link>
            <form action={logout}>
              <button type="submit" className={s.logout}>
                Выйти
              </button>
            </form>
          </div>
        </div>
      </aside>
      {menuOpen && <button className={s.backdrop} aria-label="Закрыть меню" onClick={() => setMenuOpen(false)} />}

      <div className={s.main}>
        <header className={s.header}>
          <button className={s.burger} aria-label="Меню" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Menu size={18} />
          </button>
          <SearchBox />
          <div className={s.spacer} />
          <span className={s.branch}>{branch}</span>
          {canBook && (
            <>
              <Button className={s.newLong} onClick={() => setBookingOpen(true)}>
                + Новая запись
              </Button>
              <Button className={s.newShort} onClick={() => setBookingOpen(true)} aria-label="Новая запись">
                +
              </Button>
            </>
          )}
        </header>
        <main className={s.content}>{children}</main>
      </div>

      {canBook && <NewBooking open={bookingOpen} onClose={() => setBookingOpen(false)} />}
    </div>
  );
}
