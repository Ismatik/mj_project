import type { Metadata } from "next";
import { Jost, Zen_Old_Mincho } from "next/font/google";
import { FxProvider } from "@/components/fx/FxProvider";
import { getLang } from "@/server/lang";
import "./globals.css";

const mincho = Zen_Old_Mincho({
  variable: "--font-mincho",
  weight: ["400", "600", "700"],
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const jost = Jost({
  variable: "--font-jost",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const domain = process.env.SITE_DOMAIN && process.env.SITE_DOMAIN !== "localhost" ? process.env.SITE_DOMAIN : null;

export const metadata: Metadata = {
  title: "Mavzunai Jovid - Gallery of Beauty MJ",
  description: "Салон красоты и свадебный зал в Душанбе.",
  ...(domain ? { metadataBase: new URL(`https://${domain}`) } : {}),
};

const HTML_LANG = { ru: "ru", tg: "tg", en: "en" } as const;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={HTML_LANG[lang]} className={`${mincho.variable} ${jost.variable}`}>
      <body>
        <FxProvider>{children}</FxProvider>
      </body>
    </html>
  );
}
