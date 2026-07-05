import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedLocker — your health, finally in one place.",
  description: "MedLocker is a private, beautifully designed health companion for you and your family. Records, medicines, vitals, AI insights and your care team — all in your pocket. Built in Sri Lanka.",
  other: {
    "theme-color": "#FBF9F4"
  },
  openGraph: {
    type: "website",
    title: "MedLocker — your health, finally in one place.",
    description: "A private, beautifully designed health companion. Records, medicines, vitals, AI insights, and your care team — all in your pocket. Built in Sri Lanka.",
    images: "https://healthhub.app/og-image.png",
    url: "https://healthhub.app",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400;1,9..144,500&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
