import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fila de Controles",
  description: "Fila de respostas ao vivo para quiz com controles sem fio.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
