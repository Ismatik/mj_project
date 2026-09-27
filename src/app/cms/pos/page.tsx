import { requirePage } from "@/server/auth";
import { ComingSoon } from "../ComingSoon";
import { FoundRecord } from "../FoundRecord";

export default async function Page({ searchParams }: PageProps<"/cms/pos">) {
  const user = await requirePage("pos", "/cms/pos");
  const sp = await searchParams;
  return (
    <>
      <FoundRecord kind="sale" id={typeof sp.sale === "string" ? sp.sale : undefined} user={user} />
      <ComingSoon title="Ресепшен и касса" />
    </>
  );
}
