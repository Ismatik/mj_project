import { PageHead, SectionHead } from "@/components/ui/Headings";
import { ROLE_LABEL } from "@/lib/access";
import { db } from "@/lib/db";
import { requirePage } from "@/server/auth";
import { SETTING_KEYS } from "@/lib/settings-keys";
import { PasswordForm, SalonForm, TeamList } from "./SettingsForms";
import s from "./settings.module.css";

// "Настройки салона" — design isSettings, plus password and team access.
export default async function SettingsPage() {
  const user = await requirePage("settings", "/cms/settings");
  const [settings, users] = await Promise.all([
    db.setting.findMany({ where: { key: { in: [...SETTING_KEYS] } } }),
    db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] }),
  ]);
  const values = Object.fromEntries(settings.map((x) => [x.key, typeof x.value === "string" ? x.value : ""]));

  return (
    <div className={s.page}>
      <PageHead title="Настройки салона" />
      <SalonForm initial={values} />
      <div className={s.block}>
        <SectionHead title="Мой пароль" />
        <PasswordForm />
      </div>
      <div className={s.block}>
        <TeamList
          users={users.map((u) => ({ id: u.id, name: u.name, login: u.login, roleLabel: ROLE_LABEL[u.role], active: u.active, me: u.id === user.id }))}
        />
      </div>
    </div>
  );
}
