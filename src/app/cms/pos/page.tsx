import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { longDate } from "@/lib/format";
import { atSalonTime, todayYmd } from "@/lib/time";
import { requirePage } from "@/server/auth";
import { getPos } from "@/server/pos";
import { isDayOpen, unclosedBefore } from "@/server/shift";
import { FoundRecord } from "../FoundRecord";
import { PosScreen } from "./PosScreen";
import m from "../money.module.css";

export default async function PosPage({ searchParams }: PageProps<"/cms/pos">) {
  const user = await requirePage("pos", "/cms/pos");
  const sp = await searchParams;
  const [data, open, unclosed] = await Promise.all([getPos(), isDayOpen(), unclosedBefore(todayYmd())]);
  const appt = typeof sp.appt === "string" ? sp.appt : undefined;
  return (
    <>
      <FoundRecord kind="sale" id={typeof sp.sale === "string" ? sp.sale : undefined} user={user} />
      {unclosed && (
        <div className={m.warn} role="note">
          Смена за {longDate(atSalonTime(unclosed, "12:00"))} не закрыта. <Link href={`/cms/pos/shift?day=${unclosed}`}>Закрыть →</Link>
        </div>
      )}
      <div className={m.bar}>
        <span className={m.muted}>{open ? "Смена открыта" : "Смена на сегодня закрыта - новые чеки попадут в отчёты, но не в Z-отчёт"}</span>
        <ButtonLink href="/cms/pos/shift" variant="outline" size="sm">
          {open ? "Закрытие смены" : "Z-отчёт"}
        </ButtonLink>
      </div>
      <PosScreen key={appt ?? "pos"} data={data} initialAppt={appt} />
    </>
  );
}
