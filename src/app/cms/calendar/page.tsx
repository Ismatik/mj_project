import { requirePage } from "@/server/auth";
import { ComingSoon } from "../ComingSoon";
import { FoundRecord } from "../FoundRecord";

export default async function Page({ searchParams }: PageProps<"/cms/calendar">) {
  const user = await requirePage("calendar", "/cms/calendar");
  const sp = await searchParams;
  return (
    <>
      <FoundRecord kind="appt" id={typeof sp.appt === "string" ? sp.appt : undefined} user={user} />
      <ComingSoon title="Календарь записей" />
    </>
  );
}
