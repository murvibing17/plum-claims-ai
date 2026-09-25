import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plum Claims AI",
  description: "AI-powered health insurance claim processing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}