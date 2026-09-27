import { requirePage } from "@/server/auth";
import { getPos } from "@/server/pos";
import { FoundRecord } from "../FoundRecord";
import { PosScreen } from "./PosScreen";

export default async function PosPage({ searchParams }: PageProps<"/cms/pos">) {
  const user = await requirePage("pos", "/cms/pos");
  const sp = await searchParams;
  const data = await getPos();
  const appt = typeof sp.appt === "string" ? sp.appt : undefined;
  return (
    <>
      <FoundRecord kind="sale" id={typeof sp.sale === "string" ? sp.sale : undefined} user={user} />
      <PosScreen key={appt ?? "pos"} data={data} initialAppt={appt} />
    </>
  );
}
