import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "멍냥앨범",
  description: "우리 아이의 모든 순간을 한곳에",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#F47E66",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
