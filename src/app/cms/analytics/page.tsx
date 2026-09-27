import { requirePage } from "@/server/auth";
import { ComingSoon } from "../ComingSoon";

export default async function Page() {
  await requirePage("analytics", "/cms/analytics");
  return (
    <>
      <ComingSoon title="Аналитика" />
    </>
  );
}
