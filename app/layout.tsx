import type { Metadata } from "next";
import { CONNITO_LOGO_URL } from "./dashboard/brand";
import "./globals.css";
import "./leaderboard.css";

export const metadata: Metadata = {
  title: "Connito Subnet 102 Leaderboard",
  description: "Real-time Bittensor subnet 102 leaderboard dashboard.",
  icons: {
    icon: [
      {
        url: CONNITO_LOGO_URL
      }
    ],
    shortcut: CONNITO_LOGO_URL
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
