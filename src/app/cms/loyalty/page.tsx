import { PageHead, SectionHead } from "@/components/ui/Headings";
import { StatGrid } from "@/components/ui/StatCard";
import { somoni } from "@/lib/format";
import { todayYmd } from "@/lib/time";
import { requirePage } from "@/server/auth";
import { getLoyaltyPage } from "@/server/loyalty/admin";
import { Promotions, RulesForm } from "./LoyaltyForms";
import s from "./loyalty.module.css";

// Bonus program rules and promotions / promo codes.
export default async function LoyaltyPage() {
  await requirePage("loyalty", "/cms/loyalty");
  const d = await getLoyaltyPage();
  return (
    <div>
      <PageHead title="Бонусы и акции" meta="1 бонус = 1 сомони · начисляются с оплаченных денег, списываются на кассе" />
      <StatGrid
        stats={[
          { label: "Бонусов на счетах гостей", value: somoni(d.stats.outstanding), sub: `у ${d.stats.members} гостей`, dark: true },
          { label: "Начислено за 30 дней", value: somoni(d.stats.earned30) },
          { label: "Списано за 30 дней", value: somoni(d.stats.spent30) },
        ]}
      />
      <div className={s.grid}>
        <section className={s.panel} aria-labelledby="rules">
          <SectionHead title={<span id="rules">Бонусная программа</span>} />
          <RulesForm initial={d.rules} />
        </section>
        <section className={s.panel} aria-labelledby="promos">
          <SectionHead title={<span id="promos">Акции и промокоды</span>} />
          <p className={s.muted}>
            Акция без промокода применяется сама: в онлайн-записи, в боте и в кассе — к услугам и датам акции. Промокод работает, когда его вводят при записи или на
            кассе. Отмеченные «на сайте» показываются в разделе «Акции».
          </p>
          <Promotions promotions={d.promotions} services={d.services} today={todayYmd()} />
        </section>
      </div>
    </div>
  );
}
