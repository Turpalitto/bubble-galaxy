import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const title = "Bubble Galaxy — космический bubble shooter";
const description =
  "Лопай пузыри, собирай комбо и покоряй галактику. 40 уровней, бесконечный режим, ежедневный челлендж и мировая таблица лидеров. Играй бесплатно в браузере.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title,
  description,
  applicationName: "Bubble Galaxy",
  keywords: ["bubble shooter", "пузыри", "игра", "казуальная игра", "bubble galaxy", "онлайн игра"],
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-512.png", apple: "/icons/icon-512.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Bubble Galaxy" },
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "Bubble Galaxy",
    images: [{ url: "/og-cover.jpg", width: 1200, height: 630, alt: "Bubble Galaxy" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og-cover.jpg"] },
};

export const viewport: Viewport = {
  themeColor: "#0b1030",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
