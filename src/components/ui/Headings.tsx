import type { ReactNode } from "react";
import s from "./ui.module.css";

export function Kicker({ children }: { children: ReactNode }) {
  return <div className={s.kicker}>{children}</div>;
}

/** Page title with a thin rule, e.g. "Книга гостей · 312 гостий". */
export function PageHead({ title, meta }: { title: ReactNode; meta?: ReactNode }) {
  return (
    <div className={s.pageHead}>
      <h1 className={s.pageTitle}>{title}</h1>
      {meta && <span className={s.pageMeta}>{meta}</span>}
    </div>
  );
}

/** Section heading with the strong gold rule, optional icon and action on the right. */
export function SectionHead({ title, icon, action }: { title: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className={s.sectionHead}>
      <h2 className={s.sectionTitle}>
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}

export const sectionActionClass = s.sectionAction;
