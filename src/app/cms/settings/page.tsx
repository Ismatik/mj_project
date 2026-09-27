import { requirePage } from "@/server/auth";
import { ComingSoon } from "../ComingSoon";

export default async function Page() {
  await requirePage("settings", "/cms/settings");
  return (
    <>
      <ComingSoon title="Настройки салона" />
    </>
  );
}
