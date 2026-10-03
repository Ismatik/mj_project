import { Avatar } from "@/components/ui/Avatar";
import { PageHead } from "@/components/ui/Headings";
import { canSeeRevenue } from "@/lib/access";
import { somoni } from "@/lib/format";
import { requirePage } from "@/server/auth";
import { getStaffBoard } from "@/server/staff";
import { BotLink } from "./BotLink";
import { WorkDays } from "./WorkDays";
import s from "./staff.module.css";

// "Мастера и график" - design isStaff.
export default async function StaffPage() {
  const user = await requirePage("staff", "/cms/staff");
  const board = await getStaffBoard();
  const owner = user.role === "OWNER";

  return (
    <div>
      <PageHead title="Мастера и график" meta={owner ? "Нажмите на день, чтобы сделать его рабочим или выходным" : undefined} />
      <div className={s.grid}>
        {board.staff.map((m) => (
          <article key={m.id} className={s.card}>
            <div className={s.who}>
              <Avatar name={m.name} size="lg" />
              <div>
                <div className={s.name}>{m.name}</div>
                <div className={s.title}>{m.title}</div>
              </div>
            </div>
            <WorkDays staffId={m.id} name={m.name} days={m.workDays} editable={owner} />
            <div className={s.load}>
              <div className={s.loadLabel}>
                <span>Загрузка недели</span>
                <b>{m.load}%</b>
              </div>
              <div className={s.track}>
                <div className={s.fill} style={{ width: `${m.load}%` }} />
              </div>
            </div>
            {canSeeRevenue(user.role) && (
              <div className={s.revenue}>
                Выручка в {board.monthPrep}: <b>{somoni(m.revenue)}</b>
              </div>
            )}
            <BotLink staffId={m.id} name={m.name} chats={m.botChats} editable={owner} />
          </article>
        ))}
      </div>
    </div>
  );
}
