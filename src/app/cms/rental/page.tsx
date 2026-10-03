import { PageHead } from "@/components/ui/Headings";
import { requirePage } from "@/server/auth";
import { getRental } from "@/server/rental";
import { DressCard } from "./DressCard";
import s from "./rental.module.css";

const dressWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "платье" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "платья" : "платьев");
const bookingWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "бронь" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "брони" : "броней");

// "Прокат платьев" - design isRental.
export default async function RentalPage() {
  await requirePage("rental", "/cms/rental");
  const r = await getRental();
  return (
    <div>
      <PageHead
        title="Прокат платьев"
        meta={`${r.dresses.length} ${dressWord(r.dresses.length)} · ${r.upcoming} ${bookingWord(r.upcoming)} впереди`}
      />
      <div className={s.grid}>
        {r.dresses.map((d) => (
          <DressCard key={d.id} dress={d} today={r.today} />
        ))}
      </div>
    </div>
  );
}
