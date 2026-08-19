import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { AuthProvider } from "./auth";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;

  return {
    title: "Front Office — Dynasty Intelligence",
    description: "Replacement-aware roster, salary cap, and rookie draft intelligence for serious dynasty teams.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Front Office — Dynasty Intelligence",
      description: "Dynasty intelligence, through your lens.",
      images: [{ url: image, width: 1734, height: 907, alt: "Front Office dynasty intelligence" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Front Office — Dynasty Intelligence",
      description: "Dynasty intelligence, through your lens.",
      images: [image],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
