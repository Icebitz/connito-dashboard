import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Connito Subnet 102 Leaderboard",
  description: "Real-time Bittensor subnet 102 leaderboard dashboard.",
  icons: {
    icon: [
      {
        url: "/favicon.svg",
        type: "image/svg+xml"
      }
    ],
    shortcut: "/favicon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
