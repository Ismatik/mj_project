import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { PageHead } from "@/components/ui/Headings";
import { requirePage } from "@/server/auth";
import { getServiceMenu } from "@/server/catalog";
import { NewService, ServiceRow } from "./ServiceRow";
import s from "./services.module.css";

// "Меню услуг и цены" — design isServices. Only the owner edits prices.
export default async function ServicesPage() {
  const user = await requirePage("services", "/cms/services");
  const menu = await getServiceMenu();
  const canEdit = user.role === "OWNER";
  const count = menu.categories.reduce((n, c) => n + c.services.length, 0);

  return (
    <div>
      <PageHead title="Меню услуг и цены" meta={`${count} услуг · цены в сомони${canEdit ? " · нажмите «Изменить», чтобы поправить" : ""}`} />
      {menu.categories.map((c) => (
        <section key={c.id} className={s.group}>
          <h2 className={s.groupTitle}>
            <CategoryIcon name={c.icon} size={18} />
            {c.name}
          </h2>
          {c.services.map((sv) => (
            <ServiceRow key={sv.id} service={sv} staff={menu.staff} canEdit={canEdit} />
          ))}
          {canEdit && <NewService categoryId={c.id} staff={menu.staff} />}
        </section>
      ))}
    </div>
  );
}
