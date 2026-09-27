import type { Metadata } from "next";
import { Jost, Zen_Old_Mincho } from "next/font/google";
import { FxProvider } from "@/components/fx/FxProvider";
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

export const metadata: Metadata = {
  title: "Mavzunai Jovid — Gallery of Beauty MJ",
  description: "Салон красоты и свадебный зал в Душанбе.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${mincho.variable} ${jost.variable}`}>
      <body>
        <FxProvider>{children}</FxProvider>
      </body>
    </html>
  );
}
