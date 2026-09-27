import { requirePage } from "@/server/auth";
import { ComingSoon } from "../ComingSoon";
import { FoundRecord } from "../FoundRecord";

export default async function Page({ searchParams }: PageProps<"/cms/guests">) {
  const user = await requirePage("guests", "/cms/guests");
  const sp = await searchParams;
  return (
    <>
      <FoundRecord kind="guest" id={typeof sp.guest === "string" ? sp.guest : undefined} user={user} />
      <ComingSoon title="Книга гостей" />
    </>
  );
}
