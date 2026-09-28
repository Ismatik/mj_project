import Link from "next/link";
import { dict } from "@/lib/i18n/dict";
import { localePath, type Lang } from "@/lib/i18n/locales";
import type { SiteMaster } from "@/server/masters";
import { Photo } from "./Photo";
import s from "./site.module.css";

/** Portrait card linking to the master's page. Without a photo: the MJ square with her initial. */
export function MasterCard({ m, favourite, lang }: { m: Pick<SiteMaster, "slug" | "name" | "title" | "photo" | "portfolio">; favourite?: boolean; lang: Lang }) {
  const t = dict(lang);
  return (
    <Link href={localePath(lang, `/mastera/${m.slug}`)} data-reveal className={s.masterCard}>
      <div className={`${s.photoBox} ${s.masterPhoto}`}>
        {m.photo?.url ? (
          <Photo photo={{ url: m.photo.url }} alt={m.name} parallax={false} />
        ) : (
          <div className={s.masterMono} aria-hidden="true">
            <span>{m.name.trim()[0]}</span>
          </div>
        )}
        {favourite && <span className={s.favBadge}>{t.masters.yours}</span>}
      </div>
      <div className={s.masterName}>{m.name}</div>
      <div className={s.masterTitle}>{m.title}</div>
      {m.portfolio.length > 0 && <div className={s.masterWorks}>{t.masters.worksCount(m.portfolio.length)}</div>}
    </Link>
  );
}
