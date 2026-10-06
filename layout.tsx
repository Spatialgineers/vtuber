import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SGX vTuber Engine · Spatialgineers",
  description: "A realtime 3D performance studio for Tales, Terps & Tech, powered by MediaPipe.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
