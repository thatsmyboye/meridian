import type { Metadata } from "next";
import AppHeader from "./components/AppHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meridian",
  description: "Know what works. Ship it everywhere.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
