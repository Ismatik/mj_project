import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Monogram } from "@/components/ui/Monogram";
import { safeNext } from "@/lib/access";
import { getCurrentUser } from "@/server/auth";
import { LoginForm } from "./LoginForm";
import s from "./login.module.css";

export const metadata: Metadata = { title: "Вход · Mavzunai Jovid", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : "";
  const user = await getCurrentUser();
  if (user) redirect(safeNext(nextPath, user.role));

  return (
    <main className={s.page}>
      <aside className={s.brand}>
        <Monogram size={132} />
        <div className={s.brandName}>Mavzunai Jovid</div>
        <div className={s.brandTag}>gallery of beauty mj</div>
        <p className={s.brandNote}>Салон красоты и свадебный зал · ул. Бухоро, Душанбе</p>
      </aside>
      <section className={s.formSide}>
        <div className={s.formBox}>
          <div className={s.kicker}>Вход для команды</div>
          <h1 className={s.title}>Добро пожаловать</h1>
          <p className={s.lead}>CMS салона и админка сайта — один вход для всех.</p>
          <LoginForm next={nextPath} />
          <p className={s.help}>Забыли пароль? Обратитесь к владелице салона.</p>
        </div>
      </section>
    </main>
  );
}
