import { requirePage } from "@/server/auth";
import { ComingSoon } from "../ComingSoon";

export default async function Page() {
  await requirePage("services", "/cms/services");
  return (
    <>
      <ComingSoon title="Меню услуг и цены" />
    </>
  );
}
