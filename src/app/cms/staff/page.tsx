import { requirePage } from "@/server/auth";
import { ComingSoon } from "../ComingSoon";

export default async function Page() {
  await requirePage("staff", "/cms/staff");
  return (
    <>
      <ComingSoon title="Мастера и график" />
    </>
  );
}
