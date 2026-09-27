import { redirect } from "next/navigation";
import { PageHead } from "@/components/ui/Headings";
import { canUseCms, homeFor, ROLE_LABEL } from "@/lib/access";
import { requireUser } from "@/server/auth";
import { PasswordForm } from "../settings/SettingsForms";

// Any team member can change their own password here.
export default async function AccountPage() {
  const user = await requireUser("/cms/account");
  if (!canUseCms(user.role)) redirect(homeFor(user.role));
  return (
    <div style={{ maxWidth: 520 }}>
      <PageHead title="Мой пароль" meta={`${user.name} · ${ROLE_LABEL[user.role]} · логин ${user.login}`} />
      <PasswordForm />
    </div>
  );
}
