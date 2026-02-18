import type { Metadata } from "next";
import { Karla, Inter } from "next/font/google";
import "./globals.css";

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Blackjack Now — Real-Time Multiplayer Casino",
  description: "A premium real-time multiplayer blackjack experience. Play with friends, create private tables, and test your luck.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${karla.variable} ${inter.variable} antialiased bg-dark text-foreground font-sans`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
