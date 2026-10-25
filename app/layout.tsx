import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "VOX",
  description: "Toda voz tem sua vez.",
  icons: { icon: "/vox.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body className={spaceGrotesk.variable}>{children}</body>
    </html>
  );
}
