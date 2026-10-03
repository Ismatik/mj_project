import Link from "next/link";
import { PageHead, SectionHead } from "@/components/ui/Headings";
import { StatGrid } from "@/components/ui/StatCard";
import { Tag } from "@/components/ui/Tag";
import { clock, shortDate, somoni } from "@/lib/format";
import { db } from "@/lib/db";
import { inPacks, qty } from "@/lib/stock";
import { requirePage } from "@/server/auth";
import { getStockPage } from "@/server/stock";
import { ItemActions, ItemForm, NormsEditor } from "./StockForms";
import s from "../money.module.css";

const KIND: Record<string, string> = { RECEIPT: "приход", SERVICE: "услуга", WASTE: "списание", COUNT: "пересчёт" };

// Products and consumables: what's left, deliveries, write-offs per service and low-stock alerts.
export default async function StockPage({ searchParams }: PageProps<"/cms/stock">) {
  await requirePage("stock", "/cms/stock");
  const sp = await searchParams;
  const onlyLow = sp.show === "low";
  const d = await getStockPage(db);
  const items = d.items.filter((i) => (onlyLow ? i.active && i.status !== "ok" : true));
  const categories = [...new Set(d.items.map((i) => i.category))];
  return (
    <div>
      <PageHead title="Склад" meta="Расходники списываются сами, когда услугу оплачивают в кассе · ниже минимума - сообщение ресепшену" />
      <StatGrid
        stats={[
          { label: "Позиций", value: String(d.stats.items), dark: true },
          { label: "Заканчивается", value: String(d.stats.low), sub: "ниже минимума или нет" },
          { label: "Стоимость остатков", value: somoni(d.stats.value), sub: "по цене упаковки" },
        ]}
      />
      <section className={s.panel} style={{ marginTop: 22 }} aria-labelledby="items">
        <SectionHead
          title={<span id="items">Остатки</span>}
          action={
            <span className={s.presets}>
              <Link href="/cms/stock" aria-current={!onlyLow ? "true" : undefined}>
                Все
              </Link>
              <Link href="/cms/stock?show=low" aria-current={onlyLow ? "true" : undefined}>
                Заканчивается · {d.stats.low}
              </Link>
            </span>
          }
        />
        {items.length === 0 && <p className={s.muted}>{onlyLow ? "Всего хватает." : "Склад пуст - добавьте первую позицию."}</p>}
        <div className={s.scroll}>
          <table className={s.table}>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} data-item={i.name} style={i.active ? undefined : { opacity: 0.5 }}>
                  <td>
                    <b>{i.name}</b>
                    <small>
                      {i.category}
                      {i.supplier ? ` · ${i.supplier}` : ""}
                      {i.usedBy.length ? ` · ${i.usedBy.join(", ")}` : ""}
                    </small>
                  </td>
                  <td className={s.num}>
                    <span className={s.money} data-testid="qty">
                      {qty(i.quantity, i.unit)}
                    </span>
                    <small>
                      {inPacks(i.quantity, i.packSize, i.unit)} · мин. {qty(i.minQuantity, i.unit)}
                    </small>
                  </td>
                  <td>
                    {i.status === "out" ? <Tag tone="chair">Нет</Tag> : i.status === "low" ? <Tag tone="pending">Мало</Tag> : <Tag tone="confirmed">Есть</Tag>}
                  </td>
                  <td style={{ width: 330 }}>
                    <ItemActions item={i} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className={s.grid}>
        <div className={s.stack}>
          <section className={s.panel} aria-labelledby="new-item">
            <SectionHead title={<span id="new-item">Новая позиция</span>} />
            <ItemForm />
            <datalist id="stock-cats">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </section>
          <section className={s.panel} aria-labelledby="norms">
            <SectionHead title={<span id="norms">Расход на услуги</span>} />
            <p className={s.muted}>Сколько уходит на одну услугу. Спишется со склада, когда услугу оплатят в кассе.</p>
            <NormsEditor services={d.services} items={d.items} />
          </section>
        </div>

        <div className={s.stack}>

          <section className={s.panel} aria-labelledby="moves">
            <SectionHead title={<span id="moves">Движение</span>} />
            {d.moves.length === 0 && <p className={s.muted}>Пока ничего не происходило.</p>}
            {d.moves.length > 0 && (
              <div className={s.scroll}>
                <table className={s.table}>
                  <tbody>
                    {d.moves.map((m) => (
                      <tr key={m.id}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {shortDate(m.at)}, {clock(m.at)}
                        </td>
                        <td>
                          {m.item}
                          <small>
                            {KIND[m.kind]}
                            {m.receipt ? ` · чек №${m.receipt}` : ""}
                            {m.note ? ` · ${m.note}` : ""}
                            {m.by ? ` · ${m.by}` : ""}
                          </small>
                        </td>
                        <td className={`${s.num} ${m.delta < 0 ? s.diffMinus : s.diffPlus}`}>{m.delta > 0 ? `+${qty(m.delta, m.unit)}` : m.delta < 0 ? `−${qty(-m.delta, m.unit)}` : "±0"}</td>
                        <td className={s.num}>{qty(m.balance, m.unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
