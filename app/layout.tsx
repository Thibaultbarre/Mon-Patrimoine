import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mon Patrimoine",
  description: "Tableau de bord de projections patrimoniales",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', BlinkMacSystemFont, 'Helvetica Neue', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
