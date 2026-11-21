import type { Metadata } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./auth";

const newsreader = Newsreader({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-newsreader", display: "swap" });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Dynasty FF",
  description: "Roster, salary cap and rookie draft analysis for a dynasty fantasy football team.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${newsreader.variable} ${plexSans.variable}`}>
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
